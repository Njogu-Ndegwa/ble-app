// Helpdesk ticket types — see src/ticking.md §13.

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// Server may return numeric strings '0'..'4' on read.
export type RawPriority = string;

export interface HelpdeskStage {
  id: number;
  name: string;
  sequence: number;
  fold: boolean;
}

export type TicketM2O = { id: number; name: string | null } | null;

export interface Ticket {
  id: number;
  subject: string;
  name: string;
  description: string;
  priority: RawPriority;
  stage: TicketM2O;
  team: TicketM2O;
  assigned_to: TicketM2O;
  customer: TicketM2O;
  partner_id: number | null;
  company_id: number | null;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
  sa?: { id: number; name: string };
}

export interface TicketMessage {
  id: number;
  author: string;
  body: string;
  date: string;
  type: 'comment' | 'email' | 'notification';
}

export interface TicketListResponse {
  success: true;
  total: number;
  page: number;
  limit: number;
  tickets: Ticket[];
}

export interface StagesResponse {
  success: true;
  stages: HelpdeskStage[];
  total: number;
}

export interface TicketResponse {
  success: true;
  ticket: Ticket;
}

export interface TicketMessagesResponse {
  success: true;
  messages: TicketMessage[];
  total: number;
}

export interface TicketCreateBody {
  subject: string;
  description?: string;
  priority?: TicketPriority;
  stage_id?: number;
  partner_id?: number;
  team_id?: number;
  user_id?: number;
}

export interface TicketUpdateBody {
  subject?: string;
  description?: string;
  priority?: TicketPriority;
  stage_id?: number;
  partner_id?: number;
  team_id?: number;
  user_id?: number;
}

export interface ListTicketsParams {
  page?: number;
  limit?: number;
  search?: string;
  partner_id?: number;
  stage_id?: number;
  team_id?: number;
  user_id?: number;
  priority?: TicketPriority;
}

export const PRIORITY_LABELS: Record<string, string> = {
  '0': 'None',
  '1': 'Low',
  '2': 'Medium',
  '3': 'High',
  '4': 'Urgent',
};

export function priorityKey(raw: RawPriority | TicketPriority | undefined): TicketPriority | 'none' {
  if (!raw) return 'medium';
  const s = String(raw).toLowerCase();
  if (s === 'low' || s === '1') return 'low';
  if (s === 'medium' || s === '2') return 'medium';
  if (s === 'high' || s === '3') return 'high';
  if (s === 'urgent' || s === '4') return 'urgent';
  if (s === '0' || s === 'none') return 'none';
  return 'medium';
}
