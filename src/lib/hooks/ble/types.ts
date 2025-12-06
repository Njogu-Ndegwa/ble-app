/**
 * Shared BLE Types
 * 
 * Common types used across BLE-related hooks and utilities
 */

// ============================================
// DEVICE TYPES
// ============================================

export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
}

// ============================================
// CONNECTION TYPES
// ============================================

export interface BleConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  connectedDevice: string | null;
  connectionProgress: number;
  error: string | null;
  connectionFailed: boolean;
  requiresBluetoothReset: boolean;
}

// ============================================
// SCAN STATE
// ============================================

export interface BleScanState {
  isScanning: boolean;
  detectedDevices: BleDevice[];
  error: string | null;
}

// ============================================
// SERVICE DATA TYPES
// ============================================

export interface BleServiceState {
  isReading: boolean;
  progress: number;
  error: string | null;
}

export interface DtaCharacteristic {
  name: string;
  realVal: string | number;
}

export interface DtaServiceData {
  serviceNameEnum: string;
  characteristicList: DtaCharacteristic[];
  respCode?: string | number;
  respDesc?: string;
}

// ============================================
// BATTERY TYPES
// ============================================

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy: number; // in Wh
  macAddress?: string;
}

export interface EnergyData {
  energy: number; // Wh
  fullCapacity: number; // Wh
  chargePercent: number; // 0-100
}

// ============================================
// COMBINED STATE (for high-level hook)
// ============================================

export interface BleFullState {
  // Scanning
  isScanning: boolean;
  detectedDevices: BleDevice[];
  // Connection
  isConnecting: boolean;
  isConnected: boolean;
  connectedDevice: string | null;
  connectionProgress: number;
  // Service reading
  isReadingService: boolean;
  // Error states
  error: string | null;
  connectionFailed: boolean;
  requiresBluetoothReset: boolean;
}

// ============================================
// BRIDGE TYPE
// ============================================

// Note: WebViewJavascriptBridge is declared globally in the app.
// We just reference it via window.WebViewJavascriptBridge in our hooks.
