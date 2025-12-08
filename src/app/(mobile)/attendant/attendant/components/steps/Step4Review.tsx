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
  
  // Check if customer has partial quota (some quota but not enough to cover full energy diff)
  const hasPartialQuota = swapData.quotaDeduction > 0 && swapData.chargeableEnergy > 0;
  
  // Check if cost is zero or negative (no payment needed regardless of quota status)
  const isZeroCost = swapData.cost <= 0;
  
  // Should skip payment: either has sufficient quota OR cost is zero
  const shouldSkipPayment = hasSufficientQuota || isZeroCost;
  
  return (
    <div className="screen active">
      {/* Compact Header with Customer + Battery Summary */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '8px 12px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
        borderRadius: '12px',
        marginBottom: '8px'
      }}>
        {customerData && (
          <>
            <div className="customer-avatar" style={{ width: '36px', height: '36px', fontSize: '12px' }}>
              {getInitials(customerData.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {customerData.name}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                {customerData.swapCount} swaps
              </div>
            </div>
          </>
        )}
        {/* Energy Diff Badge - Inline */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '16px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'white',
          flexShrink: 0
        }}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          +{swapData.energyDiff.toFixed(2)} kWh
        </div>
      </div>

      {/* Compact Battery Visual */}
      <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: '-20px' }}>
        <BatterySwapVisual 
          oldBattery={swapData.oldBattery} 
          newBattery={swapData.newBattery} 
        />
      </div>

      {/* No Payment Banner - Shows when customer has sufficient quota OR cost is zero */}
      {shouldSkipPayment && (
        <div className="quota-credit-banner" style={{ margin: '0 0 8px 0', padding: '10px 12px' }}>
          <div className="quota-credit-icon" style={{ width: '28px', height: '28px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="quota-credit-text">
            <div className="quota-credit-title" style={{ fontSize: '13px' }}>
              {hasSufficientQuota 
                ? (t('attendant.quotaCreditAvailable') || 'Quota Credit Available')
                : (t('attendant.zeroCostSwap') || 'Zero Cost Swap')}
            </div>
            <div className="quota-credit-subtitle" style={{ fontSize: '11px' }}>
              {hasSufficientQuota 
                ? (t('attendant.noPaymentRequired') || 'No payment required - using existing credit')
                : (t('attendant.noPaymentRequiredZeroCost') || 'No payment required - zero total cost')}
            </div>
          </div>
        </div>
      )}

      {/* Compact Cost Breakdown Card */}
      <div className="cost-card" style={{ padding: '10px 12px' }}>
        <div className="cost-title" style={{ fontSize: '12px', marginBottom: '6px' }}>{t('attendant.costBreakdown')}</div>
        
        {/* Compact 2-column grid for battery info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: '8px' }}>
          <div className="cost-row" style={{ margin: 0, padding: '4px 0' }}>
            <span className="cost-label" style={{ fontSize: '11px' }}>{t('attendant.returnedBattery')}</span>
            <span className="cost-value" style={{ fontSize: '12px' }}>{((swapData.oldBattery?.energy || 0) / 1000).toFixed(2)} kWh</span>
          </div>
          <div className="cost-row" style={{ margin: 0, padding: '4px 0' }}>
            <span className="cost-label" style={{ fontSize: '11px' }}>{t('attendant.issuedBattery')}</span>
            <span className="cost-value" style={{ fontSize: '12px' }}>{((swapData.newBattery?.energy || 0) / 1000).toFixed(2)} kWh</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />

        {/* Energy Calculation Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="cost-row" style={{ margin: 0, padding: '3px 0' }}>
            <span className="cost-label" style={{ fontSize: '12px' }}>{t('attendant.energyDiff')}</span>
            <span className="cost-value" style={{ fontSize: '13px', fontWeight: 500 }}>{swapData.energyDiff.toFixed(3)} kWh</span>
          </div>
          
          {/* Show quota deduction if customer has partial quota */}
          {(hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 && (
            <div className="cost-row" style={{ margin: 0, padding: '3px 0', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', paddingLeft: '6px', paddingRight: '6px' }}>
              <span className="cost-label" style={{ fontSize: '12px', color: '#10b981' }}>
                <span style={{ marginRight: '4px' }}>✓</span>
                {t('attendant.quotaApplied') || 'Quota Applied'}
              </span>
              <span className="cost-value" style={{ fontSize: '13px', fontWeight: 500, color: '#10b981' }}>
                -{swapData.quotaDeduction.toFixed(3)} kWh
              </span>
            </div>
          )}

          {/* Show chargeable energy if there's partial quota */}
          {hasPartialQuota && (
            <div className="cost-row" style={{ margin: 0, padding: '3px 0' }}>
              <span className="cost-label" style={{ fontSize: '12px' }}>{t('attendant.chargeableEnergy') || 'To Pay'}</span>
              <span className="cost-value" style={{ fontSize: '13px', fontWeight: 500 }}>{swapData.chargeableEnergy.toFixed(3)} kWh</span>
            </div>
          )}

          <div className="cost-row" style={{ margin: 0, padding: '3px 0' }}>
            <span className="cost-label" style={{ fontSize: '12px' }}>{t('attendant.rate')}</span>
            <span className="cost-value" style={{ fontSize: '13px' }}>{swapData.currencySymbol} {swapData.rate}/kWh</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />

        {/* Total */}
        <div className={`cost-total ${shouldSkipPayment ? 'cost-total-credit' : ''}`} style={{ padding: '6px 0' }}>
          <span className="cost-total-label" style={{ fontSize: '13px' }}>
            {hasSufficientQuota 
              ? (t('attendant.quotaDeduction') || 'Quota Deduction') 
              : t('attendant.totalCost')}
          </span>
          <span className="cost-total-value" style={{ fontSize: '16px' }}>
            {hasSufficientQuota 
              ? `${swapData.energyDiff.toFixed(3)} kWh` 
              : `${swapData.currencySymbol} ${swapData.cost.toFixed(0)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
