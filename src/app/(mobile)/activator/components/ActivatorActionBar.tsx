'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { ActivatorStep } from './types';

interface ActivatorActionBarProps {
  currentStep: ActivatorStep;
  onBack: () => void;
  onMainAction: () => void;
  isLoading: boolean;
  isDisabled?: boolean;
  hasVehicleScanned?: boolean;
  hasBatteryScanned?: boolean;
  customerIdentified?: boolean;
  isIdentifying?: boolean;
  identificationFailed?: boolean;
  readOnly?: boolean;
}

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

const getStepConfig = (step: ActivatorStep, hasVehicleScanned?: boolean, hasBatteryScanned?: boolean): StepActionConfig => {
  switch (step) {
    case 1:
      return { showBack: false, mainTextKey: 'activator.continue', mainIcon: 'arrow' };
    case 2:
      return { showBack: true, mainTextKey: 'activator.continue', mainIcon: 'arrow' };
    case 3:
      return { showBack: true, mainTextKey: 'activator.continue', mainIcon: 'arrow' };
    case 4:
      if (hasVehicleScanned) {
        return { showBack: true, mainTextKey: 'activator.continue', mainIcon: 'arrow' };
      }
      return { showBack: true, mainTextKey: 'activator.scanVehicleBtn', mainIcon: 'scan' };
    case 5:
      if (hasBatteryScanned) {
        return { showBack: true, mainTextKey: 'activator.completeService', mainIcon: 'check' };
      }
      return { showBack: true, mainTextKey: 'activator.scanBattery', mainIcon: 'scan' };
    case 6:
      return { showBack: false, mainTextKey: 'activator.newActivation', mainIcon: 'plus', mainClass: 'btn-success' };
    default:
      return { showBack: false, mainTextKey: 'activator.continue', mainIcon: 'arrow' };
  }
};

export default function ActivatorActionBar({
  currentStep,
  onBack,
  onMainAction,
  isLoading,
  isDisabled,
  hasVehicleScanned,
  hasBatteryScanned,
  customerIdentified = true,
  isIdentifying = false,
  readOnly = false,
}: ActivatorActionBarProps) {
  const { t } = useI18n();
  const config = getStepConfig(currentStep, hasVehicleScanned, hasBatteryScanned);

  const isCompleteServiceStep = currentStep === 5 && hasBatteryScanned;
  const waitingForIdentification = isCompleteServiceStep && !customerIdentified;
  const buttonDisabled = isLoading || isDisabled || (waitingForIdentification && isIdentifying);

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <div className="btn-spinner" style={{ width: '16px', height: '16px' }}></div>
          <span>{t('activator.processing') || t('sales.processing')}</span>
        </>
      );
    }

    if (waitingForIdentification && isIdentifying) {
      return (
        <>
          <div className="btn-spinner" style={{ width: '16px', height: '16px' }}></div>
          <span>{t('activator.fetchingPricing') || t('sales.fetchingPricing') || 'Fetching pricing...'}</span>
        </>
      );
    }

    return (
      <>
        {ActionIcons[config.mainIcon]}
        <span>{t(config.mainTextKey)}</span>
      </>
    );
  };

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
            <button className="btn btn-secondary" onClick={onMainAction}>
              <span>{t('sessions.viewNext') || 'View Next'}</span>
              {ActionIcons.arrow}
            </button>
          )}
          {currentStep === 6 && (
            <button className="btn btn-primary" onClick={onMainAction}>
              {ActionIcons.plus}
              <span>{t('activator.newActivation') || 'New Activation'}</span>
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
