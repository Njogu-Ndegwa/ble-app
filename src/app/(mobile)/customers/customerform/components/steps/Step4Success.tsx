'use client';

import React from 'react';
import { 
  CustomerFormData, 
  BatteryData,
  AVAILABLE_PLANS, 
  generateRegistrationId,
  getBatteryClass 
} from '../types';

interface Step4Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  battery: BatteryData | null;
  registrationId: string;
}

export default function Step4Success({ 
  formData, 
  selectedPlanId, 
  battery, 
  registrationId 
}: Step4Props) {
  const selectedPlan = AVAILABLE_PLANS.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const batteryClass = battery ? getBatteryClass(battery.chargeLevel) : 'full';

  return (
    <div className="screen active">
      <div className="success-screen" style={{ paddingTop: '30px' }}>
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="success-title">Registration Complete!</h2>
        <p className="success-message">Customer has been registered successfully</p>
        
        {/* Checkout Summary */}
        <div className="checkout-summary" style={{ textAlign: 'left' }}>
          <div className="receipt-header">
            <span className="receipt-title">Registration Summary</span>
            <span className="receipt-id font-mono-oves">{registrationId}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">Customer</span>
            <span className="checkout-item-value">{customerName}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">Phone</span>
            <span className="checkout-item-value font-mono-oves">{formData.phone}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">Plan</span>
            <span className="checkout-item-value">{selectedPlan?.name || 'N/A'}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">Battery Assigned</span>
            <span className="checkout-item-value font-mono-oves">{battery?.shortId || 'N/A'}</span>
          </div>
          <div className="checkout-item">
            <span className="checkout-item-label">Battery Charge</span>
            <span className="checkout-item-value" style={{ color: 'var(--success)' }}>
              {battery ? `${battery.chargeLevel}%` : 'N/A'}
            </span>
          </div>
          <div className="checkout-total">
            <span className="checkout-total-label">Amount Due</span>
            <span className="checkout-total-value font-mono-oves">
              KES {selectedPlan?.price.toLocaleString() || '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
