'use client';

import React from 'react';
import { CustomerData, getInitials } from './types';
import { Phone, Mail, Battery, Hash, CheckCircle, XCircle } from 'lucide-react';
import { 
  Avatar, 
  Badge, 
  QuotaBar,
  BoltIcon,
  SwapIcon,
} from '@/components/ui';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  
  if (!visible || !customer) return null;

  // Check for infinite quota services (should not be displayed)
  const showEnergyQuota = !customer.hasInfiniteEnergyQuota;
  const showSwapQuota = !customer.hasInfiniteSwapQuota;

  const serviceConfig = getServiceStateConfig(customer.serviceState);
  const paymentConfig = getPaymentStateConfig(customer.paymentState);
  
  // Check if there are any quotas to display
  const hasQuotasToDisplay = showEnergyQuota || showSwapQuota;
  
  // Check if we have contact info
  const hasContactInfo = customer.phone || customer.email;

  return (
    <>
      {/* Customer Identity Card */}
      <div className="customer-state-panel visible">
        <div className="customer-card">
          {/* Header Row: Avatar + Name + Badges */}
          <div className="customer-card-header">
            <Avatar 
              initials={getInitials(customer.name)} 
              size="md" 
              variant="primary"
            />
            <div className="customer-card-identity">
              <span className="customer-card-name">{customer.name || 'Customer'}</span>
              <span className="customer-card-sub-id">{customer.subscriptionId}</span>
            </div>
            <div className="customer-card-badges">
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
          </div>

          {/* Details Grid: Contact + Plan + Battery */}
          <div className="customer-card-details">
            {/* Contact Info */}
            {customer.phone && (
              <div className="customer-detail-item">
                <Phone size={12} />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="customer-detail-item">
                <Mail size={12} />
                <span>{customer.email}</span>
              </div>
            )}
            {/* Plan Type */}
            {customer.subscriptionType && (
              <div className="customer-detail-item">
                <Hash size={12} />
                <span>{customer.subscriptionType}</span>
              </div>
            )}
            {/* Plan Status */}
            {customer.isPlanActive !== undefined && (
              <div className="customer-detail-item" style={{
                color: customer.isPlanActive ? 'var(--success)' : 'var(--error)'
              }}>
                {customer.isPlanActive ? (
                  <CheckCircle size={12} />
                ) : (
                  <XCircle size={12} />
                )}
                <span>{customer.isPlanActive 
                  ? (t('common.active') || 'Active') 
                  : (t('common.inactive') || 'Inactive')
                }</span>
              </div>
            )}
            {/* Current Battery */}
            {customer.currentBatteryId && (
              <div className="customer-detail-item customer-detail-battery">
                <Battery size={12} />
                <span>{customer.currentBatteryId}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quota Summary - only show if there are quotas to display */}
      {hasQuotasToDisplay && (
        <div className="state-quotas visible">
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
