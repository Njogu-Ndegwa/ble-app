'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { PackageData } from '../types';

interface Step2Props {
  selectedPackage: string;
  onPackageSelect: (packageId: string) => void;
  packages: PackageData[];  // Packages from Odoo API (product + privilege bundled)
  isLoadingPackages?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
}

export default function Step2SelectPackage({ 
  selectedPackage, 
  onPackageSelect, 
  packages,
  isLoadingPackages = false,
  loadError = null,
  onRetryLoad,
}: Step2Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>
        {t('sales.selectPackage') || 'Select Package'}
      </h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>
        {t('sales.choosePackage') || 'Choose the best deal for this customer'}
      </p>

      {isLoadingPackages ? (
        <div className="vehicle-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="vehicle-card skeleton">
              <div className="skeleton-image"></div>
              <div className="skeleton-info">
                <div className="skeleton-name"></div>
                <div className="skeleton-type"></div>
              </div>
              <div className="skeleton-price"></div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="plans-error-state">
          <div className="plans-error-illustration">
            <div className="plans-error-icon-wrapper">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="plans-error-icon"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="plans-error-ring" />
              <div className="plans-error-ring plans-error-ring-delay" />
            </div>
            <div className="plans-error-lines">
              <span className="error-line"></span>
              <span className="error-line"></span>
              <span className="error-line"></span>
            </div>
          </div>

          <div className="plans-error-content">
            <h3 className="plans-error-title">
              {t('sales.connectionError') || 'Connection Error'}
            </h3>
            <p className="plans-error-description">
              {loadError}
            </p>
          </div>

          {onRetryLoad && (
            <button 
              className="plans-error-retry-btn"
              onClick={onRetryLoad}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {t('common.tryAgain') || 'Try Again'}
            </button>
          )}

          <p className="plans-error-hint">
            {t('sales.checkConnection') || 'Please check your internet connection'}
          </p>
        </div>
      ) : packages.length === 0 ? (
        <div className="empty-plans-state">
          <div className="empty-plans-illustration">
            <div className="empty-plans-icon-wrapper">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="empty-plans-icon"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <div className="empty-plans-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="empty-plans-particles">
              <span className="particle"></span>
              <span className="particle"></span>
              <span className="particle"></span>
            </div>
          </div>

          <div className="empty-plans-content">
            <h3 className="empty-plans-title">
              {t('sales.noPackagesTitle') || 'No Packages Available'}
            </h3>
            <p className="empty-plans-description">
              {t('sales.noPackagesDescription') || 'Packages couldn\'t be loaded from the server. This might be a temporary issue.'}
            </p>
          </div>

          {onRetryLoad && (
            <button 
              className="empty-plans-retry-btn"
              onClick={onRetryLoad}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {t('common.tryAgain') || 'Try Again'}
            </button>
          )}

          <p className="empty-plans-hint">
            {t('sales.noPackagesHint') || 'If this persists, please contact support'}
          </p>
        </div>
      ) : (
        <div className="vehicle-grid">
          {packages.map((pkg) => {
            const currencySymbol = pkg.currencySymbol || 'KES';
            // Get image from main product component or package itself
            const imageUrl = pkg.imageUrl || pkg.mainProduct?.image_url;
            const hasImage = imageUrl && imageUrl.length > 0;
            
            return (
              <div 
                key={pkg.id}
                className={`vehicle-card package-card ${selectedPackage === pkg.id ? 'selected' : ''}`}
                onClick={() => onPackageSelect(pkg.id)}
              >
                {/* Selection check mark */}
                <div className="vehicle-card-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                
                {/* Package badge */}
                <div className="package-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  <span>{t('sales.deal') || 'Deal'}</span>
                </div>
                
                {/* Product image */}
                <div className="vehicle-image-wrapper">
                  {hasImage ? (
                    <Image
                      src={imageUrl!}
                      alt={pkg.name}
                      width={120}
                      height={90}
                      className="vehicle-image"
                      style={{ objectFit: 'contain' }}
                      unoptimized // Cloudinary images don't need Next.js optimization
                    />
                  ) : (
                    <div className="vehicle-image-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Package info */}
                <div className="vehicle-info">
                  <div className="vehicle-name">{pkg.name}</div>
                  {/* Show main product name if different from package name */}
                  {pkg.mainProduct && pkg.mainProduct.name !== pkg.name && (
                    <div className="vehicle-type">{pkg.mainProduct.name}</div>
                  )}
                  {/* Package price */}
                  <div className="vehicle-price">
                    {currencySymbol} {pkg.price.toLocaleString()}
                  </div>
                  {/* Show what's included - subtle fineprint */}
                  <div className="package-includes">
                    {pkg.componentCount} {pkg.componentCount === 1 ? 'item' : 'items'} included
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
