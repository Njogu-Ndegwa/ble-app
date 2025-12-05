'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { Package, CreditCard, Battery, CheckCircle } from 'lucide-react';
import { 
  CustomerFormData, 
  BatteryData,
  PlanData,
  PackageData,
  getBatteryClass 
} from '../types';

interface Step5Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  battery: BatteryData | null;
  registrationId: string;
  paymentReference?: string;
  plans: PlanData[];  // Plans from Odoo API
  // NEW: Package data to show what customer purchased
  selectedPackage?: PackageData | null;
  subscriptionCode?: string;  // Subscription ID from payment
  amountPaid?: number;  // Actual amount paid by customer
}

export default function Step5Success({ 
  formData, 
  selectedPlanId, 
  battery, 
  registrationId,
  paymentReference,
  plans,
  selectedPackage,
  subscriptionCode,
  amountPaid,
}: Step5Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const batteryClass = battery ? getBatteryClass(battery.chargeLevel) : 'full';

  // Calculate total amount paid
  // Priority: amountPaid prop > package price + plan price
  const packagePrice = selectedPackage?.price || 0;
  const planPrice = selectedPlan?.price || 0;
  const totalPurchaseAmount = amountPaid || (packagePrice + planPrice);
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';

  return (
    <div className="screen active">
      <div className="success-screen" style={{ paddingTop: '20px' }}>
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="success-title">{t('sales.registrationComplete')}</h2>
        <p className="success-message">{t('sales.customerRegistered')}</p>
        
        {/* Checkout Summary */}
        <div className="checkout-summary" style={{ textAlign: 'left' }}>
          {/* Registration Header */}
          <div className="receipt-header">
            <span className="receipt-title">{t('sales.registrationId')}</span>
            <span className="receipt-id font-mono-oves">{registrationId}</span>
          </div>

          {/* Customer Info */}
          <div className="checkout-item">
            <span className="checkout-item-label">{t('sales.customerName')}</span>
            <span className="checkout-item-value">{customerName}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">{t('sales.phoneNumber')}</span>
            <span className="checkout-item-value font-mono-oves">{formData.phone}</span>
          </div>

          {/* Purchases Section */}
          <div style={{ 
            borderTop: '1px dashed var(--color-border)', 
            marginTop: '12px', 
            paddingTop: '12px' 
          }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: 600, 
              color: 'var(--color-text-secondary)', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {t('sales.purchasedItems') || 'Purchased Items'}
            </div>

            {/* Package (Product + Privilege Bundle) */}
            {selectedPackage && (
              <div className="checkout-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <Package size={14} style={{ color: 'var(--color-primary)' }} />
                  <span className="checkout-item-label" style={{ flex: 1 }}>
                    {t('sales.package') || 'Package'}
                  </span>
                  <span className="checkout-item-value font-mono-oves" style={{ fontWeight: 600 }}>
                    {currencySymbol} {packagePrice.toLocaleString()}
                  </span>
                </div>
                <div style={{ 
                  marginLeft: '20px', 
                  fontSize: '12px', 
                  color: 'var(--color-text-secondary)' 
                }}>
                  {selectedPackage.name}
                  {/* Show main product if available */}
                  {selectedPackage.mainProduct && (
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>
                      • {selectedPackage.mainProduct.name}
                    </div>
                  )}
                  {/* Show battery swap privilege if available */}
                  {selectedPackage.batterySwapPrivilege && (
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>
                      • {selectedPackage.batterySwapPrivilege.name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subscription Plan */}
            {selectedPlan && (
              <div className="checkout-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <CreditCard size={14} style={{ color: 'var(--color-primary)' }} />
                  <span className="checkout-item-label" style={{ flex: 1 }}>
                    {t('sales.subscription') || 'Subscription'}
                  </span>
                  <span className="checkout-item-value font-mono-oves" style={{ fontWeight: 600 }}>
                    {selectedPlan.currencySymbol} {planPrice.toLocaleString()}
                  </span>
                </div>
                <div style={{ 
                  marginLeft: '20px', 
                  fontSize: '12px', 
                  color: 'var(--color-text-secondary)' 
                }}>
                  {selectedPlan.name}
                  {selectedPlan.period && (
                    <span style={{ marginLeft: '4px', fontSize: '11px', opacity: 0.8 }}>
                      ({selectedPlan.period})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Subscription Code */}
            {subscriptionCode && (
              <div className="checkout-item" style={{ marginTop: '8px' }}>
                <span className="checkout-item-label">{t('sales.subscriptionId') || 'Subscription ID'}</span>
                <span className="checkout-item-value font-mono-oves" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {subscriptionCode}
                </span>
              </div>
            )}
          </div>

          {/* Battery Assignment Section */}
          <div style={{ 
            borderTop: '1px dashed var(--color-border)', 
            marginTop: '12px', 
            paddingTop: '12px' 
          }}>
            <div className="checkout-item">
              <span className="checkout-item-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Battery size={14} style={{ color: 'var(--color-primary)' }} />
                {t('sales.assignedBattery')}
              </span>
              <span className="checkout-item-value font-mono-oves">{battery?.shortId || 'N/A'}</span>
            </div>
            <div className="checkout-item">
              <span className="checkout-item-label">{t('sales.batteryCharge')}</span>
              <span className="checkout-item-value" style={{ color: 'var(--success)' }}>
                {battery ? `${battery.chargeLevel}%` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Payment Reference */}
          {paymentReference && (
            <div className="checkout-item" style={{ marginTop: '8px' }}>
              <span className="checkout-item-label">{t('sales.paymentRef')}</span>
              <span className="checkout-item-value font-mono-oves">{paymentReference}</span>
            </div>
          )}

          {/* Amount Paid (not Due - customer already paid) */}
          <div className="checkout-total" style={{ marginTop: '12px' }}>
            <span className="checkout-total-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              {t('sales.amountPaid') || 'Amount Paid'}
            </span>
            <span className="checkout-total-value font-mono-oves" style={{ color: 'var(--success)' }}>
              {currencySymbol} {totalPurchaseAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
