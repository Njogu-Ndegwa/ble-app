import { describe, it, expect } from 'vitest';
import {
  groupServiceActions,
  isEnergyServiceType,
  isTopUpPaymentType,
  isDepositPaymentType,
} from '../useRiderActivity';

describe('isEnergyServiceType', () => {
  it('matches both ABS energy-service naming families', () => {
    // Older Togo plans
    expect(isEnergyServiceType('service-electricity-togo-4')).toBe(true);
    // Newer plans (e.g. B30/B45 templates) — the family that broke grouping
    expect(isEnergyServiceType('service-energy-togo-001')).toBe(true);
    expect(isEnergyServiceType('service-energy-nairobi-real')).toBe(true);
  });

  it('does not match swap-count services or empty values', () => {
    expect(isEnergyServiceType('service-swap-count-togo-001')).toBe(false);
    expect(isEnergyServiceType('')).toBe(false);
    expect(isEnergyServiceType(undefined)).toBe(false);
  });
});

describe('isTopUpPaymentType', () => {
  it('recognizes ABS spellings with and without separators', () => {
    expect(isTopUpPaymentType('TOP_UP')).toBe(true); // actual ABS value
    expect(isTopUpPaymentType('TOPUP')).toBe(true);
    expect(isTopUpPaymentType('DEPOSIT')).toBe(true);
  });

  it('rejects other payment types', () => {
    expect(isTopUpPaymentType('SUBSCRIPTION_PAYMENT')).toBe(false);
    expect(isTopUpPaymentType('')).toBe(false);
    expect(isTopUpPaymentType(undefined)).toBe(false);
  });
});

describe('isDepositPaymentType', () => {
  it('matches only the activation deposit', () => {
    expect(isDepositPaymentType('DEPOSIT')).toBe(true);
    expect(isDepositPaymentType('TOP_UP')).toBe(false);
    expect(isDepositPaymentType('TOPUP')).toBe(false);
    expect(isDepositPaymentType('SUBSCRIPTION_PAYMENT')).toBe(false);
    expect(isDepositPaymentType(undefined)).toBe(false);
  });
});

describe('groupServiceActions', () => {
  // Real action pattern from ABS dev plan 136929 (customer-12372): two swaps,
  // each an energy-usage + swap-count pair ~100 ms apart. Before the
  // isEnergyServiceType fix, both halves classified as "swap" so pairing
  // failed and each swap rendered as two duplicate "Battery Swap" rows.
  const twoSwapsEnergyFamily = [
    { serviceActionId: 'SVC_A1', serviceType: 'service-energy-togo-001', serviceAmount: 2.87, createdAt: '2026-07-02T07:05:15.668Z' },
    { serviceActionId: 'SVC_A2', serviceType: 'service-swap-count-togo-001', serviceAmount: 1, createdAt: '2026-07-02T07:05:15.762Z' },
    { serviceActionId: 'SVC_B1', serviceType: 'service-energy-togo-001', serviceAmount: 2.13, createdAt: '2026-07-08T03:02:17.151Z' },
    { serviceActionId: 'SVC_B2', serviceType: 'service-swap-count-togo-001', serviceAmount: 1, createdAt: '2026-07-08T03:02:17.259Z' },
  ];

  it('pairs energy + swap-count actions from the service-energy-* family', () => {
    const groups = groupServiceActions(twoSwapsEnergyFamily);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group).toHaveLength(2);
      expect(group.some((g) => isEnergyServiceType(g.serviceType))).toBe(true);
      expect(group.some((g) => !isEnergyServiceType(g.serviceType))).toBe(true);
    }
  });

  it('pairs the older service-electricity-* family (no regression)', () => {
    const groups = groupServiceActions([
      { serviceActionId: 'S1', serviceType: 'service-electricity-togo-4', serviceAmount: 1.5, createdAt: '2026-07-02T07:05:15.000Z' },
      { serviceActionId: 'S2', serviceType: 'service-swap-count-togo-2', serviceAmount: 1, createdAt: '2026-07-02T07:05:15.100Z' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('keeps a lone swap-count action as its own group', () => {
    // e.g. an empty-battery swap that transferred no energy (plan 616252)
    const groups = groupServiceActions([
      { serviceActionId: 'S1', serviceType: 'service-swap-count-togo-001', serviceAmount: 1, createdAt: '2026-06-30T09:56:01.518Z' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
  });

  it('does not merge actions more than 2 minutes apart', () => {
    const groups = groupServiceActions([
      { serviceActionId: 'S1', serviceType: 'service-energy-togo-001', serviceAmount: 2, createdAt: '2026-07-02T07:00:00.000Z' },
      { serviceActionId: 'S2', serviceType: 'service-swap-count-togo-001', serviceAmount: 1, createdAt: '2026-07-02T07:03:00.000Z' },
    ]);
    expect(groups).toHaveLength(2);
  });
});
