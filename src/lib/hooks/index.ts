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
// ATTENDANT WORKFLOW HOOKS
// ============================================

// Customer identification via GraphQL
export {
  useCustomerIdentification,
  type ServiceState,
  type IdentifiedCustomerData,
  type CustomerIdentificationResult,
  type IdentifyCustomerInputParams,
  type UseCustomerIdentificationConfig,
} from './useCustomerIdentification';

// Sales workflow customer identification with retry logic
export {
  useSalesCustomerIdentification,
  type IdentificationStatus,
  type UseSalesCustomerIdentificationConfig,
} from './useSalesCustomerIdentification';

// Payment collection and service completion
export {
  usePaymentCollection,
  type PaymentCollectionState,
  type UsePaymentCollectionOptions,
  type UsePaymentCollectionReturn,
} from './usePaymentCollection';

// Service completion (MQTT-based battery assignment/swap)
export {
  useServiceCompletion,
  type ServiceBatteryData,
  type UseServiceCompletionConfig,
  type CompleteServiceInput,
  type ServiceCompletionResult,
  type UseServiceCompletionReturn,
} from './useServiceCompletion';

// Product catalog (products, packages, plans from Odoo)
export {
  useProductCatalog,
  type ProductData,
  type PackageData,
  type PackageComponent,
  type PlanData,
  type CatalogLoadingState,
  type CatalogErrorState,
  type UseProductCatalogConfig,
  type UseProductCatalogReturn,
} from './useProductCatalog';

// Workflow session management (backend persistence)
export {
  useWorkflowSession,
  buildAttendantSessionData,
  extractAttendantStateFromSession,
  type SessionStatus,
  type SessionSummary,
  type UseWorkflowSessionConfig,
  type UseWorkflowSessionReturn,
} from './useWorkflowSession';

// Re-export session data type from odoo-api
export type { WorkflowSessionData } from '@/lib/odoo-api';

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
