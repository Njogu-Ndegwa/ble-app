"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronDown, AlertCircle, Loader2, Smartphone, Landmark } from 'lucide-react';
import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import {
  GET_SERVICE_PLAN_TEMPLATE,
  extractEnergyConfiguration,
  type ServicePlanTemplate,
  type ServiceConfiguration,
} from '@/lib/graphql/mutations';
import { getSubscriptionProducts } from '@/lib/odoo-api';
import { SelectSheet } from '@/components/ui';

export type EnergyTopUpStep = 'payment' | 'success';

export interface EnergyTopUpResult {
  success: boolean;
  error?: string;
}

export interface EnergyTopUpSubmitArgs {
  plan: PlanOption;
  energyConfig: ServiceConfiguration | null;
  transactionId: string;
  paymentMethod: string;
}

interface PlanOption {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  category?: string;
}

interface EnergyTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  token?: string | null;
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

const EnergyTopUpModal: React.FC<EnergyTopUpModalProps> = ({
  isOpen,
  onClose,
  currency = '',
  token,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<EnergyTopUpStep>('payment');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [energyConfig, setEnergyConfig] = useState<ServiceConfiguration | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch service plans when modal opens (only `products`, not packages)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const res = await getSubscriptionProducts(1, 50, token || undefined);
        if (cancelled) return;
        const list = [
          ...(res.data?.products || []),
        ].map<PlanOption>((p) => ({
          name: p.name,
          price: p.list_price,
          productId: p.id,
          default_code: p.default_code || `P-${p.id}`,
          category: p.category_name || p.pu_category || undefined,
        }));
        setPlans(list);
      } catch (err: any) {
        if (!cancelled) {
          setPlansError(err?.message || 'Failed to load plans');
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };
    fetchPlans();
    return () => { cancelled = true; };
  }, [isOpen, token]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('payment');
      setSelectedPlan(null);
      setEnergyConfig(null);
      setQuotaError(null);
      setPaymentMethod('');
      setTransactionId('');
      setSubmitError(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handlePlanSelect = useCallback(async (plan: PlanOption) => {
    setSelectedPlan(plan);
    setEnergyConfig(null);
    setQuotaError(null);

    setQuotaLoading(true);
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
            t('rider.energyTopUp.quotaUnavailable') || 'Could not load energy quota for this plan',
          );
        }
      }
    } catch {
      setQuotaError(
        t('rider.energyTopUp.quotaUnavailable') || 'Could not load energy quota for this plan',
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

  if (!isOpen) return null;

  const energyKwh = energyConfig?.initialQuota ?? null;

  const selectedPlanLabel = selectedPlan
    ? `${selectedPlan.name} — ${currency ? `${currency} ` : ''}${selectedPlan.price.toLocaleString()}`
    : '';

  const selectedMethodLabel = paymentMethod
    ? (PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.nameFallback || paymentMethod)
    : '';

  return (
    <>
      <div
        className="select-sheet-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="select-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="select-sheet-handle" aria-hidden="true" />

          {/* Header */}
          <div className="select-sheet-head">
            <div className="select-sheet-title">
              {step === 'success'
                ? (t('rider.energyTopUp.success') || 'Energy Credited')
                : (t('rider.topUpEnergy') || 'Top Up Energy')}
            </div>
            <button className="select-sheet-close" onClick={onClose} aria-label={t('common.close') || 'Close'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="select-sheet-body">
            {/* ── STEP: PAYMENT (merged with confirm) ──────────────── */}
            {step === 'payment' && (
              <div style={{ padding: '4px 0' }}>
                {/* Plan Selector */}
                <div style={{ marginBottom: 16 }}>
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
                    {t('rider.energyTopUp.selectPlan') || 'Select Service Plan'}
                  </label>
                  <button
                    type="button"
                    className="qr-input"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      color: selectedPlan ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                    onClick={() => setShowPlanSheet(true)}
                    disabled={plansLoading}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plansLoading
                        ? (t('common.loading') || 'Loading...')
                        : selectedPlanLabel || (t('rider.energyTopUp.choosePlan') || 'Choose a plan')}
                    </span>
                    <ChevronDown size={16} style={{ flexShrink: 0 }} />
                  </button>
                  {plansError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--error, #ef4444)' }}>
                      <AlertCircle size={12} />
                      <span>{plansError}</span>
                    </div>
                  )}
                </div>

                {/* Energy Quota Display */}
                {selectedPlan && (
                  <div
                    className="list-card"
                    style={{
                      marginBottom: 16,
                      padding: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
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
                      }}
                    >
                      <Zap size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('rider.energyTopUp.energyOffered') || "Energy you'll receive"}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                        {quotaLoading
                          ? '...'
                          : energyKwh !== null
                            ? `${energyKwh.toLocaleString()} kWh`
                            : (t('rider.energyTopUp.quotaUnknown') || 'Quota unavailable')}
                      </div>
                    </div>
                    {quotaLoading && <Loader2 size={16} className="animate-spin" />}
                  </div>
                )}

                {quotaError && !quotaLoading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: 10,
                      background: 'var(--warning-soft, var(--accent-soft))',
                      color: 'var(--warning, var(--text-secondary))',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      marginBottom: 16,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{quotaError}</span>
                  </div>
                )}

                {/* Read-only Payment Methods */}
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('rider.paymentDetails') || 'Payment Details'}
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <div
                      key={m.key}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <m.Icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t(m.nameKey) || m.nameFallback}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {t(m.typeKey) || m.typeFallback}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{m.key === 'bank' ? (t('attendant.accountNumber') || 'Account Number') : (t('rider.phone') || 'Phone')}</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono, "DM Mono", monospace)' }}>
                          {m.phone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* How to pay */}
                {selectedPlan && (
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                      {t('rider.howToPay') || 'How to pay'}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>
                        {t('rider.payStep1') || 'Send the exact amount to one of the accounts above'} (
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {currency ? `${currency} ` : ''}{selectedPlan.price.toLocaleString()}
                        </strong>)
                      </li>
                      <li>{t('rider.payStep2') || 'Note down your transaction/reference ID'}</li>
                      <li>{t('rider.payStep3') || 'Fill in the details below and confirm'}</li>
                    </ol>
                  </div>
                )}

                {/* Transaction ID */}
                <div style={{ marginBottom: 14 }}>
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

                {/* Payment method selector */}
                <div style={{ marginBottom: 16 }}>
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
                  <button
                    type="button"
                    className="qr-input"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      color: paymentMethod ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                    onClick={() => setShowPaymentSheet(true)}
                  >
                    <span>{selectedMethodLabel || t('rider.selectPaymentMethod') || 'Select payment method'}</span>
                    <ChevronDown size={16} style={{ flexShrink: 0 }} />
                  </button>
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
                      marginBottom: 12,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={!selectedPlan || !transactionId.trim() || !paymentMethod || isProcessing}
                  style={{ width: '100%' }}
                >
                  {isProcessing
                    ? (t('common.processing') || 'Processing...')
                    : (t('rider.madePayment') || "I've Made Payment")}
                </button>
              </div>
            )}

            {/* ── STEP: SUCCESS ─────────────────────────────────────── */}
            {step === 'success' && selectedPlan && (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                  }}
                >
                  <Zap size={32} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {energyKwh !== null
                    ? `+${energyKwh.toLocaleString()} kWh`
                    : `+${currency ? `${currency} ` : ''}${selectedPlan.price.toLocaleString()}`}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {t('rider.energyTopUp.creditedDesc') || 'Your energy quota has been credited successfully'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ width: '100%', marginTop: 20 }}
                >
                  {t('rider.done') || 'Done'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan SelectSheet */}
      <SelectSheet
        isOpen={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        title={t('rider.energyTopUp.selectPlan') || 'Select Service Plan'}
        activeValue={selectedPlan ? String(selectedPlan.productId) : null}
        loading={plansLoading}
        error={plansError}
        searchable={plans.length > 6}
        items={plans.map((p) => ({
          value: String(p.productId),
          label: p.name,
          description: p.category || p.default_code,
          meta: `${currency ? `${currency} ` : ''}${p.price.toLocaleString()}`,
        }))}
        onSelect={(item) => {
          const plan = plans.find((p) => String(p.productId) === item.value);
          if (plan) handlePlanSelect(plan);
        }}
      />

      {/* Payment method SelectSheet */}
      <SelectSheet
        isOpen={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        title={t('rider.paymentMethodUsed') || 'Payment Method'}
        activeValue={paymentMethod}
        items={PAYMENT_METHODS.map((m) => ({
          value: m.key,
          label: t(m.nameKey) || m.nameFallback,
          description: t(m.typeKey) || m.typeFallback,
        }))}
        onSelect={(item) => setPaymentMethod(item.value as string)}
      />
    </>
  );
};

export default EnergyTopUpModal;
