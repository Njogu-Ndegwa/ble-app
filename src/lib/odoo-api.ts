/**
 * Odoo REST API Service
 * 
 * This module provides typed API calls to the Odoo backend for:
 * - Customer registration
 * - Subscription products/plans
 * - Payment initiation and verification
 * - Subscription management
 */

// API Configuration
const ODOO_BASE_URL = process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';
const ODOO_API_KEY = process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024';
const DEFAULT_COMPANY_ID = 14; // OV Kenya (Test)

// ============================================================================
// Types
// ============================================================================

// Common API Response wrapper
export interface OdooApiResponse<T> {
  success: boolean;
  data: T;
}

export interface OdooApiError {
  success: false;
  data: {
    error: string;
    error_code?: string;
  };
}

// Auth/Registration Types
export interface RegisterCustomerPayload {
  // Required fields
  name: string;
  email: string;
  phone: string;
  company_id: number;
  
  // Address fields
  street?: string;
  city?: string;
  zip?: string;
  
  // Kenya-specific fields
  national_id?: string;       // National ID number
  vehicle_reg?: string;       // Vehicle registration number
  vehicle_type?: string;      // Vehicle type (e.g., Motorcycle)
  vehicle_model?: string;     // Vehicle model (e.g., TVS HLX 125)
}

export interface RegisterCustomerResponse {
  session: {
    token: string;
    user: {
      id: number;
      partner_id: number;
      name: string;
      email: string;
      phone: string;
      company_id: number;
    };
  };
}

// Subscription Product Types
export interface SubscriptionProduct {
  id: number;
  name: string;
  description: string;
  list_price: number;
  currency: string;
  currency_symbol: string;
  currency_name: string;
  company_name: string;
}

export interface SubscriptionProductsResponse {
  products: SubscriptionProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Subscription Purchase Types
export interface PurchaseSubscriptionPayload {
  customer_id: number;
  product_id: number;
  company_id: number;
  quantity: number;
  cycle_interval: number;
  cycle_unit: 'day' | 'week' | 'month' | 'year';
  price_unit: number;
  notes?: string;
}

export interface PurchaseSubscriptionResponse {
  subscription: {
    id: number;
    subscription_code: string;
    status: string;
    product_name: string;
    price_at_signup: number;
    currency: string;
    currency_symbol: string;
  };
}

// Payment Initiation Types
export interface InitiatePaymentPayload {
  subscription_code: string;
  phone_number: string;
  amount: number;
}

export interface InitiatePaymentResponse {
  message: string;
  transaction_id: string;
  checkout_request_id: string;
  merchant_request_id: string;
  instructions: string;
}

// Manual Payment Confirmation Types
export interface ManualConfirmPaymentPayload {
  subscription_code: string;
  receipt: string;
  customer_id?: string;
}

export interface ManualConfirmPaymentResponse {
  message: string;
  receipt: string;
  note: string;
}

// Subscription Status Types
export interface SubscriptionStatusResponse {
  subscription: {
    subscription_code: string;
    status: string;
    product_name: string;
    price_at_signup: number;
    currency: string;
    start_date: string;
    next_cycle_date: string;
  };
}

// Companies Types
export interface Company {
  id: number;
  name: string;
}

export interface CompaniesResponse {
  companies: Company[];
}

// ============================================================================
// API Helper Functions
// ============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<OdooApiResponse<T>> {
  const url = `${ODOO_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Odoo API Error:', data);
      throw new Error(data?.data?.error || data?.error || `HTTP ${response.status}`);
    }

    return data as OdooApiResponse<T>;
  } catch (error: any) {
    console.error('Odoo API Request Failed:', error);
    throw error;
  }
}

// ============================================================================
// Auth/Registration API
// ============================================================================

/**
 * Register a new customer in Odoo
 */
export async function registerCustomer(
  payload: RegisterCustomerPayload
): Promise<OdooApiResponse<RegisterCustomerResponse>> {
  return apiRequest<RegisterCustomerResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get available companies
 */
export async function getCompanies(): Promise<OdooApiResponse<CompaniesResponse>> {
  return apiRequest<CompaniesResponse>('/api/auth/companies', {
    method: 'GET',
  });
}

// ============================================================================
// Subscription Products API
// ============================================================================

/**
 * Fetch available subscription products/plans
 */
export async function getSubscriptionProducts(
  page: number = 1,
  limit: number = 20
): Promise<OdooApiResponse<SubscriptionProductsResponse>> {
  return apiRequest<SubscriptionProductsResponse>(
    `/api/products/subscription?page=${page}&limit=${limit}`,
    { method: 'GET' }
  );
}

// ============================================================================
// Subscription Management API
// ============================================================================

/**
 * Purchase a subscription for a customer
 */
export async function purchaseSubscription(
  payload: PurchaseSubscriptionPayload
): Promise<OdooApiResponse<PurchaseSubscriptionResponse>> {
  return apiRequest<PurchaseSubscriptionResponse>('/api/subscription/purchase', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(
  subscriptionCode: string
): Promise<OdooApiResponse<SubscriptionStatusResponse>> {
  return apiRequest<SubscriptionStatusResponse>(
    `/api/subscription/status/${subscriptionCode}`,
    { method: 'GET' }
  );
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionCode: string,
  reason: string
): Promise<OdooApiResponse<{ message: string; subscription_code: string; status: string }>> {
  return apiRequest(`/api/subscription/${subscriptionCode}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ============================================================================
// Payment API
// ============================================================================

/**
 * Initiate M-Pesa payment via LiPay
 * This tells Odoo we're about to collect a payment of a specific amount
 */
export async function initiatePayment(
  payload: InitiatePaymentPayload
): Promise<OdooApiResponse<InitiatePaymentResponse>> {
  return apiRequest<InitiatePaymentResponse>('/api/payments/lipay/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Manually confirm a payment with M-Pesa receipt
 * Used after customer has paid and we have the receipt code
 */
export async function confirmPaymentManual(
  payload: ManualConfirmPaymentPayload
): Promise<OdooApiResponse<ManualConfirmPaymentResponse>> {
  return apiRequest<ManualConfirmPaymentResponse>('/api/lipay/manual-confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// Helper: Get cycle unit from plan period
// ============================================================================

export function getCycleUnitFromPeriod(period: string): { interval: number; unit: 'day' | 'week' | 'month' | 'year' } {
  const periodLower = period.toLowerCase();
  
  if (periodLower.includes('day') || periodLower.includes('daily')) {
    return { interval: 1, unit: 'day' };
  }
  if (periodLower.includes('week') || periodLower.includes('weekly')) {
    return { interval: 1, unit: 'week' };
  }
  if (periodLower.includes('year') || periodLower.includes('annual')) {
    return { interval: 1, unit: 'year' };
  }
  // Default to month
  return { interval: 1, unit: 'month' };
}

// ============================================================================
// Export default company ID for convenience
// ============================================================================

export { DEFAULT_COMPANY_ID };
