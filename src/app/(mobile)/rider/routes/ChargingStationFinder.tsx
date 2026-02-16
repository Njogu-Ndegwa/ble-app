"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Battery, RefreshCw, Navigation, Zap, Filter, X } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Fix for default marker icons in Leaflet
const DefaultIcon = L.icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const UserLocationIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; transform: translate(-10px, -10px);"></div>`,
  className: 'user-location-marker'
});

const ChargingStationFinder = ({ 
  userLocation, 
  isLocationActive, 
  lastKnownLocation 
}: Props) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
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
  const mapRef = useRef<L.Map>(null);

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
      batteryLevel: 85.68,
      availableChargers: "0/8",
      status: "busy",
      lat: -1.2672,
      lng: 36.8121,
    },
    {
      id: 2,
      name: "CBD Quick Charge",
      location: "City Centre, Nairobi",
      distance: "N/A",
      batteryLevel: 52.87,
      availableChargers: "3/6",
      status: "available",
      lat: -1.2841,
      lng: 36.8219,
    },
    {
      id: 3,
      name: "Kilimani Hub",
      location: "Kilimani Road",
      distance: "N/A",
      batteryLevel: 82.58,
      availableChargers: "3/10",
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
      availableChargers: "0/4",
      status: "busy",
      lat: -1.2297,
      lng: 36.8973,
    },
    {
      id: 5,
      name: "Karen Shopping Center",
      location: "Karen Road",
      distance: "N/A",
      batteryLevel: 75.41,
      availableChargers: "1/6",
      status: "limited",
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

  const handleNavigateToStation = useCallback((station: Station) => {
    if (!hasValidCoordinates(currentUserLocation)) {
      setLocationError("Cannot navigate: User location is not available.");
      return;
    }

    // In a real app, you would use a routing service like OSRM
    // For demo purposes, we'll just draw a straight line
    setRoute([
      [currentUserLocation.latitude, currentUserLocation.longitude],
      [station.lat, station.lng]
    ]);

    // Center the map on both points
    if (mapRef.current) {
      const bounds = L.latLngBounds(
        L.latLng(currentUserLocation.latitude, currentUserLocation.longitude),
        L.latLng(station.lat, station.lng)
      );
      mapRef.current.fitBounds(bounds);
    }
  }, [currentUserLocation]);

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
        return "text-text-secondary";
    }
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case "available":
        return "var(--color-success)";
      case "limited":
        return "var(--color-warning)";
      case "busy":
        return "var(--color-error)";
      default:
        return "var(--text-muted)";
    }
  };

  const createStationIcon = (status: string) => {
    return L.divIcon({
      html: `<div style="background-color: ${getMarkerColor(status)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; transform: translate(-8px, -8px);"></div>`,
      className: 'station-marker'
    });
  };

  // Map component that handles view changes
  const MapViewUpdater = () => {
    const map = useMap();
    
    useEffect(() => {
      if (hasValidCoordinates(currentUserLocation)) {
        map.setView([currentUserLocation.latitude, currentUserLocation.longitude], 13);
      }
    }, [currentUserLocation, map]);

    return null;
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="relative bg-bg-secondary h-64 border-b border-border">
          {hasValidCoordinates(currentUserLocation) ? (
            <MapContainer
              center={[currentUserLocation.latitude, currentUserLocation.longitude]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapViewUpdater />
              
              {/* User location marker */}
              <Marker 
                position={[currentUserLocation.latitude, currentUserLocation.longitude]} 
                icon={UserLocationIcon}
              >
                <Popup>
                  <div className="text-text-muted">
                    <h3 className="font-semibold text-blue-500">Your Location</h3>
                    <p>Lat: {currentUserLocation.latitude.toFixed(6)}</p>
                    <p>Lng: {currentUserLocation.longitude.toFixed(6)}</p>
                    {currentUserLocation.locationName && (
                      <p>{currentUserLocation.locationName}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
              
              {/* Charging station markers */}
              {filteredStations.map((station) => (
                <Marker
                  key={station.id}
                  position={[station.lat, station.lng]}
                  icon={createStationIcon(station.status)}
                  eventHandlers={{
                    click: () => {
                      setSelectedStation(station);
                      setIsDetailsModalOpen(true);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-text-muted">
                      <h3 className="font-semibold">{station.name}</h3>
                      <p>{station.location}</p>
                      <p>Distance: {station.distance}</p>
                      <p>Battery: {station.batteryLevel.toFixed(2)}%</p>
                      <p>Chargers: {station.availableChargers}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Route line */}
              {route && (
                <Polyline 
                  positions={route} 
                  color="var(--color-info)"
                  weight={4}
                  opacity={0.8}
                />
              )}
            </MapContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
              <div className="text-center">
                <MapPin size={48} className="text-blue-400 mx-auto mb-2" />
                <p className="text-text-secondary text-sm">Waiting for location...</p>
              </div>
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
            <div className="absolute top-4 left-4 bg-bg-secondary bg-opacity-90 px-3 py-2 rounded-lg flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          )}
        </div>

        {/* Rest of your component remains the same */}
        <div className="p-4 bg-bg-secondary border-b border-border">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search stations..."
              className="w-full bg-bg-tertiary rounded-lg px-3 py-2 text-sm text-text-primary"
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
              <span className="text-sm text-text-secondary">{filteredStations.length} stations nearby</span>
            </div>

            <div className="space-y-3">
              {filteredStations.map((station) => (
                <div
                  key={station.id}
                  className="bg-bg-secondary rounded-xl p-4 border border-border hover:border-border transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedStation(station);
                    setIsDetailsModalOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-text-primary mb-1">{station.name}</h3>
                      <p className="text-sm text-text-secondary flex items-center">
                        <MapPin size={12} className="mr-1" />
                        {station.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-400 text-sm font-medium">{station.distance}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary">Battery Level</span>
                      <span className="text-text-primary font-medium">{station.batteryLevel.toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-bg-tertiary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getBatteryColor(station.batteryLevel)}`}
                        style={{ width: `${station.batteryLevel}%` }}
                      ></div>
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
                        e.stopPropagation();
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

      {/* Filter Modal (same as before) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-md relative">
            {/* ... (same filter modal content as before) ... */}
          </div>
        </div>
      )}

      {/* Station Details Modal (same as before) */}
      {isDetailsModalOpen && selectedStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-md relative">
            {/* ... (same details modal content as before) ... */}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChargingStationFinder;