/**
 * Session Tracking Types
 * 
 * These types define the data structures for persisting session state to a backend.
 * They enable complete session recovery - allowing the app to restore to the exact
 * step and state if interrupted.
 */

// =============================================================================
// Common Types
// =============================================================================

export type SessionType = 'SALES_REGISTRATION' | 'ATTENDANT_SWAP';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface DeviceInfo {
  device_id: string;
  app_version: string;
  platform: 'ios' | 'android' | 'web';
  locale: string;
}

export interface StepStatusInfo {
  status: StepStatus;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error?: string;
}

export interface FlowState {
  current_step: number;
  max_step_reached: number;
  total_steps: number;
  steps_completed: number[];
  step_statuses: Record<string, StepStatusInfo>;
}

export interface SessionMetadata {
  last_action: string;
  last_action_at: string;
  error_count: number;
  retry_count: number;
  session_duration_seconds: number;
}

// =============================================================================
// Sales Flow Types
// =============================================================================

export interface SalesActor {
  type: 'salesperson';
  id: string;
  name: string;
  station: string;
  company_id: number;
}

export interface SalesCustomerFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  zip: string;
}

export interface SalesCustomerData {
  form_data: SalesCustomerFormData;
  form_validated: boolean;
  form_errors: Record<string, string>;
}

export interface SalesRegistrationResult {
  customer_id: number | null;
  partner_id: number | null;
  customer_session_token: string | null;
  registered_at: string | null;
}

export interface PackageComponent {
  id: number;
  name: string;
  type: 'main_service' | 'battery_swap' | 'other';
  price_unit: number;
  quantity: number;
}

export interface SalesPackageDetails {
  odoo_package_id: number;
  name: string;
  price: number;
  currency: string;
  currency_symbol: string;
  components: PackageComponent[];
}

export interface SalesPackageSelection {
  selected_package_id: string;
  package_details: SalesPackageDetails | null;
  selected_at: string | null;
}

export interface SalesPlanDetails {
  odoo_product_id: number;
  name: string;
  price: number;
  period: string;
  currency: string;
  currency_symbol: string;
}

export interface SalesPlanSelection {
  selected_plan_id: string;
  plan_details: SalesPlanDetails | null;
  selected_at: string | null;
}

export interface SalesSubscriptionData {
  id: number | null;
  subscription_code: string | null;
  status: string;
  product_name: string;
  price_at_signup: number;
  currency: string;
  currency_symbol: string;
  created_at: string | null;
}

export interface SalesOrderData {
  order_id: number | null;
  sale_order_name: string | null;
  total_amount: number;
  currency: string;
  created_at: string | null;
}

export interface StkPushResponse {
  transaction_id: string;
  checkout_request_id: string;
  merchant_request_id: string;
  instructions: string;
}

export interface SalesPaymentRequest {
  order_id: number;
  amount_required: number;
  description: string;
}

export interface SalesPaymentConfirmation {
  receipt: string;
  amount_paid: number;
  confirmed_at: string;
}

export interface SalesPaymentState {
  payment_initiated: boolean;
  payment_confirmed: boolean;
  payment_input_mode: 'scan' | 'manual';
  stk_push_sent: boolean;
  stk_push_response: StkPushResponse | null;
  payment_request: SalesPaymentRequest | null;
  payment_confirmation: SalesPaymentConfirmation | null;
  amount_expected: number;
  amount_paid: number;
  amount_remaining: number;
  payment_incomplete: boolean;
  manual_payment_id: string;
  confirmed_subscription_code: string | null;
  payment_reference: string | null;
}

export interface SalesBatteryData {
  id: string;
  short_id: string;
  charge_level: number;
  energy: number; // in Wh
  mac_address: string | null;
}

export interface SalesBleConnectionState {
  is_scanning: boolean;
  is_connecting: boolean;
  is_reading_energy: boolean;
  connected_device: string | null;
  detected_devices: BleDevice[];
  connection_progress: number;
  error: string | null;
}

export interface SalesBatteryAssignment {
  scanned_battery_pending: SalesBatteryData | null;
  assigned_battery: SalesBatteryData | null;
  ble_connection_state: SalesBleConnectionState;
}

export interface SalesServiceCompletion {
  is_completing_service: boolean;
  service_completion_error: string | null;
  mqtt_correlation_id: string | null;
  service_completed_at: string | null;
}

export interface SalesCompletionData {
  registration_id: string | null;
  completed_at: string | null;
  receipt_data: Record<string, any> | null;
}

/**
 * Complete Sales Session Data Structure
 */
export interface SalesSessionData {
  session_id: string;
  session_type: 'SALES_REGISTRATION';
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  
  device_info: DeviceInfo;
  actor: SalesActor;
  flow_state: FlowState;
  
  customer_data: SalesCustomerData;
  registration_result: SalesRegistrationResult;
  
  package_selection: SalesPackageSelection;
  plan_selection: SalesPlanSelection;
  
  subscription_data: SalesSubscriptionData | null;
  order_data: SalesOrderData | null;
  
  payment_state: SalesPaymentState;
  battery_assignment: SalesBatteryAssignment;
  service_completion: SalesServiceCompletion;
  completion_data: SalesCompletionData;
  
  metadata: SessionMetadata;
}

// =============================================================================
// Attendant Flow Types
// =============================================================================

export interface AttendantActor {
  type: 'attendant';
  id: string;
  name: string;
  station: string;
}

export interface AttendantCustomerIdentification {
  input_mode: 'scan' | 'manual';
  manual_subscription_id: string | null;
  qr_code_raw: string | null;
  dynamic_plan_id: string;
  mqtt_correlation_id: string | null;
  identified_at: string | null;
}

export interface AttendantCustomerData {
  id: string;
  name: string;
  subscription_id: string;
  subscription_type: string;
  phone: string;
  swap_count: number;
  last_swap: string;
  energy_remaining: number;
  energy_total: number;
  energy_value: number;
  energy_unit_price: number;
  swaps_remaining: number;
  swaps_total: number;
  has_infinite_energy_quota: boolean;
  has_infinite_swap_quota: boolean;
  payment_state: 'INITIAL' | 'DEPOSIT_DUE' | 'CURRENT' | 'RENEWAL_DUE' | 'FINAL_DUE' | 'COMPLETE';
  service_state: 'INITIAL' | 'WAIT_BATTERY_ISSUE' | 'BATTERY_ISSUED' | 'BATTERY_RETURNED' | 'BATTERY_LOST' | 'COMPLETE';
  current_battery_id: string | null;
}

export interface ServiceState {
  service_id: string;
  name: string;
  used: number;
  quota: number;
  current_asset: string | null;
  usage_unit_price: number | null;
}

export type CustomerType = 'first-time' | 'returning' | null;

export interface AttendantBatteryData {
  id: string;
  short_id: string;
  charge_level: number;
  energy: number; // in Wh
  mac_address: string | null;
  scanned_at: string | null;
  ble_connection_succeeded: boolean;
}

export interface SwapData {
  energy_diff: number; // in kWh
  quota_deduction: number; // in kWh
  chargeable_energy: number; // in kWh
  cost: number;
  rate: number;
  currency_symbol: string;
}

export interface AttendantPaymentRequestData {
  order_id: number;
  sale_order_name: string;
  amount_required: number;
  amount_remaining: number;
  status: string;
}

export interface AttendantPaymentInitiationData {
  transaction_id: string;
  checkout_request_id: string;
  merchant_request_id: string;
  instructions: string;
}

export interface AttendantPaymentState {
  has_sufficient_quota: boolean;
  payment_skipped: boolean;
  payment_skip_reason: 'QUOTA_CREDIT' | 'ZERO_COST_ROUNDING' | null;
  payment_request_created: boolean;
  payment_request_data: AttendantPaymentRequestData | null;
  payment_request_order_id: number | null;
  expected_payment_amount: number;
  payment_initiated: boolean;
  payment_initiation_data: AttendantPaymentInitiationData | null;
  payment_input_mode: 'scan' | 'manual';
  manual_payment_id: string;
  payment_confirmed: boolean;
  payment_receipt: string | null;
  actual_amount_paid: number;
  payment_amount_remaining: number;
}

export interface BleDevice {
  mac_address: string;
  name: string;
  rssi: string;
  raw_rssi: number;
}

export interface AttendantBleState {
  handlers_ready: boolean;
  is_scanning: boolean;
  is_connecting: boolean;
  is_reading_energy: boolean;
  connected_device: string | null;
  detected_devices: BleDevice[];
  connection_progress: number;
  error: string | null;
  connection_failed: boolean;
  requires_bluetooth_reset: boolean;
  pending_battery_id: string | null;
}

export interface FlowError {
  step: number;
  error_code: string;
  message: string;
  details: string | null;
  timestamp: string;
  recoverable: boolean;
  recovery_action: string | null;
}

export interface AttendantServiceCompletion {
  payment_and_service_status: 'idle' | 'pending' | 'success' | 'error';
  mqtt_correlation_id: string | null;
  is_quota_based: boolean;
  is_zero_cost_rounding: boolean;
  service_completed_at: string | null;
}

export interface AttendantCompletionData {
  transaction_id: string | null;
  completed_at: string | null;
  receipt_data: Record<string, any> | null;
}

/**
 * Complete Attendant Session Data Structure
 */
export interface AttendantSessionData {
  session_id: string;
  session_type: 'ATTENDANT_SWAP';
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  
  device_info: DeviceInfo;
  actor: AttendantActor;
  flow_state: FlowState;
  
  customer_identification: AttendantCustomerIdentification;
  customer_data: AttendantCustomerData | null;
  service_states: ServiceState[];
  customer_type: CustomerType;
  
  old_battery: AttendantBatteryData | null;
  new_battery: AttendantBatteryData | null;
  swap_data: SwapData;
  
  payment_state: AttendantPaymentState;
  ble_state: AttendantBleState;
  flow_error: FlowError | null;
  
  service_completion: AttendantServiceCompletion;
  completion_data: AttendantCompletionData;
  
  metadata: SessionMetadata;
}

// =============================================================================
// Union Types
// =============================================================================

export type SessionData = SalesSessionData | AttendantSessionData;

// =============================================================================
// API Types
// =============================================================================

export interface CreateSessionRequest {
  session_type: SessionType;
  device_info: DeviceInfo;
  actor: SalesActor | AttendantActor;
}

export interface CreateSessionResponse {
  success: boolean;
  session_id: string;
  version: number;
}

export interface UpdateSessionRequest {
  session_id: string;
  updates: Partial<SessionData>;
}

export interface UpdateSessionResponse {
  success: boolean;
  session_id: string;
  version: number;
}

export interface GetSessionResponse {
  success: boolean;
  session: SessionData | null;
}

export interface SessionSummary {
  session_id: string;
  session_type: SessionType;
  current_step: number;
  customer_name: string;
  updated_at: string;
}

export interface ListSessionsResponse {
  success: boolean;
  sessions: SessionSummary[];
}

export interface DeleteSessionResponse {
  success: boolean;
  archived: boolean;
}

// =============================================================================
// Recovery Types
// =============================================================================

export interface RecoveryPromptData {
  session_id: string;
  session_type: SessionType;
  summary: {
    customer_name: string;
    current_step: number;
    step_name: string;
    last_action: string;
    saved_ago: string;
  };
  can_resume: boolean;
  resume_warnings: string[];
}

// =============================================================================
// Event Types (for audit trail)
// =============================================================================

export type SessionEventType = 
  | 'SESSION_CREATED'
  | 'SESSION_RECOVERED'
  | 'SESSION_COMPLETED'
  | 'SESSION_DISCARDED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_IDENTIFIED'
  | 'PACKAGE_SELECTED'
  | 'PLAN_SELECTED'
  | 'ORDER_CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_SKIPPED'
  | 'BATTERY_SCANNED'
  | 'BATTERY_ASSIGNED'
  | 'SERVICE_COMPLETED'
  | 'ERROR_OCCURRED'
  | 'ERROR_RECOVERED';

export interface SessionEvent {
  event_id: string;
  event_type: SessionEventType;
  timestamp: string;
  data: Record<string, any>;
}

export interface SessionEventLog {
  session_id: string;
  events: SessionEvent[];
}

// =============================================================================
// Error Types
// =============================================================================

export type SessionErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'BATTERY_MISMATCH'
  | 'SAME_BATTERY_SCANNED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_INSUFFICIENT'
  | 'SERVICE_COMPLETION_FAILED'
  | 'BLE_CONNECTION_FAILED'
  | 'BLE_READ_FAILED'
  | 'MQTT_TIMEOUT'
  | 'MQTT_CONNECTION_LOST'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'SESSION_VERSION_CONFLICT'
  | 'UNKNOWN_ERROR';

export interface SessionError {
  code: SessionErrorCode;
  message: string;
  details?: string;
  recoverable: boolean;
  recovery_action?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(type: SessionType): string {
  const prefix = type === 'SALES_REGISTRATION' ? 'sales-sess' : 'att-sess';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculate session expiry (24 hours from now)
 */
export function calculateSessionExpiry(): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry.toISOString();
}

/**
 * Get step name for Sales flow
 */
export function getSalesStepName(step: number): string {
  const stepNames: Record<number, string> = {
    1: 'Customer Info',
    2: 'Package Selection',
    3: 'Subscription Selection',
    4: 'Preview',
    5: 'Payment',
    6: 'Battery Assignment',
    7: 'Success',
  };
  return stepNames[step] || 'Unknown';
}

/**
 * Get step name for Attendant flow
 */
export function getAttendantStepName(step: number): string {
  const stepNames: Record<number, string> = {
    1: 'Customer Scan',
    2: 'Return Battery',
    3: 'New Battery',
    4: 'Review',
    5: 'Payment',
    6: 'Success',
  };
  return stepNames[step] || 'Unknown';
}

/**
 * Format time ago string
 */
export function formatTimeAgo(timestamp: string): string {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}
