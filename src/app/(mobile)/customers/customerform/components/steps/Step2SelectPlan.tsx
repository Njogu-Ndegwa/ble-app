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
        <div className="error-state" style={{ textAlign: 'center', padding: '24px' }}>
          <svg 
            viewBox="0 0 24 24" 
            width="48" 
            height="48" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            style={{ margin: '0 auto 12px', color: '#ef4444' }}
          >
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p style={{ color: '#ef4444', marginBottom: '12px' }}>{loadError}</p>
          {onRetryLoad && (
            <button 
              className="btn btn-secondary"
              onClick={onRetryLoad}
              style={{ marginTop: '8px' }}
            >
              {t('common.retry') || 'Retry'}
            </button>
          )}
        </div>
      ) : plans.length === 0 ? (
        <div className="error-state" style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ color: '#9ca3af' }}>{t('sales.noPlansAvailable') || 'No subscription plans available'}</p>
          {onRetryLoad && (
            <button 
              className="btn btn-secondary"
              onClick={onRetryLoad}
              style={{ marginTop: '8px' }}
            >
              {t('common.retry') || 'Retry'}
            </button>
          )}
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
