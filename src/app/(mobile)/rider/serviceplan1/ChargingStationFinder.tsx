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
import { useI18n } from '@/i18n';

interface Station {
  id: number;
  name: string;
  location: string;
  distance: string;
  batteryLevel: number;
  availableChargers: string;
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
}

const ChargingStationFinder = ({
  lastKnownLocation,
  fleetIds,
}: ChargingStationFinderProps) => {
  const { t } = useI18n();
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
  const [stations, setStations] = useState<Station[]>([
    {
      id: 1,
      name: "Central Mall Station",
      location: "Westlands, Nairobi",
      distance: "N/A",
      batteryLevel: 20.0,
      availableChargers: "1/8",
      status: "busy",
      lat: -1.2672,
      lng: 36.8121,
      fleetId: "fleet-kenya",
    },
    {
      id: 2,
      name: "CBD Quick Charge",
      location: "City Centre, Nairobi",
      distance: "N/A",
      batteryLevel: 82.87,
      availableChargers: "5/6",
      status: "available",
      lat: -1.2841,
      lng: 36.8219,
      fleetId: "fleet-kenya",
    },
    {
      id: 3,
      name: "Kilimani Hub",
      location: "Kilimani Road",
      distance: "N/A",
      batteryLevel: 99.58,
      availableChargers: "10/10",
      status: "available",
      lat: -1.2901,
      lng: 36.7844,
      fleetId: "fleet-stations-kenya",
    },
    {
      id: 4,
      name: "Kasarani Station",
      location: "Kasarani Estate",
      distance: "N/A",
      batteryLevel: 45.98,
      availableChargers: "1/4",
      status: "busy",
      lat: -1.2297,
      lng: 36.8973,
      fleetId: "fleet-kenya",
    },
    {
      id: 5,
      name: "Karen Shopping Center",
      location: "Karen Road",
      distance: "N/A",
      batteryLevel: 95.41,
      availableChargers: "5/6",
      status: "available",
      lat: -1.3197,
      lng: 36.7022,
      fleetId: "fleet-stations-kenya",
    },
  ]);
  const { bridge } = useBridge();

  useEffect(() => {
    if (fleetIds) {
      const validFleetIds = Object.values(fleetIds).flat();
      applyFilters(stations, validFleetIds);
    } else {
      applyFilters(stations, null);
    }
  }, [fleetIds, stations]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon3: number
  ): string => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon3 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
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
    let result = [...stationsToFilter];
    let showcasing = false;
    if (validFleetIds && validFleetIds.length > 0) {
      result = result.filter((station) =>
        validFleetIds.includes(station.fleetId)
      );
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
      result = result.filter((station) => {
        const available = parseInt(station.availableChargers.split("/")[0]);
        return available >= (filterOptions.minAvailableChargers as number);
      });
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
          return (
            multiplier *
            (parseInt(a.availableChargers.split("/")[0]) -
              parseInt(b.availableChargers.split("/")[0]))
          );
        default:
          return 0;
      }
    });
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
    if (!mapInstanceRef.current || !window.L) return;
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
        `<div style="color: #000; font-family: system-ui;"><h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${station.name}</h3><p style="margin: 0 0 4px 0; font-size: 12px;">${station.location}</p><p style="margin: 0 0 4px 0; font-size: 12px;">${t("Distance")}: ${station.distance}</p><button onclick="window.showStationDetails(${station.id})" style="background: #3b82f6; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">${t("Select Station")}</button></div>`
      );
      markersRef.current.push(marker);
    });
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
    const requestTopic = `call/abs/service/plan/service-plan-basic-latest-a/emit_intent`;
    const responseTopic = `rtrn/abs/service/plan/service-plan-basic-latest-a/emit_intent`;

    // Determine requested_services based on serviceType
    const requestedServices =
      serviceType === "battery_swap"
        ? ["battery_swap"]
        : serviceType === "maintenance"
        ? ["maintenance"]
        : ["battery_swap", "maintenance"];

    // Hardcoded payload with dynamic requested_services
    const payload = {
      timestamp: "2025-01-15T09:00:00Z",
      plan_id: "service-plan-basic-latest-a",
      correlation_id: "test-service-intent-001",
      actor: {
        type: "customer",
        id: "CUST-RIDER-001",
      },
      data: {
        action: "EMIT_SERVICE_INTENT_SIGNAL",
        target_location_id: "LOC001",
        estimated_arrival_time: "2025-01-15T09:30:00Z",
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
                <p className="text-gray-400 text-sm">{t("Loading map...")}</p>
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
            <span className="hidden sm:inline">{t("Refresh")}</span>
          </button>
        </div>
        {/* Search & Filter Bar */}
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("Search stations...")}
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
              <span className="hidden sm:inline">{t("Filter")}</span>
            </button>
          </div>
        </div>
        {/* Stations List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t("Stations")}</h2>
              <span className="text-sm text-gray-400">
                {filteredStations.length} {t("nearby")}
              </span>
            </div>
            {filteredStations.length === 0 && !isShowcasing && (
              <p className="text-gray-400 text-center py-8">
                {t("No stations match your filters.")}
              </p>
            )}
            {isShowcasing && (
              <p className="text-yellow-400 text-center mb-4 text-sm">
                Showing demo stations.
              </p>
            )}
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
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin size={12} className="flex-shrink-0" />
                        <span className="truncate">{station.location}</span>
                      </p>
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
                      {t("Navigate")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStation(station);
                        setIsServiceModalOpen(true);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {t("Select Station")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                  {t("Station Name")}
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
                {t("Back")}
              </button>
              <h2 className="text-2xl font-bold text-white">{t("Select Service")}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {t("Choose what you need today")}
              </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Available Services Section */}
              <div>
                <h3 className="text-white font-semibold mb-3">
                  {t("Available Services")}
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
                        <p className="text-white font-semibold">{t("Battery Swap")}</p>
                        <p className="text-gray-400 text-sm">
                          {t("Quick battery exchange")}
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
                        <p className="text-white font-semibold">{t("Maintenance")}</p>
                        <p className="text-gray-400 text-sm">
                          {t("Service & repair")}
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
                        <p className="text-white font-semibold">{t("Dual service")}</p>
                        <p className="text-gray-400 text-sm">
                          {t("Battery swap & repair")}
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
                <p className="text-gray-400 text-sm mb-4">{t("Service Location")}</p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">
                      {selectedStation.distance} {t("from your location")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-sm">
                      {selectedStation.availableChargers.split("/")[0]}{" "}
                      {t("batteries available")}
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
                      {t("Processing...")}
                    </>
                  ) : selectedService ? (
                    `${t("I'm on my way for")} ${
                      selectedService === "battery_swap"
                        ? t("battery swap")
                        : selectedService === "maintenance"
                        ? t("maintenance")
                        : t("dual service")
                    }`
                  ) : (
                    t("Select a service")
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