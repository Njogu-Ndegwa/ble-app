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
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '16px' }}>
        {t('sales.orderSummary') || 'Order Summary'}
      </h2>

      {/* Total Amount - Prominent at Top */}
      <div className="preview-total-card">
        <div className="preview-total-label">{t('sales.totalAmount') || 'Total Amount'}</div>
        <div className="preview-total-amount">{currencySymbol} {totalAmount.toLocaleString()}</div>
      </div>

      {/* Customer Info Card */}
      <div className="preview-simple-card">
        <div className="preview-card-header">
          <div className="preview-avatar">{initials}</div>
          <div className="preview-customer-info">
            <div className="preview-customer-name">{customerName}</div>
            <div className="preview-customer-contact">{formData.phone}</div>
            {formData.email && <div className="preview-customer-contact">{formData.email}</div>}
          </div>
        </div>
      </div>

      {/* Package Card */}
      {selectedPackage && (
        <div className="preview-simple-card">
          <div className="preview-card-title">{t('sales.package') || 'Package'}</div>
          <div className="preview-item-row">
            <div className="preview-item-image">
              {hasImage ? (
                <Image
                  src={imageUrl!}
                  alt={selectedPackage.name}
                  width={48}
                  height={48}
                  style={{ objectFit: 'contain' }}
                  unoptimized
                />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              )}
            </div>
            <div className="preview-item-details">
              <div className="preview-item-name">{selectedPackage.name}</div>
              {selectedPackage.mainProduct && (
                <div className="preview-item-sub">{selectedPackage.mainProduct.name}</div>
              )}
            </div>
            <div className="preview-item-price">{currencySymbol} {packagePrice.toLocaleString()}</div>
          </div>

          {/* Package Components - Always Visible */}
          {selectedPackage.components && selectedPackage.components.length > 0 && (
            <div className="preview-components">
              <div className="preview-components-title">{t('sales.includes') || 'Includes'}:</div>
              {selectedPackage.components.map((component, index) => (
                <div key={component.id || index} className="preview-component-item">
                  <span className="preview-component-name">{component.name}</span>
                  <span className="preview-component-price">
                    {component.currencySymbol || currencySymbol} {component.price_unit.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscription Plan Card */}
      {selectedPlan && (
        <div className="preview-simple-card">
          <div className="preview-card-title">{t('sales.subscription') || 'Subscription'}</div>
          <div className="preview-item-row">
            <div className="preview-item-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="preview-item-details">
              <div className="preview-item-name">{selectedPlan.name}</div>
            </div>
            <div className="preview-item-price">{currencySymbol} {subscriptionPrice.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Ready to Proceed */}
      <div className="preview-ready-message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>{t('sales.readyToProceed') || 'Ready to collect payment'}</span>
      </div>
    </div>
  );
}
