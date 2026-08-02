/**
 * Pure logic for the Charger Control applet. No React, no network — unit-tested.
 *
 * Note on idempotency: the rider pays for their own charge with mobile money,
 * so the mobile-money receipt IS the idempotency key — it is sent to ABS as
 * both `payment_reference` and `correlation_id`, exactly as the rider app's
 * Energy Top-Up does. There is deliberately no locally generated reference
 * here; a receipt is a stronger key because it also ties the ABS credit to a
 * real payment rather than to a UI session.
 */
import type { GattCharacteristic } from './types';

export type ChargeMode = 'time' | 'energy';

// ── Characteristic matching ────────────────────────────────────────────────

/**
 * Name heuristics for locating the charge-control characteristics. These are a
 * STOPGAP: Esther confirmed the charger reuses the battery ATT/CMD/STS/DTA/DIA
 * service structure but with different characteristic fields, and the official
 * charger GATT table has not been shared yet.
 *
 * Because these patterns are guesses, `matchCharacteristic` reports every hit
 * rather than silently taking the first one — writing a charge value into the
 * wrong register (a limit or calibration field) is a hardware-level mistake,
 * so an ambiguous match must be escalated to the operator, never auto-resolved.
 */
export const TIME_CHAR_PATTERN = /time|tmr|dur|min/i;
export const ENERGY_CHAR_PATTERN = /engy|energy|kwh|elec|pwr/i;

export interface CharacteristicMatch {
  /** Every characteristic whose name matched the mode's pattern. */
  matches: GattCharacteristic[];
  /** The single confident match, or undefined when there are 0 or 2+ hits. */
  confident?: GattCharacteristic;
  /** True when more than one characteristic matched — operator must choose. */
  ambiguous: boolean;
}

export function matchCharacteristic(
  characteristics: readonly GattCharacteristic[],
  mode: ChargeMode,
): CharacteristicMatch {
  const pattern = mode === 'time' ? TIME_CHAR_PATTERN : ENERGY_CHAR_PATTERN;
  const matches = characteristics.filter((c) => pattern.test(c.name));
  return {
    matches,
    confident: matches.length === 1 ? matches[0] : undefined,
    ambiguous: matches.length > 1,
  };
}

// ── Write value ────────────────────────────────────────────────────────────

export interface WriteValueParams {
  mode: ChargeMode;
  /** kWh the selected plan declares (energy mode writes exactly this). */
  declaredKwh: number;
  /** Operator-entered minutes (time mode only). */
  minutes?: number | null;
}

/**
 * The number written to the charger.
 *
 * Energy mode is derived from the billed plan, never typed by the operator —
 * that is what keeps "what was charged for" and "what is dispensed" identical.
 * Time mode has no such link: the charger decides how much energy it delivers
 * in N minutes, so the operator supplies the minutes and the UI warns that the
 * dispensed energy is not metered against the plan quota.
 */
export function deriveWriteValue(p: WriteValueParams): number {
  if (p.mode === 'energy') {
    if (!(p.declaredKwh > 0)) throw new Error('Plan has no declared energy quota');
    return p.declaredKwh;
  }
  const minutes = Number(p.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('Enter charging time in minutes');
  }
  return minutes;
}

// ── Recent charge sessions (device-local audit list) ────────────────────────

const RECENT_KEY = 'charger-recent-v1';
const RECENT_MAX = 20;

export interface RecentCharge {
  subscriptionCode: string;
  planName: string;
  mode: ChargeMode;
  /** The value written to the charger (kWh or minutes, per `mode`). */
  value: number;
  kwhBilled: number;
  chargerMac: string;
  /** The mobile-money receipt this charge was paid with. */
  reference: string;
  /** False when the rider paid but the BLE write did not land. */
  dispensed: boolean;
  /** True for demo runs — no money moved and no charger was written to. */
  demo?: boolean;
  timestamp: string; // ISO
}

export function loadRecentCharges(storage?: Storage): RecentCharge[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) return [];
  try {
    const raw = s.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentCharge =>
        !!e && typeof e.reference === 'string' && typeof e.value === 'number'
        && typeof e.subscriptionCode === 'string' && typeof e.timestamp === 'string',
    );
  } catch {
    return [];
  }
}

export function appendRecentCharge(entry: RecentCharge, storage?: Storage): RecentCharge[] {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const list = [entry, ...loadRecentCharges(s).filter((e) => e.reference !== entry.reference)]
    .slice(0, RECENT_MAX);
  try {
    s?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Quota/private-mode failures must never break the flow.
  }
  return list;
}

// ── BLE write response ─────────────────────────────────────────────────────

export interface WriteAssessment {
  ok: boolean;
  error?: string;
}

/**
 * The Android shell is inconsistent about write acknowledgements — some builds
 * return a JSON envelope, others a bare "success" string. Treat only an
 * explicit positive as success: a charge that silently didn't start must not
 * be reported to the operator as if it had.
 */
export function assessWriteResponse(responseData: unknown): WriteAssessment {
  try {
    let response: any = responseData;
    if (typeof responseData === 'string') {
      try {
        response = JSON.parse(responseData);
      } catch {
        const s = responseData.toLowerCase().trim();
        return s === 'success' || s === 'ok'
          ? { ok: true }
          : { ok: false, error: responseData };
      }
    }
    if (response?.respCode === '200' || response?.respCode === 200) return { ok: true };
    if (response?.respData === true || response?.respData === 'success') return { ok: true };
    if (response?.success === true) return { ok: true };
    return {
      ok: false,
      error: response?.respDesc || response?.error || response?.message || undefined,
    };
  } catch {
    return { ok: false, error: 'Unknown write response format' };
  }
}
