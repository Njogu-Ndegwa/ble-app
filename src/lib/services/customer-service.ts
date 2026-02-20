/**
 * Customer Service - API functions for customer CRUD operations
 *
 * Wraps the Odoo /api/contacts endpoints and maps the raw API responses
 * to the ExistingCustomer shape consumed by the UI.
 */

import {
  getContacts,
  getContactById as apiGetContactById,
  updateContact as apiUpdateContact,
  createContact as apiCreateContact,
  type OdooContact,
  type ContactWritePayload,
} from '@/lib/odoo-api';

// ============================================================================
// Types
// ============================================================================

export interface ExistingCustomer {
  id: number;
  partnerId: number;
  name: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  city: string;
  zip: string;
  createdAt: string;
  isCompany: boolean;
  companyName: string;
  companyId: number | null;
}

export interface CustomerListResponse {
  success: boolean;
  customers: ExistingCustomer[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerDetailResponse {
  success: boolean;
  customer: ExistingCustomer;
}

export interface CustomerUpdateResponse {
  success: boolean;
  customer: ExistingCustomer;
  message: string;
}

// ============================================================================
// Mapping helper
// ============================================================================

function mapContact(c: OdooContact): ExistingCustomer {
  return {
    id: c.id,
    partnerId: c.id,
    name: c.name || '',
    email: c.email || '',
    phone: c.phone || '',
    mobile: c.mobile || '',
    street: c.street || '',
    city: c.city || '',
    zip: c.zip || '',
    createdAt: c.create_date || '',
    isCompany: c.is_company ?? false,
    companyName: c.company_name || '',
    companyId: c.company_id ?? null,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search customers by name, email, or phone (smart search).
 * Uses GET /api/contacts?q=<query>
 */
export async function searchCustomers(
  query: string,
  authToken: string
): Promise<CustomerListResponse> {
  const trimmed = query.trim();
  const result = await getContacts(
    trimmed ? { q: trimmed } : { limit: 50 },
    authToken
  );

  const customers = result.contacts.map(mapContact);

  return {
    success: true,
    customers,
    total: result.pagination.total_records,
    page: result.pagination.current_page,
    limit: result.pagination.per_page,
  };
}

/**
 * Get all customers with pagination.
 * Uses GET /api/contacts?page=<page>&limit=<limit>&type=all
 */
export async function getAllCustomers(
  page: number = 1,
  limit: number = 20,
  authToken: string
): Promise<CustomerListResponse> {
  const result = await getContacts(
    { page, limit, type: 'all' },
    authToken
  );

  const customers = result.contacts.map(mapContact);

  return {
    success: true,
    customers,
    total: result.pagination.total_records,
    page: result.pagination.current_page,
    limit: result.pagination.per_page,
  };
}

/**
 * Get a single customer by ID.
 * Uses GET /api/contacts/:id
 */
export async function getCustomerById(
  id: number,
  authToken: string
): Promise<CustomerDetailResponse> {
  const result = await apiGetContactById(id, authToken);

  return {
    success: true,
    customer: mapContact(result.contact),
  };
}

/**
 * Update an existing customer.
 * Uses PUT /api/contacts/:id
 */
export async function updateCustomer(
  id: number,
  data: Partial<Omit<ExistingCustomer, 'id' | 'partnerId' | 'createdAt'>>,
  authToken: string
): Promise<CustomerUpdateResponse> {
  const payload: ContactWritePayload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.street !== undefined) payload.street = data.street;
  if (data.city !== undefined) payload.city = data.city;
  if (data.zip !== undefined) payload.zip = data.zip;

  const result = await apiUpdateContact(id, payload, authToken);

  return {
    success: true,
    customer: mapContact(result.contact),
    message: result.message || 'Customer updated successfully',
  };
}

/**
 * Create a new customer/contact.
 * Uses POST /api/contacts
 */
export async function createCustomer(
  data: Omit<ExistingCustomer, 'id' | 'partnerId' | 'createdAt' | 'isCompany' | 'companyName' | 'companyId' | 'mobile'>,
  authToken: string
): Promise<CustomerDetailResponse> {
  const payload: ContactWritePayload = {
    name: data.name,
    email: data.email || undefined,
    phone: data.phone || undefined,
    street: data.street || undefined,
    city: data.city || undefined,
    zip: data.zip || undefined,
  };

  const result = await apiCreateContact(payload, authToken);

  return {
    success: true,
    customer: mapContact(result.contact),
  };
}
