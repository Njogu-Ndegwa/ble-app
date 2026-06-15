"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Zap, CheckCircle2, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ScannerArea } from '@/components/shared';
import { useCustomerIdentification, type ServiceState } from '@/lib/hooks/useCustomerIdentification';
import { useQrScan } from '@/lib/hooks/useQrScan';
import type { ParsedCustomerQr } from '@/lib/qr/parseCustomerQr';
import { getSubscriptionStatus, getCustomerDashboard } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { extractVehicleId, parsePartnerId } from '../lib/topup-core';
import RecentTopups from './RecentTopups';

/** Everything later steps need about the validated subscription. */
export interface IdentifiedSub {
  subscriptionCode: string;
  /** Human-readable package/plan name for display (Odoo product_name). Null if the status lookup failed. */
  packageName: string | null;
  /**
   * Ordered candidates used to narrow the plan list to the customer's package
   * (same multi-candidate approach as the rider): [service-plan template id,
   * product name]. The template id (B30-/B45-/B100-…) comes from identify and is
   * present even when the Odoo status lookup fails, so the picker stays filtered.
   * See filterPlansByPackage.
   */
  packageFilter: string[];
  /** Raw Odoo subscription status, lowercased ('active' | 'paused' | ...). Null if lookup failed. */
  odooStatus: string | null;
  energyServiceId: string;
  energyRemaining: number;
  energyTotal: number;
  currency: string;
  /** Real customer name (Odoo dashboard, falling back to a QR-supplied name). Null if unknown. */
  customerName: string | null;
  /** Assigned vehicle ("bike") code from the asset-assignment service. Null if none assigned. */
  vehicleId: string | null;
}

interface StepIdentifyProps {
  onIdentified: (sub: IdentifiedSub) => void;
}

type InputMode = 'scan' | 'manual';

export default function StepIdentify({ onIdentified }: StepIdentifyProps) {
  const { t } = useI18n();
  const [inputMode, setInputMode] = useState<InputMode>('scan');
  const [subInput, setSubInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<IdentifiedSub | null>(null);

  const { identifyCustomer, cancelIdentification } = useCustomerIdentification({
    attendantInfo: { id: 'topup-applet', station: 'topup-applet' },
    silent: true,
    onError: (msg) => { setError(msg); setLoading(false); },
    onSuccess: async (result) => {
      try {
        const states: ServiceState[] = result.serviceStates;
        const energy = states.find(
          (s) => s.service_id?.includes('service-energy') || s.service_id?.includes('service-electricity'),
        );

        // Gate: this applet only credits energy.
        if (!energy) {
          setError(t('topup.noEnergyService') || 'This subscription has no energy service to top up.');
          return;
        }
        // Gate: unlimited-energy plans have nothing to top up.
        if (result.customer.hasInfiniteEnergyQuota) {
          setError(t('topup.infiniteQuota') || 'This subscription has unlimited energy — nothing to top up.');
          return;
        }

        const code = result.customer.subscriptionId;

        // Status/package lookup and customer-details enrichment run in parallel
        // so the echo-back card isn't slowed by a second sequential Odoo
        // round-trip. Both degrade gracefully: an unknown package falls back to
        // the full plan list, and a missing name/vehicle simply hides that row.
        const partnerId = parsePartnerId(result.customer.id);
        const token = getSalesRoleToken();
        const [statusOutcome, dashboardOutcome] = await Promise.allSettled([
          getSubscriptionStatus(code),
          partnerId ? getCustomerDashboard(partnerId, token ?? undefined) : Promise.resolve(null),
        ]);

        let packageName: string | null = null;
        let odooStatus: string | null = null;
        if (statusOutcome.status === 'fulfilled') {
          const s = statusOutcome.value.data?.subscription;
          if (s) {
            packageName = s.product_name || null;
            odooStatus = (s.status || '').toLowerCase() || null;
          } else {
            setWarning(
              t('topup.statusUnverified')
                || 'Subscription status could not be verified — confirm with the customer before continuing.',
            );
          }
        } else {
          console.warn('[TOPUP] Odoo status lookup failed — proceeding without package filter:', statusOutcome.reason);
          setWarning(
            t('topup.statusUnverified')
              || 'Subscription status could not be verified — confirm with the customer before continuing.',
          );
        }

        // Real customer name from Odoo (works for both scan and manual entry).
        // Fall back to a name carried in the QR payload, then to nothing — the
        // row is hidden rather than showing the 'Customer' placeholder.
        const qrName = result.customer.name && result.customer.name !== 'Customer'
          ? result.customer.name
          : null;
        let customerName: string | null = qrName;
        if (dashboardOutcome.status === 'fulfilled' && dashboardOutcome.value?.success) {
          customerName = dashboardOutcome.value.customer?.name?.trim() || customerName;
        } else if (dashboardOutcome.status === 'rejected') {
          console.warn('[TOPUP] Customer dashboard lookup failed — name may be unavailable:', dashboardOutcome.reason);
        }

        // Assigned vehicle ("bike") — same asset-assignment convention as the rider.
        const vehicleId = extractVehicleId(result.serviceStates);

        // Gate: cancelled subs are blocked outright.
        if (odooStatus && /cancel|closed|terminated/.test(odooStatus)) {
          setError(
            t('topup.subCancelled', { status: odooStatus })
              || `This subscription is ${odooStatus} — top-up is not allowed.`,
          );
          return;
        }
        // Paused → allowed, but staff must see it.
        if (odooStatus && /pause|hold|suspend/.test(odooStatus)) {
          setWarning(
            t('topup.subPaused', { status: odooStatus })
              || `This subscription is ${odooStatus}. Top-up is allowed, but check with the customer.`,
          );
        }

        // Plan-filter candidates, same as the rider: the service-plan template
        // id (from identify — present even if the status lookup above failed,
        // and the value the map matches on) plus the Odoo product name.
        const packageFilter = [result.customer.subscriptionType, packageName].filter(
          (c): c is string => !!c,
        );

        setCandidate({
          subscriptionCode: code,
          packageName,
          packageFilter,
          odooStatus,
          energyServiceId: energy.service_id,
          energyRemaining: result.customer.energyRemaining ?? 0,
          energyTotal: result.customer.energyTotal ?? 0,
          currency: result.currencySymbol,
          customerName,
          vehicleId,
        });
      } catch (err) {
        console.error('[TOPUP] identify post-processing failed:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => () => cancelIdentification(), [cancelIdentification]);

  // Single identify kickoff shared by the scan and manual paths. Both feed the
  // same useCustomerIdentification hook the swap workflow uses — only `source`
  // (and any QR-supplied name/phone) differs.
  const runIdentify = useCallback(
    (
      code: string,
      source: 'qr' | 'manual',
      extra?: { name?: string; phone?: string; customerId?: string },
    ) => {
      if (loading) return;
      const trimmed = code.trim();
      if (!trimmed) return;
      setError(null);
      setWarning(null);
      setCandidate(null);
      setLoading(true);
      identifyCustomer({ subscriptionCode: trimmed, source, ...extra });
    },
    [loading, identifyCustomer],
  );

  const handleValidate = useCallback(() => {
    runIdentify(subInput, 'manual');
  }, [runIdentify, subInput]);

  const handleScanned = useCallback(
    (data: ParsedCustomerQr) => {
      // Reflect the scanned code in the manual field so the user can see / edit
      // it, then identify straight away.
      setSubInput(data.subscriptionCode);
      runIdentify(data.subscriptionCode, 'qr', {
        name: data.name,
        phone: data.phone,
        customerId: data.customerId,
      });
    },
    [runIdentify],
  );

  const { startScan, isScannerOpening, scannerAvailable } = useQrScan({
    onScanned: handleScanned,
    onUnreadable: () =>
      setError(
        t('topup.qrUnreadable')
          || 'Couldn’t read that QR code. Try again or enter the ID manually.',
      ),
    onUnavailable: () => {
      setInputMode('manual');
      setError(
        t('topup.scannerUnavailable')
          || 'Scanner needs the mobile app — enter the subscription ID manually below.',
      );
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.identifyTitle') || 'Find subscription'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('topup.identifyHint') || 'Scan or enter the customer’s subscription ID to begin.'}
        </p>
      </div>

      {/* Scan / Manual toggle — mirrors the swap (attendant) identify screen. */}
      <div className="input-toggle">
        <button
          type="button"
          className={`toggle-btn ${inputMode === 'scan' ? 'active' : ''}`}
          onClick={() => setInputMode('scan')}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          {t('topup.scanTab') || 'Scan QR'}
        </button>
        <button
          type="button"
          className={`toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
          onClick={() => setInputMode('manual')}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t('topup.manualTab') || 'Enter ID'}
        </button>
      </div>

      {inputMode === 'scan' ? (
        <div className="customer-input-mode">
          <p className="scan-subtitle">
            {t('topup.scanInstruction') || 'Scan the customer’s subscription QR code'}
          </p>
          <ScannerArea onClick={startScan} type="qr" disabled={isScannerOpening || loading} />
          {scannerAvailable ? (
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              {t('topup.scanShowQr') || 'Ask the customer to show their subscription QR'}
            </p>
          ) : (
            <p className="scan-hint">
              <Info size={14} />
              {t('topup.scannerNeedsApp')
                || 'Scanning needs the mobile app. Use Enter ID to type the subscription ID.'}
            </p>
          )}
        </div>
      ) : (
        // Literally mirrors the swap (attendant) Step1CustomerScan manual entry:
        // same markup, classes, icons, and copy (reuses the attendant.* strings
        // so the wording and translations stay identical across the two screens).
        <div className="customer-input-mode">
          <p className="scan-subtitle">{t('attendant.enterSubIdManually') || 'Enter Subscription ID manually'}</p>
          <div className="manual-entry-form">
            <div className="form-group">
              <label className="form-label">{t('attendant.subscriptionId') || 'Subscription ID'}</label>
              <input
                type="text"
                className="form-input manual-id-input"
                placeholder="e.g. SUB-8847-KE"
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleValidate(); }}
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={handleValidate}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              {loading ? (t('attendant.lookingUp') || 'Looking up...') : (t('attendant.lookUpCustomer') || 'Look Up Customer')}
            </button>
          </div>
          <p className="scan-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {t('attendant.findIdOnReceipt') || "Find ID on customer's account or receipt"}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Echo-back card — staff verifies this is the right customer before continuing */}
      {candidate && (
        <div
          style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {candidate.subscriptionCode}
            </span>
            {candidate.odooStatus && (
              <span
                style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px',
                  borderRadius: 999,
                  background: /pause|hold|suspend/.test(candidate.odooStatus)
                    ? 'var(--warning-soft, rgba(234,179,8,.15))' : 'var(--accent-soft)',
                  color: /pause|hold|suspend/.test(candidate.odooStatus)
                    ? 'var(--warning, #eab308)' : 'var(--accent)',
                }}
              >
                {candidate.odooStatus}
              </span>
            )}
          </div>

          {candidate.packageName && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {(t('topup.package') || 'Package')}: {candidate.packageName}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span>
              {t('topup.energyBalance', {
                remaining: candidate.energyRemaining.toLocaleString(),
                total: candidate.energyTotal.toLocaleString(),
              }) || `Energy: ${candidate.energyRemaining.toLocaleString()} of ${candidate.energyTotal.toLocaleString()} kWh left`}
            </span>
          </div>

          {warning && (
            <div role="status" style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--warning, #eab308)' }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{warning}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onIdentified(candidate)}
            style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <CheckCircle2 size={16} />
            {t('topup.confirmCustomer') || 'This is the right subscription'}
          </button>
        </div>
      )}

      <RecentTopups />
    </div>
  );
}
