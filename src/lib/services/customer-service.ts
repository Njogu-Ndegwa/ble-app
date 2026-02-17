/**
 * Customer Service - API functions for customer CRUD operations
 * 
 * TODO: Replace dummy data and simulated delays with real Odoo API calls
 * once the backend endpoints are available (e.g., GET /api/contacts, PUT /api/contacts/:id).
 */

// ============================================================================
// Types
// ============================================================================

export interface ExistingCustomer {
  id: number;
  partnerId: number;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  createdAt: string;
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
// Dummy Data
// ============================================================================

const DUMMY_CUSTOMERS: ExistingCustomer[] = [
  { id: 101, partnerId: 201, name: 'Alice Wanjiku', email: 'alice.wanjiku@email.com', phone: '254712345678', street: '12 Kenyatta Ave', city: 'Nairobi', zip: '00100', createdAt: '2025-11-02T08:30:00Z' },
  { id: 102, partnerId: 202, name: 'Brian Ochieng', email: 'brian.ochieng@email.com', phone: '254723456789', street: '45 Moi Road', city: 'Kisumu', zip: '40100', createdAt: '2025-11-05T10:15:00Z' },
  { id: 103, partnerId: 203, name: 'Catherine Muthoni', email: 'catherine.m@email.com', phone: '254734567890', street: '78 Uhuru Highway', city: 'Mombasa', zip: '80100', createdAt: '2025-11-10T14:00:00Z' },
  { id: 104, partnerId: 204, name: 'David Kimani', email: 'david.kimani@email.com', phone: '254745678901', street: '3 Ngong Lane', city: 'Nairobi', zip: '00200', createdAt: '2025-11-15T09:45:00Z' },
  { id: 105, partnerId: 205, name: 'Esther Akinyi', email: 'esther.akinyi@email.com', phone: '254756789012', street: '22 Oginga Odinga St', city: 'Kisumu', zip: '40100', createdAt: '2025-11-20T11:30:00Z' },
  { id: 106, partnerId: 206, name: 'Francis Njoroge', email: 'francis.n@email.com', phone: '254767890123', street: '9 Haile Selassie Ave', city: 'Nairobi', zip: '00100', createdAt: '2025-12-01T07:00:00Z' },
  { id: 107, partnerId: 207, name: 'Grace Nyambura', email: 'grace.nyambura@email.com', phone: '254778901234', street: '15 Digo Road', city: 'Mombasa', zip: '80100', createdAt: '2025-12-05T16:20:00Z' },
  { id: 108, partnerId: 208, name: 'Hassan Ali', email: 'hassan.ali@email.com', phone: '254789012345', street: '33 Biashara St', city: 'Nairobi', zip: '00100', createdAt: '2025-12-10T13:10:00Z' },
  { id: 109, partnerId: 209, name: 'Irene Chebet', email: 'irene.chebet@email.com', phone: '254790123456', street: '7 Nandi Road', city: 'Eldoret', zip: '30100', createdAt: '2025-12-15T08:50:00Z' },
  { id: 110, partnerId: 210, name: 'James Mwangi', email: 'james.mwangi@email.com', phone: '254701234567', street: '50 Kimathi St', city: 'Nairobi', zip: '00100', createdAt: '2025-12-20T10:00:00Z' },
  { id: 111, partnerId: 211, name: 'Karen Wambui', email: 'karen.w@email.com', phone: '254711234567', street: '18 Tom Mboya St', city: 'Nairobi', zip: '00100', createdAt: '2026-01-05T12:30:00Z' },
  { id: 112, partnerId: 212, name: 'Leonard Otieno', email: 'leonard.o@email.com', phone: '254722345678', street: '40 Koinange St', city: 'Nairobi', zip: '00100', createdAt: '2026-01-10T15:45:00Z' },
  { id: 113, partnerId: 213, name: 'Mary Auma', email: 'mary.auma@email.com', phone: '254733456789', street: '5 Kisii Road', city: 'Kisii', zip: '40200', createdAt: '2026-01-15T09:00:00Z' },
  { id: 114, partnerId: 214, name: 'Nicholas Kiprop', email: 'nick.kiprop@email.com', phone: '254744567890', street: '28 Uganda Road', city: 'Eldoret', zip: '30100', createdAt: '2026-01-20T11:15:00Z' },
  { id: 115, partnerId: 215, name: 'Olive Nekesa', email: 'olive.nekesa@email.com', phone: '254755678901', street: '11 Mumias Road', city: 'Kakamega', zip: '50100', createdAt: '2026-02-01T14:30:00Z' },
  { id: 116, partnerId: 216, name: 'Peter Kamau', email: 'peter.kamau@email.com', phone: '254766789012', street: '6 Muindi Mbingu St', city: 'Nairobi', zip: '00100', createdAt: '2026-02-02T09:00:00Z' },
  { id: 117, partnerId: 217, name: 'Queenie Adhiambo', email: 'queenie.a@email.com', phone: '254777890123', street: '14 Nyerere Rd', city: 'Kisumu', zip: '40100', createdAt: '2026-02-03T10:30:00Z' },
  { id: 118, partnerId: 218, name: 'Robert Mutua', email: 'robert.mutua@email.com', phone: '254788901234', street: '21 Mombasa Rd', city: 'Nairobi', zip: '00100', createdAt: '2026-02-04T08:15:00Z' },
  { id: 119, partnerId: 219, name: 'Sarah Njeri', email: 'sarah.njeri@email.com', phone: '254799012345', street: '8 Thika Rd', city: 'Thika', zip: '01000', createdAt: '2026-02-04T11:45:00Z' },
  { id: 120, partnerId: 220, name: 'Thomas Odhiambo', email: 'thomas.o@email.com', phone: '254700123456', street: '31 Jogoo Rd', city: 'Nairobi', zip: '00100', createdAt: '2026-02-05T07:20:00Z' },
  { id: 121, partnerId: 221, name: 'Ursula Wangari', email: 'ursula.w@email.com', phone: '254711345678', street: '17 Langata Rd', city: 'Nairobi', zip: '00509', createdAt: '2026-02-05T14:00:00Z' },
  { id: 122, partnerId: 222, name: 'Victor Juma', email: 'victor.juma@email.com', phone: '254722456789', street: '44 Kisii Highway', city: 'Kisii', zip: '40200', createdAt: '2026-02-06T09:30:00Z' },
  { id: 123, partnerId: 223, name: 'Winnie Moraa', email: 'winnie.m@email.com', phone: '254733567890', street: '2 Kericho Rd', city: 'Kericho', zip: '20200', createdAt: '2026-02-07T12:00:00Z' },
  { id: 124, partnerId: 224, name: 'Xavier Omondi', email: 'xavier.o@email.com', phone: '254744678901', street: '19 Mfangano St', city: 'Nairobi', zip: '00100', createdAt: '2026-02-08T08:45:00Z' },
  { id: 125, partnerId: 225, name: 'Yvonne Kemunto', email: 'yvonne.k@email.com', phone: '254755789012', street: '36 Litein Rd', city: 'Bomet', zip: '20400', createdAt: '2026-02-09T10:10:00Z' },
  { id: 126, partnerId: 226, name: 'Zachary Kiprotich', email: 'zach.k@email.com', phone: '254766890123', street: '10 Eldoret Highway', city: 'Eldoret', zip: '30100', createdAt: '2026-02-09T15:30:00Z' },
  { id: 127, partnerId: 227, name: 'Agnes Wafula', email: 'agnes.wafula@email.com', phone: '254777901234', street: '25 Bungoma Rd', city: 'Bungoma', zip: '50200', createdAt: '2026-02-10T07:00:00Z' },
  { id: 128, partnerId: 228, name: 'Benjamin Korir', email: 'ben.korir@email.com', phone: '254788012345', street: '13 Nandi Hills Rd', city: 'Nandi', zip: '30300', createdAt: '2026-02-10T13:20:00Z' },
  { id: 129, partnerId: 229, name: 'Christine Atieno', email: 'christine.a@email.com', phone: '254799123456', street: '7 Migori Rd', city: 'Migori', zip: '40400', createdAt: '2026-02-11T09:15:00Z' },
  { id: 130, partnerId: 230, name: 'Dennis Kiptoo', email: 'dennis.kiptoo@email.com', phone: '254700234567', street: '42 Naivasha Rd', city: 'Naivasha', zip: '20117', createdAt: '2026-02-12T11:00:00Z' },
  { id: 131, partnerId: 231, name: 'Elizabeth Nyokabi', email: 'elizabeth.n@email.com', phone: '254711456789', street: '16 Nyahururu Rd', city: 'Nyahururu', zip: '20300', createdAt: '2026-02-13T08:30:00Z' },
  { id: 132, partnerId: 232, name: 'Felix Wekesa', email: 'felix.w@email.com', phone: '254722567890', street: '29 Webuye Rd', city: 'Webuye', zip: '50205', createdAt: '2026-02-14T10:45:00Z' },
  { id: 133, partnerId: 233, name: 'Gladys Chepkoech', email: 'gladys.c@email.com', phone: '254733678901', street: '4 Kaptagat Rd', city: 'Eldoret', zip: '30100', createdAt: '2026-02-15T14:15:00Z' },
  { id: 134, partnerId: 234, name: 'Henry Onyango', email: 'henry.onyango@email.com', phone: '254744789012', street: '38 Kondele Rd', city: 'Kisumu', zip: '40100', createdAt: '2026-02-15T16:00:00Z' },
  { id: 135, partnerId: 235, name: 'Isabella Wanjiru', email: 'isabella.w@email.com', phone: '254755890123', street: '11 Gatundu Rd', city: 'Gatundu', zip: '01030', createdAt: '2026-02-16T09:30:00Z' },
];

// In-memory copy so updates persist during session
const customersDb = [...DUMMY_CUSTOMERS];

// ============================================================================
// Helper: Simulate network delay
// ============================================================================

function delay(ms: number = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// API Functions
// TODO: Replace each function body with real fetch() calls to Odoo API
// ============================================================================

/**
 * Search customers by name, email, or phone
 */
export async function searchCustomers(
  query: string,
  _authToken: string
): Promise<CustomerListResponse> {
  await delay(350);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? customersDb.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
    : customersDb;

  return {
    success: true,
    customers: filtered,
    total: filtered.length,
    page: 1,
    limit: filtered.length,
  };
}

/**
 * Get all customers with pagination
 */
export async function getAllCustomers(
  page: number = 1,
  limit: number = 20,
  _authToken: string
): Promise<CustomerListResponse> {
  await delay(400);

  const start = (page - 1) * limit;
  const paged = customersDb.slice(start, start + limit);

  return {
    success: true,
    customers: paged,
    total: customersDb.length,
    page,
    limit,
  };
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(
  id: number,
  _authToken: string
): Promise<CustomerDetailResponse> {
  await delay(300);

  const customer = customersDb.find((c) => c.id === id);
  if (!customer) {
    throw new Error(`Customer with id ${id} not found`);
  }

  return {
    success: true,
    customer,
  };
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  id: number,
  data: Partial<Omit<ExistingCustomer, 'id' | 'partnerId' | 'createdAt'>>,
  _authToken: string
): Promise<CustomerUpdateResponse> {
  await delay(500);

  const index = customersDb.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Customer with id ${id} not found`);
  }

  customersDb[index] = { ...customersDb[index], ...data };

  return {
    success: true,
    customer: customersDb[index],
    message: 'Customer updated successfully',
  };
}

/**
 * Create a new customer (dummy - assigns incremental id)
 * In production this would call registerCustomer from odoo-api.ts
 */
export async function createCustomerDummy(
  data: Omit<ExistingCustomer, 'id' | 'partnerId' | 'createdAt'>,
  _authToken: string
): Promise<CustomerDetailResponse> {
  await delay(500);

  const maxId = customersDb.reduce((max, c) => Math.max(max, c.id), 0);
  const newCustomer: ExistingCustomer = {
    ...data,
    id: maxId + 1,
    partnerId: maxId + 101,
    createdAt: new Date().toISOString(),
  };

  customersDb.unshift(newCustomer);

  return {
    success: true,
    customer: newCustomer,
  };
}
