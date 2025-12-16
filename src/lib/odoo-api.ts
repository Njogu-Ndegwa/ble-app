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
// Fields accepted by the Odoo /api/auth/register endpoint
// Note: company_id is derived from the salesperson's token, not sent in the payload
// At least one of email or phone must be provided
export interface RegisterCustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  street: string;
  city: string;
  zip: string;
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

// Product Types - matches actual Odoo API response
// Used for all product categories: subscription, battery_swap, main_service, packages
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
  is_package?: boolean;
  image_url?: string | null;  // Cloudinary URL for product images
  company_id?: number;
  company_name: string;
}

// Categorized products from API response
export interface ProductCategories {
  subscription: SubscriptionProduct[];
  battery_swap: SubscriptionProduct[];
  main_service: SubscriptionProduct[];
  packages: SubscriptionProduct[];
}

// Raw API response structure - products are now categorized
export interface SubscriptionProductsRawResponse {
  success: boolean;
  categories: ProductCategories;
  pagination: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

// Normalized response for internal use - includes all categories
export interface SubscriptionProductsResponse {
  products: SubscriptionProduct[];  // Subscription products (legacy, for backward compatibility)
  mainServiceProducts: SubscriptionProduct[];  // Physical products like bikes (main_service)
  batterySwapProducts: SubscriptionProduct[];  // Battery swap privileges
  packageProducts: SubscriptionProduct[];  // Product packages
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Subscription Purchase Types (legacy - single product)
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

// Multi-product purchase payload (Package + Subscription)
// This is the new format that sends all items in one order
export interface ProductOrderItem {
  product_id: number;
  quantity: number;
  price_unit: number;
}

export interface PurchaseMultiProductPayload {
  customer_id: number;
  company_id: number;
  products: ProductOrderItem[];  // All products: subscription, main product, privilege
  cycle_interval: number;
  cycle_unit: 'day' | 'week' | 'month' | 'year';
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
  order_id: number;
  receipt: string;
}

export interface ManualConfirmPaymentResponse {
  message: string;
  note?: string;
  subscription_code?: string;
  receipt: string;
  order_id?: number;
  order_name?: string;
  total_paid: number;
  expected_to_pay?: number;
  remaining_to_pay?: number;
  // Legacy fields for backward compatibility
  amount_paid?: number;
  amount_expected?: number;
  amount_remaining?: number;
  // Duplicate detection
  is_duplicate?: boolean;
  receipt_used?: boolean;
  receipt_status?: string;
}

// Payment Request Types (create ticket before collecting payment)
export interface CreatePaymentRequestPayload {
  subscription_code: string;
  amount_required: number;
  description: string;
  external_reference?: string;
}

export interface PaymentRequestCustomer {
  id: number;
  name: string;
}

export interface PaymentRequestOrder {
  id: number;
  name: string;
  state: string;
}

export interface PaymentRequestInvoice {
  id: number;
  name: string;
  state: string;
}

export interface PaymentRequestData {
  id: number;
  name: string;
  subscription_code: string;
  amount_required: number;
  amount_paid: number;
  amount_remaining: number;
  status: string;
  payment_type: string;
  customer: PaymentRequestCustomer;
  sale_order: PaymentRequestOrder;
  invoice: PaymentRequestInvoice;
  payment_instructions: string;
  payment_endpoint: string;
  payment_params: {
    subscription_code: string;
    phone_number: string;
    amount: string;
  };
  check_status_url: string;
}

export interface CreatePaymentRequestResponse {
  success: boolean;
  message: string;
  payment_request?: PaymentRequestData;
  // Error fields when request fails
  error?: string;
  business_rule?: string;
  instructions?: string[];
  existing_request?: {
    id: number;
    name: string;
    amount_required: number;
    amount_paid: number;
    amount_remaining: number;
    status: string;
    progress_percentage: number;
    description: string;
    created_at: string;
    actions: {
      check_status: string;
      cancel_request: string;
    };
  };
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

/**
 * Check if an error is a network/connectivity error that may be transient
 */
function isNetworkError(error: Error | unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const networkPatterns = [
    /network/i,
    /fetch/i,
    /timeout/i,
    /connection refused/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /net::ERR_/i,
    /NetworkError/i,
    /Failed to fetch/i,
    /Load failed/i,
    /Network request failed/i,
    /ERR_INTERNET_DISCONNECTED/i,
    /ERR_NETWORK_CHANGED/i,
    /ERR_CONNECTION_TIMED_OUT/i,
    /ERR_NAME_NOT_RESOLVED/i,
    /AbortError/i,
  ];
  return networkPatterns.some(pattern => pattern.test(message));
}

/**
 * Get a user-friendly message for network errors
 */
function getNetworkErrorMessage(error: Error | unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  if (/timeout|ETIMEDOUT|ERR_CONNECTION_TIMED_OUT/i.test(message)) {
    return 'Request timed out. Please check your connection and try again.';
  }
  
  if (/Failed to fetch|NetworkError|net::ERR_|ERR_INTERNET_DISCONNECTED/i.test(message)) {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/i.test(message)) {
    return 'Cannot reach server. Please check your network or VPN connection.';
  }
  
  return 'Network error. Please check your internet connection and try again.';
}

/**
 * Retry configuration for API requests
 */
const RETRY_CONFIG = {
  maxRetries: 2,         // Retry up to 2 times (3 attempts total)
  baseDelayMs: 1000,     // Start with 1 second delay
  maxDelayMs: 5000,      // Cap at 5 seconds
};

/**
 * Execute a fetch with retry logic for transient network errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error: unknown) {
    // Only retry on network errors, not on other errors
    if (!isNetworkError(error)) {
      throw error;
    }
    
    if (retryCount >= RETRY_CONFIG.maxRetries) {
      // Max retries reached - throw a user-friendly error
      const friendlyMessage = getNetworkErrorMessage(error);
      console.error(`[Odoo API] Network error after ${retryCount + 1} attempts:`, error);
      throw new Error(friendlyMessage);
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount),
      RETRY_CONFIG.maxDelayMs
    );
    
    console.warn(`[Odoo API] Network error, retrying in ${delay}ms (attempt ${retryCount + 2}/${RETRY_CONFIG.maxRetries + 1}):`, 
      error instanceof Error ? error.message : error);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retryCount + 1);
  }
}

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
    const response = await fetchWithRetry(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Odoo API Error:', data);
      throw new Error(data?.data?.error || data?.error || `HTTP ${response.status}`);
    }

    return data as OdooApiResponse<T>;
  } catch (error: unknown) {
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
 * 
 * @param payload - Customer registration data (name, email, phone, street, city, zip)
 * @param authToken - Optional employee/salesperson token to derive company_id from
 *                    When provided, includes Authorization: Bearer header
 */
export async function registerCustomer(
  payload: RegisterCustomerPayload,
  authToken?: string
): Promise<RegisterCustomerResponse> {
  const headers: HeadersInit = {};
  
  // Add Authorization header if token is provided (for company association)
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await apiRequest<RegisterCustomerResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
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
 * Note: Odoo API returns products categorized by type (subscription, main_service, battery_swap, packages)
 * 
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of items per page (default: 20)
 * @param authToken - Optional employee/salesperson token to filter plans by company
 *                    When provided, includes Authorization: Bearer header
 */
export async function getSubscriptionProducts(
  page: number = 1,
  limit: number = 20,
  authToken?: string
): Promise<OdooApiResponse<SubscriptionProductsResponse>> {
  const url = `${ODOO_BASE_URL}/api/products/subscription?page=${page}&limit=${limit}`;
  
  console.log('[ODOO API] getSubscriptionProducts called');
  console.log('[ODOO API] URL:', url);
  console.log('[ODOO API] Has auth token:', !!authToken);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  // Add Authorization header if token is provided (for company-specific plans)
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    console.log('[ODOO API] Making fetch request...');
    const response = await fetchWithRetry(url, { method: 'GET', headers });
    console.log('[ODOO API] Fetch completed, status:', response.status);
    const rawData: SubscriptionProductsRawResponse = await response.json();

    if (!response.ok) {
      console.error('Odoo API Error:', rawData);
      throw new Error((rawData as any)?.error || `HTTP ${response.status}`);
    }

    // Handle both old format (products array) and new format (categories object)
    let subscriptionProducts: SubscriptionProduct[] = [];
    let mainServiceProducts: SubscriptionProduct[] = [];
    let batterySwapProducts: SubscriptionProduct[] = [];
    let packageProducts: SubscriptionProduct[] = [];

    if (rawData.categories) {
      // New format: products are categorized
      subscriptionProducts = rawData.categories.subscription || [];
      mainServiceProducts = rawData.categories.main_service || [];
      batterySwapProducts = rawData.categories.battery_swap || [];
      packageProducts = rawData.categories.packages || [];
    } else if ((rawData as any).products) {
      // Legacy format: flat products array (backward compatibility)
      subscriptionProducts = (rawData as any).products || [];
    }

    // Transform to normalized format with data wrapper
    return {
      success: rawData.success,
      data: {
        products: subscriptionProducts,  // Subscription plans
        mainServiceProducts,  // Physical products (bikes, tuks, etc.)
        batterySwapProducts,  // Battery swap privileges
        packageProducts,  // Product packages
        pagination: {
          page: rawData.pagination?.current_page || 1,
          limit: rawData.pagination?.per_page || 20,
          total: rawData.pagination?.total_records || 0,
          pages: rawData.pagination?.total_pages || 1,
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
 * 
 * @param payload - Subscription purchase data
 * @param authToken - Optional employee/salesperson token for authorization
 *                    When provided, includes Authorization: Bearer header
 */
export async function purchaseSubscription(
  payload: PurchaseSubscriptionPayload,
  authToken?: string
): Promise<OdooApiResponse<PurchaseSubscriptionResponse>> {
  const url = `${ODOO_BASE_URL}/api/subscription/purchase`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetchWithRetry(url, {
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
 * Purchase multiple products in one order (Package + Subscription)
 * This is the new format that bundles all items together:
 * - Main product (e.g., E3 bike)
 * - Privilege (e.g., E3 Swap Privilege)
 * - Subscription plan
 * 
 * @param payload - Multi-product purchase data with all items
 * @param authToken - Optional employee/salesperson token for authorization
 */
export async function purchaseMultiProducts(
  payload: PurchaseMultiProductPayload,
  authToken?: string
): Promise<OdooApiResponse<PurchaseSubscriptionResponse>> {
  const url = `${ODOO_BASE_URL}/api/subscription/purchase`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Log the request payload for debugging
  console.info('=== PURCHASE MULTI PRODUCTS (CREATE ORDER) - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const rawData = await response.json();

    // Log the full response for debugging
    console.info('=== PURCHASE MULTI PRODUCTS (CREATE ORDER) - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(rawData, null, 2));

    // Check HTTP status first
    if (!response.ok) {
      console.error('Odoo API Error (HTTP):', rawData);
      throw new Error(rawData?.message || rawData?.error || `HTTP ${response.status}`);
    }

    // Check success field - API might return HTTP 200 with success: false
    if (!rawData.success) {
      console.error('Odoo API Error (success=false):', rawData);
      throw new Error(rawData?.message || rawData?.error || 'Order creation failed');
    }

    // Validate required fields exist
    if (!rawData.order || !rawData.order.id) {
      console.error('Odoo API Error: Missing order in response', rawData);
      throw new Error('Order creation failed - no order returned');
    }

    if (!rawData.subscription || !rawData.subscription.subscription_code) {
      console.error('Odoo API Error: Missing subscription in response', rawData);
      throw new Error('Order creation failed - no subscription returned');
    }

    // Get currency symbol based on currency code
    const getCurrencySymbol = (currency: string): string => {
      const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'KES': 'KSh',
        'XOF': 'CFA',
        'GBP': '£',
        'CNY': '¥',
      };
      return symbols[currency] || currency;
    };

    // Transform root-level response to normalized format with data wrapper
    // Note: order_id is also available at root level as rawData.order_id
    return {
      success: true,
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
    console.error('=== PURCHASE MULTI PRODUCTS - ERROR ===');
    console.error('Error:', error);
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
 * 
 * @param payload - Payment initiation data (subscription_code, phone_number, amount)
 * @param authToken - Optional employee/salesperson token for authorization
 */
export async function initiatePayment(
  payload: InitiatePaymentPayload,
  authToken?: string
): Promise<OdooApiResponse<InitiatePaymentResponse>> {
  const headers: HeadersInit = {};
  
  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return apiRequest<InitiatePaymentResponse>('/api/payments/lipay/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
  });
}

/**
 * Create a payment request/ticket before collecting payment
 * This MUST be called before collecting payment from the customer.
 * 
 * The response includes payment_request.sale_order.id which MUST be used as order_id
 * when calling confirmPaymentManual.
 * 
 * IMPORTANT: If there's already an active payment request, the API returns:
 * - success: false
 * - error: Description of the problem
 * - existing_request: Details about the existing active request
 * - instructions: Options for how to proceed (complete, cancel, or pay remaining)
 * 
 * The caller MUST treat this as an error and inform the user - do NOT silently reuse
 * the existing request or fall back to subscription_code for confirm payment.
 * 
 * @param payload - Payment request data (subscription_code, amount_required, description, external_reference?)
 * @param authToken - Optional employee/salesperson token for authorization
 */
export async function createPaymentRequest(
  payload: CreatePaymentRequestPayload,
  authToken?: string
): Promise<CreatePaymentRequestResponse> {
  const url = `${ODOO_BASE_URL}/api/payment-request/create`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // Log the request payload for debugging
  console.info('=== CREATE PAYMENT REQUEST - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data: CreatePaymentRequestResponse = await response.json();
    
    // Log the full response for debugging
    console.info('=== CREATE PAYMENT REQUEST - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    // Note: API returns success: false for business rule violations (e.g., existing active request)
    // We return the full response so caller can handle accordingly
    return data;
  } catch (error: any) {
    console.error('=== CREATE PAYMENT REQUEST - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Manually confirm a payment with M-Pesa receipt
 * Used after customer has paid and we have the receipt code
 * 
 * REQUIRES: order_id from createPaymentRequest response
 * The order_id is obtained from payment_request.sale_order.id after creating a payment request
 * 
 * IMPORTANT: Check that total_paid >= expected amount before proceeding
 * 
 * @param payload - Payment confirmation data (order_id + receipt)
 * @param authToken - Optional employee/salesperson token for authorization
 */
export async function confirmPaymentManual(
  payload: ManualConfirmPaymentPayload,
  authToken?: string
): Promise<OdooApiResponse<ManualConfirmPaymentResponse>> {
  const headers: HeadersInit = {};
  
  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return apiRequest<ManualConfirmPaymentResponse>('/api/lipay/manual-confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
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
// Workflow Session Management API
// ============================================================================

/**
 * Session data structure for workflow persistence
 * This flexible JSON structure allows storing all workflow state
 * Used by both Attendant and Sales workflows
 */
export interface WorkflowSessionData {
  status: 'in_progress' | 'completed' | 'cancelled';
  workflowType: 'attendant' | 'salesperson';
  currentStep: number;
  maxStepReached: number;
  
  // Actor information
  actor?: {
    employeeId?: number;
    name?: string;
    station?: string;
  };
  
  // Customer identification (Attendant workflow)
  inputMode?: 'scan' | 'manual';
  manualSubscriptionId?: string;
  dynamicPlanId?: string;
  
  // Customer data from backend
  customerData?: {
    id?: string;
    name?: string;
    subscriptionId?: string;
    subscriptionType?: string;
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
    paymentState?: string;
    serviceState?: string;
    currentBatteryId?: string;
  };
  
  customerType?: 'first-time' | 'returning';
  
  // Service states from MQTT
  serviceStates?: Array<{
    service_id: string;
    name?: string;
    used: number;
    quota: number;
    current_asset: string | null;
    usageUnitPrice?: number;
  }>;
  
  // Swap data (for attendant workflow)
  swapData?: {
    oldBattery?: {
      id: string;
      shortId?: string;
      actualBatteryId?: string;
      chargeLevel?: number;
      energy?: number;
      macAddress?: string;
    } | null;
    newBattery?: {
      id: string;
      shortId?: string;
      actualBatteryId?: string;
      chargeLevel?: number;
      energy?: number;
      macAddress?: string;
    } | null;
    energyDiff?: number;
    quotaDeduction?: number;
    chargeableEnergy?: number;
    grossEnergyCost?: number;
    quotaCreditValue?: number;
    cost?: number;
    rate?: number;
    currencySymbol?: string;
  };
  
  // Payment information
  payment?: {
    inputMode?: 'scan' | 'manual';
    manualPaymentId?: string;
    requestCreated?: boolean;
    requestOrderId?: number | null;
    expectedAmount?: number;
    amountRemaining?: number;
    amountPaid?: number;
    transactionId?: string | null;
    skipped?: boolean;
    skipReason?: string | null;
    // For Sales flow - indicates if payment is incomplete (shortfall)
    incomplete?: boolean;
  };
  
  // Error tracking
  flowError?: {
    step: number;
    message: string;
    details?: string;
  } | null;
  
  // === SALES WORKFLOW SPECIFIC FIELDS ===
  
  // Form data for customer registration
  formData?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    street?: string;
    city?: string;
    zip?: string;
  };
  
  // Package and plan selection
  selectedPackageId?: string;
  selectedPlanId?: string;
  
  // Created customer data (from Odoo registration)
  createdCustomerId?: number | null;
  createdPartnerId?: number | null;
  customerSessionToken?: string | null;
  
  // Subscription data from purchase
  subscriptionData?: {
    id?: number;
    subscriptionCode?: string;
    status?: string;
    productName?: string;
    /** Price at signup - null indicates not loaded from backend. NEVER use hardcoded defaults. */
    priceAtSignup?: number | null;
    currency?: string;
    currencySymbol?: string;
  };
  
  // Confirmed subscription code (from payment confirmation)
  confirmedSubscriptionCode?: string | null;
  
  // Battery assignment (Sales workflow - first-time customer)
  scannedBatteryPending?: {
    id: string;
    shortId?: string;
    actualBatteryId?: string;
    chargeLevel?: number;
    energy?: number;
    macAddress?: string;
  } | null;
  assignedBattery?: {
    id: string;
    shortId?: string;
    actualBatteryId?: string;
    chargeLevel?: number;
    energy?: number;
    macAddress?: string;
  } | null;
  
  // Customer identification state (for pricing info)
  customerIdentification?: {
    identified?: boolean;
    rate?: number | null;
    currencySymbol?: string | null;
  };
  
  // Scanned vehicle ID
  scannedVehicleId?: string | null;
  
  // Registration ID (generated on success)
  registrationId?: string;
  
  // Metadata
  savedAt?: number;
  version?: number;
}

/**
 * Payload for creating a new session (Step 1 - after customer identification)
 */
export interface CreateSessionPayload {
  subscription_code: string;
  session_data: WorkflowSessionData;
}

/**
 * Response from creating a session
 */
export interface CreateSessionResponse {
  success: boolean;
  message: string;
  session: {
    id: number;
    name: string;
    session_code: string | null;
    state: string;
    start_date: string;
  };
  order: {
    id: number;
    name: string;
    state: string;
    amount_total: number;
    expected_amount: number;
    paid_amount: number;
    remaining_amount: number;
    channel_partner_id: number | null;
    channel_partner_name: string | null;
    outlet_id: number | null;
    outlet_name: string | null;
    sales_rep_id: number;
    sales_rep_name: string;
  };
  order_id: number;
  invoice: {
    id: number | null;
    invoice_number: string | null;
    message: string;
  };
  next_step?: {
    action: string;
    message: string;
    payment_url: string;
    payment_params: {
      order_id: number;
      session_id: number;
      amount: number;
      phone_number: string;
    };
  };
}

/**
 * Payload for updating a session (normal steps)
 */
export interface UpdateSessionPayload {
  session_data: WorkflowSessionData;
}

/**
 * Payload for updating a session with payment info (Step 4)
 */
export interface UpdateSessionWithPaymentPayload {
  session_data: WorkflowSessionData;
  description: string;
  amount_required: number;
}

/**
 * Response from updating a session
 */
export interface UpdateSessionResponse {
  success: boolean;
  message: string;
  session?: {
    id: number;
    name: string;
    state: string;
  };
  order?: {
    id: number;
    name: string;
    state: string;
    amount_total: number;
    expected_amount: number;
    paid_amount: number;
    remaining_amount: number;
  };
}

/**
 * Response from fetching the latest pending session
 * Note: The session data is nested inside order.session, not at top level
 */
export interface LatestPendingSessionResponse {
  success: boolean;
  message?: string;
  sales_rep?: {
    id: number;
    name: string;
    email: string;
  };
  order?: {
    id: number;
    name: string;
    state: string;
    date_order?: string;
    amount_total: number;
    amount_untaxed?: number;
    expected_amount: number;
    paid_amount: number;
    remaining_amount: number;
    currency?: string;
    client_order_ref?: string;
    invoice_status?: string;
    partner_id?: number;
    partner_name?: string;
    channel_partner_id?: number | null;
    channel_partner_name?: string | null;
    outlet_id?: number | null;
    outlet_name?: string | null;
    sales_rep_id?: number;
    sales_rep_name?: string;
    line_count?: number;
    subscription_code?: string;
    /** Session is nested inside order */
    session?: {
      id: number;
      name: string;
      session_code: string | null;
      state: string;
      partner_id?: number;
      partner_name?: string;
      sales_rep_id?: number;
      sales_rep_name?: string;
      channel_partner_id?: number | null;
      channel_partner_name?: string | null;
      outlet_id?: number | null;
      outlet_name?: string | null;
      start_date: string;
      pause_date?: string | null;
      resume_date?: string | null;
      completed_date?: string | null;
      cancelled_date?: string | null;
      session_data: WorkflowSessionData | null;
      payment_attempt_count?: number;
    };
  };
}

/**
 * Create a new workflow session
 * Called after customer identification (Step 1)
 * 
 * @param payload - Contains subscription_code and session_data
 * @param authToken - Employee/salesperson token for authorization
 */
export async function createWorkflowSession(
  payload: CreateSessionPayload,
  authToken?: string
): Promise<CreateSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/subscription/purchase`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== CREATE WORKFLOW SESSION - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.info('=== CREATE WORKFLOW SESSION - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Create session error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    if (!data.success) {
      console.error('Create session error (success=false):', data);
      throw new Error(data?.message || data?.error || 'Session creation failed');
    }
    
    return data as CreateSessionResponse;
  } catch (error: any) {
    console.error('=== CREATE WORKFLOW SESSION - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Update an existing workflow session
 * Called on normal step transitions (Step 2, 3, etc.)
 * 
 * @param orderId - The order ID from createWorkflowSession response
 * @param payload - Contains updated session_data
 * @param authToken - Employee/salesperson token for authorization
 */
export async function updateWorkflowSession(
  orderId: number,
  payload: UpdateSessionPayload,
  authToken?: string
): Promise<UpdateSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/sessions/by-order/${orderId}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== UPDATE WORKFLOW SESSION - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Order ID:', orderId);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.info('=== UPDATE WORKFLOW SESSION - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Update session error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as UpdateSessionResponse;
  } catch (error: any) {
    console.error('=== UPDATE WORKFLOW SESSION - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Update an existing workflow session with payment information
 * Called on Step 4 (payment reporting step) to record expected payment
 * 
 * @param orderId - The order ID from createWorkflowSession response
 * @param payload - Contains session_data, description, and amount_required
 * @param authToken - Employee/salesperson token for authorization
 */
export async function updateWorkflowSessionWithPayment(
  orderId: number,
  payload: UpdateSessionWithPaymentPayload,
  authToken?: string
): Promise<UpdateSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/sessions/by-order/${orderId}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== UPDATE SESSION WITH PAYMENT - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Order ID:', orderId);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.info('=== UPDATE SESSION WITH PAYMENT - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Update session with payment error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as UpdateSessionResponse;
  } catch (error: any) {
    console.error('=== UPDATE SESSION WITH PAYMENT - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Fetch the latest pending session for the current sales rep
 * Used to resume an interrupted workflow
 * 
 * Uses the /api/orders endpoint with latest_updated=true to get the most recently updated order
 * 
 * @param authToken - Employee/salesperson token for authorization (required)
 */
export async function getLatestPendingSession(
  authToken: string
): Promise<LatestPendingSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/orders?latest_updated=true&limit=1`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
    'Authorization': `Bearer ${authToken}`,
  };
  
  console.info('=== GET LATEST SESSION (latest_updated endpoint) ===');
  console.info('URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    
    console.info('=== GET LATEST SESSION - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Get pending session error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as LatestPendingSessionResponse;
  } catch (error: any) {
    console.error('=== GET LATEST SESSION - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

// ============================================================================
// Sales Workflow Session Management API
// ============================================================================

/**
 * Payload for creating a new Sales workflow session
 * Called after customer registration (Step 1)
 * 
 * Unlike Attendant workflow which uses subscription_code,
 * Sales workflow uses customer_id and company_id since the
 * customer is newly registered and doesn't have a subscription yet.
 */
export interface CreateSalesSessionPayload {
  customer_id: number;
  company_id: number;
  session_data: WorkflowSessionData;
}

/**
 * Payload for updating a session with products
 * Called on Step 4 (Payment step) for Sales workflow
 * 
 * Includes the products array to add order lines for:
 * - Subscription plan
 * - Package components (main product, privilege)
 */
export interface UpdateSessionWithProductsPayload {
  session_data: WorkflowSessionData;
  products: Array<{
    product_id: number;
    quantity: number;
    price_unit: number;
  }>;
}

/**
 * Create a new Sales workflow session
 * Called after customer registration (Step 1)
 * 
 * Uses the /api/subscription/purchase endpoint with customer_id instead of subscription_code
 * The backend will create the order and session for the new customer
 * 
 * @param payload - Contains customer_id, company_id, and session_data
 * @param authToken - Employee/salesperson token for authorization
 */
export async function createSalesWorkflowSession(
  payload: CreateSalesSessionPayload,
  authToken?: string
): Promise<CreateSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/subscription/purchase`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== CREATE SALES WORKFLOW SESSION - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.info('=== CREATE SALES WORKFLOW SESSION - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Create sales session error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    if (!data.success) {
      console.error('Create sales session error (success=false):', data);
      throw new Error(data?.message || data?.error || 'Sales session creation failed');
    }
    
    return data as CreateSessionResponse;
  } catch (error: any) {
    console.error('=== CREATE SALES WORKFLOW SESSION - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Update a Sales workflow session with products
 * Called on Step 4 (Payment step) to add order lines
 * 
 * Uses the /api/sessions/by-order/{orderId} endpoint with products array
 * The backend will add the products to the order and update session data
 * 
 * @param orderId - The order ID from createSalesWorkflowSession response
 * @param payload - Contains session_data and products array
 * @param authToken - Employee/salesperson token for authorization
 */
export async function updateWorkflowSessionWithProducts(
  orderId: number,
  payload: UpdateSessionWithProductsPayload,
  authToken?: string
): Promise<UpdateSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/sessions/by-order/${orderId}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== UPDATE SESSION WITH PRODUCTS - PAYLOAD ===');
  console.info('URL:', url);
  console.info('Order ID:', orderId);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    console.info('=== UPDATE SESSION WITH PRODUCTS - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Update session with products error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as UpdateSessionResponse;
  } catch (error: any) {
    console.error('=== UPDATE SESSION WITH PRODUCTS - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

// ============================================================================
// Export default company ID for convenience
// ============================================================================

export { DEFAULT_COMPANY_ID };
