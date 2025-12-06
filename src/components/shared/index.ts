/**
 * Shared Components Library
 * 
 * This module exports reusable components, hooks, and types
 * used across the Attendant and Sales Person workflows.
 * 
 * Usage:
 * import { ScannerArea, PaymentCollection, useBleScanner } from '@/components/shared';
 */

// ============================================
// TYPES
// ============================================
export * from './types';

// ============================================
// CORE UI COMPONENTS
// ============================================
export { default as ScannerArea } from './ScannerArea';
export type { ScannerType, ScannerSize } from './ScannerArea';

export { default as InputModeToggle } from './InputModeToggle';

// ============================================
// BATTERY COMPONENTS
// ============================================
export { default as BatteryCard, BatterySwapVisual } from './BatteryCard';
export type { BatteryCardVariant } from './BatteryCard';

export { default as BatteryScanBind, BatteryScanBindWithHook } from './BatteryScanBind';
export type { BatteryScanMode } from './BatteryScanBind';

// ============================================
// PAYMENT COMPONENTS
// ============================================
export { default as PaymentCollection } from './PaymentCollection';

// ============================================
// RECEIPT/SUCCESS COMPONENTS
// ============================================
export { 
  default as SuccessReceipt,
  buildSwapReceiptRows,
  buildRegistrationReceiptRows,
} from './SuccessReceipt';
export type { ReceiptRow, SwapReceiptData, RegistrationReceiptData } from './SuccessReceipt';

// ============================================
// FLOW NAVIGATION COMPONENTS
// ============================================
export { 
  default as FlowTimeline,
  ATTENDANT_TIMELINE_STEPS,
  SALES_TIMELINE_STEPS,
  StepIcons,
} from './FlowTimeline';
export type { TimelineStep } from './FlowTimeline';

export { 
  default as FlowActionBar,
  getAttendantActionConfig,
  getSalesActionConfig,
} from './FlowActionBar';
export type { ActionConfig, ActionIcon } from './FlowActionBar';

// ============================================
// HOOKS
// ============================================
export { default as useBleScanner, useBleScanner as useBleScannerHook } from './hooks/useBleScanner';

// Re-export modular BLE hooks from lib/hooks/ble
export { 
  // Low-level hooks
  useBleDeviceScanner,
  useBleDeviceConnection,
  useBleServiceReader,
  // High-level composed hook
  useBatteryScanAndBind,
  // Types
  type BatteryData,
  type BleDevice,
  type BleScanState,
  type BleFullState,
  type EnergyData,
  // Utilities
  extractEnergyFromDta,
  calculateEnergyDiff,
  calculateSwapCost,
  parseBatteryIdFromQr,
} from '@/lib/hooks/ble';

// Legacy alias for backwards compatibility
export { useBleConnection } from '@/lib/hooks/useBleConnection';
