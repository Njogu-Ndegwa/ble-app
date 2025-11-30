'use client';

import React from 'react';
import { AttendantStep, STEP_CONFIGS, FlowError } from './types';

interface TimelineProps {
  currentStep: AttendantStep;
  maxStepReached?: AttendantStep; // The furthest step the user has reached
  onStepClick?: (step: AttendantStep) => void;
  flowError?: FlowError | null;
}

// Step icons as SVG components
const StepIcons = {
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
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M16 13H8M16 17H8"/>
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <path d="M1 10h22"/>
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

export default function Timeline({ currentStep, maxStepReached = currentStep, onStepClick, flowError }: TimelineProps) {
  const getStepClass = (step: number): string => {
    // If there's a flow error at this step, show it as failed
    if (flowError && flowError.step === step) {
      return 'failed';
    }
    if (step === currentStep) {
      return step === 6 ? 'success' : 'active';
    }
    // Steps before current are completed
    if (step < currentStep) return 'completed';
    // Steps after current but within maxStepReached are "reachable" (can navigate back to them)
    if (step <= maxStepReached) return 'reachable';
    return 'disabled';
  };

  const handleStepClick = (step: number) => {
    // Allow clicking on any step up to maxStepReached (not just completed steps)
    // This allows users to go back and forth without losing progress
    if (step <= maxStepReached && step !== currentStep && !flowError && onStepClick) {
      onStepClick(step as AttendantStep);
    }
  };

  // Determine if we should show connector as failed or completed
  const getConnectorClass = (stepNum: number): string => {
    // If there's a flow error, connectors after the error step stay uncolored
    if (flowError && stepNum >= flowError.step) {
      return flowError.step === stepNum ? 'failed' : '';
    }
    // Show connector as completed if the step after it is within maxStepReached
    return stepNum < maxStepReached ? 'completed' : '';
  };

  return (
    <div className="flow-timeline">
      <div className="timeline-track">
        {STEP_CONFIGS.map((config, index) => {
          const stepClass = getStepClass(config.step);
          const isFailed = stepClass === 'failed';
          
          return (
            <React.Fragment key={config.step}>
              <div 
                className={`timeline-step ${stepClass}`}
                onClick={() => handleStepClick(config.step)}
              >
                <div className="timeline-dot">
                  {isFailed ? StepIcons.error : StepIcons[config.icon]}
                </div>
                <span className="timeline-label">
                  {isFailed ? 'Failed' : config.label}
                </span>
              </div>
              {index < STEP_CONFIGS.length - 1 && (
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
