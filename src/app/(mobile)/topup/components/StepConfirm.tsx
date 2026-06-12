"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { absApolloClient } from '@/lib/apollo-client';
import {
  SERVICE_TOPUP,
  type ServiceTopupResponse,
} from '@/lib/graphql/mutations';
import type { EmployeeUser } from '@/lib/attendant-auth';
import { round } from '@/lib/utils';
import {
  buildServiceTopupInput,
  appendRecentTopup,
  assessTopupResponse,
  getOrCreatePendingReference,
  clearPendingReference,
} from '../lib/topup-core';
import type { IdentifiedSub } from './StepIdentify';
import type { SelectedPlan } from './StepPlan';

export interface TopupReceipt {
  reference: string;
  kwhCredited: number;
  quotaBefore: number;
  quotaAfter: number;
  subscriptionCode: string;
  planName: string;
  currency: string;
  price: number;
  wasRetry?: boolean;
}

interface StepConfirmProps {
  employee: EmployeeUser;
  sub: IdentifiedSub;
  plan: SelectedPlan;
  onBack: () => void;
  onDone: (receipt: TopupReceipt) => void;
}

export default function StepConfirm({ employee, sub, plan, onBack, onDone }: StepConfirmProps) {
  const { t } = useI18n();
  // Reference survives unmount/refresh until the credit SUCCEEDS — retrying
  // the same sub+plan (even after Back navigation) reuses it so ABS dedupes.
  const reference = useMemo(
    () => getOrCreatePendingReference(employee.id, sub.subscriptionCode, plan.productId),
    [employee.id, sub.subscriptionCode, plan.productId],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceAfter = round(sub.energyRemaining + plan.declaredKwh, 2);

  const handleCommit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = buildServiceTopupInput({
        subscriptionCode: sub.subscriptionCode,
        energyServiceId: sub.energyServiceId,
        planPrice: plan.price,
        declaredKwh: plan.declaredKwh,
        reference,
      });

      const result = await absApolloClient.mutate<{ serviceTopup: ServiceTopupResponse }>({
        mutation: SERVICE_TOPUP,
        variables: { input },
      });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message || t('topup.failed') || 'Top-up failed');
      }
      const resp = result.data?.serviceTopup;
      if (!resp) {
        throw new Error(t('topup.noResponse') || 'No response from server');
      }

      const assessment = assessTopupResponse(resp);
      if (!assessment.ok) {
        throw new Error(
          assessment.reason
            || t('topup.rejected')
            || 'Top-up was rejected by the service. Nothing was credited.',
        );
      }
      const kwhCredited = assessment.isIdempotent ? plan.declaredKwh : resp.additional_quota;

      const receipt: TopupReceipt = {
        reference,
        kwhCredited,
        quotaBefore: sub.energyRemaining,
        quotaAfter: round(sub.energyRemaining + resp.additional_quota, 2),
        subscriptionCode: sub.subscriptionCode,
        planName: plan.name,
        currency: sub.currency,
        price: plan.price,
        wasRetry: assessment.isIdempotent,
      };
      clearPendingReference(sub.subscriptionCode, plan.productId);
      appendRecentTopup({
        subscriptionCode: sub.subscriptionCode,
        planName: plan.name,
        kwh: kwhCredited,
        reference,
        timestamp: new Date().toISOString(),
      });
      onDone(receipt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (t('topup.failed') || 'Top-up failed'));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, sub, plan, reference, onDone, t]);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.confirmTitle') || 'Review top-up'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('topup.confirmHint') || 'Check everything — this credits energy immediately and cannot be undone.'}
        </p>
      </div>

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {row(t('topup.subscriptionId') || 'Subscription ID', sub.subscriptionCode)}
        {sub.packageName && row(t('topup.package') || 'Package', sub.packageName)}
        {row(t('topup.plan') || 'Plan', plan.name)}
        {row(
          t('topup.planValue') || 'Plan value',
          `${sub.currency ? `${sub.currency} ` : ''}${plan.price.toLocaleString()}`,
        )}
        {row(
          t('topup.energyCredit') || 'Energy credit',
          <span style={{ color: 'var(--accent)' }}>{`+${plan.declaredKwh.toLocaleString()} kWh`}</span>,
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {row(
            t('topup.balanceChange') || 'Balance after top-up',
            `${sub.energyRemaining.toLocaleString()} → ${balanceAfter.toLocaleString()} kWh`,
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
      {error && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
          {t('topup.retryHint') || 'If this was a network problem, tap the credit button again from this screen — the retry is safe and cannot double-credit.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCommit}
          disabled={submitting}
          aria-busy={submitting}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Zap size={16} />
          {submitting
            ? (t('common.processing') || 'Processing...')
            : (t('topup.creditButton', { kwh: plan.declaredKwh.toLocaleString() }) || `Credit ${plan.declaredKwh.toLocaleString()} kWh`)}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
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
