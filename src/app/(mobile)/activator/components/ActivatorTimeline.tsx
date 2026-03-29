'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { ActivatorStep, STEP_CONFIGS } from './types';

interface ActivatorTimelineProps {
  currentStep: ActivatorStep;
  maxStepReached?: ActivatorStep;
  onStepClick?: (step: ActivatorStep) => void;
  readOnly?: boolean;
}

const STEP_LABEL_KEYS: Record<string, string> = {
  customer: 'activator.step.customer',
  plan: 'activator.step.plan',
  vehicle: 'activator.step.vehicle',
  battery: 'activator.step.battery',
  done: 'activator.step.done',
};

const StepIcons: Record<string, React.ReactNode> = {
  customer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  vehicle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17h4V5H2v12h3"/>
      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
      <circle cx="7.5" cy="17.5" r="2.5"/>
      <circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  battery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2"/>
      <path d="M22 11v2"/>
      <path d="M7 11h4M9 9v4"/>
    </svg>
  ),
  done: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
};

export default function ActivatorTimeline({ currentStep, maxStepReached = currentStep, onStepClick, readOnly }: ActivatorTimelineProps) {
  const { t } = useI18n();

  const getStepClass = (step: number): string => {
    if (step === currentStep) {
      if (readOnly) {
        return step === 5 ? 'readonly-success' : 'readonly-active';
      }
      return step === 5 ? 'success' : 'active';
    }
    if (step < currentStep) return readOnly ? 'readonly-completed' : 'completed';
    if (step <= maxStepReached) return readOnly ? 'readonly-reachable' : 'reachable';
    return 'disabled';
  };

  const handleStepClick = (step: number) => {
    if (step <= maxStepReached && step !== currentStep && onStepClick) {
      onStepClick(step as ActivatorStep);
    }
  };

  const getConnectorClass = (stepNum: number): string => {
    if (stepNum < maxStepReached) {
      return readOnly ? 'readonly-completed' : 'completed';
    }
    return '';
  };

  return (
    <div className={`flow-timeline ${readOnly ? 'flow-timeline-readonly' : ''}`} id="activator-timeline">
      <div className="timeline-track">
        {STEP_CONFIGS.map((config, index) => {
          const stepClass = getStepClass(config.step);
          const labelKey = STEP_LABEL_KEYS[config.icon];

          return (
            <React.Fragment key={config.step}>
              <div
                className={`timeline-step ${stepClass}`}
                onClick={() => handleStepClick(config.step)}
              >
                <div className="timeline-dot">
                  {StepIcons[config.icon]}
                </div>
                <span className="timeline-label">{labelKey ? t(labelKey) : config.label}</span>
              </div>
              {index < STEP_CONFIGS.length - 1 && (
                <div className={`timeline-connector ${getConnectorClass(config.step)}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
