'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from '../ScannerArea';
import { Bluetooth, Radio } from 'lucide-react';

interface Step2Props {
  onScanOldBattery: () => void;
  isFirstTimeCustomer?: boolean;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
  isScannerOpening?: boolean; // Prevents multiple scanner opens
}

export default function Step2OldBattery({ 
  onScanOldBattery, 
  isFirstTimeCustomer,
  isBleScanning = false,
  detectedDevicesCount = 0,
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
        
        {/* BLE Scanning Status - Shows nearby batteries being detected */}
        <div className={`bluetooth-notice ${isBleScanning ? 'ble-scanning-active' : ''}`}>
          <div className="bluetooth-notice-icon">
            {isBleScanning ? (
              <Radio size={20} className="ble-scanning-icon" />
            ) : (
              <Bluetooth size={20} />
            )}
          </div>
          <div className="bluetooth-notice-content">
            <span className="bluetooth-notice-title">
              {isBleScanning ? t('sales.scanningForDevices') : 'Bluetooth'}
            </span>
            <span className="bluetooth-notice-text">
              {isBleScanning 
                ? `${detectedDevicesCount} ${t('sales.devicesFound')}`
                : t('attendant.scanReturnBattery')}
            </span>
          </div>
        </div>
        
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
