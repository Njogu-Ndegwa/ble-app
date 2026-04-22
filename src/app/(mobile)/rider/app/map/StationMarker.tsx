"use client";

import L from "leaflet";

/**
 * Factory for the station marker icons. Returns a Leaflet divIcon that uses
 * design tokens for colors so the marker follows the current theme.
 *
 * Variants:
 *  - `available` — green pulse, batteries ready
 *  - `low`       — amber ring, limited batteries
 *  - `empty`     — red fill, no batteries
 *  - `selected`  — same color as `available` but larger with white border
 */
export type StationMarkerVariant = "available" | "low" | "empty" | "selected";

export function makeStationIcon(variant: StationMarkerVariant, badge?: string | number) {
  const size = variant === "selected" ? 44 : 36;
  const fill = variantFill(variant);
  const ring = variant === "selected" ? "#ffffff" : "rgba(0,0,0,0.25)";
  const badgeHtml = badge != null
    ? `<span class="rm-station-badge">${badge}</span>`
    : "";

  const html = `
    <div class="rm-station-marker" style="--rm-size:${size}px;--rm-fill:${fill};--rm-ring:${ring};">
      <svg viewBox="0 0 24 24" width="${size * 0.5}" height="${size * 0.5}" fill="#fff" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      ${badgeHtml}
    </div>
  `;

  return L.divIcon({
    className: "rm-station-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function variantFill(variant: StationMarkerVariant): string {
  switch (variant) {
    case "available":
    case "selected":
      return "#10b981"; // success
    case "low":
      return "#f59e0b"; // warning
    case "empty":
      return "#ef4444"; // error
  }
}

/** Builds the icon for the user's live location. Rotates with heading. */
export function makeUserLocationIcon(heading: number | null) {
  const rotation = heading == null ? 0 : heading;
  const html = `
    <div class="rm-user-marker">
      <div class="rm-user-pulse"></div>
      <div class="rm-user-chevron" style="transform: rotate(${rotation}deg);">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff" aria-hidden="true">
          <path d="M12 2l6 14-6-3-6 3z"/>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    className: "rm-user-icon",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
