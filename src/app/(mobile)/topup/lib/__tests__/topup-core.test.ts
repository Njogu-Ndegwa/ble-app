import { describe, it, expect } from 'vitest';
import {
  buildStaffTopupReference,
  buildServiceTopupInput,
  loadRecentTopups,
  appendRecentTopup,
  assessTopupResponse,
  getOrCreatePendingReference,
  clearPendingReference,
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

  it('rejects non-finite declared kWh', () => {
    expect(() => buildServiceTopupInput({ ...base, declaredKwh: Infinity })).toThrow();
  });

  it('rejects non-finite price', () => {
    expect(() => buildServiceTopupInput({ ...base, planPrice: Infinity })).toThrow();
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

describe('assessTopupResponse', () => {
  it('accepts SERVICE_QUOTA_UPDATED', () => {
    expect(assessTopupResponse({ signals: ['SERVICE_QUOTA_UPDATED', 'PAYMENT_PROCESSED'] }))
      .toEqual({ ok: true, isIdempotent: false });
  });

  it('accepts idempotent replays and flags them', () => {
    expect(assessTopupResponse({ signals: ['IDEMPOTENT_OPERATION_DETECTED'] }))
      .toEqual({ ok: true, isIdempotent: true });
  });

  it('rejects anything else and surfaces metadata reason', () => {
    const out = assessTopupResponse({
      signals: ['QUOTA_POLICY_VIOLATION'],
      metadata: JSON.stringify({ reason: 'Plan not active' }),
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('Plan not active');
  });

  it('handles missing signals and unparseable metadata', () => {
    expect(assessTopupResponse({})).toEqual({ ok: false, isIdempotent: false, reason: undefined });
    expect(assessTopupResponse({ signals: [], metadata: '{broken' }).ok).toBe(false);
  });
});

describe('pending reference lifecycle', () => {
  it('reuses the reference for the same sub+plan, regenerates for different', () => {
    const s = memStorage();
    const ref1 = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    const ref2 = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    expect(ref2).toBe(ref1);
    const ref3 = getOrCreatePendingReference(42, 'SUB-1', 8, s);
    expect(ref3).not.toBe(ref1);
    const ref4 = getOrCreatePendingReference(42, 'SUB-2', 7, s);
    expect(ref4).not.toBe(ref3);
  });

  it('clear() forces a fresh reference for an intentional repeat', () => {
    const s = memStorage();
    const ref1 = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    clearPendingReference('SUB-1', 7, s);
    const ref2 = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    expect(ref2).not.toBe(ref1);
  });

  it('survives corrupt storage payloads', () => {
    const s = memStorage();
    s.setItem('topup-pending-refs-v1', '{nope');
    const ref = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    expect(ref).toMatch(/^staff-topup-42-/);
  });

  it("keeps plan A's pending reference when plan B's confirm is merely viewed", () => {
    const s = memStorage();
    const refA = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    getOrCreatePendingReference(42, 'SUB-1', 8, s); // staff views plan B
    expect(getOrCreatePendingReference(42, 'SUB-1', 7, s)).toBe(refA);
  });

  it('clearing one key leaves other pending references intact', () => {
    const s = memStorage();
    const refA = getOrCreatePendingReference(42, 'SUB-1', 7, s);
    const refB = getOrCreatePendingReference(42, 'SUB-1', 8, s);
    clearPendingReference('SUB-1', 8, s);
    expect(getOrCreatePendingReference(42, 'SUB-1', 7, s)).toBe(refA);
    expect(getOrCreatePendingReference(42, 'SUB-1', 8, s)).not.toBe(refB);
  });

  it('caps the pending map at 10 entries, evicting the oldest', () => {
    const s = memStorage();
    const ref0 = getOrCreatePendingReference(42, 'SUB-0', 1, s);
    for (let i = 1; i <= 10; i++) getOrCreatePendingReference(42, `SUB-${i}`, 1, s);
    expect(getOrCreatePendingReference(42, 'SUB-0', 1, s)).not.toBe(ref0); // evicted → regenerated
    expect(getOrCreatePendingReference(42, 'SUB-10', 1, s)).toBeDefined();
  });
});

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

  it('drops malformed entries and non-array payloads', () => {
    const s = memStorage();
    s.setItem('topup-recent-v1', '{}');
    expect(loadRecentTopups(s)).toEqual([]);
    s.setItem('topup-recent-v1', JSON.stringify([1, { ...entry }, { bad: true }]));
    expect(loadRecentTopups(s)).toEqual([{ ...entry }]);
  });
});
