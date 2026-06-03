/**
 * Swap-station display map — RCU SN → friendly site name + operating hours.
 *
 * Second of the "backend-deficiency" maps (see `plan-filter.ts` for the
 * first). The fleet micro-service (`getFleetAvatarsSummary`) returns each
 * station keyed only by its RCU serial number (`oemItemID` / `opid`, e.g.
 * `SR151625050005`) plus coordinates and live charge-slot data. It does NOT
 * carry a human site name or operating hours, so we hard-code both here and
 * join them onto the live data when we build `RiderStation`s.
 *
 * To add / rename a site, or correct its hours, edit `STATION_SITES` only —
 * every surface (Rider home cards, full map, peek card) reads through the
 * helpers below, so there is a single source of truth.
 *
 * Lookups are whitespace- and case-tolerant: serials sometimes arrive padded
 * or lower-cased depending on the upstream source, and a single stray space
 * must never cause a station to render as the raw `Station SR…` fallback.
 */

export interface StationSiteInfo {
  /** Friendly display name shown across the Rider app. */
  name: string;
  /**
   * Opening time, `"HH:MM"` 24h local. Hard-coded — the backend has no hours.
   * Drives the "Ouvert / Fermé / Ferme bientôt" badge on station cards.
   */
  open: string;
  /** Closing time, `"HH:MM"` 24h local. Hard-coded — see `open`. */
  close: string;
}

/**
 * Network-wide default operating window. The backend exposes no per-site
 * hours, and ops confirmed every Lomé site keeps the same schedule today, so
 * we apply one window everywhere. When a site needs different hours, override
 * `open`/`close` on that entry instead of changing this default.
 */
const DEFAULT_HOURS = { open: '07:00', close: '19:00' } as const;

/**
 * RCU SN → site. Names supplied by ops (FR), hours hard-coded (see above).
 * Keys are the raw serials; lookups normalize so casing/whitespace drift on
 * the wire still resolves here.
 */
export const STATION_SITES: Record<string, StationSiteInfo> = {
  SR151625050001: { name: 'Omnivoltaic - Oxygene - Johnson', ...DEFAULT_HOURS },
  SR151625050002: { name: 'Omnivoltaic - Warehouse', ...DEFAULT_HOURS },
  SR151625050003: { name: 'Omnivoltaic - Oxygene - Kégue', ...DEFAULT_HOURS },
  SR151625050004: { name: 'Omnivoltaic - Agodekè', ...DEFAULT_HOURS },
  SR151625050005: { name: 'Omnivoltaic - Siège', ...DEFAULT_HOURS },
};

/** Canonicalize a serial for lookup: strip whitespace, upper-case. */
function normalizeSn(sn: string): string {
  return sn.replace(/\s+/g, '').toUpperCase();
}

// Pre-normalized index so each lookup is O(1) and tolerant of wire drift.
const SITE_INDEX: Record<string, StationSiteInfo> = Object.fromEntries(
  Object.entries(STATION_SITES).map(([sn, info]) => [normalizeSn(sn), info]),
);

/** Resolve the full site record for a serial, or `null` if unmapped. */
export function getStationSite(rcuSn?: string | null): StationSiteInfo | null {
  if (!rcuSn) return null;
  return SITE_INDEX[normalizeSn(rcuSn)] ?? null;
}

/**
 * Friendly display name for a serial. Falls back to `Station <SN>` (or a
 * caller-supplied fallback) when the serial isn't in the map, so a new
 * station the backend reports before ops has named it still renders sensibly.
 */
export function getStationDisplayName(
  rcuSn?: string | null,
  fallback?: string,
): string {
  const site = getStationSite(rcuSn);
  if (site) return site.name;
  if (fallback) return fallback;
  return rcuSn ? `Station ${rcuSn}` : 'Swap Station';
}

export type StationOpenState = 'open' | 'closed' | 'closes-soon';

/** Minutes-since-midnight from `"HH:MM"`, or `null` if malformed. */
function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** "Closes soon" threshold — flag the last 30 min before close. */
const CLOSES_SOON_MINUTES = 30;

/**
 * Open/closed state for a site at `now`, derived from its hard-coded hours so
 * static hours still drive a live-feeling badge. Handles overnight windows
 * (close < open) too. Returns `null` when hours are unparseable so callers can
 * simply hide the badge rather than show a wrong one.
 */
export function getStationOpenState(
  site: StationSiteInfo | null,
  now: Date = new Date(),
): StationOpenState | null {
  if (!site) return null;
  const open = parseHm(site.open);
  const close = parseHm(site.close);
  if (open == null || close == null) return null;

  const mins = now.getHours() * 60 + now.getMinutes();
  const overnight = close <= open;
  const isOpen = overnight
    ? mins >= open || mins < close
    : mins >= open && mins < close;
  if (!isOpen) return 'closed';

  // Minutes remaining until close (accounting for the overnight wrap).
  const untilClose = (close - mins + 1440) % 1440;
  return untilClose <= CLOSES_SOON_MINUTES ? 'closes-soon' : 'open';
}
