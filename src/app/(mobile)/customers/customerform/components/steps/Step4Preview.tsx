'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PackageData, 
  PlanData,
  getInitials 
} from '../types';

interface Step4Props {
  formData: CustomerFormData;
  selectedPackage: PackageData | null;
  selectedPlan: PlanData | null;
}

export default function Step4Preview({ 
  formData, 
  selectedPackage, 
  selectedPlan,
}: Step4Props) {
  const { t } = useI18n();
  
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate totals
  const packagePrice = selectedPackage?.price || 0;
  const subscriptionPrice = selectedPlan?.price || 0;
  const totalAmount = packagePrice + subscriptionPrice;
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';
  
  // Get image from package or main product
  const imageUrl = selectedPackage?.imageUrl || selectedPackage?.mainProduct?.image_url;
  const hasImage = imageUrl && imageUrl.length > 0;

  return (
    <div className="screen active compact-preview">
      {/* Compact Header with Total */}
      <div className="preview-compact-header">
        <h2 className="preview-compact-title">{t('sales.orderSummary') || 'Order Summary'}</h2>
        <div className="preview-compact-total">
          <span className="preview-compact-total-label">{t('sales.total') || 'Total'}</span>
          <span className="preview-compact-total-amount">{currencySymbol} {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Customer Row - Inline Compact */}
      <div className="preview-compact-row">
        <div className="preview-compact-avatar">{initials}</div>
        <div className="preview-compact-info">
          <span className="preview-compact-name">{customerName}</span>
          <span className="preview-compact-detail">{formData.phone}</span>
          {formData.email && <span className="preview-compact-detail">{formData.email}</span>}
        </div>
      </div>

      {/* Package & Subscription in Compact Cards */}
      <div className="preview-compact-grid">
        {/* Package Card */}
        {selectedPackage && (
          <div className="preview-compact-card">
            <div className="preview-compact-card-header">
              <div className="preview-compact-card-icon">
                {hasImage ? (
                  <Image
                    src={imageUrl!}
                    alt={selectedPackage.name}
                    width={32}
                    height={32}
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                )}
              </div>
              <div className="preview-compact-card-content">
                <span className="preview-compact-card-label">{t('sales.package') || 'Package'}</span>
                <span className="preview-compact-card-name">{selectedPackage.name}</span>
              </div>
              <span className="preview-compact-card-price">{currencySymbol} {packagePrice.toLocaleString()}</span>
            </div>
            
            {/* Compact Components List */}
            {selectedPackage.components && selectedPackage.components.length > 0 && (
              <div className="preview-compact-components">
                {selectedPackage.components.map((component, index) => (
                  <div key={component.id || index} className="preview-compact-component">
                    <span>{component.name}</span>
                    <span>{component.currencySymbol || currencySymbol} {component.price_unit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscription Card */}
        {selectedPlan && (
          <div className="preview-compact-card">
            <div className="preview-compact-card-header">
              <div className="preview-compact-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="preview-compact-card-content">
                <span className="preview-compact-card-label">{t('sales.subscription') || 'Subscription'}</span>
                <span className="preview-compact-card-name">{selectedPlan.name}</span>
              </div>
              <span className="preview-compact-card-price">{currencySymbol} {subscriptionPrice.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Ready to Proceed - Compact */}
      <div className="preview-compact-ready">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>{t('sales.readyToProceed') || 'Ready to collect payment'}</span>
      </div>
    </div>
  );
}
