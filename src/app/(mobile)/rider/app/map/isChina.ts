"use client";

/**
 * China detection for the Rider map.
 *
 * The Rider map is built on Google Maps: tiles + JS SDK load from
 * `maps.googleapis.com`, routing from `routes.googleapis.com`. Every one of
 * those domains is blocked by the Great Firewall of China, so in mainland
 * China the Google map renders a blank white page. When `isChina()` is true we
 * mount a Leaflet + OpenStreetMap fallback instead (see `RiderMap.tsx`).
 *
 * Detection is proactive, synchronous, and side-effect free — no geolocation,
 * no network probe — so the map backend is chosen ONCE before first paint and
 * never flips at runtime (remounting the map blanks it).
 *
 * Signals:
 *  - **Timezone (authoritative).** Mainland China runs entirely on a single
 *    official timezone, `Asia/Shanghai` (with `Asia/Urumqi` as the unofficial
 *    Xinjiang zone and a few legacy aliases). This is the strongest offline
 *    signal that a device is inside the Great Firewall.
 *  - **`zh-CN` UI language (secondary).** Also treated as China.
 *
 * We deliberately bias toward FALSE NEGATIVES being catastrophic and FALSE
 * POSITIVES being benign: a China user wrongly sent to Google gets a permanent
 * blank page (the whole bug), whereas a non-China user wrongly sent to Leaflet
 * still gets a fully working OSM map. So detection errs on the side of "treat
 * as China" — hence the OR of the two signals rather than requiring both.
 */

/** Official + legacy IANA identifiers that mean "inside mainland China". */
const CHINA_TIMEZONES = new Set([
  "Asia/Shanghai",
  "Asia/Urumqi",
  "Asia/Chongqing",
  "Asia/Harbin",
  "Asia/Kashgar",
  "PRC",
]);

/**
 * Pure decision core. Takes the two device signals explicitly so it can be
 * unit-tested without stubbing globals. `isChina()` reads the real values from
 * `Intl` / `navigator` and delegates here.
 */
export function isChinaFrom(
  timeZone: string | undefined | null,
  language: string | undefined | null,
): boolean {
  if (timeZone && CHINA_TIMEZONES.has(timeZone)) return true;
  if (language && language.toLowerCase().startsWith("zh-cn")) return true;
  return false;
}

/**
 * Runtime check. Returns `false` during SSR (no `window`/`Intl` resolved
 * options) so the map — always loaded via `dynamic(..., { ssr: false })` —
 * decides on the client where the real signals exist.
 */
export function isChina(): boolean {
  if (typeof window === "undefined") return false;

  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }

  const language =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  return isChinaFrom(timeZone, language);
}
