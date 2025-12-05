/**
 * Application Constants
 * 
 * Centralized configuration and magic values.
 * Avoid scattering constants throughout the codebase.
 */

// ============================================
// APP CONFIGURATION
// ============================================

export const APP_CONFIG = {
  name: 'OVES',
  version: '1.0.0',
  description: 'Omnivoltaic Energy Services',
  
  // API Configuration
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },
  
  // Session/Storage
  storage: {
    tokenKey: 'oves_auth_token',
    userKey: 'oves_user',
    themeKey: 'oves_theme',
    languageKey: 'oves_language',
    salesSessionKey: 'oves_sales_session',
    attendantSessionKey: 'oves_attendant_session',
  },
  
  // Default locale
  defaultLocale: 'en',
  supportedLocales: ['en', 'fr', 'zh'] as const,
} as const;

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
  // Enable/disable features without code changes
  enableDarkMode: true,
  enableOfflineMode: false,
  enablePushNotifications: false,
  enableBiometricAuth: false,
  enableQrScanner: true,
  enableBleScanner: true,
  enableMqtt: true,
  
  // Debug features (disable in production)
  showDebugInfo: process.env.NODE_ENV === 'development',
  enableMockData: false,
  logApiCalls: process.env.NODE_ENV === 'development',
} as const;

// ============================================
// VALIDATION RULES
// ============================================

export const VALIDATION = {
  // Field lengths
  name: {
    min: 2,
    max: 100,
  },
  email: {
    max: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  phone: {
    min: 8,
    max: 15,
    pattern: /^\+?[\d\s-]{8,15}$/,
  },
  password: {
    min: 8,
    max: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
  },
  
  // Battery/Device
  batteryId: {
    pattern: /^[A-Z0-9]{6,12}$/,
  },
  macAddress: {
    pattern: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  },
} as const;

// ============================================
// BLE CONFIGURATION
// ============================================

export const BLE_CONFIG = {
  // Scan settings
  scanDuration: 10000, // 10 seconds
  connectionTimeout: 15000, // 15 seconds
  maxRetries: 3,
  
  // RSSI thresholds for distance estimation
  rssiThresholds: {
    immediate: -50,  // Very close (< 1m)
    near: -70,       // Near (1-3m)
    far: -90,        // Far (3-10m)
  },
  
  // Service UUIDs (example - replace with actual)
  services: {
    battery: '0000180f-0000-1000-8000-00805f9b34fb',
    device: '0000180a-0000-1000-8000-00805f9b34fb',
  },
  
  // Characteristic UUIDs
  characteristics: {
    batteryLevel: '00002a19-0000-1000-8000-00805f9b34fb',
    serialNumber: '00002a25-0000-1000-8000-00805f9b34fb',
  },
} as const;

// ============================================
// MQTT CONFIGURATION
// ============================================

export const MQTT_CONFIG = {
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  keepalive: 60,
  
  // Topic patterns
  topics: {
    heartbeat: 'oves/device/{deviceId}/heartbeat',
    status: 'oves/device/{deviceId}/status',
    command: 'oves/device/{deviceId}/command',
    telemetry: 'oves/device/{deviceId}/telemetry',
  },
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  // Animation durations (ms)
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  
  // Debounce/throttle delays (ms)
  debounce: {
    search: 300,
    input: 150,
    resize: 100,
  },
  
  // Toast durations (ms)
  toast: {
    success: 3000,
    error: 5000,
    info: 4000,
    warning: 4000,
  },
  
  // Pagination
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
} as const;

// ============================================
// PAYMENT CONFIGURATION
// ============================================

export const PAYMENT = {
  // Supported currencies
  currencies: ['KES', 'XOF', 'USD'] as const,
  defaultCurrency: 'KES',
  
  // Payment methods
  methods: ['mpesa', 'card', 'cash', 'bank_transfer'] as const,
  
  // Minimum amounts by currency
  minimumAmount: {
    KES: 10,
    XOF: 100,
    USD: 1,
  },
} as const;

// ============================================
// STATUS ENUMS
// ============================================

export const STATUS = {
  // Service cycle states
  service: {
    INITIAL: 'INITIAL',
    WAIT_BATTERY_ISSUE: 'WAIT_BATTERY_ISSUE',
    BATTERY_ISSUED: 'BATTERY_ISSUED',
    BATTERY_RETURNED: 'BATTERY_RETURNED',
    BATTERY_LOST: 'BATTERY_LOST',
    COMPLETE: 'COMPLETE',
  },
  
  // Payment cycle states
  payment: {
    INITIAL: 'INITIAL',
    DEPOSIT_DUE: 'DEPOSIT_DUE',
    CURRENT: 'CURRENT',
    RENEWAL_DUE: 'RENEWAL_DUE',
    FINAL_DUE: 'FINAL_DUE',
    COMPLETE: 'COMPLETE',
  },
  
  // Transaction states
  transaction: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
} as const;

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // BLE
  BLE_NOT_SUPPORTED: 'BLE_NOT_SUPPORTED',
  BLE_CONNECTION_FAILED: 'BLE_CONNECTION_FAILED',
  BLE_DEVICE_NOT_FOUND: 'BLE_DEVICE_NOT_FOUND',
  
  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
} as const;
