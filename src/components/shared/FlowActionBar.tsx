'use client';

import React from 'react';
import { useI18n } from '@/i18n';

export type ActionIcon = 'qr' | 'scan' | 'search' | 'arrow' | 'check' | 'plus' | 'back';

export interface ActionConfig {
  /** Whether to show the back button */
  showBack: boolean;
  /** Translation key for main action text */
  textKey: string;
  /** Fallback text if translation not found */
  fallbackText: string;
  /** Icon to show on main button */
  icon: ActionIcon;
  /** Additional CSS class for main button */
  buttonClass?: string;
  /** Whether to hide the main action button */
  hideMainAction?: boolean;
}

interface FlowActionBarProps {
  /** Current action configuration */
  config: ActionConfig;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Callback when main action button is clicked */
  onMainAction: () => void;
  /** Whether an action is loading/processing */
  isLoading?: boolean;
  /** Whether main action is disabled */
  isDisabled?: boolean;
  /** Optional className */
  className?: string;
}

// Action icons
const ActionIcons: Record<ActionIcon, React.ReactNode> = {
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
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

/**
 * FlowActionBar - Unified action bar for multi-step flows
 * 
 * Provides a consistent bottom action bar with optional back button
 * and configurable main action button.
 * 
 * @example
 * <FlowActionBar
 *   config={{
 *     showBack: true,
 *     textKey: 'sales.continue',
 *     fallbackText: 'Continue',
 *     icon: 'arrow',
 *   }}
 *   onBack={handleBack}
 *   onMainAction={handleContinue}
 *   isLoading={isProcessing}
 * />
 */
export default function FlowActionBar({
  config,
  onBack,
  onMainAction,
  isLoading = false,
  isDisabled = false,
  className = '',
}: FlowActionBarProps) {
  const { t } = useI18n();
  
  const buttonText = t(config.textKey) || config.fallbackText;
  const processingText = t('common.processing') || t('sales.processing') || 'Processing...';

  return (
    <div className={`action-bar ${className}`}>
      <div className="action-bar-inner">
        {config.showBack && (
          <button 
            className="btn btn-secondary" 
            onClick={onBack} 
            disabled={isLoading}
            type="button"
          >
            {ActionIcons.back}
            {t('sales.back') || t('common.back') || 'Back'}
          </button>
        )}
        {!config.hideMainAction && (
          <button 
            className={`btn ${config.buttonClass || 'btn-primary'}`}
            onClick={onMainAction}
            disabled={isLoading || isDisabled}
            type="button"
          >
            {ActionIcons[config.icon]}
            <span>{isLoading ? processingText : buttonText}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// PRESET ACTION CONFIGURATIONS
// ============================================

/**
 * Get action config for Attendant workflow steps
 */
export function getAttendantActionConfig(
  step: number,
  options?: {
    inputMode?: 'scan' | 'manual';
    paymentInputMode?: 'scan' | 'manual';
    hasSufficientQuota?: boolean;
  }
): ActionConfig {
  const { inputMode, paymentInputMode, hasSufficientQuota } = options || {};
  
  switch (step) {
    case 1:
      if (inputMode === 'manual') {
        return { 
          showBack: false, 
          textKey: 'attendant.lookUpCustomer', 
          fallbackText: 'Look Up',
          icon: 'search',
          hideMainAction: true, // Button is in the form
        };
      }
      return { 
        showBack: false, 
        textKey: 'attendant.scanQr', 
        fallbackText: 'Scan QR',
        icon: 'qr' 
      };
    case 2:
      return { 
        showBack: true, 
        textKey: 'attendant.scanReturnBattery', 
        fallbackText: 'Scan Battery',
        icon: 'scan' 
      };
    case 3:
      return { 
        showBack: true, 
        textKey: 'attendant.scanNewBattery', 
        fallbackText: 'Scan Battery',
        icon: 'scan' 
      };
    case 4:
      if (hasSufficientQuota) {
        return { 
          showBack: true, 
          textKey: 'attendant.completeSwap', 
          fallbackText: 'Complete',
          icon: 'check', 
          buttonClass: 'btn-success' 
        };
      }
      return { 
        showBack: true, 
        textKey: 'attendant.collectPayment', 
        fallbackText: 'Collect Payment',
        icon: 'arrow' 
      };
    case 5:
      return { 
        showBack: true, 
        textKey: 'attendant.confirmPayment', 
        fallbackText: 'Confirm',
        icon: paymentInputMode === 'manual' ? 'check' : 'qr' 
      };
    case 6:
      return { 
        showBack: false, 
        textKey: 'attendant.startNewSwap', 
        fallbackText: 'New Swap',
        icon: 'plus', 
        buttonClass: 'btn-success' 
      };
    default:
      return { 
        showBack: false, 
        textKey: 'attendant.scanQr', 
        fallbackText: 'Scan QR',
        icon: 'qr' 
      };
  }
}

/**
 * Get action config for Sales workflow steps
 */
export function getSalesActionConfig(
  step: number,
  options?: {
    paymentInputMode?: 'scan' | 'manual';
  }
): ActionConfig {
  const { paymentInputMode } = options || {};
  
  switch (step) {
    case 1:
      return { 
        showBack: false, 
        textKey: 'sales.continue', 
        fallbackText: 'Continue',
        icon: 'arrow' 
      };
    case 2:
      return { 
        showBack: true, 
        textKey: 'sales.continue', 
        fallbackText: 'Continue',
        icon: 'arrow' 
      };
    case 3:
      return { 
        showBack: true, 
        textKey: 'sales.continue', 
        fallbackText: 'Continue',
        icon: 'arrow' 
      };
    case 4:
      return { 
        showBack: true, 
        textKey: 'sales.proceedToPayment', 
        fallbackText: 'Proceed to Payment',
        icon: 'arrow' 
      };
    case 5:
      if (paymentInputMode === 'manual') {
        return { 
          showBack: true, 
          textKey: 'sales.confirmPayment', 
          fallbackText: 'Confirm Payment',
          icon: 'check' 
        };
      }
      return { 
        showBack: true, 
        textKey: 'sales.scanPaymentQr', 
        fallbackText: 'Scan Payment',
        icon: 'scan' 
      };
    case 6:
      return { 
        showBack: true, 
        textKey: 'sales.scanBattery', 
        fallbackText: 'Scan Battery',
        icon: 'scan' 
      };
    case 7:
      return { 
        showBack: false, 
        textKey: 'sales.newRegistration', 
        fallbackText: 'New Registration',
        icon: 'plus', 
        buttonClass: 'btn-success' 
      };
    default:
      return { 
        showBack: false, 
        textKey: 'sales.continue', 
        fallbackText: 'Continue',
        icon: 'arrow' 
      };
  }
}
