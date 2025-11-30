'use client';

import React from 'react';
import { CustomerData, getInitials } from './types';

interface CustomerStatePanelProps {
  customer: CustomerData | null;
  visible: boolean;
}

// Service Cycle FSM state styling - uses cyan/teal palette
const getServiceStateConfig = (state?: string): { className: string; label: string; shortLabel: string } => {
  switch (state) {
    case 'BATTERY_ISSUED':
      return { className: 'service-battery-issued', label: 'Battery Issued', shortLabel: 'Issued' };
    case 'WAIT_BATTERY_ISSUE':
      return { className: 'service-wait-battery', label: 'Awaiting Battery', shortLabel: 'Awaiting' };
    case 'BATTERY_RETURNED':
      return { className: 'service-battery-returned', label: 'Battery Returned', shortLabel: 'Returned' };
    case 'BATTERY_LOST':
      return { className: 'service-battery-lost', label: 'Battery Lost', shortLabel: 'Lost' };
    case 'COMPLETE':
      return { className: 'service-complete', label: 'Complete', shortLabel: 'Done' };
    case 'INITIAL':
    default:
      return { className: 'service-initial', label: 'Initial', shortLabel: 'New' };
  }
};

// Payment Cycle FSM state styling - uses green/orange/red palette
const getPaymentStateConfig = (state?: string): { className: string; label: string; shortLabel: string } => {
  switch (state) {
    case 'CURRENT':
      return { className: 'payment-current', label: 'Current', shortLabel: 'Paid' };
    case 'DEPOSIT_DUE':
      return { className: 'payment-deposit-due', label: 'Deposit Due', shortLabel: 'Deposit' };
    case 'RENEWAL_DUE':
      return { className: 'payment-renewal-due', label: 'Renewal Due', shortLabel: 'Renew' };
    case 'FINAL_DUE':
      return { className: 'payment-final-due', label: 'Final Due', shortLabel: 'Final' };
    case 'COMPLETE':
      return { className: 'payment-complete', label: 'Complete', shortLabel: 'Done' };
    case 'INITIAL':
    default:
      return { className: 'payment-initial', label: 'Initial', shortLabel: 'New' };
  }
};

export default function CustomerStatePanel({ customer, visible }: CustomerStatePanelProps) {
  if (!visible || !customer) return null;

  const energyPercent = customer.energyTotal 
    ? ((customer.energyRemaining || 0) / customer.energyTotal) * 100 
    : 0;
  const swapsPercent = customer.swapsTotal 
    ? ((customer.swapsRemaining || 0) / customer.swapsTotal) * 100 
    : 0;

  const getQuotaClass = (percent: number): string => {
    if (percent > 30) return 'good';
    if (percent > 10) return 'warning';
    return 'critical';
  };

  const serviceConfig = getServiceStateConfig(customer.serviceState);
  const paymentConfig = getPaymentStateConfig(customer.paymentState);

  return (
    <>
      {/* Customer Identity Panel */}
      <div className="customer-state-panel visible">
        <div className="customer-state-inner">
          {/* Customer Identity */}
          <div className="state-customer">
            <div className="state-avatar">{getInitials(customer.name)}</div>
            <div className="state-customer-info">
              <div className="state-customer-name">{customer.name}</div>
              <div className="state-plan-row">
                <span className="state-plan-name">{customer.subscriptionType}</span>
                <div className="state-badges">
                  {customer.serviceState && (
                    <span className={`state-badge ${serviceConfig.className}`}>
                      {serviceConfig.shortLabel}
                    </span>
                  )}
                  {customer.paymentState && (
                    <span className={`state-badge ${paymentConfig.className}`}>
                      {paymentConfig.shortLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Current Battery */}
          {customer.currentBatteryId && (
            <div className="state-battery">
              <div className="state-battery-icon">
                <div className="state-battery-fill" style={{ '--level': '100%' } as React.CSSProperties}></div>
              </div>
              <span className="state-battery-id">{customer.currentBatteryId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quota Summary */}
      <div className="state-quotas visible">
        {/* Energy Quota */}
        <div className="state-quota-item">
          <div className="state-quota-icon energy">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="state-quota-info">
            <div className="state-quota-value">
              <span className="remaining">{customer.energyRemaining || 0}</span>
              <span className="unit">kWh left</span>
            </div>
            <div className="state-quota-bar">
              <div 
                className={`state-quota-fill ${getQuotaClass(energyPercent)}`} 
                style={{ width: `${Math.min(energyPercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Swaps Quota */}
        <div className="state-quota-item">
          <div className="state-quota-icon swaps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </div>
          <div className="state-quota-info">
            <div className="state-quota-value">
              <span className="remaining">{customer.swapsRemaining || 0}</span>
              <span className="unit">swaps left</span>
            </div>
            <div className="state-quota-bar">
              <div 
                className={`state-quota-fill ${getQuotaClass(swapsPercent)}`} 
                style={{ width: `${Math.min(swapsPercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
