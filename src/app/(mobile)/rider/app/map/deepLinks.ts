/**
 * External navigation URL builders.
 *
 * These are pure functions that return URL strings — no DOM / bridge side
 * effects, so they're easy to unit-test and safe to run in SSR.
 *
 * The caller decides how to open the URL (window.open, WebView bridge, etc.).
 */

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

/** Opens Apple Maps driving directions (iOS). */
export function appleMapsUrl(dest: Coords): string {
  return `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}&dirflg=d`;
}

/** Opens Waze turn-by-turn navigation. */
export function wazeUrl(dest: Coords): string {
  return `https://waze.com/ul?ll=${dest.lat}%2C${dest.lng}&navigate=yes`;
}

/**
 * Opens an external map URL. In a WebView-enabled host we delegate to the
 * bridge's `openExternalUrl` handler if available; otherwise we fall back to
 * `window.open`.
 */
export function openExternalMap(url: string): void {
  if (typeof window === "undefined") return;
  const bridge = (window as any).WebViewJavascriptBridge;
  if (bridge?.callHandler) {
    try {
      bridge.callHandler("openExternalUrl", url, () => {});
      return;
    } catch (err) {
      console.warn("[deepLinks] bridge openExternalUrl failed, falling back:", err);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
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
