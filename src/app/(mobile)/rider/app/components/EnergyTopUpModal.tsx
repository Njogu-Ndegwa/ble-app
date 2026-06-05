// trigger CI
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Zap, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
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
import { InputModeToggle, WeChatPayment } from '@/components/shared';
import type { InputMode } from '@/components/shared/types';
import { filterPlansByPackage } from '@/lib/plan-filter';

// Real merchant-payment USSD codes (Togo). The amount ("Montant") is embedded
// directly in the string, so the rider can dial the whole code as-is.
//   Mixx by Yas : *145*5*<amount>*1088722#
//   Flooz       : *155*2*2*22879392818*22879392818*<amount>#
const MIXX_MERCHANT_NUMBER = '1088722';
const FLOOZ_RECIPIENT_NUMBER = '22879392818';

const buildMixxUssd = (amount: number): string =>
  `*145*5*${Math.floor(amount)}*${MIXX_MERCHANT_NUMBER}#`;

const buildFloozUssd = (amount: number): string =>
  `*155*2*2*${FLOOZ_RECIPIENT_NUMBER}*${FLOOZ_RECIPIENT_NUMBER}*${Math.floor(amount)}#`;

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
  /**
   * Name of the rider's current subscription product (e.g. "S6 Tuk-Tuk
   * Monthly"). When provided, the plan list is narrowed to only the
   * services that apply to this package — same mapping used in Sales /
   * Activator step 3. Falsy → show all plans.
   */
  packageName?: string | null;
  onSubmit: (args: EnergyTopUpSubmitArgs) => Promise<EnergyTopUpResult>;
}

const EnergyTopUpModal: React.FC<EnergyTopUpModalProps> = ({
  isOpen,
  onClose,
  currency = '',
  token,
  subscriptionCode,
  packageName,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<EnergyTopUpStep>('plan');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
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

  // Narrow the plan list to those that apply to the rider's current package.
  // If packageName is not provided (or doesn't match any mapping), the helper
  // returns the full list. If a match would yield zero plans, it logs and
  // also falls back to the full list — so the picker is never silently empty.
  // MUST be declared above any early return — React hooks rule.
  const visiblePlans = useMemo(
    () => filterPlansByPackage(packageName, plans),
    [packageName, plans],
  );

  if (!isOpen) return null;

  const energyKwh = energyConfig?.initialQuota ?? null;

  // Display the human-readable product `name`. The `templateId`
  // (x_template_id) is an internal code used for lookups/filtering only and
  // must never be shown to users.
  const selectedPlanDisplayName = selectedPlan
    ? (selectedPlan.name || selectedPlan.templateId)
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
              <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t('rider.energyTopUp.selectPlan') || 'Choose a plan'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {t('rider.energyTopUp.pickPlanHint') || 'Tap a plan, then continue to pay.'}
                  </div>
                </div>

                {/* Plan list — the cards ARE the selection. Tapping highlights
                    and triggers a quota lookup so the kWh shows under the name. */}
                <div className="energy-plan-list">
                  {plansLoading && visiblePlans.length === 0 && (
                    <>
                      <div className="energy-plan-skeleton" />
                      <div className="energy-plan-skeleton" />
                      <div className="energy-plan-skeleton" />
                    </>
                  )}

                  {plansError && (
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
                      }}
                    >
                      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{plansError}</span>
                    </div>
                  )}

                  {!plansLoading && !plansError && visiblePlans.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {t('rider.energyTopUp.noPlans') || 'No plans available right now.'}
                    </div>
                  )}

                  {visiblePlans.map((plan) => {
                    const isSelected = selectedPlan?.productId === plan.productId;
                    const displayName = plan.name || plan.templateId;
                    const subtitle = plan.description || plan.category || plan.default_code;
                    return (
                      <button
                        key={plan.productId}
                        type="button"
                        className={`energy-plan-card${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handlePlanSelect(plan)}
                        disabled={isCreatingOrder}
                        aria-pressed={isSelected}
                      >
                        <div className="energy-plan-icon">
                          <Zap size={18} />
                        </div>
                        <div className="energy-plan-body">
                          <div className="energy-plan-title">{displayName}</div>
                          {subtitle && (
                            <div className="energy-plan-subtitle">{subtitle}</div>
                          )}
                          {isSelected && (
                            <div className="energy-plan-energy">
                              {quotaLoading ? (
                                <>
                                  <Loader2 size={11} className="animate-spin" />
                                  <span>{t('common.loading') || 'Loading...'}</span>
                                </>
                              ) : energyKwh !== null ? (
                                <>
                                  <Zap size={11} />
                                  <span>{`+${energyKwh.toLocaleString()} kWh`}</span>
                                </>
                              ) : quotaError ? (
                                <>
                                  <AlertCircle size={11} />
                                  <span>{t('rider.energyTopUp.quotaUnknown') || 'Quota unavailable'}</span>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <div className="energy-plan-price">
                          {currency ? `${currency} ` : ''}{plan.price.toLocaleString()}
                        </div>
                        {isSelected && (
                          <div className="energy-plan-check" aria-hidden="true">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

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
                    {/* Pre-built USSD codes — the amount is already embedded, so the
                        rider dials the whole code, pays, then pastes the SMS reference. */}
                    <div className="topup-mixx-field" style={{ marginBottom: 16 }}>
                      <span className="topup-mixx-label">
                        {t('rider.payWithMixx') || 'Pay with Mixx by Yas'}
                      </span>
                      <button
                        type="button"
                        className="topup-mixx-row"
                        onClick={() => handleCopy('mixx', buildMixxUssd(selectedPlan.price))}
                        aria-label={t('rider.copyUssd') || 'Copy USSD code'}
                      >
                        <span className="topup-mixx-value-mono" style={{ wordBreak: 'break-all', textAlign: 'left' }}>
                          {buildMixxUssd(selectedPlan.price)}
                        </span>
                        {copiedKey === 'mixx' ? <Check size={16} /> : <Copy size={16} />}
                      </button>

                      <span className="topup-mixx-label" style={{ marginTop: 10 }}>
                        {t('rider.payWithFlooz') || 'Pay with Flooz'}
                      </span>
                      <button
                        type="button"
                        className="topup-mixx-row"
                        onClick={() => handleCopy('flooz', buildFloozUssd(selectedPlan.price))}
                        aria-label={t('rider.copyUssd') || 'Copy USSD code'}
                      >
                        <span className="topup-mixx-value-mono" style={{ wordBreak: 'break-all', textAlign: 'left' }}>
                          {buildFloozUssd(selectedPlan.price)}
                        </span>
                        {copiedKey === 'flooz' ? <Check size={16} /> : <Copy size={16} />}
                      </button>

                      <span className="topup-mixx-hint">
                        {t('rider.ussdHintShort') || 'Dial the code for your operator, pay, then paste the SMS confirmation reference below.'}
                      </span>
                    </div>

                    <div>
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
                  </div>
                )}
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

          {/* Sticky footer — sits outside .select-sheet-body so CTAs stay
              visible no matter how tall the body content gets. Plan step
              keeps Continue pinned even with many plans; payment step
              keeps Confirm + Back pinned even with long Mixx instructions. */}
          {step === 'plan' && (
            <div className="energy-topup-footer">
              {submitError && (
                <div className="energy-topup-footer-error">
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
                  : (t('rider.proceedToPayment') || 'Continue to Payment')}
              </button>
            </div>
          )}

          {step === 'payment' && selectedPlan && (
            <div className="energy-topup-footer">
              {submitError && (
                <div className="energy-topup-footer-error">
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{submitError}</span>
                </div>
              )}
              {/* Confirm only renders for manual / scan; the WeChatPayment
                  widget has its own pay button inside the body. */}
              {(paymentMode === 'manual' || paymentMode === 'scan') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={!transactionId.trim() || isProcessing}
                  style={{ width: '100%' }}
                >
                  {isProcessing
                    ? (t('common.processing') || 'Verifying...')
                    : (t('rider.madePayment') || 'Confirm Payment')}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setStep('plan'); setSubmitError(null); }}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t('sales.back') || 'Back'}
              </button>
            </div>
          )}
        </div>
      </div>

    </>
  );
};

export default EnergyTopUpModal;
