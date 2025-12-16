/**
 * useVehicleAssignment - React hook for vehicle assignment
 * 
 * Provides a clean interface for assigning vehicles to customer subscriptions
 * via GraphQL to the ABS (Asset & Billing System) backend.
 * 
 * This hook is used in the Sales workflow after scanning a vehicle QR code.
 * 
 * Features:
 * - Status tracking (idle, pending, success, error)
 * - Callback support for success/error handling
 * - No bridge/MQTT dependency (pure GraphQL)
 * 
 * Usage:
 * ```typescript
 * import { useVehicleAssignment } from '@/lib/services/hooks';
 * 
 * function VehicleScanStep() {
 *   const { assignVehicle, status, reset } = useVehicleAssignment({
 *     onSuccess: (isIdempotent) => {
 *       toast.success(isIdempotent ? 'Already assigned!' : 'Vehicle assigned!');
 *       advanceToStep(7);
 *     },
 *     onError: (message) => toast.error(message),
 *   });
 *   
 *   const handleVehicleScanned = (vehicleId: string) => {
 *     assignVehicle({
 *       planId: subscriptionCode,
 *       vehicleId,
 *     });
 *   };
 *   
 *   return (
 *     <div>
 *       {status === 'pending' && <Spinner />}
 *       <ScannerArea onScan={handleVehicleScanned} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useState, useRef } from 'react';
import {
  assignVehicle as assignVehicleFn,
  type AssignVehicleParams,
  type VehicleAssignmentStatus,
  type VehicleAssignmentResponse,
} from '../vehicle-assignment-service';

// ============================================================================
// Types
// ============================================================================

export interface UseVehicleAssignmentOptions {
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
  onError?: (message: string, metadata?: VehicleAssignmentResponse['metadata']) => void;
  
  /**
   * Callback when status changes
   */
  onStatusChange?: (status: VehicleAssignmentStatus) => void;
}

export interface UseVehicleAssignmentReturn {
  /**
   * Current status of the operation
   */
  status: VehicleAssignmentStatus;
  
  /**
   * Whether an operation is currently in progress
   */
  isLoading: boolean;
  
  /**
   * Assign vehicle to subscription
   */
  assignVehicle: (params: AssignVehicleParams) => Promise<VehicleAssignmentResponse>;
  
  /**
   * Reset status to idle
   */
  reset: () => void;
  
  /**
   * Whether the service is ready for operations
   * Always true for GraphQL (no bridge dependency)
   */
  isReady: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVehicleAssignment(options: UseVehicleAssignmentOptions = {}): UseVehicleAssignmentReturn {
  const { onSuccess, onError, onStatusChange } = options;
  
  const [status, setStatus] = useState<VehicleAssignmentStatus>('idle');
  
  // Use refs for callbacks to avoid stale closures
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);
  
  // Keep refs in sync
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onStatusChangeRef.current = onStatusChange;
  
  const handleStatusChange = useCallback((newStatus: VehicleAssignmentStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const assignVehicle = useCallback(async (
    params: AssignVehicleParams
  ): Promise<VehicleAssignmentResponse> => {
    // Call the GraphQL-based vehicle assignment function
    const response = await assignVehicleFn(
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
    assignVehicle,
    reset,
    // Always ready for GraphQL (no bridge dependency)
    isReady: true,
  };
}

// Re-export types for convenience
export type {
  AssignVehicleParams,
  VehicleAssignmentStatus,
  VehicleAssignmentResponse,
} from '../vehicle-assignment-service';
