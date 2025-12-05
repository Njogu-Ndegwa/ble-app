'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  BatteryData,
  PlanData,
  PackageData,
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

  // Calculate total amount paid
  const packagePrice = selectedPackage?.price || 0;
  const planPrice = selectedPlan?.price || 0;
  const totalPurchaseAmount = amountPaid || (packagePrice + planPrice);
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';

  return (
    <div className="screen active">
      <div className="success-screen" style={{ paddingTop: '12px' }}>
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="success-title">{t('sales.registrationComplete')}</h2>
        <p className="success-message">{t('sales.customerRegistered')}</p>
        
        {/* Receipt Card - Full width with left-aligned text */}
        <div className="receipt-card" style={{ width: '100%', textAlign: 'left' }}>
          <div className="receipt-header">
            <span className="receipt-title">{t('sales.registrationId')}</span>
            <span className="receipt-id font-mono-oves">{registrationId}</span>
          </div>
          
          {/* Customer Info */}
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.customerName')}</span>
            <span className="receipt-value">{customerName}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.phoneNumber')}</span>
            <span className="receipt-value font-mono-oves">{formData.phone}</span>
          </div>

          {/* Package */}
          {selectedPackage && (
            <div className="receipt-row">
              <span className="receipt-label">{t('sales.package') || 'Package'}</span>
              <span className="receipt-value">{selectedPackage.name}</span>
            </div>
          )}

          {/* Subscription Plan */}
          {selectedPlan && (
            <div className="receipt-row">
              <span className="receipt-label">{t('sales.subscription') || 'Subscription'}</span>
              <span className="receipt-value">{selectedPlan.name}</span>
            </div>
          )}

          {/* Subscription Code */}
          {subscriptionCode && (
            <div className="receipt-row">
              <span className="receipt-label">{t('sales.subscriptionId') || 'Subscription ID'}</span>
              <span className="receipt-value font-mono-oves">{subscriptionCode}</span>
            </div>
          )}

          {/* Battery Assignment */}
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.assignedBattery')}</span>
            <span className="receipt-value font-mono-oves">
              {battery?.shortId || 'N/A'} ({battery ? `${battery.chargeLevel}%` : 'N/A'})
            </span>
          </div>

          {/* Payment Reference */}
          {paymentReference && (
            <div className="receipt-row">
              <span className="receipt-label">{t('sales.paymentRef')}</span>
              <span className="receipt-value font-mono-oves">{paymentReference}</span>
            </div>
          )}

          {/* Amount Paid */}
          <div className="receipt-row">
            <span className="receipt-label">{t('sales.amountPaid') || 'Amount Paid'}</span>
            <span className="receipt-value font-mono-oves" style={{ color: 'var(--success)' }}>
              {currencySymbol} {totalPurchaseAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
