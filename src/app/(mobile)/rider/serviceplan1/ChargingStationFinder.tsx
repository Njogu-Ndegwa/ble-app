"use client";
import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Battery,
  RefreshCw,
  Navigation,
  Zap,
  Filter,
  X,
  Wrench,
  Loader2,
  Hammer
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useBridge } from "@/app/context/bridgeContext";

interface Station {
  id: number;
  name: string;
  location: string;
  distance: string;
  batteryLevel: number;
  availableChargers: number;
  status: string;
  lat: number;
  lng: number;
  fleetId: string;
}

interface FilterOptions {
  name: string;
  minDistance: string | null;
  maxDistance: number | null;
  minBatteryLevel: number | null;
  minAvailableChargers: number | null;
  sortBy: "name" | "distance" | "batteryLevel" | "availableChargers";
  sortOrder: "asc" | "desc";
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  locationName?: string;
  [key: string]: any;
}

interface FleetIds {
  [serviceType: string]: string[];
}

interface WebViewJavascriptBridge {
  init: (
    callback: (message: any, responseCallback: (response: any) => void) => void
  ) => void;
  registerHandler: (
    handlerName: string,
    handler: (data: string, responseCallback: (response: any) => void) => void
  ) => void;
  callHandler: (
    handlerName: string,
    data: any,
    callback: (responseData: string) => void
  ) => void;
}

declare global {
  interface Window {
    L: any;
    showStationDetails?: (stationId: number) => void;
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

interface ChargingStationFinderProps {
  lastKnownLocation: LocationData | null;
  fleetIds: FleetIds | null;
  stations?: Station[];
  isLoadingStations?: boolean;
}

const ChargingStationFinder = ({
  lastKnownLocation,
  fleetIds,
  stations: propStations,
  isLoadingStations: propIsLoadingStations = false,
}: ChargingStationFinderProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeControlRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedService, setSelectedService] = useState<"battery_swap" | "maintenance" | "multi_service" | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    name: "",
    minDistance: null,
    maxDistance: null,
    minBatteryLevel: null,
    minAvailableChargers: null,
    sortBy: "distance",
    sortOrder: "asc",
  });
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [isShowcasing, setIsShowcasing] = useState(false);
  // Initialize with empty array - will be populated from props or API
  const [stations, setStations] = useState<Station[]>([]);
  const { bridge } = useBridge();

  // Use stations from props if available, otherwise fetch from API
  useEffect(() => {
    // If stations are provided as props, use them directly (even if empty array)
    if (propStations !== undefined) {
      console.info("ChargingStationFinder: Using stations from props:", propStations.length, propStations);
      setStations(propStations);
      return;
    }

    // Otherwise, fetch stations from API (fallback) using GraphQL
    const fetchRealStations = async () => {
      if (!fleetIds || !fleetIds.swap_station_fleet || fleetIds.swap_station_fleet.length === 0) {
        return;
      }

      try {
        console.info("ChargingStationFinder: Fetching real stations from GraphQL API for fleet IDs:", fleetIds.swap_station_fleet);
        
        // Use the thing microservice GraphQL endpoint
        const graphqlEndpoint = "https://thing-microservice-prod.omnivoltaic.com/graphql";
        
        // Get access token for authentication
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        
        // GraphQL query
        const query = `
          query GetFleetAvatars($fleetIds: [String!]!) {
            getFleetAvatarsSummary(fleetIds: $fleetIds) {
              fleets {
                fleetId
                items {
                  oemItemID
                  opid
                  updatedAt
                  coordinates {
                    plat
                    plong
                  }
                  Charge_slot {
                    cnum
                    btid
                    chst
                    rsoc
                    reca
                    pckv
                    pckc
                  }
                }
              }
              missingFleetIds
            }
          }
        `;

        const response = await fetch(graphqlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            query,
            variables: {
              fleetIds: fleetIds.swap_station_fleet,
            },
          }),
        });

        console.info(`ChargingStationFinder: Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ChargingStationFinder: Failed to fetch stations:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          return;
        }

        const result = await response.json();
        
        if (result.errors) {
          console.error("ChargingStationFinder: GraphQL errors:", result.errors);
          return;
        }

        const data = result.data?.getFleetAvatarsSummary;
        console.info(`ChargingStationFinder: GraphQL API response received`);

        if (!data || !data.fleets || !Array.isArray(data.fleets)) {
          console.warn("ChargingStationFinder: Invalid response structure from GraphQL API");
          return;
        }

        // Process all fleet responses
        const allStations: Station[] = [];

        // Process each fleet in the response
        data.fleets.forEach((fleet: any) => {
          const fleetId = fleet.fleetId;
          const items = fleet.items || [];

          console.info(`ChargingStationFinder: Found ${items.length} stations for fleet ${fleetId}`);

          // Transform API response to Station format
          items.forEach((stationData: any, index: number) => {
            const coordinates = stationData.coordinates;
            if (!coordinates || typeof coordinates.plat !== 'number' || typeof coordinates.plong !== 'number') {
              return;
            }

            const chargeSlots = stationData.Charge_slot || [];
            
            // Count available slots (chst === 0 and btid is not empty)
            const availableSlots = chargeSlots.filter((slot: any) => 
              slot.chst === 0 && slot.btid && slot.btid.trim() !== ""
            ).length;
            const totalSlots = chargeSlots.length;
            
            // Calculate average battery level from slots with battery (rsoc > 0)
            const slotsWithBattery = chargeSlots.filter((slot: any) => 
              slot.rsoc > 0 && slot.btid && slot.btid.trim() !== ""
            );
            const avgBatteryLevel = slotsWithBattery.length > 0
              ? slotsWithBattery.reduce((sum: number, slot: any) => sum + (slot.rsoc || 0), 0) / slotsWithBattery.length
              : 0;

            // Generate unique ID from fleet ID, opid, and index
            const opid = stationData.opid || "";
            const stationId = Math.abs(
              parseInt(fleetId.substring(fleetId.length - 8), 36) + 
              (opid ? parseInt(opid.substring(opid.length - 4), 36) : 0) + 
              index
            ) % 100000;

            allStations.push({
              id: stationId,
              name: opid ? `Station ${opid}` : `Swap Station ${index + 1}`,
              location: `${coordinates.plat.toFixed(4)}, ${coordinates.plong.toFixed(4)}`,
              distance: "N/A", // Will be calculated later
              batteryLevel: Math.round(avgBatteryLevel * 100) / 100,
              availableChargers: availableSlots,
              status: availableSlots > 0 ? "available" : availableSlots === 0 && totalSlots > 0 ? "busy" : "limited",
              lat: coordinates.plat,
              lng: coordinates.plong,
              fleetId: fleetId,
            } as Station);
          });
        });

        if (allStations.length > 0) {
          console.info(`Fetched ${allStations.length} real stations from API`);
          // Calculate distances and filter by location
          const location = lastKnownLocation || {
            latitude: -1.2921,
            longitude: 36.8219,
          };
          
          // Filter stations within 500km radius (adjustable)
          const maxRadiusKm = 500;
          const nearbyStations = allStations
            .map((station) => {
              const distanceKm = calculateDistanceKm(
                location.latitude,
                location.longitude,
                station.lat,
                station.lng
              );
              return {
                ...station,
                distance: calculateDistance(
                  location.latitude,
                  location.longitude,
                  station.lat,
                  station.lng
                ),
                distanceKm, // Store numeric distance for filtering
              };
            })
            .filter((station) => station.distanceKm <= maxRadiusKm);

          console.info(
            `Filtered to ${nearbyStations.length} stations within ${maxRadiusKm}km of user location`
          );

          if (nearbyStations.length > 0) {
            // Remove distanceKm property before setting state (it's not part of Station interface)
            const stationsToDisplay = nearbyStations.map(({ distanceKm, ...station }) => station);
            setStations(stationsToDisplay);
          } else {
            console.warn(
              `No stations found within ${maxRadiusKm}km. Showing all stations instead.`
            );
            // If no nearby stations, show all stations (fallback)
            const stationsWithDistance = allStations.map((station) => ({
              ...station,
              distance: calculateDistance(
                location.latitude,
                location.longitude,
                station.lat,
                station.lng
              ),
            }));
            setStations(stationsWithDistance);
          }
        } else {
          console.warn("No real stations fetched from API, keeping demo stations");
        }
      } catch (error) {
        console.error("Error fetching real stations:", error);
      }
    };

    // Only fetch if propStations is not provided (undefined)
    if (propStations === undefined) {
      fetchRealStations();
    }
  }, [fleetIds, lastKnownLocation, propStations]);

  useEffect(() => {
    // Apply filters whenever stations or fleetIds change
    // Use propStations if available (most up-to-date), otherwise use stations state
    const stationsToFilter = propStations !== undefined ? propStations : stations;
    
    if (fleetIds) {
      const validFleetIds = Object.values(fleetIds).flat();
      console.info("ChargingStationFinder: useEffect - Applying filters with stations:", stationsToFilter.length, "fleetIds:", validFleetIds, "using propStations:", propStations !== undefined);
      applyFilters(stationsToFilter, validFleetIds);
    } else {
      console.info("ChargingStationFinder: useEffect - Applying filters with stations:", stationsToFilter.length, "no fleetIds", "using propStations:", propStations !== undefined);
      applyFilters(stationsToFilter, null);
    }
  }, [fleetIds, stations, propStations]);

  // Calculate distance in kilometers (returns number)
  const calculateDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
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
    return R * c;
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon3: number
  ): string => {
    const distance = calculateDistanceKm(lat1, lon1, lat2, lon3);
    return distance.toFixed(1) + " km";
  };

  useEffect(() => {
    const location = lastKnownLocation || {
      latitude: -1.2921,
      longitude: 36.8219,
    };
    const updatedStations = stations.map((station) => ({
      ...station,
      distance: calculateDistance(
        location.latitude,
        location.longitude,
        station.lat,
        station.lng
      ),
    }));
    setStations(updatedStations);
    applyFilters(
      updatedStations,
      fleetIds ? Object.values(fleetIds).flat() : null
    );
    if (mapInstanceRef.current && lastKnownLocation) {
      mapInstanceRef.current.setView(
        [lastKnownLocation.latitude, lastKnownLocation.longitude],
        12
      );
    }
  }, [lastKnownLocation]);

  const applyFilters = (
    stationsToFilter: Station[],
    validFleetIds: string[] | null
  ) => {
    console.info("ChargingStationFinder: applyFilters called with", stationsToFilter.length, "stations, validFleetIds:", validFleetIds);
    let result = [...stationsToFilter];
    let showcasing = false;
    if (validFleetIds && validFleetIds.length > 0) {
      const beforeFilter = result.length;
      result = result.filter((station) => {
        const included = validFleetIds.includes(station.fleetId);
        if (!included) {
          console.warn(`ChargingStationFinder: Station ${station.name} (fleetId: ${station.fleetId}) filtered out - not in validFleetIds`);
        }
        return included;
      });
      console.info(`ChargingStationFinder: Filtered ${beforeFilter} stations to ${result.length} based on fleetIds`);
    } else {
      console.info("ChargingStationFinder: No fleetIds filter applied, showing all stations");
    }
    if (result.length === 0 && validFleetIds && validFleetIds.length > 0) {
      result = [...stationsToFilter];
      showcasing = true;
    }
    if (filterOptions.name) {
      result = result.filter((station) =>
        station.name.toLowerCase().includes(filterOptions.name.toLowerCase())
      );
    }
    if (filterOptions.minDistance !== null) {
      result = result.filter((station) => {
        const distance = parseFloat(station.distance.split(" ")[0]);
        return (
          !isNaN(distance) &&
          distance >= parseFloat(filterOptions.minDistance as string)
        );
      });
    }
    if (filterOptions.maxDistance !== null) {
      result = result.filter((station) => {
        const distance = parseFloat(station.distance.split(" ")[0]);
        return (
          !isNaN(distance) && distance <= (filterOptions.maxDistance as number)
        );
      });
    }
    if (filterOptions.minBatteryLevel !== null) {
      result = result.filter(
        (station) =>
          station.batteryLevel >= (filterOptions.minBatteryLevel as number)
      );
    }
    if (filterOptions.minAvailableChargers !== null) {
      result = result.filter(
        (station) => station.availableChargers >= (filterOptions.minAvailableChargers as number)
      );
    }
    result.sort((a, b) => {
      const multiplier = filterOptions.sortOrder === "asc" ? 1 : -1;
      switch (filterOptions.sortBy) {
        case "name":
          return multiplier * a.name.localeCompare(b.name);
        case "distance":
          return (
            multiplier *
            (parseFloat(a.distance.split(" ")[0]) -
              parseFloat(b.distance.split(" ")[0]))
          );
        case "batteryLevel":
          return multiplier * (a.batteryLevel - b.batteryLevel);
        case "availableChargers":
          return multiplier * (a.availableChargers - b.availableChargers);
        default:
          return 0;
      }
    });
    console.info("ChargingStationFinder: Final filtered stations count:", result.length, result);
    setFilteredStations(result);
    setIsShowcasing(showcasing);
  };

  useEffect(() => {
    applyFilters(stations, fleetIds ? Object.values(fleetIds).flat() : null);
  }, [filterOptions]);

  useEffect(() => {
    const loadLeaflet = async () => {
      if (!window.L) {
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
        document.head.appendChild(cssLink);
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
        script.onload = () => {
          const routingScript = document.createElement("script");
          routingScript.src =
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.js";
          routingScript.onload = initializeMap;
          document.head.appendChild(routingScript);
        };
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };
    loadLeaflet();
    return () => {
      markersRef.current.forEach((marker) => {
        if (marker && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    };
  }, []);

  const initializeMap = () => {
    if (mapRef.current && window.L) {
      const center = lastKnownLocation
        ? [lastKnownLocation.latitude, lastKnownLocation.longitude]
        : [-1.2921, 36.8219];
      mapInstanceRef.current = window.L.map(mapRef.current, {
        center,
        zoom: 12,
        zoomControl: true,
      });
      window.L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 19,
        }
      ).addTo(mapInstanceRef.current);
      setIsMapLoaded(true);
      addMarkersToMap();
    }
  };

  const addMarkersToMap = () => {
    if (!mapInstanceRef.current || !window.L) {
      console.warn("ChargingStationFinder: Map not ready for markers");
      return;
    }
    console.info("ChargingStationFinder: Adding markers to map, filteredStations count:", filteredStations.length);
    markersRef.current.forEach((marker) =>
      mapInstanceRef.current.removeLayer(marker)
    );
    markersRef.current = [];
    if (lastKnownLocation?.latitude && lastKnownLocation?.longitude) {
      const userIcon = window.L.divIcon({
        html: `<div style="width: 20px; height: 20px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        className: "custom-user-marker",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const userMarker = window.L.marker(
        [lastKnownLocation.latitude, lastKnownLocation.longitude],
        { icon: userIcon }
      ).addTo(mapInstanceRef.current);
      userMarker.bindPopup(
        `<div style="color: #000; font-family: system-ui;"><h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Your Location</h3><p style="margin: 0; font-size: 12px;">Lat: ${lastKnownLocation.latitude.toFixed(
          6
        )}</p><p style="margin: 0; font-size: 12px;">Lng: ${lastKnownLocation.longitude.toFixed(
          6
        )}</p></div>`
      );
      markersRef.current.push(userMarker);
    }
    filteredStations.forEach((station) => {
      console.info(`ChargingStationFinder: Adding marker for station ${station.name} at (${station.lat}, ${station.lng})`);
      const markerColor =
        station.status === "available"
          ? "#10b981"
          : station.status === "limited"
          ? "#f59e0b"
          : "#ef4444";
      const stationIcon = window.L.divIcon({
        html: `<div style="width: 16px; height: 16px; background: ${markerColor}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        className: "custom-station-marker",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = window.L.marker([station.lat, station.lng], {
        icon: stationIcon,
      }).addTo(mapInstanceRef.current);
      marker.bindPopup(
        `<div style="color: #000; font-family: system-ui;"><h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${station.name}</h3><p style="margin: 0 0 4px 0; font-size: 12px;">Distance: ${station.distance}</p><p style="margin: 0 0 4px 0; font-size: 12px;">Available chargers: ${station.availableChargers}</p><button onclick="window.showStationDetails(${station.id})" style="background: #3b82f6; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Select Station</button></div>`
      );
      markersRef.current.push(marker);
    });
    console.info(`ChargingStationFinder: Added ${markersRef.current.length} markers to map`);
  };

  useEffect(() => {
    (window as any).showStationDetails = (stationId: number) => {
      const station = stations.find((s) => s.id === stationId);
      if (station) {
        setSelectedStation(station);
        setIsServiceModalOpen(true);
      }
    };
  }, [stations]);

  useEffect(() => {
    if (isMapLoaded) addMarkersToMap();
  }, [filteredStations, isMapLoaded]);

  useEffect(() => {
    setIsMapVisible(!isFilterModalOpen && !isServiceModalOpen);
  }, [isFilterModalOpen, isServiceModalOpen]);

  useEffect(() => {
    if (isMapVisible && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 150);
    }
  }, [isMapVisible]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const updatedStations = stations.map((station) => ({
        ...station,
        batteryLevel: Math.max(
          20,
          Math.min(100, station.batteryLevel + (Math.random() - 0.5) * 10)
        ),
        distance: calculateDistance(
          lastKnownLocation?.latitude || -1.2921,
          lastKnownLocation?.longitude || 36.8219,
          station.lat,
          station.lng
        ),
      }));
      setStations(updatedStations);
      applyFilters(
        updatedStations,
        fleetIds ? Object.values(fleetIds).flat() : null
      );
      setIsRefreshing(false);
    }, 1500);
  };

  const handleNavigateToStation = (station: Station) => {
    if (!mapInstanceRef.current || !window.L.Routing) return;
    if (routeControlRef.current) {
      mapInstanceRef.current.removeControl(routeControlRef.current);
    }
    routeControlRef.current = window.L.Routing.control({
      waypoints: [
        window.L.latLng(
          lastKnownLocation?.latitude || -1.2921,
          lastKnownLocation?.longitude || 36.8219
        ),
        window.L.latLng(station.lat, station.lng),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      createMarker: () => null,
      lineOptions: { styles: [{ color: "#3b82f6", weight: 4, opacity: 0.8 }] },
      show: false,
    }).addTo(mapInstanceRef.current);
    const group = new window.L.featureGroup([
      window.L.marker([
        lastKnownLocation?.latitude || -1.2921,
        lastKnownLocation?.longitude || 36.8219,
      ]),
      window.L.marker([station.lat, station.lng]),
    ]);
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
  };

  // Phase W4: Fleet Allocation - Request asset allocation from ARM
  const handleFleetAllocation = async (
    station: Station,
    serviceType: "battery_swap" | "maintenance" | "multi_service"
  ) => {
    if (!bridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      return;
    }

    console.info(`Phase W4: Initiating fleet allocation for station: ${station.name}`);

    // Determine target fleet ID from fleetIds (from Phase W1)
    let targetFleetId = station.fleetId; // Fallback to station's fleetId
    if (fleetIds) {
      // Try to get swap_station_fleet first, then fallback to other fleet types
      const swapStationFleets = fleetIds.swap_station_fleet || fleetIds["swap_station_fleet"];
      if (swapStationFleets && swapStationFleets.length > 0) {
        targetFleetId = swapStationFleets[0];
      } else {
        // Get first available fleet
        const fleetTypes = Object.keys(fleetIds);
        if (fleetTypes.length > 0 && fleetIds[fleetTypes[0]].length > 0) {
          targetFleetId = fleetIds[fleetTypes[0]][0];
        }
      }
    }

    // Format location_id from station coordinates or use station ID
    let locationId = `LOC${station.id}`;
    if (lastKnownLocation?.latitude && lastKnownLocation?.longitude) {
      locationId = `LOC${Math.round(lastKnownLocation.latitude * 1000)}${Math.round(lastKnownLocation.longitude * 1000)}`;
    }

    // Determine service sequence based on serviceType
    const serviceSequence = serviceType === "battery_swap"
      ? "battery_swap"
      : serviceType === "maintenance"
      ? "maintenance"
      : "battery_swap,maintenance";

    const requestTopic = `emit/uxi/service/plan/bss-plan-weekly-freedom-nairobi-v2-plan5/fleet_allocation`;
    const responseTopic = "echo/#";

    // Generate unique correlation_id and session_token for each request
    const correlationId = `fleet-allocation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionToken = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      timestamp: new Date().toISOString(), // Current time
      plan_id: "bss-plan-weekly-freedom-nairobi-v2-plan5",
      correlation_id: correlationId, // Unique for each request
      session_token: sessionToken, // Unique for each request
      actor: {
        type: "system",
        id: "service-coordinator",
      },
      data: {
        action: "SEND_ASSET_ALLOCATION_SIGNAL",
        target_fleet_id: targetFleetId,
        location_id: locationId,
        service_sequence: serviceSequence,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    console.info("Phase W4: Publishing fleet allocation request:", JSON.stringify(dataToPublish, null, 2));

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedData = JSON.parse(data);
          const topic = parsedData.topic;
          const rawMessageContent = parsedData.message;

          if (topic.startsWith("echo/")) {
            console.info("Phase W4: Received fleet allocation response:", rawMessageContent);
            let responseData;
            try {
              responseData = typeof rawMessageContent === "string"
                ? JSON.parse(rawMessageContent)
                : rawMessageContent;

              if (responseData?.data?.success || responseData?.signals?.includes("ASSET_ALLOCATION_SIGNAL_SENT")) {
                console.info(`Phase W4: Fleet allocation successful for ${station.name}`);
                toast.success(`Fleet allocation completed for ${station.name}`);
              } else {
                console.warn("Phase W4: Fleet allocation response indicates non-success:", responseData);
              }
            } catch (parseErr) {
              console.error("Phase W4: Error parsing response:", parseErr);
            }
            responseCallback({ success: true });
          }
        } catch (err) {
          console.error("Phase W4: Error processing MQTT callback:", err);
          responseCallback({ success: false, error: err });
        }
      }
    );

    const subscribeToTopic = () =>
      new Promise<boolean>((resolve) => {
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            try {
              const subResp = typeof subscribeResponse === "string"
                ? JSON.parse(subscribeResponse)
                : subscribeResponse;
              if (subResp.respCode === "200") {
                console.info("Phase W4: Successfully subscribed to response topic");
                resolve(true);
              } else {
                console.warn("Phase W4: Subscribe failed:", subResp.respDesc || subResp.error);
                resolve(false);
              }
            } catch (err) {
              console.error("Phase W4: Error parsing subscribe response:", err);
              resolve(false);
            }
          }
        );
      });

    const publishMessage = () =>
      new Promise<boolean>((resolve) => {
        bridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (response) => {
            try {
              const responseData = typeof response === "string" ? JSON.parse(response) : response;
              if (responseData.error || responseData.respCode !== "200") {
                console.error("Phase W4: Publish error:", responseData.respDesc || responseData.error);
                resolve(false);
              } else {
                console.info(`Phase W4: Successfully published fleet allocation for ${station.name}`);
                resolve(true);
              }
            } catch (err) {
              console.error("Phase W4: Error parsing publish response:", err);
              resolve(false);
            }
          }
        );
      });

    const cleanup = () => {
      offResponseHandler();
      bridge.callHandler(
        "mqttUnSubTopic",
        { topic: responseTopic, qos: 0 },
        () => {}
      );
    };

    try {
      const subscribed = await subscribeToTopic();
      if (subscribed) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const published = await publishMessage();
        if (published) {
          setTimeout(() => cleanup(), 15000);
        } else {
          cleanup();
        }
      } else {
        cleanup();
      }
    } catch (err) {
      console.error("Phase W4: Error in MQTT operations:", err);
      cleanup();
    }
  };

  const handleServiceRequest = async (
    station: Station,
    serviceType: "battery_swap" | "maintenance" | "multi_service"
  ) => {
    if (!bridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Bridge not initialized");
      return;
    }

    setProcessingId(station.id);
    console.info(
      `Initiating ${serviceType} request for station: ${station.name}`
    );

    // Define MQTT topics
    const requestTopic = `call/abs/service/plan/bss-plan-weekly-freedom-nairobi-v2-plan5/emit_intent`;
    const responseTopic = `rtrn/abs/service/plan/bss-plan-weekly-freedom-nairobi-v2-plan5/emit_intent`;

    // Determine requested_services based on serviceType
    const requestedServices =
      serviceType === "battery_swap"
        ? ["battery_swap"]
        : serviceType === "maintenance"
        ? ["maintenance"]
        : ["battery_swap", "maintenance"];

    // Dynamic payload with current timestamp and unique correlation_id
    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: "bss-plan-weekly-freedom-nairobi-v2-plan5",
      correlation_id: `service-intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actor: {
        type: "customer",
        id: "CUST-RIDER-001",
      },
      data: {
        action: "EMIT_SERVICE_INTENT_SIGNAL",
        target_location_id: "LOC001",
        estimated_arrival_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        requested_services: requestedServices,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    // Register MQTT response handler
    console.info(
      `Registering MQTT response handler for topic: ${responseTopic}`
    );
    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          console.info(`Received MQTT message on topic: ${responseTopic}`);
          const parsedData = JSON.parse(data);
          console.info(
            "Parsed MQTT response data:",
            JSON.stringify(parsedData, null, 2)
          );

          const message = parsedData;
          const topic = message.topic;
          const rawMessageContent = message.message;

          if (topic === responseTopic) {
            let responseData;
            try {
              responseData =
                typeof rawMessageContent === "string"
                  ? JSON.parse(rawMessageContent)
                  : rawMessageContent;
              console.info(
                "Processed MQTT response content:",
                JSON.stringify(responseData, null, 2)
              );

              if (responseData?.data?.success) {
                console.info(
                  `Successfully processed ${serviceType} request for station: ${station.name}`
                );
                toast.success(
                  `Successfully processed ${
                    serviceType === "battery_swap"
                      ? "Battery swap"
                      : serviceType === "maintenance"
                      ? "Service"
                      : "Dual"
                  } request for ${station.name}`
                );
                
                // Phase W4: Fleet Allocation - automatically trigger after W2 succeeds
                setTimeout(() => {
                  handleFleetAllocation(station, serviceType);
                }, 1000);
              } else {
                const errorReason =
                  responseData?.data?.metadata?.reason || "Unknown error";
                console.error(`MQTT request failed: ${errorReason}`);
                toast.error(
                  `Failed to process ${
                    serviceType === "battery_swap"
                      ? "Battery swap"
                      : serviceType === "maintenance"
                      ? "Service"
                      : "Dual"
                  } request: ${errorReason}`
                );
              }
            } catch (parseErr) {
              console.error("Error parsing MQTT response content:", parseErr);
              toast.error("Error processing MQTT response");
            }
            responseCallback({ success: true });
          }
        } catch (err) {
          console.error("Error parsing MQTT arrived callback:", err);
          toast.error("Error processing MQTT response");
          responseCallback({ success: false, error: err });
        }
      }
    );

    // Subscribe to the response topic
    console.info(`Subscribing to MQTT response topic: ${responseTopic}`);
    const subscribeToTopic = () =>
      new Promise<boolean>((resolve) => {
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            console.info("MQTT subscribe response:", subscribeResponse);
            try {
              const subResp =
                typeof subscribeResponse === "string"
                  ? JSON.parse(subscribeResponse)
                  : subscribeResponse;
              if (subResp.respCode === "200") {
                console.info("Successfully subscribed to response topic");
                resolve(true);
              } else {
                console.error(
                  "Subscribe failed:",
                  subResp.respDesc || subResp.error
                );
                toast.error("Failed to subscribe to MQTT topic");
                resolve(false);
              }
            } catch (err) {
              console.error("Error parsing subscribe response:", err);
              toast.error("Error subscribing to MQTT topic");
              resolve(false);
            }
          }
        );
      });

    // Publish the message
    console.info(
      `Publishing MQTT message to topic: ${requestTopic} with payload:`,
      JSON.stringify(payload, null, 2)
    );
    const publishMessage = () =>
      new Promise<boolean>((resolve) => {
        bridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (response) => {
            console.info("MQTT publish response:", response);
            try {
              const responseData =
                typeof response === "string" ? JSON.parse(response) : response;
              if (responseData.error || responseData.respCode !== "200") {
                console.error(
                  "MQTT publish error:",
                  responseData.respDesc || responseData.error || "Unknown error"
                );
                toast.error("Failed to publish MQTT message");
                resolve(false);
              } else {
                console.info(
                  `Successfully published ${serviceType} request for station: ${station.name}`
                );
                toast.success(
                  `${
                    serviceType === "battery_swap"
                      ? "Battery swap"
                      : serviceType === "maintenance"
                      ? "Service"
                      : "Dual"
                  } request sent for ${station.name}`
                );
                resolve(true);
              }
            } catch (err) {
              console.error("Error parsing MQTT publish response:", err);
              toast.error("Error publishing MQTT message");
              resolve(false);
            }
          }
        );
      });

    // Cleanup function
    const cleanup = () => {
      console.info(
        `Cleaning up MQTT response handler and subscription for topic: ${responseTopic}`
      );
      offResponseHandler();
      bridge.callHandler(
        "mqttUnSubTopic",
        { topic: responseTopic, qos: 0 },
        (unsubResponse) => {
          console.info("MQTT unsubscribe response:", unsubResponse);
        }
      );
    };

    // Execute MQTT operations with retry mechanism
    const maxRetries = 3;
    const retryDelay = 2000;
    let retries = 0;

    const attemptMqttOperations = async () => {
      while (retries < maxRetries) {
        console.info(
          `Attempting MQTT operations (Attempt ${retries + 1}/${maxRetries})`
        );
        const subscribed = await subscribeToTopic();
        if (!subscribed) {
          retries++;
          if (retries < maxRetries) {
            console.info(
              `Retrying MQTT subscribe (${retries}/${maxRetries}) after ${retryDelay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("Failed to subscribe to MQTT topic after retries");
            toast.error("Failed to subscribe to MQTT topic after retries");
            cleanup();
            setProcessingId(null);
            return;
          }
        }

        const published = await publishMessage();
        if (!published) {
          retries++;
          if (retries < maxRetries) {
            console.info(
              `Retrying MQTT publish (${retries}/${maxRetries}) after ${retryDelay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("Failed to publish MQTT message after retries");
            toast.error("Failed to publish MQTT message after retries");
            cleanup();
            setProcessingId(null);
            return;
          }
        }

        // If both subscribe and publish succeed, set up cleanup after timeout
        console.info("MQTT operations successful, scheduling cleanup");
        setTimeout(() => {
          cleanup();
          setProcessingId(null);
        }, 15000);
        return;
      }
    };

    try {
      await attemptMqttOperations();
    } catch (err) {
      console.error("Error in MQTT operations:", err);
      toast.error("Error in MQTT operations");
      cleanup();
      setProcessingId(null);
    }
  };

  const getBatteryColor = (level: number) => {
    if (level >= 70) return "bg-green-500";
    if (level >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-green-400";
      case "limited":
        return "text-yellow-400";
      case "busy":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const StationButton = ({ label, onClick, color, disabled }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex-1 min-h-[40px] ${
        disabled
          ? "bg-gray-600 cursor-not-allowed text-gray-400"
          : `${color} hover:shadow-lg hover:shadow-opacity-50 active:scale-95`
      }`}
    >
      {disabled ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin inline-block mr-1" />
          {label}
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
      <div className="flex flex-col h-screen">
        {/* Map Container */}
        <div className="relative bg-gray-800 h-48 md:h-64 border-b border-gray-700 flex-shrink-0">
          <div
            ref={mapRef}
            className="w-full h-full"
            style={{ display: isMapVisible ? "block" : "none" }}
          />
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <MapPin
                  size={48}
                  className="text-blue-400 mx-auto mb-2 animate-pulse"
                />
                <p className="text-gray-400 text-sm">Loading map...</p>
              </div>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-all z-10 text-sm font-medium"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        {/* Search & Filter Bar */}
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search stations..."
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterOptions.name}
              onChange={(e) =>
                setFilterOptions({ ...filterOptions, name: e.target.value })
              }
            />
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>
        </div>
        {/* Stations List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Stations</h2>
              <span className="text-sm text-gray-400">
                {filteredStations.length} nearby
              </span>
            </div>
            {propIsLoadingStations && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
                <p className="text-gray-400">Loading stations...</p>
              </div>
            )}
            {!propIsLoadingStations && filteredStations.length === 0 && !isShowcasing && (
              <p className="text-gray-400 text-center py-8">
                No stations match your filters.
              </p>
            )}
            {isShowcasing && (
              <p className="text-yellow-400 text-center mb-4 text-sm">
                Showing demo stations.
              </p>
            )}
            {!propIsLoadingStations && (
              <div className="space-y-3">
                {filteredStations.map((station) => (
                <div
                  key={station.id}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {station.name}
                      </h3>
                    </div>
                    <span className="text-blue-400 text-sm font-medium ml-2 flex-shrink-0">
                      {station.distance}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className={getStatusColor(station.status)} />
                    <span
                      className={`text-xs ${getStatusColor(station.status)}`}
                    >
                      {station.availableChargers} available
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToStation(station);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Navigate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStation(station);
                        setIsServiceModalOpen(true);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Select Station
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-t-2xl md:rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-semibold mb-6">Filter Stations</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Station Name
                </label>
                <input
                  type="text"
                  value={filterOptions.name}
                  onChange={(e) =>
                    setFilterOptions({ ...filterOptions, name: e.target.value })
                  }
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Distance (km)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filterOptions.minDistance || ""}
                    onChange={(e) =>
                      setFilterOptions({
                        ...filterOptions,
                        minDistance: e.target.value,
                      })
                    }
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={filterOptions.maxDistance || ""}
                    onChange={(e) =>
                      setFilterOptions({
                        ...filterOptions,
                        maxDistance: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Battery Level
                </label>
                <div className="flex gap-2">
                  {["50", "75", "100"].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setFilterOptions({
                          ...filterOptions,
                          minBatteryLevel: parseInt(level),
                        })
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                        filterOptions.minBatteryLevel === parseInt(level)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {level}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Min Chargers
                </label>
                <div className="flex gap-2">
                  {["2", "4", "6"].map((count) => (
                    <button
                      key={count}
                      onClick={() =>
                        setFilterOptions({
                          ...filterOptions,
                          minAvailableChargers: parseInt(count),
                        })
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                        filterOptions.minAvailableChargers === parseInt(count)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {count}+
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={filterOptions.sortBy}
                  onChange={(e) =>
                    setFilterOptions({
                      ...filterOptions,
                      sortBy: e.target.value as any,
                    })
                  }
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="distance">Distance</option>
                  <option value="name">Name</option>
                  <option value="batteryLevel">Battery Level</option>
                  <option value="availableChargers">Available Chargers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Sort Order
                </label>
                <div className="flex gap-2">
                  {["asc", "desc"].map((order) => (
                    <button
                      key={order}
                      onClick={() =>
                        setFilterOptions({
                          ...filterOptions,
                          sortOrder: order as any,
                        })
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                        filterOptions.sortOrder === order
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {order === "asc" ? "↑ Ascending" : "↓ Descending"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setFilterOptions({
                    name: "",
                    minDistance: null,
                    maxDistance: null,
                    minBatteryLevel: null,
                    minAvailableChargers: null,
                    sortBy: "distance",
                    sortOrder: "asc",
                  });
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Service Modal */}
      {isServiceModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
          <div className="min-h-screen">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-6">
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="flex items-center gap-2 text-white mb-4 hover:opacity-80 transition-opacity"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
              <h2 className="text-2xl font-bold text-white">Select Service</h2>
              <p className="text-blue-100 text-sm mt-1">
                Choose what you need today
              </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Available Services Section */}
              <div>
                <h3 className="text-white font-semibold mb-3">
                  Available Services
                </h3>
                <div className="space-y-3">
                  {/* Battery Swap Service */}
                  <button
                    onClick={() => {
                      setSelectedService("battery_swap");
                    }}
                    disabled={processingId === selectedStation.id}
                    className="w-full bg-gray-800 border-2 border-blue-500 rounded-xl p-4 flex items-center justify-between hover:bg-gray-750 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Battery className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">Battery Swap</p>
                        <p className="text-gray-400 text-sm">
                          Quick battery exchange
                        </p>
                      </div>
                    </div>
                    {processingId === selectedStation.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    ) : selectedService === "battery_swap" ? (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-blue-500 rounded-full"></div>
                    )}
                  </button>

                  {/* Maintenance Service */}
                  <button
                    onClick={() => {
                      setSelectedService("maintenance");
                    }}
                    disabled={processingId === selectedStation.id}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-orange-500 hover:bg-gray-750 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Hammer className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">Maintenance</p>
                        <p className="text-gray-400 text-sm">
                          Service & repair
                        </p>
                      </div>
                    </div>
                    {processingId === selectedStation.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    ) : selectedService === "maintenance" ? (
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-orange-500 rounded-full"></div>
                    )}
                  </button>
                  {/* Dual Service */}
                  <button
                    onClick={() => {
                      setSelectedService("multi_service");
                    }}
                    disabled={processingId === selectedStation.id}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-orange-500 hover:bg-gray-750 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">Dual service</p>
                        <p className="text-gray-400 text-sm">
                          Battery swap & repair
                        </p>
                      </div>
                    </div>
                    {processingId === selectedStation.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    ) : selectedService === "multi_service" ? (
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-orange-500 rounded-full"></div>
                    )}
                  </button>
                </div>
              </div>

              {/* Station Details Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">
                    {selectedStation.name}
                  </h3>
                  <button className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-4">Service Location</p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">
                      {selectedStation.distance} from your location
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-sm">
                      {selectedStation.availableChargers}{" "}
                      batteries available
                    </span>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => {
                    if (!selectedService) return;
                    setIsServiceModalOpen(false);
                    handleServiceRequest(selectedStation, selectedService);
                  }}
                  disabled={processingId === selectedStation.id || !selectedService}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingId === selectedStation.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : selectedService ? (
                    `I'm on my way for ${
                      selectedService === "battery_swap"
                        ? "battery swap"
                        : selectedService === "maintenance"
                        ? "maintenance"
                        : "dual service"
                    }`
                  ) : (
                    "Select a service"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChargingStationFinder;