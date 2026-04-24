"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import dynamic from "next/dynamic";
import {
  Navigation,
  Zap,
  X,
  Crosshair,
  MapPin,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Shuffle,
  LocateFixed,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useI18n } from "@/i18n";
import {
  useGeolocation,
  haversineKm,
  formatDistance,
  enableCompassHeading,
  type GeoStatus,
} from "../hooks/useGeolocation";
import type { GeoLocation, RiderStation, NavMode } from "../types";
import RiderDirections from "./RiderDirections";
import { useRouting } from "../map/useRouting";
import type { RiderMapControls } from "../map/RiderMap";

// Google Maps is client-only and reads `window` at module load, so the map
// must be dynamically imported with SSR disabled.
const RiderMap = dynamic(() => import("../map/RiderMap"), { ssr: false });
import {
  googleMapsUrl,
  appleMapsUrl,
  wazeUrl,
  openExternalMap,
} from "../map/deepLinks";

interface RiderStationsProps {
  stations: RiderStation[];
  isLoading: boolean;
  initialSelectedStationId?: number | null;
  onStationDeselected?: () => void;
  /** Error code from the parent stations pipeline; truthy = fetch failed. */
  stationsError?: string | null;
  /** Re-run the stations fetch pipeline. */
  onRetryStations?: () => void;
}

type View = "map" | "directions";

/**
 * Rider "Stations" screen.
 *
 * Top-level state machine over `navMode`:
 *
 *  - `idle`      - no destination chosen. Map is explorable; tapping a pin
 *                  shows the peek card with a "Navigate" button that moves
 *                  the state to `preview`.
 *  - `preview`   - a destination is set; the full route is drawn and the
 *                  camera is fit to the route exactly once. Rider can tap
 *                  "Start" to enter `following`, "Change" to reopen the
 *                  directions picker, or the End button to return to `idle`.
 *  - `following` - full-screen navigation chrome: live remaining distance +
 *                  ETA pulled from `useRouting`'s summary (which auto-
 *                  refreshes as the rider moves), camera tracks the rider
 *                  with tilt + heading. Manual map gestures pause the
 *                  auto-follow and reveal a Recenter pill.
 *
 * The state machine lives here (not inside `RiderMap`) so the screen can
 * swap its top chrome, hide/show FABs, and coordinate `useRouting` with the
 * map camera via explicit props — which is what finally eliminates the
 * zoom-in/zoom-out oscillation that plagued the old implementation.
 */
export default function RiderStations({
  stations,
  isLoading,
  initialSelectedStationId,
  onStationDeselected,
  stationsError = null,
  onRetryStations,
}: RiderStationsProps) {
  const { t } = useI18n();
  const { location, status: geoStatus, requestLocation } = useGeolocation();

  const [view, setView] = useState<View>("map");
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedStationId ?? null,
  );
  const [routeTargetId, setRouteTargetId] = useState<number | null>(null);
  const [navMode, setNavMode] = useState<NavMode>("idle");
  const [followingPaused, setFollowingPaused] = useState(false);

  const mapControlsRef = useRef<RiderMapControls | null>(null);
  const routeErrorShownKeyRef = useRef<string | null>(null);

  // If the parent hands us an initial station (e.g. rider tapped a nearby
  // card on the home screen), select it so the mini detail card is visible.
  useEffect(() => {
    if (initialSelectedStationId != null) {
      setSelectedId(initialSelectedStationId);
    }
  }, [initialSelectedStationId]);

  const withDistance = useMemo(() => {
    return stations.map((s) => {
      if (!location || s.lat == null || s.lng == null) {
        return { ...s, distanceKm: null as number | null };
      }
      return {
        ...s,
        distanceKm: haversineKm(location, { lat: s.lat, lng: s.lng }),
      };
    });
  }, [stations, location]);

  const selected = selectedId != null
    ? withDistance.find((s) => s.id === selectedId) ?? null
    : null;
  const routeTarget = routeTargetId != null
    ? withDistance.find((s) => s.id === routeTargetId) ?? null
    : null;

  // The map only ever shows this filtered set; we keep the currently-selected
  // station and the active destination pinned here so a pin never disappears
  // mid-interaction.
  const mapStations = useMemo(() => {
    return withDistance;
  }, [withDistance]);

  // Route target coord, fed into useRouting. Memoized so that its identity
  // only changes when the destination actually changes (not on every render).
  const routeDest = useMemo(() => {
    if (!routeTarget || routeTarget.lat == null || routeTarget.lng == null) {
      return null;
    }
    return { lat: routeTarget.lat, lng: routeTarget.lng };
  }, [routeTarget]);

  const routing = useRouting(
    location ? { lat: location.lat, lng: location.lng } : null,
    routeDest,
    navMode !== "idle",
  );

  // Surface routing errors without spamming: toast once per (destKey, error).
  useEffect(() => {
    if (!routing.error) {
      routeErrorShownKeyRef.current = null;
      return;
    }
    const key = `${routeDest?.lat ?? "x"},${routeDest?.lng ?? "x"}:${routing.error}`;
    if (routeErrorShownKeyRef.current === key) return;
    routeErrorShownKeyRef.current = key;
    toast.error(
      t("rider.nav.routeError") || "Couldn't compute route. Try again.",
      { duration: 4500 },
    );
  }, [routing.error, routeDest, t]);

  const handleSelect = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      if (id == null) onStationDeselected?.();
    },
    [onStationDeselected],
  );

  const clearRoute = useCallback(() => {
    setRouteTargetId(null);
    setNavMode("idle");
    setFollowingPaused(false);
  }, []);

  // Common gate for actions that need the user's position.
  const withUserLocation = useCallback(
    async (run: (loc: GeoLocation) => void) => {
      if (location) {
        run(location);
        return;
      }
      if (geoStatus === "denied" || geoStatus === "unavailable") {
        toast.error(geoErrorMessage(geoStatus, t));
        return;
      }
      const loadingToast = toast.loading(
        t("rider.locationLoading") || "Getting your location…",
      );
      try {
        const loc = await requestLocation();
        toast.dismiss(loadingToast);
        run(loc);
      } catch {
        toast.dismiss(loadingToast);
        toast.error(geoErrorMessage(geoStatus, t));
      }
    },
    [location, geoStatus, requestLocation, t],
  );

  const handleStartRoute = useCallback(
    (station: RiderStation) => {
      void withUserLocation(() => {
        setRouteTargetId(station.id);
        setSelectedId(station.id);
        setNavMode("preview");
        setFollowingPaused(false);
      });
    },
    [withUserLocation],
  );

  const handlePickDestination = useCallback(
    (station: RiderStation) => {
      setView("map");
      handleStartRoute(station);
    },
    [handleStartRoute],
  );

  // ---- Nav mode transitions ----
  const handleStartFollowing = useCallback(() => {
    if (!routeTargetId) return;
    // Request compass permission on iOS from this user gesture so follow
    // mode has a heading even when stationary. No-op elsewhere.
    void enableCompassHeading();
    setFollowingPaused(false);
    setNavMode("following");
  }, [routeTargetId]);

  const handleEndNavigation = useCallback(() => {
    clearRoute();
    // Stay on the station screen; rider may want to pick a different one.
  }, [clearRoute]);

  const handleChangeDestination = useCallback(() => {
    // Keep navMode as-is so the map doesn't snap out of follow-mode
    // visually while the directions sheet is up. Picking a new destination
    // calls handlePickDestination → setNavMode('preview').
    setView("directions");
  }, []);

  const handleRecenterFollow = useCallback(() => {
    setFollowingPaused(false);
    if (location && mapControlsRef.current) {
      mapControlsRef.current.recenter(location);
    }
  }, [location]);

  const handleRecenterIdle = useCallback(() => {
    void withUserLocation((loc) => {
      void enableCompassHeading();
      mapControlsRef.current?.recenter(loc);
    });
  }, [withUserLocation]);

  const handleOpenExternal = (
    app: "google" | "apple" | "waze",
    station: RiderStation,
  ) => {
    if (station.lat == null || station.lng == null) return;
    const dest = { lat: station.lat, lng: station.lng };
    const url =
      app === "google"
        ? googleMapsUrl(dest, station.name)
        : app === "apple"
          ? appleMapsUrl(dest)
          : wazeUrl(dest);
    openExternalMap(url);
  };

  // Directions sub-view renders edge-to-edge; no map behind it.
  if (view === "directions") {
    return (
      <div
        className="rider-screen active rm-screen"
        style={{ padding: 0, position: "relative", height: "100%" }}
      >
        <RiderDirections
          stations={stations}
          isLoading={isLoading}
          activeDestinationId={routeTargetId}
          onClose={() => setView("map")}
          onPick={handlePickDestination}
          onClearDestination={() => {
            clearRoute();
            setView("map");
          }}
        />
      </div>
    );
  }

  const isFollowing = navMode === "following";
  const isPreview = navMode === "preview";

  return (
    <div
      className="rider-screen active rm-screen"
      style={{ padding: 0, position: "relative", height: "100%" }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <RiderMap
          stations={mapStations}
          userLocation={location}
          selectedStationId={selectedId}
          onSelectStation={handleSelect}
          routePath={routing.path}
          routeBounds={routing.bounds}
          routeKey={routing.destKey}
          navMode={navMode}
          followingPaused={followingPaused}
          onFollowingPausedChange={setFollowingPaused}
          mapControlsRef={mapControlsRef}
        />

        {/* ----- Top chrome ----- */}
        {isFollowing && routeTarget ? (
          // Follow-mode navigation chrome: prominent banner that makes it
          // unambiguous the rider IS navigating, with live distance + ETA
          // and End / Change actions front and center.
          <div className="rm-chrome-top rm-chrome-top--following">
            <div className="rm-nav-chrome">
              <div className="rm-nav-chrome-main">
                <div className="rm-nav-chrome-icon">
                  <Navigation size={16} />
                </div>
                <div className="rm-nav-chrome-text">
                  <div className="rm-nav-chrome-label">
                    {t("rider.nav.navigatingTo") || "Navigating to"}
                  </div>
                  <div className="rm-nav-chrome-name">{routeTarget.name}</div>
                </div>
                <button
                  type="button"
                  className="rm-nav-chrome-end"
                  onClick={handleEndNavigation}
                  aria-label={t("rider.nav.end") || "End"}
                >
                  <Square size={12} fill="currentColor" />
                  <span>{t("rider.nav.end") || "End"}</span>
                </button>
              </div>
              <div className="rm-nav-chrome-stats">
                <div className="rm-nav-chrome-stat">
                  <span className="rm-nav-chrome-stat-value">
                    {routing.summary
                      ? formatEta(routing.summary.durationMin)
                      : routeTarget.distanceKm != null
                        ? estEtaFromKm(routeTarget.distanceKm)
                        : "—"}
                  </span>
                  <span className="rm-nav-chrome-stat-label">
                    {t("rider.nav.arrivingIn") || "ETA"}
                  </span>
                </div>
                <div className="rm-nav-chrome-stat">
                  <span className="rm-nav-chrome-stat-value">
                    {routing.summary
                      ? formatDistance(routing.summary.distanceKm)
                      : routeTarget.distanceKm != null
                        ? formatDistance(routeTarget.distanceKm)
                        : "—"}
                  </span>
                  <span className="rm-nav-chrome-stat-label">
                    {t("rider.nav.remaining") || "Remaining"}
                  </span>
                </div>
                <button
                  type="button"
                  className="rm-nav-chrome-change"
                  onClick={handleChangeDestination}
                  aria-label={t("rider.nav.change") || "Change"}
                >
                  <Shuffle size={13} />
                  <span>{t("rider.nav.change") || "Change"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : routeTarget && isPreview ? (
          // Preview banner: showing the route, rider hasn't started yet.
          // "Start" promotes the flow to `following`.
          <div className="rm-chrome-top">
            <div className="rm-route-preview">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-brand)" }}
              >
                <Navigation size={15} color="#0f172a" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-text-muted leading-tight">
                  {t("rider.stations.routingTo") || "Routing to"}
                </div>
                <div className="text-sm font-semibold text-text-primary truncate">
                  {routeTarget.name}
                </div>
                {routing.summary && (
                  <div className="text-[11px] text-text-secondary mt-0.5">
                    {formatDistance(routing.summary.distanceKm)} ·{" "}
                    {formatEta(routing.summary.durationMin)}
                  </div>
                )}
              </div>
              <button
                onClick={handleStartFollowing}
                className="rm-route-preview-start"
                aria-label={t("rider.nav.start") || "Start"}
              >
                <Play size={13} fill="currentColor" />
                <span>{t("rider.nav.start") || "Start"}</span>
              </button>
              <button
                onClick={() => setView("directions")}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                aria-label={t("rider.directions.change") || "Change"}
              >
                {t("rider.directions.change") || "Change"}
              </button>
              <button
                onClick={clearRoute}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                aria-label={t("rider.stations.endRoute") || "End route"}
                title={t("rider.stations.endRoute") || "End route"}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Routing error pill (preview-mode only; in follow-mode the
            existing stats stay stale but visible, which is less jarring). */}
        {routing.error && isPreview && (
          <div className="rm-route-error">
            <AlertCircle size={14} />
            <span>
              {t("rider.nav.routeError") ||
                "Couldn't compute route. Try again."}
            </span>
            <button
              type="button"
              onClick={() => setView("directions")}
              className="rm-route-error-retry"
            >
              <RefreshCw size={12} />
              <span>{t("rider.directions.retry") || "Retry"}</span>
            </button>
          </div>
        )}

        {/* Recenter pill — visible only when following is active but paused
            because the rider manually panned/zoomed the map. */}
        {isFollowing && followingPaused && (
          <button
            type="button"
            className="rm-recenter-pill"
            onClick={handleRecenterFollow}
          >
            <LocateFixed size={14} />
            <span>{t("rider.nav.recenter") || "Recenter"}</span>
          </button>
        )}

        {/* Right-side FAB column. Hidden while following — the nav chrome
            owns the controls in that mode, and free-floating FABs on top
            of the tilted map feel visually noisy. */}
        {!isFollowing && (
          <div
            className="rm-fab-stack"
            style={{ bottom: selected && !isPreview ? 180 : 24 }}
          >
            {selected && !routeTarget && (
              <button
                className="rm-fab"
                onClick={() => handleSelect(null)}
                aria-label={t("common.clear") || "Clear"}
                title={t("common.clear") || "Clear"}
              >
                <X size={18} />
              </button>
            )}
            <button
              className="rm-fab"
              onClick={handleRecenterIdle}
              aria-label={t("rider.map.locateMe") || "Locate me"}
              title={t("rider.map.locateMe") || "Locate me"}
            >
              <LocateFixed size={18} />
            </button>
            <button
              className="rm-fab rm-fab--primary"
              onClick={() => setView("directions")}
              aria-label={t("rider.stations.whereTo") || "Where to?"}
              title={t("rider.stations.whereTo") || "Where to?"}
            >
              <Navigation size={18} />
            </button>
          </div>
        )}

        {/* Bottom peek card — only when a station pin is tapped and we're
            NOT in preview/following (where the top chrome already tells the
            whole story). */}
        {selected && !isPreview && !isFollowing && (
          <StationPeekCard
            station={selected}
            isActiveDestination={selected.id === routeTargetId}
            onClose={() => handleSelect(null)}
            onNavigate={() => handleStartRoute(selected)}
            onOpenExternal={(app) => handleOpenExternal(app, selected)}
            canRoute={geoStatus !== "denied" && geoStatus !== "unavailable"}
            liveSummary={
              routing.summary && selected.id === routeTargetId
                ? routing.summary
                : null
            }
            t={t}
          />
        )}

        {/* Stations still loading? Show a small top-center toast-like pill. */}
        {isLoading && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[460] flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-bg-secondary shadow-lg text-xs text-text-secondary">
            <div
              className="loading-spinner"
              style={{ width: 12, height: 12, borderWidth: 2 }}
            />
            <span>
              {t("rider.directions.loadingStations") || "Loading stations…"}
            </span>
          </div>
        )}

        {/* Fetch failed? Surface an error card centered on the map so the
            rider knows the map is blank because of a load failure, not an
            empty area. Retry button re-runs the full pipeline. */}
        {!isLoading && stationsError && stations.length === 0 && (
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 z-[460] rounded-2xl border border-border bg-bg-secondary shadow-2xl p-5 max-w-sm mx-auto">
            <div className="flex flex-col items-center text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(239, 68, 68, 0.12)" }}
              >
                <AlertCircle size={22} color="#ef4444" />
              </div>
              <p className="text-sm font-semibold text-text-primary mb-1">
                {t("rider.stations.loadError") ||
                  "Couldn't load stations"}
              </p>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                {t("rider.stations.loadErrorHint") ||
                  "Check your connection and try again."}
              </p>
              {onRetryStations && (
                <button
                  type="button"
                  onClick={onRetryStations}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--color-brand)",
                    color: "#0f172a",
                  }}
                >
                  <RefreshCw size={14} />
                  <span>{t("rider.directions.retry") || "Retry"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Finished loading but no stations returned and no error: the rider
            genuinely has no stations yet. Show a minimal pill so the empty
            map isn't ambiguous. */}
        {!isLoading && !stationsError && stations.length === 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[460] flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-bg-secondary shadow-lg text-xs text-text-secondary">
            <MapPin size={12} />
            <span>
              {t("rider.noStationsFound") || "No stations found"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- bottom peek card for a tapped pin ----------
interface StationPeekCardProps {
  station: RiderStation & { distanceKm: number | null };
  isActiveDestination: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onOpenExternal: (app: "google" | "apple" | "waze") => void;
  canRoute: boolean;
  liveSummary: { distanceKm: number; durationMin: number } | null;
  t: (key: string, vars?: any) => string | null | undefined;
}

function StationPeekCard({
  station,
  isActiveDestination,
  onClose,
  onNavigate,
  onOpenExternal,
  canRoute,
  liveSummary,
  t,
}: StationPeekCardProps) {
  const status: "available" | "low" | "empty" =
    station.batteries === 0
      ? "empty"
      : station.batteries <= 2
        ? "low"
        : "available";
  const statusLabel =
    status === "empty"
      ? t("rider.map.empty") || "Empty"
      : status === "low"
        ? t("rider.map.low") || "Low"
        : t("rider.map.available") || "Available";
  const statusColor =
    status === "available"
      ? "#10b981"
      : status === "low"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div
      className="absolute left-3 right-3 bottom-3 z-[455] rounded-2xl border border-border bg-bg-secondary shadow-2xl p-3"
      style={{ animation: "fadeIn 180ms ease-out" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${statusColor}26`,
            color: statusColor,
          }}
        >
          <Zap size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-semibold text-text-primary truncate">
              {station.name}
            </div>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
              style={{
                backgroundColor: `${statusColor}26`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Zap size={11} />
              <span className="font-semibold text-text-primary">
                {station.batteries}
              </span>
            </span>
            {station.distanceKm != null && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Crosshair size={11} />
                  {/* Prefer the live routing distance when this station is
                      the active destination so numbers match the nav chrome. */}
                  {liveSummary
                    ? formatDistance(liveSummary.distanceKm)
                    : formatDistance(station.distanceKm)}
                </span>
                <span className="opacity-40">·</span>
                <span>
                  {liveSummary
                    ? formatEta(liveSummary.durationMin)
                    : `${estEtaFromKm(station.distanceKm)} (est.)`}
                </span>
              </>
            )}
          </div>
          {station.address && (
            <div className="mt-1 text-[11px] text-text-muted flex items-center gap-1 truncate">
              <MapPin size={10} />
              <span className="truncate">{station.address}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
          aria-label={t("common.close") || "Close"}
        >
          <X size={13} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onNavigate}
          disabled={!canRoute}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            backgroundColor: "var(--color-brand)",
            color: "#0f172a",
          }}
        >
          <Navigation size={14} />
          <span>
            {isActiveDestination
              ? t("rider.directions.routingHere") || "Routing here"
              : t("rider.map.navigate") || "Navigate"}
          </span>
        </button>
        <button
          onClick={() => onOpenExternal("google")}
          className="h-9 px-3 rounded-xl text-xs font-medium border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          {t("rider.map.openInGoogle") || "Google"}
        </button>
      </div>
    </div>
  );
}

// ---------- helpers ----------

/** Human-friendly ETA from duration in minutes. */
function formatEta(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Haversine-based ETA estimate assuming ~25 km/h urban two-wheeler pace.
 *  Used only as a fallback before Routes API returns a real duration. */
function estEtaFromKm(km: number): string {
  return formatEta(Math.max(1, (km / 25) * 60));
}

function geoErrorMessage(
  status: GeoStatus,
  t: (key: string, vars?: any) => string | null | undefined,
): string {
  if (status === "denied") {
    return (
      t("rider.locationDenied") ||
      "Location permission denied. Please enable location services."
    );
  }
  if (status === "unavailable") {
    return (
      t("rider.locationUnavailable") ||
      "Location is not available in this browser."
    );
  }
  if (status === "locating" || status === "idle") {
    return t("rider.locationLoading") || "Getting your location…";
  }
  return t("rider.locationRequired") || "Location is not available";
}
