'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SalesStep, STEP_CONFIGS } from './types';

interface SalesTimelineProps {
  currentStep: SalesStep;
  maxStepReached?: SalesStep;
  onStepClick?: (step: SalesStep) => void;
  /** Review mode - displays session in read-only mode with different styling */
  reviewMode?: boolean;
}

// Map step icons to translation keys
const STEP_LABEL_KEYS: Record<string, string> = {
  customer: 'sales.step.customer',
  package: 'sales.step.package',
  plan: 'sales.step.subscription',
  preview: 'sales.step.preview',
  payment: 'sales.step.payment',
  battery: 'sales.step.battery',
  done: 'sales.step.done',
};

// Step icons as SVG components
const StepIcons: Record<string, React.ReactNode> = {
  customer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
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
  preview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
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

export default function SalesTimeline({ currentStep, maxStepReached = currentStep, onStepClick, reviewMode = false }: SalesTimelineProps) {
  const { t } = useI18n();
  
  const getStepClass = (step: number): string => {
    if (step === currentStep) {
      return step === 7 ? 'success' : 'active';
    }
    if (step < currentStep) return 'completed';
    if (step <= maxStepReached) return 'reachable';
    return 'disabled';
  };

  const handleStepClick = (step: number) => {
    // Disable navigation in review mode
    if (reviewMode) return;
    if (step <= maxStepReached && step !== currentStep && onStepClick) {
      onStepClick(step as SalesStep);
    }
  };

  const getConnectorClass = (stepNum: number): string => {
    return stepNum < maxStepReached ? 'completed' : '';
  };

  return (
    <div className={`flow-timeline ${reviewMode ? 'review-mode' : ''}`} id="sales-timeline">
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
