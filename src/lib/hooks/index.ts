/**
 * Custom React Hooks
 * 
 * Specialized hooks for the OVES mobile app
 */

// ============================================
// MODULAR BLE HOOKS (RECOMMENDED)
// ============================================

// Re-export everything from the BLE module
export * from './ble';

// Named sub-module export for explicit imports
export * as ble from './ble';

// ============================================
// LEGACY BLE HOOK (for backwards compatibility)
// ============================================

// The old useBleConnection hook - now deprecated in favor of modular hooks
// Keeping for backwards compatibility, but prefer using:
// - useBleDeviceScanner (device discovery only)
// - useBleDeviceConnection (connection only)
// - useBleServiceReader (service reading only)
// - useBatteryScanAndBind (complete workflow)
export { 
  useBleConnection, 
  default as useBleConnectionDefault,
  type BleConnectionOptions,
} from './useBleConnection';
