/**
 * Ticket Service — API functions for Helpdesk ticket CRUD.
 *
 * Mirrors customer-service: wraps `@/lib/tickets-api` and maps raw Odoo shapes
 * to the UI shape (`ExistingTicket`) used by the Ticketing applet.
 */

import {
  createTicket as apiCreateTicket,
  deleteTicket as apiDeleteTicket,
  fetchHelpdeskStages as apiFetchStages,
  fetchTickets as apiFetchTickets,
  fetchTicketMessages as apiFetchMessages,
  getTicket as apiGetTicket,
  postTicketMessage as apiPostMessage,
  updateTicket as apiUpdateTicket,
} from '@/lib/tickets-api';
import type {
  HelpdeskStage,
  ListTicketsParams,
  Ticket as RawTicket,
  TicketCreateBody,
  TicketMessage,
  TicketPriority,
  TicketUpdateBody,
} from '@/lib/tickets-types';
import { priorityKey } from '@/lib/tickets-types';

// ============================================================================
// Types
// ============================================================================

export interface ExistingTicket {
  id: number;
  subject: string;
  description: string;
  priority: TicketPriority | 'none';
  stageId: number | null;
  stageName: string;
  teamId: number | null;
  teamName: string;
  assigneeId: number | null;
  assigneeName: string;
  customerId: number | null;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  saId: number | null;
  saName: string;
}

export interface TicketListResponse {
  success: boolean;
  tickets: ExistingTicket[];
  total: number;
  page: number;
  limit: number;
}

export interface TicketDetailResponse {
  success: boolean;
  ticket: ExistingTicket;
}

export type TicketStageFilter = 'all' | number;

// ============================================================================
// Mapping helper
// ============================================================================

function mapTicket(t: RawTicket): ExistingTicket {
  const pk = priorityKey(t.priority);
  return {
    id: t.id,
    subject: t.subject || t.name || '',
    description: t.description || '',
    priority: pk,
    stageId: t.stage?.id ?? null,
    stageName: t.stage?.name || '',
    teamId: t.team?.id ?? null,
    teamName: t.team?.name || '',
    assigneeId: t.assigned_to?.id ?? null,
    assigneeName: t.assigned_to?.name || '',
    customerId: t.customer?.id ?? t.partner_id ?? null,
    customerName: t.customer?.name || '',
    createdAt: t.created_at || '',
    updatedAt: t.updated_at || '',
    saId: t.sa?.id ?? null,
    saName: t.sa?.name || '',
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search tickets by subject/description.
 * Uses GET /api/tickets?search=<query>&stage_id=<id>
 */
export async function searchTickets(
  query: string,
  authToken: string,
  stage: TicketStageFilter = 'all',
): Promise<TicketListResponse> {
  const trimmed = query.trim();
  const params: ListTicketsParams = {
    limit: 20,
    ...(trimmed ? { search: trimmed } : {}),
    ...(typeof stage === 'number' ? { stage_id: stage } : {}),
  };
  const result = await apiFetchTickets(params, authToken);
  return {
    success: true,
    tickets: result.tickets.map(mapTicket),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

/**
 * Get tickets with pagination and optional stage filter.
 * Uses GET /api/tickets?page=<page>&limit=<limit>&stage_id=<id>
 */
export async function getAllTickets(
  page: number = 1,
  limit: number = 20,
  authToken: string,
  stage: TicketStageFilter = 'all',
): Promise<TicketListResponse> {
  const params: ListTicketsParams = {
    page,
    limit,
    ...(typeof stage === 'number' ? { stage_id: stage } : {}),
  };
  const result = await apiFetchTickets(params, authToken);
  return {
    success: true,
    tickets: result.tickets.map(mapTicket),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

/**
 * Get a single ticket by ID.
 * Uses GET /api/tickets/:id
 */
export async function getTicketById(
  id: number,
  authToken: string,
): Promise<TicketDetailResponse> {
  const t = await apiGetTicket(id, authToken);
  return {
    success: true,
    ticket: mapTicket(t),
  };
}

export interface TicketWritePayload {
  subject?: string;
  description?: string;
  priority?: TicketPriority;
  stageId?: number;
  partnerId?: number;
  teamId?: number;
  userId?: number;
}

/**
 * Create a new ticket.
 * Uses POST /api/tickets
 */
export async function createTicket(
  data: TicketWritePayload & { subject: string },
  authToken: string,
): Promise<TicketDetailResponse> {
  const payload: TicketCreateBody = { subject: data.subject };
  if (data.description !== undefined) payload.description = data.description;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.stageId !== undefined) payload.stage_id = data.stageId;
  if (data.partnerId !== undefined) payload.partner_id = data.partnerId;
  if (data.teamId !== undefined) payload.team_id = data.teamId;
  if (data.userId !== undefined) payload.user_id = data.userId;

  const t = await apiCreateTicket(payload, authToken);
  return { success: true, ticket: mapTicket(t) };
}

/**
 * Update an existing ticket.
 * Uses PATCH /api/tickets/:id
 */
export async function updateTicket(
  id: number,
  data: TicketWritePayload,
  authToken: string,
): Promise<TicketDetailResponse> {
  const payload: TicketUpdateBody = {};
  if (data.subject !== undefined) payload.subject = data.subject;
  if (data.description !== undefined) payload.description = data.description;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.stageId !== undefined) payload.stage_id = data.stageId;
  if (data.partnerId !== undefined) payload.partner_id = data.partnerId;
  if (data.teamId !== undefined) payload.team_id = data.teamId;
  if (data.userId !== undefined) payload.user_id = data.userId;

  const t = await apiUpdateTicket(id, payload, authToken);
  return { success: true, ticket: mapTicket(t) };
}

export interface TicketDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Delete a ticket by ID.
 * Uses DELETE /api/tickets/:id
 */
export async function deleteTicket(
  id: number,
  authToken: string,
): Promise<TicketDeleteResponse> {
  await apiDeleteTicket(id, authToken);
  return { success: true, message: 'Ticket deleted successfully' };
}

/**
 * Pipeline stages (kanban columns).
 * Uses GET /api/helpdesk/stages
 */
export async function getHelpdeskStages(authToken: string): Promise<HelpdeskStage[]> {
  return apiFetchStages(authToken);
}

/**
 * Chatter — list messages on a ticket.
 * Uses GET /api/tickets/:id/messages
 */
export async function getTicketMessages(
  id: number,
  authToken: string,
): Promise<TicketMessage[]> {
  return apiFetchMessages(id, authToken);
}

/**
 * Chatter — post a comment on a ticket.
 * Uses POST /api/tickets/:id/messages
 */
export async function postTicketMessage(
  id: number,
  message: string,
  authToken: string,
): Promise<{ message_id: number }> {
  return apiPostMessage(id, message, authToken);
}
