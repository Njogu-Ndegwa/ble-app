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
  
  // Check if customer has partial quota (some quota but not enough to cover full energy diff)
  const hasPartialQuota = swapData.quotaDeduction > 0 && swapData.chargeableEnergy > 0;
  
  // Round down the cost for display and payment decision - customers can't pay decimals
  const displayCost = Math.floor(swapData.cost);
  
  // Check if rounded cost is zero or negative (no payment needed regardless of quota status)
  const isZeroCost = displayCost <= 0;
  
  // Should skip payment: either has sufficient quota OR rounded cost is zero
  const shouldSkipPayment = hasSufficientQuota || isZeroCost;

  // Calculate values
  const oldBatteryKwh = (swapData.oldBattery?.energy || 0) / 1000;
  const newBatteryKwh = (swapData.newBattery?.energy || 0) / 1000;
  const oldLevel = swapData.oldBattery?.chargeLevel ?? 0;
  const newLevel = swapData.newBattery?.chargeLevel ?? 0;
  const quotaValue = Math.round(swapData.quotaDeduction * swapData.rate);

  // Calculate monetary values for battery capacities
  const oldBatteryValue = Math.round(oldBatteryKwh * swapData.rate);
  const newBatteryValue = Math.round(newBatteryKwh * swapData.rate);
  // Use displayCost (the actual amount customer pays) to be consistent with the hero section
  // Previously this was: Math.round(swapData.energyDiff * swapData.rate) which showed gross value
  // before quota deduction, causing a mismatch with the hero section
  const energyDiffValue = displayCost;

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
              {shouldSkipPayment 
                ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
                : (t('attendant.customerPays') || 'Amount Due')}
            </span>
          </div>
        </div>
        
        <div className={`review-amount ${shouldSkipPayment ? 'free' : ''}`}>
          {shouldSkipPayment ? (
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
            <span className="battery-id">{swapData.oldBattery?.shortId || '---'}</span>
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
            <span className="battery-id">{swapData.newBattery?.shortId || '---'}</span>
          </div>
        </div>
      </div>

      {/* Energy Gain */}
      <div className="review-energy-gain">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <div className="energy-info">
          <span className="energy-value">+{swapData.energyDiff.toFixed(2)} kWh</span>
          <span className={`energy-money ${shouldSkipPayment ? 'free' : ''}`}>
            {shouldSkipPayment ? (t('common.free') || 'FREE') : `${currency} ${energyDiffValue}`}
          </span>
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="review-summary">
        <div className="summary-row">
          <span>{t('attendant.rate') || 'Rate'}</span>
          <span>{currency} {swapData.rate}/{t('attendant.perKwh') || 'kWh'}</span>
        </div>

        {/* Quota Applied (if any) */}
        {(hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 && (
          <div className="summary-row quota">
            <span>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              {t('attendant.quotaCovered') || 'Quota Credit'} ({swapData.quotaDeduction.toFixed(2)} kWh)
            </span>
            <span>-{currency} {quotaValue}</span>
          </div>
        )}

        {/* Partial quota note */}
        {hasPartialQuota && !shouldSkipPayment && (
          <div className="summary-note">
            {t('attendant.chargeableEnergy') || 'To Pay'}: {swapData.chargeableEnergy.toFixed(2)} kWh = {currency} {displayCost}
          </div>
        )}
      </div>

      <style jsx>{`
        .review-screen {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0 8px;
        }

        /* Header */
        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .review-customer {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .review-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
        }

        .review-customer-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .review-customer-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .review-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .review-amount {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .review-amount.free {
          color: #10b981;
          font-size: 16px;
        }

        /* Batteries */
        .review-batteries {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 12px;
          align-items: center;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .review-battery {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .battery-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .battery-visual {
          display: flex;
          justify-content: center;
        }

        .battery-visual .battery-icon-swap {
          width: 40px;
          height: 56px;
        }

        .battery-visual .battery-percent {
          font-size: 10px;
        }

        .battery-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .battery-energy {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .battery-value {
          font-size: 12px;
          font-weight: 500;
          color: var(--accent);
          font-family: var(--font-mono);
        }

        .battery-id {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .review-arrow {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .review-arrow svg {
          width: 20px;
          height: 20px;
        }

        /* Energy Gain */
        .review-energy-gain {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 12px;
          color: var(--accent);
        }

        .review-energy-gain svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .energy-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .energy-value {
          font-size: 16px;
          font-weight: 600;
        }

        .energy-money {
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-mono);
          padding: 2px 8px;
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
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .summary-row.quota {
          color: #10b981;
          font-weight: 500;
        }

        .summary-row.quota span:first-child {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .summary-note {
          font-size: 11px;
          color: var(--text-muted);
          text-align: right;
        }
      `}</style>
    </div>
  );
}
