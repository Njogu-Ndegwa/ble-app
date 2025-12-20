'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from './ScannerArea';
import InputModeToggle from './InputModeToggle';
import { InputMode } from './types';

interface CustomerInfo {
  name: string;
  initials?: string;
  /** Subscription ID - primary identifier for the customer */
  subscriptionId?: string;
}

interface PaymentCollectionProps {
  /** Amount to be collected */
  amount: number;
  /** Currency symbol */
  currencySymbol?: string;
  /** Customer information for display */
  customer?: CustomerInfo | null;
  /** Input mode (scan or manual) */
  inputMode: InputMode;
  /** Callback when input mode changes */
  onInputModeChange: (mode: InputMode) => void;
  /** Payment ID for manual entry */
  paymentId: string;
  /** Callback when payment ID changes */
  onPaymentIdChange: (id: string) => void;
  /** Callback when scan is triggered */
  onScan?: () => void;
  /** Whether scanner is opening */
  isScannerOpening?: boolean;
  /** Whether processing is in progress */
  isProcessing?: boolean;
  /** Partial payment info */
  partialPayment?: {
    amountPaid: number;
    amountRemaining: number;
  } | null;
  /** Custom title */
  title?: string;
  /** Custom placeholder for manual input */
  placeholder?: string;
  /** Optional className */
  className?: string;
}

/**
 * PaymentCollection - Reusable payment collection component
 * 
 * Handles the common pattern of:
 * 1. Showing customer and amount
 * 2. Toggle between scan and manual entry
 * 3. QR scanner or text input
 * 4. Partial payment handling
 * 
 * Used in:
 * - Attendant Step 5: Collect Payment
 * - Sales Step 5: Confirm Payment
 * 
 * @example
 * <PaymentCollection
 *   amount={500}
 *   customer={{ name: "John Doe" }}
 *   inputMode={inputMode}
 *   onInputModeChange={setInputMode}
 *   paymentId={paymentId}
 *   onPaymentIdChange={setPaymentId}
 *   onScan={handleScan}
 * />
 */
export default function PaymentCollection({
  amount,
  currencySymbol = 'KES',
  customer,
  inputMode,
  onInputModeChange,
  paymentId,
  onPaymentIdChange,
  onScan,
  isScannerOpening = false,
  isProcessing = false,
  partialPayment,
  title,
  placeholder,
  className = '',
}: PaymentCollectionProps) {
  const { t } = useI18n();
  
  const displayTitle = title || t('attendant.collectPayment') || 'Collect Payment';
  const displayPlaceholder = placeholder || t('sales.enterTransactionId') || 'Enter transaction ID';
  
  const hasPartialPayment = partialPayment && partialPayment.amountPaid > 0;

  return (
    <div className={`payment-collection ${className}`}>
      {/* Compact Customer + Amount Header */}
      <div className="payment-header-compact">
        {customer?.subscriptionId && (
          <div className="payment-customer-mini">
            <span className="payment-subscription-id">{customer.subscriptionId}</span>
          </div>
        )}
        <div className="payment-amount-large">
          {currencySymbol} {amount.toLocaleString()}
        </div>
      </div>
      
      {/* Partial Payment Warning */}
      {hasPartialPayment && (
        <PartialPaymentBanner
          amountPaid={partialPayment.amountPaid}
          amountRemaining={partialPayment.amountRemaining}
          currencySymbol={currencySymbol}
        />
      )}

      <div className="payment-scan">
        <h2 className="payment-title">{displayTitle}</h2>
        
        <InputModeToggle
          mode={inputMode}
          onModeChange={onInputModeChange}
          scanLabel={t('attendant.scanQr') || 'Scan QR'}
          manualLabel={t('attendant.enterId') || 'Enter ID'}
          disabled={isProcessing}
        />
        
        {inputMode === 'scan' ? (
          <ScanModeContent
            onScan={onScan}
            isScannerOpening={isScannerOpening}
          />
        ) : (
          <ManualModeContent
            paymentId={paymentId}
            onPaymentIdChange={onPaymentIdChange}
            placeholder={displayPlaceholder}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ScanModeContent({
  onScan,
  isScannerOpening,
}: {
  onScan?: () => void;
  isScannerOpening: boolean;
}) {
  const { t } = useI18n();
  
  return (
    <div className="payment-input-mode">
      <p className="payment-subtitle">
        {t('attendant.scanPaymentQrCode') || 'Scan payment QR code'}
      </p>
      
      <ScannerArea 
        onClick={onScan || (() => {})} 
        type="qr" 
        disabled={isScannerOpening}
        label={t('common.tapToScan') || 'Tap to scan'}
      />
      
      <p className="scan-hint">
        <InfoIcon />
        {t('sales.scanPaymentQrCode') || 'Scan the payment QR code'}
      </p>
    </div>
  );
}

function ManualModeContent({
  paymentId,
  onPaymentIdChange,
  placeholder,
  isProcessing,
}: {
  paymentId: string;
  onPaymentIdChange: (id: string) => void;
  placeholder: string;
  isProcessing: boolean;
}) {
  const { t } = useI18n();
  
  return (
    <div className="payment-input-mode payment-input-mode-manual">
      <div className="manual-entry-form">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            {t('attendant.transactionCode') || 'Transaction Code'}
          </label>
          <input 
            type="text" 
            className="form-input manual-id-input" 
            placeholder={placeholder}
            value={paymentId}
            onChange={(e) => onPaymentIdChange(e.target.value)}
            autoComplete="off"
            disabled={isProcessing}
          />
        </div>
      </div>
      
      <p className="scan-hint">
        <InfoIcon />
        {t('sales.tapConfirmToProcess') || 'Tap confirm to process payment'}
      </p>
    </div>
  );
}

function PartialPaymentBanner({
  amountPaid,
  amountRemaining,
  currencySymbol,
}: {
  amountPaid: number;
  amountRemaining: number;
  currencySymbol: string;
}) {
  const { t } = useI18n();
  
  return (
    <div className="partial-payment-warning" style={{
      background: 'linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)',
      border: '1px solid #ffc107',
      borderRadius: '12px',
      padding: '16px',
      margin: '0 16px 16px 16px',
      textAlign: 'center',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '8px', 
        marginBottom: '8px' 
      }}>
        <WarningIcon />
        <span style={{ fontWeight: '600', color: '#856404', fontSize: '14px' }}>
          {t('attendant.partialPayment') || 'Partial Payment Received'}
        </span>
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px' 
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
            {t('attendant.amountPaid') || 'Paid'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#155724' }}>
            {currencySymbol} {amountPaid.toLocaleString()}
          </div>
        </div>
        <div style={{ width: '1px', height: '40px', background: '#ffc107' }} />
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
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

function InfoIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="#856404" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={{ width: '24px', height: '24px' }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
