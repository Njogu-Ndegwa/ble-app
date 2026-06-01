import { getSalesRoleToken } from '@/lib/attendant-auth';
import type { RollupResponse, GetRollupParams } from './types';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

const ODOO_API_KEY =
  process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024';

const MAX_RETRIES = 2;
const BASE_DELAY = 1000;

function buildHeaders(): HeadersInit {
  const token = getSalesRoleToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
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

function errorMessageForStatus(status: number, serverMsg?: string): string {
  switch (status) {
    case 401:
      return 'Session expired. Please log in again.';
    case 403:
      return serverMsg || 'You do not have access to browse this account.';
    case 404:
      return 'Service account not found.';
    case 400:
      return serverMsg || 'Invalid request.';
    default:
      return serverMsg || `Server error (HTTP ${status})`;
  }
}

async function parseResponse(response: Response): Promise<RollupResponse> {
  if (!response.ok) {
    let serverMsg: string | undefined;
    try {
      const err = await response.json();
      serverMsg = err?.error || err?.message;
    } catch { /* keep default */ }
    throw new Error(errorMessageForStatus(response.status, serverMsg));
  }
  const text = await response.text();
  if (!text) throw new Error('Empty response from rollup API');
  try {
    return JSON.parse(text) as RollupResponse;
  } catch {
    throw new Error('Invalid JSON response from rollup API');
  }
}

export async function getRollup(params: GetRollupParams): Promise<RollupResponse> {
  const qs = new URLSearchParams({
    sa_id: String(params.saId),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  if (params.types?.length) qs.set('types', params.types.join(','));
  if (params.kind) qs.set('kind', params.kind);

  const url = `${ODOO_BASE_URL}/api/rollup?${qs}`;
  const response = await fetchRetry(url, { headers: buildHeaders() });
  return parseResponse(response);
}
