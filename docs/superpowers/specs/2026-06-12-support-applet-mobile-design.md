# Mobile "Support" Applet — Design

**Date:** 2026-06-12
**Branch:** `worktree-support-applet` (based on `dev`)
**Status:** Implemented per Dennis's directive to port the desktop separation

## Problem

The desktop portal (`odoo-portal-frontend` / `webapp-asset-admin-distributor-v2`,
branch `service-portal`) split ticketing into two SA-gated applets:

- **Ticketing** (slug `ticketing`) — full agent tool: kanban, stage moves,
  actor assignment, delete.
- **Support** (slug `ticketing-customer`) — lightweight end-user tool: see all
  the SA's tickets, raise tickets, comment, edit/close *own* tickets only.

The mobile app (`ble-app`) has only the agent Ticketing applet
(`/ticketing/app`). This change ports the Support applet to mobile so end-user
SAs get the reduced experience, using the same slugs agreed with the backend.

## Decisions (mirroring the desktop implementation, mobile idioms)

| Question | Decision |
| --- | --- |
| Access gating | Existing `ticketing` slug keeps the agent applet. New tile gated by `ticketing-customer` (slug name from desktop code + AGENTS.md, "agreed with backend"). |
| Ticket visibility | All tickets in the active SA (automatic `X-SA-ID` scoping via `buildOdooHeaders`), not just own. |
| "Own ticket" | `ticket.customerId === session partner_id`. Marked with a "Mine" badge. |
| End-user capabilities | Raise tickets (partner auto-set from session); comment on any SA ticket; edit own open tickets; close own open tickets. No delete, no assignment, no stage picker. |
| Close semantics | Move to the **first folded stage by sequence** (Odoo's done/closed convention) via `updateTicket {stage_id}`. Button hidden when the team has no folded stage. |
| Terminal gating | Edit/Close hidden once the ticket's stage has `fold: true`. |
| UI | Mobile applet pattern — single client component with `list/detail/edit/create` subviews built from shared `ListScreen`, `DetailScreen`, `FilterChips`, `SelectSheet`, `FormSection`/`FormInput`/`FormRow`. No imports from the agent Ticketing component. |
| Data layer | Zero new endpoints. Thin additions to `src/lib/services/ticket-service.ts` only. |

## Structure

```
src/app/(mobile)/support/app/
  page.tsx        # login → selectSA → app shell (clone of ticketing/app/page.tsx)
  SupportApp.tsx  # chrome wrapper (AppHeader + sales-container)
  Support.tsx     # list / detail / edit / create subviews
```

## Registration

- `src/components/roles/SelectRole.tsx` — new tile `support`
  (`appletSlug: 'ticketing-customer'`, path `/support/app`, MessagesSquare icon,
  `role-grad-support` gradient).
- `src/lib/auth.tsx` — `APPLET_MENU_IDS` gains `'ticketing-customer': ['support']`;
  `'support'` menu id is removed from the `ticketing` slug so the two grants
  stay independent (desktop semantics). Legacy role lists keep `support`.
- `src/components/sidebar/navigation.ts` — `support` menu group → `/support/app`.
- `src/app/globals.css` — `.role-grad-support` (sky gradient) + light variant.
- i18n `en/fr/zh` — `role.support`, `nav.support`, `nav.support.app`, `support.*`
  strings. Shared labels reuse existing `ticketing.*` / `common.*` keys.

## Data layer additions (`ticket-service.ts`)

- `listTickets(opts: { page?, limit?, search?, stage?, priority? }, token)` —
  options-object list call surfacing the `priority` param `fetchTickets`
  already accepts. Existing positional functions untouched.
- `moveTicketStage(id, stageId, token)` — thin wrapper over `updateTicket`.
- `getSessionPartnerId()` — `getSalesRoleUser()?.partnerId` (attendant-auth)
  falling back to `getOdooEmployee()?.partner_id` (ov-auth). Null-safe.
- `getHelpdeskStages` now sorts by `sequence` (desktop parity; "first folded
  stage" must be deterministic).

`src/lib/attendant-auth.ts` — `EmployeeUser` gains optional `partnerId`,
mapped from the login response's `employee.partner_id` and from the Microsoft
callback (`partner_id` param or JWT claim). Sessions created before this
change simply lack a partner id — the applet stays fully usable minus the
own-ticket affordances (same graceful degradation as desktop §4).

## Screens

**List** — `ListScreen` with debounced search (300 ms, mobile convention),
stage `FilterChips`, priority `FilterChips`, period filter, load-more
pagination, session cache keyed by stage+priority, "Mine" badge on own
tickets, FAB → Raise Ticket.

**Detail** — `DetailScreen`: summary (priority badge, stage, created),
description (HTML stripped), people (customer / assigned to), chatter
(message list + composer; anyone can post). Edit FAB and a Close header
action appear only when `isMine && !isTerminal`; Close confirms via modal.
No delete.

**Raise / Edit** — subject (required), description, priority sheet. No stage
picker, no customer picker. Create sends `partnerId` from the session when
present. Edit is only reachable for own, open tickets (also guarded in
`openEdit`). Save returns to detail (edit) or list (create).

## Errors & edge cases

- 503 → `TicketsApiError` message "Helpdesk is not available…" surfaces via
  toast (mobile convention).
- No folded stage → Close hidden, never broken.
- No session partner id → no Mine badges, no edit/close; raise still works
  (ticket simply unowned).
- Stage list empty → list renders without chips; stage shows raw name.

## Out of scope

- Assignment/actors, kanban, deletion in the Support applet.
- Odoo-side definition/granting of the `ticketing-customer` slug (backend
  dependency, same as desktop).

## Verification

No test framework in this repo: `npm run lint` clean, `npm run build` clean,
then manual walkthrough against the dev backend.
