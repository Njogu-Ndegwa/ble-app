'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SwapData, CustomerData } from '../types';

interface Step6Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  transactionId: string;
  amountDue: number;  // Expected payment amount
  amountPaid: number; // Actual amount paid by customer
  currencySymbol?: string;
}

export default function Step6Success({ 
  swapData, 
  customerData, 
  transactionId,
  amountDue,
  amountPaid,
  currencySymbol = 'KES'
}: Step6Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <div className="success-screen" style={{ paddingTop: '12px' }}>
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="success-title">{t('attendant.swapComplete')}</h2>
        <p className="success-message">
          {t('attendant.handOverBattery') || `Hand over ${swapData.newBattery?.shortId || 'battery'} to customer`}
        </p>
        
        {/* Receipt Card - Full width with left-aligned text */}
        <div className="receipt-card" style={{ width: '100%', textAlign: 'left' }}>
          <div className="receipt-header">
            <span className="receipt-title">{t('attendant.transactionReceipt') || 'Transaction Receipt'}</span>
            <span className="receipt-id font-mono-oves">#{transactionId}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('attendant.step.customer')}</span>
            <span className="receipt-value">{customerData?.name || 'Customer'}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('attendant.returned') || 'Returned'}</span>
            <span className="receipt-value font-mono-oves">
              {swapData.oldBattery?.shortId || '---'} ({swapData.oldBattery?.chargeLevel ?? 0}%)
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('attendant.issued') || 'Issued'}</span>
            <span className="receipt-value font-mono-oves">
              {swapData.newBattery?.shortId || '---'} ({swapData.newBattery?.chargeLevel ?? 0}%)
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('attendant.energy') || 'Energy'}</span>
            <span className="receipt-value font-mono-oves">{swapData.energyDiff.toFixed(2)} kWh</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.amountDue')}</span>
            <span className="receipt-value font-mono-oves">
              {currencySymbol} {amountDue.toLocaleString()}
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.amountPaid')}</span>
            <span className="receipt-value font-mono-oves" style={{ color: 'var(--success)' }}>
              {currencySymbol} {amountPaid.toLocaleString()}
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('attendant.time') || 'Time'}</span>
            <span className="receipt-value font-mono-oves">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
