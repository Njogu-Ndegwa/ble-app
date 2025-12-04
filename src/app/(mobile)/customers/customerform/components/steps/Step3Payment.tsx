'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
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
  onManualPayment: (paymentId: string) => void;
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
  // Input mode callback to inform parent (for action bar)
  onInputModeChange?: (mode: 'scan' | 'manual') => void;
}

export default function Step3Payment({ 
  formData, 
  selectedPlanId, 
  onConfirmPayment, 
  onManualPayment, 
  isProcessing,
  isScannerOpening = false,
  plans,
  selectedPackage = null,
  paymentIncomplete = false,
  amountPaid = 0,
  amountExpected = 0,
  amountRemaining = 0,
  onInputModeChange,
}: Step3Props) {
  const { t } = useI18n();
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [paymentId, setPaymentId] = useState('');
  
  // Notify parent when input mode changes
  const handleInputModeChange = (mode: 'scan' | 'manual') => {
    setInputMode(mode);
    onInputModeChange?.(mode);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate total amount: package + subscription
  const packagePrice = selectedPackage?.price || 0;
  const subscriptionPrice = selectedPlan?.price || 0;
  const amount = packagePrice + subscriptionPrice;
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';
  
  // Calculate payment progress percentage
  const paymentProgress = amountExpected > 0 ? Math.min((amountPaid / amountExpected) * 100, 100) : 0;

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
      {/* Compact Customer + Amount Header */}
      <div className="payment-header-compact">
        <div className="payment-customer-mini">
          <div className="payment-customer-avatar">{initials}</div>
          <span className="payment-customer-name">{customerName}</span>
        </div>
        <div className="payment-amount-large">{currencySymbol} {amount.toLocaleString()}</div>
      </div>

      {/* Incomplete Payment Status Panel */}
      {paymentIncomplete && amountPaid > 0 && (
        <div className="payment-status-panel payment-status-incomplete">
          <div className="payment-status-header">
            <AlertCircle className="payment-status-icon" size={20} />
            <span className="payment-status-title">{t('sales.incompletePayment') || 'Incomplete Payment'}</span>
          </div>
          
          <div className="payment-progress-container">
            <div className="payment-progress-bar">
              <div 
                className="payment-progress-fill"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
            <span className="payment-progress-percent">{Math.round(paymentProgress)}%</span>
          </div>
          
          <div className="payment-amounts-grid">
            <div className="payment-amount-item">
              <span className="payment-amount-label">{t('sales.amountPaid') || 'Amount Paid'}</span>
              <span className="payment-amount-value payment-amount-paid">
                {currencySymbol} {amountPaid.toLocaleString()}
              </span>
            </div>
            <div className="payment-amount-item">
              <span className="payment-amount-label">{t('sales.amountExpected') || 'Amount Expected'}</span>
              <span className="payment-amount-value">
                {currencySymbol} {amountExpected.toLocaleString()}
              </span>
            </div>
            <div className="payment-amount-item payment-amount-remaining-item">
              <span className="payment-amount-label">{t('sales.amountRemaining') || 'Amount Remaining'}</span>
              <span className="payment-amount-value payment-amount-remaining">
                {currencySymbol} {amountRemaining.toLocaleString()}
              </span>
            </div>
          </div>
          
          <p className="payment-status-hint">
            {t('sales.enterRemainingPayment') || 'Please enter another receipt for the remaining amount to continue.'}
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
            onClick={() => handleInputModeChange('scan')}
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
            onClick={() => handleInputModeChange('manual')}
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
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
              </div>
            </div>
            
            {/* Large Confirm Payment button - matches ScannerArea placement and prominence */}
            <button 
              className="confirm-payment-cta" 
              onClick={handleManualConfirm}
              disabled={isProcessing || !paymentId.trim()}
            >
              <div className="confirm-payment-cta-inner">
                <div className="confirm-payment-cta-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <span className="confirm-payment-cta-text">
                  {isProcessing ? t('sales.processing') : t('sales.confirmPayment')}
                </span>
              </div>
            </button>
            
            <p className="scan-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              {t('sales.tapToConfirmPayment')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
