/**
 * useSalesCustomerIdentification Hook
 * 
 * A thin wrapper around useCustomerIdentification that adds:
 * - Silent automatic retry with exponential backoff
 * - Manual retry trigger with visible feedback (like Attendant flow)
 * - Retry state tracking for UI feedback
 * 
 * This reuses the core identification logic from useCustomerIdentification
 * and only adds retry behavior specific to the Sales workflow.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { PAYMENT } from '@/lib/constants';
import { 
  useCustomerIdentification, 
  type CustomerIdentificationResult, 
  type IdentifyCustomerInput,
  type ServiceState,
} from './useCustomerIdentification';

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

  // Retry state
  const [status, setStatus] = useState<IdentificationStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<CustomerIdentificationResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs for managing async operations
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<IdentifyCustomerInput | null>(null);
  const isManualRetryRef = useRef(false);
  const isActiveRef = useRef(false);
  const currentRetryRef = useRef(0);

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
   * Handle successful identification
   */
  const handleSuccess = useCallback((identificationResult: CustomerIdentificationResult) => {
    if (!isActiveRef.current) return;
    
    console.info('[SALES ID] Customer identified successfully');
    setResult(identificationResult);
    setStatus('success');
    setLastError(null);
    currentRetryRef.current = 0;
    
    // Show toast only for manual retry
    if (isManualRetryRef.current) {
      toast.success('Customer identified successfully');
    }
  }, []);

  /**
   * Handle identification error - may trigger retry
   */
  const handleError = useCallback((error: string) => {
    if (!isActiveRef.current) return;

    console.warn(`[SALES ID] Attempt ${currentRetryRef.current + 1} failed:`, error);
    setLastError(error);

    // For manual retry, show error and don't auto-retry
    if (isManualRetryRef.current) {
      toast.error(error);
      setStatus('failed');
      return;
    }

    // Check if we should retry (silent automatic retry)
    if (currentRetryRef.current < maxRetries) {
      const delay = calculateRetryDelay(currentRetryRef.current);
      console.info(`[SALES ID] Scheduling retry ${currentRetryRef.current + 1}/${maxRetries} in ${Math.round(delay / 1000)}s...`);
      
      setStatus('retrying');
      setRetryCount(currentRetryRef.current + 1);
      currentRetryRef.current += 1;

      // Schedule retry - no toast notification (silent retry)
      retryTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current && inputRef.current) {
          // Trigger identification again via the base hook
          baseIdentifyCustomer(inputRef.current);
        }
      }, delay);
    } else {
      // All retries exhausted
      console.error('[SALES ID] All retries exhausted');
      setStatus('failed');
      // No toast - user will see the manual retry option in UI
    }
  }, [maxRetries, calculateRetryDelay]);

  /**
   * Handle identification complete (called after success or error)
   */
  const handleComplete = useCallback(() => {
    // Nothing special needed here - success/error handlers manage state
  }, []);

  // Use the base customer identification hook
  const { identifyCustomer: baseIdentifyCustomer, cancelIdentification: baseCancelIdentification } = useCustomerIdentification({
    bridge: bridge as any,
    isBridgeReady,
    isMqttConnected,
    attendantInfo,
    defaultRate,
    onSuccess: handleSuccess,
    onError: handleError,
    onComplete: handleComplete,
  });

  /**
   * Start identification with automatic retry on failure
   */
  const identifyCustomer = useCallback((input: IdentifyCustomerInput) => {
    // Store input for potential retries
    inputRef.current = input;
    isManualRetryRef.current = false;
    isActiveRef.current = true;
    currentRetryRef.current = 0;

    // Clear any pending retries
    clearRetryTimeout();

    // Reset state
    setStatus('pending');
    setRetryCount(0);
    setResult(null);
    setLastError(null);

    // Trigger the base hook
    baseIdentifyCustomer(input);
  }, [baseIdentifyCustomer, clearRetryTimeout]);

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
    
    isManualRetryRef.current = true;
    isActiveRef.current = true;
    currentRetryRef.current = 0;

    // Reset state
    setStatus('pending');
    setRetryCount(0);
    setLastError(null);

    // Show loading toast for manual retry
    toast.loading('Identifying customer...', { id: 'manual-identify' });
    
    // Trigger the base hook
    baseIdentifyCustomer(inputRef.current);
  }, [baseIdentifyCustomer, clearRetryTimeout]);

  // Override success handler to dismiss loading toast for manual retry
  useEffect(() => {
    if (status === 'success' && isManualRetryRef.current) {
      toast.dismiss('manual-identify');
    }
  }, [status]);

  /**
   * Cancel any pending identification
   */
  const cancelIdentification = useCallback(() => {
    isActiveRef.current = false;
    clearRetryTimeout();
    baseCancelIdentification();
  }, [baseCancelIdentification, clearRetryTimeout]);

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
    currentRetryRef.current = 0;
  }, [cancelIdentification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      clearRetryTimeout();
    };
  }, [clearRetryTimeout]);

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
