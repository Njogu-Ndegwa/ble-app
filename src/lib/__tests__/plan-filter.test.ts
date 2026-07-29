import { describe, it, expect } from 'vitest';
import { filterPlansByPackage } from '../plan-filter';

// INOVA Mali's live catalog as of 2026-07-29: the package products are named
// "S-6" and "CET3-B", and the nine service plans span all three battery
// families plus a demo plan. Picking S-6 used to show all nine because "S-6"
// didn't substring-match the "S6" pattern (norm() strips whitespace, not
// hyphens) and the unmatched-package fallback returns the full list silently.
const INOVA_PLANS = [
  { name: 'demo plan', templateId: null },
  { name: 'B30-2.2 kWh (1 swp)', templateId: 'B30-2.2 kWh (1 swp)' },
  { name: 'B45-2.5 KWh', templateId: 'B45-2.5 KWh' },
  { name: 'B100-7.6 kWh(1 swp)', templateId: 'B100-7.6 kWh(1 swp)' },
  { name: 'B30-25 kWh (15 swp)', templateId: 'B30-25 kWh (15 swp)' },
  { name: 'B45-57 kWh(15 swp)', templateId: 'B45-57 kWh(15 swp)' },
  { name: 'B100-120 kWh(15 swp)', templateId: 'B100-120 kWh(15 swp)' },
  { name: 'B30-130 kWh (60 swp)', templateId: 'B30-130 kWh (60 swp)' },
  { name: 'B45-200 kWh(60 swp)', templateId: 'B45-200 kWh(60 swp)' },
];

describe('filterPlansByPackage — INOVA Mali package names', () => {
  it('narrows hyphenated "S-6" to the B30 family — the case that surfaced this bug', () => {
    const filtered = filterPlansByPackage('S-6', INOVA_PLANS);
    expect(filtered.map((p) => p.name)).toEqual([
      'B30-2.2 kWh (1 swp)',
      'B30-25 kWh (15 swp)',
      'B30-130 kWh (60 swp)',
    ]);
  });

  it('still narrows the unhyphenated "S6" spelling', () => {
    const filtered = filterPlansByPackage('S6', INOVA_PLANS);
    expect(filtered.every((p) => p.name.startsWith('B30-'))).toBe(true);
    expect(filtered).toHaveLength(3);
  });

  it('narrows "CET3-B" to the B100 family (worked before, must keep working)', () => {
    const filtered = filterPlansByPackage('CET3-B', INOVA_PLANS);
    expect(filtered.map((p) => p.name)).toEqual([
      'B100-7.6 kWh(1 swp)',
      'B100-120 kWh(15 swp)',
    ]);
  });

  it('returns the full list for an unrecognized package', () => {
    expect(filterPlansByPackage('Test Bike', INOVA_PLANS)).toHaveLength(INOVA_PLANS.length);
  });
});
