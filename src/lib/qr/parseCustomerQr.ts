/**
 * Parse the text content of a scanned customer QR code into a normalized shape.
 *
 * A customer QR may carry either a bare subscription code (a raw string) or a
 * JSON object. This mirrors the attendant/sales `processCustomerQRData`
 * normalization exactly, so the Top-Up scan path behaves identically to the
 * swap workflow:
 *   - raw / primitive text  → the text IS the subscription code
 *   - JSON object           → read subscription_code | subscriptionCode |
 *                             subscription.code, plus optional name/phone/id
 *
 * Returns null when there is no usable subscription code (e.g. an empty scan or
 * a JSON object with no recognizable subscription field), so callers can show a
 * "couldn't read that" message instead of identifying an empty code.
 *
 * NOTE: this parses the QR *content*. The native scanner envelope
 * (`{ respData: { value } }`) is unwrapped by `useQrScan` before this runs.
 */
export interface ParsedCustomerQr {
  subscriptionCode: string;
  name?: string;
  phone?: string;
  customerId?: string;
}

export function parseCustomerQr(qrContent: string): ParsedCustomerQr | null {
  if (typeof qrContent !== 'string') return null;
  const raw = qrContent.trim();
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  // Primitive (bare code, number, quoted string, etc.) → the raw text is the
  // subscription code. Matches the attendant fallback, which uses the original
  // scanned string whenever the parsed value isn't a JSON object.
  if (data === null || typeof data !== 'object') {
    return { subscriptionCode: raw };
  }

  const obj = data as Record<string, unknown> & {
    subscription?: { code?: unknown };
    customer?: { id?: unknown };
  };

  // `||` (not `??`) to match the attendant/sales normalization exactly: an
  // empty-string code must fall through to the next alias, not stop the chain.
  const rawCode =
    obj.subscription_code || obj.subscriptionCode || obj.subscription?.code;
  const code = rawCode != null ? String(rawCode).trim() : '';
  if (!code) return null;

  const name = obj.name || obj.customer_name;
  const phone = obj.phone || obj.customer_phone;
  const customerId = obj.customer_id || obj.customerId || obj.customer?.id;

  return {
    subscriptionCode: code,
    name: typeof name === 'string' && name ? name : undefined,
    phone: typeof phone === 'string' && phone ? phone : undefined,
    customerId: customerId != null ? String(customerId) : undefined,
  };
}
