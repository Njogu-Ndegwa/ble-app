'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import BatterySwapVisual from '../BatterySwapVisual';
import { SwapData, CustomerData, getInitials } from '../types';

interface Step4Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  hasSufficientQuota?: boolean;
}

export default function Step4Review({ swapData, customerData, hasSufficientQuota = false }: Step4Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      {/* Visual Battery Comparison */}
      <BatterySwapVisual 
        oldBattery={swapData.oldBattery} 
        newBattery={swapData.newBattery} 
      />

      {/* Energy Differential Badge */}
      <div className="energy-diff-badge">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>+{swapData.energyDiff.toFixed(3)} kWh</span>
      </div>

      {/* Quota Credit Banner - Shows when customer has sufficient quota */}
      {hasSufficientQuota && (
        <div className="quota-credit-banner">
          <div className="quota-credit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="quota-credit-text">
            <div className="quota-credit-title">{t('attendant.quotaCreditAvailable') || 'Quota Credit Available'}</div>
            <div className="quota-credit-subtitle">{t('attendant.noPaymentRequired') || 'No payment required - using existing credit'}</div>
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="cost-card">
        <div className="cost-title">{t('attendant.costBreakdown')}</div>
        <div className="cost-row">
          <span className="cost-label">{t('attendant.returnedBattery')}</span>
          <span className="cost-value">{((swapData.oldBattery?.energy || 0) / 1000).toFixed(3)} kWh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">{t('attendant.issuedBattery')}</span>
          <span className="cost-value">{((swapData.newBattery?.energy || 0) / 1000).toFixed(3)} kWh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">{t('attendant.energyDiff')}</span>
          <span className="cost-value">{swapData.energyDiff.toFixed(3)} kWh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">{t('attendant.rate')}</span>
          <span className="cost-value">KES {swapData.rate}/kWh</span>
        </div>
        <div className={`cost-total ${hasSufficientQuota ? 'cost-total-credit' : ''}`}>
          <span className="cost-total-label">
            {hasSufficientQuota 
              ? (t('attendant.quotaDeduction') || 'Quota Deduction') 
              : t('attendant.totalCost')}
          </span>
          <span className="cost-total-value">
            {hasSufficientQuota 
              ? `${swapData.energyDiff.toFixed(3)} kWh` 
              : `KES ${swapData.cost.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      {customerData && (
        <div className="customer-card" style={{ padding: '10px' }}>
          <div className="customer-header" style={{ marginBottom: 0 }}>
            <div className="customer-avatar">{getInitials(customerData.name)}</div>
            <div>
              <div className="customer-name">{customerData.name}</div>
              <div className="customer-id">{customerData.swapCount} swaps • Last: {customerData.lastSwap}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
