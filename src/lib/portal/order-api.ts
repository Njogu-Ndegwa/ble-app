import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getSAIdForHeaders } from '@/lib/sa-auth';
import type {
  OrderEntity,
  OrderLineEntity,
  OrderInvoiceEntity,
  OrderPaymentEntity,
  OrderApproval,
  OrderTimelineEvent,
  PaginationMeta,
  MutationResponse,
  PaymentStatus,
} from './types';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

const ODOO_API_KEY =
  process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024';

const MAX_RETRIES = 2;
const BASE_DELAY = 1000;

// ============================================================================
// Network helpers
// ============================================================================

function buildHeaders(): HeadersInit {
  const token = getSalesRoleToken();
  const saId = getSAIdForHeaders('sales');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (saId) headers['X-SA-ID'] = saId;
  return headers;
}

async function fetchRetry(
  url: string,
  options: RequestInit,
  attempt = 0,
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt));
    return fetchRetry(url, options, attempt + 1);
  }
}

async function parseResponse<T>(response: Response, endpoint: string): Promise<T> {
  if (!response.ok) {
    let msg = `Server error (HTTP ${response.status})`;
    try {
      const err = await response.json();
      msg = err?.data?.error || err?.error || err?.message || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  const text = await response.text();
  if (!text) throw new Error(`Empty response from ${endpoint}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${endpoint}`);
  }
}

function authHeaders(): HeadersInit {
  return buildHeaders();
}

// ============================================================================
// Formatting
// ============================================================================

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// Snake-to-camel mappers
// ============================================================================

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function mapTimeline(raw: any[]): OrderTimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => ({
    title: e.title ?? '',
    meta: e.meta ?? '',
    description: e.description,
    color: e.color ?? 'gray',
  }));
}

function buildTimelineFromOrder(order: OrderEntity): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];

  if (order.createdAt) {
    events.push({
      title: 'Quotation Created',
      meta: fmtDate(order.createdAt),
      description: `${order.name} for ${order.partnerName}`,
      color: 'blue',
    });
  }

  if (order.state !== 'draft') {
    events.push({
      title: 'Quotation Sent',
      meta: fmtDate(order.updatedAt),
      description: `Sent to ${order.partnerName}`,
      color: 'blue',
    });
  }

  if (order.state === 'sale' || order.state === 'done') {
    events.push({
      title: 'Order Confirmed',
      meta: fmtDate(order.updatedAt),
      description: `Confirmed as Sales Order ${order.name}`,
      color: 'green',
    });
  }

  if (order.approval?.submittedAt) {
    events.push({
      title: 'Approval Requested',
      meta: fmtDate(order.approval.submittedAt),
      description: `Submitted by ${order.approval.submittedBy}`,
      color: 'orange',
    });
  }

  if (order.approvalStatus === 'approved' && order.approval?.approvedAt) {
    events.push({
      title: 'Order Approved',
      meta: fmtDate(order.approval.approvedAt),
      description: `Approved by ${order.approval.approvedBy ?? 'Manager'}`,
      color: 'green',
    });
  }

  if (order.approvalStatus === 'rejected') {
    events.push({
      title: 'Order Rejected',
      meta: fmtDate(order.approval?.approvedAt),
      description: order.approval?.notes ?? 'Rejected by approver',
      color: 'gray',
    });
  }

  for (const pay of order.payments) {
    events.push({
      title: 'Payment Received',
      meta: fmtDate(pay.paymentDate),
      description: `${formatCurrency(pay.amount)}${pay.paymentMethod ? ` via ${pay.paymentMethod}` : ''}`,
      color: 'green',
    });
  }

  for (const inv of order.invoices) {
    events.push({
      title: `Invoice ${inv.name} Created`,
      meta: fmtDate(inv.createdAt),
      description: `Amount: ${formatCurrency(inv.amountTotal)}`,
      color: 'purple',
    });
  }

  if (order.state === 'done') {
    events.push({
      title: 'Order Completed',
      meta: fmtDate(order.updatedAt),
      description: 'All steps finalized',
      color: 'green',
    });
  }

  return events;
}

function mapApproval(raw: any): OrderApproval | null {
  if (!raw) return null;
  return {
    submittedBy: raw.submitted_by ?? raw.submittedBy ?? '',
    submittedAt: raw.submitted_at ?? raw.submittedAt ?? null,
    approvedBy: raw.approved_by ?? raw.approvedBy ?? null,
    approvedAt: raw.approved_at ?? raw.approvedAt ?? null,
    notes: raw.notes ?? null,
  };
}

function buildApprovalFromFlat(raw: any): OrderApproval | null {
  const hasData =
    raw.approved_by_name || raw.approved_by_id || raw.approval_date || raw.approval_notes;
  if (!hasData) return null;
  return {
    submittedBy: raw.actor_name ?? raw.sales_rep_name ?? '',
    submittedAt: raw.date_order ?? null,
    approvedBy: raw.approved_by_name ?? null,
    approvedAt: raw.approval_date ?? null,
    notes: raw.approval_notes ?? null,
  };
}

function mapPayment(raw: any): OrderPaymentEntity {
  return {
    id: String(raw.id),
    amount: raw.amount ?? 0,
    paymentDate: raw.payment_date ?? raw.paymentDate ?? '',
    memo: raw.memo ?? null,
    paymentMethod: raw.payment_method ?? raw.paymentMethod ?? null,
    transactionRef: raw.transaction_ref ?? raw.transactionRef ?? null,
  };
}

function mapInvoice(raw: any): OrderInvoiceEntity {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    state: raw.state ?? 'draft',
    amountTotal: raw.amount_total ?? raw.amountTotal ?? 0,
    amountResidual: raw.amount_residual ?? raw.amountResidual ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? raw.create_date ?? null,
  };
}

function mapLine(raw: any): OrderLineEntity {
  return {
    id: String(raw.id),
    productId: raw.product_id ?? raw.productId ?? 0,
    productName: raw.product_name ?? raw.productName ?? '',
    sku: raw.sku ?? raw.default_code ?? null,
    puCategory: raw.pu_category || raw.puCategory || null,
    puMetric: raw.pu_metric || raw.puMetric || null,
    serviceType: raw.service_type || raw.serviceType || null,
    contractType: raw.contract_type || raw.contractType || null,
    description: raw.description || null,
    quantity: raw.quantity ?? 0,
    priceUnit: raw.price_unit ?? raw.priceUnit ?? 0,
    priceSubtotal: raw.price_subtotal ?? raw.priceSubtotal ?? 0,
    durationMonths: raw.duration_months ?? raw.durationMonths ?? null,
  };
}

function mapOrder(raw: any): OrderEntity {
  const partner = raw.partner ?? {};
  const order: OrderEntity = {
    id: String(raw.id),
    name: raw.name ?? '',
    state: raw.state ?? 'draft',
    approvalStatus: (['pending', 'approved', 'rejected'].includes(
      raw.approval_status ?? raw.approvalStatus,
    )
      ? (raw.approval_status ?? raw.approvalStatus)
      : 'none') as OrderEntity['approvalStatus'],
    paymentStatus: raw.payment_status ?? raw.paymentStatus ?? 'not_paid',
    partnerId: raw.partner_id ?? raw.partnerId ?? 0,
    partnerName: raw.partner_name ?? raw.partnerName ?? partner.name ?? '',
    partnerEmail: raw.partner_email ?? raw.partnerEmail ?? partner.email ?? null,
    partnerPhone:
      raw.partner_phone ?? raw.partnerPhone ?? partner.phone ?? partner.mobile ?? null,
    contactPerson: raw.contact_person ?? raw.contactPerson ?? null,
    clientOrderRef: raw.client_order_ref ?? raw.clientOrderRef ?? null,
    channelPartner:
      raw.channel_partner ?? raw.channel_partner_name ?? raw.channelPartner ?? null,
    salesRepName: raw.sales_rep_name ?? raw.salesRepName ?? null,
    salesOutlet: raw.sales_outlet ?? raw.outlet_name ?? raw.salesOutlet ?? null,
    amountUntaxed: raw.amount_untaxed ?? raw.amountUntaxed ?? 0,
    amountTax: raw.amount_tax ?? raw.amountTax ?? 0,
    amountTotal: raw.amount_total ?? raw.amountTotal ?? 0,
    paidAmount: raw.paid_amount ?? raw.paidAmount ?? 0,
    remainingAmount: raw.remaining_amount ?? raw.remainingAmount ?? 0,
    invoiceCount: raw.invoice_count ?? raw.invoiceCount ?? 0,
    lines: Array.isArray(raw.lines ?? raw.order_lines)
      ? (raw.lines ?? raw.order_lines).map(mapLine)
      : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices.map(mapInvoice) : [],
    payments: Array.isArray(raw.payments) ? raw.payments.map(mapPayment) : [],
    approval: mapApproval(raw.approval) ?? buildApprovalFromFlat(raw),
    timeline: [],
    createdAt:
      raw.created_at ?? raw.createdAt ?? raw.create_date ?? raw.date_order ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? raw.write_date ?? null,
  };

  const backendTimeline = mapTimeline(raw.timeline);
  order.timeline =
    backendTimeline.length > 0 ? backendTimeline : buildTimelineFromOrder(order);
  return order;
}

function mapPagination(raw: any): PaginationMeta {
  return {
    currentPage: raw.current_page ?? raw.currentPage ?? 1,
    perPage: raw.per_page ?? raw.perPage ?? 10,
    totalRecords: raw.total_records ?? raw.totalRecords ?? 0,
    totalPages: raw.total_pages ?? raw.totalPages ?? 1,
    hasNextPage: raw.has_next_page ?? raw.hasNextPage ?? false,
    hasPreviousPage: raw.has_previous_page ?? raw.hasPreviousPage ?? false,
    nextPage: raw.next_page ?? raw.nextPage ?? null,
    previousPage: raw.previous_page ?? raw.previousPage ?? null,
  };
}

// ============================================================================
// Public API
// ============================================================================

export interface GetOrdersParams {
  search?: string;
  state?: string;
  approval_status?: string;
  payment_status?: string;
  created_after?: string;
  created_before?: string;
  sort?: string;
  amount_min?: number;
  amount_max?: number;
  mine?: boolean;
  page?: number;
  limit?: number;
}

export interface OrdersListResult {
  data: OrderEntity[];
  pagination: PaginationMeta;
}

export async function getOrders(
  params: GetOrdersParams = {},
): Promise<OrdersListResult> {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.state) qp.append('state', params.state);
  if (params.approval_status) qp.append('approval_status', params.approval_status);
  if (params.payment_status) qp.append('payment_status', params.payment_status);
  if (params.created_after) qp.append('created_after', params.created_after);
  if (params.created_before) qp.append('created_before', params.created_before);
  if (params.sort) qp.append('sort', params.sort);
  if (params.amount_min !== undefined) qp.append('amount_min', String(params.amount_min));
  if (params.amount_max !== undefined) qp.append('amount_max', String(params.amount_max));
  if (params.mine) qp.append('mine', 'true');
  if (params.page !== undefined) qp.append('page', String(params.page));
  if (params.limit !== undefined) qp.append('limit', String(params.limit));

  const qs = qp.toString();
  const endpoint = `/api/orders${qs ? `?${qs}` : ''}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, { method: 'GET', headers: authHeaders() });
  const raw = await parseResponse<any>(response, endpoint);

  const rawOrders = raw.orders ?? raw.data ?? [];
  return {
    data: rawOrders.map(mapOrder),
    pagination: mapPagination(raw.pagination ?? {}),
  };
}

export async function getOrder(orderId: number): Promise<OrderEntity> {
  const endpoint = `/api/orders/${orderId}`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, { method: 'GET', headers: authHeaders() });
  const raw = await parseResponse<any>(response, endpoint);

  const orderData = raw.order ?? raw;
  return mapOrder(orderData);
}

export interface CreateQuotationInput {
  customer_id: number;
  company_id?: number;
  client_order_ref?: string;
  note?: string;
  products?: {
    product_id: number;
    quantity: number;
    price_unit: number;
    description?: string;
  }[];
}

export async function createQuotation(
  input: CreateQuotationInput,
): Promise<{ success: boolean; order: OrderEntity; message?: string }> {
  const endpoint = '/api/quotations';
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const body: Record<string, unknown> = { customer_id: input.customer_id };
  if (input.company_id) body.company_id = input.company_id;
  if (input.client_order_ref) body.client_order_ref = input.client_order_ref;
  if (input.note) body.note = input.note;
  if (input.products?.length) body.products = input.products;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = await parseResponse<any>(response, endpoint);

  const orderData = raw.order ?? raw.quotation ?? {};
  return {
    success: raw.success,
    order: mapOrder(orderData),
    message: raw.message,
  };
}

export async function sendOrder(orderId: number): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/send`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ send_email: false }),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}

export async function confirmOrder(orderId: number): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/confirm`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}

export async function requestApproval(orderId: number): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/request-approval`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}

export async function approveOrder(
  orderId: number,
  notes?: string,
): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/approve`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const body: Record<string, unknown> = {};
  if (notes) body.notes = notes;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}

export async function rejectOrder(
  orderId: number,
  notes?: string,
): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/reject`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const body: Record<string, unknown> = {};
  if (notes) body.notes = notes;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}

export interface RegisterPaymentResult extends MutationResponse {
  payment?: OrderPaymentEntity;
  invoice?: OrderInvoiceEntity;
  orderPaymentStatus?: string;
  paidAmount?: number;
  remainingAmount?: number;
}

export async function registerPayment(
  orderId: number,
  amount: number,
  memo?: string,
): Promise<RegisterPaymentResult> {
  const endpoint = `/api/orders/${orderId}/register-payment`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const body: Record<string, unknown> = { amount };
  if (memo) body.memo = memo;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = await parseResponse<any>(response, endpoint);

  const result: RegisterPaymentResult = {
    success: raw.success,
    message: raw.message ?? null,
  };

  if (raw.payment) {
    result.payment = {
      id: String(raw.payment.id ?? Date.now()),
      amount: raw.payment.amount ?? amount,
      paymentDate: raw.payment.date ?? new Date().toISOString().split('T')[0],
      memo: raw.payment.memo ?? memo ?? null,
      paymentMethod: raw.payment.journal ?? null,
      transactionRef: null,
    };
  }

  if (raw.invoice) {
    result.invoice = mapInvoice(raw.invoice);
    result.paidAmount =
      (raw.invoice.amount_total ?? 0) - (raw.invoice.amount_residual ?? 0);
    result.remainingAmount = raw.invoice.amount_residual ?? 0;
  }

  if (raw.order_payment_status) {
    result.orderPaymentStatus = raw.order_payment_status;
  }

  return result;
}

export async function getProformaPdf(
  orderId: number,
): Promise<{ filename: string; contentType: string; base64: string } | null> {
  const endpoint = `/api/orders/${orderId}/proforma-pdf`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, { method: 'GET', headers: authHeaders() });
  const raw = await parseResponse<any>(response, endpoint);

  if (!raw.base64) return null;
  return {
    filename: raw.filename ?? `proforma-${orderId}.pdf`,
    contentType: raw.content_type ?? 'application/pdf',
    base64: raw.base64,
  };
}

// ============================================================================
// Price Lists
// ============================================================================

export interface OdooPriceListItem {
  id: number;
  name: string;
  currency_id?: number;
  currency?: string;
  active?: boolean;
  [key: string]: unknown;
}

export async function getPriceLists(): Promise<OdooPriceListItem[]> {
  const endpoint = '/api/pricelists';
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, { method: 'GET', headers: authHeaders() });
  const raw = await parseResponse<any>(response, endpoint);

  const list = raw.pricelists ?? raw.data ?? raw.results ?? raw;
  return Array.isArray(list) ? list : [];
}

export async function sendProformaPdf(orderId: number): Promise<MutationResponse> {
  const endpoint = `/api/orders/${orderId}/send-proforma`;
  const url = `${ODOO_BASE_URL}${endpoint}`;

  const response = await fetchRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const raw = await parseResponse<any>(response, endpoint);
  return { success: raw.success, message: raw.message ?? null };
}
