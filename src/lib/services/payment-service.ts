/**
 * Payment & Service Completion Service
 * 
 * Handles MQTT communication for reporting payment and service completion
 * to the ABS (Asset & Billing System) backend.
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

import type { WebViewBridge } from './mqtt-service';

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
 * Response from payment_and_service MQTT operation
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
 * Build the base payload structure
 */
function buildBasePayload(params: PublishPaymentAndServiceParams): {
  timestamp: string;
  plan_id: string;
  correlation_id: string;
  actor: { type: string; id: string };
} {
  const correlationId = `att-checkout-payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    timestamp: new Date().toISOString(),
    plan_id: params.planId,
    correlation_id: correlationId,
    actor: { type: params.actor.type, id: params.actor.id },
  };
}

/**
 * Build payment_data object for the payload
 */
function buildPaymentData(params: {
  serviceId: string;
  paymentAmount: number;
  paymentReference: string;
  isZeroCostRounding: boolean;
  isFirstTime: boolean;
}): {
  service_id: string;
  payment_amount: number;
  payment_reference: string;
  payment_method: string;
  payment_type: string;
} {
  return {
    service_id: params.serviceId,
    payment_amount: params.paymentAmount,
    payment_reference: params.paymentReference,
    payment_method: params.isZeroCostRounding ? 'ZERO_COST_ROUNDING' : 'MPESA',
    payment_type: params.isFirstTime ? 'DEPOSIT' : 'TOP_UP',
  };
}

/**
 * Build service_data object for the payload
 */
function buildServiceData(params: {
  oldBatteryId: string | null;
  newBatteryId: string | null;
  energyTransferred: number;
  isFirstTime: boolean;
}): Record<string, unknown> {
  const serviceData: Record<string, unknown> = {
    energy_transferred: Number.isNaN(params.energyTransferred) ? 0 : params.energyTransferred,
    service_duration: 240, // Default service duration
  };

  if (params.isFirstTime) {
    serviceData.new_battery_id = params.newBatteryId;
  } else {
    serviceData.old_battery_id = params.oldBatteryId;
    serviceData.new_battery_id = params.newBatteryId;
  }

  return serviceData;
}

/**
 * Build the full MQTT payload for payment_and_service
 * 
 * @param params - Parameters for building the payload
 * @returns The MQTT payload object and correlation ID, or null if invalid
 */
export function buildPaymentAndServicePayload(
  params: PublishPaymentAndServiceParams
): { payload: Record<string, unknown>; correlationId: string } | null {
  const { swapData, customerType, serviceId, actor, isQuotaBased = false, isZeroCostRounding = false, paymentReference } = params;
  
  // Use actualBatteryId (OPID/PPID from ATT service) as primary, fallback to id (QR code)
  const newBatteryId = swapData.newBattery?.actualBatteryId || swapData.newBattery?.id || null;
  const oldBatteryId = swapData.oldBattery?.actualBatteryId || swapData.oldBattery?.id || null;

  // Energy transferred = swapData.energyDiff (power differential, floored to 2dp)
  const energyTransferred = Math.max(0, swapData.energyDiff);

  // Payment amount = swapData.cost (calculated, rounded UP if >2dp)
  const paymentAmount = swapData.cost;

  // Build base payload
  const base = buildBasePayload(params);
  
  // Determine if we should include payment_data:
  // - isQuotaBased && !isZeroCostRounding: No payment_data (true quota credit)
  // - isZeroCostRounding: Include payment_data with original amount
  // - Normal payment: Include payment_data
  const shouldIncludePaymentData = !isQuotaBased || isZeroCostRounding;
  
  const isFirstTime = customerType === 'first-time';

  // Build service_data
  const serviceData = buildServiceData({
    oldBatteryId,
    newBatteryId,
    energyTransferred,
    isFirstTime,
  });

  // Validate battery data
  if (isFirstTime && !newBatteryId) {
    console.error('buildPaymentAndServicePayload: First-time customer requires newBatteryId');
    return null;
  }
  if (!isFirstTime && customerType === 'returning' && !oldBatteryId) {
    console.error('buildPaymentAndServicePayload: Returning customer requires oldBatteryId');
    return null;
  }

  // Build the data object
  const data: Record<string, unknown> = {
    action: 'REPORT_PAYMENT_AND_SERVICE_COMPLETION',
    attendant_station: actor.station || `STATION_${actor.id}`,
    service_data: serviceData,
  };

  // Add payment_data if needed
  if (shouldIncludePaymentData) {
    data.payment_data = buildPaymentData({
      serviceId,
      paymentAmount,
      paymentReference,
      isZeroCostRounding,
      isFirstTime,
    });
  }

  const payload = {
    ...base,
    data,
  };

  return { payload, correlationId: base.correlation_id };
}

/**
 * Get MQTT topics for payment_and_service operation
 */
export function getPaymentAndServiceTopics(planId: string): {
  requestTopic: string;
  responseTopic: string;
} {
  return {
    requestTopic: `emit/uxi/attendant/plan/${planId}/payment_and_service`,
    // Response topic must match what the backend publishes to (attendant, not service)
    responseTopic: `echo/abs/attendant/plan/${planId}/payment_and_service`,
  };
}

// ============================================================================
// Response Handler
// ============================================================================

/**
 * Parse and validate payment_and_service MQTT response
 */
export function parsePaymentAndServiceResponse(
  responseData: unknown,
  expectedCorrelationId: string
): PaymentAndServiceResponse {
  // Handle various response formats
  const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
  
  // Check correlation ID
  const responseCorrelationId = (data as Record<string, unknown>)?.correlation_id as string | undefined;
  
  const correlationMatches =
    Boolean(expectedCorrelationId) &&
    Boolean(responseCorrelationId) &&
    (responseCorrelationId === expectedCorrelationId ||
      responseCorrelationId?.startsWith(expectedCorrelationId) ||
      expectedCorrelationId.startsWith(responseCorrelationId || ''));

  if (!correlationMatches) {
    return {
      success: false,
      error: 'Correlation ID mismatch',
    };
  }

  const dataObj = (data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const success = (dataObj?.success as boolean) ?? false;
  const signals = (dataObj?.signals as string[]) || [];
  const metadata = (dataObj?.metadata as PaymentAndServiceResponse['metadata']) || {};

  // Check for error signals
  const hasErrorSignal = signals.some((signal) => ERROR_SIGNALS.includes(signal as typeof ERROR_SIGNALS[number]));
  
  // Check for success signals
  const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
  const hasServiceCompletedSignal = signals.includes('SERVICE_COMPLETED');
  const hasAssetSignals = signals.includes('ASSET_RETURNED') || signals.includes('ASSET_ALLOCATED');
  
  const hasSuccessSignal = success === true && 
    !hasErrorSignal &&
    Array.isArray(signals) && 
    (isIdempotent || hasServiceCompletedSignal || hasAssetSignals);

  if (hasErrorSignal) {
    return {
      success: false,
      correlationId: responseCorrelationId,
      signals,
      metadata,
      error: metadata?.reason || metadata?.message || (dataObj?.error as string) || 'Failed to record swap',
    };
  }

  if (hasSuccessSignal || (success && signals.length === 0)) {
    return {
      success: true,
      correlationId: responseCorrelationId,
      signals,
      metadata,
      isIdempotent,
    };
  }

  // Response received but not successful
  return {
    success: false,
    correlationId: responseCorrelationId,
    signals,
    metadata,
    error: metadata?.reason || metadata?.message || (dataObj?.error as string) || 'Failed to record swap',
  };
}

// ============================================================================
// MQTT Operations
// ============================================================================

/**
 * Publish payment_and_service message via bridge and wait for response
 * 
 * This function handles:
 * 1. Building the MQTT payload
 * 2. Subscribing to the response topic
 * 3. Publishing the message
 * 4. Waiting for and parsing the response
 * 
 * @param bridge - WebView bridge for MQTT operations
 * @param params - Parameters for the operation
 * @param callbacks - Callbacks for status updates
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to the response
 */
export async function publishPaymentAndService(
  bridge: WebViewBridge,
  params: PublishPaymentAndServiceParams,
  callbacks: {
    onStatusChange?: (status: PaymentAndServiceStatus) => void;
    onError?: (message: string, metadata?: PaymentAndServiceResponse['metadata']) => void;
    onSuccess?: (isIdempotent: boolean) => void;
  } = {},
  timeoutMs: number = 30000
): Promise<PaymentAndServiceResponse> {
  const { onStatusChange, onError, onSuccess } = callbacks;

  // Build payload
  const result = buildPaymentAndServicePayload(params);
  if (!result) {
    onStatusChange?.('error');
    onError?.('Unable to complete swap - missing battery data');
    return { success: false, error: 'Unable to build payload - missing battery data' };
  }

  const { payload, correlationId } = result;
  const { requestTopic, responseTopic } = getPaymentAndServiceTopics(params.planId);

  onStatusChange?.('pending');

  console.info('=== Publishing payment_and_service ===');
  console.info('Request Topic:', requestTopic);
  console.info('Response Topic:', responseTopic);
  console.info('Correlation ID:', correlationId);
  console.info('Payload:', JSON.stringify(payload, null, 2));

  return new Promise((resolve) => {
    let resolved = false;

    // Set a timeout to prevent infinite waiting
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.error('payment_and_service timed out after', timeoutMs, 'ms');
      onStatusChange?.('error');
      onError?.('Request timed out. Please try again.');
      resolve({ success: false, error: 'Request timed out' });
    }, timeoutMs);

    // Register response handler
    bridge.registerHandler(
      'mqttMsgArrivedCallBack',
      (data: string, responseCallback: (response: unknown) => void) => {
        try {
          const parsedMqttData = JSON.parse(data);
          const topic = parsedMqttData.topic;
          const rawMessageContent = parsedMqttData.message;

          console.info('=== MQTT Message Arrived (Payment & Service Flow) ===');
          console.info('Received topic:', topic);
          console.info('Expected topic:', responseTopic);

          // Check if this is our response topic
          if (topic === responseTopic) {
            console.info('✅ Topic MATCHED! Processing payment_and_service response');

            // Parse response
            const response = parsePaymentAndServiceResponse(rawMessageContent, correlationId);

            if (response.correlationId || topic === responseTopic) {
              if (resolved) {
                responseCallback({});
                return;
              }
              resolved = true;
              clearTimeout(timeoutId);

              if (response.success) {
                console.info('payment_and_service completed successfully!', response.isIdempotent ? '(idempotent)' : '');
                onStatusChange?.('success');
                onSuccess?.(response.isIdempotent || false);
              } else {
                console.error('payment_and_service failed:', response.error);
                onStatusChange?.('error');
                const errorMsg = response.error || 'Failed to record swap';
                const actionRequired = response.metadata?.action_required;
                onError?.(actionRequired ? `${errorMsg}. ${actionRequired}` : errorMsg, response.metadata);
              }

              resolve(response);
            }
          }
          responseCallback({});
        } catch (err) {
          console.error('Error processing payment_and_service MQTT response:', err);
        }
      }
    );

    // Subscribe to response topic first
    console.info('=== Subscribing to response topic for payment_and_service ===');
    
    bridge.callHandler(
      'mqttSubTopic',
      { topic: responseTopic, qos: 1 },
      (subscribeResponse: string) => {
        try {
          const subResp = typeof subscribeResponse === 'string' 
            ? JSON.parse(subscribeResponse) 
            : subscribeResponse;
          
          if (subResp?.respCode === '200') {
            console.info('✅ Successfully subscribed to payment_and_service response topic');
            
            // Wait a moment after subscribe before publishing
            setTimeout(() => {
              if (resolved) return;
              
              try {
                const dataToPublish = {
                  topic: requestTopic,
                  qos: 0,
                  content: payload,
                };

                console.info('=== Publishing payment_and_service message ===');
                bridge.callHandler(
                  'mqttPublishMsg',
                  JSON.stringify(dataToPublish),
                  (publishResponse: unknown) => {
                    console.info('payment_and_service mqttPublishMsg callback received:', publishResponse);
                    try {
                      const pubResp = typeof publishResponse === 'string' 
                        ? JSON.parse(publishResponse) 
                        : publishResponse;
                      
                      if ((pubResp as Record<string, unknown>)?.error || (pubResp as Record<string, unknown>)?.respCode !== '200') {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeoutId);
                        console.error('Failed to publish payment_and_service:', (pubResp as Record<string, unknown>)?.respDesc || (pubResp as Record<string, unknown>)?.error);
                        onStatusChange?.('error');
                        onError?.('Failed to complete swap');
                        resolve({ success: false, error: 'Publish failed' });
                      } else {
                        console.info('payment_and_service published successfully, waiting for backend response...');
                        // Wait for the actual backend response via MQTT handler
                      }
                    } catch (err) {
                      if (resolved) return;
                      resolved = true;
                      clearTimeout(timeoutId);
                      console.error('Error parsing payment_and_service publish response:', err);
                      onStatusChange?.('error');
                      onError?.('Error completing swap');
                      resolve({ success: false, error: 'Parse error' });
                    }
                  }
                );
              } catch (err) {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                console.error('Exception calling bridge.callHandler for payment_and_service:', err);
                onStatusChange?.('error');
                onError?.('Error sending request. Please try again.');
                resolve({ success: false, error: 'Exception during publish' });
              }
            }, 300);
          } else {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            console.error('Failed to subscribe to payment_and_service response topic:', subResp?.respDesc || subResp?.error);
            onStatusChange?.('error');
            onError?.('Failed to connect. Please try again.');
            resolve({ success: false, error: 'Subscribe failed' });
          }
        } catch (err) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.error('Error parsing payment_and_service subscribe response:', err);
          onStatusChange?.('error');
          onError?.('Error connecting. Please try again.');
          resolve({ success: false, error: 'Subscribe parse error' });
        }
      }
    );
  });
}
