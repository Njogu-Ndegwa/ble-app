'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';
import { Bluetooth, Radio } from 'lucide-react';

interface Step2Props {
  onScanOldBattery: () => void;
  isFirstTimeCustomer?: boolean;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
}

export default function Step2OldBattery({ 
  onScanOldBattery, 
  isFirstTimeCustomer,
  isBleScanning = false,
  detectedDevicesCount = 0,
}: Step2Props) {
  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">
          {isFirstTimeCustomer ? 'Scan Battery (Optional)' : 'Scan Old Battery'}
        </h1>
        <p className="scan-subtitle">
          {isFirstTimeCustomer 
            ? 'First-time customer - scan battery if returning one'
            : 'Scan the battery the customer brought in'}
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
              {isBleScanning ? 'Scanning for Batteries...' : 'Bluetooth Required'}
            </span>
            <span className="bluetooth-notice-text">
              {isBleScanning 
                ? `${detectedDevicesCount} ${detectedDevicesCount === 1 ? 'battery' : 'batteries'} detected nearby`
                : 'Please ensure Bluetooth is turned ON on this device to read battery energy levels'}
            </span>
          </div>
        </div>
        
        <ScannerArea onClick={onScanOldBattery} type="battery" size="small" />
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {isFirstTimeCustomer 
            ? 'Skip if no battery to return'
            : 'Battery energy will be read via Bluetooth'}
        </p>
      </div>
    </div>
  );
}
