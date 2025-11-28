'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';

interface Step2Props {
  onScanOldBattery: () => void;
}

export default function Step2OldBattery({ onScanOldBattery }: Step2Props) {
  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">Scan Old Battery</h1>
        <p className="scan-subtitle">Scan the battery the customer brought in</p>
        
        <ScannerArea onClick={onScanOldBattery} type="battery" size="small" />
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          Verify battery belongs to customer
        </p>
      </div>
    </div>
  );
}
