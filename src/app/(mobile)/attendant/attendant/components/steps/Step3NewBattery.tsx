'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from '../ScannerArea';
import { BatteryData, getBatteryClass } from '../types';
import { Bluetooth, Radio } from 'lucide-react';

interface Step3Props {
  oldBattery: BatteryData | null;
  onScanNewBattery: () => void;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
}

export default function Step3NewBattery({ 
  oldBattery, 
  onScanNewBattery,
  isBleScanning = false,
  detectedDevicesCount = 0,
}: Step3Props) {
  const { t } = useI18n();
  const chargeLevel = oldBattery?.chargeLevel ?? 0;
  const energyWh = oldBattery?.energy ?? 0;
  const energyKwh = energyWh / 1000; // Convert to kWh for display
  const batteryClass = getBatteryClass(chargeLevel);

  return (
    <div className="screen active">
      {/* Compact Old Battery Card */}
      <div className="battery-return-card">
        <div className="battery-return-header">
          <span className="battery-return-label">{t('attendant.returnedBattery')}</span>
          <span className="battery-return-status">✓ Connected</span>
        </div>
        <div className="battery-return-content">
          <div className="battery-return-id">{oldBattery?.shortId || '---'}</div>
          <div className="battery-return-charge">
            <div className={`battery-return-icon ${batteryClass}`}>
              <div 
                className="battery-return-fill" 
                style={{ '--level': `${chargeLevel}%` } as React.CSSProperties}
              ></div>
            </div>
            <span className="battery-return-percent">{energyKwh.toFixed(3)} kWh</span>
            <span className="battery-return-unit">{t('attendant.energyRemaining')}</span>
          </div>
        </div>
      </div>

      <div className="scan-prompt">
        <h1 className="scan-title">{t('attendant.issueNewBattery')}</h1>
        <p className="scan-subtitle">{t('attendant.scanNewBattery')}</p>
        
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
                : t('attendant.scanNewBattery')}
            </span>
          </div>
        </div>
        
        <ScannerArea onClick={onScanNewBattery} type="battery" size="small" />
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {t('attendant.scanNewBattery')}
        </p>
      </div>
    </div>
  );
}
