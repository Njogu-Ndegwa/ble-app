// Ticket governance actors — assign SA members as actors on a helpdesk ticket
// (ov.actor_sa_ticket). Mirrors the desktop portal implementation. Endpoints:
//   GET    /api/governance/ticket/object/<id>/actors
//          → { actors: [{ id, actor_id, actor_name, is_primary, state, date_from }] }
//            (actor_id = partner id; id = assignment-record id)
//   POST   /api/governance/ticket/object/<id>/actors        { actor_partner_id, is_primary }
//   DELETE /api/governance/ticket/object/<id>/actors/<partner_id>
//   PUT    /api/governance/ticket/object/<id>/actors/<partner_id>/promote
// Headers (token + X-API-KEY + X-SA-ID) come from buildOdooHeaders.

import { buildOdooHeaders } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

export interface TicketActor {
  partnerId: number;
  name: string;
  isPrimary: boolean;
}

export interface TicketMember {
  partnerId: number;
  name: string;
  email?: string;
}

function authToken(): string | undefined {
  return getSalesRoleToken() ?? undefined;
}

function actorHeaders(): HeadersInit {
  return buildOdooHeaders(authToken());
}

async function parse(response: Response, endpoint: string): Promise<Record<string, any>> {
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  if (!response.ok) {
    let message = `Server error (HTTP ${response.status})`;
    if (isJson) {
      try {
        const b = await response.json();
        message = b?.error || b?.message || b?.data?.error || message;
      } catch {
        /* keep default */
      }
    }
    console.error(`[ticket-actors] ${endpoint} HTTP ${response.status}: ${message}`);
    throw new Error(message);
  }
  if (!isJson) return {};
  const body = await response.json();
  if (body?.success === false) throw new Error(body?.error || body?.message || 'Request failed');
  return body;
}

// Tolerant to the exact field names the API returns. Live shape (probed
// 2026-06-12 from the desktop portal): { id, actor_id, actor_name, is_primary,
// state, date_from } where `actor_id` is the PARTNER id and `id` is the
// assignment-record id — DELETE /actors/<partner_id> and the promote route
// expect the partner id, so `actor_id` must win over `id` or remove/promote
// fail with "Actor not found for this assignment".
export function mapActor(a: Record<string, any>): TicketActor {
  const partnerId = a.actor_id ?? a.actor_partner_id ?? a.partner_id ?? a.id;
  return {
    partnerId,
    name: a.actor_name ?? a.name ?? a.display_name ?? a.partner_name ?? `Partner #${partnerId}`,
    isPrimary: Boolean(a.is_primary ?? a.primary ?? false),
  };
}

const actorsBase = (ticketId: number) => `/api/governance/ticket/object/${ticketId}/actors`;

export async function listTicketActors(ticketId: number): Promise<TicketActor[]> {
  const endpoint = actorsBase(ticketId);
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: actorHeaders(),
  });
  const body = await parse(response, endpoint);
  const arr = body.actors ?? body.data ?? body.result ?? [];
  return Array.isArray(arr) ? arr.map(mapActor) : [];
}

export async function assignTicketActor(
  ticketId: number,
  actorPartnerId: number,
  isPrimary = false,
): Promise<void> {
  const endpoint = actorsBase(ticketId);
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify({ actor_partner_id: actorPartnerId, is_primary: isPrimary }),
  });
  await parse(response, endpoint);
}

export async function removeTicketActor(ticketId: number, actorPartnerId: number): Promise<void> {
  const endpoint = `${actorsBase(ticketId)}/${actorPartnerId}`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: actorHeaders(),
  });
  await parse(response, endpoint);
}

export async function promoteTicketActor(ticketId: number, actorPartnerId: number): Promise<void> {
  const endpoint = `${actorsBase(ticketId)}/${actorPartnerId}/promote`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: actorHeaders(),
  });
  await parse(response, endpoint);
}

// ---------------------------------------------------------------------------
// SA members — candidate actors (a member's partner id is the actor_partner_id)
// ---------------------------------------------------------------------------

export async function getServiceAccountMembers(saId: number): Promise<TicketMember[]> {
  const endpoint = `/api/service-accounts/${saId}/members?membership_state=active`;
  const response = await fetch(`${ODOO_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: actorHeaders(),
  });
  const body = await parse(response, endpoint);
  const arr = body.members ?? body.data ?? [];
  if (!Array.isArray(arr)) return [];
  // person.id / partner_id are partner ids; a bare m.id would be the
  // membership-record id (the same id-confusion mapActor guards against),
  // so members without a partner id are dropped rather than mis-mapped.
  return arr
    .map((m: Record<string, any>) => {
      const person = m.person ?? {};
      const partnerId = person.id ?? m.partner_id;
      const email = person.email ?? m.email;
      return {
        partnerId,
        name: person.name ?? m.name ?? `Partner #${partnerId}`,
        email: typeof email === 'string' ? email : undefined,
      };
    })
    .filter((m: TicketMember) => m.partnerId != null);
}
