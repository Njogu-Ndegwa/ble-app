'use client';

import React from 'react';
import { CustomerData, getInitials } from './types';
import { 
  Avatar, 
  Badge, 
  QuotaBar,
  BoltIcon,
  SwapIcon,
} from '@/components/ui';

interface CustomerStatePanelProps {
  customer: CustomerData | null;
  visible: boolean;
}

// Service Cycle FSM state styling
const getServiceStateConfig = (state?: string): { variant: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string; shortLabel: string } => {
  switch (state) {
    case 'BATTERY_ISSUED':
      return { variant: 'info', label: 'Battery Issued', shortLabel: 'Issued' };
    case 'WAIT_BATTERY_ISSUE':
      return { variant: 'warning', label: 'Awaiting Battery', shortLabel: 'Awaiting' };
    case 'BATTERY_RETURNED':
      return { variant: 'success', label: 'Battery Returned', shortLabel: 'Returned' };
    case 'BATTERY_LOST':
      return { variant: 'error', label: 'Battery Lost', shortLabel: 'Lost' };
    case 'COMPLETE':
      return { variant: 'success', label: 'Complete', shortLabel: 'Done' };
    case 'INITIAL':
    default:
      return { variant: 'default', label: 'Initial', shortLabel: 'New' };
  }
};

// Payment Cycle FSM state styling
const getPaymentStateConfig = (state?: string): { variant: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string; shortLabel: string } => {
  switch (state) {
    case 'CURRENT':
      return { variant: 'success', label: 'Current', shortLabel: 'Paid' };
    case 'DEPOSIT_DUE':
      return { variant: 'warning', label: 'Deposit Due', shortLabel: 'Deposit' };
    case 'RENEWAL_DUE':
      return { variant: 'warning', label: 'Renewal Due', shortLabel: 'Renew' };
    case 'FINAL_DUE':
      return { variant: 'error', label: 'Final Due', shortLabel: 'Final' };
    case 'COMPLETE':
      return { variant: 'success', label: 'Complete', shortLabel: 'Done' };
    case 'INITIAL':
    default:
      return { variant: 'default', label: 'Initial', shortLabel: 'New' };
  }
};

export default function CustomerStatePanel({ customer, visible }: CustomerStatePanelProps) {
  if (!visible || !customer) return null;

  // Check for infinite quota services (should not be displayed)
  const showEnergyQuota = !customer.hasInfiniteEnergyQuota;
  const showSwapQuota = !customer.hasInfiniteSwapQuota;

  const serviceConfig = getServiceStateConfig(customer.serviceState);
  const paymentConfig = getPaymentStateConfig(customer.paymentState);
  
  // Check if there are any quotas to display
  const hasQuotasToDisplay = showEnergyQuota || showSwapQuota;

  return (
    <>
      {/* Customer Identity Panel */}
      <div className="customer-state-panel visible">
        <div className="customer-state-inner">
          {/* Customer Identity */}
          <div className="state-customer">
            <Avatar 
              initials={getInitials(customer.name)} 
              size="md" 
              variant="primary"
            />
            <div className="state-customer-info">
              <div className="state-plan-row">
                <span className="state-subscription-id">{customer.subscriptionId}</span>
                <span className="state-plan-separator">•</span>
                <span className="state-plan-name">{customer.subscriptionType}</span>
              </div>
            </div>
          </div>
          
          {/* Right side: States + Battery */}
          <div className="state-right-section">
            {/* State Badges */}
            <div className="state-badges-vertical">
              {customer.paymentState && (
                <Badge variant={paymentConfig.variant} size="xs">
                  {paymentConfig.shortLabel}
                </Badge>
              )}
              {customer.serviceState && (
                <Badge variant={serviceConfig.variant} size="xs">
                  {serviceConfig.shortLabel}
                </Badge>
              )}
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
      </div>

      {/* Quota Summary - only show if there are quotas to display */}
      {hasQuotasToDisplay && (
        <div className="state-quotas visible" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {/* Energy Quota - hidden for infinite quota services */}
          {showEnergyQuota && (
            <QuotaBar
              remaining={customer.energyRemaining || 0}
              total={customer.energyTotal || 100}
              unit="kWh"
              type="energy"
              icon={<BoltIcon size={16} />}
              monetaryValue={customer.energyValue}
              currency="XOF"
            />
          )}

          {/* Swaps Quota - hidden for infinite quota services */}
          {showSwapQuota && (
            <QuotaBar
              remaining={customer.swapsRemaining || 0}
              total={customer.swapsTotal || 10}
              unit="swaps left"
              type="swaps"
              icon={<SwapIcon size={16} />}
            />
          )}
        </div>
      )}
    </>
  );
}
