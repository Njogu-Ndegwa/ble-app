/**
 * Domain Types
 * 
 * Core business/domain types used throughout the application.
 * Keep API response types in their respective API modules.
 */

// ============================================
// USER & AUTH
// ============================================

export interface User {
  id: number;
  partnerId?: number;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
}

export type UserRole = 'rider' | 'attendant' | 'sales' | 'admin';

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: User;
}

// ============================================
// CUSTOMER
// ============================================

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: Address;
  subscriptionType?: string;
  serviceState?: ServiceState;
  paymentState?: PaymentState;
  currentBatteryId?: string;
  energyRemaining?: number;
  energyTotal?: number;
  swapsRemaining?: number;
  swapsTotal?: number;
  createdAt?: string;
}

export interface Address {
  street: string;
  city: string;
  zip: string;
  country?: string;
}

// ============================================
// BATTERY
// ============================================

export interface Battery {
  id: string;
  macAddress: string;
  chargeLevel: number; // 0-100
  energy?: number; // kWh
  voltage?: number;
  temperature?: number;
  status: BatteryStatus;
  lastSeen?: string;
}

export type BatteryStatus = 
  | 'available' 
  | 'assigned' 
  | 'charging' 
  | 'in_use' 
  | 'maintenance' 
  | 'lost';

// ============================================
// SERVICE & PAYMENT STATES
// ============================================

export type ServiceState =
  | 'INITIAL'
  | 'WAIT_BATTERY_ISSUE'
  | 'BATTERY_ISSUED'
  | 'BATTERY_RETURNED'
  | 'BATTERY_LOST'
  | 'COMPLETE';

export type PaymentState =
  | 'INITIAL'
  | 'DEPOSIT_DUE'
  | 'CURRENT'
  | 'RENEWAL_DUE'
  | 'FINAL_DUE'
  | 'COMPLETE';

// ============================================
// TRANSACTIONS
// ============================================

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  customerId: number;
  reference?: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  completedAt?: string;
}

export type TransactionType = 
  | 'subscription' 
  | 'deposit' 
  | 'swap' 
  | 'renewal' 
  | 'refund';

export type TransactionStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type PaymentMethod = 
  | 'mpesa' 
  | 'card' 
  | 'cash' 
  | 'bank_transfer';

// ============================================
// SUBSCRIPTION & PRODUCTS
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  features?: string[];
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  components: PackageComponent[];
  imageUrl?: string;
}

export interface PackageComponent {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

// ============================================
// LOCATION & STATIONS
// ============================================

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  location: Location;
  status: StationStatus;
  availableBatteries: number;
  totalSlots: number;
  operatingHours?: string;
  amenities?: string[];
}

export type StationStatus = 'online' | 'offline' | 'maintenance';

// ============================================
// BLE / DEVICES
// ============================================

export interface BleDevice {
  id: string;
  name: string;
  macAddress: string;
  rssi: number;
  connected: boolean;
  services?: string[];
  lastSeen: Date;
}

export interface BleConnectionState {
  status: 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';
  device?: BleDevice;
  error?: string;
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// UI TYPES
// ============================================

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  children?: MenuItem[];
  badge?: string | number;
  disabled?: boolean;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

/** Make all properties of T optional except those in K */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

/** Make specific properties of T required */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Extract the element type from an array type */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

/** Make specific properties of T nullable */
export type Nullable<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};
