/**
 * useCustomerIdentification Hook
 * 
 * Handles customer identification via MQTT for the attendant workflow.
 * Extracts the duplicated logic from processCustomerQRData and handleManualLookup.
 * 
 * This hook:
 * - Publishes identify_customer request to MQTT
 * - Handles response parsing and validation
 * - Extracts customer data, service states, and pricing info
 * - Determines customer type (first-time vs returning)
 */

import { useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { PAYMENT } from '@/lib/constants';
import { round } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

/** Service state from MQTT response */
export interface ServiceState {
  service_id: string;
  used: number;
  quota: number;
  current_asset: string | null;
  name?: string;
  usageUnitPrice?: number;
}

/** Customer data extracted from identification response */
export interface IdentifiedCustomerData {
  id: string;
  name: string;
  subscriptionId: string;
  subscriptionType: string;
  phone?: string;
  swapCount?: number;
  lastSwap?: string;
  energyRemaining?: number;
  energyTotal?: number;
  energyValue?: number;
  energyUnitPrice?: number;
  swapsRemaining?: number;
  swapsTotal?: number;
  hasInfiniteEnergyQuota?: boolean;
  hasInfiniteSwapQuota?: boolean;
  paymentState?: 'INITIAL' | 'DEPOSIT_DUE' | 'CURRENT' | 'RENEWAL_DUE' | 'FINAL_DUE' | 'COMPLETE';
  serviceState?: 'INITIAL' | 'WAIT_BATTERY_ISSUE' | 'BATTERY_ISSUED' | 'BATTERY_RETURNED' | 'BATTERY_LOST' | 'COMPLETE';
  currentBatteryId?: string;
}

/** Result returned on successful identification */
export interface CustomerIdentificationResult {
  customer: IdentifiedCustomerData;
  serviceStates: ServiceState[];
  customerType: 'first-time' | 'returning';
  rate: number;
  currencySymbol: string;
  isIdempotent: boolean;
}

/** Input for identification request */
export interface IdentifyCustomerInput {
  /** Subscription code / plan ID */
  subscriptionCode: string;
  /** Source of the identification request */
  source: 'qr' | 'manual';
  /** Optional customer name from QR code */
  name?: string;
  /** Optional customer phone from QR code */
  phone?: string;
  /** Optional raw customer ID from QR */
  customerId?: string;
}

/** Bridge interface for MQTT operations */
interface MqttBridge {
  registerHandler: (name: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (name: string, data: any, callback: (response: string) => void) => void;
}

/** Hook configuration */
export interface UseCustomerIdentificationConfig {
  /** The bridge instance for MQTT communication */
  bridge: MqttBridge | null;
  /** Whether the bridge is ready */
  isBridgeReady: boolean;
  /** Whether MQTT is connected */
  isMqttConnected: boolean;
  /** Attendant information */
  attendantInfo: {
    id: string;
    station: string;
  };
  /** Default rate if not provided by service */
  defaultRate?: number;
  /** Callback on successful identification */
  onSuccess: (result: CustomerIdentificationResult) => void;
  /** Callback on identification error */
  onError?: (error: string) => void;
  /** Callback when identification starts */
  onStart?: () => void;
  /** Callback when identification completes (success or error) */
  onComplete?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/** Threshold for "infinite quota" services */
const INFINITE_QUOTA_THRESHOLD = 100000;

/** Timeout for identification request (ms) */
const IDENTIFICATION_TIMEOUT = 30000;

// ============================================
// HOOK
// ============================================

export function useCustomerIdentification(config: UseCustomerIdentificationConfig) {
  const {
    bridge,
    isBridgeReady,
    isMqttConnected,
    attendantInfo,
    defaultRate = 120,
    onSuccess,
    onError,
    onStart,
    onComplete,
  } = config;

  // Refs for correlation ID and timeout
  const correlationIdRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          errorMsg = "Customer not found";
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
    const customer: IdentifiedCustomerData = {
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
   * Identify a customer via MQTT
   */
  const identifyCustomer = useCallback((input: IdentifyCustomerInput) => {
    const { subscriptionCode, source } = input;

    // Validate inputs
    if (!subscriptionCode.trim()) {
      const errorMsg = source === 'manual' 
        ? 'Please enter a Subscription ID' 
        : 'No subscription code found in QR code';
      toast.error(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!bridge || !isBridgeReady) {
      const errorMsg = 'Bridge not available. Please wait for initialization...';
      toast.error(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!isMqttConnected) {
      const errorMsg = 'MQTT not connected. Please wait a moment and try again.';
      toast.error(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Notify start
    onStart?.();

    // Generate correlation ID
    const correlationId = `att-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    correlationIdRef.current = correlationId;
    (window as any).__customerIdentificationCorrelationId = correlationId;

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

    console.info(`=== Customer Identification MQTT (${source}) ===`);
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Correlation ID:", correlationId);
    console.info("Payload:", JSON.stringify(payload, null, 2));

    // Set timeout
    clearIdentificationTimeout();
    timeoutRef.current = setTimeout(() => {
      console.error("Customer identification timed out after 30 seconds");
      const errorMsg = "Request timed out. Please try again.";
      toast.error(errorMsg);
      onError?.(errorMsg);
      onComplete?.();
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
            console.info("✅ Topic MATCHED! Processing identify_customer response");

            let responseData: any;
            try {
              responseData = typeof rawMessageContent === 'string' 
                ? JSON.parse(rawMessageContent) 
                : rawMessageContent;
            } catch {
              responseData = rawMessageContent;
            }

            // Check correlation ID
            const storedCorrelationId = (window as any).__customerIdentificationCorrelationId;
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
                  const successMsg = result.isIdempotent 
                    ? 'Customer identified (cached)' 
                    : 'Customer identified';
                  toast.success(successMsg);
                  onSuccess(result);
                }
              } catch (err: any) {
                console.error("Customer identification failed:", err);
                toast.error(err.message || "Customer identification failed");
                onError?.(err.message || "Customer identification failed");
              }

              onComplete?.();
            }
          }
          responseCallback({});
        } catch (err) {
          console.error("Error processing MQTT response:", err);
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
            console.info("✅ Successfully subscribed to:", responseTopic);
            
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
                      console.error("Failed to publish identify_customer:", pubResp?.respDesc || pubResp?.error);
                      clearIdentificationTimeout();
                      const errorMsg = "Failed to identify customer";
                      toast.error(errorMsg);
                      onError?.(errorMsg);
                      onComplete?.();
                    } else {
                      console.info("identify_customer published successfully, waiting for response...");
                    }
                  } catch (err) {
                    console.error("Error parsing publish response:", err);
                    clearIdentificationTimeout();
                    const errorMsg = "Error identifying customer";
                    toast.error(errorMsg);
                    onError?.(errorMsg);
                    onComplete?.();
                  }
                }
              );
            }, 300);
          } else {
            console.error("Failed to subscribe to response topic:", subResp?.respDesc || subResp?.error);
            clearIdentificationTimeout();
            const errorMsg = "Failed to connect. Please try again.";
            toast.error(errorMsg);
            onError?.(errorMsg);
            onComplete?.();
          }
        } catch (err) {
          console.error("Error parsing subscribe response:", err);
          clearIdentificationTimeout();
          const errorMsg = "Error connecting. Please try again.";
          toast.error(errorMsg);
          onError?.(errorMsg);
          onComplete?.();
        }
      }
    );
  }, [
    bridge, 
    isBridgeReady, 
    isMqttConnected, 
    attendantInfo, 
    clearIdentificationTimeout, 
    processResponseData,
    onSuccess, 
    onError, 
    onStart, 
    onComplete,
  ]);

  /**
   * Cancel any pending identification request
   */
  const cancelIdentification = useCallback(() => {
    clearIdentificationTimeout();
    (window as any).__customerIdentificationCorrelationId = null;
  }, [clearIdentificationTimeout]);

  return {
    identifyCustomer,
    cancelIdentification,
  };
}

export default useCustomerIdentification;
