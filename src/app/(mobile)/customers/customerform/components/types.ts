// Shared types for Sales Rep Flow

export interface CustomerFormData {
  // Personal Information (required by Odoo /api/auth/register)
  // name, email, phone, street, city, zip are accepted by the endpoint
  // company_id is derived from the salesperson's token
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  // Address fields
  street: string;
  city: string;
  zip: string;
}

// Response from Odoo customer registration
export interface OdooRegisteredCustomer {
  id: number;
  partner_id: number;
  name: string;
  email: string;
  phone: string;
  company_id: number;
}

// Session data from registration
export interface OdooSession {
  token: string;
  user: OdooRegisteredCustomer;
}

// Physical product data (bikes, tuks, etc.) from main_service category
export interface ProductData {
  id: string;           // Will be product ID from Odoo
  odooProductId: number; // Original Odoo product ID
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  imageUrl: string | null;  // Cloudinary URL for product image
  categoryName: string;
  defaultCode: string;
}

// Plan data from Odoo subscription products API
export interface PlanData {
  id: string;           // Will be product ID from Odoo
  odooProductId: number; // Original Odoo product ID
  name: string;
  description: string;
  price: number;
  period: string;
  currency: string;
  currencySymbol: string;
}

// Subscription data from purchase
export interface SubscriptionData {
  id: number;
  subscriptionCode: string;
  status: string;
  productName: string;
  priceAtSignup: number;
  currency: string;
  currencySymbol: string;
}

// Payment initiation response
export interface PaymentInitiation {
  transactionId: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  instructions: string;
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

// Sales flow now has 6 steps: Customer -> Product -> Plan -> Payment -> Battery -> Done
export type SalesStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface StepConfig {
  step: number;
  label: string;
  icon: 'customer' | 'product' | 'plan' | 'payment' | 'battery' | 'done';
}

export const STEP_CONFIGS: StepConfig[] = [
  { step: 1, label: 'Customer', icon: 'customer' },
  { step: 2, label: 'Product', icon: 'product' },
  { step: 3, label: 'Plan', icon: 'plan' },
  { step: 4, label: 'Payment', icon: 'payment' },
  { step: 5, label: 'Battery', icon: 'battery' },
  { step: 6, label: 'Done', icon: 'done' },
];

// No fallback plans - Odoo is the only source of truth for subscription plans
// Plans must be fetched from Odoo API at runtime

// Helper functions
export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
