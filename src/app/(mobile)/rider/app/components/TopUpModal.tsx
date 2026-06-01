"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n';

// Mixx by Yas (Togo) merchant config. Placeholder values — swap for production
// when the real merchant code is issued. The USSD format below assumes the
// standard merchant-payment subtree on *155#; the in-app instructions also
// walk the rider through it step-by-step in case the pre-built code differs
// on their handset.
const MIXX_MERCHANT_CODE = '4321';
const MIXX_MERCHANT_NAME = 'OVES Energy';
const MIXX_USSD_ROOT = '*155#';

const formatFCFA = (amount: number): string => {
  // Group thousands with thin spaces (Togo / French convention): 2 500.
  return amount.toLocaleString('fr-FR').replace(/\s/g, ' ');
};

const buildMixxUssd = (amount: number): string =>
  `*155*1*${MIXX_MERCHANT_CODE}*${Math.floor(amount)}#`;

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  onConfirmTopUp: (amount: number, transactionId: string, paymentMethod: string) => Promise<void>;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ 
  isOpen, 
  onClose, 
  currency = '',
  onConfirmTopUp 
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<'amount' | 'payment' | 'confirm' | 'success'>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('mixx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number>(0);
  // Track which copy-button most recently fired, so we can flash a "Copié" check.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, value: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for WebViews without the modern clipboard API.
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1500);
    } catch (err) {
      console.warn('[TopUpModal] Clipboard copy failed:', err);
    }
  };

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
    setPaymentMethod('mixx');
    setConfirmedAmount(0);
    setIsProcessing(false);
    setCopiedKey(null);
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
                    {currency ? `${currency} ` : ''}{amount.toLocaleString()}
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
              <h3 className="topup-modal-title">{t('rider.payWithMixx') || 'Payez avec Mixx by Yas'}</h3>
              <button className="topup-modal-close" onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-body">
              {/* Amount to pay — most important info, big and copyable. */}
              <div className="topup-mixx-field">
                <span className="topup-mixx-label">{t('rider.amountToPay') || 'Montant à payer'}</span>
                <button
                  type="button"
                  className="topup-mixx-row topup-mixx-row-strong"
                  onClick={() => handleCopy('amount', String(Math.floor(confirmedAmount)))}
                  aria-label={t('rider.copyAmount') || 'Copy amount'}
                >
                  <span className="topup-mixx-value-strong">{formatFCFA(confirmedAmount)} F CFA</span>
                  {copiedKey === 'amount' ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              {/* Pre-built USSD — one tap copies, rider pastes into dialer. */}
              <div className="topup-mixx-field">
                <span className="topup-mixx-label">{t('rider.dialOnPhone') || 'Composez sur votre téléphone'}</span>
                <button
                  type="button"
                  className="topup-mixx-row"
                  onClick={() => handleCopy('ussd', buildMixxUssd(confirmedAmount))}
                  aria-label={t('rider.copyUssd') || 'Copy USSD code'}
                >
                  <span className="topup-mixx-value-mono">{buildMixxUssd(confirmedAmount)}</span>
                  {copiedKey === 'ussd' ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <span className="topup-mixx-hint">
                  {t('rider.ussdHint') || 'Ou suivez les étapes ci-dessous si le code ne fonctionne pas.'}
                </span>
              </div>

              {/* Step-by-step fallback for handsets where the pre-built USSD
                  isn't accepted. Walks through the standard Mixx merchant flow. */}
              <ol className="topup-mixx-steps">
                <li>
                  {t('rider.mixxStep1Prefix') || 'Composez'}{' '}
                  <button
                    type="button"
                    className="topup-mixx-inline-copy"
                    onClick={() => handleCopy('root', MIXX_USSD_ROOT)}
                  >
                    <span>{MIXX_USSD_ROOT}</span>
                    {copiedKey === 'root' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </li>
                <li>{t('rider.mixxStep2') || 'Choisissez « Paiement Marchand »'}</li>
                <li>
                  {t('rider.mixxStep3Prefix') || 'Code marchand :'}{' '}
                  <button
                    type="button"
                    className="topup-mixx-inline-copy"
                    onClick={() => handleCopy('merchant', MIXX_MERCHANT_CODE)}
                  >
                    <span>{MIXX_MERCHANT_CODE}</span>
                    {copiedKey === 'merchant' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                  {' '}({MIXX_MERCHANT_NAME})
                </li>
                <li>{(t('rider.mixxStep4') || 'Montant : {amount} F CFA').replace('{amount}', formatFCFA(confirmedAmount))}</li>
                <li>{t('rider.mixxStep5') || 'Validez avec votre code PIN Mixx'}</li>
                <li>{t('rider.mixxStep6') || 'Notez le code de transaction reçu par SMS'}</li>
              </ol>

              <div className="topup-modal-actions">
                <button className="btn btn-secondary" onClick={handleClose}>
                  {t('common.cancel') || 'Annuler'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep('confirm')}
                >
                  {t('rider.madePayment') || "J'ai effectué le paiement"}
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
                <div className="topup-confirm-value">{currency ? `${currency} ` : ''}{confirmedAmount.toLocaleString()}</div>
              </div>
              <div className="topup-confirm-info">
                <p className="topup-confirm-text">
                  {t('rider.addingAmount') || "You're adding"} {currency ? `${currency} ` : ''}{confirmedAmount.toLocaleString()}
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
                  {t('rider.confirmCheckboxPrefix') || 'I confirm that I have sent'} <strong>{currency ? `${currency} ` : ''}{confirmedAmount.toLocaleString()}</strong> {t('rider.confirmCheckboxSuffix') || 'to the specified account and the transaction ID above is correct.'}
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
                +{currency ? `${currency} ` : ''}{confirmedAmount.toLocaleString()}
              </div>
              <p className="topup-success-message">
                {t('rider.creditedDesc') || 'Your account has been credited successfully'}
              </p>
              <div className="topup-success-balance">
                <div className="topup-success-balance-label">{t('rider.newAccountBalance') || 'New Account Balance'}</div>
                <div className="topup-success-balance-value">{currency ? `${currency} ` : ''}{confirmedAmount.toLocaleString()}</div>
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

