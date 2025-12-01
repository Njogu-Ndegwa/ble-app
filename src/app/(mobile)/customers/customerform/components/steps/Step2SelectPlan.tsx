'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { PlanData, AVAILABLE_PLANS } from '../types';

interface Step2Props {
  selectedPlan: string;
  onPlanSelect: (planId: string) => void;
}

// Map plan IDs to translation keys
const PLAN_TRANSLATIONS: Record<string, { nameKey: string; descKey: string; periodKey: string }> = {
  daily: { nameKey: 'sales.dailyPass', descKey: 'sales.dailyDesc', periodKey: 'sales.perDay' },
  weekly: { nameKey: 'sales.weeklyPlan', descKey: 'sales.weeklyDesc', periodKey: 'sales.perWeek' },
  monthly: { nameKey: 'sales.monthlyPlan', descKey: 'sales.monthlyDesc', periodKey: 'sales.perMonth' },
  payperswap: { nameKey: 'sales.payPerSwap', descKey: 'sales.payPerSwapDesc', periodKey: 'sales.deposit' },
};

export default function Step2SelectPlan({ selectedPlan, onPlanSelect }: Step2Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>{t('sales.selectPlan')}</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>{t('sales.choosePlan')}</p>

      <div className="product-grid">
        {AVAILABLE_PLANS.map((plan) => {
          const translations = PLAN_TRANSLATIONS[plan.id];
          return (
            <div 
              key={plan.id}
              className={`product-card ${selectedPlan === plan.id ? 'selected' : ''}`}
              onClick={() => onPlanSelect(plan.id)}
            >
              <div className="product-radio"></div>
              <div className="product-info">
                <div className="product-name">{translations ? t(translations.nameKey) : plan.name}</div>
                <div className="product-desc">{translations ? t(translations.descKey) : plan.description}</div>
              </div>
              <div className="product-price">
                KES {plan.price.toLocaleString()}
                <span className="product-price-period">{translations ? t(translations.periodKey) : plan.period}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
