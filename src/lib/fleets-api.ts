// Fleet API client — asset fleets and their serial memberships.
//
// Talks to the abs_connector fleet endpoints (`/api/fleets`, `/api/stock/lots`,
// fleet governance actors). Reuses `buildOdooHeaders` from odoo-api.ts so we
// automatically pick up X-API-KEY, Authorization (when token passed) and
// X-SA-ID (the selected sales SA).
//
// Same shape as tickets-api.ts: the caller threads the sales-role token in.
//
// Query direction matters: visibility flows SA → fleet → fleet_item → lot.
// Never list all lots and filter client-side.

import { buildOdooHeaders } from './odoo-api';
import type {
  FleetActor,
  FleetCreateBody,
  FleetItem,
  FleetItemResponse,
  FleetItemsResponse,
  FleetListResponse,
  FleetResponse,
  FleetRow,
  FleetUpdateBody,
  ListFleetsParams,
  ListLotsParams,
  LotRow,
} from './fleets-types';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

export class FleetsApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FleetsApiError';
    this.status = status;
  }
}

async function parseJson<T>(response: Response, endpoint: string): Promise<T> {
  const isJson = (response.headers.get('content-type') || '').includes('application/json');

  if (!response.ok) {
    let message = `Server error (HTTP ${response.status})`;
    if (isJson) {
      try {
        const body = await response.json();
        message = body?.error || body?.message || body?.data?.error || message;
      } catch {
        // ignore — keep default message
      }
    }
    console.error(`[fleets-api] ${endpoint} HTTP ${response.status}: ${message}`);
    throw new FleetsApiError(message, response.status);
  }

  if (!isJson) {
    throw new FleetsApiError('Unexpected non-JSON response', response.status);
  }

  const body = (await response.json()) as T & { success?: boolean; error?: string };
  if (body.success === false) {
    throw new FleetsApiError(body.error || 'Request failed', response.status);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Fleets — list / get / create / update / deactivate
// ---------------------------------------------------------------------------

export async function listFleets(
  params: ListFleetsParams = {},
  authToken?: string,
): Promise<FleetListResponse> {
  const qp = new URLSearchParams();
  if (params.page !== undefined) qp.set('page', String(params.page));
  if (params.limit !== undefined) qp.set('limit', String(params.limit));
  if (params.search) qp.set('search', params.search);
  if (params.fleet_kind) qp.set('fleet_kind', params.fleet_kind);
  if (params.state) qp.set('state', params.state);

  const qs = qp.toString();
  const endpoint = `/api/fleets${qs ? `?${qs}` : ''}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  return parseJson<FleetListResponse>(response, endpoint);
}

export async function getFleet(id: number, authToken?: string): Promise<FleetRow> {
  const endpoint = `/api/fleets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<FleetResponse>(response, endpoint);
  return data.fleet;
}

/** Creates the fleet AND its ov.sa_fleet_assignment for the selected SA. */
export async function createFleet(
  body: FleetCreateBody,
  authToken?: string,
): Promise<FleetRow> {
  const endpoint = '/api/fleets';
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<FleetResponse>(response, endpoint);
  return data.fleet;
}

export async function updateFleet(
  id: number,
  body: FleetUpdateBody,
  authToken?: string,
): Promise<FleetRow> {
  const endpoint = `/api/fleets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<FleetResponse>(response, endpoint);
  return data.fleet;
}

/** Soft delete — the backend flips the fleet to state=inactive. */
export async function deactivateFleet(id: number, authToken?: string): Promise<void> {
  const endpoint = `/api/fleets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: buildOdooHeaders(authToken),
  });
  await parseJson<{ success: true }>(response, endpoint);
}

/** Resolve a fleet by its stable external reference (ABS/ARM bridge). */
export async function lookupFleetByExternalRef(
  externalRef: string,
  authToken?: string,
): Promise<FleetRow> {
  const endpoint = `/api/fleets/lookup?external_ref=${encodeURIComponent(externalRef)}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<FleetResponse>(response, endpoint);
  return data.fleet;
}

// ---------------------------------------------------------------------------
// Fleet items — serial memberships
// ---------------------------------------------------------------------------

export async function listFleetItems(
  fleetId: number,
  authToken?: string,
): Promise<FleetItem[]> {
  const endpoint = `/api/fleets/${fleetId}/items`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<FleetItemsResponse>(response, endpoint);
  return data.items;
}

/** Requires association_kind ≥ assignment on the fleet (not access-only). */
export async function addFleetItem(
  fleetId: number,
  lotId: number,
  authToken?: string,
): Promise<FleetItem> {
  const endpoint = `/api/fleets/${fleetId}/items`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify({ lot_id: lotId }),
  });
  const data = await parseJson<FleetItemResponse>(response, endpoint);
  return data.item;
}

/** Ends the membership (expires the row); the lot itself is untouched. */
export async function removeFleetItem(
  fleetId: number,
  lotId: number,
  authToken?: string,
): Promise<void> {
  const endpoint = `/api/fleets/${fleetId}/items/${lotId}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: buildOdooHeaders(authToken),
  });
  await parseJson<{ success: true }>(response, endpoint);
}

// ---------------------------------------------------------------------------
// Serials (stock.lot)
// ---------------------------------------------------------------------------

// Lot payloads vary slightly between endpoints (`name` vs `serial`, `product`
// object vs `product_id` tuple) — normalise here.
function mapLot(raw: Record<string, any>): LotRow {
  let product: LotRow['product'] = null;
  if (raw.product && typeof raw.product === 'object') {
    product = { id: raw.product.id, name: raw.product.name ?? '' };
  } else if (Array.isArray(raw.product_id)) {
    product = { id: raw.product_id[0], name: raw.product_id[1] ?? '' };
  } else if (typeof raw.product_id === 'number') {
    product = { id: raw.product_id, name: raw.product_name ?? '' };
  }
  return {
    id: raw.id,
    serial: raw.serial ?? raw.name ?? '',
    product,
  };
}

/** Governed serial search — only serials visible to the selected SA. */
export async function listLots(
  params: ListLotsParams = {},
  authToken?: string,
): Promise<LotRow[]> {
  const qp = new URLSearchParams();
  qp.set('governed_only', String(params.governed_only ?? 1));
  if (params.serial) qp.set('serial', params.serial);
  if (params.limit !== undefined) qp.set('limit', String(params.limit));

  const endpoint = `/api/stock/lots?${qp.toString()}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<{ success: true; lots: Record<string, any>[] }>(
    response,
    endpoint,
  );
  return (data.lots ?? []).map(mapLot);
}

/** Exact lookup by serial name. Throws FleetsApiError(404) when unknown. */
export async function getLotBySerial(
  serial: string,
  authToken?: string,
): Promise<LotRow> {
  const endpoint = `/api/stock/lots/${encodeURIComponent(serial)}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<Record<string, any>>(response, endpoint);
  const raw = data.lot ?? (Array.isArray(data.lots) ? data.lots[0] : undefined);
  if (!raw) throw new FleetsApiError('Serial not found', 404);
  return mapLot(raw);
}

/**
 * Register a new serial. Does NOT assign governance — the lot only becomes
 * visible to the SA once added to one of its fleets (SOP: lot first, then
 * assign via addFleetItem).
 */
export async function createLot(
  productId: number,
  serial: string,
  authToken?: string,
): Promise<LotRow> {
  const endpoint = '/api/stock/lots';
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify({ product_id: productId, name: serial }),
  });
  const data = await parseJson<{ success: true; lot: Record<string, any> }>(
    response,
    endpoint,
  );
  return mapLot(data.lot);
}

// ---------------------------------------------------------------------------
// Governance actors (who operates this fleet) — read-only panel
// ---------------------------------------------------------------------------

// Tolerant to the exact field names the API returns (same as ticket actors).
function mapActor(a: Record<string, any>): FleetActor {
  const partnerId = a.actor_partner_id ?? a.partner_id ?? a.id;
  return {
    partnerId,
    name: a.name ?? a.display_name ?? a.partner_name ?? `Partner #${partnerId}`,
    isPrimary: Boolean(a.is_primary ?? a.primary ?? false),
  };
}

export async function listFleetActors(
  fleetId: number,
  authToken?: string,
): Promise<FleetActor[]> {
  const endpoint = `/api/governance/fleet/object/${fleetId}/actors`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const body = await parseJson<Record<string, any>>(response, endpoint);
  const arr = (body.actors ?? body.data ?? body.result ?? []) as unknown;
  return Array.isArray(arr) ? arr.map(mapActor) : [];
}
