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

  // Calculate cost of energy in each battery
  const oldBatteryValue = Math.round(oldBatteryKwh * swapData.rate);
  const newBatteryValue = Math.round(newBatteryKwh * swapData.rate);
  const energyDiffValue = Math.round(swapData.energyDiff * swapData.rate);

  // Currency symbol from backend
  const currency = swapData.currencySymbol;
  
  return (
    <div className="screen active" style={{ padding: '0 8px' }}>
      {/* Payment Amount - Hero Section (Immediately Visible) */}
      <div style={{
        background: shouldSkipPayment 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
          : 'linear-gradient(135deg, rgba(0, 229, 229, 0.15), rgba(0, 229, 229, 0.05))',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '10px',
        border: shouldSkipPayment 
          ? '1px solid rgba(16, 185, 129, 0.3)'
          : '1px solid rgba(0, 229, 229, 0.3)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {customerData && (
              <div className="customer-avatar" style={{ width: '32px', height: '32px', fontSize: '11px', flexShrink: 0 }}>
                {getInitials(customerData.name)}
              </div>
            )}
            <div>
              <div style={{ 
                fontSize: '11px', 
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '2px'
              }}>
                {shouldSkipPayment 
                  ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
                  : (t('attendant.customerPays') || 'Customer Pays')}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '120px'
              }}>
                {customerData?.name || 'Customer'}
              </div>
            </div>
          </div>
          
          {shouldSkipPayment ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(16, 185, 129, 0.2)',
              borderRadius: '20px'
            }}>
              <svg viewBox="0 0 24 24" fill="#10b981" width="18" height="18">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                {t('common.free') || 'FREE'}
              </span>
            </div>
          ) : (
            <div style={{ 
              fontSize: '28px', 
              fontWeight: 700, 
              color: 'var(--accent)',
              fontFamily: "'DM Mono', monospace"
            }}>
              {currency} {displayCost}
            </div>
          )}
        </div>
      </div>

      {/* Compact Battery Comparison */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '8px',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        borderRadius: '10px',
        padding: '10px',
        marginBottom: '10px',
        border: '1px solid var(--border)'
      }}>
        {/* Old Battery */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '10px', 
            color: 'rgba(255,255,255,0.5)', 
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {t('attendant.returning') || 'RETURNING'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div className={`battery-icon-swap ${getBatteryClass(oldLevel)}`} style={{ width: '36px', height: '52px' }}>
              <div 
                className="battery-level-swap" 
                style={{ '--level': `${oldLevel}%` } as React.CSSProperties}
              />
              <span className="battery-percent" style={{ fontSize: '10px' }}>{oldLevel}%</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                {oldBatteryKwh.toFixed(2)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>kWh</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                {currency} {oldBatteryValue}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {swapData.oldBattery?.shortId || '---'}
          </div>
        </div>
        
        {/* Arrow */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)'
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        
        {/* New Battery */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '10px', 
            color: 'rgba(255,255,255,0.5)', 
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {t('attendant.receiving') || 'RECEIVING'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div className={`battery-icon-swap ${getBatteryClass(newLevel)}`} style={{ width: '36px', height: '52px' }}>
              <div 
                className="battery-level-swap" 
                style={{ '--level': `${newLevel}%` } as React.CSSProperties}
              />
              <span className="battery-percent" style={{ fontSize: '10px' }}>{newLevel}%</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                {newBatteryKwh.toFixed(2)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>kWh</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                {currency} {newBatteryValue}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {swapData.newBattery?.shortId || '---'}
          </div>
        </div>
      </div>

      {/* Energy Differential with kWh and Cost */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: 'rgba(0, 229, 229, 0.08)',
        borderRadius: '8px',
        padding: '8px 12px',
        marginBottom: '10px',
        border: '1px solid rgba(0, 229, 229, 0.15)'
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)' }}>
            +{swapData.energyDiff.toFixed(2)} kWh
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            ({t('attendant.worth') || 'Worth'} {currency} {energyDiffValue})
          </span>
        </div>
      </div>

      {/* Compact Pricing Details */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        padding: '10px 12px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        {/* Rate */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: (hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 ? '6px' : '0'
        }}>
          <span>{t('attendant.rate') || 'Rate'}</span>
          <span>{currency} {swapData.rate}/{t('attendant.perKwh') || 'kWh'}</span>
        </div>

        {/* Quota Applied (if any) */}
        {(hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '5px 8px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '5px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" fill="#10b981" width="12" height="12">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span style={{ fontSize: '11px', color: '#10b981' }}>
                {t('attendant.quotaCovered') || 'Quota Credit'} ({swapData.quotaDeduction.toFixed(2)} kWh)
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>
              -{currency} {quotaValue}
            </span>
          </div>
        )}

        {/* Partial quota note */}
        {hasPartialQuota && !shouldSkipPayment && (
          <div style={{ 
            fontSize: '10px', 
            color: 'rgba(255,255,255,0.4)', 
            textAlign: 'right',
            marginTop: '4px'
          }}>
            {t('attendant.chargeableEnergy') || 'To Pay'}: {swapData.chargeableEnergy.toFixed(2)} kWh
          </div>
        )}
      </div>
    </div>
  );
}
