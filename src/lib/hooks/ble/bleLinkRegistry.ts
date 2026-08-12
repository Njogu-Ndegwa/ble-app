/**
 * One place that remembers which BLE device this app has a GATT link to, so any
 * screen can release a link it did not itself open.
 *
 * Why this exists: a connected peripheral stops advertising, so it disappears
 * from every scan. If a link is left open - the WebView reloads after a deploy,
 * a read is interrupted, the user swipes out of a screen mid-connect - the
 * device becomes invisible and the only escape a user finds is restarting the
 * app and toggling Bluetooth. Releasing the remembered MAC before a scan turns
 * that dead end into a one-second self-heal.
 *
 * sessionStorage is the right scope: it survives a page reload (where the native
 * link also survives) and dies with the process (where the link dies too).
 */

const MAC_KEYS = ['connectedDeviceMac', 'pendingBleMac'] as const;

/** Record a link we just opened (or are about to open). */
export function rememberBleLink(macAddress: string): void {
  if (!macAddress) return;
  try {
    sessionStorage.setItem('connectedDeviceMac', macAddress);
  } catch {
    // sessionStorage unavailable - self-heal degrades, nothing breaks
  }
}

/** Forget a link we have deliberately closed. */
export function forgetBleLink(): void {
  try {
    MAC_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Release any link left over from an earlier screen or an earlier page load.
 *
 * Safe to call before every scan: native ignores the request when that MAC is
 * not actually connected, and we only reach here when no read is in flight.
 *
 * @returns the MAC that was released, or null if there was nothing to heal
 */
export function releaseStaleBleLink(log?: (...args: unknown[]) => void): string | null {
  try {
    const stale = MAC_KEYS.map((k) => sessionStorage.getItem(k)).find(Boolean);
    if (!stale || !window.WebViewJavascriptBridge) return null;
    log?.('Releasing stale BLE link before scan:', stale);
    window.WebViewJavascriptBridge.callHandler('disconnBleByMacAddress', stale, () => {});
    forgetBleLink();
    return stale;
  } catch {
    return null;
  }
}
