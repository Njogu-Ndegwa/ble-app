'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';
import { BatteryData, getBatteryClass } from '../types';

interface Step3Props {
  oldBattery: BatteryData | null;
  onScanNewBattery: () => void;
}

export default function Step3NewBattery({ oldBattery, onScanNewBattery }: Step3Props) {
  const chargeLevel = oldBattery?.chargeLevel || 0;
  const batteryClass = getBatteryClass(chargeLevel);

  return (
    <div className="screen active">
      {/* Compact Old Battery Card */}
      <div className="battery-return-card">
        <div className="battery-return-header">
          <span className="battery-return-label">OLD BATTERY</span>
          <span className="battery-return-status">Matched</span>
        </div>
        <div className="battery-return-content">
          <div className="battery-return-id">{oldBattery?.id || '---'}</div>
          <div className="battery-return-charge">
            <div className={`battery-return-icon ${batteryClass}`}>
              <div 
                className="battery-return-fill" 
                style={{ '--level': `${chargeLevel}%` } as React.CSSProperties}
              ></div>
            </div>
            <span className="battery-return-percent">{chargeLevel}%</span>
            <span className="battery-return-unit">Charge</span>
          </div>
        </div>
      </div>

      <div className="scan-prompt">
        <h1 className="scan-title">Scan New Battery</h1>
        <p className="scan-subtitle">Scan the fresh battery to give customer</p>
        
        <ScannerArea onClick={onScanNewBattery} type="battery" size="small" />
      </div>
    </div>
  );
}
