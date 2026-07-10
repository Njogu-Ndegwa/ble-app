'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { LoadingState } from '@/components/ui/State';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  AssemblyApiError,
  getAssemblyMo,
  listGovernedLotsBySerial,
  openBuildRecord,
  signOffAssembly,
  updateBuildRecord,
} from '@/lib/assembly-api';
import {
  ASSEMBLY_COMPONENT_KINDS,
  type AssemblyMoDetail,
  type AssemblyMoDetailResponse,
  type AssemblyMoRow,
  type BuildRecord,
  type ComponentKind,
  type PosReadiness,
} from '@/lib/assembly-types';
import { MO_STATE_LABEL, moStateBadgeClass } from './AssemblyQueue';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ComponentDraft = {
  localId: string;
  component_kind: ComponentKind;
  serial_text: string;
};

type VerifyResult = {
  serial: string;
  governedCount: number;
  checkedAt: string;
};

const DEFAULT_COMPONENT_KINDS: ComponentKind[] = ['chassis', 'mcu', 'motor', 'vcu'];

const COMPONENT_LABEL: Record<ComponentKind, string> = {
  chassis: 'Chassis',
  mcu: 'MCU',
  motor: 'Motor',
  vcu: 'VCU',
  other: 'Other',
};

const READINESS_LABEL: Record<string, string> = {
  serial_created: 'Serial created',
  product_sale_ok: 'Product salable',
  available_in_pos: 'POS catalog',
  qty_on_hand: 'On hand',
  governed_in_sa: 'SA governed',
  mo_done: 'MO done',
};

let localIdCounter = 0;
function makeLocalId(): string {
  localIdCounter += 1;
  return `component-${Date.now()}-${localIdCounter}`;
}

function normalizeMoDetail(response: AssemblyMoDetailResponse): {
  mo: AssemblyMoDetail;
  buildRecord: BuildRecord | null;
  posReadiness: PosReadiness | null;
} {
  const mo = response.mo;
  return {
    mo,
    buildRecord: response.build_record ?? mo.build_record ?? null,
    posReadiness: response.pos_readiness ?? mo.pos_readiness ?? null,
  };
}

function shouldOpenDraft(buildRecord: BuildRecord | null, state?: string): boolean {
  if (state === 'done' || state === 'cancel') return false;
  if (buildRecord?.available === false) return false;
  return !buildRecord || buildRecord.status === 'none' || buildRecord.status == null;
}

function componentRowsFromBuildRecord(buildRecord: BuildRecord | null): ComponentDraft[] {
  const existing = buildRecord?.components ?? [];
  if (existing.length > 0) {
    return existing.map((component) => ({
      localId: component.id ? `component-${component.id}` : makeLocalId(),
      component_kind: component.component_kind,
      serial_text: component.serial_text ?? '',
    }));
  }

  return DEFAULT_COMPONENT_KINDS.map((kind) => ({
    localId: makeLocalId(),
    component_kind: kind,
    serial_text: '',
  }));
}

function componentPayload(rows: ComponentDraft[]) {
  return rows
    .map((row) => ({
      component_kind: row.component_kind,
      serial_text: row.serial_text.trim(),
    }))
    .filter((row) => row.serial_text.length > 0);
}

function payloadFingerprint(rows: ComponentDraft[]): string {
  return JSON.stringify(componentPayload(rows));
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  height: '40px',
  padding: '8px 8px',
  fontSize: '12px',
  // Inline width because .form-input's `width: 100%` (globals.css) outranks
  // Tailwind utilities and would swallow the whole flex row.
  width: '104px',
  flexShrink: 0,
};

interface AssemblyDetailProps {
  mo: AssemblyMoRow;
  /** `changed` is true when the MO state moved (sign-off). */
  onBack: (changed?: boolean) => void;
}

export default function AssemblyDetail({ mo: initialMo, onBack }: AssemblyDetailProps) {
  const { t } = useI18n();

  const [mo, setMo] = useState<AssemblyMoDetail | AssemblyMoRow>(initialMo);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [buildRecord, setBuildRecord] = useState<BuildRecord | null>(null);
  const [posReadiness, setPosReadiness] = useState<PosReadiness | null>(null);
  const [componentRows, setComponentRows] = useState<ComponentDraft[]>(
    () => componentRowsFromBuildRecord(null),
  );

  const [componentsDirty, setComponentsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFingerprintRef = useRef('[]');
  const changedRef = useRef(false);

  const [fgSerial, setFgSerial] = useState('');
  const [oemId, setOemId] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [governLot, setGovernLot] = useState(true);
  const [signingOff, setSigningOff] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const errorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof AssemblyApiError) {
        if (error.status === 404) {
          return (
            t('assembly.detail.notVisible') ||
            'This MO is not visible under the selected Production Location SA. Claim it first or pick another MO.'
          );
        }
        if (error.status === 400) {
          return error.message || (t('assembly.detail.noDraft') || 'Open a draft Build Record before saving components or signing off.');
        }
        if (error.status === 403) {
          return t('assembly.detail.noPermission') || 'You do not have permission for this assembly action.';
        }
        if (error.status === 503) {
          return error.message || (t('assembly.detail.unavailable') || 'Assembly Cell is not available on the Odoo backend.');
        }
        return error.message;
      }
      return error instanceof Error
        ? error.message
        : (t('assembly.detail.requestFailed') || 'Assembly request failed');
    },
    [t],
  );

  const applyBuildRecord = useCallback((record: BuildRecord | null) => {
    const rows = componentRowsFromBuildRecord(record);
    setBuildRecord(record);
    setComponentRows(rows);
    setComponentsDirty(false);
    setSaveError(null);
    setSaveState('idle');
    lastSavedFingerprintRef.current = payloadFingerprint(rows);
    setFgSerial(record?.serial ?? '');
    setOemId(record?.oem_id ?? '');
  }, []);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setDetailError(null);
    setVerifyResult(null);
    try {
      const token = getSalesRoleToken() || '';
      const response = await getAssemblyMo(initialMo.id, token);
      const detail = normalizeMoDetail(response);
      let record = detail.buildRecord;

      // Auto-open a draft Build Record so the operator can start entering
      // component serials right away (same behaviour as the desktop portal).
      if (shouldOpenDraft(record, detail.mo.state)) {
        record = await openBuildRecord(
          initialMo.id,
          { ckd_lot_id: record?.ckd_lot_id ?? undefined },
          token,
        );
      }

      setMo(detail.mo);
      applyBuildRecord(record);
      setPosReadiness(detail.posReadiness);
    } catch (error) {
      setDetailError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyBuildRecord, errorMessage, initialMo.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const saveComponentsNow = useCallback(
    async (silent = false): Promise<boolean> => {
      if (buildRecord?.status !== 'draft') return true;
      const payload = componentPayload(componentRows);
      const fingerprint = JSON.stringify(payload);
      if (fingerprint === lastSavedFingerprintRef.current && !componentsDirty) return true;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setSaveState('saving');
      setSaveError(null);
      try {
        const token = getSalesRoleToken() || '';
        const record = await updateBuildRecord(
          initialMo.id,
          {
            ckd_lot_id: buildRecord.ckd_lot_id ?? undefined,
            components: payload,
          },
          token,
        );
        setBuildRecord(record);
        lastSavedFingerprintRef.current = fingerprint;
        setComponentsDirty(false);
        setSaveState('saved');
        if (!silent) toast.success(t('assembly.detail.componentsSaved') || 'Component entries saved');
        return true;
      } catch (error) {
        const message = errorMessage(error);
        setSaveState('error');
        setSaveError(message);
        if (!silent) toast.error(message);
        return false;
      }
    },
    [buildRecord, componentRows, componentsDirty, errorMessage, initialMo.id, t],
  );

  // Debounced autosave while the Build Record is in draft.
  useEffect(() => {
    if (!componentsDirty || buildRecord?.status !== 'draft') return;

    setSaveState('saving');
    setSaveError(null);
    saveTimerRef.current = setTimeout(() => {
      saveComponentsNow(true);
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [buildRecord?.status, componentRows, componentsDirty, saveComponentsNow]);

  const updateComponentRow = (
    localId: string,
    patch: Partial<Pick<ComponentDraft, 'component_kind' | 'serial_text'>>,
  ) => {
    setComponentRows((rows) =>
      rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
    setComponentsDirty(true);
  };

  const addComponentRow = () => {
    setComponentRows((rows) => [
      ...rows,
      { localId: makeLocalId(), component_kind: 'other', serial_text: '' },
    ]);
    setComponentsDirty(true);
  };

  const removeComponentRow = (localId: string) => {
    setComponentRows((rows) => rows.filter((row) => row.localId !== localId));
    setComponentsDirty(true);
  };

  const handleSignOff = async () => {
    const serial = fgSerial.trim();
    const oem = oemId.trim();
    if (!serial || !oem) {
      toast.error(t('assembly.signOff.missingFields') || 'Enter both FG serial and OEM-ID');
      return;
    }

    const parsedFleetId = fleetId.trim() ? Number(fleetId) : null;
    if (parsedFleetId !== null && (!Number.isInteger(parsedFleetId) || parsedFleetId <= 0)) {
      toast.error(t('assembly.signOff.invalidFleet') || 'Fleet ID must be a positive number');
      return;
    }

    setSigningOff(true);
    try {
      const componentsSaved = await saveComponentsNow(true);
      if (!componentsSaved) return;
      const token = getSalesRoleToken() || '';
      const response = await signOffAssembly(
        initialMo.id,
        {
          serial,
          oem_id: oem,
          govern_lot: governLot,
          fleet_id: parsedFleetId,
        },
        token,
      );

      applyBuildRecord(response.build_record);
      setPosReadiness(response.pos_readiness);
      setVerifyResult(null);
      setMo((prev) => ({
        ...prev,
        state: response.mo_state,
        qty_produced: Math.max(Number(prev.qty_produced ?? 0), Number(prev.qty_planned ?? 0)),
      }));
      changedRef.current = true;
      toast.success(
        (t('assembly.signOff.success') || '{mo} signed off as {serial}')
          .replace('{mo}', initialMo.name)
          .replace('{serial}', response.lot.serial),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSigningOff(false);
    }
  };

  const handleVerify = async () => {
    const serial = (buildRecord?.serial || fgSerial).trim();
    if (!serial) {
      toast.error(t('assembly.verify.missingSerial') || 'Enter or sign off an FG serial before verification');
      return;
    }

    setVerifying(true);
    try {
      const token = getSalesRoleToken() || '';
      const [detailResponse, lots] = await Promise.all([
        getAssemblyMo(initialMo.id, token),
        listGovernedLotsBySerial(serial, token),
      ]);
      const detail = normalizeMoDetail(detailResponse);
      setMo(detail.mo);
      applyBuildRecord(detail.buildRecord);
      setPosReadiness(detail.posReadiness);
      setVerifyResult({
        serial,
        governedCount: lots.length,
        checkedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      if (lots.length > 0) {
        toast.success(t('assembly.verify.found') || 'Governed serial found');
      } else {
        toast(t('assembly.verify.notFound') || 'No governed serial found yet', { icon: '⚠️' });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  const canEditComponents = buildRecord?.status === 'draft';
  const canSignOff = buildRecord?.status === 'draft';
  const buildStatus = buildRecord?.status || 'none';

  if (loading) {
    return <LoadingState message={t('assembly.detail.loading') || 'Loading assembly order...'} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- Top bar ---- */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={() => onBack(changedRef.current)}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label={t('common.back') || 'Back'}
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="flex-1 text-lg font-semibold text-text-primary truncate">{mo.name}</h2>
        <span className={moStateBadgeClass(mo.state)}>{MO_STATE_LABEL[mo.state] ?? mo.state}</span>
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        {detailError && (
          <div
            className="rounded-xl p-3 text-sm flex items-start gap-2"
            style={{ background: 'var(--color-error-soft, #fef2f2)', color: 'var(--color-error, #dc2626)' }}
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{detailError}</span>
          </div>
        )}

        {/* MO summary */}
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm text-text-primary font-medium truncate">
              {mo.product?.name || (t('assembly.queue.noProduct') || 'No product')}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="list-card-badge list-card-badge--default">
                {(t('assembly.detail.build') || 'Build')} {buildStatus}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                {t('assembly.detail.planned') || 'Planned'}
              </p>
              <p className="text-sm font-semibold text-text-primary">{mo.qty_planned ?? 0}</p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                {t('assembly.detail.produced') || 'Produced'}
              </p>
              <p className="text-sm font-semibold text-text-primary">{mo.qty_produced ?? 0}</p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                {t('assembly.detail.buildId') || 'Build ID'}
              </p>
              <p className="text-sm font-semibold text-text-primary">{buildRecord?.id ?? '--'}</p>
            </div>
          </div>
        </div>

        {/* Component entries */}
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {t('assembly.components.title') || 'Component Entries'}
              </h3>
              <p className="text-xs text-text-muted">
                {t('assembly.components.hint') || 'Scan each component serial into the Build Record.'}
              </p>
            </div>
            <SaveIndicator state={saveState} error={saveError} t={t} />
          </div>

          <div className="p-3 flex flex-col gap-2">
            {componentRows.map((row, index) => (
              <div key={row.localId} className="flex gap-2">
                <select
                  className="form-input"
                  style={selectStyle}
                  value={row.component_kind}
                  disabled={!canEditComponents}
                  onChange={(e) =>
                    updateComponentRow(row.localId, {
                      component_kind: e.target.value as ComponentKind,
                    })
                  }
                  aria-label={`Component kind ${index + 1}`}
                >
                  {ASSEMBLY_COMPONENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {COMPONENT_LABEL[kind]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm font-mono placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  value={row.serial_text}
                  disabled={!canEditComponents}
                  onChange={(e) => updateComponentRow(row.localId, { serial_text: e.target.value })}
                  placeholder={`${COMPONENT_LABEL[row.component_kind]} serial`}
                />
                <button
                  type="button"
                  onClick={() => removeComponentRow(row.localId)}
                  disabled={!canEditComponents || componentRows.length <= 1}
                  className="shrink-0 w-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-[var(--color-error)] disabled:opacity-40 transition-colors"
                  aria-label={t('assembly.components.remove') || 'Remove component'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 mt-1">
              <button
                type="button"
                onClick={addComponentRow}
                disabled={!canEditComponents}
                className="px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                <Plus size={14} />
                {t('assembly.components.add') || 'Component'}
              </button>
              <button
                type="button"
                onClick={() => saveComponentsNow(false)}
                disabled={!canEditComponents || saveState === 'saving'}
                style={{ backgroundColor: 'var(--color-brand)' }}
                className="px-3 py-2 rounded-lg text-black text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {saveState === 'saving' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {t('assembly.components.save') || 'Save entries'}
              </button>
            </div>
          </div>
        </div>

        {/* Manager sign-off */}
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {t('assembly.signOff.title') || 'Manager Sign-off'}
              </h3>
              <p className="text-xs text-text-muted">
                {t('assembly.signOff.hint') || 'Finalizes the Build Record and marks the MO done.'}
              </p>
            </div>
            <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  {t('assembly.signOff.fgSerial') || 'FG serial'}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm font-mono placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  value={fgSerial}
                  onChange={(e) => setFgSerial(e.target.value)}
                  disabled={!canSignOff || signingOff}
                  placeholder="FG-ASM-2026-001"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  {t('assembly.signOff.oemId') || 'OEM-ID'}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm font-mono placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                  value={oemId}
                  onChange={(e) => setOemId(e.target.value)}
                  disabled={!canSignOff || signingOff}
                  placeholder="OEM-TC-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t('assembly.signOff.fleetId') || 'Fleet ID (optional)'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                value={fleetId}
                onChange={(e) => setFleetId(e.target.value)}
                disabled={!canSignOff || signingOff}
                placeholder={t('assembly.signOff.fleetPlaceholder') || 'Assign the finished serial to a fleet'}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={governLot}
                disabled={!canSignOff || signingOff || Boolean(fleetId.trim())}
                onChange={(e) => setGovernLot(e.target.checked)}
              />
              <span>
                {t('assembly.signOff.governLot') ||
                  'Govern finished serial to this SA when no fleet is selected'}
              </span>
            </label>

            <button
              type="button"
              onClick={handleSignOff}
              disabled={!canSignOff || signingOff}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              {signingOff ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BadgeCheck size={16} />
              )}
              {t('assembly.signOff.submit') || 'Sign off assembly'}
            </button>
          </div>
        </div>

        {/* POS readiness */}
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {t('assembly.readiness.title') || 'POS Readiness'}
              </h3>
              <p className="text-xs text-text-muted">
                {t('assembly.readiness.hint') || 'Verify after sign-off and FG put-away.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="shrink-0 px-3 py-2 rounded-lg border border-border text-text-primary text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {verifying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {t('assembly.readiness.verify') || 'Verify'}
            </button>
          </div>

          <div className="p-3 flex flex-col gap-2">
            {!posReadiness ? (
              <p className="text-sm text-text-muted px-1 py-1">
                {t('assembly.readiness.pending') || 'Readiness appears after MO detail or sign-off.'}
              </p>
            ) : (
              <>
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{
                    background: posReadiness.ready
                      ? 'var(--color-success-soft, rgba(34,197,94,0.12))'
                      : 'var(--color-warning-soft, rgba(245,158,11,0.12))',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <PackageCheck
                      size={15}
                      style={{
                        color: posReadiness.ready ? 'var(--color-success)' : 'var(--color-warning, #f59e0b)',
                      }}
                    />
                    <span className="text-sm font-medium text-text-primary">
                      {posReadiness.ready
                        ? (t('assembly.readiness.ready') || 'Ready for POS')
                        : (t('assembly.readiness.notReady') || 'Not ready yet')}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {(t('assembly.readiness.onHand') || 'On hand')}: {posReadiness.qty_on_hand}
                  </span>
                </div>

                {(posReadiness.checks ?? []).map((check) => (
                  <div
                    key={check.key}
                    className="flex items-start gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    {check.ok ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <XCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {READINESS_LABEL[check.key] ?? check.key}
                      </p>
                      {check.hint && <p className="text-xs text-text-muted mt-0.5">{check.hint}</p>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {verifyResult && (
              <div className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  {verifyResult.governedCount > 0 ? (
                    <CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <XCircle size={15} style={{ color: 'var(--color-warning, #f59e0b)' }} />
                  )}
                  <span className="text-sm text-text-primary font-mono">
                    {verifyResult.serial}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {(t('assembly.verify.governedCount') || '{count} governed lot(s) found').replace(
                      '{count}',
                      String(verifyResult.governedCount),
                    )}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {(t('assembly.verify.checkedAt') || 'Checked at {time}').replace('{time}', verifyResult.checkedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  error,
  t,
}: {
  state: SaveState;
  error: string | null;
  t: (key: string) => string | undefined;
}) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-muted shrink-0">
        <Loader2 size={12} className="animate-spin" />
        {t('assembly.components.saving') || 'Saving'}
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--color-success)' }}>
        <CheckCircle2 size={12} />
        {t('assembly.components.saved') || 'Saved'}
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs shrink-0 max-w-[10rem]"
        style={{ color: 'var(--color-error)' }}
        title={error ?? undefined}
      >
        <AlertTriangle size={12} className="shrink-0" />
        <span className="truncate">{error ?? (t('assembly.components.saveFailed') || 'Save failed')}</span>
      </span>
    );
  }
  return null;
}
