"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Search, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useCustomerIdentification, type ServiceState } from '@/lib/hooks/useCustomerIdentification';
import { getSubscriptionStatus } from '@/lib/odoo-api';
import { round } from '@/lib/utils';
import RecentTopups from './RecentTopups';

/** Everything later steps need about the validated subscription. */
export interface IdentifiedSub {
  subscriptionCode: string;
  /** Odoo product_name — drives the PRODUCT_SERVICE_MAP plan filter. Null if Odoo lookup failed. */
  packageName: string | null;
  /** Raw Odoo subscription status, lowercased ('active' | 'paused' | ...). Null if lookup failed. */
  odooStatus: string | null;
  energyServiceId: string;
  energyRemaining: number;
  energyTotal: number;
  currency: string;
}

interface StepIdentifyProps {
  onIdentified: (sub: IdentifiedSub) => void;
}

const INFINITE_QUOTA_THRESHOLD = 100000;

export default function StepIdentify({ onIdentified }: StepIdentifyProps) {
  const { t } = useI18n();
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
      const states: ServiceState[] = result.serviceStates;
      const energy = states.find(
        (s) => s.service_id?.includes('service-energy') || s.service_id?.includes('service-electricity'),
      );

      // Gate: this applet only credits energy.
      if (!energy) {
        setError(t('topup.noEnergyService') || 'This subscription has no energy service to top up.');
        setLoading(false);
        return;
      }
      // Gate: unlimited-energy plans have nothing to top up.
      if ((energy.quota || 0) > INFINITE_QUOTA_THRESHOLD) {
        setError(t('topup.infiniteQuota') || 'This subscription has unlimited energy — nothing to top up.');
        setLoading(false);
        return;
      }

      const code = result.customer.subscriptionId;

      // Odoo status/package lookup — degrades gracefully (package unknown →
      // plan filter falls back to the full list).
      let packageName: string | null = null;
      let odooStatus: string | null = null;
      try {
        const statusRes = await getSubscriptionStatus(code);
        const s = statusRes.data?.subscription;
        if (s) {
          packageName = s.product_name || null;
          odooStatus = (s.status || '').toLowerCase() || null;
        }
      } catch (err) {
        console.warn('[TOPUP] Odoo status lookup failed — proceeding without package filter:', err);
      }

      // Gate: cancelled subs are blocked outright.
      if (odooStatus && /cancel|closed|terminated/.test(odooStatus)) {
        setError(
          (t('topup.subCancelled') || 'This subscription is {status} — top-up is not allowed.')
            .replace('{status}', odooStatus),
        );
        setLoading(false);
        return;
      }
      // Paused → allowed, but staff must see it.
      if (odooStatus && /pause|hold|suspend/.test(odooStatus)) {
        setWarning(
          (t('topup.subPaused') || 'This subscription is {status}. Top-up is allowed, but check with the customer.')
            .replace('{status}', odooStatus),
        );
      }

      setCandidate({
        subscriptionCode: code,
        packageName,
        odooStatus,
        energyServiceId: energy.service_id,
        energyRemaining: round((energy.quota || 0) - (energy.used || 0), 2),
        energyTotal: energy.quota || 0,
        currency: result.currencySymbol,
      });
      setLoading(false);
    },
  });

  useEffect(() => () => cancelIdentification(), [cancelIdentification]);

  const handleValidate = useCallback(() => {
    const code = subInput.trim();
    if (!code) return;
    setError(null);
    setWarning(null);
    setCandidate(null);
    setLoading(true);
    identifyCustomer({ subscriptionCode: code, source: 'manual' });
  }, [subInput, identifyCustomer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.identifyTitle') || 'Find subscription'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('topup.identifyHint') || 'Enter the customer’s subscription ID to begin.'}
        </p>
      </div>

      <div>
        <label className="form-label">{t('topup.subscriptionId') || 'Subscription ID'}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input manual-id-input"
            placeholder={t('topup.subscriptionIdPlaceholder') || 'e.g. SUB12345'}
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleValidate(); }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={!subInput.trim() || loading}
            aria-label={t('topup.validate') || 'Validate'}
            style={{ paddingInline: 16 }}
          >
            {loading
              ? (t('common.loading') || 'Loading...')
              : <Search size={16} />}
          </button>
        </div>
      </div>

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
              {(t('topup.energyBalance') || 'Energy: {remaining} of {total} kWh left')
                .replace('{remaining}', candidate.energyRemaining.toLocaleString())
                .replace('{total}', candidate.energyTotal.toLocaleString())}
            </span>
          </div>

          {warning && (
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--warning, #eab308)' }}>
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
