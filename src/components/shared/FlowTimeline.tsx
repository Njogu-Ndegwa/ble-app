'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { StepStatus, FlowError } from './types';

export interface TimelineStep {
  /** Step number */
  step: number;
  /** Translation key for label */
  labelKey: string;
  /** Fallback label if translation not found */
  fallbackLabel: string;
  /** Icon identifier */
  icon: string;
}

interface FlowTimelineProps {
  /** Current active step */
  currentStep: number;
  /** Maximum step the user has reached (for navigation) */
  maxStepReached?: number;
  /** Total number of steps */
  totalSteps: number;
  /** Step configurations */
  steps: TimelineStep[];
  /** Callback when a step is clicked */
  onStepClick?: (step: number) => void;
  /** Flow error (if any) */
  flowError?: FlowError | null;
  /** Optional className */
  className?: string;
  /** Custom ID for targeting styles */
  id?: string;
}

// Common step icons
export const StepIcons: Record<string, React.ReactNode> = {
  customer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  'battery-return': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2"/>
      <path d="M22 11v2"/>
      <path d="M6 11v2"/>
    </svg>
  ),
  'battery-new': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2"/>
      <path d="M22 11v2"/>
      <path d="M7 11h4M9 9v4"/>
    </svg>
  ),
  battery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2"/>
      <path d="M22 11v2"/>
      <path d="M7 11h4M9 9v4"/>
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M16 13H8M16 17H8"/>
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
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <path d="M1 10h22"/>
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
  done: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  ),
};

/**
 * FlowTimeline - Unified timeline component for multi-step flows
 * 
 * Supports both Attendant (6 steps) and Sales (7 steps) workflows
 * with configurable steps, icons, and error states.
 * 
 * @example
 * <FlowTimeline
 *   currentStep={3}
 *   maxStepReached={3}
 *   totalSteps={6}
 *   steps={ATTENDANT_STEPS}
 *   onStepClick={handleStepClick}
 * />
 */
export default function FlowTimeline({
  currentStep,
  maxStepReached = currentStep,
  totalSteps,
  steps,
  onStepClick,
  flowError,
  className = '',
  id,
}: FlowTimelineProps) {
  const { t } = useI18n();
  
  const getStepStatus = (step: number): StepStatus => {
    // If there's a flow error at this step, show it as failed
    if (flowError && flowError.step === step) {
      return 'failed';
    }
    if (step === currentStep) {
      return step === totalSteps ? 'completed' : 'active';
    }
    if (step < currentStep) return 'completed';
    if (step <= maxStepReached) return 'reachable';
    return 'pending';
  };

  const getStepClass = (status: StepStatus): string => {
    switch (status) {
      case 'completed': return 'completed';
      case 'active': return currentStep === totalSteps ? 'success' : 'active';
      case 'reachable': return 'reachable';
      case 'failed': return 'failed';
      default: return 'disabled';
    }
  };

  const handleStepClick = (step: number) => {
    // Allow clicking on any step up to maxStepReached
    if (step <= maxStepReached && step !== currentStep && !flowError && onStepClick) {
      onStepClick(step);
    }
  };

  const getConnectorClass = (stepNum: number): string => {
    if (flowError && stepNum >= flowError.step) {
      return flowError.step === stepNum ? 'failed' : '';
    }
    return stepNum < maxStepReached ? 'completed' : '';
  };

  return (
    <div className={`flow-timeline ${className}`} id={id}>
      <div className="timeline-track">
        {steps.map((config, index) => {
          const status = getStepStatus(config.step);
          const stepClass = getStepClass(status);
          const isFailed = status === 'failed';
          
          // Get translated label or use fallback
          const label = t(config.labelKey) || config.fallbackLabel;
          
          return (
            <React.Fragment key={config.step}>
              <div 
                className={`timeline-step ${stepClass}`}
                onClick={() => handleStepClick(config.step)}
                role="button"
                tabIndex={config.step <= maxStepReached ? 0 : -1}
                aria-current={status === 'active' ? 'step' : undefined}
                aria-disabled={status === 'pending'}
              >
                <div className="timeline-dot">
                  {isFailed 
                    ? StepIcons.error 
                    : (StepIcons[config.icon] || StepIcons.done)
                  }
                </div>
                <span className="timeline-label">
                  {isFailed ? (t('common.failed') || 'Failed') : label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`timeline-connector ${getConnectorClass(config.step)}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Error message display */}
      {flowError && (
        <div className="flow-error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <div className="flow-error-content">
            <span className="flow-error-message">{flowError.message}</span>
            {flowError.details && (
              <span className="flow-error-details">{flowError.details}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PRESET STEP CONFIGURATIONS
// ============================================

/**
 * Attendant workflow steps (6 steps)
 */
export const ATTENDANT_TIMELINE_STEPS: TimelineStep[] = [
  { step: 1, labelKey: 'attendant.step.customer', fallbackLabel: 'Customer', icon: 'customer' },
  { step: 2, labelKey: 'attendant.step.return', fallbackLabel: 'Return', icon: 'battery-return' },
  { step: 3, labelKey: 'attendant.step.new', fallbackLabel: 'New', icon: 'battery-new' },
  { step: 4, labelKey: 'attendant.step.review', fallbackLabel: 'Review', icon: 'review' },
  { step: 5, labelKey: 'attendant.step.pay', fallbackLabel: 'Pay', icon: 'payment' },
  { step: 6, labelKey: 'attendant.step.done', fallbackLabel: 'Done', icon: 'done' },
];

/**
 * Sales workflow steps (7 steps)
 */
export const SALES_TIMELINE_STEPS: TimelineStep[] = [
  { step: 1, labelKey: 'sales.step.customer', fallbackLabel: 'Customer', icon: 'customer' },
  { step: 2, labelKey: 'sales.step.package', fallbackLabel: 'Package', icon: 'package' },
  { step: 3, labelKey: 'sales.step.subscription', fallbackLabel: 'Plan', icon: 'plan' },
  { step: 4, labelKey: 'sales.step.preview', fallbackLabel: 'Preview', icon: 'preview' },
  { step: 5, labelKey: 'sales.step.payment', fallbackLabel: 'Payment', icon: 'payment' },
  { step: 6, labelKey: 'sales.step.battery', fallbackLabel: 'Battery', icon: 'battery' },
  { step: 7, labelKey: 'sales.step.done', fallbackLabel: 'Done', icon: 'done' },
];
