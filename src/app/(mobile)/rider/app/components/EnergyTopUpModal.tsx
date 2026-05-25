"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
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
  description?: string;
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
  const [transactionId, setTransactionId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    if (!isOpen) {
      setStep('payment');
      setSelectedPlan(null);
      setEnergyConfig(null);
      setQuotaError(null);
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
      const lookupId = plan.name;
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
    if (!selectedPlan || !transactionId.trim()) return;
    setIsProcessing(true);
    setSubmitError(null);
    try {
      const result = await onSubmit({
        plan: selectedPlan,
        energyConfig,
        transactionId: transactionId.trim(),
        paymentMethod: 'mobile_money',
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
  }, [selectedPlan, energyConfig, transactionId, onSubmit]);

  if (!isOpen) return null;

  const energyKwh = energyConfig?.initialQuota ?? null;

  const selectedPlanLabel = selectedPlan
    ? `${selectedPlan.name} — ${currency ? `${currency} ` : ''}${selectedPlan.price.toLocaleString()}`
    : '';

  return (
    <>
      <div
        className="select-sheet-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="select-sheet" onClick={(e) => e.stopPropagation()}>
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

          <div className="select-sheet-body">
            {step === 'payment' && (
              <div style={{ padding: '4px 0' }}>
                {/* Plan Selector */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">
                    {t('rider.energyTopUp.selectPlan') || 'Select Service Plan'}
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
                        : selectedPlanLabel || (t('rider.energyTopUp.choosePlan') || 'Choose a plan')}
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

                {/* Transaction ID */}
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
                  disabled={!selectedPlan || !transactionId.trim() || isProcessing}
                  style={{ width: '100%' }}
                >
                  {isProcessing
                    ? (t('common.processing') || 'Processing...')
                    : (t('rider.madePayment') || "I've Made Payment")}
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
        title={t('rider.energyTopUp.selectPlan') || 'Select Service Plan'}
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
