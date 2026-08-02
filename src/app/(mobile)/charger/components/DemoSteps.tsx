"use client";

/**
 * Demo stand-ins for the two steps that would otherwise need a backend.
 *
 * These deliberately do NOT reuse StepIdentify/StepPlan: those components call
 * ABS and Odoo on mount, and demo mode's whole point is that it reaches
 * nothing. They mirror the real screens' shape (echo-back card, plan list with
 * price and quota) so the walkthrough still reflects the real flow.
 */

import React, { useState } from 'react';
import { CheckCircle2, Check, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { IdentifiedSub } from '../../topup/components/StepIdentify';
import type { SelectedPlan } from '../../topup/components/StepPlan';
import { DEMO_PLANS, DEMO_SUB } from '../lib/demo';

export function DemoStepIdentify({ onIdentified }: { onIdentified: (s: IdentifiedSub) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.identifyTitle')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('charger.demoIdentifyHint')}
        </p>
      </div>

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {DEMO_SUB.subscriptionCode}
          </span>
          <span
            style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px',
              borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)',
            }}
          >
            {DEMO_SUB.odooStatus}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {t('charger.customer')}: {DEMO_SUB.customerName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {t('topup.package') || 'Package'}: {DEMO_SUB.packageName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
          <Zap size={14} style={{ color: 'var(--accent)' }} />
          <span>{`${DEMO_SUB.energyRemaining} / ${DEMO_SUB.energyTotal} kWh`}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onIdentified(DEMO_SUB)}
          style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <CheckCircle2 size={16} />
          {t('charger.demoUseSubscription')}
        </button>
      </div>
    </div>
  );
}

export function DemoStepPlan({
  sub, onBack, onSelected,
}: {
  sub: IdentifiedSub;
  onBack: () => void;
  onSelected: (p: SelectedPlan) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<SelectedPlan | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.planTitle')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('charger.demoPlanHint')}
        </p>
      </div>

      <div className="energy-plan-list">
        {DEMO_PLANS.map((plan) => {
          const isSelected = selected?.productId === plan.productId;
          return (
            <button
              key={plan.productId}
              type="button"
              className={`energy-plan-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => setSelected(plan)}
              aria-pressed={isSelected}
            >
              <div className="energy-plan-icon"><Zap size={18} /></div>
              <div className="energy-plan-body">
                <div className="energy-plan-title">{plan.name}</div>
                {isSelected && (
                  <div className="energy-plan-energy" role="status">
                    <Zap size={11} />
                    <span>{`+${plan.declaredKwh.toLocaleString()} kWh`}</span>
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
          disabled={!selected}
          onClick={() => selected && onSelected(selected)}
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
