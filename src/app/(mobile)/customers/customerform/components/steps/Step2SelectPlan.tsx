'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { PlanData, FALLBACK_PLANS } from '../types';

interface Step2Props {
  selectedPlan: string;
  onPlanSelect: (planId: string) => void;
  plans?: PlanData[];  // Plans from Odoo API
  isLoadingPlans?: boolean;
}

// Map plan IDs to translation keys (for fallback plans)
const PLAN_TRANSLATIONS: Record<string, { nameKey: string; descKey: string; periodKey: string }> = {
  daily: { nameKey: 'sales.dailyPass', descKey: 'sales.dailyDesc', periodKey: 'sales.perDay' },
  weekly: { nameKey: 'sales.weeklyPlan', descKey: 'sales.weeklyDesc', periodKey: 'sales.perWeek' },
  monthly: { nameKey: 'sales.monthlyPlan', descKey: 'sales.monthlyDesc', periodKey: 'sales.perMonth' },
  payperswap: { nameKey: 'sales.payPerSwap', descKey: 'sales.payPerSwapDesc', periodKey: 'sales.deposit' },
};

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
  isLoadingPlans = false 
}: Step2Props) {
  const { t } = useI18n();
  
  // Use provided plans or fallback
  const displayPlans = plans && plans.length > 0 ? plans : FALLBACK_PLANS;
  
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
      ) : (
        <div className="product-grid">
          {displayPlans.map((plan) => {
            // Check if this is a fallback plan with translations
            const translations = plan.odooProductId === 0 ? PLAN_TRANSLATIONS[plan.id] : null;
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
                  <div className="product-name">
                    {translations ? t(translations.nameKey) : plan.name}
                  </div>
                  <div className="product-desc">
                    {translations ? t(translations.descKey) : plan.description}
                  </div>
                </div>
                <div className="product-price">
                  {currencySymbol} {plan.price.toLocaleString()}
                  <span className="product-price-period">
                    {translations ? t(translations.periodKey) : period}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
