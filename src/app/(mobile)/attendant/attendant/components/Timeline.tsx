'use client';

import React from 'react';
import { AttendantStep, STEP_CONFIGS } from './types';

interface TimelineProps {
  currentStep: AttendantStep;
  onStepClick?: (step: AttendantStep) => void;
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
};

export default function Timeline({ currentStep, onStepClick }: TimelineProps) {
  const getStepClass = (step: number): string => {
    if (step === currentStep) {
      return step === 6 ? 'success' : 'active';
    }
    if (step < currentStep) return 'completed';
    return 'disabled';
  };

  const handleStepClick = (step: number) => {
    // Only allow clicking on completed steps
    if (step < currentStep && onStepClick) {
      onStepClick(step as AttendantStep);
    }
  };

  return (
    <div className="flow-timeline">
      <div className="timeline-track">
        {STEP_CONFIGS.map((config, index) => (
          <React.Fragment key={config.step}>
            <div 
              className={`timeline-step ${getStepClass(config.step)}`}
              onClick={() => handleStepClick(config.step)}
            >
              <div className="timeline-dot">
                {StepIcons[config.icon]}
              </div>
              <span className="timeline-label">{config.label}</span>
            </div>
            {index < STEP_CONFIGS.length - 1 && (
              <div 
                className={`timeline-connector ${config.step < currentStep ? 'completed' : ''}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
