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
