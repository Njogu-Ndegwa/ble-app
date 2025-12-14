'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SalesStep } from './types';

interface SalesActionBarProps {
  currentStep: SalesStep;
  onBack: () => void;
  onMainAction: () => void;
  isLoading: boolean;
  isDisabled?: boolean;
  paymentInputMode?: 'scan' | 'manual'; // For step 5 to show correct button text
  hasBatteryScanned?: boolean; // For step 6 to show "Complete Service" vs "Scan Battery"
}

// Icon components for action bar
const ActionIcons = {
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
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

const getStepConfig = (step: SalesStep, paymentInputMode?: 'scan' | 'manual', hasBatteryScanned?: boolean): StepActionConfig => {
  switch (step) {
    case 1:
      // Customer Form step
      return { showBack: false, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
    case 2:
      // Select Package step (product + privilege bundled)
      return { showBack: true, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
    case 3:
      // Select Subscription step
      return { showBack: true, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
    case 4:
      // Preview step - Review order before payment
      return { showBack: true, mainTextKey: 'sales.proceedToPayment', mainIcon: 'arrow' };
    case 5:
      // Payment step - Show "Confirm Payment" when in manual mode, "Scan Payment QR" when in scan mode
      if (paymentInputMode === 'manual') {
        return { showBack: true, mainTextKey: 'sales.confirmPayment', mainIcon: 'check' };
      }
      return { showBack: true, mainTextKey: 'sales.scanPaymentQr', mainIcon: 'scan' };
    case 6:
      // Battery assignment step - Show "Complete Service" if battery scanned, "Scan Battery" otherwise
      if (hasBatteryScanned) {
        return { showBack: true, mainTextKey: 'sales.completeService', mainIcon: 'check' };
      }
      return { showBack: true, mainTextKey: 'sales.scanBattery', mainIcon: 'scan' };
    case 7:
      // Success step
      return { showBack: false, mainTextKey: 'sales.newRegistration', mainIcon: 'plus', mainClass: 'btn-success' };
    default:
      return { showBack: false, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
  }
};

export default function SalesActionBar({ currentStep, onBack, onMainAction, isLoading, isDisabled, paymentInputMode, hasBatteryScanned }: SalesActionBarProps) {
  const { t } = useI18n();
  const config = getStepConfig(currentStep, paymentInputMode, hasBatteryScanned);

  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        {config.showBack && (
          <button className="btn btn-secondary" onClick={onBack} disabled={isLoading}>
            {ActionIcons.back}
            {t('sales.back')}
          </button>
        )}
        <button 
          className={`btn ${config.mainClass || 'btn-primary'}`}
          onClick={onMainAction}
          disabled={isLoading || isDisabled}
        >
          {ActionIcons[config.mainIcon]}
          <span>{isLoading ? t('sales.processing') : t(config.mainTextKey)}</span>
        </button>
      </div>
    </div>
  );
}
