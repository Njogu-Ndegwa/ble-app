/**
 * GraphQL Mutations for Customer Identification and Payment/Service Reporting
 * 
 * These mutations replace the MQTT-based communication with the ABS (Asset & Billing System).
 * 
 * Usage:
 * ```typescript
 * import { IDENTIFY_CUSTOMER, REPORT_PAYMENT_AND_SERVICE } from '@/lib/graphql/mutations';
 * import apolloClient from '@/lib/apollo-client';
 * 
 * const result = await apolloClient.mutate({
 *   mutation: IDENTIFY_CUSTOMER,
 *   variables: { input: { plan_id: '123', ... } }
 * });
 * ```
 */

import { gql } from '@apollo/client';

// ============================================================================
// Customer Identification Mutation
// ============================================================================

/**
 * Input type for customer identification
 */
export interface IdentifyCustomerInput {
  /** The subscription/plan ID */
  plan_id: string;
  /** Unique correlation ID for tracking the request */
  correlation_id: string;
  /** QR code data scanned from customer */
  qr_code_data: string;
  /** Attendant/station performing the identification */
  attendant_station: string;
}

/**
 * Service state from the customer's service plan
 */
export interface GraphQLServiceState {
  service_id: string;
  used: number;
  quota: number;
  current_asset: string | null;
}

/**
 * Service definition from the service bundle
 */
export interface GraphQLServiceDefinition {
  serviceId: string;
  name: string;
  description?: string;
  assetType: string;
  assetReference?: string;
  usageMetric: string;
  usageUnit: string;
  usageUnitPrice: number;
  accessControl?: Record<string, unknown>;
}

/**
 * Service plan data from identification response
 */
export interface GraphQLServicePlanData {
  servicePlanId: string;
  customerId: string;
  status: string;
  serviceState: string;
  paymentState: string;
  templateId: string;
  templateVersion: string;
  currency: string;
  serviceStates: GraphQLServiceState[];
  quotaUsed: number;
  quotaLimit: number;
}

/**
 * Service bundle from identification response
 */
export interface GraphQLServiceBundle {
  bundleId: string;
  name: string;
  description: string;
  version: string;
  status: string;
  services: GraphQLServiceDefinition[];
}

/**
 * Common terms from identification response
 */
export interface GraphQLCommonTerms {
  termsId: string;
  serviceName: string;
  serviceDescription?: string;
  serviceDurationDays: number;
  billingCycle: string;
  billingCurrency: string;
  monthlyFee: number;
  depositAmount: number;
  monthlyQuota: number;
  cancellationNoticeDays: number;
  earlyTerminationFee: number;
  refundPolicy: string;
  liabilityLimit: number;
  insuranceRequired: boolean;
  damageDeposit: number;
  governingLaw: string;
  disputeResolution: string;
}

/**
 * Parsed metadata from identification response
 */
export interface IdentifyCustomerMetadata {
  customer_id: string;
  identification_method: string;
  service_plan_data: GraphQLServicePlanData;
  service_bundle: GraphQLServiceBundle;
  common_terms: GraphQLCommonTerms;
  correlation_id: string;
}

/**
 * Response from identifyCustomer mutation
 */
export interface IdentifyCustomerResponse {
  customer_identified: boolean;
  identification_method: string;
  signals: string[];
  metadata: string; // JSON string that needs to be parsed
}

/**
 * GraphQL mutation for identifying a customer by QR code or subscription ID
 */
export const IDENTIFY_CUSTOMER = gql`
  mutation IdentifyCustomer($input: BssIdentifyCustomerInput!) {
    identifyCustomer(input: $input) {
      customer_identified
      identification_method
      signals
      metadata
    }
  }
`;

// ============================================================================
// Payment and Service Completion Mutation
// ============================================================================

/**
 * Payment data input for service completion
 */
export interface PaymentDataInput {
  /** Service ID for the payment (e.g., electricity service) */
  service_id: string;
  /** Payment amount */
  payment_amount: number;
  /** Payment reference/receipt ID */
  payment_reference: string;
  /** Payment method (MPESA, CASH, etc.) */
  payment_method: string;
  /** Payment type (TOP_UP, DEPOSIT) */
  payment_type: string;
}

/**
 * Service data input for service completion
 */
export interface ServiceDataInput {
  /** Old battery ID (for returning customers) */
  old_battery_id?: string;
  /** New battery ID being issued */
  new_battery_id: string;
  /** Energy transferred in kWh */
  energy_transferred: number;
  /** Service duration in seconds */
  service_duration: number;
}

/**
 * Input type for reporting payment and service completion
 */
export interface ReportPaymentAndServiceInput {
  /** The subscription/plan ID */
  plan_id: string;
  /** Unique correlation ID for tracking the request */
  correlation_id: string;
  /** Attendant/station performing the service */
  attendant_station: string;
  /** Payment data (optional for quota-based transactions) */
  payment_data?: PaymentDataInput;
  /** Service data (battery swap/assignment details) */
  service_data: ServiceDataInput;
}

/**
 * Response from reportPaymentAndServiceCompletion mutation
 */
export interface ReportPaymentAndServiceResponse {
  payment_processed: boolean;
  service_completed: boolean;
  quota_updated: boolean;
  service_states_updated: boolean;
  correlation_id: string;
  status_message: string;
  signals: string[];
  metadata: string; // JSON string with detailed response
}

/**
 * GraphQL mutation for reporting both payment and service completion
 */
export const REPORT_PAYMENT_AND_SERVICE = gql`
  mutation ReportPaymentAndService($input: BssReportPaymentAndServiceInput!) {
    reportPaymentAndServiceCompletion(input: $input) {
      payment_processed
      service_completed
      quota_updated
      service_states_updated
      correlation_id
      status_message
      signals
      metadata
    }
  }
`;

// ============================================================================
// Type Guards and Helpers
// ============================================================================

/**
 * Parse the metadata JSON string from identification response
 */
export function parseIdentifyCustomerMetadata(metadataString: string): IdentifyCustomerMetadata | null {
  try {
    return JSON.parse(metadataString) as IdentifyCustomerMetadata;
  } catch (error) {
    console.error('Failed to parse identifyCustomer metadata:', error);
    return null;
  }
}

/**
 * Parse the metadata JSON string from payment/service response
 */
export function parsePaymentAndServiceMetadata(metadataString: string): Record<string, unknown> | null {
  try {
    return JSON.parse(metadataString) as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to parse paymentAndService metadata:', error);
    return null;
  }
}

/**
 * Check if customer identification was successful based on signals
 */
export function isIdentificationSuccessful(response: IdentifyCustomerResponse): boolean {
  return (
    response.customer_identified === true &&
    Array.isArray(response.signals) &&
    (response.signals.includes('CUSTOMER_IDENTIFIED_SUCCESS') ||
      response.signals.includes('IDEMPOTENT_OPERATION_DETECTED'))
  );
}

/**
 * Check if payment/service completion was successful based on signals
 */
export function isPaymentAndServiceSuccessful(response: ReportPaymentAndServiceResponse): boolean {
  const successSignals = [
    'SERVICE_COMPLETED',
    'ASSET_RETURNED',
    'ASSET_ALLOCATED',
    'PAYMENT_AND_SERVICE_COMPLETED',
    'IDEMPOTENT_OPERATION_DETECTED',
  ];
  
  return (
    response.service_completed === true &&
    Array.isArray(response.signals) &&
    response.signals.some(signal => successSignals.includes(signal))
  );
}

/**
 * Error signals that indicate operation failure
 */
export const ERROR_SIGNALS = [
  'BATTERY_MISMATCH',
  'ASSET_VALIDATION_FAILED',
  'SECURITY_ALERT',
  'VALIDATION_FAILED',
  'PAYMENT_FAILED',
  'SERVICE_COMPLETION_FAILED',
  'RATE_LIMIT_EXCEEDED',
  'SERVICE_REJECTED',
  'SERVICE_PLAN_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'INVALID_QR_CODE',
  'INVALID_SUBSCRIPTION_ID',
] as const;

/**
 * Check if response contains error signals
 */
export function hasErrorSignals(signals: string[]): boolean {
  return signals.some(signal => ERROR_SIGNALS.includes(signal as (typeof ERROR_SIGNALS)[number]));
}

// ============================================================================
// Vehicle Assignment Mutation (Update Asset Assignment Current Asset)
// ============================================================================

/**
 * Input type for updating asset assignment (vehicle assignment)
 */
export interface UpdateAssetAssignmentInput {
  /** The subscription/plan ID */
  plan_id: string;
  /** The asset ID (vehicle ID) to assign */
  current_asset: string;
  /** Unique correlation ID for tracking the request */
  correlation_id: string;
}

/**
 * Response from updateAssetAssignmentCurrentAsset mutation
 */
export interface UpdateAssetAssignmentResponse {
  /** Service IDs that were updated */
  service_ids: string[];
  /** Number of records updated */
  updated_count: number;
  /** Signals from the operation */
  signals: string[];
  /** Additional metadata (JSON string) */
  metadata: string;
}

/**
 * GraphQL mutation for updating asset assignment (assigning vehicle to customer)
 * 
 * This is used in the Sales workflow after scanning a vehicle QR code
 * to assign the vehicle to the customer's subscription.
 */
export const UPDATE_ASSET_ASSIGNMENT_CURRENT_ASSET = gql`
  mutation UpdateAssetAssignmentCurrentAsset(
    $planId: String!
    $currentAsset: String!
    $correlationId: String!
  ) {
    updateAssetAssignmentCurrentAsset(
      input: {
        plan_id: $planId
        current_asset: $currentAsset
        correlation_id: $correlationId
      }
    ) {
      service_ids
      updated_count
      signals
      metadata
    }
  }
`;

/**
 * Parse the metadata JSON string from vehicle assignment response
 */
export function parseVehicleAssignmentMetadata(metadataString: string): Record<string, unknown> | null {
  try {
    return JSON.parse(metadataString) as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to parse vehicle assignment metadata:', error);
    return null;
  }
}

/**
 * Check if vehicle assignment was successful based on response
 */
export function isVehicleAssignmentSuccessful(response: UpdateAssetAssignmentResponse): boolean {
  // Success if we have updated_count > 0 or specific success signals
  const hasUpdates = response.updated_count > 0;
  const hasSuccessSignal = Array.isArray(response.signals) && 
    (response.signals.includes('ASSET_ASSIGNED') || 
     response.signals.includes('ASSET_UPDATED') ||
     response.signals.includes('SUCCESS') ||
     response.signals.includes('IDEMPOTENT_OPERATION_DETECTED'));
  
  return hasUpdates || hasSuccessSignal;
}
