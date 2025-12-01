'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SalesStep, STEP_CONFIGS } from './types';

interface SalesTimelineProps {
  currentStep: SalesStep;
  maxStepReached?: SalesStep;
  onStepClick?: (step: SalesStep) => void;
}

// Map step icons to translation keys
const STEP_LABEL_KEYS: Record<string, string> = {
  customer: 'sales.step.customer',
  plan: 'sales.step.plan',
  payment: 'sales.step.payment',
  battery: 'sales.step.battery',
  done: 'sales.step.done',
};

// Step icons as SVG components
const StepIcons = {
  customer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M16 13H8M16 17H8M10 9H8"/>
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
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

export default function SalesTimeline({ currentStep, maxStepReached = currentStep, onStepClick }: SalesTimelineProps) {
  const { t } = useI18n();
  
  const getStepClass = (step: number): string => {
    if (step === currentStep) {
      return step === 5 ? 'success' : 'active';
    }
    if (step < currentStep) return 'completed';
    if (step <= maxStepReached) return 'reachable';
    return 'disabled';
  };

  const handleStepClick = (step: number) => {
    if (step <= maxStepReached && step !== currentStep && onStepClick) {
      onStepClick(step as SalesStep);
    }
  };

  const getConnectorClass = (stepNum: number): string => {
    return stepNum < maxStepReached ? 'completed' : '';
  };

  return (
    <div className="flow-timeline" id="sales-timeline">
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
