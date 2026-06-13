# Ticket priority becomes an agent triage field

**Date:** 2026-06-12
**Status:** Approved

## Problem

Customers currently choose their own ticket priority when raising tickets, in
two places: the Support applet (`ticketing-customer` slug, `Support.tsx`) and
the rider applet's New Ticket form (`RiderTickets.tsx`). Self-reported
priority is unreliable — triage is the agent's job. Meanwhile, in the agent
Ticketing app the only way to change a ticket's priority is to open the full
Edit form, which is too heavy for a one-field triage action.

Competitive grounding: Zendesk end-users cannot edit priority after
submission; HelpDesk.com makes priority agent-only by default; the common
agent-side pattern is a quick priority change from the ticket detail or list
without an edit form (LiveAgent et al.).

## Design

### Agent Ticketing app (`src/app/(mobile)/ticketing/app/Ticketing.tsx`)

- The priority badge in the ticket detail Summary section becomes a tap
  target with a visible affordance (chevron/pencil next to the badge).
- Tapping opens the existing `SelectSheet` bottom sheet with the four
  priorities (Low / Medium / High / Urgent), pre-selected to the current
  value.
- Selecting a value calls `updateTicket(id, { priority }, token)` — the
  PATCH endpoint accepts a priority-only payload. While the request is in
  flight the badge shows a busy state; on success the detail state is
  updated, the list cache for the active stage filter is invalidated, and a
  "Priority updated" toast is shown. On failure: error toast, badge reverts.
- The Edit form keeps its priority field; this change only removes the need
  to use it for priority alone.

### Support applet (`src/app/(mobile)/support/app/Support.tsx`)

- Remove the Priority `SheetField` + `SelectSheet` from the create form and
  the edit form, along with the `priority` member of the form state.
- `createTicket` payload omits `priority`; new customer tickets arrive with
  Odoo's default (`'0'` → displayed as **None**), which doubles as an
  "untriaged" cue for agents.
- `updateTicket` payload (customer editing their own open ticket) omits
  `priority`.
- Customers keep read-only visibility: priority badges on list cards and in
  detail, and the priority filter chips stay.

### Rider applet (`src/app/(mobile)/rider/app/components/RiderTickets.tsx`)

- Remove the Priority `<select>` from the New Ticket modal and the
  `priority` member of the form state; the POST payload omits `priority`.
- Priority badges on the rider's ticket list stay (read-only).

### i18n

- New string for the agent toast, `ticketing.priorityUpdated`, in
  en / fr / zh. Removed fields drop no shared strings — `rider.tickets.priority`
  and the `ticketing.priority.*` labels are still used for read-only badges
  and the agent sheet.

## Out of scope

- The uncommitted TicketAssignees work in the main checkout (assign-time
  priority enforcement was considered and dropped — the quick setter covers
  the need).
- The desktop portal (separate repo) ticketing split.
- Hiding priority from customers entirely (kept read-only for now).
- Server-side enforcement; this is a UI-level change, the API still accepts
  priority on create.

## Branch / base

Work happens on `dev-wt-20260612` (worktree off origin/dev) with
`worktree-support-applet` merged in, since the Support applet only exists on
that branch.

## Testing

No test framework in this repo; verification is `npm run lint` plus a manual
pass: agent detail quick-set (success + failure paths), Support create/edit
forms show no priority field, payloads omit priority, rider New Ticket form
shows no priority select.
