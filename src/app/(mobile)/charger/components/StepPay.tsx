"use client";

/**
 * Step 4 — the rider pays for the plan on their own phone.
 *
 * This mirrors the rider app's Energy Top-Up modal rather than the staff
 * Top-Up applet: the rider settles with mobile money themselves, so the money
 * path is Odoo order → mobile-money payment → receipt verification, and only a
 * verified receipt unlocks the ABS quota credit.
 *
 * Two consequences follow from paying by receipt, and both matter:
 *
 *  • The amount credited is Odoo's CONFIRMED `total_paid`, not the plan's list
 *    price. If the rider underpays, Odoo says so and nothing is credited.
 *  • The receipt itself is the idempotency key (`payment_reference` AND
 *    `correlation_id`), so re-submitting the same reference can never
 *    double-credit — no locally generated reference is needed.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Copy, Loader2, Smartphone } from 'lucide-react';

import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import { SERVICE_TOPUP, type ServiceTopupResponse } from '@/lib/graphql/mutations';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  confirmPaymentManual,
  createWorkflowSession,
  updateWorkflowSessionWithProducts,
  type WorkflowSessionData,
} from '@/lib/odoo-api';
import { InputModeToggle, WeChatPayment } from '@/components/shared';
import type { InputMode } from '@/components/shared/types';
import { buildServiceTopupInput, assessTopupResponse } from '../../topup/lib/topup-core';
import type { IdentifiedSub } from '../../topup/components/StepIdentify';
import type { SelectedPlan } from '../../topup/components/StepPlan';
import type { PaidCharge } from '../lib/types';

// Merchant-payment USSD codes for Togo, identical to the rider app's. The
// amount is embedded in the string so the rider dials the whole code as-is.
// These are Togo rails and must only reach Togo riders — see isTogoCurrency.
const MIXX_MERCHANT_NUMBER = '1088722';
const FLOOZ_RECIPIENT_NUMBER = '22879392818';

const buildMixxUssd = (amount: number): string =>
  `*145*5*${Math.floor(amount)}*${MIXX_MERCHANT_NUMBER}#`;

const buildFloozUssd = (amount: number): string =>
  `*155*2*2*${FLOOZ_RECIPIENT_NUMBER}*${FLOOZ_RECIPIENT_NUMBER}*${Math.floor(amount)}#`;

/** The backend stores the CFA franc as both "XOF" and "CFA"; accept either. */
const isTogoCurrency = (cur?: string): boolean => /^(XOF|CFA)$/i.test((cur || '').trim());

interface StepPayProps {
  sub: IdentifiedSub;
  plan: SelectedPlan;
  onBack: () => void;
  onPaid: (paid: PaidCharge) => void;
}

export default function StepPay({ sub, plan, onBack, onPaid }: StepPayProps) {
  const { t } = useI18n();
  const token = useMemo(() => getSalesRoleToken(), []);

  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(true);
  const [paymentMode, setPaymentMode] = useState<InputMode>('manual');
  const [transactionId, setTransactionId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const amount = Math.floor(plan.price);

  // Create the Odoo order up front so the rider has something to pay against.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCreatingOrder(true);
      setOrderError(null);
      try {
        const sessionData: WorkflowSessionData = {
          status: 'in_progress',
          workflowType: 'attendant',
          currentStep: 1,
          maxStepReached: 1,
        };
        const sessionResponse = await createWorkflowSession(
          { subscription_code: sub.subscriptionCode, session_data: sessionData },
          token || undefined,
        );
        if (cancelled) return;
        if (!sessionResponse.success || !sessionResponse.order_id) {
          throw new Error(sessionResponse.message || t('charger.orderFailed'));
        }
        const newOrderId = sessionResponse.order_id;
        await updateWorkflowSessionWithProducts(
          newOrderId,
          {
            session_data: { ...sessionData, currentStep: 2, maxStepReached: 2 },
            products: [{ product_id: plan.productId, quantity: 1, price_unit: amount }],
          },
          token || undefined,
        );
        if (cancelled) return;
        setOrderId(newOrderId);
      } catch (err) {
        if (!cancelled) {
          setOrderError(err instanceof Error ? err.message : t('charger.orderFailed'));
        }
      } finally {
        if (!cancelled) setCreatingOrder(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sub.subscriptionCode, plan.productId, amount, token, t]);

  const handleCopy = useCallback((key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      },
      () => { /* clipboard blocked — the code is still readable on screen */ },
    );
  }, []);

  /**
   * Verify the payment with Odoo, then credit ABS. Only a verified, non-
   * duplicate, sufficient payment reaches the credit — a charger that dispenses
   * on an unverified receipt is a charger that gives energy away.
   */
  const verifyAndCredit = useCallback(
    async (receipt: string, method: string, preVerified = false) => {
      if (!orderId) return;
      setProcessing(true);
      setError(null);
      try {
        let totalPaid = amount;

        if (!preVerified) {
          const verifyResponse = await confirmPaymentManual(
            { order_id: orderId, receipt },
            token || undefined,
          );
          if (!verifyResponse.success) throw new Error(t('charger.paymentUnverified'));

          const paymentData: any = verifyResponse.data || verifyResponse;
          if (
            paymentData.is_duplicate
            || paymentData.receipt_used
            || paymentData.receipt_status === 'used'
          ) {
            setError(paymentData.message || t('charger.receiptAlreadyUsed'));
            setProcessing(false);
            return;
          }

          totalPaid = paymentData.total_paid ?? paymentData.amount_paid ?? 0;
          const remaining = paymentData.remaining_to_pay ?? paymentData.amount_remaining ?? 0;
          if (totalPaid < amount && remaining > 0) {
            const cur = sub.currency ? `${sub.currency} ` : '';
            setError(
              t('charger.insufficientPayment', {
                paid: `${cur}${totalPaid.toLocaleString()}`,
                due: `${cur}${amount.toLocaleString()}`,
                remaining: `${cur}${remaining.toLocaleString()}`,
              }),
            );
            setProcessing(false);
            return;
          }
        }

        // Credit ABS against the amount Odoo actually confirmed, keyed on the
        // receipt so a retry of the same payment dedupes server-side.
        const input = buildServiceTopupInput({
          subscriptionCode: sub.subscriptionCode,
          energyServiceId: sub.energyServiceId,
          planPrice: totalPaid,
          declaredKwh: plan.declaredKwh,
          reference: receipt,
        });
        const result = await absApolloClient.mutate<{ serviceTopup: ServiceTopupResponse }>({
          mutation: SERVICE_TOPUP,
          variables: { input },
        });
        if (result.errors && result.errors.length > 0) {
          throw new Error(result.errors[0].message || t('charger.creditFailed'));
        }
        const resp = result.data?.serviceTopup;
        if (!resp) throw new Error(t('charger.noResponse'));

        const assessment = assessTopupResponse(resp);
        if (!assessment.ok) throw new Error(assessment.reason || t('charger.creditRejected'));

        onPaid({
          receipt,
          paymentMethod: method,
          orderId,
          totalPaid,
          quotaBefore: resp.quota_before ?? sub.energyRemaining,
          quotaAfter: resp.quota_after ?? sub.energyRemaining + plan.declaredKwh,
          wasRetry: assessment.isIdempotent,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('charger.paymentUnverified'));
      } finally {
        setProcessing(false);
      }
    },
    [orderId, amount, token, sub, plan, onPaid, t],
  );

  const handleConfirm = useCallback(() => {
    const receipt = transactionId.trim();
    if (!receipt) {
      setError(t('charger.enterReference'));
      return;
    }
    verifyAndCredit(receipt, 'mobile_money');
  }, [transactionId, verifyAndCredit, t]);

  // Z-Pay payments are already verified against the Odoo order by the time
  // onPaid fires, so they skip confirmPaymentManual (that endpoint is for
  // LiPay/M-Pesa receipts) — same rule as the rider app.
  const handleWechatPaid = useCallback(
    (tradeNo: string) => { verifyAndCredit(tradeNo, 'wechat', true); },
    [verifyAndCredit],
  );

  if (creatingOrder) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
          {t('charger.preparingOrder')}
        </div>
      </div>
    );
  }

  if (orderError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{orderError}</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
          {t('sales.back') || 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.payTitle')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('charger.payHint')}
        </p>
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {t('charger.amountToPay')}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
          {sub.currency ? `${sub.currency} ` : ''}{amount.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {plan.name} · {plan.declaredKwh.toLocaleString()} kWh
        </div>
      </div>

      <InputModeToggle
        mode={paymentMode}
        onModeChange={setPaymentMode}
        manualLabel={t('charger.enterReferenceTab')}
        showScan={false}
        showWechat
        disabled={processing}
      />

      {(paymentMode === 'manual' || paymentMode === 'scan') && (
        <div>
          {/* Pre-built USSD codes with the amount already embedded — the rider
              dials the whole code, pays, then pastes the SMS reference. Togo
              rails only; riders billed in any other currency pay however their
              market works and just enter the reference. */}
          {isTogoCurrency(sub.currency) && (
            <div className="topup-mixx-field" style={{ marginBottom: 16 }}>
              <span className="topup-mixx-label">{t('charger.payWithMixx')}</span>
              <button
                type="button"
                className="topup-mixx-row"
                onClick={() => handleCopy('mixx', buildMixxUssd(plan.price))}
                aria-label={t('charger.copyUssd')}
              >
                <span className="topup-mixx-value-mono" style={{ wordBreak: 'break-all', textAlign: 'left' }}>
                  {buildMixxUssd(plan.price)}
                </span>
                {copiedKey === 'mixx' ? <Check size={16} /> : <Copy size={16} />}
              </button>

              <span className="topup-mixx-label" style={{ marginTop: 10 }}>
                {t('charger.payWithFlooz')}
              </span>
              <button
                type="button"
                className="topup-mixx-row"
                onClick={() => handleCopy('flooz', buildFloozUssd(plan.price))}
                aria-label={t('charger.copyUssd')}
              >
                <span className="topup-mixx-value-mono" style={{ wordBreak: 'break-all', textAlign: 'left' }}>
                  {buildFloozUssd(plan.price)}
                </span>
                {copiedKey === 'flooz' ? <Check size={16} /> : <Copy size={16} />}
              </button>

              <span className="topup-mixx-hint">{t('charger.ussdHint')}</span>
            </div>
          )}

          <label className="form-label">{t('charger.txnIdRef')}</label>
          <input
            type="text"
            className="form-input manual-id-input"
            placeholder={t('charger.enterTxnId')}
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            disabled={processing}
            autoComplete="off"
          />
        </div>
      )}

      {paymentMode === 'wechat' && orderId && (
        <WeChatPayment
          orderId={orderId}
          amount={amount}
          productName={plan.name}
          currencySymbol={sub.currency}
          authToken={token || undefined}
          onPaid={handleWechatPaid}
          onError={(msg: string) => setError(msg)}
          isProcessing={processing}
        />
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paymentMode !== 'wechat' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={processing || !transactionId.trim()}
            aria-busy={processing}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {processing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('charger.verifying')}
              </>
            ) : (
              <>
                <Smartphone size={16} />
                {t('charger.confirmPayment')}
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          style={{
            width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
            color: 'var(--text-secondary)', fontSize: 13,
            cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1,
          }}
        >
          {t('sales.back') || 'Back'}
        </button>
      </div>
    </div>
  );
}
