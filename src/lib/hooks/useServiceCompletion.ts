/**
 * useServiceCompletion Hook
 * 
 * Handles MQTT-based service completion for battery assignment/swap workflows.
 * Encapsulates the MQTT request/response pattern with:
 * - Subscription to response topics
 * - Correlation ID tracking
 * - Signal-based success/error detection
 * - Timeout management
 * 
 * Used by both Sales (first battery assignment) and Attendant (battery swap) flows.
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { getEmployeeUser } from '@/lib/attendant-auth';

// ============================================
// Types
// ============================================

/**
 * Battery data required for service completion
 */
export interface ServiceBatteryData {
  id: string;
  /** Actual battery ID from ATT service (OPID/PPID) - preferred for backend */
  actualBatteryId?: string;
  /** Energy in Wh (will be converted to kWh) */
  energy: number;
  chargeLevel?: number;
}

/**
 * Configuration for the service completion hook
 */
export interface UseServiceCompletionConfig {
  /** Station identifier for the service location */
  stationId?: string;
  /** Actor type for the MQTT payload (default: 'attendant') */
  actorType?: 'attendant' | 'salesperson';
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Input data for completing a service
 */
export interface CompleteServiceInput {
  /** Subscription code / plan ID */
  subscriptionId: string;
  /** Battery being assigned/swapped */
  battery: ServiceBatteryData;
  /** Optional: Old battery being returned (for swap operations) */
  oldBattery?: ServiceBatteryData;
}

/**
 * Result of a successful service completion
 */
export interface ServiceCompletionResult {
  success: boolean;
  signals: string[];
  isIdempotent: boolean;
  metadata?: Record<string, any>;
}

/**
 * Return type for the hook
 */
export interface UseServiceCompletionReturn {
  /** Complete the service with the given data */
  completeService: (input: CompleteServiceInput) => Promise<ServiceCompletionResult | null>;
  /** Whether a service completion is in progress */
  isCompleting: boolean;
  /** Error message from the last failed attempt */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Whether the service was completed successfully */
  isComplete: boolean;
  /** Reset all state for a new operation */
  reset: () => void;
}

// ============================================
// Constants
// ============================================

const DEFAULT_STATION_ID = 'STATION_001';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/** Error signals that indicate failure even if success flag is true */
const ERROR_SIGNALS = [
  'SERVICE_COMPLETION_FAILED',
  'QUOTA_EXHAUSTED',
  'SERVICE_REJECTED',
  'TOPUP_REQUIRED',
  'BATTERY_MISMATCH',
  'ASSET_VALIDATION_FAILED',
  'SECURITY_ALERT',
  'VALIDATION_FAILED',
  'PAYMENT_FAILED',
  'RATE_LIMIT_EXCEEDED',
];

/** Success signals that confirm the operation completed */
const SUCCESS_SIGNALS = [
  'SERVICE_COMPLETED',
  'ASSET_RETURNED',
  'ASSET_ALLOCATED',
  'IDEMPOTENT_OPERATION_DETECTED',
];

// ============================================
// WebViewJavascriptBridge Type & Global Window Extension
// ============================================

interface WebViewJavascriptBridge {
  registerHandler: (
    handlerName: string,
    handler: (data: string, responseCallback: (response: any) => void) => void
  ) => void;
  callHandler: (
    handlerName: string,
    data: any,
    callback: (responseData: string) => void
  ) => void;
}

// Extend Window interface for bridge and correlation tracking
// Using module augmentation pattern to avoid conflicts
interface ServiceCompletionWindow {
  WebViewJavascriptBridge?: WebViewJavascriptBridge;
  __serviceCompletionCorrelationId?: string | null;
}

// Cast window to extended type when needed
const getWindow = (): ServiceCompletionWindow => {
  return window as unknown as ServiceCompletionWindow;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Convert energy from Wh to kWh, rounded to 2 decimal places
 */
function convertWhToKwh(energyWh: number): number {
  return Math.floor((energyWh / 1000) * 100) / 100;
}

/**
 * Generate a unique correlation ID for tracking requests
 */
function generateCorrelationId(prefix: string = 'svc'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get user-friendly error message for common error types
 */
function getUserFriendlyError(signals: string[], metadata: Record<string, any>): string {
  if (signals.includes('QUOTA_EXHAUSTED') || signals.includes('TOPUP_REQUIRED')) {
    return 'Customer quota exhausted. Payment required before service can proceed.';
  }
  if (signals.includes('SERVICE_REJECTED')) {
    return metadata?.service_result?.reason || 'Service was rejected. Please check customer quota.';
  }
  if (signals.includes('BATTERY_MISMATCH')) {
    return 'Battery does not match expected assignment.';
  }
  if (signals.includes('ASSET_VALIDATION_FAILED')) {
    return 'Battery validation failed. Please try a different battery.';
  }
  return (
    metadata?.reason ||
    metadata?.message ||
    metadata?.service_result?.reason ||
    'Service completion failed'
  );
}

// ============================================
// Hook Implementation
// ============================================

export function useServiceCompletion(
  config: UseServiceCompletionConfig = {}
): UseServiceCompletionReturn {
  const {
    stationId = DEFAULT_STATION_ID,
    actorType = 'attendant',
    timeout = DEFAULT_TIMEOUT,
    debug = false,
  } = config;

  // State
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Refs for tracking async operations
  const responseProcessedRef = useRef(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logger
  const log = useCallback(
    (...args: any[]) => {
      if (debug) {
        console.info('[SERVICE COMPLETION]', ...args);
      }
    },
    [debug]
  );

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setIsCompleting(false);
    setError(null);
    setIsComplete(false);
    responseProcessedRef.current = false;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    getWindow().__serviceCompletionCorrelationId = null;
  }, []);

  // Main service completion function
  const completeService = useCallback(
    async (input: CompleteServiceInput): Promise<ServiceCompletionResult | null> => {
      const { subscriptionId, battery, oldBattery } = input;

      // Validation
      if (!subscriptionId) {
        const msg = 'No subscription found. Please complete payment first.';
        toast.error(msg);
        setError(msg);
        return null;
      }

      if (!battery) {
        const msg = 'No battery scanned';
        toast.error(msg);
        setError(msg);
        return null;
      }

      // Check bridge availability
      const win = getWindow();
      if (!win.WebViewJavascriptBridge) {
        const msg = 'Connection not available. Please restart the app.';
        toast.error(msg);
        setError(msg);
        return null;
      }

      // Initialize state
      setIsCompleting(true);
      setError(null);
      setIsComplete(false);
      responseProcessedRef.current = false;

      // Get actor info
      const employeeUser = getEmployeeUser();
      const actorId = employeeUser?.id?.toString() || `${actorType}-001`;

      // Generate correlation ID
      const correlationId = generateCorrelationId(actorType === 'attendant' ? 'att-svc' : 'sales-svc');
      win.__serviceCompletionCorrelationId = correlationId;

      // Calculate energy in kWh
      const energyTransferred = convertWhToKwh(battery.energy);

      // Get battery ID (prefer actual ID from ATT service)
      const batteryId = battery.actualBatteryId || battery.id;

      log('Building service completion payload:');
      log('- Subscription ID:', subscriptionId);
      log('- Battery ID:', batteryId);
      log('- Energy (kWh):', energyTransferred);
      log('- Correlation ID:', correlationId);

      // Build payload
      const payload: Record<string, any> = {
        timestamp: new Date().toISOString(),
        plan_id: subscriptionId,
        correlation_id: correlationId,
        actor: {
          type: actorType,
          id: actorId,
        },
        data: {
          action: 'REPORT_PAYMENT_AND_SERVICE_COMPLETION',
          attendant_station: stationId,
          service_data: {
            new_battery_id: batteryId,
            energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
            service_duration: 240,
          },
        },
      };

      // Add old battery for swap operations
      if (oldBattery) {
        payload.data.service_data.old_battery_id = oldBattery.actualBatteryId || oldBattery.id;
      }

      // Topics
      const requestTopic = `emit/uxi/attendant/plan/${subscriptionId}/payment_and_service`;
      const responseTopic = `echo/abs/attendant/plan/${subscriptionId}/payment_and_service`;

      log('Request topic:', requestTopic);
      log('Response topic:', responseTopic);
      log('Payload:', JSON.stringify(payload, null, 2));

      // Return a promise that resolves when the operation completes
      return new Promise((resolve) => {
        // Handle completion (success or error)
        const handleComplete = (
          result: ServiceCompletionResult | null,
          errorMsg?: string
        ) => {
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
          }
          win.__serviceCompletionCorrelationId = null;
          setIsCompleting(false);

          if (errorMsg) {
            setError(errorMsg);
            toast.error(errorMsg);
            resolve(null);
          } else if (result) {
            setIsComplete(true);
            toast.success('Service completed! Battery assigned successfully.');
            resolve(result);
          } else {
            resolve(null);
          }
        };

        // Set timeout
        timeoutIdRef.current = setTimeout(() => {
          if (responseProcessedRef.current) return;
          responseProcessedRef.current = true;
          log('Service completion timed out after', timeout, 'ms');
          handleComplete(null, 'Request timed out. Please try again.');
        }, timeout);

        // Register MQTT response handler
        win.WebViewJavascriptBridge!.registerHandler(
          'mqttMsgArrivedCallBack',
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedData = JSON.parse(data);
              const topic = parsedData.topic;
              const rawMessage = parsedData.message;

              log('MQTT Message Arrived - Topic:', topic);

              // Check if this is our response
              if (topic === responseTopic) {
                log('✅ Topic matched! Processing response');

                let responseData: any;
                try {
                  responseData =
                    typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
                } catch {
                  responseData = rawMessage;
                }

                // Check correlation ID
                const storedCorrelationId = win.__serviceCompletionCorrelationId;
                const responseCorrelationId = responseData?.correlation_id;

                const correlationMatches =
                  storedCorrelationId &&
                  responseCorrelationId &&
                  (responseCorrelationId === storedCorrelationId ||
                    responseCorrelationId.startsWith(storedCorrelationId) ||
                    storedCorrelationId.startsWith(responseCorrelationId));

                if (correlationMatches && !responseProcessedRef.current) {
                  responseProcessedRef.current = true;

                  const success = responseData?.data?.success ?? false;
                  const signals: string[] = responseData?.data?.signals || [];
                  const metadata = responseData?.data?.metadata || {};

                  log('Response - success:', success, 'signals:', signals);

                  // Check for error signals
                  const hasErrorSignal = signals.some((s) => ERROR_SIGNALS.includes(s));

                  // Check for success signals
                  const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
                  const hasSuccessSignal = signals.some((s) => SUCCESS_SIGNALS.includes(s));

                  if (hasErrorSignal) {
                    log('Failed with error signals:', signals);
                    const errorMsg = getUserFriendlyError(signals, metadata);
                    const actionRequired = metadata?.action_required || metadata?.service_result?.action_required;
                    const fullError = actionRequired ? `${errorMsg}. ${actionRequired}` : errorMsg;
                    handleComplete(null, fullError);
                  } else if ((success && hasSuccessSignal) || (success && signals.length === 0)) {
                    log('Completed successfully!', isIdempotent ? '(idempotent)' : '');
                    handleComplete({
                      success: true,
                      signals,
                      isIdempotent,
                      metadata,
                    });
                  } else {
                    log('Failed - success:', success, 'signals:', signals);
                    const errorMsg =
                      metadata?.reason ||
                      metadata?.message ||
                      responseData?.data?.error ||
                      'Failed to complete service';
                    handleComplete(null, errorMsg);
                  }
                }
              }
              responseCallback({});
            } catch (err) {
              console.error('[SERVICE COMPLETION] Error processing MQTT response:', err);
            }
          }
        );

        // Subscribe to response topic
        win.WebViewJavascriptBridge!.callHandler(
          'mqttSubTopic',
          { topic: responseTopic, qos: 1 },
          (subscribeResponse: string) => {
            try {
              const subResp =
                typeof subscribeResponse === 'string'
                  ? JSON.parse(subscribeResponse)
                  : subscribeResponse;

              if (subResp?.respCode === '200') {
                log('✅ Subscribed to response topic');

                // Delay before publishing (wait for subscription to be active)
                setTimeout(() => {
                  try {
                    log('Publishing service completion request...');
                    win.WebViewJavascriptBridge?.callHandler(
                      'mqttPublishMsg',
                      JSON.stringify({
                        topic: requestTopic,
                        qos: 0,
                        content: payload,
                      }),
                      (publishResponse: any) => {
                        try {
                          const pubResp =
                            typeof publishResponse === 'string'
                              ? JSON.parse(publishResponse)
                              : publishResponse;

                          if (pubResp?.error || pubResp?.respCode !== '200') {
                            log('Failed to publish:', pubResp?.respDesc || pubResp?.error);
                            if (!responseProcessedRef.current) {
                              responseProcessedRef.current = true;
                              handleComplete(null, 'Failed to send request. Please try again.');
                            }
                          } else {
                            log('Request published, waiting for response...');
                          }
                        } catch (err) {
                          console.error('[SERVICE COMPLETION] Error parsing publish response:', err);
                          if (!responseProcessedRef.current) {
                            responseProcessedRef.current = true;
                            handleComplete(null, 'Error sending request. Please try again.');
                          }
                        }
                      }
                    );
                  } catch (err) {
                    console.error('[SERVICE COMPLETION] Exception calling publish:', err);
                    if (!responseProcessedRef.current) {
                      responseProcessedRef.current = true;
                      handleComplete(null, 'Error sending request. Please try again.');
                    }
                  }
                }, 300);
              } else {
                log('Failed to subscribe:', subResp?.respDesc || subResp?.error);
                if (!responseProcessedRef.current) {
                  responseProcessedRef.current = true;
                  handleComplete(null, 'Failed to connect. Please try again.');
                }
              }
            } catch (err) {
              console.error('[SERVICE COMPLETION] Error parsing subscribe response:', err);
              if (!responseProcessedRef.current) {
                responseProcessedRef.current = true;
                handleComplete(null, 'Error connecting. Please try again.');
              }
            }
          }
        );
      });
    },
    [stationId, actorType, timeout, log]
  );

  return {
    completeService,
    isCompleting,
    error,
    clearError,
    isComplete,
    reset,
  };
}

export default useServiceCompletion;
