'use client';

import React from 'react';
import ScannerArea from '../ScannerArea';

interface Step1Props {
  inputMode: 'scan' | 'manual';
  setInputMode: (mode: 'scan' | 'manual') => void;
  manualSubscriptionId: string;
  setManualSubscriptionId: (id: string) => void;
  onScanCustomer: () => void;
  onManualLookup: () => void;
  isProcessing: boolean;
  stats: { today: number; thisWeek: number; successRate: number };
}

export default function Step1CustomerScan({
  inputMode,
  setInputMode,
  manualSubscriptionId,
  setManualSubscriptionId,
  onScanCustomer,
  onManualLookup,
  isProcessing,
  stats,
}: Step1Props) {
  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">Identify Customer</h1>
        
        {/* Toggle between Scan and Manual */}
        <div className="input-toggle">
          <button 
            className={`toggle-btn ${inputMode === 'scan' ? 'active' : ''}`}
            onClick={() => setInputMode('scan')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Scan QR
          </button>
          <button 
            className={`toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
            onClick={() => setInputMode('manual')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Enter ID
          </button>
        </div>
        
        {inputMode === 'scan' ? (
          <div className="customer-input-mode">
            <p className="scan-subtitle">Scan customer&apos;s QR code</p>
            <ScannerArea onClick={onScanCustomer} type="qr" />
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Customer shows their app QR code
            </p>
          </div>
        ) : (
          <div className="customer-input-mode">
            <p className="scan-subtitle">Enter Subscription ID manually</p>
            <div className="manual-entry-form">
              <div className="form-group">
                <label className="form-label">Subscription ID</label>
                <input 
                  type="text" 
                  className="form-input manual-id-input" 
                  placeholder="e.g. SUB-8847-KE"
                  value={manualSubscriptionId}
                  onChange={(e) => setManualSubscriptionId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px' }}
                onClick={onManualLookup}
                disabled={isProcessing}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                {isProcessing ? 'Looking up...' : 'Look Up Customer'}
              </button>
            </div>
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Find ID on customer&apos;s account or receipt
            </p>
          </div>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats.today}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.thisWeek}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.successRate}%</div>
          <div className="stat-label">Success</div>
        </div>
      </div>
    </div>
  );
}
