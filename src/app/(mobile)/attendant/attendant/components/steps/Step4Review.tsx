'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SwapData, CustomerData, getInitials, getBatteryClass } from '../types';

interface Step4Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  hasSufficientQuota?: boolean;
}

export default function Step4Review({ swapData, customerData, hasSufficientQuota = false }: Step4Props) {
  const { t } = useI18n();
  
  // Round down the cost for display and payment decision - customers can't pay decimals
  const displayCost = Math.floor(swapData.cost);
  
  // Check if rounded cost is zero or negative (no payment needed regardless of quota status)
  const isZeroCost = displayCost <= 0;
  
  // Should skip payment: either has sufficient quota OR rounded cost is zero
  const shouldSkipPayment = hasSufficientQuota || isZeroCost;
  
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
              {isQuotaBased 
                ? (t('attendant.quotaAvailable') || 'Quota Available')
                : isZeroCostOnly
                  ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
                  : (t('attendant.customerPays') || 'Amount Due')}
            </span>
          </div>
        </div>
        
        <div className={`review-amount ${shouldSkipPayment ? 'free' : ''}`}>
          {isQuotaBased ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span>{t('attendant.usingQuota') || 'Using Quota'}</span>
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
            <span className="battery-value">{currency} {oldBatteryValue}</span>
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
            <span className="battery-value">{currency} {newBatteryValue}</span>
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
          <span className="energy-money">
            {currency} {grossEnergyCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Pricing Summary - Full Calculation Breakdown */}
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
