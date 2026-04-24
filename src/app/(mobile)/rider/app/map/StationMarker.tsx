"use client";

import React from "react";

/**
 * Station markers — styled like PlugShare / ChargePoint / Electrify America
 * on mobile.
 *
 * - **Unselected**: a compact **pill** (~40×22) carrying a lightning glyph and
 *   the available-battery count. The glyph is what makes the marker readable
 *   as an *electric asset* instead of a generic colored dot. Colors encode
 *   availability (green = plenty, amber = low, slate = empty).
 * - **Selected**: a 40×50 teardrop pin with a tail (so the exact lat/lng is
 *   pinpointed) plus a pulsing halo.
 * - **Cluster**: when stations merge at low zoom we render a branded bubble
 *   showing the station count so it's obvious this is still "your" map and
 *   not a generic cluster placeholder.
 *
 * The previous Leaflet version produced raw HTML strings for `divIcon`; with
 * Google Maps + @vis.gl we render React nodes directly inside `AdvancedMarker`,
 * so these are plain components.
 */
export type StationMarkerVariant = "available" | "low" | "empty" | "selected";

const PALETTE = {
  available: { fill: "#10b981", text: "#ffffff" },
  low:       { fill: "#f59e0b", text: "#ffffff" },
  empty:     { fill: "#94a3b8", text: "#ffffff" },
  selected:  { fill: "#00e5e5", text: "#0f172a" },
} as const;

function BoltSvg({ color }: { color: string }) {
  return (
    <svg
      className="rm-marker-bolt"
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />
    </svg>
  );
}

function formatBatteries(n: number): string {
  if (n == null || Number.isNaN(n)) return "–";
  if (n > 99) return "99+";
  return String(n);
}

/**
 * Pill marker — lightning glyph + count, rounded rectangle ~40×22.
 * Used for every non-selected station.
 */
export function StationPillMarker({
  variant,
  batteries,
}: {
  variant: Exclude<StationMarkerVariant, "selected">;
  batteries: number;
}) {
  const { fill } = PALETTE[variant];
  return (
    <div
      className={`rm-pill-marker rm-pill-marker--${variant}`}
      style={{ ["--rm-fill" as any]: fill }}
    >
      <BoltSvg color="#ffffff" />
      <span className="rm-pill-marker-label">{formatBatteries(batteries)}</span>
    </div>
  );
}

/**
 * Teardrop pin with tail (precise pinpoint) + pulsing halo.
 * Used for the currently-selected station.
 */
export function StationTeardropMarker({ batteries }: { batteries: number }) {
  const w = 40;
  const h = 50;
  const { fill, text } = PALETTE.selected;
  return (
    <div
      className="rm-pin rm-pin--selected"
      style={{
        ["--rm-w" as any]: `${w}px`,
        ["--rm-h" as any]: `${h}px`,
        ["--rm-fill" as any]: fill,
        ["--rm-text" as any]: text,
      }}
    >
      <div className="rm-pin-halo" />
      <svg
        className="rm-pin-shape"
        viewBox="0 0 40 52"
        width={w}
        height={h}
        aria-hidden="true"
      >
        <path
          d="M20 0C9 0 0.5 8.6 0.5 19.4c0 7.4 4 13.3 8.9 18.6 3.7 4 7.6 7.3 9.1 12 .3 1 1.6 1 1.9 0 1.5-4.7 5.5-8 9.1-12 4.9-5.3 9-11.2 9-18.6C39.5 8.6 31 0 20 0z"
          fill={fill}
          stroke="#ffffff"
          strokeWidth={2.5}
        />
      </svg>
      <div className="rm-pin-content">
        <BoltSvg color="#0f172a" />
        <span className="rm-pin-label">{formatBatteries(batteries)}</span>
      </div>
    </div>
  );
}

/**
 * User location — iOS/Google-style blue dot with a heading cone and a
 * gently-pulsing accuracy ring. Rendered as the content of an
 * `AdvancedMarker` centered on the rider's GPS fix.
 */
export function UserLocationMarker({ heading }: { heading: number | null }) {
  const hasHeading = typeof heading === "number" && !Number.isNaN(heading);
  return (
    <div className="rm-user">
      <div className="rm-user-accuracy" />
      {hasHeading && (
        <div
          className="rm-user-cone"
          style={{ transform: `rotate(${heading!}deg)` }}
        />
      )}
      <div className="rm-user-dot" />
    </div>
  );
}

/**
 * Cluster chip — brand-colored rounded chip showing the station count.
 * Rendered into a DOM node that we hand back to `@googlemaps/markerclusterer`
 * as an `AdvancedMarkerElement` content, so these styles stay consistent with
 * our other markers.
 *
 * The function-form (as opposed to JSX component) is here because the
 * clusterer's renderer API returns a raw `google.maps.marker.AdvancedMarkerElement`,
 * which means we build the content element imperatively rather than through React.
 */
export function buildClusterChipElement(count: number): HTMLDivElement {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  const label = count > 999 ? "999+" : String(count);

  const el = document.createElement("div");
  el.className = "rm-cluster-marker";
  el.style.setProperty("--rm-size", `${size}px`);

  const labelEl = document.createElement("span");
  labelEl.className = "rm-cluster-marker-label";
  labelEl.textContent = label;
  el.appendChild(labelEl);

  return el;
}
