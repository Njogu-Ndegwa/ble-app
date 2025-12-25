/**
 * useSalesCustomerIdentification Hook
 * 
 * A thin wrapper around useCustomerIdentification that adds:
 * - Silent automatic retry with exponential backoff
 * - Manual retry trigger with visible feedback (like Attendant flow)
 * - Retry state tracking for UI feedback
 * - Non-blocking background operation for Sales workflow
 * 
 * This reuses the core identification logic from useCustomerIdentification
 * and only adds retry behavior specific to the Sales workflow.
 * 
 * NOTE: This hook now uses GraphQL instead of MQTT. The bridge and MQTT
 * connection parameters are kept for backwards compatibility but are ignored.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { PAYMENT } from '@/lib/constants';
import { 
  useCustomerIdentification, 
  type CustomerIdentificationResult, 
  type IdentifyCustomerInputParams,
  type ServiceState,
} from './useCustomerIdentification';

// Re-export types for convenience
export type { ServiceState, CustomerIdentificationResult, IdentifyCustomerInputParams as IdentifyCustomerInput };

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

/** Hook configuration */
export interface UseSalesCustomerIdentificationConfig {
  /** Attendant/Salesperson information */
  attendantInfo: {
    id: string;
    station: string;
  };
  /** Maximum number of automatic retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 2000) */
  baseRetryDelay?: number;
  /** Maximum delay in ms for exponential backoff (default: 15000) */
  maxRetryDelay?: number;
  /** 
   * @deprecated No longer needed - GraphQL doesn't require bridge
   * Kept for backwards compatibility with existing code
   */
  bridge?: unknown;
  /** 
   * @deprecated No longer needed - GraphQL doesn't require bridge
   * Kept for backwards compatibility with existing code
   */
  isBridgeReady?: boolean;
  /** 
   * @deprecated No longer needed - GraphQL doesn't require MQTT
   * Kept for backwards compatibility with existing code
   */
  isMqttConnected?: boolean;
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
    attendantInfo,
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
  const inputRef = useRef<IdentifyCustomerInputParams | null>(null);
  const isManualRetryRef = useRef(false);
  const isActiveRef = useRef(false);
  const currentRetryRef = useRef(0);
  
  // Ref for the base identify function to avoid circular dependency in handleError
  const baseIdentifyRef = useRef<((input: IdentifyCustomerInputParams) => void) | null>(null);

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
   * 
   * Note: Toast notifications are intentionally suppressed for automatic background operations.
   * Only manual retries show success feedback, since the user explicitly requested it.
   */
  const handleSuccess = useCallback((identificationResult: CustomerIdentificationResult) => {
    if (!isActiveRef.current) return;
    
    setResult(identificationResult);
    setStatus('success');
    setLastError(null);
    currentRetryRef.current = 0;
    
    // Show toast ONLY for explicit manual retry - background operations are silent
    if (isManualRetryRef.current) {
      toast.success('Customer identified successfully');
    }
  }, []);

  /**
   * Handle identification error - may trigger retry
   * 
   * For Sales workflow, errors during automatic background identification are completely silent.
   * The user will see the "Fetch Pricing" button in the UI if identification failed.
   * Only manual retries (user clicking "Fetch Pricing") show error feedback.
   */
  const handleError = useCallback((error: string) => {
    if (!isActiveRef.current) return;

    console.warn(`[SALES ID] Attempt ${currentRetryRef.current + 1} failed:`, error, 
      isManualRetryRef.current ? '(manual retry)' : '(background)');
    setLastError(error);

    // For manual retry (explicit user action), show error and don't auto-retry
    if (isManualRetryRef.current) {
      toast.error(error);
      setStatus('failed');
      return;
    }

    // Automatic background retry - completely silent (no toasts)
    if (currentRetryRef.current < maxRetries) {
      const delay = calculateRetryDelay(currentRetryRef.current);
      
      setStatus('retrying');
      setRetryCount(currentRetryRef.current + 1);
      currentRetryRef.current += 1;

      // Schedule retry - completely silent (no toast notification)
      retryTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current && inputRef.current && baseIdentifyRef.current) {
          // Trigger identification again via the base hook (using ref to avoid circular dep)
          baseIdentifyRef.current(inputRef.current);
        }
      }, delay);
    } else {
      // All retries exhausted - fail silently
      // User will see the "Fetch Pricing" UI button when they try to complete service
      console.warn('[SALES ID] All retries exhausted - failing silently');
      setStatus('failed');
    }
  }, [maxRetries, calculateRetryDelay]);

  /**
   * Handle identification complete (called after success or error)
   */
  const handleComplete = useCallback(() => {
    // Nothing special needed here - success/error handlers manage state
  }, []);

  // Use the base customer identification hook (now uses GraphQL internally)
  // Use silent mode to suppress all toast notifications - we handle UI feedback ourselves
  const { identifyCustomer: baseIdentifyCustomer, cancelIdentification: baseCancelIdentification } = useCustomerIdentification({
    attendantInfo,
    onSuccess: handleSuccess,
    onError: handleError,
    onComplete: handleComplete,
    silent: true, // Suppress toasts - Sales flow handles its own UI feedback
  });

  // Keep baseIdentifyRef in sync for use in retry callback
  baseIdentifyRef.current = baseIdentifyCustomer;

  /**
   * Start identification with automatic retry on failure
   * This runs in the background (non-blocking) for Sales workflow
   */
  const identifyCustomer = useCallback((input: IdentifyCustomerInputParams) => {
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

    // Trigger the base hook (non-blocking - runs in background)
    // No toast for initial request (silent background operation for Sales)
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
