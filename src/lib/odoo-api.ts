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
// Note: Odoo API returns data directly on root, not wrapped in a "data" property
export interface OdooApiResponse<T> {
  success: boolean;
  data?: T;  // Some endpoints use this
  message?: string;
}

export interface OdooApiError {
  success: false;
  data: {
    error: string;
    error_code?: string;
  };
}

// Auth/Registration Types
// Only these fields are accepted by the Odoo /api/auth/register endpoint
export interface RegisterCustomerPayload {
  name: string;
  email: string;
  phone: string;
  company_id: number;
}

// Actual response from /api/auth/register endpoint
export interface RegisterCustomerResponse {
  success: boolean;
  message: string;
  session: {
    token: string;
    expires_at: string;
    user: {
      id: number;
      partner_id: number;
      name: string;
      email: string;
      phone?: string;
    };
  };
  email_sent: boolean;
}

// Subscription Product Types - matches actual Odoo API response
export interface SubscriptionProduct {
  id: number;
  name: string;
  default_code?: string;
  description: string;
  list_price: number;
  currency_id?: number;
  currency_name: string;
  currencySymbol: string;  // API uses camelCase
  category_id?: number;
  category_name?: string;
  recurring_invoice?: boolean;
  image_url?: string | null;
  company_id?: number;
  company_name: string;
}

// Raw API response structure (data at root level)
export interface SubscriptionProductsRawResponse {
  success: boolean;
  products: SubscriptionProduct[];
  pagination: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

// Normalized response for internal use
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

// Raw response from /api/subscription/purchase endpoint
// The API returns subscription at root level, not wrapped in "data"
export interface PurchaseSubscriptionRawResponse {
  success: boolean;
  message: string;
  subscription: {
    subscription_id: number;
    subscription_code: string;
    customer_id: number;
    customer_name: string;
    product_id: number;
    product_name: string;
    status: string;
    start_date: string;
    next_cycle_date: string;
    price_at_signup: number;
    currency: string;
    cycle_interval: number;
    cycle_unit: string;
  };
  order: {
    id: number;
    name: string;
    state: string;
    amount_total: number;
  };
  invoice: {
    id: number;
    invoice_number: string;
    amount_total: number;
    amount_due: number;
    payment_state: string;
    payment_reference: string;
  };
  next_step: {
    action: string;
    message: string;
    payment_url: string;
    payment_params: {
      subscription_code: string;
      amount: number;
      phone_number: string;
    };
  };
}

// Normalized response for internal use
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
  order?: {
    id: number;
    name: string;
    state: string;
    amount_total: number;
  };
  invoice?: {
    id: number;
    invoice_number: string;
    amount_total: number;
    amount_due: number;
    payment_state: string;
    payment_reference: string;
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
 * Returns the response directly (not wrapped in OdooApiResponse)
 */
export async function registerCustomer(
  payload: RegisterCustomerPayload
): Promise<RegisterCustomerResponse> {
  const response = await apiRequest<RegisterCustomerResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  // Return the raw response since Odoo returns session at root level
  return response as unknown as RegisterCustomerResponse;
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
 * Note: Odoo API returns products at root level, we normalize to { data: { products, pagination } }
 */
export async function getSubscriptionProducts(
  page: number = 1,
  limit: number = 20
): Promise<OdooApiResponse<SubscriptionProductsResponse>> {
  const url = `${ODOO_BASE_URL}/api/products/subscription?page=${page}&limit=${limit}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  try {
    const response = await fetch(url, { method: 'GET', headers });
    const rawData: SubscriptionProductsRawResponse = await response.json();

    if (!response.ok) {
      console.error('Odoo API Error:', rawData);
      throw new Error((rawData as any)?.error || `HTTP ${response.status}`);
    }

    // Transform root-level response to normalized format with data wrapper
    return {
      success: rawData.success,
      data: {
        products: rawData.products,
        pagination: {
          page: rawData.pagination.current_page,
          limit: rawData.pagination.per_page,
          total: rawData.pagination.total_records,
          pages: rawData.pagination.total_pages,
        },
      },
    };
  } catch (error: any) {
    console.error('Odoo API Request Failed:', error);
    throw error;
  }
}

// ============================================================================
// Subscription Management API
// ============================================================================

/**
 * Purchase a subscription for a customer
 * Note: Odoo API returns subscription at root level, we normalize to { success, data: { subscription } }
 */
export async function purchaseSubscription(
  payload: PurchaseSubscriptionPayload
): Promise<OdooApiResponse<PurchaseSubscriptionResponse>> {
  const url = `${ODOO_BASE_URL}/api/subscription/purchase`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const rawData: PurchaseSubscriptionRawResponse = await response.json();

    if (!response.ok) {
      console.error('Odoo API Error:', rawData);
      throw new Error((rawData as any)?.message || (rawData as any)?.error || `HTTP ${response.status}`);
    }

    // Get currency symbol based on currency code
    const getCurrencySymbol = (currency: string): string => {
      const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'KES': 'KSh',
        'XOF': 'CFA',
        'GBP': '£',
      };
      return symbols[currency] || currency;
    };

    // Transform root-level response to normalized format with data wrapper
    return {
      success: rawData.success,
      data: {
        subscription: {
          id: rawData.subscription.subscription_id,
          subscription_code: rawData.subscription.subscription_code,
          status: rawData.subscription.status,
          product_name: rawData.subscription.product_name,
          price_at_signup: rawData.subscription.price_at_signup,
          currency: rawData.subscription.currency,
          currency_symbol: getCurrencySymbol(rawData.subscription.currency),
        },
        order: rawData.order,
        invoice: rawData.invoice,
      },
    };
  } catch (error: any) {
    console.error('Odoo API Request Failed:', error);
    throw error;
  }
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
