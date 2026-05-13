/**
 * Canonical BLE MAC for Android bridge calls. Native often rejects reads/writes if the
 * string does not match the address it bound at connect time (may differ from
 * advertisement formatting on some stacks).
 */
export function bleMacForNative(mac: string | null | undefined): string | null {
  if (mac == null) return null;
  let m = String(mac).trim().replace(/-/g, ':').replace(/\s+/g, '').toUpperCase();
  if (!m) return null;
  const hexOnly = m.replace(/:/g, '');
  if (!m.includes(':') && /^[0-9A-F]{12}$/i.test(hexOnly)) {
    m = (hexOnly.match(/.{1,2}/g) ?? []).join(':');
  }
  return m;
}
