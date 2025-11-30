'use client';

import React, { useState } from 'react';
import { SwapData } from '../types';

interface Step5Props {
  swapData: SwapData;
  onConfirmPayment: () => void;
  onManualPayment: (paymentId: string) => void;
  isProcessing: boolean;
}

export default function Step5Payment({ swapData, onConfirmPayment, onManualPayment, isProcessing }: Step5Props) {
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [paymentId, setPaymentId] = useState('');

  const handleManualConfirm = () => {
    if (paymentId.trim()) {
      onManualPayment(paymentId.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && paymentId.trim() && !isProcessing) {
      e.preventDefault();
      handleManualConfirm();
    }
  };

  return (
    <div className="screen active">
      {/* Amount to Collect */}
      <div className="cost-card" style={{ marginBottom: '8px' }}>
        <div className="cost-total" style={{ marginTop: 0 }}>
          <span className="cost-total-label">Amount to Collect</span>
          <span className="cost-total-value">KES {swapData.cost}</span>
        </div>
      </div>

      <div className="payment-scan">
        <h2 className="payment-title">Confirm Payment</h2>
        
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
          <div className="payment-input-mode">
            <p className="payment-subtitle">Scan customer&apos;s QR after payment</p>
            
            <div className="qr-scanner-area" onClick={onConfirmPayment}>
              <div className="qr-scanner-frame">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
            </div>
            
            <div className="payment-amount">KES {swapData.cost.toFixed(2)}</div>
            <div className="payment-status">Tap to scan customer QR</div>
          </div>
        ) : (
          <div className="payment-input-mode">
            <p className="payment-subtitle">Enter payment transaction ID</p>
            
            <div className="manual-entry-form">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Payment / Transaction ID</label>
                <input 
                  type="text" 
                  className="form-input manual-id-input" 
                  placeholder="e.g. TXN-892741 or M-PESA code"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px' }}
                onClick={handleManualConfirm}
                disabled={isProcessing || !paymentId.trim()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {isProcessing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
            
            <div className="payment-amount" style={{ marginTop: '8px' }}>KES {swapData.cost.toFixed(2)}</div>
            <p className="scan-hint" style={{ marginTop: '4px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Enter M-PESA code or receipt number
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
