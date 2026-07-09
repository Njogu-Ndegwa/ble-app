'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Boxes,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { LoadingState, ErrorState } from '@/components/ui/State';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getProducts } from '@/lib/odoo-api';
import type { OdooProduct } from '@/lib/portal/types';
import {
  addFleetItem,
  createLot,
  deactivateFleet,
  getFleet,
  getLotBySerial,
  listFleetActors,
  listFleetItems,
  removeFleetItem,
  FleetsApiError,
} from '@/lib/fleets-api';
import {
  fleetKindLabel,
  type FleetActor,
  type FleetItem,
  type FleetRow,
} from '@/lib/fleets-types';
import { fleetStateBadgeClass } from './FleetsList';

type AddMode = 'existing' | 'register';

function formatDate(value?: string | false | null): string {
  if (!value) return '--';
  try {
    const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(value);
  }
}

interface FleetDetailProps {
  fleetId: number;
  /** `changed` is true when the fleet or its memberships changed. */
  onBack: (changed?: boolean) => void;
  onEdit: (fleet: FleetRow) => void;
}

export default function FleetDetail({ fleetId, onBack, onEdit }: FleetDetailProps) {
  const { t } = useI18n();

  const [fleet, setFleet] = useState<FleetRow | null>(null);
  const [items, setItems] = useState<FleetItem[]>([]);
  const [actors, setActors] = useState<FleetActor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changedRef = useRef(false);

  // Add-serial panel
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('existing');
  const [serialInput, setSerialInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [product, setProduct] = useState<OdooProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<OdooProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productListOpen, setProductListOpen] = useState(false);

  // Row-level confirms
  const [removeTarget, setRemoveTarget] = useState<FleetItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getSalesRoleToken() || '';
      setFleet(await getFleet(fleetId, token));
    } catch (err: any) {
      setError(err?.message ?? (t('fleets.detail.loadError') || 'Failed to load fleet'));
    } finally {
      setLoading(false);
    }
  }, [fleetId, t]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const token = getSalesRoleToken() || '';
      setItems(await listFleetItems(fleetId, token));
    } catch (err) {
      console.error('[fleets] load items failed', err);
    } finally {
      setLoadingItems(false);
    }
  }, [fleetId]);

  useEffect(() => {
    loadFleet();
    loadItems();
    // Actors are informational; a 403/404 just hides the card.
    const token = getSalesRoleToken() || '';
    listFleetActors(fleetId, token)
      .then(setActors)
      .catch((err) => {
        console.error('[fleets] load actors failed', err);
        setActors(null);
      });
  }, [fleetId, loadFleet, loadItems]);

  // Server-side product search for the register-serial mode.
  useEffect(() => {
    if (!productListOpen || addMode !== 'register') {
      setProductLoading(false);
      return;
    }

    let cancelled = false;
    setProductLoading(true);
    const timer = setTimeout(() => {
      getProducts({ search: productSearch.trim() || undefined, limit: 20 })
        .then((res) => {
          if (!cancelled) setProductOptions(res.products ?? []);
        })
        .catch((err) => {
          console.error('[fleets] product search failed', err);
          if (!cancelled) setProductOptions([]);
        })
        .finally(() => {
          if (!cancelled) setProductLoading(false);
        });
    }, productSearch.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addMode, productListOpen, productSearch]);

  const refreshAfterMembershipChange = useCallback(() => {
    changedRef.current = true;
    loadItems();
    // item_count lives on the fleet record
    const token = getSalesRoleToken() || '';
    getFleet(fleetId, token).then(setFleet).catch(() => {});
  }, [fleetId, loadItems]);

  const resetAddPanel = () => {
    setSerialInput('');
    setProduct(null);
    setProductSearch('');
    setProductOptions([]);
    setProductListOpen(false);
    setAddOpen(false);
  };

  const handleAddExisting = async () => {
    const serial = serialInput.trim();
    if (!serial) {
      toast.error(t('fleets.addSerial.missingSerial') || 'Enter a serial number');
      return;
    }
    setAdding(true);
    try {
      const token = getSalesRoleToken() || '';
      const lot = await getLotBySerial(serial, token);
      await addFleetItem(fleetId, lot.id, token);
      toast.success(
        (t('fleets.addSerial.added') || 'Serial {serial} added to fleet').replace('{serial}', lot.serial),
      );
      resetAddPanel();
      refreshAfterMembershipChange();
    } catch (err: any) {
      const message =
        err instanceof FleetsApiError && err.status === 404
          ? (t('fleets.addSerial.notFound') || 'Serial "{serial}" not found. Register it first.').replace('{serial}', serial)
          : err?.message ?? (t('fleets.addSerial.addError') || 'Failed to add serial');
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  const handleRegisterAndAdd = async () => {
    const serial = serialInput.trim();
    if (!product) {
      toast.error(t('fleets.addSerial.missingProduct') || 'Choose a product for the new serial');
      return;
    }
    if (!serial) {
      toast.error(t('fleets.addSerial.missingSerial') || 'Enter a serial number');
      return;
    }
    setAdding(true);
    try {
      const token = getSalesRoleToken() || '';
      // SOP: register the lot first, then assign it to the fleet.
      const lot = await createLot(product.id, serial, token);
      await addFleetItem(fleetId, lot.id, token);
      toast.success(
        (t('fleets.addSerial.registered') || 'Serial {serial} registered and added').replace('{serial}', lot.serial),
      );
      resetAddPanel();
      refreshAfterMembershipChange();
    } catch (err: any) {
      toast.error(err?.message ?? (t('fleets.addSerial.registerError') || 'Failed to register serial'));
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget?.lot) return;
    const { id: lotId, serial } = removeTarget.lot;
    setRemoving(true);
    try {
      const token = getSalesRoleToken() || '';
      await removeFleetItem(fleetId, lotId, token);
      toast.success(
        (t('fleets.removeSerial.removed') || 'Serial {serial} removed from fleet').replace('{serial}', serial),
      );
      setRemoveTarget(null);
      refreshAfterMembershipChange();
    } catch (err: any) {
      toast.error(err?.message ?? (t('fleets.removeSerial.error') || 'Failed to remove serial'));
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    setDeactivating(true);
    try {
      const token = getSalesRoleToken() || '';
      await deactivateFleet(fleetId, token);
      toast.success(t('fleets.deactivate.done') || 'Fleet deactivated');
      setDeactivateOpen(false);
      onBack(true);
    } catch (err: any) {
      toast.error(err?.message ?? (t('fleets.deactivate.error') || 'Failed to deactivate fleet'));
      setDeactivateOpen(false);
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return <LoadingState message={t('fleets.detail.loading') || 'Loading fleet...'} />;
  }

  if (error || !fleet) {
    return (
      <ErrorState
        message={error ?? (t('fleets.detail.notFound') || 'Fleet not found')}
        onRetry={loadFleet}
      />
    );
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
        <span className="flex-1" />
        <button
          onClick={() => onEdit(fleet)}
          className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-secondary"
          aria-label={t('fleets.detail.edit') || 'Edit'}
          title={t('fleets.detail.edit') || 'Edit'}
        >
          <Pencil size={18} />
        </button>
        {fleet.state === 'active' && (
          <button
            onClick={() => setDeactivateOpen(true)}
            className="p-2 rounded-lg hover:bg-bg-elevated transition-colors"
            style={{ color: 'var(--color-error)' }}
            aria-label={t('fleets.detail.deactivate') || 'Deactivate'}
            title={t('fleets.detail.deactivate') || 'Deactivate'}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-4 pt-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--bg-primary)' }}
          >
            <Boxes size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary truncate">
                {fleet.name || (t('fleets.detail.unnamed') || 'Unnamed fleet')}
              </h2>
              <span className={fleetStateBadgeClass(fleet.state)}>
                {fleet.state === 'active'
                  ? (t('fleets.state.active') || 'Active')
                  : (t('fleets.state.inactive') || 'Inactive')}
              </span>
            </div>
            <p className="text-sm text-text-muted truncate mt-0.5">
              {fleetKindLabel(fleet.fleet_kind)}
              {fleet.external_ref ? ` · ${fleet.external_ref}` : ''}
            </p>
          </div>
        </div>

        {/* Details card */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            {t('fleets.detail.details') || 'Details'}
          </h3>
          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
            <DetailRow
              label={t('fleets.detail.company') || 'Company'}
              value={Array.isArray(fleet.company_id) ? fleet.company_id[1] : '--'}
            />
            <DetailRow
              label={t('fleets.detail.partner') || 'Partner'}
              value={Array.isArray(fleet.partner_id) ? fleet.partner_id[1] : '--'}
            />
            <DetailRow
              label={t('fleets.detail.code') || 'Code'}
              value={fleet.code || '--'}
              mono
            />
            <DetailRow
              label={t('fleets.detail.serialCount') || 'Serials'}
              value={String(fleet.item_count ?? 0)}
            />
            <DetailRow
              label={t('fleets.detail.created') || 'Created'}
              value={formatDate(fleet.create_date)}
            />
            {fleet.note && (
              <div className="px-4 py-3">
                <p className="text-xs text-text-muted">{t('fleets.detail.note') || 'Note'}</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words mt-0.5">
                  {fleet.note}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Serials card */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {(t('fleets.detail.serials') || 'Serials')} ({items.length})
            </h3>
            {fleet.state === 'active' && (
              <button
                onClick={() => setAddOpen((o) => !o)}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--color-brand)' }}
              >
                {addOpen ? <X size={13} /> : <Plus size={13} />}
                {addOpen
                  ? (t('fleets.addSerial.close') || 'Close')
                  : (t('fleets.addSerial.open') || 'Add Serial')}
              </button>
            )}
          </div>

          {/* Add-serial panel */}
          {addOpen && (
            <div className="rounded-xl border border-border bg-bg-tertiary p-3 mb-2 flex flex-col gap-2">
              <div className="flex gap-2">
                {([
                  { key: 'existing', label: t('fleets.addSerial.existing') || 'Existing serial' },
                  { key: 'register', label: t('fleets.addSerial.register') || 'Register new' },
                ] as { key: AddMode; label: string }[]).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      addMode === tab.key
                        ? 'border-transparent text-text-inverse'
                        : 'border-border bg-bg-surface text-text-secondary'
                    }`}
                    style={addMode === tab.key ? { backgroundColor: 'var(--color-brand)' } : undefined}
                    onClick={() => setAddMode(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {addMode === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-muted">
                    {t('fleets.addSerial.product') || 'Product'}
                  </label>
                  {product ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2">
                      <PackageSearch size={14} className="text-text-muted shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                        {product.name}
                      </span>
                      <button
                        onClick={() => {
                          setProduct(null);
                          setProductListOpen(true);
                        }}
                        className="shrink-0 text-text-muted hover:text-text-primary"
                        aria-label={t('fleets.addSerial.changeProduct') || 'Change product'}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <PackageSearch size={14} className="text-text-muted" />
                        </div>
                        <input
                          type="text"
                          value={productSearch}
                          onFocus={() => setProductListOpen(true)}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setProductListOpen(true);
                          }}
                          placeholder={t('fleets.addSerial.searchProducts') || 'Search products...'}
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        />
                      </div>
                      {productListOpen && (
                        <div className="rounded-lg border border-border bg-bg-surface max-h-48 overflow-y-auto divide-y divide-border">
                          {productLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 size={16} className="animate-spin text-text-muted" />
                            </div>
                          ) : productOptions.length === 0 ? (
                            <p className="text-sm text-text-muted text-center py-3">
                              {t('fleets.addSerial.noProducts') || 'No products found'}
                            </p>
                          ) : (
                            productOptions.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setProduct(p);
                                  setProductListOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-bg-elevated transition-colors"
                              >
                                <span className="block truncate text-sm text-text-primary">{p.name}</span>
                                {p.default_code && (
                                  <span className="block text-xs text-text-muted font-mono">{p.default_code}</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm font-mono placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder={
                    addMode === 'existing'
                      ? (t('fleets.addSerial.serialPlaceholder') || 'Scan or type serial number')
                      : (t('fleets.addSerial.newSerialPlaceholder') || 'New serial number')
                  }
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (addMode === 'existing') handleAddExisting();
                    else handleRegisterAndAdd();
                  }}
                />
                <button
                  type="button"
                  disabled={adding}
                  onClick={addMode === 'existing' ? handleAddExisting : handleRegisterAndAdd}
                  style={{ backgroundColor: 'var(--color-brand)' }}
                  className="shrink-0 px-3 py-2 rounded-lg text-black text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {adding
                    ? (t('fleets.addSerial.adding') || 'Adding...')
                    : addMode === 'existing'
                      ? (t('fleets.addSerial.addToFleet') || 'Add to Fleet')
                      : (t('fleets.addSerial.registerAdd') || 'Register & Add')}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                {addMode === 'existing'
                  ? (t('fleets.addSerial.existingHint') ||
                      'Looks up a registered serial by its exact number and assigns it to this fleet.')
                  : (t('fleets.addSerial.registerHint') ||
                      'Registers a brand-new serial for the chosen product, then assigns it to this fleet.')}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
            {loadingItems ? (
              <div className="flex justify-center py-6">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-text-primary">
                  {t('fleets.detail.noSerials') || 'No serials in this fleet'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {t('fleets.detail.noSerialsHint') || "Add a serial to put it under this fleet's governance."}
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-mono truncate">
                      {item.lot?.serial || '--'}
                    </p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {item.lot?.product?.name || '--'}
                      <span className="mx-1">&middot;</span>
                      {(t('fleets.detail.since') || 'Since')} {formatDate(item.date_from)}
                    </p>
                  </div>
                  {fleet.state === 'active' && (
                    <button
                      onClick={() => setRemoveTarget(item)}
                      className="shrink-0 p-2 rounded-lg hover:bg-bg-elevated transition-colors"
                      style={{ color: 'var(--color-error)' }}
                      aria-label={t('fleets.removeSerial.label') || 'Remove from fleet'}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Governance actors (read-only) */}
        {actors !== null && (
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
              <Users size={12} />
              {t('fleets.detail.operators') || 'Operators'}
            </h3>
            <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
              {actors.length === 0 ? (
                <p className="text-sm text-text-muted px-4 py-3">
                  {t('fleets.detail.noActors') || 'No actors assigned to this fleet.'}
                </p>
              ) : (
                actors.map((actor) => (
                  <div key={actor.partnerId} className="flex items-center gap-2 px-4 py-3">
                    <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                      {actor.name}
                    </span>
                    {actor.isPrimary && (
                      <span className="list-card-badge list-card-badge--info">
                        {t('fleets.detail.primary') || 'Primary'}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Remove serial confirm */}
      <ConfirmDialog
        open={removeTarget !== null}
        title={(t('fleets.removeSerial.confirmTitle') || 'Remove serial {serial}?').replace(
          '{serial}',
          removeTarget?.lot?.serial ?? '',
        )}
        message={
          t('fleets.removeSerial.confirmBody') ||
          "The membership is ended (expired) and the serial leaves this fleet's governance. The serial itself is not deleted."
        }
        confirmLabel={t('fleets.removeSerial.confirm') || 'Yes, remove'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        danger
        busy={removing}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      {/* Deactivate fleet confirm */}
      <ConfirmDialog
        open={deactivateOpen}
        title={(t('fleets.deactivate.confirmTitle') || 'Deactivate {name}?').replace(
          '{name}',
          fleet.name || (t('fleets.deactivate.thisFleet') || 'this fleet'),
        )}
        message={
          t('fleets.deactivate.confirmBody') ||
          'The fleet becomes inactive and stops governing its serials. Serial memberships are kept and the fleet can be reactivated by an administrator.'
        }
        confirmLabel={t('fleets.deactivate.confirm') || 'Yes, deactivate'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        danger
        busy={deactivating}
        onCancel={() => setDeactivateOpen(false)}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-sm text-text-primary truncate mt-0.5 ${mono ? 'font-mono' : ''}`}>
        {value || '--'}
      </p>
    </div>
  );
}
