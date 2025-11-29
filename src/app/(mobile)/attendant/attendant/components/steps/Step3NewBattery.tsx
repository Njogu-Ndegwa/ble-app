'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';
import { Bluetooth } from 'lucide-react';

interface Step3Props {
  onScanNewBattery: () => void;
}

export default function Step3NewBattery({ onScanNewBattery }: Step3Props) {
  return (
    <div className="screen active">
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
