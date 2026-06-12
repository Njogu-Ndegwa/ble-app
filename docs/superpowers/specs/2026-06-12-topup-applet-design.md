# Top-Up Applet — Design Spec

**Date:** 2026-06-12
**Status:** Approved by Dennis (sections reviewed in brainstorming session "create top up app")

## Goal

A staff-facing applet that credits energy (kWh) to a customer's subscription
directly — no payment step, no transaction ID, no Odoo order. The staff member
enters a subscription ID, picks a service plan (filtered to the customer's
package), and commits the top-up. ABS is the only system written to
("ABS-centric"); Odoo is read-only (catalog + subscription status).

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Access | Staff-only via SA applet grant — new slug `topup` on the Service Account in Odoo, same gating as Activator/Attendant |
| Odoo writes | None. No order, no `confirmPaymentManual`. Catalog and status reads only |
| Structure | Linear step wizard (Activator-style): Identify → Plan → Confirm → Done |
| Transaction ID | Does not exist in this flow. `payment_reference`/`correlation_id` are auto-generated (`staff-topup-<employeeId>-<timestamp>`), surfaced only on the receipt |
| Inactive subs | Block when cancelled; allow-with-warning when paused |
| Recent top-ups | localStorage-backed list on the entry screen (device-local audit) |

## Architecture

- Route `/topup`, files under `src/app/(mobile)/topup/`:
  - `page.tsx` — thin route wrapper (same pattern as other applets)
  - `TopupApp.tsx` — employee session load (`getSalesRoleUser()`, `getSelectedSA`), logout, shell
  - `TopupFlow.tsx` — the wizard state machine (4 steps)
  - `components/` — `StepIdentify.tsx`, `StepPlan.tsx`, `StepConfirm.tsx`, `StepDone.tsx`, `RecentTopups.tsx`
  - `lib/topup-reference.ts` — reference generation + recent-list persistence (pure, unit-testable)
- Registration: `ALL_ROLES` in `src/components/roles/SelectRole.tsx` (slug `topup`, path `/topup`), `APPLET_MENU_IDS` in `src/lib/auth.tsx`
- Auth: employee token via the mirrored session helpers; missing session → redirect `/`
- No MQTT anywhere — ABS GraphQL (`absApolloClient`) + Odoo REST only

## Flow & API calls

### Step 1 — Identify
Input: subscription ID (the only typed input in the applet).
- `identifyCustomer` (ABS, via existing `useCustomerIdentification` hook):
  validates the sub, returns service states (energy service id, quota, used),
  template, currency
- `getSubscriptionStatus(subCode)` (Odoo, `odoo-api.ts:1101`): `product_name`
  (= package, drives plan filter), `status`
- Both fire in parallel; Odoo failure degrades gracefully (package unknown →
  unfiltered plan list)
- Echo-back gate (M-PESA Hakikisha pattern): customer card shows sub code,
  package, status badge, current energy remaining/total; staff must tap
  Continue to unlock the plan step

### Step 2 — Plan
- `getSubscriptionProducts` (Odoo catalog) → `PlanOption` mapping (same shape
  as rider's EnergyTopUpModal: name, price, productId, templateId)
- `filterPlansByPackage(product_name, plans)` — the shared
  `PRODUCT_SERVICE_MAP` filter from `src/lib/plan-filter.ts` (same map as
  Sales/Activator/Rider)
- On select: `GET_SERVICE_PLAN_TEMPLATE` → `extractEnergyConfiguration` →
  declared kWh displayed on the card ("+200 kWh")
- Plan cards reuse the existing `energy-plan-card` styles from globals.css

### Step 3 — Confirm
Summary: sub code, package, plan name, +kWh, balance before → after.
Commit button is verb-labeled: **"Credit {kWh} kWh"**.
On tap → `serviceTopup` (ABS):

```
plan_id          = subscription code
service_id       = energy service id from identifyCustomer (NOT the template placeholder)
payment_amount   = round(plan list price, 2)
unit_price       = payment_amount / declared_kWh   (full precision, never rounded)
payment_reference = correlation_id = staff-topup-<employeeId>-<timestamp>
```

Keep the rider's 4-dp precision pre-check: refuse to send if
`round4(payment_amount / unit_price) != declared_kWh`.

### Step 4 — Done
Receipt from the ABS response: credited kWh (`additional_quota`),
`quota_before` → `quota_after`, reference id (copyable). Actions:
"Top up another" (reset to step 1), Done.
Append `{subCode, kWh, reference, timestamp}` to the localStorage recent list.

## Error handling

| Case | Behaviour |
|---|---|
| Unknown sub ID | Friendly message from `useCustomerIdentification` mapping |
| No energy service in service states | Hard block — applet only credits energy |
| Infinite energy quota (>100k threshold) | Block — nothing to top up |
| Sub cancelled | Block with status badge |
| Sub paused | Warning badge, allowed |
| Odoo status call fails | Proceed; package unknown → unfiltered plans |
| Template lookup fails / declared kWh ≤ 0 | Plan not continuable (same guard as rider) |
| Filter empties the list | `filterPlansByPackage` falls back to full list (built in) |
| Network failure on commit | Retry with the SAME correlation id (ABS dedupes — no double credit) |
| Double-tap | Button disabled while in flight |

## UX conventions (from competitive research)

- Echo-back validation gate before any action (M-PESA Hakikisha, STS vending)
- Verb-labeled commit ("Credit 25 kWh", never "OK")
- Receipt with short reference + copy action
- Recent top-ups list for audit/repeat (agent-app convention)
- Plan cards show the conversion (price → kWh), not bare prices

## i18n

All strings in `en.json` / `fr.json` / `zh.json` under a `topup.*` namespace,
following the existing message-key pattern.

## Testing

- Unit: reference generation, recent-list persistence, top-up input
  construction + precision check (pure functions in `lib/topup-reference.ts`
  and a `buildTopupInput` helper)
- Component: wizard flow with mocked API layer — validate sub → pick plan →
  confirm → done, plus the block/warn paths
- End-to-end (user-assisted): dev server against staging with a test
  subscription ID — full flow incl. real `serviceTopup`
- Test framework: none exists in repo yet; set up via code-tester agent

## Out of scope (v1)

- QR scan of subscription ID (manual entry only; QR is a v2 candidate)
- SMS receipt share (copy-reference only in v1)
- Battery/swap-count top-up (energy service only)
- Server-side top-up history (localStorage only)
