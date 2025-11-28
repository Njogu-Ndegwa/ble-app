'use client';

import React from 'react';
import { SwapData, CustomerData } from '../types';

interface Step6Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  transactionId: string;
}

export default function Step6Success({ swapData, customerData, transactionId }: Step6Props) {
  return (
    <div className="screen active">
      <div className="success-screen">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="success-title">Swap Complete!</h2>
        <p className="success-message">Hand over {swapData.newBattery?.id || 'battery'} to customer</p>
        
        <div className="receipt-card">
          <div className="receipt-header">
            <span className="receipt-title">Transaction Receipt</span>
            <span className="receipt-id">#{transactionId}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Customer</span>
            <span className="receipt-value">{customerData?.name || 'Customer'}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Returned</span>
            <span className="receipt-value">
              {swapData.oldBattery?.id || '---'} ({swapData.oldBattery?.chargeLevel || 0}%)
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Issued</span>
            <span className="receipt-value">
              {swapData.newBattery?.id || '---'} ({swapData.newBattery?.chargeLevel || 100}%)
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Energy</span>
            <span className="receipt-value">{swapData.energyDiff} kWh</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Amount Paid</span>
            <span className="receipt-value" style={{ color: 'var(--success)' }}>
              KES {swapData.cost.toFixed(2)}
            </span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Time</span>
            <span className="receipt-value">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
