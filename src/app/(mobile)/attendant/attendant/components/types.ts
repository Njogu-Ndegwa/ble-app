// Shared types for Attendant Flow

export interface CustomerData {
  id: string;
  name: string;
  subscriptionId: string;
  subscriptionType: string;
  swapCount?: number;
  lastSwap?: string;
  // Quota info
  energyRemaining?: number;
  energyTotal?: number;
  swapsRemaining?: number;
  swapsTotal?: number;
  // Payment Cycle FSM states
  paymentState?: 'INITIAL' | 'DEPOSIT_DUE' | 'CURRENT' | 'RENEWAL_DUE' | 'FINAL_DUE' | 'COMPLETE';
  // Service Cycle FSM states  
  serviceState?: 'INITIAL' | 'WAIT_BATTERY_ISSUE' | 'BATTERY_ISSUED' | 'BATTERY_RETURNED' | 'BATTERY_LOST' | 'COMPLETE';
  currentBatteryId?: string;
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
  chargeLevel: number;
  energy: number; // Energy in Wh computed from BLE (rcap * pckv / 100)
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
}

export interface SwapData {
  oldBattery: BatteryData | null;
  newBattery: BatteryData | null;
  energyDiff: number;
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
