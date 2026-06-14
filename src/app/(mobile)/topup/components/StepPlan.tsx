"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Zap, AlertCircle, Loader2, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import {
  GET_SERVICE_PLAN_TEMPLATE,
  extractEnergyConfiguration,
  type ServicePlanTemplate,
} from '@/lib/graphql/mutations';
import { getSubscriptionProducts } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { filterPlansByPackage } from '@/lib/plan-filter';
import type { IdentifiedSub } from './StepIdentify';

export interface SelectedPlan {
  name: string;
  productId: number;
  price: number;
  templateId?: string;
  declaredKwh: number;
}

interface PlanOption {
  name: string;
  description?: string;
  price: number;
  productId: number;
  default_code: string;
  templateId?: string;
}

interface StepPlanProps {
  sub: IdentifiedSub;
  onBack: () => void;
  onSelected: (plan: SelectedPlan) => void;
}

export default function StepPlan({ sub, onBack, onSelected }: StepPlanProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlanOption | null>(null);
  const [quota, setQuota] = useState<{ productId: number; kwh: number } | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const token = getSalesRoleToken();
        const res = await getSubscriptionProducts(1, 50, token || undefined);
        if (cancelled) return;
        setPlans(
          (res.data?.products || []).map<PlanOption>((p) => ({
            name: p.name,
            description: p.description || undefined,
            price: p.list_price,
            productId: p.id,
            default_code: p.default_code || `P-${p.id}`,
            templateId: p.x_template_id || undefined,
          })),
        );
      } catch (err: unknown) {
        if (!cancelled) setPlansError(err instanceof Error ? err.message : 'Failed to load plans');
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Same package → plan narrowing as Sales / Activator / Rider, using the
  // multi-candidate filter (template id + product name) so the picker stays
  // narrowed even when the Odoo status lookup didn't return a product name.
  const visiblePlans = useMemo(
    () => filterPlansByPackage(sub.packageFilter, plans),
    [sub.packageFilter, plans],
  );

  const handleSelect = useCallback(async (plan: PlanOption) => {
    const seq = ++seqRef.current;
    setSelected(plan);
    setQuota(null);
    setQuotaError(null);
    setQuotaLoading(true);
    try {
      const lookupId = plan.templateId || plan.name;
      const result = await absApolloClient.query<{ servicePlanTemplate: ServicePlanTemplate | null }>({
        query: GET_SERVICE_PLAN_TEMPLATE,
        variables: { id: lookupId },
        fetchPolicy: "network-only",
      });
      if (seq !== seqRef.current) return; // stale response - a newer selection owns the UI
      if (result.errors && result.errors.length > 0) {
        setQuotaError(result.errors[0].message || t("topup.quotaUnavailable") || "Could not load this plan’s energy quota.");
        return;
      }
      const energy = extractEnergyConfiguration(result.data?.servicePlanTemplate);
      if (energy && energy.initialQuota > 0) {
        setQuota({ productId: plan.productId, kwh: energy.initialQuota });
      } else {
        setQuotaError(t("topup.quotaUnavailable") || "Could not load this plan’s energy quota.");
      }
    } catch {
      if (seq === seqRef.current) {
        setQuotaError(t("topup.quotaUnavailable") || "Could not load this plan’s energy quota.");
      }
    } finally {
      if (seq === seqRef.current) setQuotaLoading(false);
    }
  }, [t]);

  const declaredKwh = selected && quota?.productId === selected.productId ? quota.kwh : null;

  const canContinue = !!selected && !!declaredKwh && declaredKwh > 0 && !quotaLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.planTitle') || 'Choose a plan'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {sub.packageName
            ? (t('topup.planHintFiltered', { package: sub.packageName }) || `Plans for ${sub.packageName}.`)
            : sub.packageFilter.length > 0
              ? (t('topup.planHintMatched') || "Plans matched to the customer's package.")
              : (t('topup.planHint') || 'All available plans.')}
        </p>
      </div>

      <div className="energy-plan-list">
        {plansLoading && (
          <>
            <div className="energy-plan-skeleton" />
            <div className="energy-plan-skeleton" />
            <div className="energy-plan-skeleton" />
          </>
        )}

        {plansError && (
          <div
            role="alert"
            style={{
              display: 'flex', gap: 8, padding: 12, fontSize: 12,
              background: 'var(--error-soft, var(--bg-secondary))',
              color: 'var(--error, var(--text-primary))',
              border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{plansError}</span>
          </div>
        )}

        {!plansLoading && !plansError && visiblePlans.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('topup.noPlans') || 'No plans available right now.'}
          </div>
        )}

        {visiblePlans.map((plan) => {
          const isSelected = selected?.productId === plan.productId;
          return (
            <button
              key={plan.productId}
              type="button"
              className={`energy-plan-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => handleSelect(plan)}
              aria-pressed={isSelected}
            >
              <div className="energy-plan-icon"><Zap size={18} /></div>
              <div className="energy-plan-body">
                <div className="energy-plan-title">{plan.name || plan.templateId}</div>
                {(plan.description || plan.default_code) && (
                  <div className="energy-plan-subtitle">{plan.description || plan.default_code}</div>
                )}
                {isSelected && (
                  <div className="energy-plan-energy" role="status">
                    {quotaLoading ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        <span>{t('common.loading') || 'Loading...'}</span>
                      </>
                    ) : declaredKwh ? (
                      <>
                        <Zap size={11} />
                        <span>{`+${declaredKwh.toLocaleString()} kWh`}</span>
                      </>
                    ) : quotaError ? (
                      <>
                        <AlertCircle size={11} />
                        <span>{quotaError}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="energy-plan-price">
                {sub.currency ? `${sub.currency} ` : ''}{plan.price.toLocaleString()}
              </div>
              {isSelected && (
                <div className="energy-plan-check" aria-hidden="true"><Check size={14} /></div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canContinue}
          onClick={() => {
            if (!selected || !declaredKwh) return;
            onSelected({
              name: selected.name || selected.templateId || '',
              productId: selected.productId,
              price: selected.price,
              templateId: selected.templateId,
              declaredKwh,
            });
          }}
          style={{ width: '100%' }}
        >
          {t('common.continue') || 'Continue'}
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
          }}
        >
          {t('sales.back') || 'Back'}
        </button>
      </div>
    </div>
  );
}
