/**
 * External navigation URL builders.
 *
 * These are pure functions that return URL strings — no DOM / bridge side
 * effects, so they're easy to unit-test and safe to run in SSR.
 *
 * The caller decides how to open the URL (window.open, WebView bridge, etc.).
 */

import { wgs84ToGcj02 } from "./gcj02";

export interface Coords {
  lat: number;
  lng: number;
}

/** Opens Google Maps driving directions to a destination. */
export function googleMapsUrl(dest: Coords, label?: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "driving",
  });
  if (label) params.set("destination_place_id", label);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Opens Amap (高德地图) driving navigation to a destination — the China
 * equivalent of `googleMapsUrl`, since `www.google.com/maps` is blocked by the
 * Great Firewall.
 *
 * Uses the `uri.amap.com` web endpoint, which opens the installed Amap app via
 * `callnative=1` and gracefully falls back to Amap's web map when the app is
 * absent — the "most convenient" single target for Android users in China.
 *
 * `dest` is expected in WGS-84 (our app-wide datum); we convert to GCJ-02 here
 * (`coordinate=gaode`) because Amap expects the Chinese offset datum — without
 * this the pin lands ~500 m off.
 */
export function amapUrl(dest: Coords, label?: string): string {
  const g = wgs84ToGcj02(dest.lat, dest.lng);
  const to = label
    ? `${g.lng},${g.lat},${label}`
    : `${g.lng},${g.lat}`;
  const params = new URLSearchParams({
    to,
    mode: "car",
    coordinate: "gaode",
    callnative: "1",
    src: "oves",
  });
  return `https://uri.amap.com/navigation?${params.toString()}`;
}

/**
 * Picks the right external navigation URL for the rider's environment.
 * In China → Amap (Google Maps is blocked); everywhere else → Google Maps.
 * The caller passes `isChina` (from `map/isChina`) so this stays a pure,
 * testable selector with no global reads.
 */
export function bestDirectionsUrl(
  dest: Coords,
  opts: { isChina: boolean; label?: string },
): string {
  return opts.isChina
    ? amapUrl(dest, opts.label)
    : googleMapsUrl(dest, opts.label);
}

/** Opens Apple Maps driving directions (iOS). */
export function appleMapsUrl(dest: Coords): string {
  return `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}&dirflg=d`;
}

/** Opens Waze turn-by-turn navigation. */
export function wazeUrl(dest: Coords): string {
  return `https://waze.com/ul?ll=${dest.lat}%2C${dest.lng}&navigate=yes`;
}

/**
 * Opens an external map URL safely.
 *
 * Priority order:
 *  1. `navigator.onLine` guard — if the device is offline the navigation will
 *     result in ERR_NAME_NOT_RESOLVED. In a mobile WebView that error page
 *     replaces the entire app, forcing the user to restart. We stop early and
 *     call `onError` instead.
 *  2. WebViewJavascriptBridge `openExternalUrl` — lets the native host open the
 *     URL in the system browser, completely outside the WebView. This is the
 *     safest path and never risks crashing the current page.
 *  3. `window.open` fallback — works in real browsers (new tab) but in WebViews
 *     without bridge support it may navigate the current window. We still try it
 *     as a last resort; the online check above prevents the worst crash scenario.
 *
 * Returns `true` if a navigation was dispatched, `false` if it was blocked.
 */
export function openExternalMap(
  url: string,
  onError?: (message: string) => void,
): boolean {
  if (typeof window === "undefined") return false;

  if (!navigator.onLine) {
    onError?.(
      "No internet connection. Please check your network and try again.",
    );
    return false;
  }

  const bridge = (window as any).WebViewJavascriptBridge;
  if (bridge?.callHandler) {
    try {
      bridge.callHandler("openExternalUrl", url, () => {});
      return true;
    } catch (err) {
      console.warn("[deepLinks] bridge openExternalUrl failed, falling back:", err);
    }
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch (err) {
    console.warn("[deepLinks] window.open failed:", err);
    onError?.("Could not open external link. Please try again.");
    return false;
  }
}

/** Detects the likely external map the user would prefer. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Copies a string to the system clipboard.
 *
 * Tries, in order:
 *   1. A native bridge handler (`copyToClipboard`) if the WebView host exposes
 *      one — most reliable inside restricted mobile WebViews.
 *   2. `navigator.clipboard.writeText` — the modern async API, works in any
 *      secure context (https / localhost) including most WebViews.
 *   3. A legacy `document.execCommand("copy")` fallback via a hidden
 *      `<textarea>`. Ugly but survives older Android WebViews where the
 *      Clipboard API isn't exposed.
 *
 * Returns `true` if any path reports success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const bridge = (window as any).WebViewJavascriptBridge;
  if (bridge?.callHandler) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        let settled = false;
        bridge.callHandler("copyToClipboard", text, (res: unknown) => {
          settled = true;
          resolve(res !== false);
        });
        setTimeout(() => {
          if (!settled) resolve(false);
        }, 400);
      });
      if (ok) return true;
    } catch (err) {
      console.warn("[deepLinks] bridge copyToClipboard failed:", err);
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[deepLinks] navigator.clipboard.writeText failed:", err);
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.warn("[deepLinks] execCommand copy fallback failed:", err);
    return false;
  }
}

/**
 * Formats a lat/lng pair as a human-readable, paste-friendly string.
 *
 * We fix the precision to 6 decimals (~10 cm resolution — more than enough
 * for station pinpointing) so the output is stable across different origins
 * and survives round-tripping through apps like Google Maps' search bar,
 * WhatsApp, SMS, etc.
 */
export function formatCoords(coords: Coords): string {
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}
