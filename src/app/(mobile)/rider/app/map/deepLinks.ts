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
