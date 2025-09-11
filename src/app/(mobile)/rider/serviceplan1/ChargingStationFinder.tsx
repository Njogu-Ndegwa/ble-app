//open street map
"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Battery, RefreshCw, Navigation, Zap, Filter, X } from "lucide-react";

// Define interfaces
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
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  locationName?: string;
}

interface Props {
  userLocation: LocationData | null;
  isLocationActive?: boolean;
  lastKnownLocation?: LocationData | null;
}

interface FilterOptions {
  name: string;
  minDistance: string | null;
  maxDistance: number | null;
  minBatteryLevel: number | null;
  minAvailableChargers: number | null;
  sortBy: 'name' | 'distance' | 'batteryLevel' | 'availableChargers';
  sortOrder: 'asc' | 'desc';
  power?: string;
  paymentSolution?: string;
  operator?: string;
  rememberPrefs?: boolean;
}

// Declare Leaflet in the window object
declare global {
  interface Window {
    L: any;
  }
}

const ChargingStationFinder = ({ 
  userLocation, 
  isLocationActive, 
  lastKnownLocation 
}: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const routeControlRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [hasInitializedLocation, setHasInitializedLocation] = useState(false); // New state to track first location
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    name: '',
    minDistance: null,
    maxDistance: null,
    minBatteryLevel: null,
    minAvailableChargers: null,
    sortBy: 'distance',
    sortOrder: 'asc',
  });
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);

  const currentUserLocation = lastKnownLocation || userLocation;

  const hasValidCoordinates = (location: LocationData | null): location is LocationData => {
    return !!location && 
           location.latitude !== 0 && 
           location.longitude !== 0 && 
           !isNaN(location.latitude) && 
           !isNaN(location.longitude);
  };

  const [stations, setStations] = useState<Station[]>([
    {
      id: 1,
      name: "Central Mall Station",
      location: "Westlands, Nairobi",
      distance: "N/A",
      batteryLevel: 20.00,
      availableChargers: "1/8",
      status: "busy",
      lat: -1.2672,
      lng: 36.8121,
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
    },
  ]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
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
    return distance.toFixed(1) + " km";
  };

  useEffect(() => {
    if (hasValidCoordinates(currentUserLocation)) {
      const updatedStations = stations.map((station) => ({
        ...station,
        distance: calculateDistance(
          currentUserLocation.latitude,
          currentUserLocation.longitude,
          station.lat,
          station.lng
        ),
      }));
      setStations(updatedStations);
      applyFilters(updatedStations);
      setLocationError(null);
    }
  }, [currentUserLocation, isLocationActive]);

  const applyFilters = (stationsToFilter: Station[]) => {
    let result = [...stationsToFilter];
  
    if (filterOptions.name) {
      result = result.filter((station) =>
        station.name.toLowerCase().includes(filterOptions.name.toLowerCase())
      );
    }
  
    if (filterOptions.minDistance !== null) {
      result = result.filter((station) => {
        const distance = parseFloat(station.distance.split(' ')[0]);
        return !isNaN(distance) && distance >= parseFloat(filterOptions.minDistance as string);
      });
    }
    if (filterOptions.maxDistance !== null) {
      result = result.filter((station) => {
        const distance = parseFloat(station.distance.split(' ')[0]);
        return !isNaN(distance) && distance <= (filterOptions.maxDistance as number);
      });
    }
  
    if (filterOptions.minBatteryLevel !== null) {
      result = result.filter((station) => station.batteryLevel >= (filterOptions.minBatteryLevel as number));
    }
  
    if (filterOptions.minAvailableChargers !== null) {
      result = result.filter((station) => {
        const available = parseInt(station.availableChargers.split('/')[0]);
        return available >= (filterOptions.minAvailableChargers as number);
      });
    }
  
    result.sort((a, b) => {
      const multiplier = filterOptions.sortOrder === 'asc' ? 1 : -1;
      switch (filterOptions.sortBy) {
        case 'name':
          return multiplier * a.name.localeCompare(b.name);
        case 'distance':
          return multiplier * (parseFloat(a.distance.split(' ')[0]) - parseFloat(b.distance.split(' ')[0]));
        case 'batteryLevel':
          return multiplier * (a.batteryLevel - b.batteryLevel);
        case 'availableChargers':
          return multiplier * (
            parseInt(a.availableChargers.split('/')[0]) - 
            parseInt(b.availableChargers.split('/')[0])
          );
        default:
          return 0;
      }
    });
  
    setFilteredStations(result);
  };
  
  useEffect(() => {
    applyFilters(stations);
  }, [filterOptions, stations]);

  useEffect(() => {
    // Load Leaflet CSS and JS
    const loadLeaflet = async () => {
      if (!window.L) {
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(cssLink);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => {
          // Load routing plugin
          const routingScript = document.createElement('script');
          routingScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.js';
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
      // Cleanup markers
      markersRef.current.forEach((marker) => {
        if (marker && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
      
      if (userLocationMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
        userLocationMarkerRef.current = null;
      }
      
      if (routeControlRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeControl(routeControlRef.current);
        routeControlRef.current = null;
      }
    };
  }, []);

  const initializeMap = () => {
    if (mapRef.current && window.L) {
      const defaultCenter = hasValidCoordinates(currentUserLocation)
        ? [currentUserLocation.latitude, currentUserLocation.longitude]
        : [-1.2921, 36.8219];

      // Initialize map
      mapInstanceRef.current = window.L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
      });

      // Add OpenStreetMap tiles with dark theme
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      setIsMapLoaded(true);
      addMarkersToMap();
      if (hasValidCoordinates(currentUserLocation)) {
        addUserLocationMarker();
        setHasInitializedLocation(true); // Mark that we've initialized with location
      }
    }
  };

  // Modified useEffect - only center on location for the first time or when explicitly requested
  useEffect(() => {
    if (isMapLoaded && mapInstanceRef.current && hasValidCoordinates(currentUserLocation)) {
      // Only center the map if we haven't initialized location yet
      if (!hasInitializedLocation) {
        mapInstanceRef.current.setView([currentUserLocation.latitude, currentUserLocation.longitude], 12);
        setHasInitializedLocation(true);
      }
      // Always update the user location marker, but don't center the map
      addUserLocationMarker();
    }
  }, [currentUserLocation, isMapLoaded, hasInitializedLocation]);

  const addUserLocationMarker = () => {
    if (!mapInstanceRef.current || !window.L || !hasValidCoordinates(currentUserLocation)) return;

    if (userLocationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
    }

    // Create custom user location icon
    const userIcon = window.L.divIcon({
      html: `<div style="
        width: 20px; 
        height: 20px; 
        background: #3b82f6; 
        border: 3px solid white; 
        border-radius: 50%; 
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>`,
      className: 'custom-user-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const userMarker = window.L.marker([currentUserLocation.latitude, currentUserLocation.longitude], {
      icon: userIcon
    }).addTo(mapInstanceRef.current);

    const popupContent = `
      <div style="color: #000; font-family: system-ui; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #3b82f6;">📍 Your Location</h3>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Lat: ${currentUserLocation.latitude.toFixed(6)}</p>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Lng: ${currentUserLocation.longitude.toFixed(6)}</p>
        ${currentUserLocation.locationName ? `<p style="margin: 0; font-size: 12px; color: #333;">${currentUserLocation.locationName}</p>` : ''}
      </div>
    `;

    userMarker.bindPopup(popupContent);
    userLocationMarkerRef.current = userMarker;
  };

  const addMarkersToMap = () => {
    if (!mapInstanceRef.current || !window.L) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    filteredStations.forEach((station) => {
      const markerColor =
        station.status === "available"
          ? "#10b981"
          : station.status === "limited"
          ? "#f59e0b"
          : "#ef4444";

      // Create custom charging station icon
      const stationIcon = window.L.divIcon({
        html: `<div style="
          width: 16px; 
          height: 16px; 
          background: ${markerColor}; 
          border: 2px solid white; 
          border-radius: 50%; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          opacity: 0.9;
        "></div>`,
        className: 'custom-station-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = window.L.marker([station.lat, station.lng], {
        icon: stationIcon
      }).addTo(mapInstanceRef.current);

      const popupContent = `
        <div style="color: #000; font-family: system-ui; min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">${station.name}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">${station.location}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Distance: ${station.distance}</p>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: ${markerColor};">
            ${station.availableChargers} chargers available
          </p>
          <button onclick="window.showStationDetails(${station.id})" 
                  style="background: #3b82f6; color: white; border: none; padding: 4px 12px; 
                         border-radius: 4px; font-size: 12px; cursor: pointer;">
            View Details
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });
  };

  // Add a function to manually center on user location when requested
  const centerOnUserLocation = () => {
    if (mapInstanceRef.current && hasValidCoordinates(currentUserLocation)) {
      mapInstanceRef.current.setView([currentUserLocation.latitude, currentUserLocation.longitude], 15);
    }
  };

  // Global function to show station details from popup
  useEffect(() => {
    (window as any).showStationDetails = (stationId: number) => {
      const station = stations.find(s => s.id === stationId);
      if (station) {
        setSelectedStation(station);
        setIsDetailsModalOpen(true);
      }
    };
  }, [stations]);

  useEffect(() => {
    if (isMapLoaded) {
      addMarkersToMap();
      if (hasValidCoordinates(currentUserLocation)) {
        addUserLocationMarker();
      }
    }
  }, [filteredStations, isMapLoaded]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setStations((prev) =>
        prev.map((station) => ({
          ...station,
          batteryLevel: Math.max(20, Math.min(100, station.batteryLevel + (Math.random() - 0.5) * 10)),
        }))
      );
      setIsRefreshing(false);
    }, 1500);
  };

  const handleNavigateToStation = (station: Station) => {
  if (!mapInstanceRef.current || !hasValidCoordinates(currentUserLocation)) {
    setLocationError("Cannot navigate: User location is not available.");
    return;
  }

  // Remove existing route
  if (routeControlRef.current) {
    mapInstanceRef.current.removeControl(routeControlRef.current);
  }

  // Create new route using Leaflet Routing Machine without instructions
  if (window.L.Routing) {
    routeControlRef.current = window.L.Routing.control({
      waypoints: [
        window.L.latLng(currentUserLocation.latitude, currentUserLocation.longitude),
        window.L.latLng(station.lat, station.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      createMarker: () => null, // Don't create additional markers
      lineOptions: {
        styles: [{ color: '#3b82f6', weight: 4, opacity: 0.8 }]
      },
      show: false, // Hide the routing instructions panel
      showAlternatives: false, // Disable alternative routes
      fitSelectedRoutes: false, // Prevent automatic zooming to route
      router: new window.L.Routing.OSRMv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
        useHints: false
      })
    }).addTo(mapInstanceRef.current);

    // Hide the routing instructions container completely
    const routingContainer = document.querySelector('.leaflet-routing-container');
    if (routingContainer) {
      (routingContainer as HTMLElement).style.display = 'none';
    }

    // Alternative: Remove the routing control element entirely
    setTimeout(() => {
      const routingControls = document.querySelectorAll('.leaflet-routing-container');
      routingControls.forEach(control => {
        if (control && control.parentNode) {
          control.parentNode.removeChild(control);
        }
      });
    }, 100);

    // Fit the map to show the route
    const group = new window.L.featureGroup([
      window.L.marker([currentUserLocation.latitude, currentUserLocation.longitude]),
      window.L.marker([station.lat, station.lng])
    ]);
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
  } else {
    setLocationError("Routing functionality not available. Please try again.");
  }
};
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLInputElement | HTMLButtonElement;
    const { name, value, type } = target;
    const checked = type === 'checkbox' ? (target as HTMLInputElement).checked : undefined;
    
    setFilterOptions((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFilterSubmit = () => {
    setIsFilterModalOpen(false);
  };

  const handleFilterReset = () => {
    setFilterOptions({
      name: '',
      minDistance: null,
      maxDistance: null,
      minBatteryLevel: null,
      minAvailableChargers: null,
      sortBy: 'distance',
      sortOrder: 'asc',
    });
    setIsFilterModalOpen(false);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="relative bg-gray-800 h-64 border-b border-gray-700">
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: "256px" }} />

          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <MapPin size={48} className="text-blue-400 mx-auto mb-2 animate-pulse" />
                <p className="text-gray-400 text-sm">Loading OpenStreetMap...</p>
              </div>
            </div>
          )}

          {isMapLoaded && !hasValidCoordinates(currentUserLocation) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              {/* Location error placeholder */}
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-full flex items-center space-x-2 transition-all z-10"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            <span className="text-sm">Refresh Stations</span>
          </button>

          {hasValidCoordinates(currentUserLocation) && (
            <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 px-3 py-2 rounded-lg flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <button
                onClick={centerOnUserLocation}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                title="Center on my location"
              >
                My Location
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search stations..."
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              value={filterOptions.name}
              onChange={(e) => setFilterOptions({...filterOptions, name: e.target.value})}
            />
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Swapping Stations</h2>
              <span className="text-sm text-gray-400">{filteredStations.length} stations nearby</span>
            </div>

            <div className="space-y-3">
              {filteredStations.map((station) => (
                <div
                  key={station.id}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedStation(station);
                    setIsDetailsModalOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-1">{station.name}</h3>
                      <p className="text-sm text-gray-400 flex items-center">
                        <MapPin size={12} className="mr-1" />
                        {station.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-400 text-sm font-medium">{station.distance}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap size={14} className={getStatusColor(station.status)} />
                      <span className={`text-sm ${getStatusColor(station.status)}`}>
                        {station.availableChargers} available
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click from triggering modal
                        handleNavigateToStation(station);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    >
                      Navigate
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-semibold mb-4">Filter</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={filterOptions.name}
                  onChange={handleFilterChange}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Search by name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Distance (km)</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    name="minDistance"
                    value={filterOptions.minDistance || ''}
                    onChange={handleFilterChange}
                    placeholder="Min"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    name="maxDistance"
                    value={filterOptions.maxDistance || ''}
                    onChange={handleFilterChange}
                    placeholder="Max"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Battery Level (%)</label>
                <div className="flex space-x-2">
                  {['50', '75', '100'].map((level) => (
                    <label
                      key={level}
                      className={`flex-1 text-center py-2 px-4 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 cursor-pointer ${
                        filterOptions.minBatteryLevel === parseInt(level) ? 'bg-gray-600' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="minBatteryLevel"
                        value={level}
                        checked={filterOptions.minBatteryLevel === parseInt(level)}
                        onChange={() => setFilterOptions({...filterOptions, minBatteryLevel: parseInt(level)})}
                        className="hidden"
                      />
                      {level}%
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Available Chargers</label>
                <div className="flex space-x-2">
                  {['2', '4', '6', '8'].map((count) => (
                    <label
                      key={count}
                      className={`flex-1 text-center py-2 px-4 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 cursor-pointer ${
                        filterOptions.minAvailableChargers === parseInt(count) ? 'bg-gray-600' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="minAvailableChargers"
                        value={count}
                        checked={filterOptions.minAvailableChargers === parseInt(count)}
                        onChange={() => setFilterOptions({...filterOptions, minAvailableChargers: parseInt(count)})}
                        className="hidden"
                      />
                      {count}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Sort By</label>
                <select
                  name="sortBy"
                  value={filterOptions.sortBy}
                  onChange={(e) => setFilterOptions({...filterOptions, sortBy: e.target.value as any})}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="name">Name</option>
                  <option value="distance">Distance</option>
                  <option value="batteryLevel">Battery Level</option>
                  <option value="availableChargers">Available Chargers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Sort Order</label>
                <select
                  name="sortOrder"
                  value={filterOptions.sortOrder}
                  onChange={(e) => setFilterOptions({...filterOptions, sortOrder: e.target.value as any})}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={handleFilterReset}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Reset
              </button>
              <button
                onClick={handleFilterSubmit}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station Details Modal */}
      {isDetailsModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-semibold mb-4">{selectedStation.name}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300 flex items-center">
                  <MapPin size={14} className="mr-2" />
                  {selectedStation.location}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Distance</p>
                <p className="text-white font-medium">{selectedStation.distance}</p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Battery Level</p>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white font-medium">{selectedStation.batteryLevel.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getBatteryColor(selectedStation.batteryLevel)}`}
                    style={{ width: `${selectedStation.batteryLevel}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-300">Available Chargers</p>
                <p className={`text-sm ${getStatusColor(selectedStation.status)}`}>
                  {selectedStation.availableChargers} available
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Status</p>
                <p className={`text-sm ${getStatusColor(selectedStation.status)}`}>
                  {selectedStation.status.charAt(0).toUpperCase() + selectedStation.status.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Coordinates</p>
                <p className="text-sm text-white">Lat: {selectedStation.lat.toFixed(6)}</p>
                <p className="text-sm text-white">Lng: {selectedStation.lng.toFixed(6)}</p>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleNavigateToStation(selectedStation);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                >
                  Navigate
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