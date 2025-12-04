'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { ProductData } from '../types';

interface Step2Props {
  selectedProduct: string;
  onProductSelect: (productId: string) => void;
  products: ProductData[];  // Physical products from Odoo API (main_service category)
  isLoadingProducts?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
}

// Default placeholder image for products without images
const PLACEHOLDER_IMAGE = '/assets/placeholder-bike.png';

export default function Step2SelectProduct({ 
  selectedProduct, 
  onProductSelect, 
  products,
  isLoadingProducts = false,
  loadError = null,
  onRetryLoad,
}: Step2Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>
        {t('sales.selectProduct') || 'Select Vehicle'}
      </h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>
        {t('sales.chooseProduct') || 'Choose the vehicle for this customer'}
      </p>

      {isLoadingProducts ? (
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
      ) : products.length === 0 ? (
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
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
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
              {t('sales.noProductsTitle') || 'No Products Available'}
            </h3>
            <p className="empty-plans-description">
              {t('sales.noProductsDescription') || 'Products couldn\'t be loaded from the server. This might be a temporary issue.'}
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
            {t('sales.noProductsHint') || 'If this persists, please contact support'}
          </p>
        </div>
      ) : (
        <div className="vehicle-grid">
          {products.map((product) => {
            const currencySymbol = product.currencySymbol || 'KES';
            const hasImage = product.imageUrl && product.imageUrl.length > 0;
            
            return (
              <div 
                key={product.id}
                className={`vehicle-card ${selectedProduct === product.id ? 'selected' : ''}`}
                onClick={() => onProductSelect(product.id)}
              >
                {/* Selection check mark */}
                <div className="vehicle-card-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                
                {/* Product image */}
                <div className="vehicle-image-wrapper">
                  {hasImage ? (
                    <Image
                      src={product.imageUrl!}
                      alt={product.name}
                      width={120}
                      height={90}
                      className="vehicle-image"
                      style={{ objectFit: 'contain' }}
                      unoptimized // Cloudinary images don't need Next.js optimization
                    />
                  ) : (
                    <div className="vehicle-image-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Product info */}
                <div className="vehicle-info">
                  <div className="vehicle-name">{product.name}</div>
                  {product.defaultCode && (
                    <div className="vehicle-type">{product.defaultCode}</div>
                  )}
                  <div className="vehicle-price">
                    {currencySymbol} {product.price.toLocaleString()}
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
