'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PlanData,
  PackageData,
  getInitials 
} from '../types';
import ScannerArea from '@/app/(mobile)/attendant/attendant/components/ScannerArea';

interface Step3Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  onConfirmPayment: () => void;
  isProcessing: boolean;
  isScannerOpening?: boolean; // Prevents multiple scanner opens
  plans: PlanData[];  // Plans from Odoo API - required
  // Package data for total calculation
  selectedPackage?: PackageData | null;
  // Payment status props for incomplete payments
  paymentIncomplete?: boolean;
  amountPaid?: number;
  amountExpected?: number;
  amountRemaining?: number;
  // Input mode managed by parent (like Attendant flow)
  inputMode: 'scan' | 'manual';
  setInputMode: (mode: 'scan' | 'manual') => void;
  // Payment ID managed by parent (like Attendant flow)
  paymentId: string;
  setPaymentId: (id: string) => void;
}

export default function Step3Payment({ 
  formData, 
  selectedPlanId, 
  onConfirmPayment, 
  isProcessing,
  isScannerOpening = false,
  plans,
  selectedPackage = null,
  paymentIncomplete = false,
  amountPaid = 0,
  amountExpected = 0,
  amountRemaining = 0,
  inputMode,
  setInputMode,
  paymentId,
  setPaymentId,
}: Step3Props) {
  const { t } = useI18n();

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate total amount: package + subscription
  const packagePrice = selectedPackage?.price || 0;
  const subscriptionPrice = selectedPlan?.price || 0;
  const amount = packagePrice + subscriptionPrice;
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';
  
  return (
    <div className="screen active">
      {/* Compact Customer + Amount Header */}
      <div className="payment-header-compact">
        <div className="payment-customer-mini">
          <div className="payment-customer-avatar">{initials}</div>
          <span className="payment-customer-name">{customerName}</span>
        </div>
        <div className="payment-amount-large">{currencySymbol} {amount.toLocaleString()}</div>
      </div>

      {/* Partial Payment Warning - shown when customer has paid part of the amount */}
      {paymentIncomplete && amountPaid > 0 && (
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
                {currencySymbol} {amountPaid.toLocaleString()}
              </div>
            </div>
            <div style={{ width: '1px', height: '40px', background: '#ffc107' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                {t('attendant.amountRemaining') || 'Remaining'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc3545' }}>
                {currencySymbol} {amountRemaining.toLocaleString()}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#856404', marginTop: '12px', marginBottom: 0 }}>
            {t('attendant.collectRemainingAmount') || 'Please collect the remaining amount before continuing.'}
          </p>
        </div>
      )}

      <div className="payment-scan">
        <h2 className="payment-title">{t('sales.confirmPayment')}</h2>
        <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>
          {selectedPlan?.name || 'Subscription'} - {t('sales.paymentTitle')}
        </p>
        
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
            <p className="payment-subtitle">{t('sales.scanMpesaQr')}</p>
            
            <ScannerArea onClick={onConfirmPayment} type="qr" disabled={isScannerOpening} />
            
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
                <label className="form-label">{t('sales.transactionId')}</label>
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
