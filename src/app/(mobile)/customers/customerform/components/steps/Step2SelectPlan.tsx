'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { PlanData } from '../types';

interface Step2Props {
  selectedPlan: string;
  onPlanSelect: (planId: string) => void;
  plans: PlanData[];  // Plans from Odoo API - required, no fallback
  isLoadingPlans?: boolean;
  loadError?: string | null;  // Error message if plans failed to load
  onRetryLoad?: () => void;  // Callback to retry loading plans
}

// Helper to determine period display from plan name
const getPeriodFromName = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('daily') || nameLower.includes('day')) return '/day';
  if (nameLower.includes('weekly') || nameLower.includes('week')) return '/week';
  if (nameLower.includes('monthly') || nameLower.includes('month')) return '/month';
  if (nameLower.includes('yearly') || nameLower.includes('annual') || nameLower.includes('year')) return '/year';
  return '';
};

export default function Step2SelectPlan({ 
  selectedPlan, 
  onPlanSelect, 
  plans,
  isLoadingPlans = false,
  loadError = null,
  onRetryLoad,
}: Step2Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>{t('sales.selectPlan')}</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>{t('sales.choosePlan')}</p>

      {isLoadingPlans ? (
        <div className="product-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="product-card skeleton">
              <div className="skeleton-radio"></div>
              <div className="skeleton-info">
                <div className="skeleton-name"></div>
                <div className="skeleton-desc"></div>
              </div>
              <div className="skeleton-price"></div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="plans-error-state">
          {/* Error illustration */}
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
              {/* Pulsing ring effect */}
              <div className="plans-error-ring" />
              <div className="plans-error-ring plans-error-ring-delay" />
            </div>
            {/* Connection error lines */}
            <div className="plans-error-lines">
              <span className="error-line"></span>
              <span className="error-line"></span>
              <span className="error-line"></span>
            </div>
          </div>

          {/* Content */}
          <div className="plans-error-content">
            <h3 className="plans-error-title">
              {t('sales.connectionError') || 'Connection Error'}
            </h3>
            <p className="plans-error-description">
              {loadError}
            </p>
          </div>

          {/* Action */}
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

          {/* Help hint */}
          <p className="plans-error-hint">
            {t('sales.checkConnection') || 'Please check your internet connection'}
          </p>
        </div>
      ) : plans.length === 0 ? (
        <div className="empty-plans-state">
          {/* Decorative illustration */}
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
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h6" />
                <path d="M7 16h4" />
              </svg>
              <div className="empty-plans-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
            </div>
            {/* Floating particles for visual interest */}
            <div className="empty-plans-particles">
              <span className="particle"></span>
              <span className="particle"></span>
              <span className="particle"></span>
            </div>
          </div>

          {/* Content */}
          <div className="empty-plans-content">
            <h3 className="empty-plans-title">
              {t('sales.noPlansTitle') || 'No Plans Available'}
            </h3>
            <p className="empty-plans-description">
              {t('sales.noPlansDescription') || 'Subscription plans couldn\'t be loaded from the server. This might be a temporary issue.'}
            </p>
          </div>

          {/* Action */}
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

          {/* Help hint */}
          <p className="empty-plans-hint">
            {t('sales.noPlansHint') || 'If this persists, please contact support'}
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {plans.map((plan) => {
            const period = plan.period || getPeriodFromName(plan.name);
            const currencySymbol = plan.currencySymbol || 'KES';
            
            return (
              <div 
                key={plan.id}
                className={`product-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => onPlanSelect(plan.id)}
              >
                <div className="product-radio"></div>
                <div className="product-info">
                  <div className="product-name">{plan.name}</div>
                  <div className="product-desc">{plan.description}</div>
                </div>
                <div className="product-price">
                  {currencySymbol} {plan.price.toLocaleString()}
                  <span className="product-price-period">{period}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
