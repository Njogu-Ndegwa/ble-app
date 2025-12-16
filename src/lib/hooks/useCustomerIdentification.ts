/**
 * useCustomerIdentification Hook
 * 
 * Handles customer identification via GraphQL for the attendant workflow.
 * Extracts the duplicated logic from processCustomerQRData and handleManualLookup.
 * 
 * This hook:
 * - Calls identifyCustomer GraphQL mutation
 * - Handles response parsing and validation
 * - Extracts customer data, service states, and pricing info
 * - Determines customer type (first-time vs returning)
 * 
 * NOTE: This hook was migrated from MQTT to GraphQL in December 2024.
 * The interface remains the same to maintain backwards compatibility.
 */

import { useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { absApolloClient } from '@/lib/apollo-client';
import { PAYMENT } from '@/lib/constants';
import { round } from '@/lib/utils';
import {
  IDENTIFY_CUSTOMER,
  type IdentifyCustomerInput,
  type IdentifyCustomerResponse,
  parseIdentifyCustomerMetadata,
  isIdentificationSuccessful,
  hasErrorSignals,
  type GraphQLServiceState,
  type GraphQLServiceDefinition,
} from '@/lib/graphql/mutations';

// ============================================
// TYPES
// ============================================

/** Service state from GraphQL response */
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
export interface IdentifyCustomerInputParams {
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

/** Hook configuration */
export interface UseCustomerIdentificationConfig {
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
  /**
   * If true, suppresses toast notifications for errors and successes.
   * Useful for background operations where the caller handles UI feedback.
   * Default: false
   */
  silent?: boolean;
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

/** Threshold for "infinite quota" services */
const INFINITE_QUOTA_THRESHOLD = 100000;

// ============================================
// HOOK
// ============================================

export function useCustomerIdentification(config: UseCustomerIdentificationConfig) {
  const {
    attendantInfo,
    defaultRate = 120,
    onSuccess,
    onError,
    onStart,
    onComplete,
    silent = false,
  } = config;

  // Refs for correlation ID and cancellation
  const correlationIdRef = useRef<string>('');
  const isCancelledRef = useRef<boolean>(false);

  /**
   * Parse and process the GraphQL response data
   */
  const processResponseData = useCallback((
    response: IdentifyCustomerResponse,
    input: IdentifyCustomerInputParams
  ): CustomerIdentificationResult | null => {
    // Check for success
    if (!isIdentificationSuccessful(response)) {
      // Check for specific error signals
      const signals = response.signals || [];
      let errorMsg = 'Customer not found';
      
      if (hasErrorSignals(signals)) {
        if (signals.includes('SERVICE_PLAN_NOT_FOUND') || signals.includes('CUSTOMER_NOT_FOUND')) {
          errorMsg = 'Customer not found. Please check the subscription ID.';
        } else if (signals.includes('INVALID_QR_CODE')) {
          errorMsg = 'Invalid QR code. Please scan a valid customer QR code.';
        } else if (signals.includes('INVALID_SUBSCRIPTION_ID')) {
          errorMsg = 'Invalid subscription ID format.';
        }
      }
      throw new Error(errorMsg);
    }

    // Parse metadata
    const metadata = parseIdentifyCustomerMetadata(response.metadata);
    if (!metadata) {
      throw new Error('Invalid customer data received');
    }

    // Handle both fresh and idempotent (cached) responses
    const isIdempotent = response.signals.includes('IDEMPOTENT_OPERATION_DETECTED');
    const servicePlanData = metadata.service_plan_data;
    const serviceBundle = metadata.service_bundle;
    const commonTerms = metadata.common_terms;
    const identifiedCustomerId = metadata.customer_id;

    if (!servicePlanData) {
      throw new Error('Invalid customer data received');
    }

    // Extract and enrich service states
    const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
      (service: GraphQLServiceState) => typeof service?.service_id === 'string'
    );
    
    const enrichedServiceStates: ServiceState[] = extractedServiceStates.map((serviceState: GraphQLServiceState) => {
      const matchingService = serviceBundle?.services?.find(
        (svc: GraphQLServiceDefinition) => svc.serviceId === serviceState.service_id
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
    
    // Find energy service - check for both "service-energy" and "service-electricity" patterns
    // Different deployments may use different naming conventions
    const energyService = enrichedServiceStates.find(
      (s) => s.service_id?.includes('service-energy') || s.service_id?.includes('service-electricity')
    );
    
    const swapCountService = enrichedServiceStates.find(
      (s) => s.service_id?.includes('service-swap-count')
    );

    // Determine customer type
    const customerType: 'first-time' | 'returning' = batteryFleet?.current_asset ? 'returning' : 'first-time';

    // Extract billing currency from common_terms (source of truth)
    const billingCurrency = commonTerms?.billingCurrency || servicePlanData?.currency || PAYMENT.defaultCurrency;
    
    // Get rate from energy service - NO default fallback for Sales workflow
    // If energy service is not found, rate will be 0 and Sales flow will require manual retry
    const rate = energyService?.usageUnitPrice || 0;
    
    // Log warning if energy service not found - helps with debugging
    if (!energyService) {
      console.warn('[Customer Identification] Energy service not found in service states. Available services:', 
        enrichedServiceStates.map(s => s.service_id).join(', '));
    }

    // Check for infinite quota services
    const hasInfiniteEnergyQuota = (energyService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
    const hasInfiniteSwapQuota = (swapCountService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;

    // Calculate remaining quota values
    const energyRemaining = energyService ? round(energyService.quota - energyService.used, 2) : 0;
    const energyUnitPrice = energyService?.usageUnitPrice || 0;
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
      energyTotal: energyService?.quota || 0,
      energyValue,
      energyUnitPrice,
      swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
      swapsTotal: swapCountService?.quota || 21,
      hasInfiniteEnergyQuota,
      hasInfiniteSwapQuota,
      paymentState: (servicePlanData.paymentState || 'INITIAL') as IdentifiedCustomerData['paymentState'],
      serviceState: (servicePlanData.serviceState || 'INITIAL') as IdentifiedCustomerData['serviceState'],
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
   * Identify a customer via GraphQL
   */
  const identifyCustomer = useCallback(async (input: IdentifyCustomerInputParams) => {
    const { subscriptionCode, source } = input;

    // Validate inputs
    if (!subscriptionCode.trim()) {
      const errorMsg = source === 'manual' 
        ? 'Please enter a Subscription ID' 
        : 'No subscription code found in QR code';
      if (!silent) {
        toast.error(errorMsg);
      }
      onError?.(errorMsg);
      return;
    }

    // Reset cancellation flag
    isCancelledRef.current = false;

    // Notify start
    onStart?.();

    // Generate correlation ID
    const correlationId = `att-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    correlationIdRef.current = correlationId;

    // Build GraphQL input
    const graphqlInput: IdentifyCustomerInput = {
      plan_id: subscriptionCode,
      correlation_id: correlationId,
      qr_code_data: source === 'manual' 
        ? `MANUAL_${subscriptionCode}` 
        : `QR_CUSTOMER_${subscriptionCode}`,
      attendant_station: attendantInfo.station,
    };

    console.info(`=== Customer Identification GraphQL (${source}) ===`);
    console.info('Correlation ID:', correlationId);
    console.info('Input:', JSON.stringify(graphqlInput, null, 2));

    try {
      const result = await absApolloClient.mutate<{ identifyCustomer: IdentifyCustomerResponse }>({
        mutation: IDENTIFY_CUSTOMER,
        variables: { input: graphqlInput },
      });

      // Check if cancelled while waiting for response
      if (isCancelledRef.current) {
        console.info('Customer identification was cancelled');
        return;
      }

      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors[0].message || 'Failed to identify customer';
        console.error('GraphQL errors:', result.errors);
        if (!silent) {
          toast.error(errorMsg);
        }
        onError?.(errorMsg);
        onComplete?.();
        return;
      }

      if (!result.data?.identifyCustomer) {
        const errorMsg = 'No response from server';
        if (!silent) {
          toast.error(errorMsg);
        }
        onError?.(errorMsg);
        onComplete?.();
        return;
      }

      const response = result.data.identifyCustomer;
      console.info('GraphQL Response:', response);
      console.info('Signals:', response.signals);

      try {
        const identificationResult = processResponseData(response, input);
        if (identificationResult) {
          if (!silent) {
            const successMsg = identificationResult.isIdempotent 
              ? 'Customer identified (cached)' 
              : 'Customer identified';
            toast.success(successMsg);
          }
          onSuccess(identificationResult);
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Customer identification failed:', error);
        if (!silent) {
          toast.error(error.message || 'Customer identification failed');
        }
        onError?.(error.message || 'Customer identification failed');
      }

      onComplete?.();
    } catch (err: unknown) {
      const error = err as Error;
      // Check if cancelled
      if (isCancelledRef.current) {
        console.info('Customer identification was cancelled');
        return;
      }

      console.error('GraphQL request failed:', error);
      const errorMsg = error.message || 'Request failed. Please try again.';
      if (!silent) {
        toast.error(errorMsg);
      }
      onError?.(errorMsg);
      onComplete?.();
    }
  }, [
    attendantInfo, 
    processResponseData,
    onSuccess, 
    onError, 
    onStart, 
    onComplete,
    silent,
  ]);

  /**
   * Cancel any pending identification request
   */
  const cancelIdentification = useCallback(() => {
    isCancelledRef.current = true;
    correlationIdRef.current = '';
  }, []);

  return {
    identifyCustomer,
    cancelIdentification,
  };
}

export default useCustomerIdentification;
