'use client';

import React from 'react';
import { CustomerData, getInitials } from './types';
import { Phone, Battery, Zap, RefreshCw, Hash, CheckCircle, XCircle } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
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

// Get progress bar color based on percentage
const getQuotaColor = (percent: number): string => {
  if (percent > 50) return 'var(--success)';
  if (percent > 20) return 'var(--color-warning)';
  return 'var(--error)';
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
  
  // Count visible quotas for layout decisions
  const visibleQuotaCount = (showEnergyQuota ? 1 : 0) + (showSwapQuota ? 1 : 0);
  const singleQuotaLayout = visibleQuotaCount === 1 && customer.currentBatteryId;
  
  // Calculate percentages for mini progress bars
  const energyPercent = customer.energyTotal ? (customer.energyRemaining || 0) / customer.energyTotal * 100 : 0;
  const swapsPercent = customer.swapsTotal ? (customer.swapsRemaining || 0) / customer.swapsTotal * 100 : 0;

  // Format remaining values nicely
  const formatValue = (val: number): string => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1);
  };

  return (
    <div className="customer-panel-unified visible">
      {/* Row 1: Avatar + Identity + Right Column (Badges + Phone) */}
      <div className="panel-row-main">
        <Avatar 
          initials={getInitials(customer.name)} 
          size="sm" 
          variant="primary"
        />
        <div className="panel-identity">
          <span className="panel-name">{customer.name || 'Customer'}</span>
          <div className="panel-meta">
            <span className="panel-sub-code">{customer.subscriptionId}</span>
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
        <div className="panel-right-col">
          <div className="panel-badges">
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
          {customer.phone && (
            <span className="panel-phone">
              <Phone size={9} />
              {customer.phone}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Quotas + Battery - compact inline */}
      {(hasQuotasToDisplay || customer.currentBatteryId) && (
        <div className={`panel-row-services ${singleQuotaLayout ? 'single-quota' : ''}`}>
          {/* Energy Quota Mini */}
          {showEnergyQuota && (
            <div className="panel-quota">
              <Zap size={12} className="quota-icon energy" />
              <div className="quota-info">
                <span className="quota-value">{formatValue(customer.energyRemaining || 0)}</span>
                <span className="quota-unit">kWh</span>
              </div>
              <div className="quota-bar-mini">
                <div 
                  className="quota-bar-fill" 
                  style={{ 
                    width: `${Math.min(energyPercent, 100)}%`,
                    background: getQuotaColor(energyPercent)
                  }} 
                />
              </div>
            </div>
          )}

          {/* Swaps Quota Mini */}
          {showSwapQuota && (
            <div className="panel-quota">
              <RefreshCw size={12} className="quota-icon swaps" />
              <div className="quota-info">
                <span className="quota-value">{customer.swapsRemaining || 0}</span>
                <span className="quota-unit">swaps</span>
              </div>
              <div className="quota-bar-mini">
                <div 
                  className="quota-bar-fill" 
                  style={{ 
                    width: `${Math.min(swapsPercent, 100)}%`,
                    background: getQuotaColor(swapsPercent)
                  }} 
                />
              </div>
            </div>
          )}

          {/* Current Battery */}
          {customer.currentBatteryId && (
            <div className="panel-battery">
              <Battery size={12} />
              <span>{customer.currentBatteryId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
