# BLE Device Manager — Device Details Page Redesign

**Date:** 2026-06-11
**Status:** Approved by Dennis (design + mockups validated in visual companion)
**Scope:** `src/app/(mobile)/mydevices/devices/DeviceDetailView.tsx` — presentation only; all BLE/GraphQL behavior preserved.

## Problem

The Details page (My Devices → connect → Details) works but reads as unconsidered below the hero. Six confirmed issues (all validated by Dennis against an annotated mockup of the current page):

1. **Three competing button colors** — teal/green/amber gradient Generate buttons fight the app's single-teal accent system.
2. **Inconsistent card layouts** — Days Code stacks an input row; Free/Reset put the button inline.
3. **Duplicated information** — "Current Code" appears in the top stat card and again in the CMD Service panel.
4. **Result pops in mid-page** — the generated-code card appears between sections, shifting layout.
5. **CMD Service is a debug panel** — raw `pubk` Read/Write vocabulary on an operator-facing page.
6. **Flat hierarchy** — every section is an equal-weight card; nothing signals the page's primary job.

## Inputs that shaped the design

- **Audience:** mixed — mostly field operators, technicians occasionally need raw read/write. → Advanced disclosure, collapsed by default.
- **Usage:** Days Code dominates day-to-day. → It gets the primary visual slot.
- **Competitive research** (Angaza, PaygOps, Bboxx Pulse, Upya, Sun King, OpenPAYGO standard): status anchors the top; one short configure→generate→result flow; token shown big/chunked/numeric with copy; explicit "it worked" confirmation (re-reading the device is the strongest possible signal); last code kept visible as history; unlock/reset separated as sensitive operations; raw GATT access lives in a separate tool (nRF Connect precedent) or hidden section.

## Chosen layout: "Primary Action Card" (Option A of three mocked options)

Top to bottom (hero unchanged above all this):

1. **Status card** — single card: calendar icon, "Remaining days" label, big mono number (`rcrd` value). Spinner + "Updating…" while the post-write verify loop runs. **Revised 2026-06-11 (Dennis):** the current `pubk` (code on device) is critical at-a-glance info, so the card gains a second full-width row under a dashed divider — key icon, "Current Code" label, chunked mono value with copy button. Full width prevents the truncation the old half-width stat card suffered; both rows show the updating spinner during the verify loop.
2. **Identification banner** — unchanged behavior (shows only while `!itemId`: identifying spinner / error + Retry / waiting), restyled to match the new cards.
3. **Add Days card (primary)** — accent-bordered card with soft glow (`--accent` border + shadow). Contents: "Add days" label; quick-pick chips **7 / 14 / 30 / 90 / Custom** (Custom reveals the numeric input, same digit-only validation); full-width gradient button **"Generate & Write to Device"**. Disabled when busy, no duration selected, or device unidentified.
4. **Result zone (fixed slot)** — always rendered in this position; never moves. States:
   - *Idle, no code known:* dashed row "Last code — Not loaded" + **"Retrieve & rewrite"** action (runs the existing retrieve flow, which fetches the last code from the server AND writes it to the device — existing behavior, now honestly labeled). Replaces the old standalone "Retrieve Last Code" button.
   - *Generating:* spinner + "Generating {type} Code…".
   - *Writing:* code displayed + "Writing to device…" status bar.
   - *Written:* green-accented card, chunked code, "✓ Written · device now reads **N days**" using the re-read `rcrd` value, copy button, "just now" timestamp.
   - *Write failed:* amber-accented, code shown, error message + **Retry write** (existing `handleRetryWrite`).
   - *Generation error:* red-accented, error message + **Try again** (re-runs the failed operation).
   - *Idle, last code known:* compact resting row — "Last code · {type} · {relative time}", chunked code, copy + **Resend** (re-writes via existing `writeCodeToDevice`).
   - Code display is chunked in groups of 3 digits for display only; copy/clipboard always uses raw digits.
5. **Other codes** — section label + two neutral rows (consistent internal layout): icon (teal-soft tint), title, one-line description, small outline "Generate" button. **Confirmation dialog before generating** (new behavior, approved): Free Code — "removes payment restrictions permanently"; Reset Code — "restores the device to default state". Reuse an existing confirm modal if one exists in `src/app/(mobile)/.../modals`; otherwise add a small themed `ConfirmModal`.
6. **Advanced disclosure** — collapsed by default ("Advanced — raw device access"). Expanding reveals the existing CMD Service panel unchanged in function: refresh button + progress bar, `pubk` row with Read/Write (Write still opens `AsciiStringModal`), description, current value + copy.

## What does NOT change

- `ResultState` machine, all four GraphQL operations, `executeGraphQL`, `fetchItemId`, the generated→write `useEffect`, `writeCodeToDevice`, the 1s/2s/4s `verifyWriteApplied` loop, `readCharValue`, toasts, i18n approach, routing/auth handling.
- Retrieve still writes the retrieved code to the device (relabeled, not rewired).
- Hero block (image, name, MAC).
- `MyDevicesApp.tsx` wiring and props (`device`, `attributeList`, `onRequestServiceData`, `isLoadingService`, `serviceLoadingProgress`).

## New state (additions only)

- `lastCode: { codeDec: string; codeType: CodeType; at: number } | null` — set on successful write (and on retrieve); renders the resting row. Session-local (component state), not persisted.
- `selectedChip: number | 'custom' | null` — drives `duration`; Custom shows the input.
- `advancedOpen: boolean`, `confirmFor: 'free' | 'reset' | null`.

## Component structure

`DeviceDetailView.tsx` (~1,200 lines) keeps all state/logic and composes new presentational components in `src/app/(mobile)/mydevices/devices/components/`:

- `StatusCard.tsx` — remaining days + refreshing state
- `AddDaysCard.tsx` — chips, custom input, generate button
- `ResultZone.tsx` — the seven-state slot (props: `result`, `lastCode`, `remainingDays`, `isRefreshing`, callbacks)
- `OtherCodes.tsx` — free/reset rows
- `AdvancedPanel.tsx` — disclosure wrapping the existing CMD service JSX
- `ConfirmModal.tsx` — only if no reusable confirm modal exists

Styling via existing CSS variables (`--accent`, `--bg-secondary`, `--border`, `--color-success`, `--color-error`, etc.). Single teal accent; success green / warning amber appear only as state feedback, never as button identities. All user-facing strings through `t()`.

## Error handling

Unchanged paths, new surfaces: identify errors stay in the banner with Retry; generation errors render in the result zone (red) with Try again; write failures render in the result zone (amber) with Retry write; disconnect detection unchanged (`sessionStorage.connectedDeviceMac` checks).

## Verification

- `npx tsc --noEmit` (must pass)
- `npx next lint` (no new errors)
- `npx next build` (significant change)
- On-device BLE testing by Dennis (BLE bridge not testable locally).

## Out of scope

- MobileListView / scan screen, hero changes, new BLE capabilities, persisting code history server-side, role-gating Free/Reset (noted as a future option from research).

## Process note

This redesign followed the mockup-first process now recorded in `AGENTS.md`: annotated current-state mockup → confirmed issues → competitor research → three mockup options → approved Option A → this spec.
