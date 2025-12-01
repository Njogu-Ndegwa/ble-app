// Shared types for Sales Rep Flow

export interface CustomerFormData {
  // Personal Information (required by Odoo)
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  
  // Address Information (required by Odoo)
  street: string;
  city: string;
  zip: string;
  
  // Kenya-specific fields
  nationalId: string;
  
  // Vehicle Information
  vehicleReg: string;
  vehicleType: string;
  vehicleModel: string;
}

// Odoo API payload for creating customer
export interface OdooCustomerPayload {
  name: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  city: string;
  zip: string;
  is_company: boolean;
  // Custom fields for Kenya market
  x_national_id?: string;
  x_vehicle_reg?: string;
  x_vehicle_type?: string;
  x_vehicle_model?: string;
}

// Response from Odoo customer creation
export interface OdooCustomerResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  // ... other fields returned by Odoo
}

export interface PlanData {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
}

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy: number;
  macAddress?: string;
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

export type SalesStep = 1 | 2 | 3 | 4 | 5;

export interface StepConfig {
  step: number;
  label: string;
  icon: 'customer' | 'plan' | 'payment' | 'battery' | 'done';
}

export const STEP_CONFIGS: StepConfig[] = [
  { step: 1, label: 'Customer', icon: 'customer' },
  { step: 2, label: 'Plan', icon: 'plan' },
  { step: 3, label: 'Payment', icon: 'payment' },
  { step: 4, label: 'Battery', icon: 'battery' },
  { step: 5, label: 'Done', icon: 'done' },
];

export const AVAILABLE_PLANS: PlanData[] = [
  {
    id: 'daily',
    name: 'Daily Pass',
    description: 'Unlimited swaps for 24 hours',
    price: 150,
    period: '/day',
  },
  {
    id: 'weekly',
    name: 'Weekly Plan',
    description: 'Unlimited swaps for 7 days',
    price: 800,
    period: '/week',
  },
  {
    id: 'monthly',
    name: 'Monthly Plan',
    description: 'Unlimited swaps for 30 days',
    price: 2500,
    period: '/month',
  },
  {
    id: 'payperswap',
    name: 'Pay-Per-Swap',
    description: 'Pay only when you swap',
    price: 0,
    period: 'deposit',
  },
];

// Helper functions
export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const maskNationalId = (id: string): string => {
  if (id.length <= 3) return id;
  return '*'.repeat(id.length - 3) + id.slice(-3);
};

export const formatPhoneNumber = (phone: string): string => {
  // Simple formatting - just return as-is for now
  return phone;
};

export const getBatteryClass = (level: number): 'full' | 'medium' | 'low' => {
  if (level >= 80) return 'full';
  if (level >= 40) return 'medium';
  return 'low';
};

export const generateRegistrationId = (): string => {
  return `#REG-${Math.floor(100000 + Math.random() * 900000)}`;
};
