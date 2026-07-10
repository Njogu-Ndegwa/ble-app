// Assembly Cell API types.
//
// Mirrors the backend contract deployed by abs_connector (Build Records on
// mrp.production) and the desktop portal's lib/portal/assembly-types.ts —
// keep the two in sync when the connector contract changes.

export type AssemblyMoState =
  | 'draft'
  | 'confirmed'
  | 'progress'
  | 'to_close'
  | 'done'
  | 'cancel';

export type BuildRecordStatus = 'none' | 'draft' | 'finalized';

export const ASSEMBLY_COMPONENT_KINDS = [
  'chassis',
  'mcu',
  'motor',
  'vcu',
  'other',
] as const;

export type ComponentKind = (typeof ASSEMBLY_COMPONENT_KINDS)[number];

export type AssemblyRef = {
  id: number;
  name: string;
};

export type AssemblyMoRow = {
  id: number;
  name: string;
  state: AssemblyMoState | string;
  product: AssemblyRef | null;
  qty_planned: number;
  qty_produced: number;
  responsible: AssemblyRef | null;
  company: AssemblyRef | null;
  create_date: string;
  // Present from abs_connector >= 18.0.1.24.0. True when this MO has an
  // active ov.sa_production row for the context SA; false on company-scope
  // rows a root-SA manager can see.
  governed_to_context_sa?: boolean;
};

export type AssemblyListScope = 'company' | 'sa_queue';

// context block on the MO list response (>= 18.0.1.24.0). Tells the UI
// whether it is viewing the whole company pool (root SA manager) or one
// SA's queue — and whether the caller is an SA manager.
export type AssemblyListContext = {
  sa_id: number;
  sa_name: string;
  list_scope: AssemblyListScope;
  is_sa_manager: boolean;
};

export type BuildRecordComponent = {
  id?: number;
  component_kind: ComponentKind;
  serial_text: string;
  sequence?: number;
};

export type BuildRecord = {
  available: boolean;
  id?: number | null;
  status: BuildRecordStatus | null;
  mo_id?: number;
  account_id?: number;
  ckd_lot_id?: number | null;
  ckd_lot_serial?: string | null;
  lot_id?: number | null;
  serial?: string | null;
  oem_id?: string | null;
  components?: BuildRecordComponent[];
};

export type PosReadiness = {
  ready: boolean;
  qty_on_hand: number;
  checks: Array<{
    key: string;
    ok: boolean;
    hint?: string;
  }>;
};

export type AssemblyMoDetail = AssemblyMoRow & {
  build_record?: BuildRecord | null;
  pos_readiness?: PosReadiness | null;
  components?: BuildRecordComponent[];
  [key: string]: unknown;
};

export type AssemblyPagination = {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  returned: number;
};

export type AssemblyMoListResponse = {
  success: boolean;
  mos: AssemblyMoRow[];
  pagination: AssemblyPagination;
  context?: AssemblyListContext;
};

export type AssemblyMoDetailResponse = {
  success: boolean;
  mo: AssemblyMoDetail;
  build_record?: BuildRecord | null;
  pos_readiness?: PosReadiness | null;
};

export type AssemblyLookupResponse = {
  success: boolean;
  ckd_lot: string;
  mo: AssemblyMoRow;
  build_record: BuildRecord;
};

export type BuildRecordResponse = {
  success: boolean;
  build_record: BuildRecord;
};

export type SignOffResponse = {
  success: boolean;
  mo_id: number;
  mo_state: AssemblyMoState | string;
  mo_notes: string[];
  lot: {
    id: number;
    serial: string;
    oem_id: string;
    product_id: number;
  };
  build_record: BuildRecord;
  fleet_item: unknown | null;
  pos_readiness: PosReadiness;
};

export type ListAssemblyMosParams = {
  page?: number;
  limit?: number;
  state?: AssemblyMoState | string;
  search?: string;
  product_id?: number;
};

export type OpenBuildRecordBody = {
  ckd_lot_id?: number | null;
  components?: Array<Pick<BuildRecordComponent, 'component_kind' | 'serial_text'>>;
};

export type UpdateBuildRecordBody = {
  ckd_lot_id?: number | null;
  components: Array<Pick<BuildRecordComponent, 'component_kind' | 'serial_text'>>;
};

export type SignOffBody = {
  serial: string;
  oem_id: string;
  govern_lot?: boolean;
  fleet_id?: number | null;
};

export type CreateAssemblyMoBody = {
  product_id: number;
  product_qty: number;
};

// POST /api/assembly/mos. Creates an mrp.production in draft and governs it
// to the SA in X-SA-ID. Callable by staff/agents/managers with an active
// membership on that SA (not anonymous/API-key-only).
export type CreateAssemblyMoResponse = {
  success: boolean;
  mo: AssemblyMoDetail;
  governance?: {
    assignment_id: number;
    sa_id: number;
    sa_name: string;
  };
  build_record?: BuildRecord | null;
};

export type GovernanceProductionAssignment = {
  id: number;
  account_id: number;
  production_id: number;
  state: string;
};

export type GovernProductionResponse = {
  success: boolean;
  assignment?: GovernanceProductionAssignment;
  already_assigned?: boolean;
  [key: string]: unknown;
};

export type GovernedLot = {
  id: number;
  serial?: string;
  name?: string;
  product?: AssemblyRef | null;
  product_id?: number | [number, string];
  [key: string]: unknown;
};
