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

  // Currency symbol from backend
  const currency = swapData.currencySymbol;
  
  return (
    <div className="screen active" style={{ padding: '0 8px' }}>
      {/* Customer Header - Minimal */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        marginBottom: '12px'
      }}>
        {customerData && (
          <div className="customer-avatar" style={{ width: '36px', height: '36px', fontSize: '12px', flexShrink: 0 }}>
            {getInitials(customerData.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '14px', 
            color: 'white', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap'
          }}>
            {customerData?.name || 'Customer'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {customerData?.subscriptionId || customerData?.id || ''}
          </div>
        </div>
      </div>

      {/* Battery Swap Visual - Classic Style */}
      <div className="battery-swap-visual" style={{ 
        padding: '14px 12px',
        marginBottom: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)'
      }}>
        {/* Old Battery */}
        <div className="battery-swap-item" style={{ paddingTop: '10px' }}>
          <div className={`battery-icon-swap ${getBatteryClass(oldLevel)}`} style={{ width: '52px', height: '72px' }}>
            <div 
              className="battery-level-swap" 
              style={{ '--level': `${oldLevel}%` } as React.CSSProperties}
            />
            <span className="battery-percent" style={{ fontSize: '12px' }}>{oldBatteryKwh.toFixed(1)}</span>
          </div>
          <div className="battery-swap-label" style={{ marginTop: '4px' }}>
            {t('attendant.returning') || 'RETURNING'}
          </div>
          <div className="battery-swap-id">{swapData.oldBattery?.shortId || '---'}</div>
        </div>
        
        {/* Arrow */}
        <div className="swap-arrow-icon" style={{ width: '32px', height: '32px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        
        {/* New Battery */}
        <div className="battery-swap-item" style={{ paddingTop: '10px' }}>
          <div className={`battery-icon-swap ${getBatteryClass(newLevel)}`} style={{ width: '52px', height: '72px' }}>
            <div 
              className="battery-level-swap" 
              style={{ '--level': `${newLevel}%` } as React.CSSProperties}
            />
            <span className="battery-percent" style={{ fontSize: '12px' }}>{newBatteryKwh.toFixed(1)}</span>
          </div>
          <div className="battery-swap-label" style={{ marginTop: '4px' }}>
            {t('attendant.receiving') || 'RECEIVING'}
          </div>
          <div className="battery-swap-id">{swapData.newBattery?.shortId || '---'}</div>
        </div>
      </div>

      {/* Energy Gain Badge */}
      <div className="energy-diff-badge" style={{ marginBottom: '12px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>+{swapData.energyDiff.toFixed(2)} kWh</span>
      </div>

      {/* Compact Pricing Section */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        padding: '12px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Rate Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {t('attendant.rate') || 'Rate'}
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            {currency} {swapData.rate}/{t('attendant.perKwh') || 'kWh'}
          </span>
        </div>

        {/* Quota Applied (if any) */}
        {(hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '6px 8px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '6px',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg viewBox="0 0 24 24" fill="#10b981" width="14" height="14">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#10b981' }}>
                {t('attendant.quotaCovered') || 'Quota Credit'}
              </span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
              -{currency} {quotaValue}
            </span>
          </div>
        )}

        {/* Total Amount - Hero Display */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '10px 0'
        }}>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: 500, 
            color: 'rgba(255,255,255,0.8)'
          }}>
            {shouldSkipPayment 
              ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
              : (t('attendant.customerPays') || 'Customer Pays')}
          </span>
          
          {shouldSkipPayment ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              borderRadius: '20px'
            }}>
              <svg viewBox="0 0 24 24" fill="#10b981" width="18" height="18">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>
                {t('common.free') || 'FREE'}
              </span>
            </div>
          ) : (
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: 'var(--accent)',
              fontFamily: "'DM Mono', monospace"
            }}>
              {currency} {displayCost}
            </div>
          )}
        </div>

        {/* Partial quota - show remaining */}
        {hasPartialQuota && !shouldSkipPayment && (
          <div style={{ 
            fontSize: '11px', 
            color: 'rgba(255,255,255,0.4)', 
            textAlign: 'right',
            marginTop: '-4px'
          }}>
            {t('attendant.afterQuota') || 'After quota applied'} ({swapData.chargeableEnergy.toFixed(2)} kWh)
          </div>
        )}
      </div>
    </div>
  );
}
