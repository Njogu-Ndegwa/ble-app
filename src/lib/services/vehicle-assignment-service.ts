/**
 * Vehicle Assignment Service
 * 
 * Handles GraphQL communication for assigning vehicles to customer subscriptions
 * via the ABS (Asset & Billing System) backend.
 * 
 * This service is used in the Sales workflow after scanning a vehicle QR code
 * to associate the vehicle with the customer's plan.
 * 
 * Usage:
 * ```typescript
 * import { useVehicleAssignment } from '@/lib/services/hooks';
 * 
 * function VehicleScanStep() {
 *   const { assignVehicle, status, reset } = useVehicleAssignment({
 *     onSuccess: () => advanceToStep(7),
 *     onError: (msg) => toast.error(msg),
 *   });
 *   
 *   const handleVehicleScanned = (vehicleId: string) => {
 *     assignVehicle({
 *       planId: subscriptionCode,
 *       vehicleId,
 *     });
 *   };
 * }
 * ```
 */

import { absApolloClient } from '@/lib/apollo-client';
import {
  UPDATE_ASSET_ASSIGNMENT_CURRENT_ASSET,
  type UpdateAssetAssignmentResponse,
  isVehicleAssignmentSuccessful,
  hasErrorSignals,
  parseVehicleAssignmentMetadata,
} from '@/lib/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for assigning a vehicle
 */
export interface AssignVehicleParams {
  /** Plan/subscription ID */
  planId: string;
  /** Vehicle ID from QR code scan */
  vehicleId: string;
}

/**
 * Response from vehicle assignment operation
 */
export interface VehicleAssignmentResponse {
  success: boolean;
  correlationId?: string;
  serviceIds?: string[];
  updatedCount?: number;
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
 * Status of the vehicle assignment operation
 */
export type VehicleAssignmentStatus = 'idle' | 'pending' | 'success' | 'error';

// ============================================================================
// GraphQL Operations
// ============================================================================

/**
 * Assign vehicle to customer subscription via GraphQL
 * 
 * This function handles:
 * 1. Building the GraphQL variables
 * 2. Making the mutation request
 * 3. Parsing and validating the response
 * 
 * @param params - Parameters for the operation
 * @param callbacks - Callbacks for status updates
 * @returns Promise resolving to the response
 */
export async function assignVehicle(
  params: AssignVehicleParams,
  callbacks: {
    onStatusChange?: (status: VehicleAssignmentStatus) => void;
    onError?: (message: string, metadata?: VehicleAssignmentResponse['metadata']) => void;
    onSuccess?: (isIdempotent: boolean) => void;
  } = {},
): Promise<VehicleAssignmentResponse> {
  const { onStatusChange, onError, onSuccess } = callbacks;
  const { planId, vehicleId } = params;

  // Validate input
  if (!planId) {
    onStatusChange?.('error');
    onError?.('Missing subscription/plan ID');
    return { success: false, error: 'Missing subscription/plan ID' };
  }

  if (!vehicleId) {
    onStatusChange?.('error');
    onError?.('Missing vehicle ID');
    return { success: false, error: 'Missing vehicle ID' };
  }

  // Generate correlation ID
  const correlationId = `sales-vehicle-assign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  onStatusChange?.('pending');

  try {
    const result = await absApolloClient.mutate<{ 
      updateAssetAssignmentCurrentAsset: UpdateAssetAssignmentResponse 
    }>({
      mutation: UPDATE_ASSET_ASSIGNMENT_CURRENT_ASSET,
      variables: {
        planId,
        currentAsset: vehicleId,
        correlationId,
      },
    });

    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors[0].message || 'Failed to assign vehicle';
      console.error('GraphQL errors:', result.errors);
      onStatusChange?.('error');
      onError?.(errorMsg);
      return { success: false, error: errorMsg, correlationId };
    }

    if (!result.data?.updateAssetAssignmentCurrentAsset) {
      const errorMsg = 'No response from server';
      onStatusChange?.('error');
      onError?.(errorMsg);
      return { success: false, error: errorMsg, correlationId };
    }

    const response = result.data.updateAssetAssignmentCurrentAsset;

    // Parse metadata for additional info
    const metadata = response.metadata ? parseVehicleAssignmentMetadata(response.metadata) : null;

    // Check for error signals
    if (hasErrorSignals(response.signals)) {
      const errorMetadata = {
        reason: metadata?.reason as string | undefined,
        message: metadata?.message as string | undefined,
        action_required: metadata?.action_required as string | undefined,
      };
      const errorMsg = errorMetadata.reason || errorMetadata.message || 'Failed to assign vehicle';
      
      console.error('Vehicle assignment failed:', errorMsg);
      onStatusChange?.('error');
      onError?.(errorMsg, errorMetadata);
      
      return {
        success: false,
        correlationId,
        serviceIds: response.service_ids,
        updatedCount: response.updated_count,
        signals: response.signals,
        metadata: errorMetadata,
        error: errorMsg,
      };
    }

    // Check for success
    if (isVehicleAssignmentSuccessful(response)) {
      const isIdempotent = response.signals.includes('IDEMPOTENT_OPERATION_DETECTED');
      
      onStatusChange?.('success');
      onSuccess?.(isIdempotent);
      
      return {
        success: true,
        correlationId,
        serviceIds: response.service_ids,
        updatedCount: response.updated_count,
        signals: response.signals,
        isIdempotent,
      };
    }

    // Response received but status unclear - treat as success if updated_count > 0
    if (response.updated_count > 0) {
      onStatusChange?.('success');
      onSuccess?.(false);
      
      return {
        success: true,
        correlationId,
        serviceIds: response.service_ids,
        updatedCount: response.updated_count,
        signals: response.signals,
      };
    }

    // No updates and no clear success signal - treat as potential issue but not error
    console.warn('Vehicle assignment response unclear:', response);
    onStatusChange?.('success');
    onSuccess?.(false);
    
    return {
      success: true,
      correlationId,
      serviceIds: response.service_ids,
      updatedCount: response.updated_count,
      signals: response.signals,
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
