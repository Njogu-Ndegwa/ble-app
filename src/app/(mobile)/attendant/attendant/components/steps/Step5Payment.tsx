'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SwapData, CustomerData, getInitials } from '../types';

interface Step5Props {
  swapData: SwapData;
  customerData?: CustomerData | null;
  isProcessing: boolean;
  inputMode: 'scan' | 'manual';
  setInputMode: (mode: 'scan' | 'manual') => void;
  paymentId: string;
  setPaymentId: (id: string) => void;
}

export default function Step5Payment({ 
  swapData, 
  customerData, 
  isProcessing, 
  inputMode, 
  setInputMode, 
  paymentId, 
  setPaymentId 
}: Step5Props) {
  const { t } = useI18n();

  return (
    <div className="screen active">
      {/* Compact Customer + Amount Header */}
      <div className="payment-header-compact">
        {customerData && (
          <div className="payment-customer-mini">
            <div className="payment-customer-avatar">{getInitials(customerData.name)}</div>
            <span className="payment-customer-name">{customerData.name}</span>
          </div>
        )}
        <div className="payment-amount-large">KES {swapData.cost}</div>
      </div>

      <div className="payment-scan">
        <h2 className="payment-title">{t('attendant.collectPayment')}</h2>
        
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
            {t('attendant.scanQr')}
          </button>
          <button 
            className={`toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
            onClick={() => setInputMode('manual')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {t('attendant.enterId')}
          </button>
        </div>
        
        {inputMode === 'scan' ? (
          <div className="payment-input-mode">
            <p className="payment-subtitle">{t('attendant.enterMpesaCode')}</p>
            
            {/* Visual QR Scanner indicator - action triggered by Confirm Payment button in ActionBar */}
            <div className="scanner-area qr-scanner-visual">
              <div className="scanner-area-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <span className="scanner-area-text">{t('attendant.tapConfirmToScan')}</span>
            </div>
            
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              {t('sales.scanPaymentQrCode')}
            </p>
          </div>
        ) : (
          <div className="payment-input-mode payment-input-mode-manual">
            <div className="manual-entry-form">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('attendant.mpesaCode')}</label>
                <input 
                  type="text" 
                  className="form-input manual-id-input" 
                  placeholder={t('sales.enterTransactionId')}
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  autoComplete="off"
                  disabled={isProcessing}
                />
              </div>
            </div>
            
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              {t('sales.tapConfirmToProcess')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
