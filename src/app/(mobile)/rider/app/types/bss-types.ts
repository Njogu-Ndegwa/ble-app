/**
 * BSS (Battery Swap Service) Platform Types
 * 
 * These types define the data structures returned from MQTT events
 * when identifying a customer and fetching service plan data.
 */

// Service State within a plan
export interface ServiceState {
  service_id: string;
  used: number;
  quota: number;
  current_asset: string | null;
}

// Known service IDs
export type ServiceIdType = 
  | 'service-swap-station-network-togo-lome'
  | 'service-battery-fleet-togo-lome'
  | 'service-electricity-togo-1'
  | 'service-swap-count-togo-2'
  | string; // Allow other service IDs

// Service Plan Data from MQTT
export interface ServicePlanData {
  servicePlanId: string;
  customerId: string;
  /** Internal plan status - NOT displayed to user in UI */
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'EXPIRED';
  serviceState: 'BATTERY_ISSUED' | 'BATTERY_RETURNED' | 'PENDING' | string;
  /** PRIMARY status indicator - This is what we show to the user */
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | string;
  templateId: string;
  templateVersion: string;
  currency: string;
  serviceStates: ServiceState[];
  quotaUsed: number;
  quotaLimit: number;
}

// Access Control for services
export interface ServiceAccessControl {
  battery_types?: string[];
  quality_tier?: string;
  allocation_priority?: string;
  metering_enabled?: boolean;
  real_time_tracking?: boolean;
  transaction_tracking?: boolean;
  access_type?: string;
  network_id?: string;
  access_hours?: string;
  coverage_area?: string;
}

// Individual service definition
export interface ServiceDefinition {
  serviceId: string;
  name: string;
  description: string;
  assetType: 'FLEET' | 'INDIVIDUAL' | string;
  assetReference: string;
  usageMetric: 'ACCESS' | 'COUNT' | string;
  usageUnit: string;
  usageUnitPrice: number;
  accessControl?: ServiceAccessControl;
}

// Service Bundle
export interface ServiceBundle {
  bundleId: string;
  name: string;
  description: string;
  version: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  services: ServiceDefinition[];
}

// Common Terms
export interface CommonTerms {
  termsId: string;
  serviceName: string;
  serviceDescription: string;
  serviceDurationDays: number;
  billingCycle: 'WEEKLY' | 'MONTHLY' | 'DAILY' | string;
  billingCurrency: string;
  monthlyFee: number;
  depositAmount: number;
  monthlyQuota: number;
  cancellationNoticeDays: number;
  earlyTerminationFee: number;
  refundPolicy: 'PRORATED' | 'NONE' | 'FULL' | string;
  liabilityLimit: number;
  insuranceRequired: boolean;
  damageDeposit: number;
  governingLaw: string;
  disputeResolution: 'ARBITRATION' | 'COURT' | string;
}

// Full Customer Identification Metadata
export interface CustomerIdentificationMetadata {
  customer_id: string;
  identification_method: 'QR_CODE' | 'PHONE' | 'NFC' | string;
  service_plan_data: ServicePlanData;
  service_bundle: ServiceBundle;
  common_terms: CommonTerms;
  correlation_id: string;
}

// MQTT Response for identify_customer
export interface IdentifyCustomerResponse {
  timestamp: string;
  plan_id: string;
  correlation_id: string;
  actor: {
    type: 'agent' | 'attendant' | 'system';
    id: string;
  };
  data: {
    plan_id: string;
    success: boolean;
    signals: string[];
    metadata: CustomerIdentificationMetadata;
    timestamp: string;
  };
}

// MQTT Request for identify_customer
export interface IdentifyCustomerRequest {
  timestamp: string;
  plan_id: string;
  correlation_id: string;
  actor: {
    type: 'attendant' | 'rider' | string;
    id: string;
  };
  data: {
    action: 'IDENTIFY_CUSTOMER';
    qr_code_data?: string;
    phone_number?: string;
    attendant_station?: string;
  };
}

// Helper functions to extract common data from the response

/**
 * Extract the current battery ID from service states
 */
export function getCurrentBatteryId(servicePlanData: ServicePlanData): string | null {
  const batteryService = servicePlanData.serviceStates.find(
    s => s.service_id.includes('battery-fleet')
  );
  return batteryService?.current_asset || null;
}

/**
 * Extract swap count from service states
 */
export function getSwapCount(servicePlanData: ServicePlanData): number {
  const swapService = servicePlanData.serviceStates.find(
    s => s.service_id.includes('swap-count')
  );
  return swapService?.used || 0;
}

/**
 * Extract electricity usage from service states
 */
export function getElectricityUsage(servicePlanData: ServicePlanData): { used: number; quota: number } {
  const electricityService = servicePlanData.serviceStates.find(
    s => s.service_id.includes('electricity')
  );
  return {
    used: electricityService?.used || 0,
    quota: electricityService?.quota || 0,
  };
}

/**
 * Check if plan is active
 */
export function isPlanActive(servicePlanData: ServicePlanData): boolean {
  return servicePlanData.status === 'ACTIVE';
}

/**
 * Check if payment is due
 */
export function isPaymentDue(servicePlanData: ServicePlanData): boolean {
  return servicePlanData.paymentState === 'RENEWAL_DUE' || 
         servicePlanData.paymentState === 'OVERDUE';
}

/**
 * Get plan validity end date based on duration
 */
export function getPlanEndDate(commonTerms: CommonTerms, startDate?: Date): Date {
  const start = startDate || new Date();
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + commonTerms.serviceDurationDays);
  return endDate;
}

// UI-friendly data structure extracted from MQTT response
export interface RiderDashboardData {
  // User Info
  customerId: string;
  
  // Plan Info
  planId: string;
  planName: string;
  /** Internal status - not displayed to user */
  internalPlanStatus: string;
  serviceState: string;
  /** PRIMARY status shown to user (PAID, RENEWAL_DUE, OVERDUE, PENDING) */
  paymentState: string;
  currency: string;
  planDurationDays: number;
  billingCycle: string;
  
  // Battery Info
  currentBatteryId: string | null;
  
  // Usage Stats
  swapCount: number;
  electricityUsed: number;
  electricityQuota: number;
  
  // Computed
  isPlanActive: boolean;
  isPaymentDue: boolean;
}

/**
 * Transform MQTT response into UI-friendly dashboard data
 */
export function transformToRiderDashboard(response: IdentifyCustomerResponse): RiderDashboardData {
  const { metadata } = response.data;
  const { service_plan_data, service_bundle, common_terms } = metadata;
  
  return {
    customerId: metadata.customer_id,
    planId: service_plan_data.servicePlanId,
    planName: service_bundle.name,
    internalPlanStatus: service_plan_data.status, // Not shown in UI
    serviceState: service_plan_data.serviceState,
    paymentState: service_plan_data.paymentState, // Primary status for UI
    currency: service_plan_data.currency,
    planDurationDays: common_terms.serviceDurationDays,
    billingCycle: common_terms.billingCycle,
    currentBatteryId: getCurrentBatteryId(service_plan_data),
    swapCount: getSwapCount(service_plan_data),
    electricityUsed: getElectricityUsage(service_plan_data).used,
    electricityQuota: getElectricityUsage(service_plan_data).quota,
    isPlanActive: isPlanActive(service_plan_data),
    isPaymentDue: isPaymentDue(service_plan_data),
  };
}
