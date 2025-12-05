/**
 * Shared types used across Attendant and Sales Person workflows
 * Consolidated from both flows to ensure consistency and reusability
 */

// ============================================
// BATTERY & DEVICE TYPES
// ============================================

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number; // Charge percentage (0-100)
  energy: number; // Remaining energy in Wh
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
  connectionFailed: boolean;
  requiresBluetoothReset: boolean;
}

// ============================================
// PAYMENT TYPES
// ============================================

// Payment initiation response from Odoo
export interface PaymentInitiation {
  transactionId: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  instructions: string;
}

// Payment state for tracking payment progress
export interface PaymentState {
  isInitiated: boolean;
  isConfirmed: boolean;
  isProcessing: boolean;
  amountExpected: number;
  amountPaid: number;
  amountRemaining: number;
  reference: string;
  inputMode: 'scan' | 'manual';
  manualId: string;
}

// ============================================
// STEP & FLOW TYPES
// ============================================

export type StepStatus = 'pending' | 'active' | 'completed' | 'failed' | 'reachable';

export interface BaseStepConfig {
  step: number;
  label: string;
  icon: string;
}

export interface FlowError {
  step: number;
  message: string;
  details?: string;
}

// ============================================
// INPUT MODE TYPES
// ============================================

export type InputMode = 'scan' | 'manual';

// ============================================
// CUSTOMER TYPES
// ============================================

// Base customer info shared between flows
export interface BaseCustomerInfo {
  id?: string | number;
  name: string;
  phone?: string;
  email?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get initials from a name string
 * @param name - Full name or first name
 * @param lastName - Optional last name (for separate first/last inputs)
 */
export const getInitials = (name: string, lastName?: string): string => {
  if (lastName) {
    // Two separate name inputs
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  // Single name input - split by space
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

/**
 * Get battery charge level class for styling
 * @param level - Charge percentage (0-100)
 */
export const getBatteryClass = (level: number): 'full' | 'medium' | 'low' => {
  if (level >= 80) return 'full';
  if (level >= 40) return 'medium';
  return 'low';
};

/**
 * Convert RSSI to human-readable distance format
 * @param rssi - RSSI value in dB
 */
export const convertRssiToDistance = (rssi: number): string => {
  const txPower = -59;
  const n = 2;
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  return `${rssi}db ~ ${distance.toFixed(0)}m`;
};

/**
 * Format energy value for display
 * @param energyWh - Energy in Watt-hours
 * @param decimals - Number of decimal places
 */
export const formatEnergyKwh = (energyWh: number, decimals: number = 2): string => {
  const kWh = energyWh / 1000;
  return `${kWh.toFixed(decimals)} kWh`;
};

/**
 * Format currency amount
 * @param amount - Numeric amount
 * @param currency - Currency code (default: 'KES')
 */
export const formatCurrency = (amount: number, currency: string = 'KES'): string => {
  return `${currency} ${amount.toLocaleString()}`;
};
