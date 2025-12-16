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
  hasVehicleScanned?: boolean; // For step 6 to show "Continue" vs "Scan Vehicle"
  hasBatteryScanned?: boolean; // For step 7 to show "Complete Service" vs "Scan Battery"
  /** Whether customer identification is complete (required for step 7 Complete Service) */
  customerIdentified?: boolean;
  /** Whether customer identification is in progress */
  isIdentifying?: boolean;
  /** Whether customer identification has failed after retries */
  identificationFailed?: boolean;
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

const getStepConfig = (step: SalesStep, paymentInputMode?: 'scan' | 'manual', hasVehicleScanned?: boolean, hasBatteryScanned?: boolean): StepActionConfig => {
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
      // Vehicle scan step - Show "Continue" if vehicle scanned, "Scan Vehicle" otherwise
      if (hasVehicleScanned) {
        return { showBack: true, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
      }
      return { showBack: true, mainTextKey: 'sales.scanVehicleBtn', mainIcon: 'scan' };
    case 7:
      // Battery assignment step - Show "Complete Service" if battery scanned, "Scan Battery" otherwise
      if (hasBatteryScanned) {
        return { showBack: true, mainTextKey: 'sales.completeService', mainIcon: 'check' };
      }
      return { showBack: true, mainTextKey: 'sales.scanBattery', mainIcon: 'scan' };
    case 8:
      // Success step
      return { showBack: false, mainTextKey: 'sales.newRegistration', mainIcon: 'plus', mainClass: 'btn-success' };
    default:
      return { showBack: false, mainTextKey: 'sales.continue', mainIcon: 'arrow' };
  }
};

export default function SalesActionBar({ 
  currentStep, 
  onBack, 
  onMainAction, 
  isLoading, 
  isDisabled, 
  paymentInputMode,
  hasVehicleScanned,
  hasBatteryScanned,
  customerIdentified = true,
  isIdentifying = false,
  identificationFailed = false,
}: SalesActionBarProps) {
  const { t } = useI18n();
  const config = getStepConfig(currentStep, paymentInputMode, hasVehicleScanned, hasBatteryScanned);

  // Determine if the button should be disabled
  // On step 7 with battery scanned, require customer identification to be complete
  const isCompleteServiceStep = currentStep === 7 && hasBatteryScanned;
  const waitingForIdentification = isCompleteServiceStep && !customerIdentified;
  
  // Don't disable button if identification failed - user can click to see error message
  // This allows them to understand why they need to fetch pricing first
  const buttonDisabled = isLoading || isDisabled || (waitingForIdentification && isIdentifying);

  // Determine button text
  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <div className="btn-spinner" style={{ width: '16px', height: '16px' }}></div>
          <span>{t('sales.processing')}</span>
        </>
      );
    }
    
    // Show "Fetching pricing..." when actively fetching
    if (waitingForIdentification && isIdentifying) {
      return (
        <>
          <div className="btn-spinner" style={{ width: '16px', height: '16px' }}></div>
          <span>{t('sales.fetchingPricing') || 'Fetching pricing...'}</span>
        </>
      );
    }
    
    // When identification failed, show "Complete Service" but clicking will show error
    // The user should use the "Fetch Pricing" button in the content area
    return (
      <>
        {ActionIcons[config.mainIcon]}
        <span>{t(config.mainTextKey)}</span>
      </>
    );
  };

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
          disabled={buttonDisabled}
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
}
