//open street map
// "use client";

// import { useState, useEffect, useRef, useCallback } from "react";
// import { MapPin, Battery, RefreshCw, Navigation, Zap, Filter, X } from "lucide-react";
// import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";

// // Define interfaces
// interface Station {
//   id: number;
//   name: string;
//   location: string;
//   distance: string;
//   batteryLevel: number;
//   availableChargers: string;
//   status: string;
//   lat: number;
//   lng: number;
// }

// interface LocationData {
//   latitude: number;
//   longitude: number;
//   timestamp?: number;
//   locationName?: string;
// }

// interface Props {
//   userLocation: LocationData | null;
//   isLocationActive?: boolean;
//   lastKnownLocation?: LocationData | null;
// }

// interface FilterOptions {
//   name: string;
//   minDistance: string | null;
//   maxDistance: number | null;
//   minBatteryLevel: number | null;
//   minAvailableChargers: number | null;
//   sortBy: 'name' | 'distance' | 'batteryLevel' | 'availableChargers';
//   sortOrder: 'asc' | 'desc';
//   power?: string;
//   paymentSolution?: string;
//   operator?: string;
//   rememberPrefs?: boolean;
// }

// // Fix for default marker icons in Leaflet
// const DefaultIcon = L.icon({
//   iconUrl: '/marker-icon.png',
//   iconRetinaUrl: '/marker-icon-2x.png',
//   shadowUrl: '/marker-shadow.png',
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
//   popupAnchor: [1, -34],
//   shadowSize: [41, 41]
// });

// const UserLocationIcon = L.divIcon({
//   html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; transform: translate(-10px, -10px);"></div>`,
//   className: 'user-location-marker'
// });

// const ChargingStationFinder = ({ 
//   userLocation, 
//   isLocationActive, 
//   lastKnownLocation 
// }: Props) => {
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [locationError, setLocationError] = useState<string | null>(null);
//   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
//   const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
//   const [selectedStation, setSelectedStation] = useState<Station | null>(null);
//   const [route, setRoute] = useState<[number, number][] | null>(null);
//   const [filterOptions, setFilterOptions] = useState<FilterOptions>({
//     name: '',
//     minDistance: null,
//     maxDistance: null,
//     minBatteryLevel: null,
//     minAvailableChargers: null,
//     sortBy: 'distance',
//     sortOrder: 'asc',
//   });
//   const [filteredStations, setFilteredStations] = useState<Station[]>([]);
//   const mapRef = useRef<L.Map>(null);

//   const currentUserLocation = lastKnownLocation || userLocation;

//   const hasValidCoordinates = (location: LocationData | null): location is LocationData => {
//     return !!location && 
//            location.latitude !== 0 && 
//            location.longitude !== 0 && 
//            !isNaN(location.latitude) && 
//            !isNaN(location.longitude);
//   };

//   const [stations, setStations] = useState<Station[]>([
//     {
//       id: 1,
//       name: "Central Mall Station",
//       location: "Westlands, Nairobi",
//       distance: "N/A",
//       batteryLevel: 85.68,
//       availableChargers: "0/8",
//       status: "busy",
//       lat: -1.2672,
//       lng: 36.8121,
//     },
//     {
//       id: 2,
//       name: "CBD Quick Charge",
//       location: "City Centre, Nairobi",
//       distance: "N/A",
//       batteryLevel: 52.87,
//       availableChargers: "3/6",
//       status: "available",
//       lat: -1.2841,
//       lng: 36.8219,
//     },
//     {
//       id: 3,
//       name: "Kilimani Hub",
//       location: "Kilimani Road",
//       distance: "N/A",
//       batteryLevel: 82.58,
//       availableChargers: "3/10",
//       status: "available",
//       lat: -1.2901,
//       lng: 36.7844,
//     },
//     {
//       id: 4,
//       name: "Kasarani Station",
//       location: "Kasarani Estate",
//       distance: "N/A",
//       batteryLevel: 45.98,
//       availableChargers: "0/4",
//       status: "busy",
//       lat: -1.2297,
//       lng: 36.8973,
//     },
//     {
//       id: 5,
//       name: "Karen Shopping Center",
//       location: "Karen Road",
//       distance: "N/A",
//       batteryLevel: 75.41,
//       availableChargers: "1/6",
//       status: "limited",
//       lat: -1.3197,
//       lng: 36.7022,
//     },
//   ]);

//   const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
//     const R = 6371; // Earth's radius in km
//     const dLat = (lat2 - lat1) * (Math.PI / 180);
//     const dLon = (lon2 - lon1) * (Math.PI / 180);
//     const a =
//       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//       Math.cos(lat1 * (Math.PI / 180)) *
//         Math.cos(lat2 * (Math.PI / 180)) *
//         Math.sin(dLon / 2) *
//         Math.sin(dLon / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     const distance = R * c;
//     return distance.toFixed(1) + " km";
//   };

//   useEffect(() => {
//     if (hasValidCoordinates(currentUserLocation)) {
//       const updatedStations = stations.map((station) => ({
//         ...station,
//         distance: calculateDistance(
//           currentUserLocation.latitude,
//           currentUserLocation.longitude,
//           station.lat,
//           station.lng
//         ),
//       }));
//       setStations(updatedStations);
//       applyFilters(updatedStations);
//       setLocationError(null);
//     }
//   }, [currentUserLocation, isLocationActive]);

//   const applyFilters = (stationsToFilter: Station[]) => {
//     let result = [...stationsToFilter];
  
//     if (filterOptions.name) {
//       result = result.filter((station) =>
//         station.name.toLowerCase().includes(filterOptions.name.toLowerCase())
//       );
//     }
  
//     if (filterOptions.minDistance !== null) {
//       result = result.filter((station) => {
//         const distance = parseFloat(station.distance.split(' ')[0]);
//         return !isNaN(distance) && distance >= parseFloat(filterOptions.minDistance as string);
//       });
//     }
//     if (filterOptions.maxDistance !== null) {
//       result = result.filter((station) => {
//         const distance = parseFloat(station.distance.split(' ')[0]);
//         return !isNaN(distance) && distance <= (filterOptions.maxDistance as number);
//       });
//     }
  
//     if (filterOptions.minBatteryLevel !== null) {
//       result = result.filter((station) => station.batteryLevel >= (filterOptions.minBatteryLevel as number));
//     }
  
//     if (filterOptions.minAvailableChargers !== null) {
//       result = result.filter((station) => {
//         const available = parseInt(station.availableChargers.split('/')[0]);
//         return available >= (filterOptions.minAvailableChargers as number);
//       });
//     }
  
//     result.sort((a, b) => {
//       const multiplier = filterOptions.sortOrder === 'asc' ? 1 : -1;
//       switch (filterOptions.sortBy) {
//         case 'name':
//           return multiplier * a.name.localeCompare(b.name);
//         case 'distance':
//           return multiplier * (parseFloat(a.distance.split(' ')[0]) - parseFloat(b.distance.split(' ')[0]));
//         case 'batteryLevel':
//           return multiplier * (a.batteryLevel - b.batteryLevel);
//         case 'availableChargers':
//           return multiplier * (
//             parseInt(a.availableChargers.split('/')[0]) - 
//             parseInt(b.availableChargers.split('/')[0])
//           );
//         default:
//           return 0;
//       }
//     });
  
//     setFilteredStations(result);
//   };
  
//   useEffect(() => {
//     applyFilters(stations);
//   }, [filterOptions, stations]);

//   const handleRefresh = () => {
//     setIsRefreshing(true);
//     setTimeout(() => {
//       setStations((prev) =>
//         prev.map((station) => ({
//           ...station,
//           batteryLevel: Math.max(20, Math.min(100, station.batteryLevel + (Math.random() - 0.5) * 10)),
//         }))
//       );
//       setIsRefreshing(false);
//     }, 1500);
//   };

//   const handleNavigateToStation = useCallback((station: Station) => {
//     if (!hasValidCoordinates(currentUserLocation)) {
//       setLocationError("Cannot navigate: User location is not available.");
//       return;
//     }

//     // In a real app, you would use a routing service like OSRM
//     // For demo purposes, we'll just draw a straight line
//     setRoute([
//       [currentUserLocation.latitude, currentUserLocation.longitude],
//       [station.lat, station.lng]
//     ]);

//     // Center the map on both points
//     if (mapRef.current) {
//       const bounds = L.latLngBounds(
//         L.latLng(currentUserLocation.latitude, currentUserLocation.longitude),
//         L.latLng(station.lat, station.lng)
//       );
//       mapRef.current.fitBounds(bounds);
//     }
//   }, [currentUserLocation]);

//   const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
//     const target = e.target as HTMLInputElement | HTMLButtonElement;
//     const { name, value, type } = target;
//     const checked = type === 'checkbox' ? (target as HTMLInputElement).checked : undefined;
    
//     setFilterOptions((prev) => ({
//       ...prev,
//       [name]: type === 'checkbox' ? checked : value,
//     }));
//   };

//   const handleFilterSubmit = () => {
//     setIsFilterModalOpen(false);
//   };

//   const handleFilterReset = () => {
//     setFilterOptions({
//       name: '',
//       minDistance: null,
//       maxDistance: null,
//       minBatteryLevel: null,
//       minAvailableChargers: null,
//       sortBy: 'distance',
//       sortOrder: 'asc',
//     });
//     setIsFilterModalOpen(false);
//   };

//   const getBatteryColor = (level: number) => {
//     if (level >= 70) return "bg-green-500";
//     if (level >= 40) return "bg-yellow-500";
//     return "bg-red-500";
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case "available":
//         return "text-green-400";
//       case "limited":
//         return "text-yellow-400";
//       case "busy":
//         return "text-red-400";
//       default:
//         return "text-gray-400";
//     }
//   };

//   const getMarkerColor = (status: string) => {
//     switch (status) {
//       case "available":
//         return "#10b981";
//       case "limited":
//         return "#f59e0b";
//       case "busy":
//         return "#ef4444";
//       default:
//         return "#6b7280";
//     }
//   };

//   const createStationIcon = (status: string) => {
//     return L.divIcon({
//       html: `<div style="background-color: ${getMarkerColor(status)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; transform: translate(-8px, -8px);"></div>`,
//       className: 'station-marker'
//     });
//   };

//   // Map component that handles view changes
//   const MapViewUpdater = () => {
//     const map = useMap();
    
//     useEffect(() => {
//       if (hasValidCoordinates(currentUserLocation)) {
//         map.setView([currentUserLocation.latitude, currentUserLocation.longitude], 13);
//       }
//     }, [currentUserLocation, map]);

//     return null;
//   };

//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       <div className="flex flex-col h-[calc(100vh-80px)]">
//         <div className="relative bg-gray-800 h-64 border-b border-gray-700">
//           {hasValidCoordinates(currentUserLocation) ? (
//             <MapContainer
//               center={[currentUserLocation.latitude, currentUserLocation.longitude]}
//               zoom={13}
//               style={{ height: '100%', width: '100%' }}
//               ref={mapRef}
//             >
//               <TileLayer
//                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//               />
//               <MapViewUpdater />
              
//               {/* User location marker */}
//               <Marker 
//                 position={[currentUserLocation.latitude, currentUserLocation.longitude]} 
//                 icon={UserLocationIcon}
//               >
//                 <Popup>
//                   <div className="text-gray-800">
//                     <h3 className="font-semibold text-blue-500">Your Location</h3>
//                     <p>Lat: {currentUserLocation.latitude.toFixed(6)}</p>
//                     <p>Lng: {currentUserLocation.longitude.toFixed(6)}</p>
//                     {currentUserLocation.locationName && (
//                       <p>{currentUserLocation.locationName}</p>
//                     )}
//                   </div>
//                 </Popup>
//               </Marker>
              
//               {/* Charging station markers */}
//               {filteredStations.map((station) => (
//                 <Marker
//                   key={station.id}
//                   position={[station.lat, station.lng]}
//                   icon={createStationIcon(station.status)}
//                   eventHandlers={{
//                     click: () => {
//                       setSelectedStation(station);
//                       setIsDetailsModalOpen(true);
//                     },
//                   }}
//                 >
//                   <Popup>
//                     <div className="text-gray-800">
//                       <h3 className="font-semibold">{station.name}</h3>
//                       <p>{station.location}</p>
//                       <p>Distance: {station.distance}</p>
//                       <p>Battery: {station.batteryLevel.toFixed(2)}%</p>
//                       <p>Chargers: {station.availableChargers}</p>
//                     </div>
//                   </Popup>
//                 </Marker>
//               ))}
              
//               {/* Route line */}
//               {route && (
//                 <Polyline 
//                   positions={route} 
//                   color="#3b82f6"
//                   weight={4}
//                   opacity={0.8}
//                 />
//               )}
//             </MapContainer>
//           ) : (
//             <div className="w-full h-full flex items-center justify-center bg-gray-800">
//               <div className="text-center">
//                 <MapPin size={48} className="text-blue-400 mx-auto mb-2" />
//                 <p className="text-gray-400 text-sm">Waiting for location...</p>
//               </div>
//             </div>
//           )}

//           <button
//             onClick={handleRefresh}
//             disabled={isRefreshing}
//             className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-full flex items-center space-x-2 transition-all z-10"
//           >
//             <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
//             <span className="text-sm">Refresh Stations</span>
//           </button>

//           {hasValidCoordinates(currentUserLocation) && (
//             <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 px-3 py-2 rounded-lg flex items-center space-x-2">
//               <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
//             </div>
//           )}
//         </div>

//         {/* Rest of your component remains the same */}
//         <div className="p-4 bg-gray-800 border-b border-gray-700">
//           <div className="flex items-center space-x-2">
//             <input
//               type="text"
//               placeholder="Search stations..."
//               className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
//               value={filterOptions.name}
//               onChange={(e) => setFilterOptions({...filterOptions, name: e.target.value})}
//             />
//             <button
//               onClick={() => setIsFilterModalOpen(true)}
//               className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
//             >
//               Filter
//             </button>
//           </div>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           <div className="p-4">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-lg font-semibold">Swapping Stations</h2>
//               <span className="text-sm text-gray-400">{filteredStations.length} stations nearby</span>
//             </div>

//             <div className="space-y-3">
//               {filteredStations.map((station) => (
//                 <div
//                   key={station.id}
//                   className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
//                   onClick={() => {
//                     setSelectedStation(station);
//                     setIsDetailsModalOpen(true);
//                   }}
//                 >
//                   <div className="flex items-start justify-between mb-3">
//                     <div className="flex-1">
//                       <h3 className="font-medium text-white mb-1">{station.name}</h3>
//                       <p className="text-sm text-gray-400 flex items-center">
//                         <MapPin size={12} className="mr-1" />
//                         {station.location}
//                       </p>
//                     </div>
//                     <div className="text-right">
//                       <span className="text-blue-400 text-sm font-medium">{station.distance}</span>
//                     </div>
//                   </div>

//                   <div className="mb-3">
//                     <div className="flex items-center justify-between text-xs mb-1">
//                       <span className="text-gray-400">Battery Level</span>
//                       <span className="text-white font-medium">{station.batteryLevel.toFixed(2)}%</span>
//                     </div>
//                     <div className="w-full bg-gray-700 rounded-full h-2">
//                       <div
//                         className={`h-2 rounded-full ${getBatteryColor(station.batteryLevel)}`}
//                         style={{ width: `${station.batteryLevel}%` }}
//                       ></div>
//                     </div>
//                   </div>

//                   <div className="flex items-center justify-between">
//                     <div className="flex items-center space-x-2">
//                       <Zap size={14} className={getStatusColor(station.status)} />
//                       <span className={`text-sm ${getStatusColor(station.status)}`}>
//                         {station.availableChargers} available
//                       </span>
//                     </div>
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleNavigateToStation(station);
//                       }}
//                       className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full text-xs font-medium transition-colors"
//                     >
//                       Navigate
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Filter Modal (same as before) */}
//       {isFilterModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
//             {/* ... (same filter modal content as before) ... */}
//           </div>
//         </div>
//       )}

//       {/* Station Details Modal (same as before) */}
//       {isDetailsModalOpen && selectedStation && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
//             {/* ... (same details modal content as before) ... */}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChargingStationFinder;

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

// Declare google in the window object
declare global {
  interface Window {
    google: any;
  }
}

const ChargingStationFinder = ({ 
  userLocation, 
  isLocationActive, 
  lastKnownLocation 
}: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false); // New state for details modal
  const [selectedStation, setSelectedStation] = useState<Station | null>(null); // New state for selected station
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

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBHAFAinU-erE7ltSCmNyoyAmrdtvv8pGs&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    return () => {
      markersRef.current.forEach((marker) => marker && marker.setMap && marker.setMap(null));
      markersRef.current = [];
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
        userLocationMarkerRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, []);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      const defaultCenter = hasValidCoordinates(currentUserLocation)
        ? { lat: currentUserLocation.latitude, lng: currentUserLocation.longitude }
        : { lat: -1.2921, lng: 36.8219 };

      const mapOptions: google.maps.MapOptions = {
        center: defaultCenter,
        zoom: 12,
        styles: [
          {
            elementType: "geometry",
            stylers: [{ color: "#212121" }],
          },
          {
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }],
          },
          {
            elementType: "labels.text.fill",
            stylers: [{ color: "#757575" }],
          },
          {
            elementType: "labels.text.stroke",
            stylers: [{ color: "#212121" }],
          },
          {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ color: "#757575" }],
          },
          {
            featureType: "road",
            elementType: "geometry.fill",
            stylers: [{ color: "#2c2c2c" }],
          },
          {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#8a8a8a" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#000000" }],
          },
        ],
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      };

      googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeWeight: 4,
        },
      });
      setIsMapLoaded(true);
      addMarkersToMap();
      if (hasValidCoordinates(currentUserLocation)) {
        addUserLocationMarker();
      }
    }
  };

  useEffect(() => {
    if (isMapLoaded && googleMapRef.current && hasValidCoordinates(currentUserLocation)) {
      googleMapRef.current.setCenter({
        lat: currentUserLocation.latitude,
        lng: currentUserLocation.longitude,
      });
      addUserLocationMarker();
    }
  }, [currentUserLocation, isMapLoaded]);

  const addUserLocationMarker = () => {
    if (!googleMapRef.current || !window.google || !hasValidCoordinates(currentUserLocation)) return;

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setMap(null);
    }

    const userMarker = new window.google.maps.Marker({
      position: { 
        lat: currentUserLocation.latitude, 
        lng: currentUserLocation.longitude 
      },
      map: googleMapRef.current,
      title: "Your Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      zIndex: 1000,
    });

    const userInfoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="color: #000; font-family: system-ui;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color:rgb(94, 68, 239);">📍 Your Location</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Lat: ${currentUserLocation.latitude.toFixed(6)}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Lng: ${currentUserLocation.longitude.toFixed(6)}</p>
          ${currentUserLocation.locationName ? `<p style="margin: 0; font-size: 12px; color: #333;">${currentUserLocation.locationName}</p>` : ''}
        </div>
      `,
    });

    userMarker.addListener("click", () => {
      userInfoWindow.open(googleMapRef.current, userMarker);
    });

    userLocationMarkerRef.current = userMarker;
  };

  const addMarkersToMap = () => {
    if (!googleMapRef.current || !window.google) return;

    markersRef.current.forEach((marker) => marker && marker.setMap && marker.setMap(null));
    markersRef.current = [];

    filteredStations.forEach((station) => {
      const markerColor =
        station.status === "available"
          ? "#10b981"
          : station.status === "limited"
          ? "#f59e0b"
          : "#ef4444";

      const marker = new window.google.maps.Marker({
        position: { lat: station.lat, lng: station.lng },
        map: googleMapRef.current,
        title: station.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerColor,
          fillOpacity: 0.8,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        setSelectedStation(station);
        setIsDetailsModalOpen(true);
      });

      markersRef.current.push(marker);
    });
  };

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
    if (!googleMapRef.current || !directionsRendererRef.current || !hasValidCoordinates(currentUserLocation)) {
      setLocationError("Cannot navigate: User location is not available.");
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: currentUserLocation.latitude, lng: currentUserLocation.longitude },
        destination: { lat: station.lat, lng: station.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === window.google.maps.DirectionsStatus.OK && result && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
          if (googleMapRef.current) {
            googleMapRef.current.setZoom(14);
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(new window.google.maps.LatLng(currentUserLocation.latitude, currentUserLocation.longitude));
            bounds.extend(new window.google.maps.LatLng(station.lat, station.lng));
            googleMapRef.current.fitBounds(bounds);
          }
        } else {
          setLocationError("Unable to calculate route. Please try again.");
        }
      }
    );
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
                <p className="text-gray-400 text-sm">Loading Google Maps...</p>
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

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Battery Level</span>
                      <span className="text-white font-medium">{station.batteryLevel.toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
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
                      className={`flex-1 text-center py-2 px-4 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 ${
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
                      className={`flex-1 text-center py-2 px-4 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 ${
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
      )}
    </div>
  );
};

export default ChargingStationFinder;
