/**
 * useSalesCustomerIdentification Hook
 * 
 * Extends the base useCustomerIdentification hook with:
 * - Silent automatic retry with exponential backoff
 * - Manual retry trigger with visible feedback (like Attendant flow)
 * - Retry state tracking for UI feedback
 * 
 * This is specifically designed for the Sales workflow where:
 * - Customer identification happens in the background after payment
 * - We need the service data (unit price/rate) to calculate energy cost
 * - The Complete Service button should be disabled until identification succeeds
 * - Retries should be silent (no toasts) but manual retry shows feedback
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { PAYMENT } from '@/lib/constants';
import { round } from '@/lib/utils';
import type { ServiceState, CustomerIdentificationResult, IdentifyCustomerInput } from './useCustomerIdentification';

// Re-export types for convenience
export type { ServiceState, CustomerIdentificationResult, IdentifyCustomerInput };

// ============================================
// TYPES
// ============================================

/** State of the identification process */
export type IdentificationStatus = 
  | 'idle'           // Not started
  | 'pending'        // First attempt in progress
  | 'retrying'       // Automatic retry in progress
  | 'success'        // Successfully identified
  | 'failed';        // All retries exhausted

/** Bridge interface for MQTT operations */
interface MqttBridge {
  registerHandler: (name: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (name: string, data: any, callback: (response: string) => void) => void;
}

/** Hook configuration */
export interface UseSalesCustomerIdentificationConfig {
  /** The bridge instance for MQTT communication */
  bridge: MqttBridge | null;
  /** Whether the bridge is ready */
  isBridgeReady: boolean;
  /** Whether MQTT is connected */
  isMqttConnected: boolean;
  /** Attendant/Salesperson information */
  attendantInfo: {
    id: string;
    station: string;
  };
  /** Default rate if not provided by service */
  defaultRate?: number;
  /** Maximum number of automatic retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 2000) */
  baseRetryDelay?: number;
  /** Maximum delay in ms for exponential backoff (default: 15000) */
  maxRetryDelay?: number;
}

// ============================================
// CONSTANTS
// ============================================

/** Threshold for "infinite quota" services */
const INFINITE_QUOTA_THRESHOLD = 100000;

/** Timeout for identification request (ms) */
const IDENTIFICATION_TIMEOUT = 30000;

/** Default retry configuration */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_RETRY_DELAY = 2000;  // 2 seconds
const DEFAULT_MAX_RETRY_DELAY = 15000;  // 15 seconds max

// ============================================
// HOOK
// ============================================

export function useSalesCustomerIdentification(config: UseSalesCustomerIdentificationConfig) {
  const {
    bridge,
    isBridgeReady,
    isMqttConnected,
    attendantInfo,
    defaultRate = 120,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseRetryDelay = DEFAULT_BASE_RETRY_DELAY,
    maxRetryDelay = DEFAULT_MAX_RETRY_DELAY,
  } = config;

  // State
  const [status, setStatus] = useState<IdentificationStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<CustomerIdentificationResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs for managing async operations
  const correlationIdRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<IdentifyCustomerInput | null>(null);
  const isManuaRetryRef = useRef(false);
  const isActiveRef = useRef(false);

  /**
   * Clear the identification timeout
   */
  const clearIdentificationTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Clear the retry timeout
   */
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Calculate delay for exponential backoff
   */
  const calculateRetryDelay = useCallback((attempt: number): number => {
    // Exponential backoff: baseDelay * 2^attempt with jitter
    const exponentialDelay = baseRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Random jitter up to 1 second
    return Math.min(exponentialDelay + jitter, maxRetryDelay);
  }, [baseRetryDelay, maxRetryDelay]);

  /**
   * Parse and process the MQTT response data
   */
  const processResponseData = useCallback((
    responseData: any,
    input: IdentifyCustomerInput
  ): CustomerIdentificationResult | null => {
    const success = responseData?.data?.success ?? false;
    const signals = responseData?.data?.signals || [];

    // Check for success signals
    const hasSuccessSignal = success === true && 
      Array.isArray(signals) && 
      (signals.includes("CUSTOMER_IDENTIFIED_SUCCESS") || signals.includes("IDEMPOTENT_OPERATION_DETECTED"));

    if (!hasSuccessSignal) {
      // Provide specific error messages based on failure signals
      let errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message;
      if (!errorMsg) {
        if (signals.includes("SERVICE_PLAN_NOT_FOUND") || signals.includes("CUSTOMER_NOT_FOUND")) {
          errorMsg = "Customer not found. Please check the subscription ID.";
        } else if (signals.includes("INVALID_QR_CODE")) {
          errorMsg = "Invalid QR code. Please scan a valid customer QR code.";
        } else if (signals.includes("INVALID_SUBSCRIPTION_ID")) {
          errorMsg = "Invalid subscription ID format.";
        } else {
          errorMsg = "Customer identification failed";
        }
      }
      throw new Error(errorMsg);
    }

    // Handle both fresh and idempotent (cached) responses
    const metadata = responseData?.data?.metadata;
    const isIdempotent = signals.includes("IDEMPOTENT_OPERATION_DETECTED");
    
    // For idempotent responses, data is in cached_result
    const sourceData = isIdempotent ? metadata?.cached_result : metadata;
    const servicePlanData = sourceData?.service_plan_data || sourceData?.servicePlanData;
    const serviceBundle = sourceData?.service_bundle;
    const commonTerms = sourceData?.common_terms;
    const identifiedCustomerId = sourceData?.customer_id || metadata?.customer_id;

    if (!servicePlanData) {
      throw new Error("Invalid customer data received");
    }

    // Extract and enrich service states
    const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
      (service: any) => typeof service?.service_id === 'string'
    );
    
    const enrichedServiceStates: ServiceState[] = extractedServiceStates.map((serviceState: any) => {
      const matchingService = serviceBundle?.services?.find(
        (svc: any) => svc.serviceId === serviceState.service_id
      );
      return {
        ...serviceState,
        name: matchingService?.name,
        usageUnitPrice: matchingService?.usageUnitPrice,
      };
    });

    // Find specific services
    const batteryFleet = enrichedServiceStates.find(
      (s) => s.service_id?.includes('service-battery-fleet')
    );
    const elecService = enrichedServiceStates.find(
      (s) => s.service_id?.includes('service-electricity')
    );
    const swapCountService = enrichedServiceStates.find(
      (s) => s.service_id?.includes('service-swap-count')
    );

    // Determine customer type
    const customerType: 'first-time' | 'returning' = batteryFleet?.current_asset ? 'returning' : 'first-time';

    // Extract billing currency from common_terms (source of truth)
    const billingCurrency = commonTerms?.billingCurrency || servicePlanData?.currency || PAYMENT.defaultCurrency;
    
    // Get rate from electricity service
    const rate = elecService?.usageUnitPrice || defaultRate;

    // Check for infinite quota services
    const hasInfiniteEnergyQuota = (elecService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
    const hasInfiniteSwapQuota = (swapCountService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;

    // Calculate remaining quota values
    const energyRemaining = elecService ? round(elecService.quota - elecService.used, 2) : 0;
    const energyUnitPrice = elecService?.usageUnitPrice || 0;
    const energyValue = energyRemaining * energyUnitPrice;

    // Build customer data
    const customer = {
      id: identifiedCustomerId || servicePlanData.customerId || input.customerId || input.subscriptionCode,
      name: input.name || identifiedCustomerId || 'Customer',
      subscriptionId: servicePlanData.servicePlanId || input.subscriptionCode,
      subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
      phone: input.phone || '',
      swapCount: swapCountService?.used || 0,
      lastSwap: 'N/A',
      energyRemaining,
      energyTotal: elecService?.quota || 0,
      energyValue,
      energyUnitPrice,
      swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
      swapsTotal: swapCountService?.quota || 21,
      hasInfiniteEnergyQuota,
      hasInfiniteSwapQuota,
      paymentState: servicePlanData.paymentState || 'INITIAL',
      serviceState: servicePlanData.serviceState || 'INITIAL',
      currentBatteryId: batteryFleet?.current_asset || undefined,
    };

    return {
      customer,
      serviceStates: enrichedServiceStates,
      customerType,
      rate,
      currencySymbol: billingCurrency,
      isIdempotent,
    };
  }, [defaultRate]);

  /**
   * Internal function to perform a single identification attempt
   */
  const performIdentification = useCallback((
    input: IdentifyCustomerInput,
    isRetry: boolean,
    isManual: boolean,
    currentRetryCount: number
  ): Promise<CustomerIdentificationResult> => {
    return new Promise((resolve, reject) => {
      const { subscriptionCode, source } = input;

      // Validate inputs
      if (!subscriptionCode.trim()) {
        const errorMsg = source === 'manual' 
          ? 'Please enter a Subscription ID' 
          : 'No subscription code found';
        reject(new Error(errorMsg));
        return;
      }

      if (!bridge || !isBridgeReady) {
        reject(new Error('Bridge not available'));
        return;
      }

      if (!isMqttConnected) {
        reject(new Error('MQTT not connected'));
        return;
      }

      // Generate correlation ID
      const correlationId = `sales-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      correlationIdRef.current = correlationId;
      (window as any).__salesCustomerIdentificationCorrelationId = correlationId;

      // Build MQTT topics
      const requestTopic = `emit/uxi/attendant/plan/${subscriptionCode}/identify_customer`;
      const responseTopic = `echo/abs/attendant/plan/${subscriptionCode}/identify_customer`;

      // Build payload
      const payload = {
        timestamp: new Date().toISOString(),
        plan_id: subscriptionCode,
        correlation_id: correlationId,
        actor: { type: "attendant", id: attendantInfo.id },
        data: {
          action: "IDENTIFY_CUSTOMER",
          qr_code_data: source === 'manual' 
            ? `MANUAL_${subscriptionCode}` 
            : `QR_CUSTOMER_${subscriptionCode}`,
          attendant_station: attendantInfo.station,
        },
      };

      const dataToPublish = {
        topic: requestTopic,
        qos: 0,
        content: payload,
      };

      // Only log on first attempt or manual retry (not silent retries)
      if (!isRetry || isManual) {
        console.info(`=== Sales Customer Identification MQTT (${source}) ===`);
        console.info("Request Topic:", requestTopic);
        console.info("Correlation ID:", correlationId);
      } else {
        console.info(`[SALES ID] Retry ${currentRetryCount}/${maxRetries} for ${subscriptionCode}`);
      }

      // Set timeout
      clearIdentificationTimeout();
      timeoutRef.current = setTimeout(() => {
        console.warn(`[SALES ID] Identification timeout (attempt ${currentRetryCount})`);
        reject(new Error('Request timed out'));
      }, IDENTIFICATION_TIMEOUT);

      // Register response handler
      bridge.registerHandler(
        "mqttMsgArrivedCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const parsedMqttData = JSON.parse(data);
            const topic = parsedMqttData.topic;
            const rawMessageContent = parsedMqttData.message;

            if (topic === responseTopic) {
              let responseData: any;
              try {
                responseData = typeof rawMessageContent === 'string' 
                  ? JSON.parse(rawMessageContent) 
                  : rawMessageContent;
              } catch {
                responseData = rawMessageContent;
              }

              // Check correlation ID
              const storedCorrelationId = (window as any).__salesCustomerIdentificationCorrelationId;
              const responseCorrelationId = responseData?.correlation_id;

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches) {
                clearIdentificationTimeout();

                try {
                  const result = processResponseData(responseData, input);
                  if (result) {
                    resolve(result);
                  } else {
                    reject(new Error('Invalid response data'));
                  }
                } catch (err: any) {
                  reject(err);
                }
              }
            }
            responseCallback({});
          } catch (err) {
            // Ignore parsing errors for unrelated messages
          }
        }
      );

      // Subscribe to response topic, then publish
      bridge.callHandler(
        "mqttSubTopic",
        { topic: responseTopic, qos: 0 },
        (subscribeResponse: string) => {
          try {
            const subResp = typeof subscribeResponse === 'string' 
              ? JSON.parse(subscribeResponse) 
              : subscribeResponse;

            if (subResp?.respCode === "200") {
              // Wait a moment after subscribe before publishing
              setTimeout(() => {
                bridge.callHandler(
                  "mqttPublishMsg",
                  JSON.stringify(dataToPublish),
                  (publishResponse: string) => {
                    try {
                      const pubResp = typeof publishResponse === 'string' 
                        ? JSON.parse(publishResponse) 
                        : publishResponse;
                      if (pubResp?.error || pubResp?.respCode !== "200") {
                        clearIdentificationTimeout();
                        reject(new Error('Failed to publish identification request'));
                      }
                    } catch (err) {
                      clearIdentificationTimeout();
                      reject(new Error('Error publishing request'));
                    }
                  }
                );
              }, 300);
            } else {
              clearIdentificationTimeout();
              reject(new Error('Failed to subscribe to response topic'));
            }
          } catch (err) {
            clearIdentificationTimeout();
            reject(new Error('Error subscribing to response topic'));
          }
        }
      );
    });
  }, [
    bridge, 
    isBridgeReady, 
    isMqttConnected, 
    attendantInfo, 
    maxRetries,
    clearIdentificationTimeout, 
    processResponseData,
  ]);

  /**
   * Start identification with automatic retry
   */
  const identifyCustomer = useCallback((input: IdentifyCustomerInput) => {
    // Store input for potential retries
    inputRef.current = input;
    isManuaRetryRef.current = false;
    isActiveRef.current = true;

    // Reset state
    setStatus('pending');
    setRetryCount(0);
    setResult(null);
    setLastError(null);

    const attemptIdentification = async (attempt: number) => {
      if (!isActiveRef.current) {
        console.info('[SALES ID] Identification cancelled');
        return;
      }

      try {
        const identificationResult = await performIdentification(
          input, 
          attempt > 0, 
          false, 
          attempt
        );
        
        if (!isActiveRef.current) return;

        // Success!
        console.info('[SALES ID] Customer identified successfully');
        setResult(identificationResult);
        setStatus('success');
        setLastError(null);
        
        // No toast for background identification - silent success
      } catch (error: any) {
        if (!isActiveRef.current) return;

        const errorMsg = error.message || 'Identification failed';
        console.warn(`[SALES ID] Attempt ${attempt + 1} failed:`, errorMsg);
        setLastError(errorMsg);

        // Check if we should retry
        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(attempt);
          console.info(`[SALES ID] Scheduling retry in ${Math.round(delay / 1000)}s...`);
          
          setStatus('retrying');
          setRetryCount(attempt + 1);

          // Schedule retry - no toast notification (silent retry)
          retryTimeoutRef.current = setTimeout(() => {
            attemptIdentification(attempt + 1);
          }, delay);
        } else {
          // All retries exhausted
          console.error('[SALES ID] All retries exhausted');
          setStatus('failed');
          // No toast - user will see the manual retry option
        }
      }
    };

    // Start first attempt
    attemptIdentification(0);
  }, [performIdentification, maxRetries, calculateRetryDelay]);

  /**
   * Manual retry - shows feedback like Attendant flow
   */
  const manualRetry = useCallback(() => {
    if (!inputRef.current) {
      toast.error('No identification request to retry');
      return;
    }

    // Clear any pending retries
    clearRetryTimeout();
    clearIdentificationTimeout();
    
    isManuaRetryRef.current = true;
    isActiveRef.current = true;

    // Reset state
    setStatus('pending');
    setRetryCount(0);
    setLastError(null);

    const input = inputRef.current;

    const attemptManualIdentification = async () => {
      try {
        toast.loading('Identifying customer...', { id: 'manual-identify' });
        
        const identificationResult = await performIdentification(input, false, true, 0);
        
        if (!isActiveRef.current) return;

        // Success!
        toast.success('Customer identified successfully', { id: 'manual-identify' });
        setResult(identificationResult);
        setStatus('success');
        setLastError(null);
      } catch (error: any) {
        if (!isActiveRef.current) return;

        const errorMsg = error.message || 'Identification failed';
        toast.error(errorMsg, { id: 'manual-identify' });
        setLastError(errorMsg);
        setStatus('failed');
      }
    };

    attemptManualIdentification();
  }, [performIdentification, clearRetryTimeout, clearIdentificationTimeout]);

  /**
   * Cancel any pending identification
   */
  const cancelIdentification = useCallback(() => {
    isActiveRef.current = false;
    clearIdentificationTimeout();
    clearRetryTimeout();
    (window as any).__salesCustomerIdentificationCorrelationId = null;
  }, [clearIdentificationTimeout, clearRetryTimeout]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    cancelIdentification();
    setStatus('idle');
    setRetryCount(0);
    setResult(null);
    setLastError(null);
    inputRef.current = null;
  }, [cancelIdentification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelIdentification();
    };
  }, [cancelIdentification]);

  // Derived state
  const isIdentifying = status === 'pending' || status === 'retrying';
  const isIdentified = status === 'success' && result !== null;
  const hasFailed = status === 'failed';
  const canManualRetry = hasFailed || (status === 'idle' && lastError !== null);

  return {
    // State
    status,
    retryCount,
    result,
    lastError,
    
    // Derived state
    isIdentifying,
    isIdentified,
    hasFailed,
    canManualRetry,
    
    // Actions
    identifyCustomer,
    manualRetry,
    cancelIdentification,
    reset,
    
    // For convenience - extracted values from result
    rate: result?.rate ?? 0,
    currencySymbol: result?.currencySymbol ?? PAYMENT.defaultCurrency,
    serviceStates: result?.serviceStates ?? [],
  };
}

export default useSalesCustomerIdentification;
