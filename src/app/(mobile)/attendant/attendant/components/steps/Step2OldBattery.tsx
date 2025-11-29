'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';

interface Step2Props {
  onScanOldBattery: () => void;
  expectedBatteryId?: string;
  isFirstTimeCustomer?: boolean;
}

export default function Step2OldBattery({ onScanOldBattery, expectedBatteryId, isFirstTimeCustomer }: Step2Props) {
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
        
        <ScannerArea onClick={onScanOldBattery} type="battery" size="small" />
        
        {/* Show expected battery ID for returning customers */}
        {expectedBatteryId && !isFirstTimeCustomer && (
          <div className="expected-battery-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="16" height="10" rx="2"/>
              <path d="M22 11v2"/>
              <path d="M6 11v2"/>
            </svg>
            <div className="expected-battery-details">
              <span className="expected-label">Expected Battery</span>
              <span className="expected-id">...{expectedBatteryId.slice(-6)}</span>
            </div>
          </div>
        )}
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {isFirstTimeCustomer 
            ? 'Skip if no battery to return'
            : 'Verify battery belongs to customer'}
        </p>
      </div>
    </div>
  );
}
