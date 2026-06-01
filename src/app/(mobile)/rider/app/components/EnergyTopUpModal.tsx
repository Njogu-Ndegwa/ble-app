// trigger CI
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronDown, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import {
  GET_SERVICE_PLAN_TEMPLATE,
  extractEnergyConfiguration,
  type ServicePlanTemplate,
  type ServiceConfiguration,
} from '@/lib/graphql/mutations';
import {
  getSubscriptionProducts,
  createWorkflowSession,
  updateWorkflowSessionWithProducts,
  confirmPaymentManual,
  type WorkflowSessionData,
} from '@/lib/odoo-api';
import { SelectSheet } from '@/components/ui';
import { InputModeToggle, WeChatPayment } from '@/components/shared';
import type { InputMode } from '@/components/shared/types';

// Mixx by Yas (Togo) merchant config. Placeholder values — swap for production
// when the real merchant code is issued. The USSD format below assumes the
// standard merchant-payment subtree on *155#; the in-app instructions also
// walk the rider through it step-by-step in case the pre-built code differs
// on their handset.
const MIXX_MERCHANT_CODE = '4321';
const MIXX_MERCHANT_NAME = 'OVES Energy';
const MIXX_USSD_ROOT = '*155#';

const formatFCFA = (amount: number): string => {
  // Thin-space grouping per Togo/French convention: 2 500.
  return amount.toLocaleString('fr-FR').replace(/\s/g, ' ');
};

const buildMixxUssd = (amount: number): string =>
  `*155*1*${MIXX_MERCHANT_CODE}*${Math.floor(amount)}#`;

export type EnergyTopUpStep = 'plan' | 'payment' | 'success';

export interface EnergyTopUpResult {
  success: boolean;
  error?: string;
}

export interface EnergyTopUpSubmitArgs {
  plan: PlanOption;
  energyConfig: ServiceConfiguration | null;
  transactionId: string;
  paymentMethod: string;
  orderId: number | null;
  /** Authoritative amount paid, as confirmed by Odoo's confirmPaymentManual. */
  totalPaid: number;
}

interface PlanOption {
  name: string;
  description?: string;
  price: number;
  productId: number;
  default_code: string;
  category?: string;
  // Canonical service-plan template identifier returned by Odoo. Use this to
  // look up quota — the product's display `name` can drift (extra spaces,
  // translations) from the template id the GraphQL endpoint expects.
  templateId?: string;
}

interface EnergyTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  token?: string | null;
  subscriptionCode?: string | null;
  onSubmit: (args: EnergyTopUpSubmitArgs) => Promise<EnergyTopUpResult>;
}

const EnergyTopUpModal: React.FC<EnergyTopUpModalProps> = ({
  isOpen,
  onClose,
  currency = '',
  token,
  subscriptionCode,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<EnergyTopUpStep>('plan');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [energyConfig, setEnergyConfig] = useState<ServiceConfiguration | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // Payment state
  const [paymentMode, setPaymentMode] = useState<InputMode>('manual');
  const [transactionId, setTransactionId] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Flashes a "Copied" check next to whichever Mixx field was last copied.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = useCallback(async (key: string, value: string) => {
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
      console.warn('[EnergyTopUpModal] Clipboard copy failed:', err);
    }
  }, []);

  // Fetch plans when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const res = await getSubscriptionProducts(1, 50, token || undefined);
        if (cancelled) return;
        const list = (res.data?.products || []).map<PlanOption>((p) => ({
          name: p.name,
          description: p.description || undefined,
          price: p.list_price,
          productId: p.id,
          default_code: p.default_code || `P-${p.id}`,
          category: p.category_name || p.pu_category || undefined,
          templateId: p.x_template_id || undefined,
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
      setStep('plan');
      setSelectedPlan(null);
      setEnergyConfig(null);
      setQuotaError(null);
      setPaymentMode('manual');
      setTransactionId('');
      setOrderId(null);
      setIsCreatingOrder(false);
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
      // Prefer the canonical template id from Odoo; fall back to product name
      // for older products that haven't been migrated to x_template_id yet.
      const lookupId = plan.templateId || plan.name;
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

  // Create order via /api/subscription/purchase, add product line, then move to payment step
  const handleProceedToPayment = useCallback(async () => {
    if (!selectedPlan || !subscriptionCode) return;

    setIsCreatingOrder(true);
    setSubmitError(null);

    try {
      const amountRequired = Math.floor(selectedPlan.price);

      // Step 1: Create order + session via /api/subscription/purchase
      const sessionData: WorkflowSessionData = {
        status: 'in_progress',
        workflowType: 'attendant',
        currentStep: 1,
        maxStepReached: 1,
      };

      const sessionResponse = await createWorkflowSession({
        subscription_code: subscriptionCode,
        session_data: sessionData,
      }, token || undefined);

      if (!sessionResponse.success || !sessionResponse.order_id) {
        throw new Error(sessionResponse.message || 'Failed to create order');
      }

      const newOrderId = sessionResponse.order_id;

      // Step 2: Add the service product as an order line
      await updateWorkflowSessionWithProducts(newOrderId, {
        session_data: { ...sessionData, currentStep: 2, maxStepReached: 2 },
        products: [{
          product_id: selectedPlan.productId,
          quantity: 1,
          price_unit: amountRequired,
        }],
      }, token || undefined);

      setOrderId(newOrderId);
      setStep('payment');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create order');
    } finally {
      setIsCreatingOrder(false);
    }
  }, [selectedPlan, subscriptionCode, token]);

  // Verify payment with Odoo and then report to ABS
  const verifyAndSubmit = useCallback(async (receipt: string, method: string) => {
    if (!selectedPlan || !orderId) return;

    setIsProcessing(true);
    setSubmitError(null);

    try {
      const verifyResponse = await confirmPaymentManual(
        { order_id: orderId, receipt },
        token || undefined,
      );

      if (!verifyResponse.success) {
        throw new Error('Payment verification failed');
      }

      const paymentData = verifyResponse.data || (verifyResponse as any);

      if (paymentData.is_duplicate || paymentData.receipt_used || paymentData.receipt_status === 'used') {
        setSubmitError(paymentData.message || 'Payment reference already used.');
        setIsProcessing(false);
        return;
      }

      const totalPaid = paymentData.total_paid ?? paymentData.amount_paid ?? 0;
      const remainingToPay = paymentData.remaining_to_pay ?? paymentData.amount_remaining ?? 0;

      if (totalPaid < Math.floor(selectedPlan.price) && remainingToPay > 0) {
        setSubmitError(
          `Insufficient payment: ${currency} ${totalPaid.toLocaleString()} paid of ${currency} ${Math.floor(selectedPlan.price).toLocaleString()}. Remaining: ${currency} ${remainingToPay.toLocaleString()}`
        );
        setIsProcessing(false);
        return;
      }

      // Payment verified — now report to ABS
      const result = await onSubmit({
        plan: selectedPlan,
        energyConfig,
        transactionId: receipt,
        paymentMethod: method,
        orderId,
        totalPaid,
      });

      if (result.success) {
        setStep('success');
      } else {
        setSubmitError(result.error || 'Top-up failed');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Payment verification failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, orderId, token, currency, energyConfig, onSubmit]);

  // Manual confirm handler
  const handleConfirm = useCallback(async () => {
    if (!selectedPlan || !transactionId.trim()) return;
    await verifyAndSubmit(transactionId.trim(), 'mobile_money');
  }, [selectedPlan, transactionId, verifyAndSubmit]);

  // WeChat payment success handler
  const handleWechatPaid = useCallback(async (tradeNo: string, _totalPaid: number) => {
    await verifyAndSubmit(tradeNo, 'wechat_pay');
  }, [verifyAndSubmit]);

  const handleWechatError = useCallback((message: string) => {
    setSubmitError(message);
  }, []);

  if (!isOpen) return null;

  const energyKwh = energyConfig?.initialQuota ?? null;

  // Prefer the canonical `templateId` for display so the same plan looks
  // identical on every device. See [CATALOG DIAGNOSTIC] — `name` is a
  // translatable Odoo field and drifts between Android WebView and desktop.
  const selectedPlanDisplayName = selectedPlan
    ? (selectedPlan.templateId || selectedPlan.name)
    : '';
  const selectedPlanLabel = selectedPlan
    ? `${selectedPlanDisplayName} — ${currency ? `${currency} ` : ''}${selectedPlan.price.toLocaleString()}`
    : '';

  return (
    <>
      <div
        className="select-sheet-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Stable min-height keeps the sheet from snapping between sizes as
            the user moves plan → payment → success. Capped by the sheet's
            own 85vh max-height; body scrolls if content overflows. */}
        <div
          className="select-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{ minHeight: '65vh' }}
        >
          <div className="select-sheet-handle" aria-hidden="true" />

          <div className="select-sheet-head" style={{ position: 'relative' }}>
            <div className="select-sheet-title" style={{ textAlign: 'center', width: '100%' }}>
              {step === 'success'
                ? (t('rider.energyTopUp.success') || 'Energy Credited')
                : (t('rider.topUpEnergy') || 'Top Up Energy')}
            </div>
            <button
              className="select-sheet-close"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              style={{ position: 'absolute', right: 16, top: 12 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="select-sheet-body" style={{ flex: 1, overflowY: 'auto' }}>
            {/* ── STEP 1: PLAN SELECTION ─────────────────────────── */}
            {step === 'plan' && (
              <div style={{ padding: '4px 0' }}>
                {/* Plan Selector */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">
                    {t('rider.energyTopUp.selectPlan') || 'Select Service Product'}
                  </label>
                  <button
                    type="button"
                    className="form-input"
                    style={{
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
                        : selectedPlanLabel || (t('rider.energyTopUp.choosePlan') || 'Choose a product')}
                    </span>
                    <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  </button>
                  {plansError && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={10} />
                      <span>{plansError}</span>
                    </div>
                  )}
                </div>

                {/* Energy Quota */}
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
                  onClick={handleProceedToPayment}
                  disabled={!selectedPlan || isCreatingOrder || !subscriptionCode}
                  style={{ width: '100%' }}
                >
                  {isCreatingOrder
                    ? (t('common.processing') || 'Processing...')
                    : (t('rider.proceedToPayment') || 'Proceed to Payment')}
                </button>
              </div>
            )}

            {/* ── STEP 2: PAYMENT COLLECTION ─────────────────────── */}
            {step === 'payment' && selectedPlan && (
              <div style={{ padding: '4px 0' }}>
                {/* Amount header */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('rider.amountToPay') || 'Amount to pay'}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currency} {Math.floor(selectedPlan.price).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selectedPlanDisplayName}
                  </div>
                </div>

                {/* Payment mode toggle */}
                <InputModeToggle
                  mode={paymentMode}
                  onModeChange={setPaymentMode}
                  manualLabel={t('attendant.enterId') || 'Enter ID'}
                  showScan={false}
                  showWechat={true}
                  disabled={isProcessing}
                />

                {/* Manual / Scan entry */}
                {(paymentMode === 'manual' || paymentMode === 'scan') && (
                  <div style={{ marginTop: 16 }}>
                    {/* Mixx by Yas guidance — shown above the TX ID field so the
                        rider can dial, pay, and then paste the SMS reference. */}
                    <div className="topup-mixx-field" style={{ marginBottom: 16 }}>
                      <span className="topup-mixx-label">
                        {t('rider.payWithMixx') || 'Pay with Mixx by Yas'}
                      </span>
                      <button
                        type="button"
                        className="topup-mixx-row"
                        onClick={() => handleCopy('ussd', buildMixxUssd(selectedPlan.price))}
                        aria-label={t('rider.copyUssd') || 'Copy USSD code'}
                      >
                        <span className="topup-mixx-value-mono">
                          {buildMixxUssd(selectedPlan.price)}
                        </span>
                        {copiedKey === 'ussd' ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <span className="topup-mixx-hint">
                        {t('rider.ussdHint') || "Or follow the steps below if the pre-built code doesn't work on your handset."}
                      </span>
                      <ol className="topup-mixx-steps" style={{ marginTop: 8 }}>
                        <li>
                          {t('rider.mixxStep1Prefix') || 'Dial'}{' '}
                          <button
                            type="button"
                            className="topup-mixx-inline-copy"
                            onClick={() => handleCopy('root', MIXX_USSD_ROOT)}
                          >
                            <span>{MIXX_USSD_ROOT}</span>
                            {copiedKey === 'root' ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </li>
                        <li>{t('rider.mixxStep2') || 'Choose "Merchant Payment"'}</li>
                        <li>
                          {t('rider.mixxStep3Prefix') || 'Merchant code:'}{' '}
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
                        <li>
                          {(t('rider.mixxStep4') || 'Amount: {amount} F CFA').replace(
                            '{amount}',
                            formatFCFA(selectedPlan.price),
                          )}
                        </li>
                        <li>{t('rider.mixxStep5') || 'Confirm with your Mixx PIN'}</li>
                        <li>{t('rider.mixxStep6') || 'Note the transaction code received by SMS'}</li>
                      </ol>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">
                        {t('rider.txnIdRef') || 'Transaction ID / Reference'}
                      </label>
                      <input
                        type="text"
                        className="form-input manual-id-input"
                        placeholder={t('rider.enterTxnId') || 'Enter transaction ID'}
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        disabled={isProcessing}
                      />
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
                      disabled={!transactionId.trim() || isProcessing}
                      style={{ width: '100%' }}
                    >
                      {isProcessing
                        ? (t('common.processing') || 'Verifying...')
                        : (t('rider.madePayment') || "Confirm Payment")}
                    </button>
                  </div>
                )}

                {/* WeChat Pay */}
                {paymentMode === 'wechat' && (
                  <div style={{ marginTop: 16 }}>
                    {orderId ? (
                      <WeChatPayment
                        orderId={orderId}
                        amount={Math.floor(selectedPlan.price)}
                        productName={selectedPlanDisplayName}
                        currencySymbol={currency}
                        authToken={token || undefined}
                        onPaid={handleWechatPaid}
                        onError={handleWechatError}
                        isProcessing={isProcessing}
                      />
                    ) : (
                      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                        Order not ready. Please go back and try again.
                      </div>
                    )}

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
                  </div>
                )}

                {/* Back button */}
                <button
                  type="button"
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '10px 0',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onClick={() => { setStep('plan'); setSubmitError(null); }}
                  disabled={isProcessing}
                >
                  {t('sales.back') || 'Back'}
                </button>
              </div>
            )}

            {/* ── SUCCESS ──────────────────────────────────────────── */}
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
        title={t('rider.energyTopUp.selectPlan') || 'Select Service Product'}
        activeValue={selectedPlan ? String(selectedPlan.productId) : null}
        loading={plansLoading}
        error={plansError}
        searchable={plans.length > 6}
        items={plans.map((p) => ({
          value: String(p.productId),
          label: p.name,
          description: p.description || p.category || p.default_code,
          meta: `${currency ? `${currency} ` : ''}${p.price.toLocaleString()}`,
        }))}
        onSelect={(item) => {
          const plan = plans.find((p) => String(p.productId) === item.value);
          if (plan) handlePlanSelect(plan);
        }}
      />
    </>
  );
};

export default EnergyTopUpModal;
