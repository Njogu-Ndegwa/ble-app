/**
 * Pure logic for the staff Top-Up applet. No React, no network — unit-tested.
 *
 * There is NO transaction id in this flow: the reference generated here is
 * the only identifier. It is sent as BOTH `payment_reference` (service-layer
 * idempotency → PaymentAction id) and `correlation_id` (agent-layer
 * idempotency), so retries can never double-credit, and it doubles as the
 * audit trail of which employee performed the top-up.
 */
import { round } from '@/lib/utils';
import type { ServiceTopupInput } from '@/lib/graphql/mutations';

export function buildStaffTopupReference(
  employeeId: string | number,
  now: Date = new Date(),
): string {
  const ts = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `staff-topup-${employeeId}-${ts}-${rand}`;
}

export interface StaffTopupParams {
  subscriptionCode: string;
  energyServiceId: string;
  planPrice: number;
  declaredKwh: number;
  reference: string;
}

/**
 * ABS computes credited quota as payment_amount / unit_price (4-dp rounded).
 * We want to credit exactly the catalog's declared kWh, so unit_price is the
 * inverse: payment_amount / declaredKwh — same approach as the rider flow.
 * The pre-flight check refuses to send anything that wouldn't round-trip.
 */
export function buildServiceTopupInput(p: StaffTopupParams): ServiceTopupInput {
  if (!p.subscriptionCode) throw new Error('Missing subscription code');
  if (!p.energyServiceId) throw new Error('Missing energy service id');
  if (!(p.declaredKwh > 0)) throw new Error('Plan has no declared energy quota');
  const paymentAmount = round(p.planPrice, 2);
  if (!(paymentAmount > 0)) throw new Error('Plan price must be positive');

  const unitPrice = paymentAmount / p.declaredKwh;
  const previewKwh = Math.round((paymentAmount / unitPrice) * 10000) / 10000;
  if (!(Math.abs(previewKwh - p.declaredKwh) <= 0.0001)) {
    throw new Error('Top-up precision check failed');
  }

  return {
    plan_id: p.subscriptionCode,
    service_id: p.energyServiceId,
    payment_amount: paymentAmount,
    unit_price: unitPrice,
    payment_reference: p.reference,
    correlation_id: p.reference,
  };
}

// ── Recent top-ups (device-local audit list) ────────────────────────────────

const RECENT_KEY = 'topup-recent-v1';
const RECENT_MAX = 20;

export interface RecentTopup {
  subscriptionCode: string;
  planName: string;
  kwh: number;
  reference: string;
  timestamp: string; // ISO
}

export function loadRecentTopups(storage?: Storage): RecentTopup[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) return [];
  try {
    const raw = s.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentTopup =>
        !!e && typeof e.reference === 'string' && typeof e.kwh === 'number'
        && typeof e.subscriptionCode === 'string' && typeof e.timestamp === 'string',
    );
  } catch {
    return [];
  }
}

export function appendRecentTopup(entry: RecentTopup, storage?: Storage): RecentTopup[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const list = [entry, ...loadRecentTopups(s)].slice(0, RECENT_MAX);
  try {
    s?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Quota/private-mode failures must never break the flow.
  }
  return list;
}

// ── Response assessment (mirrors rider's signal gate) ───────────────────────

export interface TopupAssessment {
  ok: boolean;
  isIdempotent: boolean;
  reason?: string;
}

/**
 * ABS reports rejections as non-error responses distinguished only by
 * `signals`. Success requires SERVICE_QUOTA_UPDATED; IDEMPOTENT_OPERATION_DETECTED
 * means a retry of an already-applied credit (also success, but the quota
 * figures in the response may not reflect the original credit).
 */
export function assessTopupResponse(resp: {
  signals?: string[] | null;
  metadata?: string | Record<string, unknown> | null;
}): TopupAssessment {
  const signals = resp.signals || [];
  const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
  if (signals.includes('SERVICE_QUOTA_UPDATED') || isIdempotent) {
    return { ok: true, isIdempotent };
  }
  let md: Record<string, unknown> | null = null;
  if (typeof resp.metadata === 'string') {
    try { md = JSON.parse(resp.metadata); } catch { md = null; }
  } else {
    md = resp.metadata ?? null;
  }
  const reason =
    (md && typeof md.reason === 'string' && md.reason) ||
    (md && typeof md.message === 'string' && md.message) ||
    undefined;
  return { ok: false, isIdempotent: false, reason };
}

// ── Pending reference (survives unmount and refresh until success) ──────────

const PENDING_REFS_KEY = 'topup-pending-refs-v1';
const PENDING_REFS_MAX = 10;

function loadPendingRefs(s?: Storage): Record<string, string> {
  if (!s) return {};
  try {
    const raw = s.getItem(PENDING_REFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The idempotency reference must survive Back-navigation and even a page
 * refresh after a timed-out commit: retrying the SAME subscription+plan must
 * reuse the SAME reference so ABS dedupe can absorb a credit that actually
 * landed server-side. Each sub+plan combination is stored independently in a
 * map so viewing a different plan's confirm screen never overwrites another
 * plan's pending reference. Success clears the specific entry so deliberate
 * repeat top-ups work.
 */
export function getOrCreatePendingReference(
  employeeId: string | number,
  subscriptionCode: string,
  productId: number,
  storage?: Storage,
): string {
  const s = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);
  const key = `${subscriptionCode}::${productId}`;
  const map = loadPendingRefs(s);
  const existing = map[key];
  if (existing) return existing;

  const reference = buildStaffTopupReference(employeeId);
  // Cap the map so an abandoned session can't grow it unboundedly; insertion
  // order makes the first key the oldest pending entry.
  const keys = Object.keys(map);
  if (keys.length >= PENDING_REFS_MAX) delete map[keys[0]];
  map[key] = reference;
  try {
    s?.setItem(PENDING_REFS_KEY, JSON.stringify(map));
  } catch {
    // private mode/quota — in-memory flow still covers same-screen retries
  }
  return reference;
}

/** Clear ONLY this sub+plan's pending reference (called on confirmed success). */
export function clearPendingReference(
  subscriptionCode: string,
  productId: number,
  storage?: Storage,
): void {
  const s = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);
  if (!s) return;
  try {
    const map = loadPendingRefs(s);
    delete map[`${subscriptionCode}::${productId}`];
    s.setItem(PENDING_REFS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
