import { describe, expect, it } from 'vitest';
import { resolveActivationServiceMode } from '../activation-service-mode';

describe('resolveActivationServiceMode', () => {
  it('uses energy pricing when the plan has a positive energy rate', () => {
    const result = resolveActivationServiceMode([
      {
        service_id: 'service-energy-kenya-001',
        used: 0,
        quota: 100,
        current_asset: null,
        usageUnitPrice: 0.5,
      },
      {
        service_id: 'service-swap-count-kenya-001',
        used: 0,
        quota: 50,
        current_asset: null,
      },
    ], 0.5);

    expect(result).toEqual({
      kind: 'energy-priced',
      serviceId: 'service-energy-kenya-001',
      rate: 0.5,
      isQuotaBased: false,
    });
  });

  it('allows a bounded swap-count subscription with unbilled energy tracking', () => {
    const result = resolveActivationServiceMode([
      {
        service_id: 'service-energy-china-001',
        used: 0,
        quota: 10000000,
        current_asset: null,
        usageUnitPrice: 0,
      },
      {
        service_id: 'service-swap-count-china-001',
        used: 0,
        quota: 50,
        current_asset: null,
        usageUnitPrice: 0,
      },
    ], 0);

    expect(result).toEqual({
      kind: 'swap-count',
      serviceId: 'service-swap-count-china-001',
      rate: 0,
      isQuotaBased: true,
      totalSwaps: 50,
      usedSwaps: 0,
      remainingSwaps: 50,
    });
  });

  it('reports the used and remaining allowance for a swap-count plan', () => {
    const result = resolveActivationServiceMode([
      {
        service_id: 'service-energy-china-001',
        used: 0,
        quota: 10000000,
        current_asset: null,
        usageUnitPrice: 0,
      },
      {
        service_id: 'service-swap-count-china-001',
        used: 12.8,
        quota: 50,
        current_asset: null,
      },
    ], 0);

    expect(result.kind).toBe('swap-count');
    if (result.kind === 'swap-count') {
      expect(result.totalSwaps).toBe(50);
      expect(result.usedSwaps).toBe(12);
      expect(result.remainingSwaps).toBe(38);
    }
  });

  it('rejects a finite swap counter when energy pricing failed to enrich', () => {
    const result = resolveActivationServiceMode([
      {
        service_id: 'service-energy-kenya-001',
        used: 0,
        quota: 100,
        current_asset: null,
      },
      {
        service_id: 'service-swap-count-kenya-001',
        used: 0,
        quota: 50,
        current_asset: null,
      },
    ], 0);

    expect(result.kind).toBe('unsupported');
  });

  it('does not hide missing energy pricing behind an unlimited swap counter', () => {
    const result = resolveActivationServiceMode([
      {
        service_id: 'service-energy-kenya-001',
        used: 0,
        quota: 100,
        current_asset: null,
        usageUnitPrice: 0,
      },
      {
        service_id: 'service-swap-count-kenya-001',
        used: 0,
        quota: 10000000,
        current_asset: null,
      },
    ], 0);

    expect(result.kind).toBe('unsupported');
  });
});
