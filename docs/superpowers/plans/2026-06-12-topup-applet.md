# Staff Top-Up Applet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staff-only applet at `/topup` that validates a subscription ID, lets staff pick a package-filtered service plan, and credits energy via ABS `serviceTopup` — no payment step, no transaction ID, no Odoo writes.

**Architecture:** Four-step wizard (Identify → Plan → Confirm → Done) in `src/app/(mobile)/topup/`. Pure top-up math/reference/persistence logic lives in `lib/topup-core.ts` (unit-tested). Reuses `useCustomerIdentification`, `getSubscriptionStatus`, `getSubscriptionProducts`, `filterPlansByPackage`, `GET_SERVICE_PLAN_TEMPLATE`, `SERVICE_TOPUP`, and the existing `energy-plan-card` styles.

**Tech Stack:** Next.js (app router, client components), Apollo (`absApolloClient`), Odoo REST helpers, vitest (new — unit tests only).

**Spec:** `docs/superpowers/specs/2026-06-12-topup-applet-design.md`

---

### Task 1: Vitest setup (repo has no test framework)

**Files:**
- Modify: `package.json` (add devDependency + script)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`
Expected: added to devDependencies without errors.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In `"scripts"`, after `"lint": "next lint"` add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: exits reporting "No test files found" (this is OK at this point).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

### Task 2: Pure top-up core logic (TDD)

**Files:**
- Create: `src/app/(mobile)/topup/lib/topup-core.ts`
- Test: `src/app/(mobile)/topup/lib/__tests__/topup-core.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  buildStaffTopupReference,
  buildServiceTopupInput,
  loadRecentTopups,
  appendRecentTopup,
  type RecentTopup,
} from '../topup-core';

describe('buildStaffTopupReference', () => {
  it('embeds employee id and timestamp, stays unique-ish', () => {
    const ref = buildStaffTopupReference(42, new Date('2026-06-12T10:15:30Z'));
    expect(ref).toMatch(/^staff-topup-42-20260612101530-[a-z0-9]{4}$/);
  });
});

describe('buildServiceTopupInput', () => {
  const base = {
    subscriptionCode: 'SUB-001',
    energyServiceId: 'service-energy-togo-004',
    planPrice: 12500,
    declaredKwh: 200,
    reference: 'staff-topup-42-x',
  };

  it('builds the ABS input with inverse unit price', () => {
    const input = buildServiceTopupInput(base);
    expect(input).toEqual({
      plan_id: 'SUB-001',
      service_id: 'service-energy-togo-004',
      payment_amount: 12500,
      unit_price: 12500 / 200,
      payment_reference: 'staff-topup-42-x',
      correlation_id: 'staff-topup-42-x',
    });
  });

  it('round-trips to the declared kWh at ABS 4-dp rounding', () => {
    // Awkward price/kWh pair that exercises floating point
    const input = buildServiceTopupInput({ ...base, planPrice: 9999.99, declaredKwh: 130 });
    const credited = Math.round((input.payment_amount / input.unit_price) * 10000) / 10000;
    expect(credited).toBe(130);
  });

  it('rejects missing subscription code', () => {
    expect(() => buildServiceTopupInput({ ...base, subscriptionCode: '' })).toThrow(/subscription/i);
  });

  it('rejects missing service id', () => {
    expect(() => buildServiceTopupInput({ ...base, energyServiceId: '' })).toThrow(/service/i);
  });

  it('rejects non-positive declared kWh', () => {
    expect(() => buildServiceTopupInput({ ...base, declaredKwh: 0 })).toThrow(/quota/i);
  });

  it('rejects non-positive price', () => {
    expect(() => buildServiceTopupInput({ ...base, planPrice: 0 })).toThrow(/price/i);
  });
});

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('recent top-ups persistence', () => {
  const entry: RecentTopup = {
    subscriptionCode: 'SUB-001',
    planName: 'B45-200 kWh',
    kwh: 200,
    reference: 'staff-topup-42-x',
    timestamp: '2026-06-12T10:15:30Z',
  };

  it('returns [] on empty/corrupt storage', () => {
    const s = memStorage();
    expect(loadRecentTopups(s)).toEqual([]);
    s.setItem('topup-recent-v1', '{not json');
    expect(loadRecentTopups(s)).toEqual([]);
  });

  it('appends newest-first and caps at 20', () => {
    const s = memStorage();
    for (let i = 0; i < 25; i++) {
      appendRecentTopup({ ...entry, reference: `ref-${i}` }, s);
    }
    const list = loadRecentTopups(s);
    expect(list).toHaveLength(20);
    expect(list[0].reference).toBe('ref-24');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../topup-core`.

- [ ] **Step 3: Implement `topup-core.ts`**

```ts
/**
 * Pure logic for the staff Top-Up applet. No React, no network — unit-tested.
 *
 * There is NO transaction id in this flow: the reference generated here is
 * the only identifier. It is sent as BOTH `payment_reference` (service-layer
 * idempotency → PaymentAction id) and `correlation_id` (agent-layer
 * idempotency), so retries can never double-credit, and it doubles as the
 * audit trail of which employee performed the top-up.
 */
import { round } from '@/lib/utils';
import type { ServiceTopupInput } from '@/lib/graphql/mutations';

export function buildStaffTopupReference(
  employeeId: string | number,
  now: Date = new Date(),
): string {
  const ts = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `staff-topup-${employeeId}-${ts}-${rand}`;
}

export interface StaffTopupParams {
  subscriptionCode: string;
  energyServiceId: string;
  planPrice: number;
  declaredKwh: number;
  reference: string;
}

/**
 * ABS computes credited quota as payment_amount / unit_price (4-dp rounded).
 * We want to credit exactly the catalog's declared kWh, so unit_price is the
 * inverse: payment_amount / declaredKwh — same approach as the rider flow.
 * The pre-flight check refuses to send anything that wouldn't round-trip.
 */
export function buildServiceTopupInput(p: StaffTopupParams): ServiceTopupInput {
  if (!p.subscriptionCode) throw new Error('Missing subscription code');
  if (!p.energyServiceId) throw new Error('Missing energy service id');
  if (!(p.declaredKwh > 0)) throw new Error('Plan has no declared energy quota');
  const paymentAmount = round(p.planPrice, 2);
  if (!(paymentAmount > 0)) throw new Error('Plan price must be positive');

  const unitPrice = paymentAmount / p.declaredKwh;
  const previewKwh = Math.round((paymentAmount / unitPrice) * 10000) / 10000;
  if (Math.abs(previewKwh - p.declaredKwh) > 0.0001) {
    throw new Error('Top-up precision check failed');
  }

  return {
    plan_id: p.subscriptionCode,
    service_id: p.energyServiceId,
    payment_amount: paymentAmount,
    unit_price: unitPrice,
    payment_reference: p.reference,
    correlation_id: p.reference,
  };
}

// ── Recent top-ups (device-local audit list) ────────────────────────────────

const RECENT_KEY = 'topup-recent-v1';
const RECENT_MAX = 20;

export interface RecentTopup {
  subscriptionCode: string;
  planName: string;
  kwh: number;
  reference: string;
  timestamp: string; // ISO
}

export function loadRecentTopups(storage?: Storage): RecentTopup[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) return [];
  try {
    const raw = s.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendRecentTopup(entry: RecentTopup, storage?: Storage): RecentTopup[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const list = [entry, ...loadRecentTopups(s)].slice(0, RECENT_MAX);
  try {
    s?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Quota/private-mode failures must never break the flow.
  }
  return list;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(mobile)/topup/lib"
git commit -m "feat(topup): pure core logic — reference, ABS input builder, recent list"
```

---

### Task 3: Wizard shell + Step 1 (Identify)

**Files:**
- Create: `src/app/(mobile)/topup/TopupFlow.tsx`
- Create: `src/app/(mobile)/topup/components/StepIdentify.tsx`

The wizard owns all cross-step state. Step 1 fires `identifyCustomer` (ABS) and `getSubscriptionStatus` (Odoo) in parallel; the echo-back card gates progression (Hakikisha pattern). Gates: no energy service → block; infinite quota → block; cancelled → block; paused → warn.

- [ ] **Step 1: Create `TopupFlow.tsx`**

```tsx
"use client";

import React, { useCallback, useState } from 'react';
import { useI18n } from '@/i18n';
import type { EmployeeUser } from '@/lib/attendant-auth';
import StepIdentify, { type IdentifiedSub } from './components/StepIdentify';
import StepPlan, { type SelectedPlan } from './components/StepPlan';
import StepConfirm, { type TopupReceipt } from './components/StepConfirm';
import StepDone from './components/StepDone';

export type TopupStep = 'identify' | 'plan' | 'confirm' | 'done';

interface TopupFlowProps {
  employee: EmployeeUser;
}

const STEP_ORDER: TopupStep[] = ['identify', 'plan', 'confirm', 'done'];

export default function TopupFlow({ employee }: TopupFlowProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<TopupStep>('identify');
  const [sub, setSub] = useState<IdentifiedSub | null>(null);
  const [plan, setPlan] = useState<SelectedPlan | null>(null);
  const [receipt, setReceipt] = useState<TopupReceipt | null>(null);

  const reset = useCallback(() => {
    setSub(null);
    setPlan(null);
    setReceipt(null);
    setStep('identify');
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="page-content" style={{ paddingBottom: 24 }}>
      {/* Stepper dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            aria-hidden="true"
            style={{
              width: i === stepIndex ? 20 : 8,
              height: 8,
              borderRadius: 4,
              transition: 'all .2s',
              background: i <= stepIndex ? 'var(--accent)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {step === 'identify' && (
        <StepIdentify
          onIdentified={(s) => { setSub(s); setStep('plan'); }}
        />
      )}

      {step === 'plan' && sub && (
        <StepPlan
          sub={sub}
          onBack={() => setStep('identify')}
          onSelected={(p) => { setPlan(p); setStep('confirm'); }}
        />
      )}

      {step === 'confirm' && sub && plan && (
        <StepConfirm
          employee={employee}
          sub={sub}
          plan={plan}
          onBack={() => setStep('plan')}
          onDone={(r) => { setReceipt(r); setStep('done'); }}
        />
      )}

      {step === 'done' && receipt && (
        <StepDone receipt={receipt} onRestart={reset} />
      )}

      {/* i18n anchor so the namespace is referenced from the flow root */}
      <span style={{ display: 'none' }}>{t('topup.title') || 'Top-Up'}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/StepIdentify.tsx`**

```tsx
"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Search, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useCustomerIdentification, type ServiceState } from '@/lib/hooks/useCustomerIdentification';
import { getSubscriptionStatus } from '@/lib/odoo-api';
import { round } from '@/lib/utils';
import RecentTopups from './RecentTopups';

/** Everything later steps need about the validated subscription. */
export interface IdentifiedSub {
  subscriptionCode: string;
  /** Odoo product_name — drives the PRODUCT_SERVICE_MAP plan filter. Null if Odoo lookup failed. */
  packageName: string | null;
  /** Raw Odoo subscription status, lowercased ('active' | 'paused' | ...). Null if lookup failed. */
  odooStatus: string | null;
  energyServiceId: string;
  energyRemaining: number;
  energyTotal: number;
  currency: string;
}

interface StepIdentifyProps {
  onIdentified: (sub: IdentifiedSub) => void;
}

const INFINITE_QUOTA_THRESHOLD = 100000;

export default function StepIdentify({ onIdentified }: StepIdentifyProps) {
  const { t } = useI18n();
  const [subInput, setSubInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<IdentifiedSub | null>(null);

  const { identifyCustomer, cancelIdentification } = useCustomerIdentification({
    attendantInfo: { id: 'topup-applet', station: 'topup-applet' },
    silent: true,
    onError: (msg) => { setError(msg); setLoading(false); },
    onSuccess: async (result) => {
      const states: ServiceState[] = result.serviceStates;
      const energy = states.find(
        (s) => s.service_id?.includes('service-energy') || s.service_id?.includes('service-electricity'),
      );

      // Gate: this applet only credits energy.
      if (!energy) {
        setError(t('topup.noEnergyService') || 'This subscription has no energy service to top up.');
        setLoading(false);
        return;
      }
      // Gate: unlimited-energy plans have nothing to top up.
      if ((energy.quota || 0) > INFINITE_QUOTA_THRESHOLD) {
        setError(t('topup.infiniteQuota') || 'This subscription has unlimited energy — nothing to top up.');
        setLoading(false);
        return;
      }

      const code = result.customer.subscriptionId;

      // Odoo status/package lookup — degrades gracefully (package unknown →
      // plan filter falls back to the full list).
      let packageName: string | null = null;
      let odooStatus: string | null = null;
      try {
        const statusRes = await getSubscriptionStatus(code);
        const s = statusRes.data?.subscription;
        if (s) {
          packageName = s.product_name || null;
          odooStatus = (s.status || '').toLowerCase() || null;
        }
      } catch (err) {
        console.warn('[TOPUP] Odoo status lookup failed — proceeding without package filter:', err);
      }

      // Gate: cancelled subs are blocked outright.
      if (odooStatus && /cancel|closed|terminated/.test(odooStatus)) {
        setError(
          (t('topup.subCancelled') || 'This subscription is {status} — top-up is not allowed.')
            .replace('{status}', odooStatus),
        );
        setLoading(false);
        return;
      }
      // Paused → allowed, but staff must see it.
      if (odooStatus && /pause|hold|suspend/.test(odooStatus)) {
        setWarning(
          (t('topup.subPaused') || 'This subscription is {status}. Top-up is allowed, but check with the customer.')
            .replace('{status}', odooStatus),
        );
      }

      setCandidate({
        subscriptionCode: code,
        packageName,
        odooStatus,
        energyServiceId: energy.service_id,
        energyRemaining: round((energy.quota || 0) - (energy.used || 0), 2),
        energyTotal: energy.quota || 0,
        currency: result.currencySymbol,
      });
      setLoading(false);
    },
  });

  useEffect(() => () => cancelIdentification(), [cancelIdentification]);

  const handleValidate = useCallback(() => {
    const code = subInput.trim();
    if (!code) return;
    setError(null);
    setWarning(null);
    setCandidate(null);
    setLoading(true);
    identifyCustomer({ subscriptionCode: code, source: 'manual' });
  }, [subInput, identifyCustomer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.identifyTitle') || 'Find subscription'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('topup.identifyHint') || 'Enter the customer’s subscription ID to begin.'}
        </p>
      </div>

      <div>
        <label className="form-label">{t('topup.subscriptionId') || 'Subscription ID'}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input manual-id-input"
            placeholder={t('topup.subscriptionIdPlaceholder') || 'e.g. SUB12345'}
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleValidate(); }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={!subInput.trim() || loading}
            aria-label={t('topup.validate') || 'Validate'}
            style={{ paddingInline: 16 }}
          >
            {loading
              ? (t('common.loading') || 'Loading...')
              : <Search size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Echo-back card — staff verifies this is the right customer before continuing */}
      {candidate && (
        <div
          style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {candidate.subscriptionCode}
            </span>
            {candidate.odooStatus && (
              <span
                style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px',
                  borderRadius: 999,
                  background: /pause|hold|suspend/.test(candidate.odooStatus)
                    ? 'var(--warning-soft, rgba(234,179,8,.15))' : 'var(--accent-soft)',
                  color: /pause|hold|suspend/.test(candidate.odooStatus)
                    ? 'var(--warning, #eab308)' : 'var(--accent)',
                }}
              >
                {candidate.odooStatus}
              </span>
            )}
          </div>

          {candidate.packageName && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {(t('topup.package') || 'Package')}: {candidate.packageName}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span>
              {(t('topup.energyBalance') || 'Energy: {remaining} of {total} kWh left')
                .replace('{remaining}', candidate.energyRemaining.toLocaleString())
                .replace('{total}', candidate.energyTotal.toLocaleString())}
            </span>
          </div>

          {warning && (
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--warning, #eab308)' }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{warning}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onIdentified(candidate)}
            style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <CheckCircle2 size={16} />
            {t('topup.confirmCustomer') || 'This is the right subscription'}
          </button>
        </div>
      )}

      <RecentTopups />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck (no tests for UI — covered by build + e2e)**

Run: `npx tsc --noEmit`
Expected: errors ONLY for the not-yet-created `StepPlan` / `StepConfirm` / `StepDone` / `RecentTopups` imports — note them and proceed (they are created in Tasks 4–6). Any other error must be fixed now.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(mobile)/topup"
git commit -m "feat(topup): wizard shell and identify step with echo-back gate"
```

---

### Task 4: Step 2 (Plan picker)

**Files:**
- Create: `src/app/(mobile)/topup/components/StepPlan.tsx`

Catalog from `getSubscriptionProducts` (staff token), filtered with the shared `filterPlansByPackage`. Selecting a card fires the template quota lookup; Continue stays disabled until a declared kWh > 0 is known (never credit an unknown quantity).

- [ ] **Step 1: Create `components/StepPlan.tsx`**

```tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [declaredKwh, setDeclaredKwh] = useState<number | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

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

  // Same package → plan narrowing as Sales / Activator / Rider.
  const visiblePlans = useMemo(
    () => filterPlansByPackage(sub.packageName, plans),
    [sub.packageName, plans],
  );

  const handleSelect = useCallback(async (plan: PlanOption) => {
    setSelected(plan);
    setDeclaredKwh(null);
    setQuotaError(null);
    setQuotaLoading(true);
    try {
      const lookupId = plan.templateId || plan.name;
      const result = await absApolloClient.query<{ servicePlanTemplate: ServicePlanTemplate | null }>({
        query: GET_SERVICE_PLAN_TEMPLATE,
        variables: { id: lookupId },
        fetchPolicy: 'network-only',
      });
      const energy = extractEnergyConfiguration(result.data?.servicePlanTemplate);
      if (energy && energy.initialQuota > 0) {
        setDeclaredKwh(energy.initialQuota);
      } else {
        setQuotaError(t('topup.quotaUnavailable') || 'Could not load this plan’s energy quota.');
      }
    } catch {
      setQuotaError(t('topup.quotaUnavailable') || 'Could not load this plan’s energy quota.');
    } finally {
      setQuotaLoading(false);
    }
  }, [t]);

  const canContinue = !!selected && !!declaredKwh && declaredKwh > 0 && !quotaLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('topup.planTitle') || 'Choose a plan'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {(sub.packageName
            ? (t('topup.planHintFiltered') || 'Plans for {package}.').replace('{package}', sub.packageName)
            : (t('topup.planHint') || 'All available plans.'))}
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
                  <div className="energy-plan-energy">
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only for `StepConfirm` / `StepDone` / `RecentTopups` (Tasks 5–6).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(mobile)/topup/components/StepPlan.tsx"
git commit -m "feat(topup): plan picker filtered by package with quota lookup"
```

---

### Task 5: Step 3 (Confirm & commit)

**Files:**
- Create: `src/app/(mobile)/topup/components/StepConfirm.tsx`

The reference is generated ONCE when the step mounts and reused for every retry — ABS dedupes on it, so a timeout after a successful credit cannot double-credit. Button is verb-labeled ("Credit 200 kWh").

- [ ] **Step 1: Create `components/StepConfirm.tsx`**

```tsx
"use client";

import React, { useCallback, useRef, useState } from 'react';
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
  buildStaffTopupReference,
  buildServiceTopupInput,
  appendRecentTopup,
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
  // One reference per confirm screen — retries reuse it so ABS can dedupe.
  const referenceRef = useRef<string>(buildStaffTopupReference(employee.id ?? 'unknown'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceAfter = round(sub.energyRemaining + plan.declaredKwh, 2);

  const handleCommit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const input = buildServiceTopupInput({
        subscriptionCode: sub.subscriptionCode,
        energyServiceId: sub.energyServiceId,
        planPrice: plan.price,
        declaredKwh: plan.declaredKwh,
        reference: referenceRef.current,
      });

      const result = await absApolloClient.mutate<{ serviceTopup: ServiceTopupResponse }>({
        mutation: SERVICE_TOPUP,
        variables: { input },
      });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message || 'Top-up failed');
      }
      const resp = result.data?.serviceTopup;
      if (!resp) {
        throw new Error('No response from server');
      }

      const receipt: TopupReceipt = {
        reference: referenceRef.current,
        kwhCredited: resp.additional_quota,
        quotaBefore: resp.quota_before,
        quotaAfter: resp.quota_after,
        subscriptionCode: sub.subscriptionCode,
        planName: plan.name,
        currency: sub.currency,
        price: plan.price,
      };
      appendRecentTopup({
        subscriptionCode: sub.subscriptionCode,
        planName: plan.name,
        kwh: resp.additional_quota,
        reference: referenceRef.current,
        timestamp: new Date().toISOString(),
      });
      onDone(receipt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setSubmitting(false);
    }
  }, [sub, plan, onDone]);

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCommit}
          disabled={submitting}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Zap size={16} />
          {submitting
            ? (t('common.processing') || 'Processing...')
            : (t('topup.creditButton') || 'Credit {kwh} kWh').replace('{kwh}', plan.declaredKwh.toLocaleString())}
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only for `StepDone` / `RecentTopups` (Task 6).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(mobile)/topup/components/StepConfirm.tsx"
git commit -m "feat(topup): confirm step — verb-labeled commit, retry-safe reference"
```

---

### Task 6: Step 4 (Done) + RecentTopups

**Files:**
- Create: `src/app/(mobile)/topup/components/StepDone.tsx`
- Create: `src/app/(mobile)/topup/components/RecentTopups.tsx`

- [ ] **Step 1: Create `components/StepDone.tsx`**

```tsx
"use client";

import React, { useCallback, useState } from 'react';
import { Zap, Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { TopupReceipt } from './StepConfirm';

interface StepDoneProps {
  receipt: TopupReceipt;
  onRestart: () => void;
}

export default function StepDone({ receipt, onRestart }: StepDoneProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(receipt.reference);
      } else {
        const ta = document.createElement('textarea');
        ta.value = receipt.reference;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[TOPUP] Clipboard copy failed:', err);
    }
  }, [receipt.reference]);

  return (
    <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
        }}
      >
        <Zap size={32} />
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {`+${receipt.kwhCredited.toLocaleString()} kWh`}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {(t('topup.doneDesc') || '{sub} now has {after} kWh (was {before}).')
            .replace('{sub}', receipt.subscriptionCode)
            .replace('{after}', receipt.quotaAfter.toLocaleString())
            .replace('{before}', receipt.quotaBefore.toLocaleString())}
        </p>
      </div>

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 12, textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        <span className="form-label" style={{ margin: 0 }}>
          {t('topup.reference') || 'Reference'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all',
          }}
          aria-label={t('topup.copyReference') || 'Copy reference'}
        >
          <span style={{ textAlign: 'left' }}>{receipt.reference}</span>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={onRestart} style={{ width: '100%' }}>
          {t('topup.topUpAnother') || 'Top up another'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/RecentTopups.tsx`**

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { History, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { loadRecentTopups, type RecentTopup } from '../lib/topup-core';

export default function RecentTopups() {
  const { t } = useI18n();
  const [items, setItems] = useState<RecentTopup[]>([]);

  // localStorage is browser-only — load after mount to stay SSR-safe.
  useEffect(() => {
    setItems(loadRecentTopups());
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 8,
        }}
      >
        <History size={13} />
        {t('topup.recentTitle') || 'Recent top-ups (this device)'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.slice(0, 5).map((item) => (
          <div
            key={item.reference}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', padding: '10px 12px', fontSize: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.subscriptionCode}
              </div>
              <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {new Date(item.timestamp).toLocaleString()} · {item.reference}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
              <Zap size={12} />
              {`+${item.kwh.toLocaleString()}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Full typecheck — all imports now exist**

Run: `npx tsc --noEmit`
Expected: clean for `src/app/(mobile)/topup/**` (pre-existing errors elsewhere in the repo, if any, are out of scope — note them but don't fix).

- [ ] **Step 4: Run unit tests again**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(mobile)/topup/components"
git commit -m "feat(topup): receipt screen and device-local recent top-ups list"
```

---

### Task 7: Route wrapper (auth shell)

**Files:**
- Create: `src/app/(mobile)/topup/TopupApp.tsx`
- Create: `src/app/(mobile)/topup/page.tsx`

`page.tsx` clones the Activator pattern: login → selectSA → app, with the shared Login (`userType="sales"`) and `SelectServiceAccount`. `TopupApp` renders `AppHeader` + `TopupFlow`.

- [ ] **Step 1: Create `TopupApp.tsx`**

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import AppHeader from '@/components/AppHeader';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onLogout, onSwitchSA }: TopupAppProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) setEmployee(user);
    setCurrentSA(getSelectedSA('sales'));
  }, []);

  const handleLogout = () => {
    clearSalesRoleLogin();
    if (onLogout) onLogout();
    else router.push('/');
  };

  return (
    <div className="app-shell" style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      <AppHeader
        title={t('topup.title') || 'Top-Up'}
        user={employee}
        serviceAccount={currentSA}
        onLogout={handleLogout}
        onSwitchSA={onSwitchSA}
      />
      {employee && <TopupFlow employee={employee} />}
    </div>
  );
}
```

**NOTE for implementer:** check `AppHeader`'s actual prop names before using (`src/components/AppHeader.tsx`) — mirror exactly how `ActivatorApp` renders it (read `ActivatorApp.tsx:94-110` region) and adjust the props above to match. This is the one place the plan defers to the codebase because ActivatorApp's full AppHeader usage wasn't captured in the spec.

- [ ] **Step 2: Create `page.tsx`** — copy `src/app/(mobile)/activator/page.tsx` verbatim with these changes only:
  - `const ActivatorApp = dynamic(() => import('./ActivatorApp')...` → `const TopupApp = dynamic(() => import('./TopupApp')...`
  - `microsoftReturnPath="/activator"` → `microsoftReturnPath="/topup"`
  - `export default function ActivatorPage()` → `export default function TopupPage()`
  - `{screen === 'app' && <ActivatorApp ...` → `{screen === 'app' && <TopupApp ...`
  - `console.error('[ActivatorPage] ...` → `console.error('[TopupPage] ...`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean for the topup directory.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(mobile)/topup"
git commit -m "feat(topup): route wrapper with employee login + SA selection"
```

---

### Task 8: Registration + i18n

**Files:**
- Modify: `src/components/roles/SelectRole.tsx` (APPLET_SLUG_MAP ~line 38, ALL_ROLES ~line 57)
- Modify: `src/lib/auth.tsx` (APPLET_MENU_IDS ~line 78)
- Modify: `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`, `src/i18n/messages/zh.json`

- [ ] **Step 1: Register the role tile**

In `APPLET_SLUG_MAP` add:

```ts
  topup: 'topup',
```

In `ALL_ROLES`, after the `activator` entry add (import `Zap` from `lucide-react` at the top of the file if not already imported):

```ts
  {
    id: 'topup',
    labelKey: 'role.topup',
    icon: { type: 'lucide', el: <Zap size={28} />, gradient: 'role-grad-activator' },
    path: '/topup',
    appletSlug: 'topup',
  },
```

- [ ] **Step 2: Sidebar visibility**

In `APPLET_MENU_IDS` (`src/lib/auth.tsx:78`) add:

```ts
  topup: ['topup'],
```

- [ ] **Step 3: i18n strings**

`en.json` — add near the other `role.*` keys:

```json
"role.topup": "Top-Up",
"role.topupDesc": "Energy Top-Up (no payment)",
```

and a `topup.*` block:

```json
"topup.title": "Top-Up",
"topup.identifyTitle": "Find subscription",
"topup.identifyHint": "Enter the customer’s subscription ID to begin.",
"topup.subscriptionId": "Subscription ID",
"topup.subscriptionIdPlaceholder": "e.g. SUB12345",
"topup.validate": "Validate",
"topup.confirmCustomer": "This is the right subscription",
"topup.package": "Package",
"topup.energyBalance": "Energy: {remaining} of {total} kWh left",
"topup.noEnergyService": "This subscription has no energy service to top up.",
"topup.infiniteQuota": "This subscription has unlimited energy — nothing to top up.",
"topup.subCancelled": "This subscription is {status} — top-up is not allowed.",
"topup.subPaused": "This subscription is {status}. Top-up is allowed, but check with the customer.",
"topup.planTitle": "Choose a plan",
"topup.planHint": "All available plans.",
"topup.planHintFiltered": "Plans for {package}.",
"topup.noPlans": "No plans available right now.",
"topup.quotaUnavailable": "Could not load this plan’s energy quota.",
"topup.confirmTitle": "Review top-up",
"topup.confirmHint": "Check everything — this credits energy immediately and cannot be undone.",
"topup.plan": "Plan",
"topup.planValue": "Plan value",
"topup.energyCredit": "Energy credit",
"topup.balanceChange": "Balance after top-up",
"topup.creditButton": "Credit {kwh} kWh",
"topup.doneDesc": "{sub} now has {after} kWh (was {before}).",
"topup.reference": "Reference",
"topup.copyReference": "Copy reference",
"topup.topUpAnother": "Top up another",
"topup.recentTitle": "Recent top-ups (this device)"
```

`fr.json` — same keys:

```json
"role.topup": "Recharge",
"role.topupDesc": "Recharge d’énergie (sans paiement)",
"topup.title": "Recharge",
"topup.identifyTitle": "Trouver l’abonnement",
"topup.identifyHint": "Saisissez l’ID d’abonnement du client pour commencer.",
"topup.subscriptionId": "ID d’abonnement",
"topup.subscriptionIdPlaceholder": "ex. SUB12345",
"topup.validate": "Valider",
"topup.confirmCustomer": "C’est le bon abonnement",
"topup.package": "Forfait",
"topup.energyBalance": "Énergie : {remaining} sur {total} kWh restants",
"topup.noEnergyService": "Cet abonnement n’a pas de service d’énergie à recharger.",
"topup.infiniteQuota": "Cet abonnement a une énergie illimitée — rien à recharger.",
"topup.subCancelled": "Cet abonnement est {status} — recharge non autorisée.",
"topup.subPaused": "Cet abonnement est {status}. La recharge est autorisée, mais vérifiez avec le client.",
"topup.planTitle": "Choisir un plan",
"topup.planHint": "Tous les plans disponibles.",
"topup.planHintFiltered": "Plans pour {package}.",
"topup.noPlans": "Aucun plan disponible pour le moment.",
"topup.quotaUnavailable": "Impossible de charger le quota d’énergie de ce plan.",
"topup.confirmTitle": "Vérifier la recharge",
"topup.confirmHint": "Vérifiez tout — l’énergie est créditée immédiatement et ne peut pas être annulée.",
"topup.plan": "Plan",
"topup.planValue": "Valeur du plan",
"topup.energyCredit": "Crédit d’énergie",
"topup.balanceChange": "Solde après recharge",
"topup.creditButton": "Créditer {kwh} kWh",
"topup.doneDesc": "{sub} a maintenant {after} kWh (avant : {before}).",
"topup.reference": "Référence",
"topup.copyReference": "Copier la référence",
"topup.topUpAnother": "Recharger un autre",
"topup.recentTitle": "Recharges récentes (cet appareil)"
```

`zh.json` — same keys:

```json
"role.topup": "充值",
"role.topupDesc": "能源充值（无需付款）",
"topup.title": "充值",
"topup.identifyTitle": "查找订阅",
"topup.identifyHint": "输入客户的订阅 ID 开始。",
"topup.subscriptionId": "订阅 ID",
"topup.subscriptionIdPlaceholder": "例如 SUB12345",
"topup.validate": "验证",
"topup.confirmCustomer": "确认是该订阅",
"topup.package": "套餐",
"topup.energyBalance": "能源：剩余 {remaining} / {total} kWh",
"topup.noEnergyService": "该订阅没有可充值的能源服务。",
"topup.infiniteQuota": "该订阅能源不限量——无需充值。",
"topup.subCancelled": "该订阅状态为 {status}——不允许充值。",
"topup.subPaused": "该订阅状态为 {status}。允许充值，但请与客户确认。",
"topup.planTitle": "选择套餐",
"topup.planHint": "所有可用套餐。",
"topup.planHintFiltered": "适用于 {package} 的套餐。",
"topup.noPlans": "当前没有可用套餐。",
"topup.quotaUnavailable": "无法加载该套餐的能源配额。",
"topup.confirmTitle": "确认充值",
"topup.confirmHint": "请仔细核对——能源将立即入账且无法撤销。",
"topup.plan": "套餐",
"topup.planValue": "套餐价值",
"topup.energyCredit": "能源额度",
"topup.balanceChange": "充值后余额",
"topup.creditButton": "充值 {kwh} kWh",
"topup.doneDesc": "{sub} 现有 {after} kWh（原 {before}）。",
"topup.reference": "参考号",
"topup.copyReference": "复制参考号",
"topup.topUpAnother": "再充值一笔",
"topup.recentTitle": "近期充值（本设备）"
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (or only pre-existing issues outside topup files).

- [ ] **Step 5: Commit**

```bash
git add src/components/roles/SelectRole.tsx src/lib/auth.tsx src/i18n/messages
git commit -m "feat(topup): register applet tile, sidebar slug, i18n strings"
```

---

### Task 9: Verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; `/topup` appears in the route list.

- [ ] **Step 3: Dev-server flow check (read-only steps)**

Run: `npm run dev` and open `http://localhost:3000/topup`.
Verify: redirects to signin when logged out; after employee login + SA selection the wizard renders; entering a junk subscription ID shows "Customer not found"; a real staging subscription ID (ask Dennis) shows the echo-back card with package + balance; the plan list renders filtered.
**STOP before the Confirm step's commit button unless Dennis supplies a test subscription that may be credited — `serviceTopup` writes real quota.**

- [ ] **Step 4: End-to-end with test subscription (user-assisted)**

With a Dennis-approved test subscription ID: complete the full flow, confirm the Done screen shows quota_before → quota_after consistent with the plan's declared kWh, and the reference appears in Recent top-ups. Re-run `identifyCustomer` (re-enter the sub ID) and confirm the new balance matches quota_after.

- [ ] **Step 5: Final commit if any fixes were made, then report**

```bash
git status
git log --oneline -10
```

---

## Self-Review Notes

- Spec coverage: access gating (Task 7 auth shell + Task 8 slug), ABS-only writes (no Odoo write call anywhere), wizard (Tasks 3–6), no-transaction-ID (reference generated in Task 2, surfaced in Task 6), block/warn gates (Task 3), recent list (Tasks 2/6), i18n (Task 8), testing (Tasks 1/2/9). Out-of-scope items from spec excluded. ✓
- Types consistent: `IdentifiedSub` (StepIdentify) consumed by StepPlan/StepConfirm; `SelectedPlan` (StepPlan) consumed by StepConfirm; `TopupReceipt` (StepConfirm) consumed by StepDone. `EmployeeUser` from `@/lib/attendant-auth` everywhere. ✓
- One deliberate deferral: exact `AppHeader` props (Task 7 Step 1 NOTE) — implementer must mirror ActivatorApp's real usage.
