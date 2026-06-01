// Helpdesk Tickets API client — see src/ticking.md.
//
// Reuses `buildOdooHeaders` from odoo-api.ts so we automatically pick up
// X-API-KEY, Authorization (when token passed) and X-SA-ID (from selected SA).

import { buildOdooHeaders } from './odoo-api';
import type {
  HelpdeskStage,
  ListTicketsParams,
  StagesResponse,
  Ticket,
  TicketCreateBody,
  TicketListResponse,
  TicketMessage,
  TicketMessagesResponse,
  TicketResponse,
  TicketUpdateBody,
} from './tickets-types';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

export class TicketsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseJson<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let message = `Server error (HTTP ${response.status})`;
    let code: string | undefined;
    if (isJson) {
      try {
        const body = await response.json();
        message = body?.error || body?.message || body?.data?.error || message;
        code = body?.error_code;
      } catch {
        // ignore
      }
    } else if (response.status === 503) {
      message = 'Helpdesk is not available. Install the Service desk app on your Odoo server.';
    }
    console.error(`[tickets-api] ${endpoint} HTTP ${response.status}: ${message}`);
    throw new TicketsApiError(message, response.status, code);
  }

  if (!isJson) {
    throw new TicketsApiError('Unexpected non-JSON response', response.status);
  }

  const body = (await response.json()) as T & { success?: boolean; error?: string };
  if (body.success === false) {
    throw new TicketsApiError(body.error || 'Request failed', response.status);
  }
  return body as T;
}

function headersFor(authToken?: string): HeadersInit {
  return buildOdooHeaders(authToken);
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export async function fetchHelpdeskStages(
  authToken?: string,
  teamId?: number,
): Promise<HelpdeskStage[]> {
  const qs = teamId ? `?team_id=${teamId}` : '';
  const endpoint = `/api/helpdesk/stages${qs}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: headersFor(authToken),
  });
  const data = await parseJson<StagesResponse>(response, endpoint);
  return data.stages;
}

// ---------------------------------------------------------------------------
// Tickets — list / get / create / update / delete
// ---------------------------------------------------------------------------

export async function fetchTickets(
  params: ListTicketsParams = {},
  authToken?: string,
): Promise<TicketListResponse> {
  const qp = new URLSearchParams();
  if (params.page !== undefined) qp.set('page', String(params.page));
  if (params.limit !== undefined) qp.set('limit', String(params.limit));
  if (params.search) qp.set('search', params.search);
  if (params.partner_id !== undefined) qp.set('partner_id', String(params.partner_id));
  if (params.stage_id !== undefined) qp.set('stage_id', String(params.stage_id));
  if (params.team_id !== undefined) qp.set('team_id', String(params.team_id));
  if (params.user_id !== undefined) qp.set('user_id', String(params.user_id));
  if (params.priority) qp.set('priority', params.priority);

  const qs = qp.toString();
  const endpoint = `/api/tickets${qs ? `?${qs}` : ''}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: headersFor(authToken),
  });
  return parseJson<TicketListResponse>(response, endpoint);
}

export async function getTicket(id: number, authToken?: string): Promise<Ticket> {
  const endpoint = `/api/tickets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: headersFor(authToken),
  });
  const data = await parseJson<TicketResponse>(response, endpoint);
  return data.ticket;
}

export async function createTicket(
  body: TicketCreateBody,
  authToken?: string,
): Promise<Ticket> {
  const endpoint = '/api/tickets';
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: headersFor(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<TicketResponse>(response, endpoint);
  return data.ticket;
}

export async function updateTicket(
  id: number,
  body: TicketUpdateBody,
  authToken?: string,
): Promise<Ticket> {
  const endpoint = `/api/tickets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: headersFor(authToken),
    body: JSON.stringify(body),
  });
  const data = await parseJson<TicketResponse>(response, endpoint);
  return data.ticket;
}

export async function deleteTicket(id: number, authToken?: string): Promise<void> {
  const endpoint = `/api/tickets/${id}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: headersFor(authToken),
  });
  await parseJson<{ success: true; id: number; message?: string }>(response, endpoint);
}

// ---------------------------------------------------------------------------
// Chatter
// ---------------------------------------------------------------------------

export async function fetchTicketMessages(
  id: number,
  authToken?: string,
): Promise<TicketMessage[]> {
  const endpoint = `/api/tickets/${id}/messages`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: headersFor(authToken),
  });
  const data = await parseJson<TicketMessagesResponse>(response, endpoint);
  return data.messages;
}

export async function postTicketMessage(
  id: number,
  message: string,
  authToken?: string,
): Promise<{ message_id: number }> {
  const endpoint = `/api/tickets/${id}/messages`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: headersFor(authToken),
    body: JSON.stringify({ message }),
  });
  return parseJson<{ success: true; message_id: number }>(response, endpoint);
}
