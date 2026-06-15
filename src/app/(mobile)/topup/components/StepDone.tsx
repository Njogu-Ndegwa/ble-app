"use client";

import React from 'react';
import { Zap, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { TopupReceipt } from './StepConfirm';

interface StepDoneProps {
  receipt: TopupReceipt;
  onRestart: () => void;
}

export default function StepDone({ receipt, onRestart }: StepDoneProps) {
  const { t } = useI18n();

  // Summary rows focus on what changed for the customer — the energy credited
  // and, most importantly, the new balance — rather than an opaque reference id.
  const row = (label: string, value: React.ReactNode, emphasize = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          color: emphasize ? 'var(--accent)' : 'var(--text-primary)',
          fontWeight: emphasize ? 700 : 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );

  const balanceValue = receipt.wasRetry
    ? `${receipt.quotaAfter.toLocaleString()} kWh`
    : `${receipt.quotaBefore.toLocaleString()} → ${receipt.quotaAfter.toLocaleString()} kWh`;

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}
        >
          <Zap size={32} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
          {`+${receipt.kwhCredited.toLocaleString()} kWh`}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          {receipt.wasRetry
            ? (t('topup.doneDescRetry', { sub: receipt.subscriptionCode })
                || `Credit applied to ${receipt.subscriptionCode}.`)
            : (t('topup.doneDesc', {
                sub: receipt.subscriptionCode,
                after: receipt.quotaAfter.toLocaleString(),
                before: receipt.quotaBefore.toLocaleString(),
              }) || `${receipt.subscriptionCode} now has ${receipt.quotaAfter.toLocaleString()} kWh (was ${receipt.quotaBefore.toLocaleString()}).`)}
        </p>
      </div>

      {receipt.wasRetry && (
        <div
          role="status"
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: 12, fontSize: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--accent-soft)', color: 'var(--text-primary)',
            border: '1px solid var(--accent)',
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {t('topup.alreadyCredited') || 'This credit had already been applied — the retry was detected and no double charge occurred.'}
          </span>
        </div>
      )}

      {/* What changed — the values staff (and the customer) care about. */}
      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {receipt.customerName && row(t('topup.customer') || 'Customer', receipt.customerName)}
        {receipt.vehicleId && row(t('topup.bike') || 'Bike', receipt.vehicleId)}
        {row(t('topup.subscriptionId') || 'Subscription ID', receipt.subscriptionCode)}
        {receipt.planName && row(t('topup.plan') || 'Plan', receipt.planName)}
        {row(
          t('topup.energyCredit') || 'Energy credit',
          <span style={{ color: 'var(--accent)' }}>{`+${receipt.kwhCredited.toLocaleString()} kWh`}</span>,
        )}
        {receipt.price > 0 && row(
          t('topup.planValue') || 'Plan value',
          `${receipt.currency ? `${receipt.currency} ` : ''}${receipt.price.toLocaleString()}`,
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {row(t('topup.balanceChange') || 'Balance after top-up', balanceValue, true)}
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={onRestart} style={{ width: '100%' }}>
        {t('topup.topUpAnother') || 'Top up another'}
      </button>
    </div>
  );
}
