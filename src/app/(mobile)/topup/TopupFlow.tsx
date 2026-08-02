"use client";

import React, { useCallback, useState } from 'react';
import { useI18n } from '@/i18n';
import { FlowTimeline, TOPUP_TIMELINE_STEPS } from '@/components/shared';
import type { EmployeeUser } from '@/lib/attendant-auth';
import StepIdentify, { type IdentifiedSub } from './components/StepIdentify';
import StepPlan, { type SelectedPlan } from './components/StepPlan';
import StepConfirm, { type TopupReceipt } from './components/StepConfirm';
import StepDone from './components/StepDone';

export type TopupStep = 'identify' | 'plan' | 'confirm' | 'done';

interface TopupFlowProps {
  employee: EmployeeUser;
}

const STEP_ORDER: TopupStep[] = ['identify', 'plan', 'confirm', 'done'];

export default function TopupFlow({ employee }: TopupFlowProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<TopupStep>('identify');
  const [sub, setSub] = useState<IdentifiedSub | null>(null);
  const [plan, setPlan] = useState<SelectedPlan | null>(null);
  const [receipt, setReceipt] = useState<TopupReceipt | null>(null);

  const reset = useCallback(() => {
    setSub(null);
    setPlan(null);
    setReceipt(null);
    setStep('identify');
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Same timeline component the swap / manual-swap / activator flows use,
          so every stepped applet reads identically. */}
      <FlowTimeline
        currentStep={stepIndex + 1}
        maxStepReached={stepIndex + 1}
        totalSteps={STEP_ORDER.length}
        steps={TOPUP_TIMELINE_STEPS}
        onStepClick={(target) => {
          const targetStep = STEP_ORDER[target - 1];
          // The credit is irreversible, so 'done' never navigates backwards.
          if (targetStep && targetStep !== 'done' && step !== 'done') setStep(targetStep);
        }}
      />

      {step === 'identify' && (
        <StepIdentify
          onIdentified={(s) => { setSub(s); setStep('plan'); }}
        />
      )}

      {step === 'plan' && sub && (
        <StepPlan
          sub={sub}
          onBack={() => setStep('identify')}
          onSelected={(p: SelectedPlan) => { setPlan(p); setStep('confirm'); }}
        />
      )}

      {step === 'confirm' && sub && plan && (
        <StepConfirm
          employee={employee}
          sub={sub}
          plan={plan}
          onBack={() => setStep('plan')}
          onDone={(r: TopupReceipt) => { setReceipt(r); setStep('done'); }}
        />
      )}

      {step === 'done' && receipt && (
        <StepDone receipt={receipt} onRestart={reset} />
      )}

      {/* i18n anchor so the namespace is referenced from the flow root */}
      <span style={{ display: 'none' }}>{t('topup.title') || 'Top-Up'}</span>
    </div>
  );
}
