"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
import { useI18n } from "@/i18n";
import { toast } from "react-hot-toast";

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

interface Station {
  id: number;
  name: string;
  distance: string;
  batteries: number;
  lat?: number;
  lng?: number;
}

interface BikeInfo {
  model: string;
  vehicleId: string | null;
  totalSwaps: number;
  lastSwap: string | null;
  paymentState: "PAID" | "RENEWAL_DUE" | "OVERDUE" | "PENDING" | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface RiderHomeProps {
  userName: string;
  balance: number;
  currency?: string;
  bike: BikeInfo;
  nearbyStations: Station[];
  isLoadingStations?: boolean;
  isLoadingBike?: boolean;
  onFindStation: () => void;
  onShowQRCode: () => void;
  onTopUp: () => void;
  onSelectStation: (stationId: number) => void;
  onViewAllStations: () => void;
}

const RiderHome: React.FC<RiderHomeProps> = ({
  userName,
  balance,
  currency = "XOF",
  bike,
  nearbyStations,
  isLoadingStations = false,
  isLoadingBike = false,
  onFindStation,
  onShowQRCode,
  onTopUp,
  onSelectStation,
  onViewAllStations,
}) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): string => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // Format distance: show meters if less than 1km, otherwise show km
      if (distance < 1) {
        return `${Math.round(distance * 1000)} m`;
      }
      return `${distance.toFixed(1)} km`;
    },
    []
  );

  // Calculate distances for all stations
  const stationsWithDistance = useMemo(() => {
    if (!userLocation) {
      return nearbyStations.map((station) => ({
        ...station,
        calculatedDistance: null,
      }));
    }

    return nearbyStations.map((station) => {
      if (!station.lat || !station.lng) {
        return { ...station, calculatedDistance: null };
      }

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        station.lat,
        station.lng
      );

      return { ...station, calculatedDistance: distance };
    });
  }, [nearbyStations, userLocation, calculateDistance]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("rider.goodMorning") || "Good morning,";
    if (hour < 17) return t("rider.goodAfternoon") || "Good afternoon,";
    return t("rider.goodEvening") || "Good evening,";
  };

  const getPaymentStateClass = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return "active";
      case "RENEWAL_DUE":
        return "warning";
      case "OVERDUE":
      case "inactive":
        return "inactive";
      case "PENDING":
        return "pending";
      default:
        return "active";
    }
  };

  const getPaymentStateLabel = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return t("common.active") || "Active";
      case "RENEWAL_DUE":
        return t("attendant.renewalDue") || "Renewal Due";
      case "OVERDUE":
      case "inactive":
        return t("attendant.overdue") || "Overdue";
      case "PENDING":
        return t("common.pending") || "Pending";
      default:
        return paymentState === "active"
          ? t("common.active") || "Active"
          : paymentState;
    }
  };

  // Load Leaflet and initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || isLoadingStations)
      return;

    const loadLeaflet = async () => {
      if (!window.L) {
        // Load Leaflet CSS
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
        document.head.appendChild(cssLink);

        // Load Leaflet JS
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
        script.onload = () => {
          initializeMap();
        };
        script.onerror = () => {
          console.error("[HOME MAP] Failed to load Leaflet library");
        };
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapContainerRef.current || !window.L) return;

      // Default center (Nairobi, Kenya)
      const defaultCenter: [number, number] = [-1.2921, 36.8219];

      // Calculate center from stations if available
      let center: [number, number] = defaultCenter;
      const validStations = nearbyStations.filter((s) => s.lat && s.lng);
      if (validStations.length > 0) {
        const avgLat =
          validStations.reduce((sum, s) => sum + (s.lat || 0), 0) /
          validStations.length;
        const avgLng =
          validStations.reduce((sum, s) => sum + (s.lng || 0), 0) /
          validStations.length;
        center = [avgLat, avgLng];
      }

      // Initialize map
      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        center: center,
        zoom: 13,
        zoomControl: true,
      });

      // Add OpenStreetMap tile layer
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      setIsMapLoaded(true);
    };

    if (nearbyStations.length > 0) {
      loadLeaflet();
    }

    return () => {
      if (routeLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      if (userLocationMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
        userLocationMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current.forEach((marker) => {
        if (marker && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    };
  }, [nearbyStations.length, isLoadingStations]);

  // Get user location (independent of map loading)
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.error("Error getting location:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Update user location marker on map when location changes and map is loaded
  useEffect(() => {
    if (!userLocation || !mapInstanceRef.current || !window.L || !isMapLoaded)
      return;

    // Add or update user location marker
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setLatLng([
        userLocation.lat,
        userLocation.lng,
      ]);
    } else {
      const userIcon = window.L.divIcon({
        className: 'custom-user-marker',
        html: `<div class="leaflet-user-marker">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <circle cx="12" cy="12" r="8"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      userLocationMarkerRef.current = window.L.marker(
        [userLocation.lat, userLocation.lng],
        { icon: userIcon }
      ).addTo(mapInstanceRef.current);
      userLocationMarkerRef.current.bindPopup(
        t("rider.yourLocation") || "My Location"
      );
    }
  }, [userLocation, isMapLoaded, t]);

  // Update markers when stations change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      if (marker && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];

    // Get first 5 stations to match the list
    const stationsToShow = nearbyStations.slice(0, 5);
    const validStations: typeof stationsToShow = [];

    // Add markers for each station
    stationsToShow.forEach((station, index) => {
      // Check if station has valid coordinates
      if (
        typeof station.lat !== "number" ||
        typeof station.lng !== "number" ||
        isNaN(station.lat) ||
        isNaN(station.lng) ||
        station.lat === 0 ||
        station.lng === 0
      ) {
        console.warn(
          `[HOME MAP] Station ${station.id} (${station.name}) has invalid coordinates:`,
          { lat: station.lat, lng: station.lng }
        );
        return;
      }

      // Add small offset for markers at exact same location to prevent overlap
      // This ensures all markers are visible even if stations are very close
      const offsetLat = station.lat + index * 0.0001; // ~11 meters per 0.0001 degree
      const offsetLng = station.lng + index * 0.0001;

      const stationIcon = window.L.divIcon({
        className: 'custom-station-marker',
        html: `<div class="leaflet-station-marker">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      const marker = window.L.marker([offsetLat, offsetLng], {
        icon: stationIcon,
      }).addTo(mapInstanceRef.current);

      marker.bindPopup(`
        <div style="color: #000; font-family: system-ui; min-width: 120px;">
          <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600;">${station.name}</h3>
          <p style="margin: 0; font-size: 11px;">Batteries: ${station.batteries}</p>
        </div>
      `);

      marker.on("click", () => {
        onSelectStation(station.id);
      });

      markersRef.current.push(marker);
      validStations.push(station);
    });

    console.info(
      `[HOME MAP] Created ${markersRef.current.length} markers out of ${stationsToShow.length} stations`
    );

    // Fit map bounds to show all stations (using original coordinates, not offset)
    if (validStations.length > 0) {
      const bounds = window.L.latLngBounds(
        validStations.map((s) => [s.lat!, s.lng!])
      );
      // Use larger padding and set maxZoom to ensure all markers are visible even if close
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 18, // Prevent zooming in too much so all markers stay visible
      });

      // If all stations are at the same location, ensure minimum zoom
      const boundsSize = bounds
        .getNorthEast()
        .distanceTo(bounds.getSouthWest());
      if (boundsSize < 100) {
        // Less than 100 meters apart
        mapInstanceRef.current.setZoom(15, { animate: false });
      }
    }
  }, [nearbyStations, isMapLoaded, onSelectStation]);

  // Handle clicking on a station - zoom to it on the map
  const handleStationClick = (
    station: Station & { calculatedDistance: string | null }
  ) => {
    if (!mapInstanceRef.current || !window.L) {
      // Map not ready, just select the station
      onSelectStation(station.id);
      return;
    }

    if (!station.lat || !station.lng) {
      toast.error(
        t("rider.stationLocationMissing") || "Station location is missing."
      );
      return;
    }

    // Remove existing route line if any
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    // Zoom to the station marker
    mapInstanceRef.current.setView([station.lat, station.lng], 16, {
      animate: true,
      duration: 0.5,
    });

    // Find and open the popup for this station marker
    markersRef.current.forEach((marker) => {
      const markerLatLng = marker.getLatLng();
      if (
        Math.abs(markerLatLng.lat - station.lat!) < 0.0001 &&
        Math.abs(markerLatLng.lng - station.lng!) < 0.0001
      ) {
        marker.openPopup();
      }
    });
  };

  const handleNavigate = (station: Station, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering handleStationClick

    if (!userLocation) {
      toast.error(
        t("rider.locationRequired") ||
          "Location is required for navigation. Please enable location services."
      );
      return;
    }

    if (!mapInstanceRef.current || !window.L) {
      toast.error(
        t("rider.mapNotReady") || "Map is not ready. Please wait a moment."
      );
      return;
    }

    if (!station.lat || !station.lng) {
      toast.error(
        t("rider.stationLocationMissing") || "Station location is missing."
      );
      return;
    }

    try {
      // Remove existing route line if any
      if (routeLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }

      // Draw a simple straight line route from user location to station
      const routeCoordinates = [
        [userLocation.lat, userLocation.lng],
        [station.lat, station.lng],
      ];

      routeLineRef.current = window.L.polyline(routeCoordinates, {
        color: "#3b82f6",
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(mapInstanceRef.current);

      // Fit map to show both locations
      const bounds = window.L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [station.lat, station.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    } catch (error: any) {
      console.error("Error drawing route:", error);
      toast.error(
        t("rider.routingError") || "Failed to draw route. Please try again."
      );
    }
  };

  return (
    <div className="rider-screen active">
      {/* Dashboard Header */}
      <div className="rider-dashboard-header">
        <div className="rider-greeting">{getGreeting()}</div>
        <div className="rider-name">{userName}</div>
      </div>

      {/* My Bike Card */}
      <div className="rider-bike-card">
        <div className="rider-bike-header">
          <div>
            <div className="rider-bike-label">
              {t("rider.myBike") || "My Bike"}
            </div>
            {/* <div className="rider-bike-model">{bike.model}</div> */}
          </div>
          <span
            className={`rider-bike-status ${getPaymentStateClass(
              bike.paymentState
            )}`}
          >
            {getPaymentStateLabel(bike.paymentState)}
          </span>
        </div>
        <div className="rider-bike-content">
          <div className="rider-bike-image">
            {bike.imageUrl ? (
              <Image
                src={bike.imageUrl}
                alt={bike.model}
                width={140}
                height={100}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <Image
                src="/assets/E-3-one.png"
                alt={bike.model}
                width={140}
                height={100}
                style={{ objectFit: "contain" }}
              />
            )}
          </div>
          <div className="rider-bike-info">
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.vehicleId") || "Vehicle ID"}
              </span>
              {isLoadingBike ? (
                <span
                  className="rider-bike-detail-value"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    className="loading-spinner"
                    style={{ width: 14, height: 14, borderWidth: 2 }}
                  ></div>
                  <span style={{ opacity: 0.6 }}>
                    {t("common.loading") || "Loading..."}
                  </span>
                </span>
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.vehicleId || "N/A"}
                </span>
              )}
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.lastSwap") || "Last Swap"}
              </span>
              {isLoadingBike ? (
                <span
                  className="rider-bike-detail-value"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    className="loading-spinner"
                    style={{ width: 14, height: 14, borderWidth: 2 }}
                  ></div>
                  <span style={{ opacity: 0.6 }}>
                    {t("common.loading") || "Loading..."}
                  </span>
                </span>
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.lastSwap || "N/A"}
                </span>
              )}
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.totalSwaps") || "Total Swaps"}
              </span>
              {isLoadingBike ? (
                <span
                  className="rider-bike-detail-value"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    className="loading-spinner"
                    style={{ width: 14, height: 14, borderWidth: 2 }}
                  ></div>
                  <span style={{ opacity: 0.6 }}>
                    {t("common.loading") || "Loading..."}
                  </span>
                </span>
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.totalSwaps}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Balance Card */}
      <div className="account-balance-card">
        <div className="account-balance-info">
          <div className="account-balance-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10"></circle>

              <path d="M12 6v12M8 10h8M8 14h8"></path>
            </svg>
          </div>
          <div>
            <div className="account-balance-label">
              {t("rider.accountBalance") || "Account Balance"}
            </div>
            <div className="account-balance-value">
              {currency} {balance.toLocaleString()}
            </div>
          </div>
        </div>
        <button className="account-balance-action" onClick={onTopUp}>
          {t("rider.topUp") || "Top Up"}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-action" onClick={onFindStation}>
          <div className="quick-action-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <span className="quick-action-label">
            {t("rider.findStation") || "Find Station"}
          </span>
        </div>
        <div className="quick-action" onClick={onShowQRCode}>
          <div className="quick-action-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <span className="quick-action-label">
            {t("rider.myQrCode") || "My QR Code"}
          </span>
        </div>
      </div>

      {/* Nearby Stations Section */}
      <div className="rider-section-header">
        <span className="rider-section-title">
          {t("rider.nearbyStations") || "Nearby Stations"}
        </span>
        {nearbyStations.length > 0 && (
          <span className="rider-section-link" onClick={onViewAllStations}>
            {t("rider.viewMap") || "View Map"}
          </span>
        )}
      </div>

      {isLoadingStations ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "40px 20px",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: 32,
              height: 32,
              borderWidth: 3,
              margin: "0 auto 16px",
            }}
          ></div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            {t("common.loading") || "Loading stations..."}
          </p>
        </div>
      ) : !isLoadingStations && nearbyStations.length === 0 ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 20px",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: "30px",
                height: "30px",
                color: "var(--text-muted)",
              }}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            {t("rider.noStationsDesc") ||
              "You need an active subscription to view available swap stations. Please subscribe to a plan to access stations."}
          </p>
        </div>
      ) : (
        <div className="stations-map-container">
          {/* OpenStreetMap */}
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: "250px",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--border)",
              background: "var(--bg-tertiary)",
              marginBottom: "12px",
            }}
          />

          {/* Station List - matching design from abs-design.vercel.app */}
          <div className="stations-list">
            {stationsWithDistance.slice(0, 5).map((station) => (
              <div
                key={station.id}
                className="station-item"
                onClick={() => handleStationClick(station)}
              >
                <div className="station-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div className="station-info">
                  <div className="station-name">{station.name}</div>
                  <div className="station-details">
                    {/* Distance with marker icon - matching abs-design.vercel.app */}
                    <span className="station-distance-info">
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="12"
                        height="12"
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      {station.calculatedDistance || station.distance}
                    </span>
                    {/* Batteries with colored availability dot */}
                    <span className="station-availability">
                      <span
                        className={`station-availability-dot ${
                          station.batteries === 0
                            ? "empty"
                            : station.batteries <= 3
                            ? "low"
                            : ""
                        }`}
                      ></span>
                      {station.batteries}{" "}
                      {station.batteries === 1
                        ? t("rider.battery") || "battery"
                        : t("rider.batteries") || "batteries"}
                    </span>
                  </div>
                </div>
                <button
                  className="station-nav-btn"
                  onClick={(e) => handleNavigate(station, e)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderHome;
