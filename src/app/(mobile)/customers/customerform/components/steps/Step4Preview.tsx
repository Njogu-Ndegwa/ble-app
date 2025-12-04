'use client';

import React, { useState } from 'react';
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
  const [showBreakdown, setShowBreakdown] = useState(false);
  
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
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>
        {t('sales.orderSummary') || 'Order Summary'}
      </h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '16px' }}>
        {t('sales.reviewBeforePayment') || 'Review before collecting payment'}
      </p>

      {/* Package Visual Display */}
      {selectedPackage && (
        <div className="preview-package-card">
          <div className="preview-package-image">
            {hasImage ? (
              <Image
                src={imageUrl!}
                alt={selectedPackage.name}
                width={100}
                height={75}
                className="preview-image"
                style={{ objectFit: 'contain' }}
                unoptimized
              />
            ) : (
              <div className="preview-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
            )}
          </div>
          <div className="preview-package-info">
            <div className="preview-package-name">{selectedPackage.name}</div>
            {selectedPackage.mainProduct && (
              <div className="preview-package-product">{selectedPackage.mainProduct.name}</div>
            )}
            <div className="preview-package-price">
              {currencySymbol} {packagePrice.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Cost Breakdown Card */}
      <div className="cost-card preview-cost-card">
        <div className="cost-title">
          {t('sales.priceBreakdown') || 'Price Breakdown'}
        </div>
        
        {/* Package Section */}
        {selectedPackage && (
          <>
            <div className="cost-row cost-row-main">
              <span className="cost-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cost-icon">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                {selectedPackage.name}
              </span>
              <span className="cost-value">{currencySymbol} {packagePrice.toLocaleString()}</span>
            </div>
            
            {/* Component Breakdown Toggle */}
            {selectedPackage.components && selectedPackage.components.length > 0 && (
              <div className="cost-breakdown-section">
                <button 
                  className="cost-breakdown-toggle"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                >
                  <span>{showBreakdown ? t('sales.hideDetails') || 'Hide details' : t('sales.showDetails') || 'What\'s included'}</span>
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={`breakdown-chevron ${showBreakdown ? 'open' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                
                {showBreakdown && (
                  <div className="cost-breakdown-items">
                    {selectedPackage.components.map((component, index) => (
                      <div key={component.id || index} className="cost-row cost-row-sub">
                        <span className="cost-label cost-label-sub">
                          {component.is_main_service && (
                            <span className="component-badge component-badge-product">
                              {t('sales.product') || 'Product'}
                            </span>
                          )}
                          {component.is_battery_swap && (
                            <span className="component-badge component-badge-privilege">
                              {t('sales.privilege') || 'Privilege'}
                            </span>
                          )}
                          {!component.is_main_service && !component.is_battery_swap && (
                            <span className="component-badge">
                              {t('sales.addon') || 'Add-on'}
                            </span>
                          )}
                          <span className="component-name">{component.name}</span>
                        </span>
                        <span className="cost-value cost-value-sub">
                          {component.currencySymbol || currencySymbol} {component.price_unit.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="cost-breakdown-note">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                      </svg>
                      <span>{t('sales.packagePricingNote') || 'Package pricing offers savings compared to individual items'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Subscription Section */}
        {selectedPlan && (
          <div className="cost-row cost-row-main">
            <span className="cost-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cost-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {selectedPlan.name}
            </span>
            <span className="cost-value">{currencySymbol} {subscriptionPrice.toLocaleString()}</span>
          </div>
        )}

        {/* Divider */}
        <div className="cost-divider"></div>

        {/* Total */}
        <div className="cost-total">
          <span className="cost-total-label">{t('sales.totalAmount') || 'Total Amount'}</span>
          <span className="cost-total-value">{currencySymbol} {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="customer-card preview-customer-card">
        <div className="customer-header">
          <div className="customer-avatar">{initials}</div>
          <div className="customer-info">
            <div className="customer-name">{customerName}</div>
            <div className="customer-details">
              <span>{formData.phone}</span>
              <span className="customer-divider">•</span>
              <span>{formData.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ready to Proceed Message */}
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
