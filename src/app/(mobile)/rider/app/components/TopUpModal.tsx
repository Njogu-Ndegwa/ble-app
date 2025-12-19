"use client";

import React, { useState } from 'react';
import { useI18n } from '@/i18n';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  onConfirmTopUp: (amount: number, transactionId: string, paymentMethod: string) => Promise<void>;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ 
  isOpen, 
  onClose, 
  currency = 'XOF',
  onConfirmTopUp 
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<'amount' | 'payment' | 'confirm' | 'success'>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number>(0);

  const presetAmounts = [1000, 2000, 5000, 10000, 20000];

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const getFinalAmount = (): number => {
    if (selectedAmount) return selectedAmount;
    const custom = parseFloat(customAmount);
    return isNaN(custom) ? 0 : custom;
  };

  const handleContinue = () => {
    const amount = getFinalAmount();
    if (amount > 0) {
      setConfirmedAmount(amount);
      setStep('payment');
    }
  };

  const handlePaymentMethodSelect = (method: string) => {
    setPaymentMethod(method);
    setStep('confirm');
  };

  const handleConfirmTopUp = async () => {
    if (!transactionId.trim() || !paymentMethod) return;
    
    setIsProcessing(true);
    try {
      await onConfirmTopUp(confirmedAmount, transactionId.trim(), paymentMethod);
      setStep('success');
    } catch (error) {
      console.error('Top-up error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('amount');
    setSelectedAmount(null);
    setCustomAmount('');
    setTransactionId('');
    setPaymentMethod('');
    setConfirmedAmount(0);
    setIsProcessing(false);
    onClose();
  };

  const handleBack = () => {
    if (step === 'payment') {
      setStep('amount');
    } else if (step === 'confirm') {
      setStep('payment');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={(e) => {
      if (e.target === e.currentTarget && step === 'amount') handleClose();
    }}>
      <div className="topup-modal">
        {step === 'amount' && (
          <>
            <div className="topup-modal-header">
              <h3 className="topup-modal-title">{t('rider.topUpAccount') || 'Top Up Account'}</h3>
              <button className="topup-modal-close" onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-body">
              <h4 className="topup-section-title">{t('rider.selectAmount') || 'Select Amount'}</h4>
              <p className="topup-section-subtitle">{t('rider.chooseAmountDesc') || 'Choose how much you want to top up'}</p>
              <div className="topup-amount-grid">
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    className={`topup-amount-btn ${selectedAmount === amount ? 'active' : ''}`}
                    onClick={() => handleAmountSelect(amount)}
                  >
                    {currency} {amount.toLocaleString()}
                  </button>
                ))}
                <div className="topup-amount-custom">
                  <input
                    type="number"
                    className="topup-custom-input"
                    placeholder={t('rider.custom') || 'Custom'}
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
              <div className="topup-modal-actions">
                <button className="btn btn-secondary" onClick={handleClose}>
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleContinue}
                  disabled={getFinalAmount() <= 0}
                >
                  {t('common.continue') || 'Continue'}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="topup-modal-header">
              <button className="topup-modal-back" onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h3 className="topup-modal-title">{t('rider.topUpAccount') || 'Top Up Account'}</h3>
              <button className="topup-modal-close" onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-body">
              <h4 className="topup-section-title">{t('rider.paymentDetails') || 'Payment Details'}</h4>
              <p className="topup-section-subtitle">{t('rider.sendPaymentDesc') || 'Send payment to any of these accounts'}</p>
              <div className="topup-payment-methods">
                <div className="topup-payment-method" onClick={() => handlePaymentMethodSelect('mtn')}>
                  <div className="topup-payment-header">
                    <div className="topup-payment-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="topup-payment-info">
                      <div className="topup-payment-name">{t('rider.mtnMobileMoney') || 'MTN Mobile Money'}</div>
                      <div className="topup-payment-type">{t('rider.instantTransfer') || 'Instant transfer'}</div>
                    </div>
                  </div>
                  <div className="topup-payment-details">
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('rider.phone') || 'Phone Number'}</span>
                      <span className="topup-payment-value">+228 90 123 456</span>
                    </div>
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('rider.accountName') || 'Account Name'}</span>
                      <span className="topup-payment-value">OVES Energy Ltd</span>
                    </div>
                  </div>
                </div>
                <div className="topup-payment-method" onClick={() => handlePaymentMethodSelect('flooz')}>
                  <div className="topup-payment-header">
                    <div className="topup-payment-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="topup-payment-info">
                      <div className="topup-payment-name">{t('rider.flooz') || 'Flooz (Moov)'}</div>
                      <div className="topup-payment-type">{t('rider.instantTransfer') || 'Instant transfer'}</div>
                    </div>
                  </div>
                  <div className="topup-payment-details">
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('rider.phone') || 'Phone Number'}</span>
                      <span className="topup-payment-value">+228 97 654 321</span>
                    </div>
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('rider.accountName') || 'Account Name'}</span>
                      <span className="topup-payment-value">OVES Energy Ltd</span>
                    </div>
                  </div>
                </div>
                <div className="topup-payment-method" onClick={() => handlePaymentMethodSelect('bank')}>
                  <div className="topup-payment-header">
                    <div className="topup-payment-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="topup-payment-info">
                      <div className="topup-payment-name">{t('rider.bankTransfer') || 'Bank Transfer'}</div>
                      <div className="topup-payment-type">{t('rider.processingTime') || '1-2 business days'}</div>
                    </div>
                  </div>
                  <div className="topup-payment-details">
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('attendant.bankName') || 'Bank Name'}</span>
                      <span className="topup-payment-value">Ecobank Togo</span>
                    </div>
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('attendant.accountNumber') || 'Account Number'}</span>
                      <span className="topup-payment-value">0051234567890</span>
                    </div>
                    <div className="topup-payment-detail">
                      <span className="topup-payment-label">{t('rider.accountName') || 'Account Name'}</span>
                      <span className="topup-payment-value">OVES Energy Ltd</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="topup-instructions">
                <h5 className="topup-instructions-title">{t('rider.howToPay') || 'How to pay'}</h5>
                <ol className="topup-instructions-list">
                  <li>{t('rider.payStep1') || 'Send the exact amount to one of the accounts above'}</li>
                  <li>{t('rider.payStep2') || 'Note down your transaction/reference ID'}</li>
                  <li>{t('rider.payStep3') || 'Click "I\'ve Made Payment" below to confirm'}</li>
                </ol>
              </div>
              <div className="topup-modal-actions">
                <button className="btn btn-secondary" onClick={handleClose}>
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setStep('confirm')}
                  disabled={!paymentMethod}
                >
                  {t('rider.madePayment') || 'I\'ve Made Payment'}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="topup-modal-header">
              <button className="topup-modal-back" onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h3 className="topup-modal-title">{t('rider.confirmPayment') || 'Confirm Payment'}</h3>
              <button className="topup-modal-close" onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-body">
              <div className="topup-confirm-amount">
                <div className="topup-confirm-label">{t('rider.topUpAmount') || 'Top-up Amount'}</div>
                <div className="topup-confirm-value">{currency} {confirmedAmount.toLocaleString()}</div>
              </div>
              <div className="topup-confirm-info">
                <p className="topup-confirm-text">
                  {t('rider.addingAmount') || 'You\'re adding'} {currency} {confirmedAmount.toLocaleString()}
                </p>
              </div>
              <div className="topup-input-group">
                <label className="topup-input-label">{t('rider.txnIdRef') || 'Transaction ID / Reference'}</label>
                <input
                  type="text"
                  className="topup-input"
                  placeholder={t('rider.enterTxnId') || 'Enter transaction ID'}
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
              <div className="topup-input-group">
                <label className="topup-input-label">{t('rider.paymentMethodUsed') || 'Payment Method Used'}</label>
                <select
                  className="topup-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">{t('rider.selectPaymentMethod') || 'Select payment method'}</option>
                  <option value="mtn">{t('rider.mtnMobileMoney') || 'MTN Mobile Money'}</option>
                  <option value="flooz">{t('rider.flooz') || 'Flooz (Moov)'}</option>
                  <option value="bank">{t('rider.bankTransfer') || 'Bank Transfer'}</option>
                </select>
              </div>
              <div className="topup-confirm-checkbox">
                <input
                  type="checkbox"
                  id="topup-confirm"
                  checked={transactionId.trim().length > 0 && paymentMethod.length > 0}
                  onChange={() => {}}
                />
                <label htmlFor="topup-confirm">
                  {t('rider.confirmCheckboxPrefix') || 'I confirm that I have sent'} <strong>{currency} {confirmedAmount.toLocaleString()}</strong> {t('rider.confirmCheckboxSuffix') || 'to the specified account and the transaction ID above is correct.'}
                </label>
              </div>
              <div className="topup-modal-actions">
                <button className="btn btn-secondary" onClick={handleBack}>
                  {t('common.back') || 'Back'}
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConfirmTopUp}
                  disabled={!transactionId.trim() || !paymentMethod || isProcessing}
                >
                  {isProcessing ? t('common.processing') || 'Processing...' : t('rider.confirmPayment') || 'Confirm Top-Up'}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="topup-modal-header">
              <div></div>
              <h3 className="topup-modal-title">{t('rider.topUpSuccessful') || 'Top-Up Successful!'}</h3>
              <button className="topup-modal-close" onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-body">
              <div className="topup-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="topup-success-amount">
                +{currency} {confirmedAmount.toLocaleString()}
              </div>
              <p className="topup-success-message">
                {t('rider.creditedDesc') || 'Your account has been credited successfully'}
              </p>
              <div className="topup-success-balance">
                <div className="topup-success-balance-label">{t('rider.newAccountBalance') || 'New Account Balance'}</div>
                <div className="topup-success-balance-value">{currency} {confirmedAmount.toLocaleString()}</div>
              </div>
              <button className="btn btn-primary" onClick={handleClose} style={{ width: '100%', marginTop: 24 }}>
                {t('rider.done') || 'Done'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TopUpModal;

