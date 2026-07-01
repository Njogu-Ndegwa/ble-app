# Rider Map — China Fallback Design

**Date:** 2026-07-01
**Status:** Draft for review
**Area:** `src/app/(mobile)/rider/app/map/`

## Problem

The Rider map renders a blank white page in mainland China. The map is built on
Google Maps: the tiles + JavaScript SDK load from `maps.googleapis.com` (via
`@vis.gl/react-google-maps`), the route line + ETA come from
`routes.googleapis.com` (`useRouting.ts`), and the "open in external maps"
button (`RiderApp.tsx` → `deepLinks.ts`) opens `www.google.com/maps`. **Every
one of these Google domains is blocked by the Great Firewall of China**, so in
China (without a VPN) the SDK never loads and the map surface is blank. It works
on devices outside China because Google is reachable there.

This is a regression from the earlier Leaflet + OpenStreetMap implementation
(the Leaflet stack — `leaflet`, `react-leaflet`, `react-leaflet-cluster`,
`leaflet-routing-machine` — is still installed in `package.json`, and code
comments still reference "the old Leaflet behavior"). OSM tiles are not blocked
in China.

## Goals

- Riders in mainland China see a working map: nearby stations, their own live
  location, and enough to head toward a station.
- Zero behavior change for riders **outside** China (the working 95%). The
  existing Google path stays byte-for-byte identical.
- "Match the rest" — the China map reuses the app's station markers, brand
  accents, and dark theme as closely as the fallback engine allows.

## Non-goals (Scope 1 — "Find & locate")

Explicitly out of scope for this change:

- **In-app turn-by-turn route line + ETA.** The Google Routes API is blocked in
  China; drawing an in-app road route would require an additional non-Google
  routing service whose China reachability we cannot guarantee. Instead, "get
  directions" deep-links out to a China-legal navigation app (Amap).
- **Tilted follow-mode navigation.** Leaflet is a 2D engine; the 45° "driving
  perspective" follow camera cannot be reproduced and depends on blocked Google
  services anyway.

These can be added later without reworking this design.

## Key decisions (agreed)

1. **Detection: proactive, China-only.** Detect China up front and render the
   Leaflet map directly; do not attempt to load Google at all in China.
2. **Scope 1 — Find & locate.** Map + station markers + user location +
   tap-to-select + straight-line distance. External navigation deep-links out.
3. **Android only.** No iOS / Apple Maps branch.
4. **Deep-link target: Amap (高德地图)** — China's most-used navigation app,
   with a graceful web fallback.
5. **Base map tiles: OSM now, Amap-ready.** Ship on OpenStreetMap tiles (no
   credentials, no coordinate conversion for display), but build the WGS-84 ↔
   GCJ-02 conversion utility now so the tile layer can be upgraded to Amap
   later with a localized change. See "Open decision" below.

## Architecture

A **backend switch behind the existing map interface.** `RiderMapProps` (the
contract in `RiderMap.tsx`) is unchanged. `RiderMap` and `RiderMapProvider`
become thin switches keyed on `isChina()`:

- **Outside China** → renders today's Google implementation, unchanged.
- **In China** → renders a new Leaflet/OSM implementation satisfying the same
  props.

Consumers — `RiderStations.tsx`, `RiderHome.tsx`, `preview-stations/page.tsx` —
do **not** change. They already import `RiderMap` / `RiderMapProvider` through a
stable interface.

Rejected alternatives:
- *Single component, swap only the tile layer.* Not viable — Google
  (`@vis.gl/react-google-maps`) and Leaflet are different render engines with
  different DOM; they cannot share one component.
- *Env flag / separate China build.* More ops overhead and does not auto-adapt;
  the user asked for automatic China handling.

## Modules

### 1. `map/isChina.ts` (new)

Pure, SSR-safe detection.

```ts
export function isChina(): boolean
```

- `true` when `Intl.DateTimeFormat().resolvedOptions().timeZone` is
  `Asia/Shanghai` or `Asia/Urumqi` (mainland China runs on a single timezone —
  a strong signal), with `navigator.language` starting `zh-CN` as a secondary
  nudge for edge cases.
- Returns `false` during SSR (`typeof window === "undefined"` /
  `typeof navigator === "undefined"`), so the map — already loaded via
  `dynamic(..., { ssr: false })` — hydrates cleanly.
- Result is stable per device, so the switch never flips at runtime and the map
  never remounts. (The existing code warns that remounting the provider blanks
  the map.)

### 2. `map/RiderMap.tsx` (edit) + `map/RiderMapGoogle.tsx` (new)

- Today's Google implementation (the current `RiderMapInner`, `MapController`,
  `StationMarkers`, `MapDebugOverlay`) moves **verbatim** into
  `RiderMapGoogle.tsx`.
- `RiderMap.tsx` becomes the thin switch:
  - Default export `RiderMap`: `isChina() ? <RiderMapLeaflet/> : <RiderMapGoogle/>`.
  - `RiderMapProvider`: in China, render `children` directly (do **not** mount
    Google's `<APIProvider>`, which would hang fetching the blocked SDK);
    outside China, mount `<APIProvider>` exactly as today.
- `RiderMapControls` interface (`recenter` / `fitAll`) is preserved and
  implemented by both backends so `RiderStations`'s `mapControlsRef` keeps
  working.

### 3. `map/RiderMapLeaflet.tsx` (new)

The China map, on `react-leaflet` + `react-leaflet-cluster`, implementing
`RiderMapProps` at Scope 1:

- **Tiles:** OSM raster via a single swappable `TILE_URL` constant. A dark CSS
  filter (`filter: invert/hue-rotate` on the tile layer) approximates the app's
  dark Google theme. (Swappable to Amap — see Open decision.)
- **Station markers:** reuse the existing `StationMarker` visuals
  (`StationPillMarker` / `StationTeardropMarker`) by rendering them to static
  markup inside a Leaflet `divIcon`, so colors/shape match the Google map.
- **Clustering:** `react-leaflet-cluster` with a cluster chip styled to match
  `buildClusterChipElement` (brand color, aggregate battery count).
- **User location:** live marker (with heading rotation via CSS) + a recenter
  action wired through `RiderMapControls.recenter`.
- **Selection:** tap a marker → `onSelectStation` → pan/zoom to it
  (`RiderMapControls`), mirroring the Google selection-pan behavior.
- **Straight-line guidance:** when a station is selected, draw a dashed
  `Polyline` from the user to the station and surface the haversine distance
  (reusing `haversineKm` from `useGeolocation`). This stands in for the Google
  route line.
- **Not implemented:** route polyline from a routing service, tilted follow
  mode. `navMode` `preview`/`following` degrade gracefully to the selection +
  straight-line behavior.

### 4. Routing degradation — `map/useRouting.ts` (edit)

Add an early China guard: when `isChina()`, the hook returns the empty result
(`path: null`, `summary: null`, `error: null`, …) and **never calls**
`routes.googleapis.com`. This prevents a hanging fetch and the "couldn't
compute route" toast storm. `RiderStations`'s preview/following chrome then has
no line and relies on the Leaflet straight-line + distance.

### 5. External navigation — `map/deepLinks.ts` (edit) + `map/gcj02.ts` (new) + `RiderApp.tsx` (edit)

- New `map/gcj02.ts`: `wgs84ToGcj02(lat, lng)` (and the inverse for
  completeness), the standard well-tested conversion. Chinese map apps use the
  GCJ-02 "offset" datum; passing raw WGS-84 lands the pin ~500 m off.
- New `amapUrl(dest, label?)` in `deepLinks.ts`: builds an Amap navigation URL
  from **GCJ-02** coordinates — the Amap app URI scheme with a graceful
  fallback to the Amap web URL (`https://uri.amap.com/...`) when the app is not
  installed. `openExternalMap` already routes through the WebView
  `openExternalUrl` bridge and guards `navigator.onLine`.
- New selector `bestDirectionsUrl(dest, { isChina })`: China → `amapUrl` (GCJ-02
  converted); otherwise → existing `googleMapsUrl`. `RiderApp.tsx`'s
  `handleNavigateToStation` (currently hard-coded to `googleMapsUrl`) calls this
  selector instead.

## Data flow

```
Rider opens app
      │
   isChina()? ──no──► RiderMapProvider mounts Google <APIProvider>
      │                └► RiderMap → RiderMapGoogle (unchanged: tiles, routes, follow-mode)
      │                └► handleNavigateToStation → googleMapsUrl
      │
     yes
      │
   RiderMapProvider renders children directly (no Google SDK)
      └► RiderMap → RiderMapLeaflet (OSM tiles, markers, location, selection, straight-line)
      └► useRouting → no-op (no Google Routes call)
      └► handleNavigateToStation → amapUrl(wgs84ToGcj02(dest))
```

No WGS-84 → GCJ-02 conversion is applied to the **in-app OSM map** (OSM is
WGS-84, same as the station/GPS coordinates). Conversion is applied **only** at
the external Amap deep-link boundary.

## Error handling / edge cases

- **SSR:** `isChina()` returns `false` on the server; the map is `ssr:false`, so
  no hydration mismatch.
- **Offline:** `openExternalMap` already blocks navigation when
  `navigator.onLine` is false (a WebView error page would otherwise replace the
  whole app).
- **Amap app not installed:** fall back to the Amap web URL.
- **Location denied/unavailable:** Leaflet map still renders stations centered on
  their bounds; the straight-line guidance simply doesn't draw (matches how the
  Google path handles a missing fix).
- **Misdetection (VPN user in China / Chinese speaker abroad):** proactive
  detection is inherently fuzzy. A VPN user in China gets the OSM map (still
  fully functional). A `zh-CN` user abroad on a non-China timezone gets Google
  (timezone is the primary gate, so this is unlikely).

## Testing

- `isChina()` — unit tests mocking timezone + language for: China timezone,
  non-China timezone, SSR (no `window`).
- `gcj02.ts` — unit tests against known reference points (WGS-84 → GCJ-02) with
  tolerance.
- `bestDirectionsUrl` / `amapUrl` — unit tests: China returns a GCJ-02 Amap URL;
  non-China returns the Google URL.
- `RiderMap` switch — render smoke test: with `isChina()` stubbed `true`,
  `RiderMap` mounts the Leaflet backend and does **not** import/instantiate the
  Google SDK; stubbed `false` mounts the Google backend.

## Risks

- **OSM tile reachability/quality in China.** `tile.openstreetmap.org` is
  generally reachable but can be slow, has a usage policy discouraging heavy
  commercial use, and has thinner street detail in China than Amap. Mitigated by
  the swappable `TILE_URL` and the Open decision below.
- **Dark-theme match via CSS filter** is an approximation, not a true dark
  cartography style. Acceptable for Scope 1.
- **GCJ-02 accuracy** affects only the external Amap pin; uses a standard,
  well-tested conversion.

## Open decision (for reviewer)

**Base-map tiles: OSM now vs. Amap now.** Because stations may physically be in
China and the map should "match the rest," Amap tiles would give better detail,
speed, and legality — at the cost of (a) an Amap **API key** you must provision
and (b) applying WGS-84 → GCJ-02 conversion to every marker (Amap tiles are
GCJ-02). This design **ships on OSM** (no credentials, conversion-free display)
and builds the GCJ-02 utility now so upgrading to Amap later is localized to
`RiderMapLeaflet.tsx`'s tile layer + a display-time coordinate map. If you'd
rather go straight to Amap tiles, say so and we fold the key + display
conversion into the plan.
