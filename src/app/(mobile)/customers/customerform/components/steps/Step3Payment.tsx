'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PlanData,
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
}

export default function Step3Payment({ 
  formData, 
  selectedPlanId, 
  onConfirmPayment, 
  onManualPayment, 
  isProcessing,
  isScannerOpening = false,
  plans,
}: Step3Props) {
  const { t } = useI18n();
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [paymentId, setPaymentId] = useState('');

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  const amount = selectedPlan?.price || 0;
  const currencySymbol = selectedPlan?.currencySymbol || 'KES';

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
                {isProcessing ? t('sales.processing') : t('sales.confirmPayment')}
              </button>
            </div>
            
            <p className="scan-hint" style={{ marginTop: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              {t('sales.orEnterManually')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
