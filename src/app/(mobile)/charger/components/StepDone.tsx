"use client";

/**
 * Step 5 — receipt.
 *
 * Renders two visually distinct outcomes. A charge that was billed but never
 * acknowledged by the charger is NOT shown as a success: the operator needs to
 * see immediately that the customer has been charged and has nothing to show
 * for it, along with the reference to quote when it is sorted out.
 */

import React from 'react';
import { AlertTriangle, BatteryCharging, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ChargeReceipt } from './StepDispense';

interface StepDoneProps {
  receipt: ChargeReceipt;
  onRestart: () => void;
}

export default function StepDone({ receipt, onRestart }: StepDoneProps) {
  const { t } = useI18n();
  const ok = receipt.dispensed;

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
        {ok ? (
          <CheckCircle2 size={44} style={{ color: 'var(--accent, #22c55e)', margin: '0 auto' }} />
        ) : (
          <AlertTriangle size={44} style={{ color: 'var(--warning, #eab308)', margin: '0 auto' }} />
        )}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 0' }}>
          {ok ? t('charger.doneTitle') : t('charger.doneTitleUndelivered')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {ok
            ? receipt.mode === 'time'
              ? t('charger.doneHintTime', { n: receipt.value.toLocaleString() })
              : t('charger.doneHintEnergy', { n: receipt.value.toLocaleString() })
            : t('charger.doneHintUndelivered')}
        </p>
      </div>

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {receipt.customerName && row(t('charger.customer'), receipt.customerName)}
        {row(t('charger.subscriptionId'), receipt.subscriptionCode)}
        {row(t('charger.plan'), receipt.planName)}
        {row(
          t('charger.planValue'),
          `${receipt.currency ? `${receipt.currency} ` : ''}${receipt.price.toLocaleString()}`,
        )}
        {row(
          t('charger.energyBilled'),
          <span style={{ color: 'var(--accent)' }}>{`${receipt.kwhBilled.toLocaleString()} kWh`}</span>,
        )}
        {row(
          t('charger.balanceChange'),
          `${receipt.quotaBefore.toLocaleString()} → ${receipt.quotaAfter.toLocaleString()} kWh`,
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {row(t('charger.chargerLabel'), `${receipt.chargerName} · ${receipt.chargerMac}`)}
          {row(
            t('charger.dispensed'),
            ok ? (
              <span style={{ color: 'var(--accent, #22c55e)' }}>
                {receipt.value.toLocaleString()} {receipt.mode === 'time' ? t('charger.min') : 'kWh'}
              </span>
            ) : (
              <span style={{ color: 'var(--warning, #eab308)' }}>{t('charger.notDispensed')}</span>
            ),
          )}
          {row(t('charger.characteristic'), <code>{receipt.characteristicName}</code>)}
          {row(t('charger.reference'), <code style={{ fontSize: 11 }}>{receipt.reference}</code>)}
        </div>
      </div>

      {receipt.wasRetry && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {t('charger.idempotentNote')}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={onRestart}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <BatteryCharging size={16} />
        {t('charger.startAnother')}
      </button>
    </div>
  );
}
