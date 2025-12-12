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
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };

  // Add Authorization header if token is provided (for company-specific plans)
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, { method: 'GET', headers });
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
    const response = await fetch(url, {
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
    const response = await fetch(url, {
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
// Session Management Types & API
// ============================================================================

/**
 * Session type for workflow tracking
 */
export type SessionType = 'SALES_REGISTRATION' | 'ATTENDANT_SWAP';

/**
 * Session status
 */
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled' | 'expired';

/**
 * Recovery summary for session resumption display
 */
export interface SessionRecoverySummary {
  customer_name: string;
  customer_phone?: string;
  current_step: number;
  current_step_name: string;
  max_step_reached: number;
  last_action: string;
  last_action_at: string;
  time_elapsed: string;
  package_name?: string;
  plan_name?: string;
  total_amount?: number;
  amount_paid?: number;
  currency_symbol: string;
  subscription_code?: string;
  can_resume: boolean;
  resume_warnings?: string[];
}

/**
 * Actor info for session tracking
 */
export interface SessionActor {
  type: 'attendant' | 'salesperson';
  id: string;
  name: string;
  station?: string;
  company_id: number;
}

/**
 * Device info for session tracking
 */
export interface SessionDeviceInfo {
  device_id?: string;
  app_version?: string;
  platform?: string;
  locale?: string;
}

/**
 * Flow state for tracking progress
 */
export interface SessionFlowState {
  current_step: number;
  max_step_reached: number;
  total_steps: number;
}

/**
 * Timeline step status
 */
export interface SessionTimelineStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string | null;
}

/**
 * Complete session data structure for persistence
 */
export interface SessionData {
  // Session metadata
  session_id: string;
  session_type: SessionType;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  
  // For UI display when selecting sessions
  recovery_summary: SessionRecoverySummary;
  
  // Device & actor info
  device_info?: SessionDeviceInfo;
  actor: SessionActor;
  
  // Flow progress
  flow_state: SessionFlowState;
  
  // Timeline of steps
  timeline: Record<string, SessionTimelineStep>;
  
  // Step-specific data (step_1_data, step_2_data, etc.)
  [key: `step_${number}_data`]: Record<string, unknown>;
}

/**
 * Session list item for display in session picker
 */
export interface SessionListItem {
  id: number;
  order_id: number;
  order_name: string;
  session_type: SessionType;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  recovery_summary: SessionRecoverySummary;
  subscription_code?: string;
  customer_name: string;
  current_step: number;
  can_resume: boolean;
}

/**
 * Response from get session by order ID
 */
export interface GetSessionResponse {
  success: boolean;
  message?: string;
  session?: {
    id: number;
    order_id: number;
    order_name: string;
    session_data: SessionData;
    created_at: string;
    updated_at: string;
    status: SessionStatus;
  };
}

/**
 * Response from update session
 */
export interface UpdateSessionResponse {
  success: boolean;
  message?: string;
  session?: {
    id: number;
    order_id: number;
    updated_at: string;
  };
}

/**
 * Response from list sessions
 */
export interface ListSessionsResponse {
  success: boolean;
  message?: string;
  sessions: SessionListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Parameters for listing sessions
 */
export interface ListSessionsParams {
  subscription_code?: string;
  session_type?: SessionType;
  status?: SessionStatus | 'all';
  page?: number;
  limit?: number;
}

/**
 * Get session data by order ID
 * 
 * @param orderId - The order ID linked to the session
 * @param authToken - Employee JWT token for authorization
 */
export async function getSessionByOrderId(
  orderId: number,
  authToken?: string
): Promise<GetSessionResponse> {
  const url = `${ODOO_BASE_URL}/api/sessions/by-order/${orderId}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== GET SESSION BY ORDER ID ===');
  console.info('URL:', url);
  
  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data: GetSessionResponse = await response.json();
    
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Get session failed:', data);
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Get session error:', error);
    throw error;
  }
}

/**
 * Update session data by order ID
 * Note: This replaces the entire session_data JSON, so include all fields to preserve
 * 
 * @param orderId - The order ID linked to the session
 * @param sessionData - Complete session data to save
 * @param authToken - Employee JWT token for authorization
 */
export async function updateSessionByOrderId(
  orderId: number,
  sessionData: SessionData,
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
  
  const payload = { session_data: sessionData };
  
  console.info('=== UPDATE SESSION BY ORDER ID ===');
  console.info('URL:', url);
  console.info('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data: UpdateSessionResponse = await response.json();
    
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Update session failed:', data);
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Update session error:', error);
    throw error;
  }
}

/**
 * List sessions with optional filters
 * Allows searching by subscription code, filtering by type and status
 * 
 * @param params - Filter parameters
 * @param authToken - Employee JWT token for authorization
 */
export async function listSessions(
  params: ListSessionsParams = {},
  authToken?: string
): Promise<ListSessionsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params.subscription_code) {
    queryParams.append('subscription_code', params.subscription_code);
  }
  if (params.session_type) {
    queryParams.append('session_type', params.session_type);
  }
  if (params.status && params.status !== 'all') {
    queryParams.append('status', params.status);
  }
  if (params.page) {
    queryParams.append('page', String(params.page));
  }
  if (params.limit) {
    queryParams.append('limit', String(params.limit));
  }
  
  const url = `${ODOO_BASE_URL}/api/sessions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.info('=== LIST SESSIONS ===');
  console.info('URL:', url);
  
  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data: ListSessionsResponse = await response.json();
    
    console.info('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('List sessions failed:', data);
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('List sessions error:', error);
    throw error;
  }
}

// ============================================================================
// Export default company ID for convenience
// ============================================================================

export { DEFAULT_COMPANY_ID };
