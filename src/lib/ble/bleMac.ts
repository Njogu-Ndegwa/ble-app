/**
 * Stable BLE MAC string for Android bridge calls (connect, initServiceBleData, read/write).
 *
 * Historically (trim + uppercase only, and case-insensitive checks) matching worked
 * across advertisement vs callback. We only normalize **safe** transforms: trim, uppercase,
 * collapse spaces, and map `-` → `:` (common across OEM scan UIs).
 *
 * We deliberately do **not** insert `:` into a bare 12-hex string: the native layer often
 * keys GATT operations on the **exact** string used at connect time; re-segmenting hex
 * can mismatch that key and break reads/writes.
 */
export function bleMacForNative(mac: string | null | undefined): string | null {
  if (mac == null) return null;
  const m = String(mac).trim().replace(/-/g, ':').replace(/\s+/g, '').toUpperCase();
  return m || null;
}
