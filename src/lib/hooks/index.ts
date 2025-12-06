/**
 * Custom React Hooks
 * 
 * Specialized hooks for the OVES mobile app
 */

// BLE Connection hook - unified scan-to-bind logic
export { 
  useBleConnection, 
  default as useBleConnectionDefault,
  type BatteryData,
  type BleDevice,
  type BleScanState,
  type BleConnectionOptions,
} from './useBleConnection';
