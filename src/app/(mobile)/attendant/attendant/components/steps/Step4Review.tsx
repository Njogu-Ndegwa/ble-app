'use client';

import React from 'react';
import { useI18n } from '@/i18n';
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
  
  // Round down the cost for display and payment decision - customers can't pay decimals
  const displayCost = Math.floor(swapData.cost);
  
  // Check if rounded cost is zero or negative (no payment needed regardless of quota status)
  const isZeroCost = displayCost <= 0;
  
  // Should skip payment: either has sufficient quota OR rounded cost is zero
  const shouldSkipPayment = hasSufficientQuota || isZeroCost;

  // Calculate money values for batteries
  const oldBatteryKwh = (swapData.oldBattery?.energy || 0) / 1000;
  const newBatteryKwh = (swapData.newBattery?.energy || 0) / 1000;
  const oldBatteryValue = Math.round(oldBatteryKwh * swapData.rate);
  const newBatteryValue = Math.round(newBatteryKwh * swapData.rate);
  const energyDiffValue = Math.round(swapData.energyDiff * swapData.rate);
  const quotaDeductionValue = Math.round(swapData.quotaDeduction * swapData.rate);
  const chargeableEnergyValue = Math.round(swapData.chargeableEnergy * swapData.rate);
  
  return (
    <div className="screen active" style={{ padding: '0 4px' }}>
      {/* Hero: Customer + Payment Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        padding: '10px 12px',
        background: shouldSkipPayment 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)'
          : 'linear-gradient(135deg, rgba(0, 229, 229, 0.15) 0%, rgba(0, 229, 229, 0.05) 100%)',
        borderRadius: '12px',
        border: `1px solid ${shouldSkipPayment ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 229, 229, 0.3)'}`,
        marginBottom: '10px'
      }}>
        {customerData && (
          <div className="customer-avatar" style={{ width: '40px', height: '40px', fontSize: '13px', flexShrink: 0 }}>
            {getInitials(customerData.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '15px', 
            color: 'white', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            marginBottom: '2px'
          }}>
            {customerData?.name || 'Customer'}
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: shouldSkipPayment ? '#10b981' : '#00e5e5',
            fontWeight: 500
          }}>
            {shouldSkipPayment 
              ? (hasSufficientQuota 
                  ? (t('attendant.coveredByQuota') || 'Covered by quota')
                  : (t('attendant.zeroCostSwap') || 'Zero cost swap'))
              : `${t('attendant.toPay') || 'To pay'}: ${swapData.currencySymbol} ${displayCost}`}
          </div>
        </div>
        {/* Payment Status Icon */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: shouldSkipPayment ? '#10b981' : '#00e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {shouldSkipPayment ? (
            <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          ) : (
            <span style={{ color: '#0a1a2e', fontSize: '14px', fontWeight: 700 }}>
              {swapData.currencySymbol}
            </span>
          )}
        </div>
      </div>

      {/* Battery Swap Cards - Side by Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
        {/* Returning Battery */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%)',
          borderRadius: '10px',
          padding: '10px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            {t('attendant.returning') || 'Returning'}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
            {swapData.oldBattery?.shortId || '---'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>
              {swapData.currencySymbol} {oldBatteryValue}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
            {oldBatteryKwh.toFixed(2)} kWh
          </div>
        </div>

        {/* Arrow */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#00e5e5',
          padding: '0 2px'
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        {/* Receiving Battery */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)',
          borderRadius: '10px',
          padding: '10px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            {t('attendant.receiving') || 'Receiving'}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
            {swapData.newBattery?.shortId || '---'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
              {swapData.currencySymbol} {newBatteryValue}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
            {newBatteryKwh.toFixed(2)} kWh
          </div>
        </div>
      </div>

      {/* Energy Difference Highlight */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 229, 229, 0.1) 0%, rgba(0, 229, 229, 0.03) 100%)',
        borderRadius: '10px',
        padding: '10px 12px',
        marginBottom: '10px',
        border: '1px solid rgba(0, 229, 229, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
              {t('attendant.energyGain') || 'Energy Gain'}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              <span style={{ color: '#00e5e5', fontWeight: 600 }}>+{swapData.energyDiff.toFixed(2)} kWh</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>×</span>
              <span>{swapData.currencySymbol} {swapData.rate}/kWh</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
              {t('attendant.worth') || 'Worth'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#00e5e5' }}>
              {swapData.currencySymbol} {energyDiffValue}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Breakdown - Compact */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        padding: '10px 12px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('attendant.paymentSummary') || 'Payment Summary'}
        </div>

        {/* Quota Applied Row */}
        {(hasPartialQuota || hasSufficientQuota) && swapData.quotaDeduction > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '6px 8px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '6px',
            marginBottom: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg viewBox="0 0 24 24" fill="#10b981" width="14" height="14">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#10b981' }}>
                {t('attendant.quotaCovered') || 'Quota Credit'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                -{swapData.currencySymbol} {quotaDeductionValue}
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(16, 185, 129, 0.7)', marginLeft: '4px' }}>
                ({swapData.quotaDeduction.toFixed(2)} kWh)
              </span>
            </div>
          </div>
        )}

        {/* Remaining to Pay (if partial) */}
        {hasPartialQuota && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '4px 0',
            marginBottom: '4px'
          }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              {t('attendant.remainingToPay') || 'Remaining to Pay'}
            </span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
                {swapData.currencySymbol} {chargeableEnergyValue}
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>
                ({swapData.chargeableEnergy.toFixed(2)} kWh)
              </span>
            </div>
          </div>
        )}

        {/* Divider before total */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />

        {/* Total */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: shouldSkipPayment ? '#10b981' : 'white'
          }}>
            {shouldSkipPayment 
              ? (t('attendant.noPaymentNeeded') || 'No Payment Needed')
              : (t('attendant.customerPays') || 'Customer Pays')}
          </span>
          <div style={{ 
            fontSize: '22px', 
            fontWeight: 700, 
            color: shouldSkipPayment ? '#10b981' : '#00e5e5'
          }}>
            {shouldSkipPayment ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                <span style={{ fontSize: '14px' }}>{t('common.free') || 'FREE'}</span>
              </div>
            ) : (
              `${swapData.currencySymbol} ${displayCost}`
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
