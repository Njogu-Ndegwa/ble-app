"use client";

/**
 * Charger Control flow.
 *
 * identify → plan → connect → pay → dispense → done
 *
 * The first two steps are the staff Top-Up applet's own components, reused
 * rather than reimplemented: Esther specified that charger output is billed
 * "like a swap — it needs billing and a specified subscription plan", so the
 * customer lookup, the package→plan narrowing and the ABS quota lookup must
 * behave identically to the top-up path, not merely similarly.
 *
 * Connecting comes BEFORE paying so the charger is known to be reachable
 * before the rider spends money. Paying comes before dispensing so energy is
 * never given away. If the BLE session drops during the payment wait, the
 * dispense step can reconnect without disturbing the completed payment —
 * which is why `paid` lives here rather than inside a step.
 */

import React, { useCallback, useState } from 'react';
import { useI18n } from '@/i18n';
import type { EmployeeUser } from '@/lib/attendant-auth';
import StepIdentify, { type IdentifiedSub } from '../topup/components/StepIdentify';
import StepPlan, { type SelectedPlan } from '../topup/components/StepPlan';
import StepConnect from './components/StepConnect';
import StepPay from './components/StepPay';
import StepDispense, { type ChargeReceipt } from './components/StepDispense';
import StepDone from './components/StepDone';
import type { ConnectedCharger, PaidCharge } from './lib/types';

export type ChargerStep = 'identify' | 'plan' | 'connect' | 'pay' | 'dispense' | 'done';

const STEP_ORDER: ChargerStep[] = ['identify', 'plan', 'connect', 'pay', 'dispense', 'done'];

interface ChargerFlowProps {
  // Kept for parity with the other applets' flows; the rider pays for
  // themselves here, so no employee id ends up on the money path.
  employee: EmployeeUser;
}

export default function ChargerFlow({ employee: _employee }: ChargerFlowProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<ChargerStep>('identify');
  const [sub, setSub] = useState<IdentifiedSub | null>(null);
  const [plan, setPlan] = useState<SelectedPlan | null>(null);
  const [charger, setCharger] = useState<ConnectedCharger | null>(null);
  const [paid, setPaid] = useState<PaidCharge | null>(null);
  const [receipt, setReceipt] = useState<ChargeReceipt | null>(null);

  const reset = useCallback(() => {
    setSub(null);
    setPlan(null);
    setCharger(null);
    setPaid(null);
    setReceipt(null);
    setStep('identify');
  }, []);

  /** Re-run the connect step, keeping a completed payment intact. */
  const reconnect = useCallback(() => {
    setCharger(null);
    setStep('connect');
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.title')}
        </h1>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '2px 8px',
            borderRadius: 999, background: 'rgba(234,179,8,0.15)', color: '#eab308',
            border: '1px solid rgba(234,179,8,0.4)',
          }}
        >
          MVP
        </span>
      </div>

      {/* Stepper dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            aria-hidden="true"
            style={{
              width: i === stepIndex ? 20 : 8,
              height: 8,
              borderRadius: 4,
              transition: 'all .2s',
              background: i <= stepIndex ? 'var(--accent)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {step === 'identify' && (
        <StepIdentify
          showRecent={false}
          title={t('charger.identifyTitle')}
          hint={t('charger.identifyHint')}
          onIdentified={(s) => { setSub(s); setStep('plan'); }}
        />
      )}

      {step === 'plan' && sub && (
        <StepPlan
          sub={sub}
          title={t('charger.planTitle')}
          onBack={() => setStep('identify')}
          onSelected={(p) => { setPlan(p); setStep('connect'); }}
        />
      )}

      {step === 'connect' && sub && plan && (
        <StepConnect
          onBack={() => setStep(paid ? 'dispense' : 'plan')}
          onConnected={(c) => { setCharger(c); setStep(paid ? 'dispense' : 'pay'); }}
        />
      )}

      {step === 'pay' && sub && plan && (
        <StepPay
          sub={sub}
          plan={plan}
          onBack={() => setStep('connect')}
          onPaid={(p) => { setPaid(p); setStep('dispense'); }}
        />
      )}

      {step === 'dispense' && sub && plan && charger && paid && (
        <StepDispense
          sub={sub}
          plan={plan}
          charger={charger}
          paid={paid}
          onReconnect={reconnect}
          onDone={(r) => { setReceipt(r); setStep('done'); }}
        />
      )}

      {step === 'done' && receipt && <StepDone receipt={receipt} onRestart={reset} />}
    </div>
  );
}
