/**
 * Payment & Service Completion Service
 * 
 * Handles GraphQL communication for reporting payment and service completion
 * to the ABS (Asset & Billing System) backend.
 * 
 * NOTE: This service was migrated from MQTT to GraphQL in December 2024.
 * The interface remains the same to maintain backwards compatibility.
 * 
 * Usage:
 * ```typescript
 * import { usePaymentAndService } from '@/lib/services/hooks';
 * 
 * function MyComponent() {
 *   const { publishPaymentAndService, status, reset } = usePaymentAndService({
 *     onSuccess: () => advanceToStep(6),
 *     onError: (msg) => toast.error(msg),
 *   });
 *   
 *   const handleConfirmPayment = () => {
 *     publishPaymentAndService({
 *       paymentReference: 'MPESA_123',
 *       isQuotaBased: false,
 *       // ... other params
 *     });
 *   };
 * }
 * ```
 */

import { absApolloClient } from '@/lib/apollo-client';
import {
  REPORT_PAYMENT_AND_SERVICE,
  type ReportPaymentAndServiceInput,
  type ReportPaymentAndServiceResponse,
  type PaymentDataInput,
  type ServiceDataInput,
  isPaymentAndServiceSuccessful,
  hasErrorSignals,
  parsePaymentAndServiceMetadata,
} from '@/lib/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

/**
 * Battery data for service completion
 */
export interface ServiceBatteryData {
  /** Battery ID (OPID/PPID from ATT service or QR code) */
  id: string | null;
  /** Actual battery ID from ATT service (OPID/PPID) - preferred over QR code ID */
  actualBatteryId?: string | null;
  /** Energy in Wh */
  energy: number;
}

/**
 * Swap data needed for service completion
 */
export interface ServiceSwapData {
  oldBattery: ServiceBatteryData | null;
  newBattery: ServiceBatteryData | null;
  /** Energy differential in kWh (floored to 2dp) */
  energyDiff: number;
  /** Cost to report (chargeableEnergy × rate, rounded UP if >2dp) */
  cost: number;
  /** Rate per kWh */
  rate: number;
  /** Currency symbol */
  currencySymbol: string;
}

/**
 * Actor information for service completion
 */
export interface ServiceActor {
  type: 'attendant' | 'customer' | 'system';
  id: string;
  station?: string;
}

/**
 * Parameters for publishing payment and service completion
 */
export interface PublishPaymentAndServiceParams {
  /** Payment reference/receipt */
  paymentReference: string;
  /** Plan/subscription ID */
  planId: string;
  /** Swap data (batteries, energy, cost) */
  swapData: ServiceSwapData;
  /** Customer type (determines payload structure) */
  customerType: 'first-time' | 'returning' | null;
  /** Electricity service ID */
  serviceId: string;
  /** Actor performing the operation */
  actor: ServiceActor;
  /** Whether customer is using quota credit (no payment_data sent) */
  isQuotaBased?: boolean;
  /** Whether cost rounded to 0 but NOT quota-based (payment_data sent with original amount) */
  isZeroCostRounding?: boolean;
}

/**
 * Response from payment_and_service operation
 */
export interface PaymentAndServiceResponse {
  success: boolean;
  correlationId?: string;
  signals?: string[];
  metadata?: {
    reason?: string;
    message?: string;
    action_required?: string;
  };
  error?: string;
  isIdempotent?: boolean;
}

/**
 * Status of the payment and service operation
 */
export type PaymentAndServiceStatus = 'idle' | 'pending' | 'success' | 'error';

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
] as const;

/**
 * Success signals that indicate operation completed
 */
export const SUCCESS_SIGNALS = [
  'SERVICE_COMPLETED',
  'ASSET_RETURNED',
  'ASSET_ALLOCATED',
  'IDEMPOTENT_OPERATION_DETECTED',
] as const;

// ============================================================================
// Payload Builders
// ============================================================================

/**
 * Build the GraphQL input for payment_and_service
 * 
 * @param params - Parameters for building the payload
 * @returns The GraphQL input object and correlation ID, or null if invalid
 */
export function buildPaymentAndServiceInput(
  params: PublishPaymentAndServiceParams
): { input: ReportPaymentAndServiceInput; correlationId: string } | null {
  const { swapData, customerType, serviceId, actor, isQuotaBased = false, isZeroCostRounding = false, paymentReference, planId } = params;
  
  // Use actualBatteryId (OPID/PPID from ATT service) as primary, fallback to id (QR code)
  const newBatteryId = swapData.newBattery?.actualBatteryId || swapData.newBattery?.id || null;
  const oldBatteryId = swapData.oldBattery?.actualBatteryId || swapData.oldBattery?.id || null;

  // Energy transferred = swapData.energyDiff (power differential, floored to 2dp)
  const energyTransferred = Math.max(0, swapData.energyDiff);

  // Payment amount = swapData.cost (calculated, rounded UP if >2dp)
  const paymentAmount = swapData.cost;

  // Generate correlation ID
  const correlationId = `att-checkout-payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const isFirstTime = customerType === 'first-time';

  // Validate battery data
  if (isFirstTime && !newBatteryId) {
    console.error('buildPaymentAndServiceInput: First-time customer requires newBatteryId');
    return null;
  }
  if (!isFirstTime && customerType === 'returning' && !oldBatteryId) {
    console.error('buildPaymentAndServiceInput: Returning customer requires oldBatteryId');
    return null;
  }

  // Build service_data
  const serviceData: ServiceDataInput = {
    new_battery_id: newBatteryId || '',
    energy_transferred: Number.isNaN(energyTransferred) ? 0 : energyTransferred,
    service_duration: 240, // Default service duration
  };

  if (!isFirstTime && oldBatteryId) {
    serviceData.old_battery_id = oldBatteryId;
  }

  // Build the input
  const input: ReportPaymentAndServiceInput = {
    plan_id: planId,
    correlation_id: correlationId,
    attendant_station: actor.station || `STATION_${actor.id}`,
    service_data: serviceData,
  };

  // Determine if we should include payment_data:
  // - isQuotaBased && !isZeroCostRounding: No payment_data (true quota credit)
  // - isZeroCostRounding: Include payment_data with original amount
  // - Normal payment: Include payment_data
  const shouldIncludePaymentData = !isQuotaBased || isZeroCostRounding;

  if (shouldIncludePaymentData) {
    input.payment_data = {
      service_id: serviceId,
      payment_amount: paymentAmount,
      payment_reference: paymentReference,
      payment_method: isZeroCostRounding ? 'ZERO_COST_ROUNDING' : 'MPESA',
      payment_type: isFirstTime ? 'DEPOSIT' : 'TOP_UP',
    };
  }

  return { input, correlationId };
}

// ============================================================================
// GraphQL Operations
// ============================================================================

/**
 * Publish payment_and_service message via GraphQL
 * 
 * This function handles:
 * 1. Building the GraphQL input
 * 2. Making the mutation request
 * 3. Parsing and validating the response
 * 
 * @param params - Parameters for the operation
 * @param callbacks - Callbacks for status updates
 * @returns Promise resolving to the response
 */
export async function publishPaymentAndService(
  params: PublishPaymentAndServiceParams,
  callbacks: {
    onStatusChange?: (status: PaymentAndServiceStatus) => void;
    onError?: (message: string, metadata?: PaymentAndServiceResponse['metadata']) => void;
    onSuccess?: (isIdempotent: boolean) => void;
  } = {},
): Promise<PaymentAndServiceResponse> {
  const { onStatusChange, onError, onSuccess } = callbacks;

  // Build input
  const result = buildPaymentAndServiceInput(params);
  if (!result) {
    onStatusChange?.('error');
    onError?.('Unable to complete swap - missing battery data');
    return { success: false, error: 'Unable to build payload - missing battery data' };
  }

  const { input, correlationId } = result;

  onStatusChange?.('pending');

  console.info('=== Publishing payment_and_service via GraphQL ===');
  console.info('Correlation ID:', correlationId);
  console.info('Input:', JSON.stringify(input, null, 2));

  try {
    const graphqlResult = await absApolloClient.mutate<{ reportPaymentAndServiceCompletion: ReportPaymentAndServiceResponse }>({
      mutation: REPORT_PAYMENT_AND_SERVICE,
      variables: { input },
    });

    if (graphqlResult.errors && graphqlResult.errors.length > 0) {
      const errorMsg = graphqlResult.errors[0].message || 'Failed to complete swap';
      console.error('GraphQL errors:', graphqlResult.errors);
      onStatusChange?.('error');
      onError?.(errorMsg);
      return { success: false, error: errorMsg, correlationId };
    }

    if (!graphqlResult.data?.reportPaymentAndServiceCompletion) {
      const errorMsg = 'No response from server';
      onStatusChange?.('error');
      onError?.(errorMsg);
      return { success: false, error: errorMsg, correlationId };
    }

    const response = graphqlResult.data.reportPaymentAndServiceCompletion;
    console.info('GraphQL Response:', response);
    console.info('Signals:', response.signals);

    // Parse metadata for additional info
    const metadata = response.metadata ? parsePaymentAndServiceMetadata(response.metadata) : null;

    // Check for error signals
    if (hasErrorSignals(response.signals)) {
      const errorMetadata = {
        reason: metadata?.reason as string | undefined,
        message: metadata?.message as string | undefined || response.status_message,
        action_required: metadata?.action_required as string | undefined,
      };
      const errorMsg = errorMetadata.reason || errorMetadata.message || 'Failed to record swap';
      
      console.error('payment_and_service failed:', errorMsg);
      onStatusChange?.('error');
      onError?.(errorMsg, errorMetadata);
      
      return {
        success: false,
        correlationId: response.correlation_id,
        signals: response.signals,
        metadata: errorMetadata,
        error: errorMsg,
      };
    }

    // Check for success
    if (isPaymentAndServiceSuccessful(response)) {
      const isIdempotent = response.signals.includes('IDEMPOTENT_OPERATION_DETECTED');
      
      console.info('payment_and_service completed successfully!', isIdempotent ? '(idempotent)' : '');
      onStatusChange?.('success');
      onSuccess?.(isIdempotent);
      
      return {
        success: true,
        correlationId: response.correlation_id,
        signals: response.signals,
        isIdempotent,
      };
    }

    // Response received but not successful
    const errorMsg = response.status_message || 'Failed to record swap';
    onStatusChange?.('error');
    onError?.(errorMsg);
    
    return {
      success: false,
      correlationId: response.correlation_id,
      signals: response.signals,
      error: errorMsg,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GraphQL request failed:', error);
    const errorMsg = error.message || 'Request failed. Please try again.';
    onStatusChange?.('error');
    onError?.(errorMsg);
    return { success: false, error: errorMsg, correlationId };
  }
}

// ============================================================================
// Legacy Exports (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use buildPaymentAndServiceInput instead
 * This function is kept for backwards compatibility but doesn't require a bridge anymore
 */
export function buildPaymentAndServicePayload(
  params: PublishPaymentAndServiceParams
): { payload: Record<string, unknown>; correlationId: string } | null {
  const result = buildPaymentAndServiceInput(params);
  if (!result) return null;
  
  // Convert GraphQL input to old MQTT payload format for compatibility
  return {
    payload: {
      timestamp: new Date().toISOString(),
      plan_id: result.input.plan_id,
      correlation_id: result.correlationId,
      actor: { type: params.actor.type, id: params.actor.id },
      data: {
        action: 'REPORT_PAYMENT_AND_SERVICE_COMPLETION',
        attendant_station: result.input.attendant_station,
        service_data: result.input.service_data,
        payment_data: result.input.payment_data,
      },
    },
    correlationId: result.correlationId,
  };
}

/**
 * @deprecated No longer needed for GraphQL
 * This function is kept for backwards compatibility
 */
export function getPaymentAndServiceTopics(planId: string): {
  requestTopic: string;
  responseTopic: string;
} {
  return {
    requestTopic: `emit/uxi/attendant/plan/${planId}/payment_and_service`,
    responseTopic: `echo/abs/attendant/plan/${planId}/payment_and_service`,
  };
}

/**
 * @deprecated Use isPaymentAndServiceSuccessful from graphql/mutations instead
 */
export function parsePaymentAndServiceResponse(
  responseData: unknown,
  expectedCorrelationId: string
): PaymentAndServiceResponse {
  // This is no longer needed for GraphQL but kept for backwards compatibility
  const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
  const dataObj = (data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const success = (dataObj?.success as boolean) ?? false;
  const signals = (dataObj?.signals as string[]) || [];
  
  return {
    success,
    correlationId: expectedCorrelationId,
    signals,
  };
}
