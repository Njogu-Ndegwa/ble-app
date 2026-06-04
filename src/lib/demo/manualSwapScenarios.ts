/**
 * Mock data for the Manual Swap demo harness.
 *
 * These values drive the real Attendant flow when demo mode is active. The two
 * scenarios differ ONLY in the electricity-quota service, which is what decides
 * `hasSufficientQuota` and therefore which Review page is shown:
 *
 *   - 'enough'    → quota covers the swap → Review shows "Using Quota" / FREE
 *   - 'notEnough' → no quota             → Review shows the "buy a new
 *                                          subscription plan" notice (manual-swap)
 *
 * Battery values are identical across scenarios so the swap maths stay fixed and
 * only the quota changes between runs.
 */

import type { CustomerData, BatteryData } from '@/app/(mobile)/attendant/attendant/components/types';
import type { DemoScenarioId } from './DemoModeContext';

/** Service-state shape used by AttendantFlow's `serviceStates` state. */
export interface DemoServiceState {
  service_id: string;
  used: number;
  quota: number;
  current_asset: string | null;
  name?: string;
  usageUnitPrice?: number;
}

export interface DemoScenarioData {
  customerData: CustomerData;
  serviceStates: DemoServiceState[];
  customerType: 'first-time' | 'returning';
  rate: number;
  currencySymbol: string;
}

const RATE_PER_KWH = 25;
const CURRENCY = 'KES';

// Battery being returned: nearly empty (~0.24 kWh).
export const DEMO_OLD_BATTERY: BatteryData = {
  id: 'BO724525070000',
  shortId: '070000',
  chargeLevel: 12,
  energy: 240, // Wh
  macAddress: 'DE:M0:BA:77:00:01',
  actualBatteryId: 'OVES BATT 070000',
};

// Battery being issued: nearly full (~1.56 kWh) → energyDiff ≈ 1.32 kWh.
export const DEMO_NEW_BATTERY: BatteryData = {
  id: 'BO724525080000',
  shortId: '080000',
  chargeLevel: 96,
  energy: 1560, // Wh
  macAddress: 'DE:M0:BA:88:00:02',
  actualBatteryId: 'OVES BATT 080000',
};

function buildCustomer(scenario: DemoScenarioId): CustomerData {
  const hasQuota = scenario === 'enough';
  return {
    id: 'customer-900001',
    name: 'Demo Rider',
    subscriptionId: 'DEMO-SUB-0001',
    subscriptionType: 'Energy Plan',
    phone: '0712000000',
    email: 'demo.rider@oves.test',
    swapCount: 3,
    energyRemaining: hasQuota ? 10 : 0,
    energyTotal: 10,
    energyUnitPrice: RATE_PER_KWH,
    swapsRemaining: 18,
    swapsTotal: 21,
    serviceState: 'BATTERY_ISSUED',
    currentBatteryId: DEMO_OLD_BATTERY.actualBatteryId,
    isPlanActive: true,
    planStatus: 'active',
  };
}

function buildServiceStates(scenario: DemoScenarioId): DemoServiceState[] {
  // 'enough' → 10 kWh free quota covers the ~1.32 kWh swap.
  // 'notEnough' → 0 kWh quota, so the full differential is chargeable.
  const energyQuota = scenario === 'enough' ? 10 : 0;
  return [
    {
      service_id: 'service-energy-demo',
      name: 'Energy',
      used: 0,
      quota: energyQuota,
      current_asset: null,
      usageUnitPrice: RATE_PER_KWH,
    },
    {
      service_id: 'service-swap-count-demo',
      name: 'Swaps',
      used: 3,
      quota: 21,
      current_asset: null,
    },
    {
      service_id: 'service-battery-fleet-demo',
      name: 'Battery',
      used: 0,
      quota: 1,
      current_asset: DEMO_OLD_BATTERY.actualBatteryId ?? null,
    },
  ];
}

export function getDemoScenarioData(scenario: DemoScenarioId): DemoScenarioData {
  return {
    customerData: buildCustomer(scenario),
    serviceStates: buildServiceStates(scenario),
    customerType: 'returning',
    rate: RATE_PER_KWH,
    currencySymbol: CURRENCY,
  };
}

export const DEMO_SCENARIO_OPTIONS: Array<{ id: DemoScenarioId; label: string; hint: string }> = [
  { id: 'enough', label: 'Enough quota', hint: 'Quota covers the swap — free, no payment' },
  { id: 'notEnough', label: 'Not enough quota', hint: 'No quota — Review shows "buy a new plan"' },
];
