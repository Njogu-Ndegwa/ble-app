// Portal domain types for Orders and Products features

// ============================================================================
// Product Unit Entity
// ============================================================================

export interface ProductUnitEntity {
  id: string;
  name: string;
  sku: string | null;
  listPrice: number | null;
  type: string | null;
  puCategory: string | null;
  puMetric: string | null;
  serviceType: string | null;
  contractType: string | null;
  categoryName: string | null;
  companyId: number | null;
  companyName: string | null;
  currencyName: string | null;
  recurringInvoice: boolean | null;
  saleOk: boolean | null;
  active: boolean;
  imageUrl: string | null;
  description: string | null;
  descriptionSale: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ============================================================================
// Customer Entity
// ============================================================================

export interface CustomerEntity {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  isCompany: boolean;
  companyId: number | null;
  companyName: string | null;
  countryName: string | null;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationMeta {
  currentPage: number;
  perPage: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

// ============================================================================
// Order types
// ============================================================================

export type OrderState = 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'not_paid' | 'partial' | 'paid';

export interface OrderLineEntity {
  id: string;
  productId: number;
  productName: string;
  sku: string | null;
  puCategory: string | null;
  puMetric: string | null;
  serviceType: string | null;
  contractType: string | null;
  description: string | null;
  quantity: number;
  priceUnit: number;
  priceSubtotal: number;
  durationMonths: number | null;
}

export interface OrderInvoiceEntity {
  id: string;
  name: string;
  state: 'draft' | 'posted' | 'cancel';
  amountTotal: number;
  amountResidual: number;
  createdAt: string | null;
}

export interface OrderPaymentEntity {
  id: string;
  amount: number;
  paymentDate: string;
  memo: string | null;
  paymentMethod: string | null;
  transactionRef: string | null;
}

export interface OrderTimelineEvent {
  title: string;
  meta: string;
  description?: string;
  color: 'green' | 'blue' | 'orange' | 'purple' | 'gray';
}

export interface OrderApproval {
  submittedBy: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
}

export interface OrderEntity {
  id: string;
  name: string;
  state: OrderState;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  partnerId: number;
  partnerName: string;
  partnerEmail: string | null;
  partnerPhone: string | null;
  contactPerson: string | null;
  clientOrderRef: string | null;
  channelPartner: string | null;
  salesRepName: string | null;
  salesOutlet: string | null;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceCount: number;
  lines: OrderLineEntity[];
  invoices: OrderInvoiceEntity[];
  payments: OrderPaymentEntity[];
  approval: OrderApproval | null;
  timeline: OrderTimelineEvent[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ============================================================================
// Query/Filter inputs
// ============================================================================

export interface ProductUnitsFilterInput {
  search?: string | null;
  companyId?: number | null;
  puCategory?: string | null;
  puMetric?: string | null;
  serviceType?: string | null;
  contractType?: string | null;
  type?: string | null;
  categoryId?: number | null;
  active?: boolean | null;
  sort?: string | null;
  createdAfter?: string | null;
  createdBefore?: string | null;
  updatedAfter?: string | null;
  updatedBefore?: string | null;
  page?: number | null;
  limit?: number | null;
}

export interface UpdateProductUnitInput {
  name?: string | null;
  listPrice?: number | null;
  type?: string | null;
  puCategory?: string | null;
  puMetric?: string | null;
  serviceType?: string | null;
  contractType?: string | null;
  sku?: string | null;
  description?: string | null;
  descriptionSale?: string | null;
  companyId?: number | null;
  recurringInvoice?: boolean | null;
  saleOk?: boolean | null;
  category?: string | null;
  externalImageUrl?: string | null;
}

// ============================================================================
// Query response types
// ============================================================================

export interface ProductUnitsListResponse {
  productUnits: {
    data: ProductUnitEntity[];
    pagination: PaginationMeta;
  };
}

export interface ProductUnitDetailResponse {
  productUnit: ProductUnitEntity;
}

export interface ProductUnitMutationResponse {
  success: boolean;
  message: string | null;
  productUnit: ProductUnitEntity | null;
}

export interface MutationResponse {
  success: boolean;
  message: string | null;
}

export interface UpdateProductUnitData {
  updateProductUnit: ProductUnitMutationResponse;
}

export interface DeleteProductUnitData {
  deleteProductUnit: MutationResponse;
}

// ============================================================================
// Odoo REST Products API (GET /api/products/categories)
// ============================================================================

export interface OdooProductCategory {
  id: number;
  name: string;
  complete_name: string;
  parent_id: number | null;
  parent_name: string | null;
}

export interface OdooProduct {
  id: number;
  template_id: number;
  name: string;
  default_code: string | null;
  type: string;
  list_price: number;
  sale_ok: boolean;
  active: boolean;
  recurring_invoice: boolean;
  description: string | null;
  description_sale: string | null;
  company_id: number | null;
  company_name: string | null;
  category_id: number;
  category_name: string;
  external_image_url: string | false;
  pu_category: string | false;
  pu_metric: string | false;
  service_type: string | false;
  contract_type: string | false;
  category: OdooProductCategory;
}

export interface OdooCatalogRoot {
  id: number;
  name: string;
  complete_name: string;
}

export interface OdooProductsPagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  offset: number;
  returned: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface OdooProductsResponse {
  success: boolean;
  view: string;
  products: OdooProduct[];
  pagination: OdooProductsPagination;
  catalog_root_ids: number[];
  catalog_roots: OdooCatalogRoot[];
}
