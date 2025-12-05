// Shared types for Attendant Flow

// Threshold for "infinite quota" services - quotas above this are management services
// that shouldn't be displayed to end users (e.g. 10,000,000 quota)
export const INFINITE_QUOTA_THRESHOLD = 100000;

export interface CustomerData {
  id: string;
  name: string;
  subscriptionId: string;  // This is the servicePlanId/subscription_code - same ID used by both ABS and Odoo
  subscriptionType: string;
  phone?: string;  // Customer phone number for M-Pesa
  swapCount?: number;
  lastSwap?: string;
  // Quota info
  energyRemaining?: number;
  energyTotal?: number;
  energyValue?: number;  // Monetary value of remaining energy quota (remaining × unit price)
  energyUnitPrice?: number;  // Unit price per kWh for energy
  swapsRemaining?: number;
  swapsTotal?: number;
  // Flags for infinite quota services (not shown on UI)
  hasInfiniteEnergyQuota?: boolean;
  hasInfiniteSwapQuota?: boolean;
  // Payment Cycle FSM states
  paymentState?: 'INITIAL' | 'DEPOSIT_DUE' | 'CURRENT' | 'RENEWAL_DUE' | 'FINAL_DUE' | 'COMPLETE';
  // Service Cycle FSM states  
  serviceState?: 'INITIAL' | 'WAIT_BATTERY_ISSUE' | 'BATTERY_ISSUED' | 'BATTERY_RETURNED' | 'BATTERY_LOST' | 'COMPLETE';
  currentBatteryId?: string;
}

// Payment initiation response from Odoo
export interface PaymentInitiation {
  transactionId: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  instructions: string;
}

// Step status for tracking failures
export type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

// Flow error information
export interface FlowError {
  step: AttendantStep;
  message: string;
  details?: string;
}

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number; // Charge percentage (0-100) from rsoc or calculated from rcap/fccp
  energy: number; // Remaining energy in Wh = (rcap_mAh × pckv_mV) / 1,000,000
  macAddress?: string; // BLE MAC address used for connection
}

// BLE Device interface for scan-to-bind functionality
export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
}

// BLE scan state for battery binding
export interface BleScanState {
  isScanning: boolean;
  isConnecting: boolean;
  isReadingEnergy: boolean;
  connectedDevice: string | null;
  detectedDevices: BleDevice[];
  connectionProgress: number;
  error: string | null;
  connectionFailed: boolean; // True when we receive an actual failure callback (not timeout)
  requiresBluetoothReset: boolean; // True when we get "Bluetooth device not connected" error and user needs to toggle Bluetooth
}

export interface SwapData {
  oldBattery: BatteryData | null;
  newBattery: BatteryData | null;
  energyDiff: number;
  quotaDeduction: number;  // Amount of remaining quota to apply (in kWh)
  chargeableEnergy: number;  // Energy to charge for after quota deduction (in kWh)
  cost: number;
  rate: number;
}

export type AttendantStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface StepConfig {
  step: number;
  label: string;
  icon: 'customer' | 'battery-return' | 'battery-new' | 'review' | 'payment' | 'done';
}

export const STEP_CONFIGS: StepConfig[] = [
  { step: 1, label: 'Customer', icon: 'customer' },
  { step: 2, label: 'Return', icon: 'battery-return' },
  { step: 3, label: 'New', icon: 'battery-new' },
  { step: 4, label: 'Review', icon: 'review' },
  { step: 5, label: 'Pay', icon: 'payment' },
  { step: 6, label: 'Done', icon: 'done' },
];

// Helper functions
export const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getBatteryClass = (level: number): 'full' | 'medium' | 'low' => {
  if (level >= 80) return 'full';
  if (level >= 40) return 'medium';
  return 'low';
};
