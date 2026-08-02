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

import React, { useCallback, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useI18n } from '@/i18n';
import { FlowTimeline, CHARGER_TIMELINE_STEPS } from '@/components/shared';
import type { EmployeeUser } from '@/lib/attendant-auth';
import StepIdentify, { type IdentifiedSub } from '../topup/components/StepIdentify';
import StepPlan, { type SelectedPlan } from '../topup/components/StepPlan';
import { DemoStepIdentify, DemoStepPlan } from './components/DemoSteps';
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
  const [demo, setDemo] = useState(false);
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

  const toggleDemo = useCallback(() => {
    // Switching modes mid-flow would mix demo and real state, so start over.
    setDemo((v) => !v);
    reset();
  }, [reset]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const currentStep = stepIndex + 1;

  /**
   * Once the rider has paid, the earlier steps are no longer navigable — going
   * back to identify or plan would orphan a real payment. Before payment,
   * everything reached so far stays reachable.
   */
  const maxStepReached = paid ? STEP_ORDER.indexOf('dispense') + 1 : currentStep;

  const onStepClick = useCallback(
    (target: number) => {
      const targetStep = STEP_ORDER[target - 1];
      if (!targetStep || targetStep === 'done') return;
      // Never step back past the payment once it has gone through.
      if (paid && (targetStep === 'identify' || targetStep === 'plan' || targetStep === 'pay')) return;
      setStep(targetStep);
    },
    [paid],
  );

  const demoBanner = useMemo(
    () =>
      demo ? (
        <div
          role="status"
          style={{
            display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px',
            marginBottom: 12, fontSize: 12, lineHeight: 1.45,
            background: 'var(--warning-soft, rgba(234,179,8,.12))',
            color: 'var(--text-primary)',
            border: '1px dashed var(--warning, #eab308)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <FlaskConical size={14} style={{ flexShrink: 0, color: 'var(--warning, #eab308)' }} />
          <span>{t('charger.demoBanner')}</span>
        </div>
      ) : null,
    [demo, t],
  );

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
        <button
          type="button"
          onClick={toggleDemo}
          aria-pressed={demo}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            border: demo ? '1px solid var(--warning, #eab308)' : '1px solid var(--border)',
            background: demo ? 'var(--warning-soft, rgba(234,179,8,.15))' : 'transparent',
            color: demo ? 'var(--warning, #eab308)' : 'var(--text-secondary)',
          }}
        >
          <FlaskConical size={12} />
          {demo ? t('charger.demoOn') : t('charger.demoOff')}
        </button>
      </div>

      {demoBanner}

      <FlowTimeline
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        totalSteps={STEP_ORDER.length}
        steps={CHARGER_TIMELINE_STEPS}
        onStepClick={onStepClick}
      />

      {step === 'identify' && (
        demo ? (
          <DemoStepIdentify onIdentified={(s) => { setSub(s); setStep('plan'); }} />
        ) : (
          <StepIdentify
            showRecent={false}
            title={t('charger.identifyTitle')}
            hint={t('charger.identifyHint')}
            onIdentified={(s) => { setSub(s); setStep('plan'); }}
          />
        )
      )}

      {step === 'plan' && sub && (
        demo ? (
          <DemoStepPlan
            sub={sub}
            onBack={() => setStep('identify')}
            onSelected={(p) => { setPlan(p); setStep('connect'); }}
          />
        ) : (
          <StepPlan
            sub={sub}
            title={t('charger.planTitle')}
            onBack={() => setStep('identify')}
            onSelected={(p) => { setPlan(p); setStep('connect'); }}
          />
        )
      )}

      {step === 'connect' && sub && plan && (
        <StepConnect
          demo={demo}
          onBack={() => setStep(paid ? 'dispense' : 'plan')}
          onConnected={(c) => { setCharger(c); setStep(paid ? 'dispense' : 'pay'); }}
        />
      )}

      {step === 'pay' && sub && plan && (
        <StepPay
          demo={demo}
          sub={sub}
          plan={plan}
          onBack={() => setStep('connect')}
          onPaid={(p) => { setPaid(p); setStep('dispense'); }}
        />
      )}

      {step === 'dispense' && sub && plan && charger && paid && (
        <StepDispense
          demo={demo}
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
