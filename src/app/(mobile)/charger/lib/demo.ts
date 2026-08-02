/**
 * Demo mode for Charger Control.
 *
 * The real flow needs a BLE charger in range and a real mobile-money payment,
 * so on a phone with neither there is no way to walk the screens at all. Demo
 * mode stands in for exactly those two dependencies — plus the customer/plan
 * lookups, so the flow runs with no backend at all — and touches nothing else:
 * the screens, the step order and the state machine are the real ones.
 *
 * SAFETY: nothing in demo mode may reach the network or the BLE bridge. Every
 * demo branch in the step components returns before the real call, and the
 * receipt carries `demo: true` so a demo run can never be mistaken for a real
 * one in the recent-charges list.
 */

import type { IdentifiedSub } from '../../topup/components/StepIdentify';
import type { SelectedPlan } from '../../topup/components/StepPlan';
import type { ConnectedCharger, GattCharacteristic, PaidCharge } from './types';

/** Obviously-fake values so a demo run is never mistaken for a real customer. */
export const DEMO_SUB: IdentifiedSub = {
  subscriptionCode: 'DEMO-0001',
  packageName: 'B30 Standard (demo)',
  packageFilter: ['B30-DEMO', 'B30 Standard (demo)'],
  odooStatus: 'active',
  energyServiceId: 'service-energy-demo-001',
  energyRemaining: 18,
  energyTotal: 30,
  currency: 'KES',
  customerName: 'Demo Rider',
  vehicleId: 'DEMO-BIKE-01',
};

export const DEMO_PLANS: SelectedPlan[] = [
  { name: 'Demo Energy 1 kWh', productId: 900001, price: 120, templateId: 'DEMO-1KWH', declaredKwh: 1 },
  { name: 'Demo Energy 3 kWh', productId: 900003, price: 330, templateId: 'DEMO-3KWH', declaredKwh: 3 },
  { name: 'Demo Energy 5 kWh', productId: 900005, price: 520, templateId: 'DEMO-5KWH', declaredKwh: 5 },
];

/**
 * Mirrors the battery GATT layout: same CMD service, charger-specific
 * characteristic names. Swap for the real ones once the charger GATT table is
 * shared — the demo list is also what the ambiguity warning is exercised
 * against, hence `pwrcap` sitting alongside `chgengy`.
 */
const DEMO_CHARACTERISTICS: GattCharacteristic[] = [
  { name: 'opid', uuid: '0000fff1-0000-1000-8000-00805f9b34fb', realVal: 'OP-DEMO-1' },
  { name: 'chgtmr', uuid: '0000fff2-0000-1000-8000-00805f9b34fb', realVal: 0 },
  { name: 'chgengy', uuid: '0000fff3-0000-1000-8000-00805f9b34fb', realVal: 0 },
  { name: 'outsw', uuid: '0000fff4-0000-1000-8000-00805f9b34fb', realVal: 1 },
  { name: 'rst', uuid: '0000fff5-0000-1000-8000-00805f9b34fb', realVal: 0 },
];

export interface DemoDevice {
  macAddress: string;
  name: string;
  rssi: number;
}

export const DEMO_DEVICES: DemoDevice[] = [
  { macAddress: 'DE:M0:00:11:22:33', name: 'DEMO CHGR-3KW A1B2C3', rssi: -48 },
  { macAddress: 'DE:M0:00:44:55:66', name: 'DEMO CHGR-3KW D4E5F6', rssi: -67 },
];

export function demoCharger(macAddress: string): ConnectedCharger {
  const device = DEMO_DEVICES.find((d) => d.macAddress === macAddress) ?? DEMO_DEVICES[0];
  return {
    macAddress: device.macAddress,
    name: device.name,
    controlService: {
      serviceNameEnum: 'CMD_SERVICE',
      uuid: '0000fff0-0000-1000-8000-00805f9b34fb',
      characteristicList: DEMO_CHARACTERISTICS,
    },
  };
}

export function demoPayment(plan: SelectedPlan): PaidCharge {
  return {
    receipt: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    paymentMethod: 'demo',
    orderId: 0,
    totalPaid: Math.floor(plan.price),
    quotaBefore: DEMO_SUB.energyRemaining,
    quotaAfter: Math.round((DEMO_SUB.energyRemaining + plan.declaredKwh) * 100) / 100,
    wasRetry: false,
  };
}

/** Simulated latency, so the loading and disabled states are actually visible. */
export const DEMO_DELAY_MS = 900;

export const demoWait = (ms: number = DEMO_DELAY_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
