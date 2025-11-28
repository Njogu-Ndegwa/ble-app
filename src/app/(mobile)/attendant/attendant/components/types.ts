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
  paymentStatus?: 'current' | 'overdue';
  accountStatus?: 'active' | 'inactive';
  currentBatteryId?: string;
}

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy?: number;
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
