"use client";

import React, { useState, useCallback } from 'react';
import { Zap, ChevronLeft, AlertCircle, Loader2, CheckCircle2, Wallet, Landmark, Smartphone } from 'lucide-react';
import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import {
  GET_SERVICE_PLAN_TEMPLATE,
  extractEnergyConfiguration,
  type ServicePlanTemplate,
  type ServiceConfiguration,
} from '@/lib/graphql/mutations';
import RiderPlans, { type RiderPlan } from './RiderPlans';

export type EnergyTopUpStep = 'select' | 'review' | 'payment' | 'confirm' | 'success';

export interface EnergyTopUpResult {
  success: boolean;
  error?: string;
}

export interface EnergyTopUpSubmitArgs {
  plan: RiderPlan;
  energyConfig: ServiceConfiguration | null;
  transactionId: string;
  paymentMethod: string;
}

interface RiderEnergyTopUpProps {
  currency?: string;
  /** Rider's authToken passed to RiderPlans for the catalog fetch. */
  token?: string | null;
  /** Called when the user backs out of the select step (return to home). */
  onExit: () => void;
  /** Submit handler — owns the ABS mutation. */
  onSubmit: (args: EnergyTopUpSubmitArgs) => Promise<EnergyTopUpResult>;
}

const PAYMENT_METHODS = [
  {
    key: 'mtn',
    nameKey: 'rider.mtnMobileMoney',
    nameFallback: 'MTN Mobile Money',
    phone: '+228 90 123 456',
    typeKey: 'rider.instantTransfer',
    typeFallback: 'Instant transfer',
    Icon: Smartphone,
  },
  {
    key: 'flooz',
    nameKey: 'rider.flooz',
    nameFallback: 'Flooz (Moov)',
    phone: '+228 97 654 321',
    typeKey: 'rider.instantTransfer',
    typeFallback: 'Instant transfer',
    Icon: Smartphone,
  },
  {
    key: 'bank',
    nameKey: 'rider.bankTransfer',
    nameFallback: 'Bank Transfer',
    phone: '0051234567890',
    typeKey: 'rider.processingTime',
    typeFallback: '1-2 business days',
    Icon: Landmark,
  },
] as const;

const RiderEnergyTopUp: React.FC<RiderEnergyTopUpProps> = ({
  currency = '',
  token,
  onExit,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<EnergyTopUpStep>('select');
  const [selectedPlan, setSelectedPlan] = useState<RiderPlan | null>(null);
  const [energyConfig, setEnergyConfig] = useState<ServiceConfiguration | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlan = useCallback(async (plan: RiderPlan) => {
    setSelectedPlan(plan);
    setStep('review');
    setQuotaLoading(true);
    setQuotaError(null);
    setEnergyConfig(null);

    // Try ABS `servicePlanTemplate` keyed by Odoo default_code. If the key
    // shape doesn't match, gracefully fall back to "quota unavailable"
    // rather than blocking the flow.
    try {
      const lookupId = plan.default_code || String(plan.productId);
      const result = await absApolloClient.query<{ servicePlanTemplate: ServicePlanTemplate | null }>({
        query: GET_SERVICE_PLAN_TEMPLATE,
        variables: { id: lookupId },
        fetchPolicy: 'network-only',
      });
      if (result.errors && result.errors.length > 0) {
        setQuotaError(result.errors[0].message || 'Failed to load plan quota');
      } else {
        const energy = extractEnergyConfiguration(result.data?.servicePlanTemplate);
        setEnergyConfig(energy);
        if (!energy) {
          setQuotaError(
            t('rider.energyTopUp.quotaUnavailable') ||
              'Could not load energy quota for this plan',
          );
        }
      }
    } catch (err: any) {
      console.error('[RiderEnergyTopUp] quota lookup failed', err);
      setQuotaError(
        t('rider.energyTopUp.quotaUnavailable') ||
          'Could not load energy quota for this plan',
      );
    } finally {
      setQuotaLoading(false);
    }
  }, [t]);

  const handleConfirm = useCallback(async () => {
    if (!selectedPlan || !transactionId.trim() || !paymentMethod) return;
    setIsProcessing(true);
    setSubmitError(null);
    try {
      const result = await onSubmit({
        plan: selectedPlan,
        energyConfig,
        transactionId: transactionId.trim(),
        paymentMethod,
      });
      if (result.success) {
        setStep('success');
      } else {
        setSubmitError(result.error || 'Top-up failed');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Top-up failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, energyConfig, transactionId, paymentMethod, onSubmit]);

  const handleBack = useCallback(() => {
    if (step === 'select') {
      onExit();
    } else if (step === 'review') {
      setStep('select');
    } else if (step === 'payment') {
      setStep('review');
    } else if (step === 'confirm') {
      setStep('payment');
    } else if (step === 'success') {
      onExit();
    }
  }, [step, onExit]);

  const energyKwh = energyConfig?.initialQuota ?? null;

  // Substep header shared by review/payment/confirm/success.
  const SubHeader: React.FC<{ title: string; showBack?: boolean }> = ({ title, showBack = true }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 0 16px',
      }}
    >
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('common.back') || 'Back'}
          className="qr-modal-close"
          style={{ width: 32, height: 32, flexShrink: 0 }}
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
  );

  // ── SELECT ─────────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <RiderPlans
        onSelectPlan={handleSelectPlan}
        defaultCurrency={currency}
        token={token || undefined}
      />
    );
  }

  // ── REVIEW ─────────────────────────────────────────────────────────
  if (step === 'review' && selectedPlan) {
    return (
      <div>
        <SubHeader title={t('rider.energyTopUp.reviewTitle') || 'Review plan'} />

        <div className="list-card">
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{selectedPlan.name}</div>
              <div className="list-card-secondary">{selectedPlan.default_code}</div>
              {selectedPlan.category && (
                <div className="list-card-meta">
                  <span>{selectedPlan.category}</span>
                </div>
              )}
            </div>
            <div className="list-card-actions">
              <span
                className="list-card-badge--info"
                style={{ fontSize: 14, padding: '6px 10px', fontWeight: 600 }}
              >
                {currency ? `${currency} ` : ''}
                {selectedPlan.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div
          className="list-card"
          style={{
            marginTop: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('rider.energyTopUp.energyOffered') || "Energy you'll receive"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {quotaLoading
                ? '…'
                : energyKwh !== null
                  ? `${energyKwh.toLocaleString()} kWh`
                  : t('rider.energyTopUp.quotaUnknown') || 'Quota unavailable'}
            </div>
          </div>
          {quotaLoading && <Loader2 size={18} className="animate-spin" />}
        </div>

        {quotaError && !quotaLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              background: 'var(--warning-soft, var(--accent-soft))',
              color: 'var(--warning, var(--text-secondary))',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              marginTop: 12,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{quotaError}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
            {t('common.back') || 'Back'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep('payment')}
            disabled={quotaLoading}
            style={{ flex: 1 }}
          >
            {t('common.continue') || 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── PAYMENT ────────────────────────────────────────────────────────
  if (step === 'payment' && selectedPlan) {
    return (
      <div>
        <SubHeader title={t('rider.paymentDetails') || 'Payment Details'} />

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: 0 }}>
          {t('rider.sendPaymentDesc') || 'Send payment to any of these accounts'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PAYMENT_METHODS.map((m) => {
            const isActive = paymentMethod === m.key;
            return (
              <div
                key={m.key}
                className="list-card"
                onClick={() => setPaymentMethod(m.key)}
                style={{
                  cursor: 'pointer',
                  borderColor: isActive ? 'var(--accent)' : undefined,
                  boxShadow: isActive ? '0 0 0 2px var(--accent-soft)' : undefined,
                }}
              >
                <div className="list-card-body">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginRight: 12,
                    }}
                  >
                    <m.Icon size={18} />
                  </div>
                  <div className="list-card-content">
                    <div className="list-card-primary">{t(m.nameKey) || m.nameFallback}</div>
                    <div className="list-card-secondary">{t(m.typeKey) || m.typeFallback}</div>
                    <div className="list-card-meta-mono" style={{ marginTop: 4 }}>
                      {m.phone}
                    </div>
                  </div>
                  {isActive && (
                    <div className="list-card-actions">
                      <CheckCircle2 size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            {t('rider.howToPay') || 'How to pay'}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              {t('rider.payStep1') || 'Send the exact amount to one of the accounts above'} (
              <strong style={{ color: 'var(--text-primary)' }}>
                {currency ? `${currency} ` : ''}
                {selectedPlan.price.toLocaleString()}
              </strong>
              )
            </li>
            <li>{t('rider.payStep2') || 'Note down your transaction/reference ID'}</li>
            <li>{t('rider.payStep3') || 'Tap "I\'ve Made Payment" below to confirm'}</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
            {t('common.back') || 'Back'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep('confirm')}
            disabled={!paymentMethod}
            style={{ flex: 1 }}
          >
            {t('rider.madePayment') || "I've Made Payment"}
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIRM ────────────────────────────────────────────────────────
  if (step === 'confirm' && selectedPlan) {
    return (
      <div>
        <SubHeader title={t('rider.confirmPayment') || 'Confirm Payment'} />

        <div
          className="list-card"
          style={{
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('rider.topUpAmount') || 'Top-up Amount'}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {currency ? `${currency} ` : ''}
            {selectedPlan.price.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {selectedPlan.name}
            {energyKwh !== null ? ` · ${energyKwh.toLocaleString()} kWh` : ''}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('rider.txnIdRef') || 'Transaction ID / Reference'}
          </label>
          <input
            type="text"
            className="qr-input"
            placeholder={t('rider.enterTxnId') || 'Enter transaction ID'}
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('rider.paymentMethodUsed') || 'Payment Method Used'}
          </label>
          <select
            className="qr-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="">{t('rider.selectPaymentMethod') || 'Select payment method'}</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {t(m.nameKey) || m.nameFallback}
              </option>
            ))}
          </select>
        </div>

        {submitError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              background: 'var(--error-soft, var(--bg-secondary))',
              color: 'var(--error, var(--text-primary))',
              border: '1px solid var(--error, var(--border))',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              marginTop: 12,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{submitError}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            {t('common.back') || 'Back'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!transactionId.trim() || !paymentMethod || isProcessing}
            style={{ flex: 1 }}
          >
            {isProcessing
              ? t('common.processing') || 'Processing...'
              : t('rider.confirmTopUp') || 'Confirm Top-Up'}
          </button>
        </div>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────
  if (step === 'success' && selectedPlan) {
    return (
      <div>
        <SubHeader title={t('rider.energyTopUp.success') || 'Energy credited'} showBack={false} />

        <div
          className="list-card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Zap size={36} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
            {energyKwh !== null
              ? `+${energyKwh.toLocaleString()} kWh`
              : `+${currency ? `${currency} ` : ''}${selectedPlan.price.toLocaleString()}`}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            {t('rider.energyTopUp.creditedDesc') ||
              'Your energy quota has been credited successfully'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onExit}
          style={{ width: '100%', marginTop: 24 }}
        >
          {t('rider.done') || 'Done'}
        </button>
      </div>
    );
  }

  return null;
};

export default RiderEnergyTopUp;
