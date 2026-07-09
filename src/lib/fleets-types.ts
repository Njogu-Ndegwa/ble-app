// Fleet API types.
//
// Mirrors the abs_connector fleet contract and the desktop portal's
// lib/portal/fleets-types.ts — keep the two in sync:
//   ov.fleet (fleet) → ov.fleet_item (membership) → stock.lot (serial).
// Visibility is SA-scoped (X-SA-ID) via ov.sa_fleet_assignment.

export type FleetKind =
  | 'rental'
  | 'delivery'
  | 'maintenance_reserve'
  | 'circulation_pool'
  | 'customer_deployment'
  | 'other';

export type FleetState = 'active' | 'inactive';

export type AssociationKind = 'access' | 'assignment' | 'binding';

export type AssociationRole =
  | 'operator'
  | 'maintenance_provider'
  | 'financier'
  | 'legal_owner'
  | 'tracking_manager'
  | 'reference'
  | 'other';

export const FLEET_KIND_OPTIONS: { value: FleetKind; label: string }[] = [
  { value: 'circulation_pool', label: 'Circulation pool' },
  { value: 'rental', label: 'Rental' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'maintenance_reserve', label: 'Maintenance reserve' },
  { value: 'customer_deployment', label: 'Customer deployment' },
  { value: 'other', label: 'Other' },
];

export const ASSOCIATION_KIND_OPTIONS: { value: AssociationKind; label: string }[] = [
  { value: 'binding', label: 'Binding (full ownership)' },
  { value: 'assignment', label: 'Assignment (can assign serials)' },
  { value: 'access', label: 'Access (read-only)' },
];

export const ASSOCIATION_ROLE_OPTIONS: { value: AssociationRole; label: string }[] = [
  { value: 'operator', label: 'Operator' },
  { value: 'maintenance_provider', label: 'Maintenance provider' },
  { value: 'financier', label: 'Financier' },
  { value: 'legal_owner', label: 'Legal owner' },
  { value: 'tracking_manager', label: 'Tracking manager' },
  { value: 'reference', label: 'Reference' },
  { value: 'other', label: 'Other' },
];

export function fleetKindLabel(kind: FleetKind | string): string {
  return (
    FLEET_KIND_OPTIONS.find((o) => o.value === kind)?.label ??
    String(kind).replace(/_/g, ' ')
  );
}

// Odoo serialises empty many2one/char fields as `false`, hence `| false`.
export interface FleetRow {
  id: number;
  name: string;
  code: string | false;
  external_ref: string | false;
  fleet_kind: FleetKind;
  state: FleetState;
  company_id: [number, string] | false;
  partner_id: [number, string] | false;
  note: string | false;
  item_count: number;
  create_date?: string | false;
  write_date?: string | false;
}

export interface FleetItemLot {
  id: number;
  serial: string;
  product: { id: number; name: string } | null;
}

export interface FleetItem {
  id: number;
  fleet_id: number;
  state: 'active' | 'expired';
  date_from: string;
  date_to: string | false;
  lot: FleetItemLot | null;
}

export interface FleetsPagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  returned: number;
}

export interface FleetListResponse {
  success: true;
  fleets: FleetRow[];
  pagination: FleetsPagination;
}

export interface FleetResponse {
  success: true;
  fleet: FleetRow;
}

export interface FleetItemsResponse {
  success: true;
  items: FleetItem[];
}

export interface FleetItemResponse {
  success: true;
  item: FleetItem;
}

export interface ListFleetsParams {
  page?: number;
  limit?: number;
  search?: string;
  fleet_kind?: FleetKind;
  state?: FleetState;
}

export interface FleetCreateBody {
  name: string;
  external_ref?: string;
  fleet_kind?: FleetKind;
  association_kind?: AssociationKind;
  association_role?: AssociationRole;
  note?: string;
}

export interface FleetUpdateBody {
  name?: string;
  external_ref?: string;
  fleet_kind?: FleetKind;
  note?: string;
}

// ---------------------------------------------------------------------------
// Serials (stock.lot)
// ---------------------------------------------------------------------------

export interface LotRow {
  id: number;
  /** Serial number (the lot name). */
  serial: string;
  product: { id: number; name: string } | null;
}

export interface ListLotsParams {
  serial?: string;
  limit?: number;
  /** Defaults to 1 (SA-governed serials only) on JWT calls. */
  governed_only?: 0 | 1;
}

// ---------------------------------------------------------------------------
// Governance actors
// ---------------------------------------------------------------------------

export interface FleetActor {
  partnerId: number;
  name: string;
  isPrimary: boolean;
}
