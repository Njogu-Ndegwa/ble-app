/**
 * usePaymentAndService - React hook for payment & service completion
 * 
 * Provides a clean interface for publishing payment_and_service MQTT messages
 * and handling responses within React components.
 * 
 * Features:
 * - Automatic bridge/MQTT connection handling
 * - Status tracking (idle, pending, success, error)
 * - Callback support for success/error handling
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
import { useBridge } from '@/app/context/bridgeContext';
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
   * Timeout for the operation in milliseconds (default: 30000)
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
   * Whether the bridge is ready for operations
   */
  isReady: boolean;
  
  /**
   * Whether MQTT is connected
   */
  isConnected: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePaymentAndService(options: UsePaymentAndServiceOptions = {}): UsePaymentAndServiceReturn {
  const { onSuccess, onError, onStatusChange, timeoutMs = 30000 } = options;
  
  const { bridge, isBridgeReady, isMqttConnected } = useBridge();
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
    if (!bridge) {
      const error = 'Bridge not available. Please restart the app.';
      onErrorRef.current?.(error);
      return { success: false, error };
    }

    if (!isMqttConnected) {
      const error = 'MQTT not connected. Please check your connection.';
      onErrorRef.current?.(error);
      return { success: false, error };
    }

    const response = await publishPaymentAndServiceFn(
      bridge as Parameters<typeof publishPaymentAndServiceFn>[0],
      params,
      {
        onStatusChange: handleStatusChange,
        onError: (msg, metadata) => onErrorRef.current?.(msg, metadata),
        onSuccess: (isIdempotent) => onSuccessRef.current?.(isIdempotent),
      },
      timeoutMs
    );

    return response;
  }, [bridge, isMqttConnected, handleStatusChange, timeoutMs]);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  return {
    status,
    isLoading: status === 'pending',
    publishPaymentAndService,
    reset,
    isReady: isBridgeReady && bridge !== null,
    isConnected: isMqttConnected,
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
