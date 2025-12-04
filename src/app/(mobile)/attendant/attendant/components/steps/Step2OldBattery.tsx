'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from '../ScannerArea';

interface Step2Props {
  onScanOldBattery: () => void;
  isFirstTimeCustomer?: boolean;
  isScannerOpening?: boolean; // Prevents multiple scanner opens
}

export default function Step2OldBattery({ 
  onScanOldBattery, 
  isFirstTimeCustomer,
  isScannerOpening = false,
}: Step2Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">
          {isFirstTimeCustomer ? t('attendant.skipReturn') : t('attendant.returnBattery')}
        </h1>
        <p className="scan-subtitle">
          {isFirstTimeCustomer 
            ? t('attendant.firstTimeCustomer')
            : t('attendant.scanReturnBattery')}
        </p>
        
        <ScannerArea onClick={onScanOldBattery} type="battery" size="small" disabled={isScannerOpening} />
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {isFirstTimeCustomer 
            ? t('attendant.firstTimeCustomer')
            : t('attendant.scanReturnBattery')}
        </p>
      </div>
    </div>
  );
}
