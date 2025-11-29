'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';
import { BatteryData, getBatteryClass } from '../types';
import { Bluetooth } from 'lucide-react';

interface Step3Props {
  oldBattery: BatteryData | null;
  onScanNewBattery: () => void;
}

export default function Step3NewBattery({ oldBattery, onScanNewBattery }: Step3Props) {
  const chargeLevel = oldBattery?.chargeLevel || 0;
  const energyWh = oldBattery?.energy || 0;
  const energyKwh = energyWh / 1000; // Convert to kWh for display
  const batteryClass = getBatteryClass(chargeLevel);

  return (
    <div className="screen active">
      {/* Compact Old Battery Card */}
      <div className="battery-return-card">
        <div className="battery-return-header">
          <span className="battery-return-label">OLD BATTERY</span>
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
            <span className="battery-return-unit">Energy</span>
          </div>
        </div>
      </div>

      <div className="scan-prompt">
        <h1 className="scan-title">Scan New Battery</h1>
        <p className="scan-subtitle">Scan the fresh battery to give customer</p>
        
        {/* Bluetooth Required Notice */}
        <div className="bluetooth-notice">
          <div className="bluetooth-notice-icon">
            <Bluetooth size={20} />
          </div>
          <div className="bluetooth-notice-content">
            <span className="bluetooth-notice-title">Bluetooth Required</span>
            <span className="bluetooth-notice-text">
              Please ensure Bluetooth is turned ON on this device to read battery energy levels
            </span>
          </div>
        </div>
        
        <ScannerArea onClick={onScanNewBattery} type="battery" size="small" />
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          Battery energy will be read via Bluetooth
        </p>
      </div>
    </div>
  );
}
