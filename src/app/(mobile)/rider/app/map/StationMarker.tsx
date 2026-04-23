"use client";

import L from "leaflet";

/**
 * Station markers — sized like Google / Apple / PlugShare on mobile.
 *
 * Unselected stations use a compact 28px *round chip* showing the battery
 * count — this keeps the map readable when many stations are visible. Only
 * the selected station inflates into a 40×50 teardrop pin with a pulsing
 * halo so users always know exactly which point is active.
 *
 * Colors are inlined (not CSS vars) because Leaflet injects the HTML into a
 * pane outside the theme-scoped tree; CSS variables aren't reliably inherited
 * on every platform (iOS WKWebView in particular).
 */
export type StationMarkerVariant = "available" | "low" | "empty" | "selected";

const PALETTE = {
  available: { fill: "#10b981", text: "#ffffff" },
  low:       { fill: "#f59e0b", text: "#ffffff" },
  empty:     { fill: "#94a3b8", text: "#ffffff" }, // muted slate so empty stations recede
  selected:  { fill: "#00e5e5", text: "#0f172a" },
} as const;

export function makeStationIcon(
  variant: StationMarkerVariant,
  batteries: number,
) {
  if (variant === "selected") {
    return makeTeardropIcon(batteries);
  }
  return makeChipIcon(variant, batteries);
}

/**
 * Compact round chip — 28px, single glyph, soft shadow.
 * Anchored at its center (iconAnchor = [14,14]) so clicks feel natural.
 */
function makeChipIcon(
  variant: Exclude<StationMarkerVariant, "selected">,
  batteries: number,
) {
  const size = 28;
  const { fill, text } = PALETTE[variant];
  const label = formatBatteries(batteries);

  const html = `
    <div class="rm-chip-marker rm-chip-marker--${variant}"
         style="--rm-w:${size}px;--rm-fill:${fill};--rm-text:${text};">
      <span class="rm-chip-marker-label">${label}</span>
    </div>
  `;

  return L.divIcon({
    className: "rm-station-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
  });
}

/**
 * Selected state — teardrop pin with tail (precise pinpoint) + pulsing halo.
 */
function makeTeardropIcon(batteries: number) {
  const w = 40;
  const h = 50;
  const { fill, text } = PALETTE.selected;
  const label = formatBatteries(batteries);

  const html = `
    <div class="rm-pin rm-pin--selected" style="--rm-w:${w}px;--rm-h:${h}px;--rm-fill:${fill};--rm-text:${text};">
      <div class="rm-pin-halo"></div>
      <svg class="rm-pin-shape" viewBox="0 0 40 52" width="${w}" height="${h}" aria-hidden="true">
        <path d="M20 0C9 0 0.5 8.6 0.5 19.4c0 7.4 4 13.3 8.9 18.6 3.7 4 7.6 7.3 9.1 12 .3 1 1.6 1 1.9 0 1.5-4.7 5.5-8 9.1-12 4.9-5.3 9-11.2 9-18.6C39.5 8.6 31 0 20 0z"
          fill="${fill}" stroke="#ffffff" stroke-width="2.5" />
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
