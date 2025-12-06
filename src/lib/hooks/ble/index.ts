/**
 * BLE Hooks & Utilities
 * 
 * Modular BLE functionality for the OVES mobile app.
 * Each piece can be used independently or composed together.
 * 
 * ARCHITECTURE:
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │                   useBatteryScanAndBind                      │
 * │                 (High-level composed hook)                   │
 * │                                                             │
 * │  Composes all lower-level hooks for complete battery        │
 * │  scan-to-bind workflow with energy calculation              │
 * └──────────────────────────┬──────────────────────────────────┘
 *                            │
 *        ┌───────────────────┼───────────────────┐
 *        ▼                   ▼                   ▼
 * ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
 * │ useBleDevice │   │ useBleDevice     │   │ useBleService    │
 * │ Scanner      │   │ Connection       │   │ Reader           │
 * │              │   │                  │   │                  │
 * │ • Discover   │   │ • Connect        │   │ • Read DTA       │
 * │ • Filter     │   │ • Retry          │   │ • Read any svc   │
 * │ • Match      │   │ • Timeout        │   │ • Handle errs    │
 * └──────────────┘   └──────────────────┘   └──────────────────┘
 *                            │                   │
 *                            │                   ▼
 *                            │          ┌──────────────────┐
 *                            │          │  energyUtils     │
 *                            │          │                  │
 *                            │          │ • Extract energy │
 *                            │          │ • Calculate cost │
 *                            │          │ • Parse QR       │
 *                            │          └──────────────────┘
 *                            │
 *                            ▼
 *                   ┌──────────────────┐
 *                   │     types.ts     │
 *                   │                  │
 *                   │ • BleDevice      │
 *                   │ • BatteryData    │
 *                   │ • EnergyData     │
 *                   └──────────────────┘
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Just device discovery (e.g., BLE device manager):
 *    const { devices, startScan, stopScan } = useBleDeviceScanner();
 * 
 * 2. Connect to a known device (e.g., keypad, OTA):
 *    const { connect, disconnect } = useBleDeviceConnection();
 * 
 * 3. Read service from connected device:
 *    const { readService } = useBleServiceReader();
 * 
 * 4. Complete battery workflow (attendant/sales):
 *    const { scanAndBind, state } = useBatteryScanAndBind({
 *      onBatteryRead: (battery, type) => { ... }
 *    });
 */

// ============================================
// TYPES
// ============================================

export type {
  BleDevice,
  BleConnectionState,
  BleScanState,
  BleServiceState,
  BleFullState,
  BatteryData,
  EnergyData,
  DtaServiceData,
  DtaCharacteristic,
} from './types';

// ============================================
// LOW-LEVEL HOOKS
// ============================================

// Device Scanner - BLE device discovery
export {
  useBleDeviceScanner,
  type UseBleDeviceScannerOptions,
  convertRssiToDistance,
} from './useBleDeviceScanner';

// Device Connection - Connect/disconnect with retry
export {
  useBleDeviceConnection,
  type UseBleDeviceConnectionOptions,
} from './useBleDeviceConnection';

// Service Reader - Read BLE service data
export {
  useBleServiceReader,
  type UseBleServiceReaderOptions,
} from './useBleServiceReader';

// ============================================
// UTILITIES
// ============================================

export {
  // Energy extraction
  extractEnergyFromDta,
  createBatteryData,
  // QR parsing
  parseBatteryIdFromQr,
  parseMacAddressFromQr,
  // Calculations
  calculateEnergyDiff,
  calculateSwapCost,
  // Formatting
  formatEnergyKwh,
  formatEnergyWh,
  formatChargePercent,
} from './energyUtils';

// ============================================
// HIGH-LEVEL COMPOSED HOOK
// ============================================

// Complete battery scan-to-bind workflow
export {
  useBatteryScanAndBind,
  type UseBatteryScanAndBindOptions,
} from './useBatteryScanAndBind';

// Default export for convenience
export { useBatteryScanAndBind as default } from './useBatteryScanAndBind';
