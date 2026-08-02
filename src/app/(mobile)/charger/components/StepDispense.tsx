"use client";

/**
 * Step 5 — tell the charger to dispense what the rider already paid for.
 *
 * This step moves no money. By the time it renders, the rider's mobile-money
 * payment has been verified by Odoo and credited to ABS, so every failure here
 * is "paid but not delivered" — recoverable by re-sending the BLE write (or
 * reconnecting first), never by charging again.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BatteryCharging, Clock, Loader2, Zap } from 'lucide-react';

import { useI18n } from '@/i18n';
import { writeBleCharacteristic } from '@/app/utils';
import type { IdentifiedSub } from '../../topup/components/StepIdentify';
import type { SelectedPlan } from '../../topup/components/StepPlan';
import {
  appendRecentCharge,
  assessWriteResponse,
  deriveWriteValue,
  matchCharacteristic,
  type ChargeMode,
} from '../lib/charger-core';
import type { ConnectedCharger, GattCharacteristic, PaidCharge } from '../lib/types';

export interface ChargeReceipt {
  receipt: string;
  paymentMethod: string;
  mode: ChargeMode;
  /** Value written to the charger (kWh in energy mode, minutes in time mode). */
  value: number;
  kwhCredited: number;
  totalPaid: number;
  quotaBefore: number;
  quotaAfter: number;
  subscriptionCode: string;
  customerName: string | null;
  planName: string;
  currency: string;
  chargerName: string;
  chargerMac: string;
  characteristicName: string;
  /** False when the rider paid but the charger never acknowledged the write. */
  dispensed: boolean;
  wasRetry?: boolean;
}

interface StepDispenseProps {
  sub: IdentifiedSub;
  plan: SelectedPlan;
  charger: ConnectedCharger;
  paid: PaidCharge;
  onReconnect: () => void;
  onDone: (receipt: ChargeReceipt) => void;
}

export default function StepDispense({
  sub, plan, charger, paid, onReconnect, onDone,
}: StepDispenseProps) {
  const { t } = useI18n();

  const [mode, setMode] = useState<ChargeMode>('energy');
  const [minutes, setMinutes] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charOverride, setCharOverride] = useState<Partial<Record<ChargeMode, string>>>({});

  // Memoised so the `?? []` fallback doesn't produce a new array identity on
  // every render and invalidate the memos below.
  const characteristics: GattCharacteristic[] = useMemo(
    () => charger.controlService.characteristicList ?? [],
    [charger.controlService.characteristicList],
  );
  const match = useMemo(() => matchCharacteristic(characteristics, mode), [characteristics, mode]);

  const activeCharacteristic: GattCharacteristic | undefined = useMemo(() => {
    const overrideUuid = charOverride[mode];
    if (overrideUuid) {
      const c = characteristics.find((ch) => ch.uuid === overrideUuid);
      if (c) return c;
    }
    // Only a single unambiguous hit is auto-selected. When several
    // characteristics match the (provisional) name heuristics we deliberately
    // select nothing and make the operator choose — see charger-core.
    return match.confident;
  }, [charOverride, mode, characteristics, match.confident]);

  useEffect(() => { setError(null); }, [mode]);

  const writeValue = (() => {
    try {
      return deriveWriteValue({ mode, declaredKwh: plan.declaredKwh, minutes: Number(minutes) });
    } catch {
      return null;
    }
  })();

  const handleSend = useCallback(() => {
    if (sending) return;
    setError(null);

    let value: number;
    try {
      value = deriveWriteValue({ mode, declaredKwh: plan.declaredKwh, minutes: Number(minutes) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('charger.invalidAmount'));
      return;
    }
    const characteristic = activeCharacteristic;
    if (!characteristic) {
      setError(t('charger.pickCharacteristic'));
      return;
    }

    setSending(true);
    writeBleCharacteristic(
      charger.controlService.uuid,
      characteristic.uuid,
      value,
      charger.macAddress,
      (responseData: unknown) => {
        setSending(false);
        const assessment = assessWriteResponse(responseData);
        appendRecentCharge({
          subscriptionCode: sub.subscriptionCode,
          planName: plan.name,
          mode,
          value,
          kwhBilled: plan.declaredKwh,
          chargerMac: charger.macAddress,
          reference: paid.receipt,
          dispensed: assessment.ok,
          timestamp: new Date().toISOString(),
        });
        if (!assessment.ok) {
          setFailed(true);
          setError(assessment.error || t('charger.writeFailed'));
          return;
        }
        onDone({
          receipt: paid.receipt,
          paymentMethod: paid.paymentMethod,
          mode,
          value,
          kwhCredited: plan.declaredKwh,
          totalPaid: paid.totalPaid,
          quotaBefore: paid.quotaBefore,
          quotaAfter: paid.quotaAfter,
          subscriptionCode: sub.subscriptionCode,
          customerName: sub.customerName,
          planName: plan.name,
          currency: sub.currency,
          chargerName: charger.name,
          chargerMac: charger.macAddress,
          characteristicName: characteristic.name,
          dispensed: true,
          wasRetry: paid.wasRetry,
        });
      },
    );
  }, [sending, mode, minutes, plan, activeCharacteristic, charger, sub, paid, onDone, t]);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.dispenseTitle')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('charger.dispenseHint')}
        </p>
      </div>

      {/* Paid banner — the rider's money is already in, make that unmissable. */}
      <div
        style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, fontSize: 13,
          background: 'var(--accent-soft, rgba(34,197,94,.1))',
          border: '1px solid var(--accent, #22c55e)', borderRadius: 'var(--radius-md)',
        }}
      >
        <Zap size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
        <span>
          {t('charger.paidBanner', {
            amount: `${sub.currency ? `${sub.currency} ` : ''}${paid.totalPaid.toLocaleString()}`,
            kwh: plan.declaredKwh.toLocaleString(),
          })}
        </span>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {([
          { id: 'energy' as ChargeMode, icon: <Zap size={18} />, label: t('charger.byEnergy'), unit: 'kWh' },
          { id: 'time' as ChargeMode, icon: <Clock size={18} />, label: t('charger.byTime'), unit: t('charger.minutes') },
        ]).map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={sending}
              onClick={() => setMode(m.id)}
              style={{
                padding: '14px 12px', borderRadius: 12,
                border: active ? '1.5px solid #22c55e' : '1px solid var(--border-primary, #333)',
                background: active ? 'rgba(34,197,94,0.1)' : 'var(--bg-secondary, rgba(255,255,255,0.03))',
                color: active ? '#22c55e' : 'var(--text-primary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: sending ? 0.6 : 1,
              }}
            >
              {m.icon}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{m.unit}</span>
            </button>
          );
        })}
      </div>

      {mode === 'time' && (
        <div>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            {t('charger.chargingTime')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={minutes}
            disabled={sending}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="10"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 18, fontWeight: 600,
              borderRadius: 12, border: '1px solid var(--border-primary, #333)',
              background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[10, 30, 60].map((p) => (
              <button
                key={p}
                type="button"
                disabled={sending}
                onClick={() => setMinutes(String(p))}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--border-primary, #333)',
                  background: minutes === String(p)
                    ? 'rgba(34,197,94,0.15)' : 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  color: minutes === String(p) ? '#22c55e' : 'var(--text-primary)',
                }}
              >
                {p} {t('charger.min')}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--warning, #eab308)', margin: '10px 0 0', lineHeight: 1.5 }}>
            <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t('charger.timeModeWarning')}
          </p>
        </div>
      )}

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {sub.customerName && row(t('charger.customer'), sub.customerName)}
        {row(t('charger.plan'), plan.name)}
        {row(t('charger.chargerLabel'), `${charger.name} · ${charger.macAddress}`)}
        {row(
          t('charger.willWrite'),
          writeValue != null
            ? `${writeValue.toLocaleString()} ${mode === 'time' ? t('charger.min') : 'kWh'}`
            : '—',
        )}
      </div>

      {/* Target characteristic — explicit when the heuristics are ambiguous. */}
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('charger.targetCharacteristic')}{' '}
          {activeCharacteristic && !charOverride[mode] && !match.ambiguous && (
            <span style={{ color: '#22c55e' }}>({t('charger.autoMatched')})</span>
          )}
        </label>
        <select
          value={activeCharacteristic?.uuid ?? ''}
          disabled={sending}
          onChange={(e) => setCharOverride((prev) => ({ ...prev, [mode]: e.target.value }))}
          style={{
            width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10,
            border: match.ambiguous && !charOverride[mode]
              ? '1px solid var(--warning, #eab308)'
              : '1px solid var(--border-primary, #333)',
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            color: 'var(--text-primary)',
          }}
        >
          <option value="" disabled>
            {characteristics.length === 0
              ? t('charger.noCharacteristics')
              : t('charger.selectCharacteristic')}
          </option>
          {characteristics.map((c) => (
            <option key={c.uuid} value={c.uuid}>{c.name}</option>
          ))}
        </select>
        {match.ambiguous && !charOverride[mode] && (
          <p style={{ fontSize: 12, color: 'var(--warning, #eab308)', margin: '8px 0 0', lineHeight: 1.5 }}>
            <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t('charger.ambiguousMatch', { names: match.matches.map((m) => m.name).join(', ') })}
          </p>
        )}
        {!activeCharacteristic && !match.ambiguous && characteristics.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--warning, #eab308)', margin: '8px 0 0', lineHeight: 1.5 }}>
            <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t('charger.noMatch')}
          </p>
        )}
      </div>

      {failed && (
        <div
          role="alert"
          style={{
            display: 'flex', flexDirection: 'column', gap: 6, padding: 12, fontSize: 13,
            background: 'var(--warning-soft, rgba(234,179,8,.12))', color: 'var(--text-primary)',
            border: '1px solid var(--warning, #eab308)', borderRadius: 'var(--radius-md)',
          }}
        >
          <strong style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={14} />
            {t('charger.paidNotDispensed')}
          </strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {t('charger.paidNotDispensedHint')}
          </span>
          {error && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{error}</span>}
        </div>
      )}

      {error && !failed && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={sending || writeValue == null || !activeCharacteristic}
          aria-busy={sending}
          style={{
            width: '100%', padding: '16px 0', fontSize: 16, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {sending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('charger.sending')}
            </>
          ) : (
            <>
              <BatteryCharging size={18} />
              {failed ? t('charger.retryDispense') : t('charger.startCharging')}
            </>
          )}
        </button>
        {/* A BLE session can drop while the rider is paying, so reconnecting is
            a first-class recovery — the payment is preserved across it. */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReconnect}
          disabled={sending}
          style={{ width: '100%' }}
        >
          {t('charger.reconnectCharger')}
        </button>
      </div>
    </div>
  );
}
