/**
 * usePaymentAndService - React hook for payment & service completion
 * 
 * Provides a clean interface for reporting payment and service completion
 * via GraphQL to the ABS (Asset & Billing System) backend.
 * 
 * NOTE: This hook was migrated from MQTT to GraphQL in December 2024.
 * The interface remains the same to maintain backwards compatibility.
 * 
 * Features:
 * - Status tracking (idle, pending, success, error)
 * - Callback support for success/error handling
 * - No longer requires bridge/MQTT connection
 * 
 * Usage:
 * ```typescript
 * import { usePaymentAndService } from '@/lib/services/hooks';
 * 
 * function PaymentStep() {
 *   const { publishPaymentAndService, status, reset } = usePaymentAndService({
 *     onSuccess: (isIdempotent) => {
 *       toast.success(isIdempotent ? 'Already recorded!' : 'Swap completed!');
 *       advanceToStep(6);
 *     },
 *     onError: (message) => toast.error(message),
 *   });
 *   
 *   const handleConfirmPayment = (receipt: string) => {
 *     publishPaymentAndService({
 *       paymentReference: receipt,
 *       planId: dynamicPlanId,
 *       swapData: { ... },
 *       customerType: 'returning',
 *       serviceId: 'service-electricity-default',
 *       actor: { type: 'attendant', id: attendantInfo.id, station: attendantInfo.station },
 *     });
 *   };
 *   
 *   return (
 *     <button 
 *       onClick={() => handleConfirmPayment('MPESA_123')}
 *       disabled={status === 'pending'}
 *     >
 *       {status === 'pending' ? 'Processing...' : 'Confirm Payment'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useCallback, useState, useRef } from 'react';
import {
  publishPaymentAndService as publishPaymentAndServiceFn,
  type PublishPaymentAndServiceParams,
  type PaymentAndServiceStatus,
  type PaymentAndServiceResponse,
} from '../payment-service';

// ============================================================================
// Types
// ============================================================================

export interface UsePaymentAndServiceOptions {
  /**
   * Callback when operation succeeds
   * @param isIdempotent - Whether the operation was already processed (idempotent)
   */
  onSuccess?: (isIdempotent: boolean) => void;
  
  /**
   * Callback when operation fails
   * @param message - Error message
   * @param metadata - Additional error metadata from backend
   */
  onError?: (message: string, metadata?: PaymentAndServiceResponse['metadata']) => void;
  
  /**
   * Callback when status changes
   */
  onStatusChange?: (status: PaymentAndServiceStatus) => void;
  
  /**
   * @deprecated No longer used - GraphQL handles timeouts internally
   * Kept for backwards compatibility
   */
  timeoutMs?: number;
}

export interface UsePaymentAndServiceReturn {
  /**
   * Current status of the operation
   */
  status: PaymentAndServiceStatus;
  
  /**
   * Whether an operation is currently in progress
   */
  isLoading: boolean;
  
  /**
   * Publish payment_and_service message
   */
  publishPaymentAndService: (params: PublishPaymentAndServiceParams) => Promise<PaymentAndServiceResponse>;
  
  /**
   * Reset status to idle
   */
  reset: () => void;
  
  /**
   * Whether the service is ready for operations
   * Always true for GraphQL (no bridge dependency)
   */
  isReady: boolean;
  
  /**
   * Whether the service is connected
   * Always true for GraphQL (no MQTT dependency)
   */
  isConnected: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePaymentAndService(options: UsePaymentAndServiceOptions = {}): UsePaymentAndServiceReturn {
  const { onSuccess, onError, onStatusChange } = options;
  
  const [status, setStatus] = useState<PaymentAndServiceStatus>('idle');
  
  // Use refs for callbacks to avoid stale closures
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);
  
  // Keep refs in sync
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onStatusChangeRef.current = onStatusChange;
  
  const handleStatusChange = useCallback((newStatus: PaymentAndServiceStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const publishPaymentAndService = useCallback(async (
    params: PublishPaymentAndServiceParams
  ): Promise<PaymentAndServiceResponse> => {
    // Call the GraphQL-based payment and service function
    const response = await publishPaymentAndServiceFn(
      params,
      {
        onStatusChange: handleStatusChange,
        onError: (msg, metadata) => onErrorRef.current?.(msg, metadata),
        onSuccess: (isIdempotent) => onSuccessRef.current?.(isIdempotent),
      },
    );

    return response;
  }, [handleStatusChange]);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  return {
    status,
    isLoading: status === 'pending',
    publishPaymentAndService,
    reset,
    // Always ready for GraphQL (no bridge/MQTT dependency)
    isReady: true,
    isConnected: true,
  };
}

// Re-export types for convenience
export type {
  PublishPaymentAndServiceParams,
  PaymentAndServiceStatus,
  PaymentAndServiceResponse,
  ServiceBatteryData,
  ServiceSwapData,
  ServiceActor,
} from '../payment-service';
