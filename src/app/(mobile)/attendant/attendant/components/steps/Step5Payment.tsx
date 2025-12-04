'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SwapData, CustomerData, getInitials } from '../types';
import ScannerArea from '../ScannerArea';

interface Step5Props {
  swapData: SwapData;
  customerData?: CustomerData | null;
  isProcessing: boolean;
  inputMode: 'scan' | 'manual';
  setInputMode: (mode: 'scan' | 'manual') => void;
  paymentId: string;
  setPaymentId: (id: string) => void;
  onScanPayment?: () => void;
  isScannerOpening?: boolean;
  amountRemaining?: number; // Amount still to be paid (from Odoo response)
  amountPaid?: number; // Amount already paid (from Odoo response)
}

export default function Step5Payment({ 
  swapData, 
  customerData, 
  isProcessing, 
  inputMode, 
  setInputMode, 
  paymentId, 
  setPaymentId,
  onScanPayment,
  isScannerOpening = false,
  amountRemaining = 0,
  amountPaid = 0,
}: Step5Props) {
  const { t } = useI18n();

  // Show remaining amount if there's a partial payment
  const hasPartialPayment = amountRemaining > 0 && amountPaid > 0;

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
      
      {/* Partial Payment Warning - shown when customer has paid part of the amount */}
      {hasPartialPayment && (
        <div className="partial-payment-warning" style={{
          background: 'linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)',
          border: '1px solid #ffc107',
          borderRadius: '12px',
          padding: '16px',
          margin: '0 16px 16px 16px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#856404" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontWeight: '600', color: '#856404', fontSize: '14px' }}>
              {t('attendant.partialPayment') || 'Partial Payment Received'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                {t('attendant.amountPaid') || 'Paid'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#155724' }}>
                KES {amountPaid}
              </div>
            </div>
            <div style={{ width: '1px', height: '40px', background: '#ffc107' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                {t('attendant.amountRemaining') || 'Remaining'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc3545' }}>
                KES {amountRemaining}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#856404', marginTop: '12px', marginBottom: 0 }}>
            {t('attendant.collectRemainingAmount') || 'Please collect the remaining amount before continuing.'}
          </p>
        </div>
      )}

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
            
            {/* Uses ScannerArea component for consistent QR icon design across all steps */}
            <ScannerArea 
              onClick={onScanPayment || (() => {})} 
              type="qr" 
              disabled={isScannerOpening} 
            />
            
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
