'use client';

import React from 'react';
import { Camera } from 'lucide-react';
import { useI18n } from '@/i18n';
import { AttendantStep } from './types';
import type { InputMode } from '@/components/shared/types';

interface ActionBarProps {
  currentStep: AttendantStep;
  onBack: () => void;
  onMainAction: () => void;
  isLoading: boolean;
  inputMode?: InputMode;
  paymentInputMode?: InputMode;
  hasSufficientQuota?: boolean;
  swapCost?: number;
  /** Top-up-only attendant (SA-ID gated): replace "Collect Payment" with "Refresh quota" */
  requireRiderTopUp?: boolean;
  /** Manual Swap: no payment step — the Review action completes the swap directly. */
  noPaymentStep?: boolean;
  /** First-time customer: step 2 has nothing to return, so offer a skip. */
  isFirstTimeCustomer?: boolean;
  /** Bounded swap plan has no swaps left; refresh after the rider renews. */
  requiresPlanRenewal?: boolean;
  readOnly?: boolean;
}

// Icon components for action bar
const ActionIcons = {
  qr: <Camera size={18} />,
  scan: <Camera size={18} />,
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
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  ),
};

interface StepActionConfig {
  showBack: boolean;
  mainTextKey: string;
  mainIcon: keyof typeof ActionIcons;
  mainClass?: string;
}

const getStepConfig = (step: AttendantStep, inputMode?: InputMode, hasSufficientQuota?: boolean, paymentInputMode?: InputMode, swapCost?: number, requireRiderTopUp?: boolean, noPaymentStep?: boolean, isFirstTimeCustomer?: boolean, requiresPlanRenewal?: boolean): StepActionConfig => {
  switch (step) {
    case 1:
      // Show different text/icon based on input mode
      if (inputMode === 'manual') {
        return { showBack: false, mainTextKey: 'attendant.lookUpCustomer', mainIcon: 'search' };
      }
      return { showBack: false, mainTextKey: 'attendant.scanQr', mainIcon: 'qr' };
    case 2:
      // First-time customers have nothing to return - offer the skip the step
      // already describes, rather than a scan they cannot perform.
      if (isFirstTimeCustomer) {
        return { showBack: true, mainTextKey: 'attendant.skipReturn', mainIcon: 'arrow' };
      }
      return { showBack: true, mainTextKey: 'attendant.scanReturnBattery', mainIcon: 'scan' };
    case 3:
      return { showBack: true, mainTextKey: 'attendant.scanNewBattery', mainIcon: 'scan' };
    case 4:
      if (requiresPlanRenewal) {
        return { showBack: true, mainTextKey: 'attendant.refreshQuota', mainIcon: 'refresh' };
      }
      // Show "Complete Swap" with check icon when:
      // 1. Customer has sufficient quota, OR
      // 2. Rounded cost is zero or negative (nothing to collect)
      // NOTE: We use Math.floor because customers can't pay decimals (e.g., 0.54 rounds to 0)
      const roundedCost = swapCost !== undefined ? Math.floor(swapCost) : undefined;
      const shouldSkipPayment = hasSufficientQuota || (roundedCost !== undefined && roundedCost <= 0);
      if (shouldSkipPayment) {
        return { showBack: true, mainTextKey: 'attendant.completeSwap', mainIcon: 'check', mainClass: 'btn-success' };
      }
      // Top-up-only attendants never collect a differential — the rider tops up
      // in their own app, so the action re-checks quota instead of paying.
      if (requireRiderTopUp) {
        return { showBack: true, mainTextKey: 'attendant.refreshQuota', mainIcon: 'refresh' };
      }
      // Manual Swap has no payment step — the Review action records and completes
      // the swap directly, so show "Complete Swap" rather than "Collect Payment".
      if (noPaymentStep) {
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

export default function ActionBar({ currentStep, onBack, onMainAction, isLoading, inputMode, paymentInputMode, hasSufficientQuota, swapCost, requireRiderTopUp, noPaymentStep, isFirstTimeCustomer, requiresPlanRenewal, readOnly }: ActionBarProps) {
  const { t } = useI18n();
  const config = getStepConfig(currentStep, inputMode, hasSufficientQuota, paymentInputMode, swapCost, requireRiderTopUp, noPaymentStep, isFirstTimeCustomer, requiresPlanRenewal);

  // Don't show the action bar button for step 1 in manual mode - button is in the form
  const hideMainButton = currentStep === 1 && inputMode === 'manual';
  
  // In read-only mode, only show navigation buttons
  if (readOnly) {
    return (
      <div className="action-bar action-bar-readonly">
        <div className="action-bar-inner">
          {currentStep > 1 && (
            <button className="btn btn-secondary" onClick={onBack}>
              {ActionIcons.back}
              {t('sales.back')}
            </button>
          )}
          {currentStep < 6 && (
            <button 
              className="btn btn-secondary"
              onClick={onMainAction}
            >
              <span>{t('sessions.viewNext') || 'View Next'}</span>
              {ActionIcons.arrow}
            </button>
          )}
          {currentStep === 6 && (
            <button 
              className="btn btn-primary"
              onClick={onMainAction}
            >
              {ActionIcons.plus}
              <span>{t('attendant.startNewSwap')}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

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
