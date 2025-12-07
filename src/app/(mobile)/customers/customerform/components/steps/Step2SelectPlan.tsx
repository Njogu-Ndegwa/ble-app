'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { PlanData } from '../types';
import { 
  Screen, 
  PageHeader, 
  Grid,
  SelectableCard,
  EmptyState,
  ErrorState,
  SkeletonCard,
  CalendarIcon,
} from '@/components/ui';

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
    <Screen>
      <PageHeader 
        title={t('sales.selectPlan')} 
        subtitle={t('sales.choosePlan')}
        align="center"
      />

      {isLoadingPlans ? (
        <Grid columns={1} gap={12}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} showImage={false} lines={2} />
          ))}
        </Grid>
      ) : loadError ? (
        <ErrorState
          title={t('sales.connectionError') || 'Connection Error'}
          message={loadError}
          onRetry={onRetryLoad}
          retryLabel={t('common.tryAgain') || 'Try Again'}
          hint={t('sales.checkConnection') || 'Please check your internet connection'}
        />
      ) : plans.length === 0 ? (
        <EmptyState
          title={t('sales.noPlansTitle') || 'No Plans Available'}
          description={t('sales.noPlansDescription') || "Subscription plans couldn't be loaded from the server. This might be a temporary issue."}
          icon={<CalendarIcon size={40} />}
          action={onRetryLoad ? {
            label: t('common.tryAgain') || 'Try Again',
            onClick: onRetryLoad,
          } : undefined}
          hint={t('sales.noPlansHint') || 'If this persists, please contact support'}
        />
      ) : (
        <Grid columns={1} gap={8}>
          {plans.map((plan) => {
            const period = plan.period || getPeriodFromName(plan.name);
            const currencySymbol = plan.currencySymbol || 'KES';
            
            return (
              <SelectableCard
                key={plan.id}
                selected={selectedPlan === plan.id}
                onSelect={() => onPlanSelect(plan.id)}
                showRadio
                showCheck={false}
                className="plan-card"
                style={{ padding: '10px 12px' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  width: '100%',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 500, 
                      fontSize: '12px',
                      marginBottom: '1px',
                    }}>
                      {plan.name}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: 'var(--text-muted, #5a8080)',
                    }}>
                      {plan.description}
                    </div>
                  </div>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-brand, #00e5e5)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {currencySymbol} {plan.price.toLocaleString()}
                    <span style={{ 
                      fontSize: '9px', 
                      color: 'var(--text-muted, #5a8080)',
                      fontWeight: 400,
                      marginLeft: '2px',
                    }}>
                      {period}
                    </span>
                  </div>
                </div>
              </SelectableCard>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
