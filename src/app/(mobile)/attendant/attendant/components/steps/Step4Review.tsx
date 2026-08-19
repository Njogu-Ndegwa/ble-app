'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SwapData, CustomerData, getInitials, getBatteryClass } from '../types';
import type { ActivationServiceMode } from '@/lib/activation-service-mode';

interface Step4Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  hasSufficientQuota?: boolean;
  /** Top-up-only attendant (SA-ID gated): hide the payable amount and ask the rider to top up instead */
  requireRiderTopUp?: boolean;
  /**
   * Manual-swap mode: when a balance is owed, hide the payable amount and steer the
   * customer to purchase a new subscription plan instead (completion stays allowed).
   */
  planTopUpOnBalance?: boolean;
  /** Re-check quota (picks up a rider top-up); wired to the shared manual-refresh handler */
  onRefreshQuota?: () => void;
  /** Whether a manual refresh is currently in flight */
  isRefreshing?: boolean;
  servicePlanMode?: ActivationServiceMode;
}

export default function Step4Review({ swapData, customerData, hasSufficientQuota = false, requireRiderTopUp = false, planTopUpOnBalance = false, onRefreshQuota, isRefreshing = false, servicePlanMode }: Step4Props) {
  const { t } = useI18n();
  const isSwapCountPlan = servicePlanMode?.kind === 'swap-count';

  // Round down the cost for display and payment decision - customers can't pay decimals
  const displayCost = Math.floor(swapData.cost);

  // Check if rounded cost is zero or negative (no payment needed regardless of quota status)
  const isZeroCost = !isSwapCountPlan && displayCost <= 0;

  // Should skip payment: either has sufficient quota OR rounded cost is zero
  const shouldSkipPayment = hasSufficientQuota || isZeroCost;

  // Top-up-only flow: a differential is owed but this attendant must not collect
  // it. Hide the exact amount and steer the rider to top up + refresh instead.
  const topUpRequired = requireRiderTopUp && !shouldSkipPayment;

  // Manual-swap "buy a new subscription plan" flow: a balance is owed, but instead
  // of showing the attendant a payable amount we steer the customer to purchase a
  // new subscription plan (then Refresh to pick up the new quota). Unlike the
  // top-up-only flow, completion is still allowed downstream — this only changes
  // what the Review page displays.
  const planTopUp = !shouldSkipPayment && !topUpRequired &&
    (planTopUpOnBalance || isSwapCountPlan);

  // Whichever top-up variant is active, the payable amount is hidden and the cost
  // breakdown is replaced by an instructional notice + Refresh-quota button.
  const hideAmount = topUpRequired || planTopUp;

  // Determine why payment is being skipped (for display purposes)
  // - isQuotaBased: Customer has available quota that will be deducted (NOT free - quota is used)
  // - isZeroCostOnly: Actual cost is zero or negative (genuinely no charge)
  const isQuotaBased = hasSufficientQuota;
  const isZeroCostOnly = !hasSufficientQuota && isZeroCost;

  // Calculate values
  const oldBatteryKwh = (swapData.oldBattery?.energy || 0) / 1000;
  const newBatteryKwh = (swapData.newBattery?.energy || 0) / 1000;
  const oldLevel = swapData.oldBattery?.chargeLevel ?? 0;
  const newLevel = swapData.newBattery?.chargeLevel ?? 0;
  
  // Calculate monetary values for battery capacities (display only)
  const oldBatteryValue = Math.round(oldBatteryKwh * swapData.rate);
  const newBatteryValue = Math.round(newBatteryKwh * swapData.rate);
  
  // === USE STORED VALUES - NO RECALCULATION ===
  // These values are calculated ONCE in AttendantFlow.tsx (single source of truth)
  // Using them directly ensures display matches what's reported to backend
  const grossEnergyCost = swapData.grossEnergyCost;     // energyDiff × rate (round UP if >2dp)
  const quotaCreditValue = swapData.quotaCreditValue;   // quotaDeduction × rate (as-is, inputs already 2dp)
  const balanceAfterQuota = swapData.cost;              // chargeableEnergy × rate (round UP if >2dp)

  // Currency symbol from backend
  const currency = swapData.currencySymbol;
  
  return (
    <div className="review-screen">
      {/* Customer & Payment Header */}
      <div className="review-header">
        <div className="review-customer">
          {customerData && (
            <div className="review-avatar">
              {getInitials(customerData.name)}
            </div>
          )}
          <div className="review-customer-info">
            <span className="review-customer-name">{customerData?.name || 'Customer'}</span>
            <span className="review-label">
              {planTopUp
                ? (t('attendant.planTopUpNeeded') || 'New plan needed')
                : topUpRequired
                  ? (t('attendant.topUpNeeded') || 'Top-up needed')
                  : isQuotaBased
                    ? (isSwapCountPlan
                        ? (t('attendant.swapQuotaAvailable') || 'Swap allowance available')
                        : (t('attendant.quotaAvailable') || 'Quota Available'))
                    : isZeroCostOnly
                      ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
                      : (t('attendant.customerPays') || 'Amount Due')}
            </span>
          </div>
        </div>

        <div className={`review-amount ${shouldSkipPayment ? 'free' : ''} ${hideAmount ? 'topup' : ''}`}>
          {planTopUp ? (
            <span className="topup-pill">{t('attendant.planTopUpPill') || 'Subscription needed'}</span>
          ) : topUpRequired ? (
            <span className="topup-pill">{t('attendant.topUpRequired') || 'Top-up required'}</span>
          ) : isQuotaBased ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span>
                {isSwapCountPlan
                  ? (t('attendant.oneSwapIncluded') || '1 swap included')
                  : (t('attendant.usingQuota') || 'Using Quota')}
              </span>
            </>
          ) : isZeroCostOnly ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span>{t('common.free') || 'FREE'}</span>
            </>
          ) : (
            <span className="amount-value">{currency} {displayCost}</span>
          )}
        </div>
      </div>

      {/* Battery Comparison */}
      <div className="review-batteries">
        {/* Old Battery */}
        <div className="review-battery">
          <span className="battery-label">{t('attendant.returning') || 'Returning'}</span>
          <div className="battery-visual">
            <div className={`battery-icon-swap ${getBatteryClass(oldLevel)}`}>
              <div 
                className="battery-level-swap" 
                style={{ '--level': `${oldLevel}%` } as React.CSSProperties}
              />
              <span className="battery-percent">{oldLevel}%</span>
            </div>
          </div>
          <div className="battery-details">
            <span className="battery-energy">{oldBatteryKwh.toFixed(2)} kWh</span>
            {!isSwapCountPlan && <span className="battery-value">{currency} {oldBatteryValue}</span>}
            <span className="battery-id">{swapData.oldBattery?.actualBatteryId || swapData.oldBattery?.shortId || '---'}</span>
          </div>
        </div>
        
        {/* Arrow */}
        <div className="review-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        
        {/* New Battery */}
        <div className="review-battery">
          <span className="battery-label">{t('attendant.receiving') || 'Receiving'}</span>
          <div className="battery-visual">
            <div className={`battery-icon-swap ${getBatteryClass(newLevel)}`}>
              <div 
                className="battery-level-swap" 
                style={{ '--level': `${newLevel}%` } as React.CSSProperties}
              />
              <span className="battery-percent">{newLevel}%</span>
            </div>
          </div>
          <div className="battery-details">
            <span className="battery-energy">{newBatteryKwh.toFixed(2)} kWh</span>
            {!isSwapCountPlan && <span className="battery-value">{currency} {newBatteryValue}</span>}
            <span className="battery-id">{swapData.newBattery?.actualBatteryId || swapData.newBattery?.shortId || '---'}</span>
          </div>
        </div>
      </div>

      {/* Energy Gain - Shows gross value of power differential */}
      <div className="review-energy-gain">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <div className="energy-info">
          {/* swapData.energyDiff is already floored to 2 decimals */}
          <span className="energy-value">+{swapData.energyDiff.toFixed(2)} kWh</span>
          {/* Hide the monetary value entirely whenever a top-up variant is active —
              the attendant must not see an exact payable amount. */}
          {!hideAmount && !isSwapCountPlan && (
            <span className="energy-money">
              {currency} {grossEnergyCost.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {hideAmount ? (
        /* No payable amount is shown. For top-up-only attendants the message
           steers the rider to top up in their app; for manual swap it steers the
           customer to buy a new subscription plan. Either way: top up, then Refresh. */
        <div className="topup-notice">
          <div className="topup-notice-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>{t('attendant.topUpRequiredTitle') || 'Insufficient quota for this swap'}</span>
          </div>
          <p className="topup-notice-body">
            {planTopUp
              ? (t('attendant.planTopUpDesc') || 'Ask the customer to purchase a new subscription plan to cover this swap, then tap Refresh.')
              : (t('attendant.topUpRequiredDesc') || 'Ask the rider to top up in the Rider app, then tap Refresh.')}
          </p>
          <div className="topup-notice-short">
            {planTopUp
              ? (t('attendant.planAllowanceNeeded') || 'Plan allowance needed')
              : (t('attendant.topUpShortfall') || 'Top-up needed')}:{' '}
            <strong>
              {isSwapCountPlan
                ? (t('attendant.oneSwap') || '1 swap')
                : `${swapData.chargeableEnergy.toFixed(2)} kWh`}
            </strong>
          </div>
          <button
            type="button"
            className="topup-refresh-btn"
            onClick={onRefreshQuota}
            disabled={isRefreshing || !onRefreshQuota}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="15"
              height="15"
              style={{ animation: isRefreshing ? 'topup-spin 1s linear infinite' : undefined }}
            >
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <span>{isRefreshing ? (t('attendant.refreshing') || 'Refreshing…') : (t('attendant.refreshQuota') || 'Refresh quota')}</span>
          </button>
        </div>
      ) : (
      isSwapCountPlan && servicePlanMode?.kind === 'swap-count' ? (
      <div className="review-summary">
        <div className="summary-header">
          <span>{t('attendant.swapAllowance') || 'Swap allowance'}</span>
          <span className="rate-badge">
            {servicePlanMode.remainingSwaps} / {servicePlanMode.totalSwaps} {t('attendant.remaining') || 'remaining'}
          </span>
        </div>
        <div className="summary-row calculation">
          <span className="calc-label">{t('attendant.thisSwap') || 'This swap'}</span>
          <span className="calc-formula"><strong>{t('attendant.oneSwap') || '1 swap'}</strong></span>
        </div>
        <div className="summary-row calculation quota">
          <span className="calc-label">{t('attendant.remainingAfterSwap') || 'Remaining after swap'}</span>
          <span className="calc-formula">
            <strong>{Math.max(0, servicePlanMode.remainingSwaps - 1)} / {servicePlanMode.totalSwaps}</strong>
          </span>
        </div>
        <div className="summary-divider" />
        <div className="summary-row total">
          <span className="calc-label">{t('attendant.coveredByPlan') || 'Covered by plan'}</span>
          <span className="calc-total free">{t('attendant.includedInSubscription') || 'Included in subscription'}</span>
        </div>
      </div>
      ) : (
      /* Pricing Summary - Full Calculation Breakdown */
      <div className="review-summary">
        {/* Header with rate info */}
        <div className="summary-header">
          <span>{t('attendant.costBreakdown') || 'Cost Breakdown'}</span>
          <span className="rate-badge">{currency} {swapData.rate}/{t('attendant.perKwh') || 'kWh'}</span>
        </div>

        {/* Step 1: Energy being transferred (gross cost) */}
        <div className="summary-row calculation">
          <span className="calc-label">{t('attendant.powerBeingSold') || 'Energy purchased'}</span>
          <span className="calc-formula">
            {/* All values from swapData - single source of truth */}
            {swapData.energyDiff.toFixed(2)} × {swapData.rate} = <strong>{currency} {grossEnergyCost.toFixed(2)}</strong>
          </span>
        </div>

        {/* Step 2: Quota credit applied (if any) */}
        {swapData.quotaDeduction > 0 && (
          <div className="summary-row calculation quota">
            <span className="calc-label">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              {t('attendant.quotaYouHave') || 'Your quota'}
            </span>
            <span className="calc-formula">
              {swapData.quotaDeduction.toFixed(2)} × {swapData.rate} = <strong>-{currency} {quotaCreditValue.toFixed(2)}</strong>
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="summary-divider" />

        {/* Step 3: Balance / Final amount */}
        <div className="summary-row total">
          <span className="calc-label">
            {isQuotaBased
              ? (t('attendant.coveredByQuotaLabel') || 'Covered by Quota')
              : shouldSkipPayment 
                ? (t('attendant.balance') || 'Balance')
                : (t('attendant.amountToPay') || 'Amount to pay')}
          </span>
          <span className={`calc-total ${shouldSkipPayment ? 'free' : ''}`}>
            {isQuotaBased ? (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                {t('attendant.quotaApplied') || 'Quota Applied'}
              </>
            ) : isZeroCostOnly ? (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                {t('common.free') || 'FREE'}
              </>
            ) : (
              <strong>{currency} {displayCost}</strong>
            )}
          </span>
        </div>

        {/* Rounding note - only show when there's actual rounding and payment is due */}
        {!shouldSkipPayment && balanceAfterQuota !== displayCost && (
          <div className="summary-note">
            {t('attendant.roundingNote') || 'Decimals rounded down'}: {currency} {balanceAfterQuota.toFixed(2)} → {currency} {displayCost}
          </div>
        )}
      </div>
      )
      )}

      <style jsx>{`
        .review-screen {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 4px;
        }

        /* Header */
        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }

        .review-customer {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .review-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .review-customer-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .review-customer-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .review-label {
          font-size: 10px;
          color: var(--text-muted);
        }

        .review-amount {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .review-amount.free {
          color: #10b981;
          font-size: 14px;
        }

        .review-amount.topup {
          font-size: 12px;
        }

        .topup-pill {
          font-size: 11px;
          font-weight: 700;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.4);
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-family: var(--font-mono);
        }

        /* Top-up notice (replaces the cost breakdown for top-up-only attendants) */
        .topup-notice {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.05));
          border: 1px solid rgba(245, 158, 11, 0.4);
          border-radius: 10px;
        }

        .topup-notice-head {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
        }

        .topup-notice-head svg {
          flex-shrink: 0;
        }

        .topup-notice-body {
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        .topup-notice-short {
          font-size: 12px;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .topup-notice-short strong {
          color: #f59e0b;
        }

        .topup-refresh-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 2px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          color: var(--bg-primary);
          background: #f59e0b;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .topup-refresh-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }

        @keyframes topup-spin {
          to { transform: rotate(360deg); }
        }

        /* Batteries */
        .review-batteries {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }

        .review-battery {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .battery-label {
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .battery-visual {
          display: flex;
          justify-content: center;
        }

        .battery-visual .battery-icon-swap {
          width: 32px;
          height: 44px;
        }

        .battery-visual .battery-percent {
          font-size: 8px;
        }

        .battery-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .battery-energy {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .battery-value {
          font-size: 10px;
          font-weight: 500;
          color: var(--accent);
          font-family: var(--font-mono);
        }

        .battery-id {
          font-size: 9px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .review-arrow {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .review-arrow svg {
          width: 16px;
          height: 16px;
        }

        /* Energy Gain */
        .review-energy-gain {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          background: var(--bg-secondary);
          border-radius: 10px;
          color: var(--accent);
        }

        .review-energy-gain svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .energy-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .energy-value {
          font-size: 14px;
          font-weight: 600;
        }

        .energy-money {
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-mono);
          padding: 2px 6px;
          background: var(--accent);
          color: var(--bg-primary);
          border-radius: 4px;
        }

        .energy-money.free {
          background: #10b981;
          color: white;
        }

        /* Summary */
        .review-summary {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .rate-badge {
          font-size: 9px;
          font-weight: 500;
          color: var(--accent);
          background: var(--color-brand-soft, rgba(0, 229, 229, 0.1));
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--font-mono);
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .summary-row.calculation {
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
        }

        .calc-label {
          font-size: 10px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .calc-formula {
          font-size: 11px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          padding-left: 3px;
        }

        .calc-formula strong {
          color: var(--text-primary);
        }

        .summary-row.quota .calc-label {
          color: #10b981;
        }

        .summary-row.quota .calc-formula strong {
          color: var(--color-success);
        }

        .summary-divider {
          height: 1px;
          background: var(--border-subtle);
          margin: 2px 0;
        }

        .summary-row.total {
          padding-top: 2px;
        }

        .summary-row.total .calc-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .calc-total {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .calc-total.free {
          color: #10b981;
          font-size: 12px;
        }

        .summary-note {
          font-size: 9px;
          color: var(--text-muted);
          text-align: right;
          font-style: italic;
          padding-top: 1px;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}
