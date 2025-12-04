'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { AttendantStep } from './types';

interface ActionBarProps {
  currentStep: AttendantStep;
  onBack: () => void;
  onMainAction: () => void;
  isLoading: boolean;
  inputMode?: 'scan' | 'manual';
  paymentInputMode?: 'scan' | 'manual';
  hasSufficientQuota?: boolean;
}

// Icon components for action bar
const ActionIcons = {
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
};

interface StepActionConfig {
  showBack: boolean;
  mainTextKey: string;
  mainIcon: keyof typeof ActionIcons;
  mainClass?: string;
}

const getStepConfig = (step: AttendantStep, inputMode?: 'scan' | 'manual', hasSufficientQuota?: boolean, paymentInputMode?: 'scan' | 'manual'): StepActionConfig => {
  switch (step) {
    case 1:
      // Show different text/icon based on input mode
      if (inputMode === 'manual') {
        return { showBack: false, mainTextKey: 'attendant.lookUpCustomer', mainIcon: 'search' };
      }
      return { showBack: false, mainTextKey: 'attendant.scanQr', mainIcon: 'qr' };
    case 2:
      return { showBack: true, mainTextKey: 'attendant.scanReturnBattery', mainIcon: 'scan' };
    case 3:
      return { showBack: true, mainTextKey: 'attendant.scanNewBattery', mainIcon: 'scan' };
    case 4:
      // Show "Complete Swap" with check icon when customer has sufficient quota
      if (hasSufficientQuota) {
        return { showBack: true, mainTextKey: 'attendant.completeSwap', mainIcon: 'check', mainClass: 'btn-success' };
      }
      return { showBack: true, mainTextKey: 'attendant.collectPayment', mainIcon: 'arrow' };
    case 5:
      // Show appropriate icon based on payment input mode (scan QR or manual entry)
      return { 
        showBack: true, 
        mainTextKey: 'attendant.confirmPayment', 
        mainIcon: paymentInputMode === 'manual' ? 'check' : 'qr' 
      };
    case 6:
      return { showBack: false, mainTextKey: 'attendant.startNewSwap', mainIcon: 'plus', mainClass: 'btn-success' };
    default:
      return { showBack: false, mainTextKey: 'attendant.scanQr', mainIcon: 'qr' };
  }
};

export default function ActionBar({ currentStep, onBack, onMainAction, isLoading, inputMode, paymentInputMode, hasSufficientQuota }: ActionBarProps) {
  const { t } = useI18n();
  const config = getStepConfig(currentStep, inputMode, hasSufficientQuota, paymentInputMode);

  // Don't show the action bar button for step 1 in manual mode - button is in the form
  const hideMainButton = currentStep === 1 && inputMode === 'manual';

  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        {config.showBack && (
          <button className="btn btn-secondary" onClick={onBack} disabled={isLoading}>
            {ActionIcons.back}
            {t('sales.back')}
          </button>
        )}
        {!hideMainButton && (
          <button 
            className={`btn ${config.mainClass || 'btn-primary'}`}
            onClick={onMainAction}
            disabled={isLoading}
          >
            {ActionIcons[config.mainIcon]}
            <span>{isLoading ? t('sales.processing') : t(config.mainTextKey)}</span>
          </button>
        )}
      </div>
    </div>
  );
}
