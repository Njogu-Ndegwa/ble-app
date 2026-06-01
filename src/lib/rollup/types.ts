export type RollupFileType = 'customer' | 'sale_order' | 'lead';

export type RollupItemKind = 'folder' | 'file';

export type VisibilityPolicy = 'sa_wide' | 'assigned_only';

export interface RollupBreadcrumbSegment {
  sa_id: number;
  name: string;
  account_code?: string | null;
}

export interface RollupPath {
  sa_id: number;
  name: string;
  account_code: string | null;
  account_class: string;
  state: string;
  breadcrumb: RollupBreadcrumbSegment[];
}

export interface RollupSAManager {
  membership_id: number;
  display_name: string;
  partner_id: number;
}

export interface RollupMetrics {
  descendant_sa_count: number;
  customer: number;
  sale_order: number;
  orders_open: number;
  lead: number;
}

export interface RollupFolder {
  kind: 'folder';
  sa_id: number;
  name: string;
  account_code: string | null;
  account_class: 'OVAC' | 'EXTC' | string;
  state: 'active' | 'inactive' | string;
  child_count: number;
  is_global_root: boolean;
  is_app_users_pool: boolean;
}

export interface RollupFile {
  kind: 'file';
  type: RollupFileType;
  model: 'res.partner' | 'sale.order' | 'crm.lead' | string;
  id: number;
  display_name: string;
  assignment_id: number;
}

export interface RollupStack {
  kind: 'stack';
  type: RollupFileType;
  label: string;
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: RollupFile[];
}

export interface RollupFolderListing {
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: RollupFolder[];
}

export interface RollupListing {
  page: number;
  limit: number;
  total: number;
  pages: number;
  folders: RollupFolderListing;
  stacks: RollupStack[];
}

export interface RollupRollup {
  scope: 'subtree';
  sa_ids: number[];
  metrics: RollupMetrics;
}

export interface RollupResponse {
  success: boolean;
  path: RollupPath;
  sa_manager: RollupSAManager | null;
  visibility_policy: VisibilityPolicy;
  rollup: RollupRollup;
  listing: RollupListing;
}

export interface RollupErrorResponse {
  success: false;
  error: string;
}

export interface GetRollupParams {
  saId: number;
  page?: number;
  limit?: number;
  types?: RollupFileType[];
  kind?: RollupItemKind;
}

export type RollupFilterTab = 'all' | 'folders' | 'customers' | 'orders' | 'leads';
