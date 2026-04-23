"use client";

import L from "leaflet";

/**
 * Station marker — "teardrop pin with tail".
 *
 * The tail's tip lands on the exact coordinate (iconAnchor is at the bottom
 * center). The body carries the battery count in bold, so users can scan
 * availability at a glance. Color is the status:
 *   - available  → success green
 *   - low        → warning amber
 *   - empty      → error red
 *   - selected   → brand accent, bigger, white ring, pulsing halo
 *
 * All colors are inlined (not CSS vars) because Leaflet renders the HTML in a
 * pane outside the theme-scoped tree and some CSS vars aren't inherited on
 * every platform (iOS WKWebView in particular).
 */
export type StationMarkerVariant = "available" | "low" | "empty" | "selected";

const PALETTE = {
  available: { fill: "#10b981", ring: "#ffffff", text: "#ffffff" },
  low:       { fill: "#f59e0b", ring: "#ffffff", text: "#ffffff" },
  empty:     { fill: "#ef4444", ring: "#ffffff", text: "#ffffff" },
  selected:  { fill: "#00e5e5", ring: "#0f172a", text: "#0f172a" },
} as const;

export function makeStationIcon(
  variant: StationMarkerVariant,
  batteries: number,
) {
  const isSelected = variant === "selected";
  const w = isSelected ? 52 : 42;
  const h = isSelected ? 64 : 52;
  const { fill, ring, text } = PALETTE[variant];

  const label = formatBatteries(batteries);
  const halo = isSelected ? `<div class="rm-pin-halo"></div>` : "";

  // Teardrop: circle body + pointed tail drawn with SVG so the anchor is
  // perfectly aligned with the bottom point.
  const html = `
    <div class="rm-pin rm-pin--${variant}" style="--rm-w:${w}px;--rm-h:${h}px;--rm-fill:${fill};--rm-ring:${ring};--rm-text:${text};">
      ${halo}
      <svg class="rm-pin-shape" viewBox="0 0 40 52" width="${w}" height="${h}" aria-hidden="true">
        <path d="M20 0C9 0 0.5 8.6 0.5 19.4c0 7.4 4 13.3 8.9 18.6 3.7 4 7.6 7.3 9.1 12 .3 1 1.6 1 1.9 0 1.5-4.7 5.5-8 9.1-12 4.9-5.3 9-11.2 9-18.6C39.5 8.6 31 0 20 0z"
          fill="${fill}" stroke="${ring}" stroke-width="2.5" />
      </svg>
      <span class="rm-pin-label">${label}</span>
    </div>
  `;

  return L.divIcon({
    className: "rm-station-icon",
    html,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2], // tail tip = exact lat/lng
    popupAnchor: [0, -h],
  });
}

function formatBatteries(n: number): string {
  if (n == null || Number.isNaN(n)) return "–";
  if (n > 99) return "99+";
  return String(n);
}

/**
 * User location — iOS/Google-style blue dot.
 *
 * - Outer translucent "accuracy" ring that gently pulses
 * - Solid inner dot with white ring for contrast on both light & dark maps
 * - If heading is available, a small directional cone is added above the dot
 */
export function makeUserLocationIcon(heading: number | null) {
  const hasHeading = typeof heading === "number" && !Number.isNaN(heading);
  const rotation = hasHeading ? heading! : 0;
  const cone = hasHeading
    ? `<div class="rm-user-cone" style="transform: rotate(${rotation}deg);"></div>`
    : "";

  const html = `
    <div class="rm-user">
      <div class="rm-user-accuracy"></div>
      ${cone}
      <div class="rm-user-dot"></div>
    </div>
  `;

  return L.divIcon({
    className: "rm-user-icon",
    html,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
