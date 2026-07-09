// Assembly Cell API client — Build Records on manufacturing orders.
//
// Talks to the abs_connector assembly endpoints (`/api/assembly/mos`,
// governance production assignment, `/api/stock/lots`). Reuses
// `buildOdooHeaders` from odoo-api.ts so we automatically pick up
// X-API-KEY, Authorization (when token passed) and X-SA-ID (the selected
// sales SA — the Production Location this queue is scoped to).
//
// Same shape as tickets-api.ts: the caller threads the sales-role token in.

import { buildOdooHeaders } from './odoo-api';
import type {
  AssemblyLookupResponse,
  AssemblyMoDetailResponse,
  AssemblyMoListResponse,
  BuildRecord,
  BuildRecordResponse,
  GovernProductionResponse,
  GovernedLot,
  ListAssemblyMosParams,
  OpenBuildRecordBody,
  SignOffBody,
  SignOffResponse,
  UpdateBuildRecordBody,
} from './assembly-types';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

export class AssemblyApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'AssemblyApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function parseJson<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let body: any;
    let message = `Server error (HTTP ${response.status})`;
    let code: string | undefined;

    if (isJson) {
      try {
        body = await response.json();
        message = body?.error || body?.message || body?.data?.error || message;
        code = body?.error_code;
      } catch {
        // Keep the default message.
      }
    } else if (response.status === 503) {
      message =
        'Assembly Cell is not available. Upgrade abs_connector to a version that deploys Build Records.';
    }

    console.error(`[assembly-api] ${endpoint} HTTP ${response.status}: ${message}`);
    throw new AssemblyApiError(message, response.status, code, body);
  }

  if (!isJson) {
    throw new AssemblyApiError('Unexpected non-JSON response', response.status);
  }

  const body = (await response.json()) as T & { success?: boolean; error?: string };
  if (body.success === false) {
    throw new AssemblyApiError(body.error || 'Request failed', response.status, undefined, body);
  }
  return body as T;
}

export async function listAssemblyMos(
  params: ListAssemblyMosParams = {},
  authToken?: string,
): Promise<AssemblyMoListResponse> {
  const qp = new URLSearchParams();
  if (params.page !== undefined) qp.set('page', String(params.page));
  if (params.limit !== undefined) qp.set('limit', String(params.limit));
  if (params.state) qp.set('state', params.state);
  if (params.search) qp.set('search', params.search);
  if (params.product_id !== undefined) qp.set('product_id', String(params.product_id));

  const qs = qp.toString();
  const endpoint = `/api/assembly/mos${qs ? `?${qs}` : ''}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  return parseJson<AssemblyMoListResponse>(response, endpoint);
}

export async function lookupAssemblyMoByCkd(
  ckdLot: string,
  authToken?: string,
): Promise<AssemblyLookupResponse> {
  const qp = new URLSearchParams({ ckd_lot: ckdLot });
  const endpoint = `/api/assembly/mos/lookup?${qp.toString()}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  return parseJson<AssemblyLookupResponse>(response, endpoint);
}

export async function getAssemblyMo(
  moId: number,
  authToken?: string,
): Promise<AssemblyMoDetailResponse> {
  const endpoint = `/api/assembly/mos/${moId}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  return parseJson<AssemblyMoDetailResponse>(response, endpoint);
}

export async function openBuildRecord(
  moId: number,
  body: OpenBuildRecordBody = {},
  authToken?: string,
): Promise<BuildRecord> {
  const endpoint = `/api/assembly/mos/${moId}/build-record`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<BuildRecordResponse>(response, endpoint);
  return data.build_record;
}

export async function updateBuildRecord(
  moId: number,
  body: UpdateBuildRecordBody,
  authToken?: string,
): Promise<BuildRecord> {
  const endpoint = `/api/assembly/mos/${moId}/build-record`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<BuildRecordResponse>(response, endpoint);
  return data.build_record;
}

export async function signOffAssembly(
  moId: number,
  body: SignOffBody,
  authToken?: string,
): Promise<SignOffResponse> {
  const endpoint = `/api/assembly/mos/${moId}/sign-off`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify(body),
  });
  return parseJson<SignOffResponse>(response, endpoint);
}

/** Claim an MO into the selected Production Location SA. */
export async function governMoToSa(
  moId: number,
  authToken?: string,
): Promise<GovernProductionResponse> {
  const endpoint = `/api/governance/production/object/${moId}/assign`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: buildOdooHeaders(authToken),
    body: JSON.stringify({}),
  });

  // 409 = already assigned to this SA — treat as success so re-claims are
  // idempotent from the operator's point of view.
  if (response.status === 409) {
    const body = (await response.json().catch(() => ({}))) as GovernProductionResponse;
    return { ...body, success: true, already_assigned: true };
  }

  return parseJson<GovernProductionResponse>(response, endpoint);
}

export async function listGovernedLotsBySerial(
  serial: string,
  authToken?: string,
): Promise<GovernedLot[]> {
  const qp = new URLSearchParams({
    governed_only: '1',
    serial,
    limit: '20',
  });
  const endpoint = `/api/stock/lots?${qp.toString()}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: buildOdooHeaders(authToken),
  });
  const data = await parseJson<{ success: boolean; lots: GovernedLot[] }>(
    response,
    endpoint,
  );
  return data.lots ?? [];
}
