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
      user_type?: string;
    };
  };
  email_sent: boolean;
  plain_password?: string | null; // Password generated for the customer (field name from API)
}

// Product Types - matches actual Odoo API response
// Used for all product categories: physical, service, contract, digital, other
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
  pu_category?: string | false;    // "physical" | "service" | "contract" | false
  pu_metric?: string | false;      // "piece" | "duration" | false
  service_type?: string | false;   // "access" | false
  contract_type?: string | false;  // "privilege" | false
  image_url?: string | null;  // Cloudinary URL for product images
  company_id?: number;
  company_name: string;
}

// Categorized products from API response (new format)
export interface ProductCategories {
  physical: SubscriptionProduct[];
  service: SubscriptionProduct[];
  contract: SubscriptionProduct[];
  digital: SubscriptionProduct[];
  other: SubscriptionProduct[];
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

/**
 * Parse and validate an Odoo API response
 * Handles:
 * - Non-OK HTTP status codes (4xx, 5xx)
 * - Non-JSON responses (HTML error pages)
 * - JSON parse errors
 * - API-level errors (success: false)
 * 
 * @throws Error with user-friendly message on any failure
 */
async function parseOdooResponse<T>(response: Response, endpoint: string): Promise<T> {
  // Check HTTP status first
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let errorMessage = `Server error (HTTP ${response.status})`;
    
    if (contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        errorMessage = errorData?.data?.error || errorData?.error || errorData?.message || errorMessage;
      } catch {
        // JSON parsing failed, use default message
      }
    } else {
      // Response is not JSON (likely HTML error page)
      const textPreview = await response.text().catch(() => '');
      console.error(`[Odoo API] ${endpoint} - Non-JSON error response:`, textPreview.substring(0, 200));
      
      // Provide specific messages for common HTTP errors
      if (response.status === 500) {
        errorMessage = 'Server error (500). Service temporarily unavailable. Please try again later.';
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage = `Server unavailable (${response.status}). Please try again later.`;
      } else if (response.status === 401) {
        errorMessage = 'Session expired. Please log out and log back in.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. You may not have permission for this action.';
      } else if (response.status === 404) {
        errorMessage = 'Resource not found. Please contact support.';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request. Please check your input and try again.';
      }
    }
    
    console.error(`[Odoo API] ${endpoint} - Error:`, { status: response.status, message: errorMessage });
    throw new Error(errorMessage);
  }
  
  // Check content-type before parsing JSON
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const textPreview = await response.text().catch(() => '');
    console.error(`[Odoo API] ${endpoint} - Unexpected content-type:`, contentType, 'Body:', textPreview.substring(0, 200));
    throw new Error('Server returned an unexpected response format. Please try again.');
  }
  
  // Parse JSON
  let data: T;
  try {
    data = await response.json();
  } catch (parseError) {
    console.error(`[Odoo API] ${endpoint} - JSON parse error:`, parseError);
    throw new Error('Failed to parse server response. Please try again.');
  }
  
  // Check for API-level errors (success: false)
  const apiResponse = data as any;
  if (apiResponse.success === false) {
    const errorMessage = apiResponse.error || apiResponse.message || apiResponse.data?.error || 'Request failed';
    console.error(`[Odoo API] ${endpoint} - API error:`, errorMessage);
    throw new Error(errorMessage);
  }
  
  return data;
}

/**
 * Generic Odoo API request helper
 * Uses parseOdooResponse for consistent error handling
 */
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

    return await parseOdooResponse<OdooApiResponse<T>>(response, endpoint);
  } catch (error: unknown) {
    console.error(`[Odoo API] ${endpoint} - Request failed:`, error);
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
 * Note: Odoo API returns products categorized by type: physical, service, contract, digital, other
 * 
 * Mapping to internal format:
 *   - categories.physical  → mainServiceProducts (physical products like bikes)
 *   - categories.service   → products (subscription plans, recurring_invoice=true)
 *   - categories.contract  → batterySwapProducts (privilege contracts)
 *   - packages are no longer a separate API category
 * 
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of items per page (default: 100)
 * @param authToken - Optional employee/salesperson token to filter plans by company
 *                    When provided, includes Authorization: Bearer header
 */
export async function getSubscriptionProducts(
  page: number = 1,
  limit: number = 100,
  authToken?: string
): Promise<OdooApiResponse<SubscriptionProductsResponse>> {
  const endpoint = `/api/products/subscription?page=${page}&limit=${limit}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;
  
  console.log('[ODOO API] getSubscriptionProducts called');
  console.log('[ODOO API] URL:', url);
  console.log('[ODOO API] Has auth token:', !!authToken);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    console.log('[ODOO API] Making fetch request...');
    console.error('[PRODUCTS DEBUG] URL:', url);
    console.error('[PRODUCTS DEBUG] Auth token present:', !!authToken);
    console.error('[PRODUCTS DEBUG] Auth token preview:', authToken ? authToken.substring(0, 40) + '...' : 'NONE');

    const response = await fetchWithRetry(url, { method: 'GET', headers });
    console.error('[PRODUCTS DEBUG] HTTP status:', response.status);
    console.error('[PRODUCTS DEBUG] Content-Type:', response.headers.get('content-type'));

    // Read raw text first so we can log it before parsing
    const rawText = await response.text();
    console.error('[PRODUCTS DEBUG] Raw response length:', rawText.length);
    console.error('[PRODUCTS DEBUG] Raw response (first 500 chars):', rawText.substring(0, 500));

    // Parse JSON manually (parseOdooResponse already consumed the body)
    let rawData: any;
    try {
      rawData = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[PRODUCTS DEBUG] JSON parse failed:', parseErr);
      console.error('[PRODUCTS DEBUG] Full raw text:', rawText.substring(0, 2000));
      throw new Error('Server returned invalid JSON. Check VConsole for details.');
    }

    // Check for API-level errors
    if (rawData.success === false) {
      const errorMessage = rawData.error || rawData.message || 'Request failed';
      console.error('[PRODUCTS DEBUG] API error:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('[PRODUCTS DEBUG] success:', rawData.success);
    console.error('[PRODUCTS DEBUG] has categories:', !!rawData.categories);
    console.error('[PRODUCTS DEBUG] has products (old format):', !!(rawData as any).products);
    console.error('[PRODUCTS DEBUG] message:', (rawData as any).message || 'none');

    if (rawData.categories) {
      const cats = rawData.categories;
      console.error('[PRODUCTS DEBUG] physical count:', cats.physical?.length ?? 0);
      console.error('[PRODUCTS DEBUG] service count:', cats.service?.length ?? 0);
      console.error('[PRODUCTS DEBUG] contract count:', cats.contract?.length ?? 0);
    }

    let subscriptionProducts: SubscriptionProduct[] = [];
    let mainServiceProducts: SubscriptionProduct[] = [];
    let batterySwapProducts: SubscriptionProduct[] = [];
    let packageProducts: SubscriptionProduct[] = [];

    if (rawData.categories) {
      mainServiceProducts = rawData.categories.physical || [];
      subscriptionProducts = rawData.categories.service || [];
      batterySwapProducts = rawData.categories.contract || [];
    } else {
      const apiMessage = (rawData as any).message;
      console.error('[PRODUCTS DEBUG] No categories! API message:', apiMessage);
      throw new Error(apiMessage || 'Authentication required. Please log out and log back in.');
    }

    return {
      success: rawData.success,
      data: {
        products: subscriptionProducts,
        mainServiceProducts,
        batterySwapProducts,
        packageProducts,
        pagination: {
          page: rawData.pagination?.current_page || 1,
          limit: rawData.pagination?.per_page || 100,
          total: rawData.pagination?.total_records || 0,
          pages: rawData.pagination?.total_pages || 1,
        },
      },
    };
  } catch (error: any) {
    console.error('[PRODUCTS DEBUG] FETCH FAILED:', error?.message || error);
    console.error('[PRODUCTS DEBUG] Error type:', error?.constructor?.name);
    console.error('[PRODUCTS DEBUG] Stack:', error?.stack);
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
    email?: string;
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
  
  // Customer password from registration (for display on receipt)
  customerPassword?: string | null;
  
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
 * Subscription created as part of a session update (when products are added)
 */
export interface CreatedSubscription {
  subscription_code: string;
  product_id: number;
  product_name: string;
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
    sale_order_id?: number;
    session_data?: Record<string, unknown>;
  };
  order?: {
    id: number;
    name: string;
    state: string;
    amount_total: number;
    amount_untaxed?: number;
    amount_tax?: number;
    expected_amount?: number;
    paid_amount?: number;
    remaining_amount?: number;
  };
  /** Subscription code returned when products are added to order */
  subscription_code?: string;
  /** Array of subscriptions created when products are added */
  subscriptions_created?: CreatedSubscription[];
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
// Change Password API
// ============================================================================

/**
 * Input for changing password
 */
export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

/**
 * Response from change password endpoint
 */
export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Change customer password
 * 
 * @param payload - Password change data (current_password, new_password, confirm_password)
 * @param authToken - Customer authentication token (Bearer token)
 */
export async function changePassword(
  payload: ChangePasswordPayload,
  authToken?: string
): Promise<ChangePasswordResponse> {
  const url = `${ODOO_BASE_URL}/api/auth/change-password`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || 'Failed to change password');
  }

  return data as ChangePasswordResponse;
}

// ============================================================================
// Orders/Sessions List API
// ============================================================================

/**
 * Session data nested within an order
 */
export interface OrderSession {
  id: number;
  name: string;
  session_code: string | null;
  state: 'active' | 'paused' | 'completed' | 'cancelled';
  partner_id: number;
  partner_name: string;
  sales_rep_id: number;
  sales_rep_name: string;
  channel_partner_id: number | null;
  channel_partner_name: string | null;
  outlet_id: number | null;
  outlet_name: string | null;
  start_date: string;
  pause_date: string | null;
  resume_date: string | null;
  completed_date: string | null;
  cancelled_date: string | null;
  session_data: WorkflowSessionData | null;
  payment_attempt_count: number;
}

/**
 * Order data from the orders list API
 */
export interface OrderListItem {
  id: number;
  name: string;
  state: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
  date_order: string;
  amount_total: number;
  amount_untaxed: number;
  expected_amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  client_order_ref: string;
  invoice_status: string;
  partner_id: number;
  partner_name: string;
  channel_partner_id: number | null;
  channel_partner_name: string | null;
  outlet_id: number | null;
  outlet_name: string | null;
  sales_rep_id: number;
  sales_rep_name: string;
  line_count: number;
  session: OrderSession | null;
}

/**
 * Pagination info from orders API
 */
export interface OrdersPagination {
  current_page: number;
  per_page: number;
  total_records: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

/**
 * Response from the orders list API
 */
export interface OrdersListResponse {
  success: boolean;
  orders: OrderListItem[];
  pagination: OrdersPagination;
}

/**
 * Parameters for fetching orders/sessions
 */
export interface GetOrdersParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Filter by order state */
  state?: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
  /** Get only orders for the current user */
  mine?: boolean;
  /** Filter by subscription code */
  subscription_code?: string;
  /** Filter by customer ID */
  customer_id?: number;
  /** Get only the latest order */
  latest?: boolean;
  /** Get the most recently updated order */
  latest_updated?: boolean;
}

/**
 * Fetch orders/sessions list with pagination and filtering
 * 
 * This endpoint returns orders with their associated sessions,
 * which can be used to display past sessions and allow resumption.
 * 
 * @param params - Query parameters for filtering and pagination
 * @param authToken - Employee/salesperson token for authorization (required)
 */
export async function getOrdersList(
  params: GetOrdersParams = {},
  authToken: string
): Promise<OrdersListResponse> {
  // Build query string
  const queryParams = new URLSearchParams();
  
  if (params.page !== undefined) {
    queryParams.append('page', String(params.page));
  }
  if (params.limit !== undefined) {
    queryParams.append('limit', String(params.limit));
  }
  if (params.state) {
    queryParams.append('state', params.state);
  }
  if (params.mine) {
    queryParams.append('mine', 'true');
  }
  if (params.subscription_code) {
    queryParams.append('subscription_code', params.subscription_code);
  }
  if (params.customer_id !== undefined) {
    queryParams.append('customer_id', String(params.customer_id));
  }
  if (params.latest) {
    queryParams.append('latest', 'true');
  }
  if (params.latest_updated) {
    queryParams.append('latest_updated', 'true');
  }
  
  const queryString = queryParams.toString();
  const url = `${ODOO_BASE_URL}/api/orders${queryString ? `?${queryString}` : ''}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
    'Authorization': `Bearer ${authToken}`,
  };
  
  console.info('=== GET ORDERS LIST ===');
  console.info('URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    
    console.info('=== GET ORDERS LIST - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Orders count:', data.orders?.length || 0);
    
    if (!response.ok) {
      console.error('Get orders error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as OrdersListResponse;
  } catch (error: any) {
    console.error('=== GET ORDERS LIST - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

// ============================================================================
// Customer Dashboard API
// ============================================================================

/**
 * Customer dashboard response from /api/customers/{id}/dashboard
 */
export interface CustomerDashboardResponse {
  success: boolean;
  customer: {
    id: number;
    name: string;
    email: string | false;
    phone: string | false;
    mobile: string | false;
    is_company: boolean;
    customer_rank: number;
    supplier_rank: number;
    active: boolean;
    street: string | false;
    city: string | false;
    zip: string | false;
    country_id: [number, string] | false;
    company_id: [number, string] | false;
    parent_id: [number, string] | false;
    create_date: string;
    write_date: string;
  };
  summary: {
    total_paid: number;
    total_pending: number;
    active_subscriptions: number;
    pending_invoices_count: number;
  };
  subscribed_products: Array<{
    product_id: number;
    product_name: string;
    product_code: string;
    description: string;
    subscription_id: number;
    subscription_code: string;
    subscription_name: string;
    subscription_start: string;
    last_payment: string;
    next_payment_date: string;
    total_paid: number;
    amount_paid: number;
    is_active: boolean;
    billing_frequency: string;
    subscription_state: string;
    price_unit: number;
    currency: string;
    invoices: Array<{
      id: number;
      name: string;
      amount_total: number;
      amount_residual: number;
      state: string;
      invoice_date: string;
      invoice_date_due: string;
    }>;
  }>;
  payment_history: Array<{
    id: number;
    name: string;
    amount: number;
    date: string;
    state: string;
    payment_method: string;
  }>;
  pending_invoices: Array<{
    id: number;
    name: string;
    amount_total: number;
    amount_residual: number;
    invoice_date_due: string;
    state: string;
  }>;
  next_payment: {
    next_due_date: string | null;
    amount_due: number;
    is_overdue: boolean;
    days_until_due: number | null;
    invoice_number: string | null;
    message: string;
  };
  last_updated: string;
}

/**
 * Get customer dashboard data including profile, subscriptions, and payment info
 * This enriches customer data after identification with name, phone, etc.
 * 
 * @param customerId - The customer/partner ID from Odoo
 * @param authToken - Optional authorization token
 */
export async function getCustomerDashboard(
  customerId: number,
  authToken?: string
): Promise<CustomerDashboardResponse> {
  const url = `${ODOO_BASE_URL}/api/customers/${customerId}/dashboard`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  // Add Authorization header if token is provided
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== GET CUSTOMER DASHBOARD ===');
  console.info('URL:', url);
  console.info('Customer ID:', customerId);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    
    console.info('=== GET CUSTOMER DASHBOARD - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Customer Name:', data.customer?.name);
    
    if (!response.ok) {
      console.error('Get customer dashboard error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as CustomerDashboardResponse;
  } catch (error: any) {
    console.error('=== GET CUSTOMER DASHBOARD - ERROR ===');
    console.error('Error:', error);
    throw error;
  }
}

// ============================================================================
// Attendant Transactions API
// ============================================================================

/**
 * Transaction item from /api/payments/my-transactions
 */
export interface AttendantTransaction {
  payment_id: number;
  payment_date: string;
  amount: number;
  currency: string;
  state: 'paid' | 'pending' | 'cancelled' | string;
  payment_type: 'inbound' | 'outbound' | string;
  payment_method: string;
  reference: string;
  customer: {
    id: number;
    name: string;
    phone: string;
  };
  outlet: {
    id: number;
    name: string;
  } | null;
  order: {
    id: number;
    name: string;
    amount_total: number;
    paid_amount: number;
    payment_status: 'paid' | 'partial' | 'pending' | string;
  } | null;
  payment_request: {
    id: number;
    reference: string;
  } | null;
}

/**
 * Response from /api/payments/my-transactions
 */
export interface AttendantTransactionsResponse {
  success: boolean;
  period: string;
  date_range: {
    from: string;
    to: string;
    from_datetime: string;
    to_datetime: string;
  };
  employee: {
    id: number;
    name: string;
    email: string;
    role: string;
    is_viewing_own: boolean;
  };
  logged_in_employee: {
    id: number;
    name: string;
    role: string;
    can_view_others: boolean;
  };
  summary: {
    total_transactions: number;
    total_amount: number;
    unique_customers: number;
    average_transaction: number;
  };
  transactions: AttendantTransaction[];
  pagination: {
    limit: number;
    offset: number;
    total_count: number;
    has_more: boolean;
    next_offset: number | null;
  };
  filters_applied: {
    company_id: number | null;
    partner_id: number | null;
    outlet_id: number | null;
    state: string | null;
    min_amount: number | null;
    max_amount: number | null;
  };
  access_control: {
    note: string;
    role: string;
    can_view_others: boolean;
  };
}

/**
 * Period options for transaction queries
 */
export type TransactionPeriod = 'today' | '3days' | '5days' | '7days' | '14days' | '30days' | 'all';

/**
 * Get attendant's own transactions
 * 
 * @param period - Time period to fetch (e.g., 'today', '5days', '7days', '30days')
 * @param authToken - Authorization token (required)
 * @param options - Additional filter options
 */
export async function getAttendantTransactions(
  period: TransactionPeriod = '7days',
  authToken: string,
  options?: {
    limit?: number;
    offset?: number;
    state?: string;
    min_amount?: number;
    max_amount?: number;
  }
): Promise<AttendantTransactionsResponse> {
  const params = new URLSearchParams();
  params.append('period', period);
  
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.state) params.append('state', options.state);
  if (options?.min_amount) params.append('min_amount', options.min_amount.toString());
  if (options?.max_amount) params.append('max_amount', options.max_amount.toString());
  
  const url = `${ODOO_BASE_URL}/api/payments/my-transactions?${params.toString()}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
    'Authorization': `Bearer ${authToken}`,
  };
  
  console.info('=== GET ATTENDANT TRANSACTIONS ===');
  console.info('URL:', url);
  console.info('Period:', period);
  console.info('Has Auth Token:', !!authToken);
  console.info('Token preview:', authToken ? `${authToken.substring(0, 30)}...` : 'NONE');
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers,
    });
    
    console.info('=== GET ATTENDANT TRANSACTIONS - RESPONSE RECEIVED ===');
    console.info('HTTP Status:', response.status);
    console.info('Response OK:', response.ok);
    console.info('Content-Type:', response.headers.get('content-type'));
    
    const data = await response.json();
    
    console.info('=== GET ATTENDANT TRANSACTIONS - RESPONSE ===');
    console.info('HTTP Status:', response.status);
    console.info('Total Transactions:', data.summary?.total_transactions);
    console.info('Success:', data.success);
    
    if (!response.ok) {
      console.error('Get attendant transactions error (HTTP):', data);
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    
    return data as AttendantTransactionsResponse;
  } catch (error: any) {
    console.error('=== GET ATTENDANT TRANSACTIONS - ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    // Check if this is a network error vs other error
    const errorMsg = error?.message || String(error);
    if (/Failed to fetch|NetworkError|net::ERR_|TypeError/i.test(errorMsg)) {
      console.error('This appears to be a network connectivity issue');
      console.error('Possible causes: CORS, network offline, server unreachable, or request blocked');
    }
    
    throw error;
  }
}

// ============================================================================
// Contacts API (Customer Management)
// ============================================================================

/**
 * Raw contact from the Odoo /api/contacts endpoint
 */
export interface OdooContact {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  is_company: boolean;
  customer_rank: number;
  supplier_rank: number;
  active: boolean;
  street: string | false;
  city: string | false;
  zip: string | false;
  country_id: number | null;
  company_id: number | null;
  parent_id: number | null;
  create_date: string;
  write_date: string;
  user_id: number | null;
  country_name: string | null;
  company_name: string | null;
  parent_name: string | null;
  user_name: string | null;
  assigned_employee_id: number | null;
  assigned_employee_name: string | null;
}

export interface ContactsListApiResponse {
  success: boolean;
  contacts: OdooContact[];
  pagination: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
    next_page: number | null;
    previous_page: number | null;
  };
  filters_applied?: Record<string, unknown>;
}

export interface ContactDetailApiResponse {
  success: boolean;
  contact: OdooContact;
}

export interface ContactUpdateApiResponse {
  success: boolean;
  contact: OdooContact;
  message?: string;
}

export interface ContactCreateApiResponse {
  success: boolean;
  contact: OdooContact;
  message?: string;
}

export interface GetContactsParams {
  q?: string;
  page?: number;
  limit?: number;
  type?: 'all' | 'company' | 'individual';
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface ContactWritePayload {
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  city?: string;
  zip?: string;
  is_company?: boolean;
  company_id?: number;
  parent_id?: number;
  country_id?: number;
}

/**
 * Fetch contacts with search/filter and pagination.
 * Uses the salesperson's token for `mine_only` filtering on the backend.
 *
 * GET /api/contacts?q=term&page=1&limit=20&type=all
 */
export async function getContacts(
  params: GetContactsParams = {},
  authToken?: string
): Promise<ContactsListApiResponse> {
  const qp = new URLSearchParams();

  if (params.q) qp.append('q', params.q);
  if (params.page !== undefined) qp.append('page', String(params.page));
  if (params.limit !== undefined) qp.append('limit', String(params.limit));
  if (params.type) qp.append('type', params.type);
  if (params.name) qp.append('name', params.name);
  if (params.email) qp.append('email', params.email);
  if (params.phone) qp.append('phone', params.phone);
  if (params.mobile) qp.append('mobile', params.mobile);

  const qs = qp.toString();
  const endpoint = `/api/contacts${qs ? `?${qs}` : ''}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers });
    return await parseOdooResponse<ContactsListApiResponse>(response, endpoint);
  } catch (error) {
    console.error('[Odoo API] getContacts failed:', error);
    throw error;
  }
}

/**
 * Get a single contact by ID.
 *
 * GET /api/contacts/:id
 */
export async function getContactById(
  contactId: number,
  authToken?: string
): Promise<ContactDetailApiResponse> {
  const endpoint = `/api/contacts/${contactId}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers });
    return await parseOdooResponse<ContactDetailApiResponse>(response, endpoint);
  } catch (error) {
    console.error('[Odoo API] getContactById failed:', error);
    throw error;
  }
}

/**
 * Update an existing contact.
 *
 * PUT /api/contacts/:id
 */
export async function updateContact(
  contactId: number,
  payload: ContactWritePayload,
  authToken?: string
): Promise<ContactUpdateApiResponse> {
  const endpoint = `/api/contacts/${contactId}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    return await parseOdooResponse<ContactUpdateApiResponse>(response, endpoint);
  } catch (error) {
    console.error('[Odoo API] updateContact failed:', error);
    throw error;
  }
}

/**
 * Create a new contact.
 *
 * POST /api/contacts
 */
export async function createContact(
  payload: ContactWritePayload,
  authToken?: string
): Promise<ContactCreateApiResponse> {
  const endpoint = '/api/contacts';
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await parseOdooResponse<ContactCreateApiResponse>(response, endpoint);
  } catch (error) {
    console.error('[Odoo API] createContact failed:', error);
    throw error;
  }
}

// ============================================================================
// Export default company ID for convenience
// ============================================================================

export { DEFAULT_COMPANY_ID };
