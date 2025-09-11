//optimized and working without geo name
// 'use client';

// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { Clock, Maximize2, Minimize2 } from 'lucide-react';
// import { Toaster, toast } from 'react-hot-toast';
// import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

// interface LocationData {
//     latitude: number;
//     longitude: number;
//     timestamp: number;
//     [key: string]: any;
// }

// interface LocationViewProps {
//     userLocation: LocationData | null;
//     isLocationActive: boolean;
// }

// const LocationView: React.FC<LocationViewProps> = ({
//     userLocation,
//     isLocationActive,
// }) => {
//     const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
//     const [activeTab, setActiveTab] = useState<string>('1hour');
//     const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
//     const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
//     const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
//     const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
//     const [isLoading, setIsLoading] = useState<boolean>(true);

//     const initialized = useRef(false);
//     const processingLocation = useRef(false);
//     const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
//     const mapRef = useRef<google.maps.Map | null>(null);
//     const hasCentered = useRef(false); // Track if map has been centered

//     const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCj4szs84b3W-K6QSDV79gd8CK3tmKdDZ0';
//     if (!GOOGLE_MAPS_API_KEY) {
//         console.error('Google Maps API key is missing.');
//     }

//     const mapContainerStyle = {
//         height: isFullScreenMap ? 'calc(100vh - 60px)' : '192px',
//         width: '100%',
//         borderRadius: isFullScreenMap ? '0' : '8px',
//         overflow: 'hidden',
//     };

//     // Validate coordinates
//     const hasValidCoordinates = useCallback((location: LocationData | null): location is LocationData => {
//         return !!location &&
//                location.latitude !== 0 &&
//                location.longitude !== 0 &&
//                !isNaN(location.latitude) &&
//                !isNaN(location.longitude);
//     }, []);

//     // Get polyline color
//     const getPolylineColor = useCallback((timestamp: number, activeTab: string): string => {
//         const now = Date.now();
//         const timeDiff = now - timestamp;

//         switch (activeTab) {
//             case '1hour':
//                 return timeDiff < 30 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '8hours':
//                 return timeDiff < 4 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '12hours':
//                 return timeDiff < 6 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '24hours':
//                 return timeDiff < 12 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             default:
//                 return '#3B82F6';
//         }
//     }, []);

//     // Load location history
//     useEffect(() => {
//         if (!initialized.current) {
//             const storedHistory = localStorage.getItem('locationHistory');
//             if (storedHistory) {
//                 try {
//                     const parsedHistory = JSON.parse(storedHistory) as LocationData[];
//                     setLocationHistory(parsedHistory);
//                 } catch (error) {
//                     console.error('Error parsing stored location history:', error);
//                     toast.error('Failed to load location history.');
//                 }
//             }
//             initialized.current = true;
//         }
//     }, []);

//     // Show welcome notification
//     useEffect(() => {
//         if (initialized.current && isLocationActive) {
//             toast.success('Location tracking is active', { id: 'location-active', duration: 3000 });
//         }
//     }, [isLocationActive]);

//     // Update loading state and map center
//     useEffect(() => {
//         if (hasValidCoordinates(userLocation)) {
//             setIsLoading(false);
//             if (!hasCentered.current) {
//                 setMapCenter({ lat: userLocation.latitude, lng: userLocation.longitude });
//                 if (mapRef.current) {
//                     mapRef.current.setCenter({
//                         lat: userLocation.latitude,
//                         lng: userLocation.longitude,
//                     });
//                     mapRef.current.setZoom(15);
//                     hasCentered.current = true;
//                 }
//             }
//         } else {
//             setIsLoading(true);
//         }
//     }, [userLocation, hasValidCoordinates]);

//     // Process new location
//     useEffect(() => {
//         if (!hasValidCoordinates(userLocation) || processingLocation.current) return;

//         const hasLocationChangedSignificantly = () => {
//             if (!lastProcessedLocation.current) return true;
//             const DISTANCE_THRESHOLD = 0.001; // ~100 meters
//             return (
//                 Math.abs(lastProcessedLocation.current.lat - userLocation.latitude) > DISTANCE_THRESHOLD ||
//                 Math.abs(lastProcessedLocation.current.lon - userLocation.longitude) > DISTANCE_THRESHOLD
//             );
//         };

//         if (!hasLocationChangedSignificantly()) return;

//         processingLocation.current = true;

//         const newLocation = {
//             ...userLocation,
//             timestamp: Date.now(),
//         };

//         setLocationHistory((prev) => {
//             const updatedHistory = [newLocation, ...prev];
//             const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//             const trimmedHistory = updatedHistory.filter((loc) => loc.timestamp >= sevenDaysAgo);

//             try {
//                 localStorage.setItem('locationHistory', JSON.stringify(trimmedHistory));
//             } catch (error) {
//                 console.error('Error saving location history:', error);
//                 toast.error('Failed to save location data.');
//             }
//             return trimmedHistory;
//         });

//         lastProcessedLocation.current = {
//             lat: userLocation.latitude,
//             lon: userLocation.longitude,
//         };

//         processingLocation.current = false;
//     }, [userLocation, hasValidCoordinates]);

//     // Filter locations
//     const filteredLocationsMemo = useMemo(() => {
//         const now = Date.now();
//         let timeThreshold: number;
//         switch (activeTab) {
//             case '1hour':
//                 timeThreshold = now - 1 * 60 * 60 * 1000;
//                 break;
//             case '8hours':
//                 timeThreshold = now - 8 * 60 * 60 * 1000;
//                 break;
//             case '12hours':
//                 timeThreshold = now - 12 * 60 * 60 * 1000;
//                 break;
//             case '24hours':
//                 timeThreshold = now - 24 * 60 * 60 * 1000;
//                 break;
//             default:
//                 timeThreshold = now - 1 * 60 * 60 * 1000;
//         }

//         let filtered = locationHistory.filter(
//             (location) =>
//                 location.timestamp >= timeThreshold &&
//                 hasValidCoordinates(location)
//         );

//         if (activeTab === '24hours' && filtered.length > 1000) {
//             const step = Math.ceil(filtered.length / 500);
//             filtered = filtered.filter((_, index) => index % step === 0);
//         }

//         return filtered;
//     }, [activeTab, locationHistory, hasValidCoordinates]);

//     // Update filtered locations and map bounds
//     useEffect(() => {
//         setFilteredLocations(filteredLocationsMemo);

//         if (mapRef.current && filteredLocationsMemo.length > 0 && !hasCentered.current) {
//             const bounds = new google.maps.LatLngBounds();
//             filteredLocationsMemo.forEach((loc) => {
//                 bounds.extend({ lat: loc.latitude, lng: loc.longitude });
//             });
//             mapRef.current.fitBounds(bounds, 50);
//             hasCentered.current = true;
//         }
//     }, [filteredLocationsMemo]);

//     const formatTimestamp = (timestamp: number): string => {
//         return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     };

//     const formatDate = (timestamp: number): string => {
//         return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
//     };

//     const shouldShowDate = (timestamp: number, index: number, locations: LocationData[]): boolean => {
//         if (index === 0) return true;
//         return new Date(locations[index - 1].timestamp).toDateString() !== new Date(timestamp).toDateString();
//     };

//     const onMapLoad = useCallback((map: google.maps.Map) => {
//         mapRef.current = map;
//         if (hasValidCoordinates(userLocation) && !hasCentered.current) {
//             map.setCenter({
//                 lat: userLocation.latitude,
//                 lng: userLocation.longitude,
//             });
//             map.setZoom(15);
//             hasCentered.current = true;
//         }
//     }, [userLocation, hasValidCoordinates]);

//     const handleMarkerClick = (location: LocationData) => {
//         setSelectedLocation(location);
//         if (mapRef.current) {
//             mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
//             mapRef.current.setZoom(16);
//             hasCentered.current = true;
//         }
//     };

//     const handleListItemClick = (location: LocationData) => {
//         setMapCenter({ lat: location.latitude, lng: location.longitude });
//         setSelectedLocation(location);
//         if (mapRef.current) {
//             mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
//             mapRef.current.setZoom(16);
//             hasCentered.current = true;
//         }
//     };

//     const toggleFullScreenMap = () => {
//         setIsFullScreenMap((prev) => !prev);
//         setTimeout(() => {
//             if (mapRef.current) {
//                 google.maps.event.trigger(mapRef.current, 'resize');
//                 if (filteredLocations.length > 0 && !hasCentered.current) {
//                     const bounds = new google.maps.LatLngBounds();
//                     filteredLocations.forEach((loc) => {
//                         bounds.extend({ lat: loc.latitude, lng: loc.longitude });
//                     });
//                     mapRef.current.fitBounds(bounds, 50);
//                     hasCentered.current = true;
//                 } else if (hasValidCoordinates(userLocation) && !hasCentered.current) {
//                     mapRef.current.setCenter({
//                         lat: userLocation.latitude,
//                         lng: userLocation.longitude,
//                     });
//                     mapRef.current.setZoom(15);
//                     hasCentered.current = true;
//                 }
//             }
//         }, 100);
//     };

//     return (
//         <div className={`p-4 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] ${isFullScreenMap ? 'fixed inset-0 z-50' : 'min-h-screen'}`}>
//             <Toaster />

//             {isFullScreenMap && (
//                 <div className="flex justify-center items-center p-2 bg-[#2A2F33] mb-2 rounded-lg">
//                     <h2 className="text-white text-lg font-medium">Map View</h2>
//                 </div>
//             )}

//             <div className={`${isFullScreenMap ? '' : 'mt-2'}`}>
//                 <div className="bg-[#2A2F33] rounded-lg p-4 relative">
//                     {!isFullScreenMap && <h3 className="text-white text-lg font-medium mb-2">Map View</h3>}

//                     {!isFullScreenMap && (
//                         <button
//                             onClick={toggleFullScreenMap}
//                             className="absolute top-4 right-4 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 z-[1000]"
//                             aria-label="Maximize map"
//                         >
//                             <Maximize2 size={20} />
//                         </button>
//                     )}

//                     {GOOGLE_MAPS_API_KEY ? (
//                         isLoading ? (
//                             <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
//                                 <div className="flex flex-col items-center">
//                                     <svg
//                                         className="animate-spin h-8 w-8 text-blue-500"
//                                         xmlns="http://www.w3.org/2000/svg"
//                                         fill="none"
//                                         viewBox="0 0 24 24"
//                                     >
//                                         <circle
//                                             className="opacity-25"
//                                             cx="12"
//                                             cy="12"
//                                             r="10"
//                                             stroke="currentColor"
//                                             strokeWidth="4"
//                                         ></circle>
//                                         <path
//                                             className="opacity-75"
//                                             fill="currentColor"
//                                             d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                                         ></path>
//                                     </svg>
//                                     <p className="text-gray-400 text-sm mt-2">Loading location...</p>
//                                 </div>
//                             </div>
//                         ) : (
//                             <div className="mb-4 relative">
//                                 <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
//                                     <GoogleMap
//                                         mapContainerStyle={mapContainerStyle}
//                                         center={mapCenter || { lat: -1.286389, lng: 36.817223 }}
//                                         zoom={15}
//                                         options={{
//                                             disableDefaultUI: false,
//                                             zoomControl: true,
//                                             mapTypeControl: isFullScreenMap,
//                                             scaleControl: isFullScreenMap,
//                                             streetViewControl: isFullScreenMap,
//                                             rotateControl: isFullScreenMap,
//                                             fullscreenControl: false,
//                                         }}
//                                         onLoad={onMapLoad}
//                                     >
//                                         {filteredLocations.map((location, index) => (
//                                             <Marker
//                                                 key={index}
//                                                 position={{ lat: location.latitude, lng: location.longitude }}
//                                                 title={`Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`}
//                                                 onClick={() => handleMarkerClick(location)}
//                                             />
//                                         ))}
//                                         {hasValidCoordinates(userLocation) && (
//                                             <Marker
//                                                 position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
//                                                 title={`Current: Lat: ${userLocation.latitude.toFixed(4)}, Lon: ${userLocation.longitude.toFixed(4)}`}
//                                                 icon={{
//                                                     url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', // Distinct blue dot for current location
//                                                 }}
//                                                 onClick={() => handleMarkerClick(userLocation)}
//                                             />
//                                         )}
//                                         {filteredLocations.length > 1 && (
//                                             filteredLocations.slice(1).map((location, index) => (
//                                                 <Polyline
//                                                     key={index}
//                                                     path={[
//                                                         {
//                                                             lat: filteredLocations[index].latitude,
//                                                             lng: filteredLocations[index].longitude,
//                                                         },
//                                                         {
//                                                             lat: location.latitude,
//                                                             lng: location.longitude,
//                                                         },
//                                                     ]}
//                                                     options={{
//                                                         strokeColor: getPolylineColor(location.timestamp, activeTab),
//                                                         strokeOpacity: 0.8,
//                                                         strokeWeight: 4,
//                                                     }}
//                                                 />
//                                             ))
//                                         )}
//                                         {selectedLocation && (
//                                             <InfoWindow
//                                                 position={{
//                                                     lat: selectedLocation.latitude,
//                                                     lng: selectedLocation.longitude,
//                                                 }}
//                                                 onCloseClick={() => setSelectedLocation(null)}
//                                             >
//                                                 <div className="text-black">
//                                                     <p>Lat: {selectedLocation.latitude.toFixed(4)}</p>
//                                                     <p>Lon: {selectedLocation.longitude.toFixed(4)}</p>
//                                                     <p>{formatTimestamp(selectedLocation.timestamp)}</p>
//                                                     <p>{formatDate(selectedLocation.timestamp)}</p>
//                                                 </div>
//                                             </InfoWindow>
//                                         )}
//                                         {isFullScreenMap && (
//                                             <div className="absolute top-4 right-4 z-[1000]">
//                                                 <button
//                                                     onClick={toggleFullScreenMap}
//                                                     className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
//                                                     aria-label="Exit fullscreen"
//                                                 >
//                                                     <Minimize2 size={20} />
//                                                 </button>
//                                             </div>
//                                         )}
//                                     </GoogleMap>
//                                 </LoadScript>
//                             </div>
//                         )
//                     ) : (
//                         <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
//                             <p className="text-gray-500 text-sm">Google Maps API key missing.</p>
//                         </div>
//                     )}

//                     {!isFullScreenMap && (
//                         <div className="space-y-3">
//                             {hasValidCoordinates(userLocation) && !isLoading ? (
//                                 <div className="mt-2 p-3 bg-[#34393E] rounded">
//                                     <p className="text-white text-sm">Lat: {userLocation.latitude.toFixed(4)}</p>
//                                     <p className="text-white text-sm">Lon: {userLocation.longitude.toFixed(4)}</p>
//                                     <p className="text-gray-400 text-xs mt-1">Status: {isLocationActive ? 'Active' : 'Inactive'}</p>
//                                     <p className="text-gray-400 text-xs">
//                                         Time: {new Date().toLocaleTimeString([], {
//                                             hour: '2-digit',
//                                             minute: '2-digit',
//                                             second: '2-digit',
//                                         })}
//                                     </p>
//                                 </div>
//                             ) : (
//                                 <p className="text-gray-400 text-sm">{isLoading ? 'Loading location data...' : 'No location data available'}</p>
//                             )}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {!isFullScreenMap && (
//                 <div className="bg-[#2A2F33] rounded-lg p-4 mt-4">
//                     <h3 className="text-white text-lg font-medium mb-4">My Routes</h3>

//                     <div className="flex bg-[#34393E] rounded mb-4">
//                         {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
//                             <button
//                                 key={tab}
//                                 onClick={() => setActiveTab(tab)}
//                                 className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded' : 'text-gray-300'}`}
//                             >
//                                 {tab === '1hour' ? '1 Hour' :
//                                  tab === '8hours' ? '8 Hours' :
//                                  tab === '12hours' ? '12 Hours' : '24 Hours'}
//                             </button>
//                         ))}
//                     </div>

//                     <div className="max-h-96 overflow-y-auto">
//                         {filteredLocations.length > 0 ? (
//                             filteredLocations.map((location, index) => (
//                                 <div
//                                     key={index}
//                                     className="mt-2 p-3 bg-[#34393E] rounded mb-2 border-l-4 border-blue-500 cursor-pointer hover:bg-[#3A3F44]"
//                                     onClick={() => handleListItemClick(location)}
//                                 >
//                                     {shouldShowDate(location.timestamp, index, filteredLocations) && (
//                                         <div className="my-2 px-2 py-1 bg-[#222529] rounded text-gray-300 text-xs">
//                                             {formatDate(location.timestamp)}
//                                         </div>
//                                     )}
//                                     <div className="flex justify-between items-start">
//                                         <div>
//                                             <div className="flex items-center text-white text-sm mb-1">
//                                                 <Clock size={14} className="mr-1 text-gray-400" />
//                                                 {formatTimestamp(location.timestamp)}
//                                             </div>
//                                             <p className="text-white text-sm">Lat: {location.latitude.toFixed(4)}</p>
//                                             <p className="text-white text-sm">Lon: {location.longitude.toFixed(4)}</p>
//                                         </div>
//                                     </div>
//                                 </div>
//                             ))
//                         ) : (
//                             <p className="text-gray-400 text-sm text-center py-4">
//                                 No location history available for this period
//                             </p>
//                         )}
//                     </div>
//                 </div>
//             )}

//             {isFullScreenMap && (
//                 <div className="fixed bottom-4 left-0 right-0 flex justify-center">
//                     <div className="flex bg-[#34393E] rounded-full shadow-lg">
//                         {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
//                             <button
//                                 key={tab}
//                                 onClick={() => setActiveTab(tab)}
//                                 className={`py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'}`}
//                             >
//                                 {tab === '1hour' ? '1 Hour' :
//                                  tab === '8hours' ? '8 Hours' :
//                                  tab === '12hours' ? '12 Hours' : '24 Hours'}
//                             </button>
//                         ))}
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default LocationView;


//old
// 'use client';

// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { Clock, Maximize2, Minimize2 } from 'lucide-react';
// import { Toaster, toast } from 'react-hot-toast';
// import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

// interface LocationData {
//     latitude: number;
//     longitude: number;
//     timestamp: number;
//     displayName?: string;
//     [key: string]: any;
// }

// interface LocationViewProps {
//     userLocation: LocationData | null;
//     isLocationActive: boolean;
// }

// const LocationView: React.FC<LocationViewProps> = ({
//     userLocation,
//     isLocationActive,
// }) => {
//     const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
//     const [activeTab, setActiveTab] = useState<string>('1hour');
//     const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
//     const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
//     const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
//     const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
//     const [isLoading, setIsLoading] = useState<boolean>(true);
//     const [loadingLocationName, setLoadingLocationName] = useState<boolean>(false);

//     const initialized = useRef(false);
//     const processingLocation = useRef(false);
//     const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
//     const mapRef = useRef<google.maps.Map | null>(null);
//     const hasCentered = useRef(false);

//     const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBHAFAinU-erE7ltSCmNyoyAmrdtvv8pGs';
//     if (!GOOGLE_MAPS_API_KEY) {
//         console.error('Google Maps API key is missing.');
//     }

//     const mapContainerStyle = {
//         height: isFullScreenMap ? 'calc(100vh - 60px)' : '192px',
//         width: '100%',
//         borderRadius: isFullScreenMap ? '0' : '8px',
//         overflow: 'hidden',
//     };

//     // Fetch location name from Nominatim API
//     const fetchLocationName = useCallback(async (lat: number, lon: number): Promise<string> => {
//         try {
//             setLoadingLocationName(true);
//             const response = await fetch(
//                 `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
//             );
//             const data = await response.json();
//             return data.display_name || 'Unknown location';
//         } catch (error) {
//             console.error('Error fetching location name:', error);
//             return 'Unknown location';
//         } finally {
//             setLoadingLocationName(false);
//         }
//     }, []);

//     // Validate coordinates
//     const hasValidCoordinates = useCallback((location: LocationData | null): location is LocationData => {
//         return !!location &&
//                location.latitude !== 0 &&
//                location.longitude !== 0 &&
//                !isNaN(location.latitude) &&
//                !isNaN(location.longitude);
//     }, []);

//     // Get polyline color
//     const getPolylineColor = useCallback((timestamp: number, activeTab: string): string => {
//         const now = Date.now();
//         const timeDiff = now - timestamp;

//         switch (activeTab) {
//             case '1hour':
//                 return timeDiff < 30 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '8hours':
//                 return timeDiff < 4 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '12hours':
//                 return timeDiff < 6 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             case '24hours':
//                 return timeDiff < 12 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
//             default:
//                 return '#3B82F6';
//         }
//     }, []);

//     // Load location history
//     useEffect(() => {
//         if (!initialized.current) {
//             const storedHistory = localStorage.getItem('locationHistory');
//             if (storedHistory) {
//                 try {
//                     const parsedHistory = JSON.parse(storedHistory) as LocationData[];
//                     setLocationHistory(parsedHistory);
//                 } catch (error) {
//                     console.error('Error parsing stored location history:', error);
//                     toast.error('Failed to load location history.');
//                 }
//             }
//             initialized.current = true;
//         }
//     }, []);

//     // Show welcome notification
//     useEffect(() => {
//         if (initialized.current && isLocationActive) {
//             toast.success('Location tracking is active', { id: 'location-active', duration: 3000 });
//         }
//     }, [isLocationActive]);

//     // Update loading state and map center
//     useEffect(() => {
//         if (hasValidCoordinates(userLocation)) {
//             setIsLoading(false);
//             if (!hasCentered.current) {
//                 setMapCenter({ lat: userLocation.latitude, lng: userLocation.longitude });
//                 if (mapRef.current) {
//                     mapRef.current.setCenter({
//                         lat: userLocation.latitude,
//                         lng: userLocation.longitude,
//                     });
//                     mapRef.current.setZoom(15);
//                     hasCentered.current = true;
//                 }
                
//                 // Fetch and set display name for current location
//                 if (!userLocation.displayName) {
//                     fetchLocationName(userLocation.latitude, userLocation.longitude)
//                         .then(displayName => {
//                             setLocationHistory(prev => prev.map(loc => 
//                                 loc.latitude === userLocation.latitude && 
//                                 loc.longitude === userLocation.longitude ? 
//                                 {...loc, displayName} : loc
//                             ));
//                         });
//                 }
//             }
//         } else {
//             setIsLoading(true);
//         }
//     }, [userLocation, hasValidCoordinates, fetchLocationName]);

//     // Process new location
//     useEffect(() => {
//         if (!hasValidCoordinates(userLocation) || processingLocation.current) return;

//         const hasLocationChangedSignificantly = () => {
//             if (!lastProcessedLocation.current) return true;
//             const DISTANCE_THRESHOLD = 0.001; // ~100 meters
//             return (
//                 Math.abs(lastProcessedLocation.current.lat - userLocation.latitude) > DISTANCE_THRESHOLD ||
//                 Math.abs(lastProcessedLocation.current.lon - userLocation.longitude) > DISTANCE_THRESHOLD
//             );
//         };

//         if (!hasLocationChangedSignificantly()) return;

//         processingLocation.current = true;

//         const processLocation = async () => {
//             const displayName = await fetchLocationName(userLocation.latitude, userLocation.longitude);
//             const newLocation = {
//                 ...userLocation,
//                 timestamp: Date.now(),
//                 displayName
//             };

//             setLocationHistory((prev) => {
//                 const updatedHistory = [newLocation, ...prev];
//                 const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//                 const trimmedHistory = updatedHistory.filter((loc) => loc.timestamp >= sevenDaysAgo);

//                 try {
//                     localStorage.setItem('locationHistory', JSON.stringify(trimmedHistory));
//                 } catch (error) {
//                     console.error('Error saving location history:', error);
//                     toast.error('Failed to save location data.');
//                 }
//                 return trimmedHistory;
//             });

//             lastProcessedLocation.current = {
//                 lat: userLocation.latitude,
//                 lon: userLocation.longitude,
//             };

//             processingLocation.current = false;
//         };

//         processLocation();
//     }, [userLocation, hasValidCoordinates, fetchLocationName]);

//     // Filter locations
//     const filteredLocationsMemo = useMemo(() => {
//         const now = Date.now();
//         let timeThreshold: number;
//         switch (activeTab) {
//             case '1hour':
//                 timeThreshold = now - 1 * 60 * 60 * 1000;
//                 break;
//             case '8hours':
//                 timeThreshold = now - 8 * 60 * 60 * 1000;
//                 break;
//             case '12hours':
//                 timeThreshold = now - 12 * 60 * 60 * 1000;
//                 break;
//             case '24hours':
//                 timeThreshold = now - 24 * 60 * 60 * 1000;
//                 break;
//             default:
//                 timeThreshold = now - 1 * 60 * 60 * 1000;
//         }

//         let filtered = locationHistory.filter(
//             (location) =>
//                 location.timestamp >= timeThreshold &&
//                 hasValidCoordinates(location)
//         );

//         if (activeTab === '24hours' && filtered.length > 1000) {
//             const step = Math.ceil(filtered.length / 500);
//             filtered = filtered.filter((_, index) => index % step === 0);
//         }

//         return filtered;
//     }, [activeTab, locationHistory, hasValidCoordinates]);

//     // Update filtered locations and map bounds
//     useEffect(() => {
//         setFilteredLocations(filteredLocationsMemo);

//         if (mapRef.current && filteredLocationsMemo.length > 0 && !hasCentered.current) {
//             const bounds = new google.maps.LatLngBounds();
//             filteredLocationsMemo.forEach((loc) => {
//                 bounds.extend({ lat: loc.latitude, lng: loc.longitude });
//             });
//             mapRef.current.fitBounds(bounds, 50);
//             hasCentered.current = true;
//         }
//     }, [filteredLocationsMemo]);

//     const formatTimestamp = (timestamp: number): string => {
//         return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     };

//     const formatDate = (timestamp: number): string => {
//         return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
//     };

//     const shouldShowDate = (timestamp: number, index: number, locations: LocationData[]): boolean => {
//         if (index === 0) return true;
//         return new Date(locations[index - 1].timestamp).toDateString() !== new Date(timestamp).toDateString();
//     };

//     const onMapLoad = useCallback((map: google.maps.Map) => {
//         mapRef.current = map;
//         if (hasValidCoordinates(userLocation) && !hasCentered.current) {
//             map.setCenter({
//                 lat: userLocation.latitude,
//                 lng: userLocation.longitude,
//             });
//             map.setZoom(15);
//             hasCentered.current = true;
//         }
//     }, [userLocation, hasValidCoordinates]);

//     const handleMarkerClick = (location: LocationData) => {
//         setSelectedLocation(location);
//         if (mapRef.current) {
//             mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
//             mapRef.current.setZoom(16);
//             hasCentered.current = true;
//         }
//     };

//     const handleListItemClick = (location: LocationData) => {
//         setMapCenter({ lat: location.latitude, lng: location.longitude });
//         setSelectedLocation(location);
//         if (mapRef.current) {
//             mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
//             mapRef.current.setZoom(16);
//             hasCentered.current = true;
//         }
//     };

//     const toggleFullScreenMap = () => {
//         setIsFullScreenMap((prev) => !prev);
//         setTimeout(() => {
//             if (mapRef.current) {
//                 google.maps.event.trigger(mapRef.current, 'resize');
//                 if (filteredLocations.length > 0 && !hasCentered.current) {
//                     const bounds = new google.maps.LatLngBounds();
//                     filteredLocations.forEach((loc) => {
//                         bounds.extend({ lat: loc.latitude, lng: loc.longitude });
//                     });
//                     mapRef.current.fitBounds(bounds, 50);
//                     hasCentered.current = true;
//                 } else if (hasValidCoordinates(userLocation) && !hasCentered.current) {
//                     mapRef.current.setCenter({
//                         lat: userLocation.latitude,
//                         lng: userLocation.longitude,
//                     });
//                     mapRef.current.setZoom(15);
//                     hasCentered.current = true;
//                 }
//             }
//         }, 100);
//     };

//     return (
//         <div className={`p-4 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] ${isFullScreenMap ? 'fixed inset-0 z-50' : 'min-h-screen'}`}>
//             <Toaster />

//             {isFullScreenMap && (
//                 <div className="flex justify-center items-center p-2 bg-[#2A2F33] mb-2 rounded-lg">
//                     <h2 className="text-white text-lg font-medium">Map View</h2>
//                 </div>
//             )}

//             <div className={`${isFullScreenMap ? '' : 'mt-2'}`}>
//                 <div className="bg-[#2A2F33] rounded-lg p-4 relative">
//                     {!isFullScreenMap && <h3 className="text-white text-lg font-medium mb-2">Map View</h3>}

//                     {!isFullScreenMap && (
//                         <button
//                             onClick={toggleFullScreenMap}
//                             className="absolute top-4 right-4 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 z-[1000]"
//                             aria-label="Maximize map"
//                         >
//                             <Maximize2 size={20} />
//                         </button>
//                     )}

//                     {GOOGLE_MAPS_API_KEY ? (
//                         isLoading ? (
//                             <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
//                                 <div className="flex flex-col items-center">
//                                     <svg
//                                         className="animate-spin h-8 w-8 text-blue-500"
//                                         xmlns="http://www.w3.org/2000/svg"
//                                         fill="none"
//                                         viewBox="0 0 24 24"
//                                     >
//                                         <circle
//                                             className="opacity-25"
//                                             cx="12"
//                                             cy="12"
//                                             r="10"
//                                             stroke="currentColor"
//                                             strokeWidth="4"
//                                         ></circle>
//                                         <path
//                                             className="opacity-75"
//                                             fill="currentColor"
//                                             d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                                         ></path>
//                                     </svg>
//                                     <p className="text-gray-400 text-sm mt-2">Loading location...</p>
//                                 </div>
//                             </div>
//                         ) : (
//                             <div className="mb-4 relative">
//                                 <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
//                                     <GoogleMap
//                                         mapContainerStyle={mapContainerStyle}
//                                         center={mapCenter || { lat: -1.286389, lng: 36.817223 }}
//                                         zoom={15}
//                                         options={{
//                                             disableDefaultUI: false,
//                                             zoomControl: true,
//                                             mapTypeControl: isFullScreenMap,
//                                             scaleControl: isFullScreenMap,
//                                             streetViewControl: isFullScreenMap,
//                                             rotateControl: isFullScreenMap,
//                                             fullscreenControl: false,
//                                         }}
//                                         onLoad={onMapLoad}
//                                     >
//                                         {filteredLocations.map((location, index) => (
//                                             <Marker
//                                                 key={index}
//                                                 position={{ lat: location.latitude, lng: location.longitude }}
//                                                 title={location.displayName || `Location at ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
//                                                 onClick={() => handleMarkerClick(location)}
//                                             />
//                                         ))}
//                                         {hasValidCoordinates(userLocation) && (
//                                             <Marker
//                                                 position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
//                                                 title={userLocation.displayName || `Current location at ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
//                                                 icon={{
//                                                     url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
//                                                 }}
//                                                 onClick={() => handleMarkerClick(userLocation)}
//                                             />
//                                         )}
//                                         {filteredLocations.length > 1 && (
//                                             filteredLocations.slice(1).map((location, index) => (
//                                                 <Polyline
//                                                     key={index}
//                                                     path={[
//                                                         {
//                                                             lat: filteredLocations[index].latitude,
//                                                             lng: filteredLocations[index].longitude,
//                                                         },
//                                                         {
//                                                             lat: location.latitude,
//                                                             lng: location.longitude,
//                                                         },
//                                                     ]}
//                                                     options={{
//                                                         strokeColor: getPolylineColor(location.timestamp, activeTab),
//                                                         strokeOpacity: 0.8,
//                                                         strokeWeight: 4,
//                                                     }}
//                                                 />
//                                             ))
//                                         )}
//                                         {selectedLocation && (
//                                             <InfoWindow
//                                                 position={{
//                                                     lat: selectedLocation.latitude,
//                                                     lng: selectedLocation.longitude,
//                                                 }}
//                                                 onCloseClick={() => setSelectedLocation(null)}
//                                             >
//                                                 <div className="text-black">
//                                                     <p className="font-medium">
//                                                         {selectedLocation.displayName || 'Unknown location'}
//                                                     </p>
//                                                     <p className="text-sm text-gray-600 mt-1">
//                                                         {formatTimestamp(selectedLocation.timestamp)}
//                                                     </p>
//                                                     <p className="text-xs text-gray-500">
//                                                         {formatDate(selectedLocation.timestamp)}
//                                                     </p>
//                                                 </div>
//                                             </InfoWindow>
//                                         )}
//                                         {isFullScreenMap && (
//                                             <div className="absolute top-4 right-4 z-[1000]">
//                                                 <button
//                                                     onClick={toggleFullScreenMap}
//                                                     className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
//                                                     aria-label="Exit fullscreen"
//                                                 >
//                                                     <Minimize2 size={20} />
//                                                 </button>
//                                             </div>
//                                         )}
//                                     </GoogleMap>
//                                 </LoadScript>
//                             </div>
//                         )
//                     ) : (
//                         <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
//                             <p className="text-gray-500 text-sm">Google Maps API key missing.</p>
//                         </div>
//                     )}

//                     {!isFullScreenMap && (
//                         <div className="space-y-3">
//                             {hasValidCoordinates(userLocation) && !isLoading ? (
//                                 <div className="mt-2 p-3 bg-[#34393E] rounded">
                                   
//                                     <p className="text-gray-400 text-xs mt-1">Status: {isLocationActive ? 'Active' : 'Inactive'}</p>
//                                     <p className="text-gray-400 text-xs">
//                                         Time: {new Date().toLocaleTimeString([], {
//                                             hour: '2-digit',
//                                             minute: '2-digit',
//                                             second: '2-digit',
//                                         })}
//                                     </p>
//                                 </div>
//                             ) : (
//                                 <p className="text-gray-400 text-sm">{isLoading ? 'Loading location data...' : 'No location data available'}</p>
//                             )}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {!isFullScreenMap && (
//                 <div className="bg-[#2A2F33] rounded-lg p-4 mt-4">
//                     <h3 className="text-white text-lg font-medium mb-4">My Routes</h3>

//                     <div className="flex bg-[#34393E] rounded mb-4">
//                         {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
//                             <button
//                                 key={tab}
//                                 onClick={() => setActiveTab(tab)}
//                                 className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded' : 'text-gray-300'}`}
//                             >
//                                 {tab === '1hour' ? '1 Hour' :
//                                  tab === '8hours' ? '8 Hours' :
//                                  tab === '12hours' ? '12 Hours' : '24 Hours'}
//                             </button>
//                         ))}
//                     </div>

//                     <div className="max-h-96 overflow-y-auto">
//                         {filteredLocations.length > 0 ? (
//                             filteredLocations.map((location, index) => (
//                                 <div
//                                     key={index}
//                                     className="mt-2 p-3 bg-[#34393E] rounded mb-2 border-l-4 border-blue-500 cursor-pointer hover:bg-[#3A3F44]"
//                                     onClick={() => handleListItemClick(location)}
//                                 >
//                                     {shouldShowDate(location.timestamp, index, filteredLocations) && (
//                                         <div className="my-2 px-2 py-1 bg-[#222529] rounded text-gray-300 text-xs">
//                                             {formatDate(location.timestamp)}
//                                         </div>
//                                     )}
//                                     <div className="flex justify-between items-start">
//                                         <div>
//                                             <div className="flex items-center text-white text-sm mb-1">
//                                                 <Clock size={14} className="mr-1 text-gray-400" />
//                                                 {formatTimestamp(location.timestamp)}
//                                             </div>
//                                             <p className="text-white text-sm">
//                                                 {location.displayName || 'Unknown location'}
//                                             </p>
//                                         </div>
//                                     </div>
//                                 </div>
//                             ))
//                         ) : (
//                             <p className="text-gray-400 text-sm text-center py-4">
//                                 No location history available for this period
//                             </p>
//                         )}
//                     </div>
//                 </div>
//             )}

//             {isFullScreenMap && (
//                 <div className="fixed bottom-4 left-0 right-0 flex justify-center">
//                     <div className="flex bg-[#34393E] rounded-full shadow-lg">
//                         {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
//                             <button
//                                 key={tab}
//                                 onClick={() => setActiveTab(tab)}
//                                 className={`py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'}`}
//                             >
//                                 {tab === '1hour' ? '1 Hour' :
//                                  tab === '8hours' ? '8 Hours' :
//                                  tab === '12hours' ? '12 Hours' : '24 Hours'}
//                             </button>
//                         ))}
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default LocationView;

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, Maximize2, Minimize2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// Note: You'll need to install these dependencies:
// npm install leaflet react-leaflet
// npm install @types/leaflet (for TypeScript)

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom blue icon for current location
const currentLocationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Regular marker icon for history locations
const historyLocationIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface LocationData {
    latitude: number;
    longitude: number;
    timestamp: number;
    displayName?: string;
    [key: string]: any;
}

interface LocationViewProps {
    userLocation: LocationData | null;
    isLocationActive: boolean;
}

// Component to handle map events and updates
const MapController: React.FC<{
    center: [number, number] | null;
    selectedLocation: LocationData | null;
    filteredLocations: LocationData[];
    hasUserLocation: boolean;
}> = ({ center, selectedLocation, filteredLocations, hasUserLocation }) => {
    const map = useMap();

    useEffect(() => {
        if (center) {
            map.setView(center, 15);
        }
    }, [map, center]);

    useEffect(() => {
        if (selectedLocation) {
            map.setView([selectedLocation.latitude, selectedLocation.longitude], 16);
        }
    }, [map, selectedLocation]);

    useEffect(() => {
        if (filteredLocations.length > 0 && !hasUserLocation) {
            const group = new L.FeatureGroup(
                filteredLocations.map(loc => 
                    L.marker([loc.latitude, loc.longitude])
                )
            );
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }, [map, filteredLocations, hasUserLocation]);

    return null;
};

const LocationView: React.FC<LocationViewProps> = ({
    userLocation,
    isLocationActive,
}) => {
    const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
    const [activeTab, setActiveTab] = useState<string>('1hour');
    const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
    const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingLocationName, setLoadingLocationName] = useState<boolean>(false);

    const initialized = useRef(false);
    const processingLocation = useRef(false);
    const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
    const hasCentered = useRef(false);

    // Fetch location name from Nominatim API
    const fetchLocationName = useCallback(async (lat: number, lon: number): Promise<string> => {
        try {
            setLoadingLocationName(true);
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            const data = await response.json();
            return data.display_name || 'Unknown location';
        } catch (error) {
            console.error('Error fetching location name:', error);
            return 'Unknown location';
        } finally {
            setLoadingLocationName(false);
        }
    }, []);

    // Validate coordinates
    const hasValidCoordinates = useCallback((location: LocationData | null): location is LocationData => {
        return !!location &&
               location.latitude !== 0 &&
               location.longitude !== 0 &&
               !isNaN(location.latitude) &&
               !isNaN(location.longitude);
    }, []);

    // Get polyline color
    const getPolylineColor = useCallback((timestamp: number, activeTab: string): string => {
        const now = Date.now();
        const timeDiff = now - timestamp;

        switch (activeTab) {
            case '1hour':
                return timeDiff < 30 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
            case '8hours':
                return timeDiff < 4 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
            case '12hours':
                return timeDiff < 6 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
            case '24hours':
                return timeDiff < 12 * 60 * 60 * 1000 ? '#3B82F6' : '#93C5FD';
            default:
                return '#3B82F6';
        }
    }, []);

    // Load location history
    useEffect(() => {
        if (!initialized.current) {
            const storedHistory = localStorage.getItem('locationHistory');
            if (storedHistory) {
                try {
                    const parsedHistory = JSON.parse(storedHistory) as LocationData[];
                    setLocationHistory(parsedHistory);
                } catch (error) {
                    console.error('Error parsing stored location history:', error);
                    toast.error('Failed to load location history.');
                }
            }
            initialized.current = true;
        }
    }, []);

    // Show welcome notification
    useEffect(() => {
        if (initialized.current && isLocationActive) {
            toast.success('Location tracking is active', { id: 'location-active', duration: 3000 });
        }
    }, [isLocationActive]);

    // Update loading state and map center
    useEffect(() => {
        if (hasValidCoordinates(userLocation)) {
            setIsLoading(false);
            if (!hasCentered.current) {
                setMapCenter([userLocation.latitude, userLocation.longitude]);
                hasCentered.current = true;
                
                // Fetch and set display name for current location
                if (!userLocation.displayName) {
                    fetchLocationName(userLocation.latitude, userLocation.longitude)
                        .then(displayName => {
                            setLocationHistory(prev => prev.map(loc => 
                                loc.latitude === userLocation.latitude && 
                                loc.longitude === userLocation.longitude ? 
                                {...loc, displayName} : loc
                            ));
                        });
                }
            }
        } else {
            setIsLoading(true);
        }
    }, [userLocation, hasValidCoordinates, fetchLocationName]);

    // Process new location
    useEffect(() => {
        if (!hasValidCoordinates(userLocation) || processingLocation.current) return;

        const hasLocationChangedSignificantly = () => {
            if (!lastProcessedLocation.current) return true;
            const DISTANCE_THRESHOLD = 0.001; // ~100 meters
            return (
                Math.abs(lastProcessedLocation.current.lat - userLocation.latitude) > DISTANCE_THRESHOLD ||
                Math.abs(lastProcessedLocation.current.lon - userLocation.longitude) > DISTANCE_THRESHOLD
            );
        };

        if (!hasLocationChangedSignificantly()) return;

        processingLocation.current = true;

        const processLocation = async () => {
            const displayName = await fetchLocationName(userLocation.latitude, userLocation.longitude);
            const newLocation = {
                ...userLocation,
                timestamp: Date.now(),
                displayName
            };

            setLocationHistory((prev) => {
                const updatedHistory = [newLocation, ...prev];
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const trimmedHistory = updatedHistory.filter((loc) => loc.timestamp >= sevenDaysAgo);

                try {
                    localStorage.setItem('locationHistory', JSON.stringify(trimmedHistory));
                } catch (error) {
                    console.error('Error saving location history:', error);
                    toast.error('Failed to save location data.');
                }
                return trimmedHistory;
            });

            lastProcessedLocation.current = {
                lat: userLocation.latitude,
                lon: userLocation.longitude,
            };

            processingLocation.current = false;
        };

        processLocation();
    }, [userLocation, hasValidCoordinates, fetchLocationName]);

    // Filter locations
    const filteredLocationsMemo = useMemo(() => {
        const now = Date.now();
        let timeThreshold: number;
        switch (activeTab) {
            case '1hour':
                timeThreshold = now - 1 * 60 * 60 * 1000;
                break;
            case '8hours':
                timeThreshold = now - 8 * 60 * 60 * 1000;
                break;
            case '12hours':
                timeThreshold = now - 12 * 60 * 60 * 1000;
                break;
            case '24hours':
                timeThreshold = now - 24 * 60 * 60 * 1000;
                break;
            default:
                timeThreshold = now - 1 * 60 * 60 * 1000;
        }

        let filtered = locationHistory.filter(
            (location) =>
                location.timestamp >= timeThreshold &&
                hasValidCoordinates(location)
        );

        if (activeTab === '24hours' && filtered.length > 1000) {
            const step = Math.ceil(filtered.length / 500);
            filtered = filtered.filter((_, index) => index % step === 0);
        }

        return filtered;
    }, [activeTab, locationHistory, hasValidCoordinates]);

    // Update filtered locations
    useEffect(() => {
        setFilteredLocations(filteredLocationsMemo);
    }, [filteredLocationsMemo]);

    const formatTimestamp = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const shouldShowDate = (timestamp: number, index: number, locations: LocationData[]): boolean => {
        if (index === 0) return true;
        return new Date(locations[index - 1].timestamp).toDateString() !== new Date(timestamp).toDateString();
    };

    const handleMarkerClick = (location: LocationData) => {
        setSelectedLocation(location);
        setMapCenter([location.latitude, location.longitude]);
    };

    const handleListItemClick = (location: LocationData) => {
        setMapCenter([location.latitude, location.longitude]);
        setSelectedLocation(location);
    };

    const toggleFullScreenMap = () => {
        setIsFullScreenMap((prev) => !prev);
        // Reset centering flag when toggling fullscreen
        setTimeout(() => {
            hasCentered.current = false;
        }, 100);
    };

    // Create polyline positions
    const polylinePositions: [number, number][][] = useMemo(() => {
        if (filteredLocations.length < 2) return [];
        
        const lines: [number, number][][] = [];
        for (let i = 0; i < filteredLocations.length - 1; i++) {
            lines.push([
                [filteredLocations[i].latitude, filteredLocations[i].longitude],
                [filteredLocations[i + 1].latitude, filteredLocations[i + 1].longitude]
            ]);
        }
        return lines;
    }, [filteredLocations]);

    const defaultCenter: [number, number] = [-1.286389, 36.817223]; // Nairobi coordinates

    return (
        <div className={`p-4 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] ${isFullScreenMap ? 'fixed inset-0 z-50' : 'min-h-screen'}`}>
            <Toaster />

            {isFullScreenMap && (
                <div className="flex justify-center items-center p-2 bg-[#2A2F33] mb-2 rounded-lg">
                    <h2 className="text-white text-lg font-medium">Map View</h2>
                </div>
            )}

            <div className={`${isFullScreenMap ? '' : 'mt-2'}`}>
                <div className="bg-[#2A2F33] rounded-lg p-4 relative">
                    {!isFullScreenMap && <h3 className="text-white text-lg font-medium mb-2">Map View</h3>}

                    {!isFullScreenMap && (
                        <button
                            onClick={toggleFullScreenMap}
                            className="absolute top-4 right-4 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 z-[1000]"
                            aria-label="Maximize map"
                        >
                            <Maximize2 size={20} />
                        </button>
                    )}

                    {isLoading ? (
                        <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <svg
                                    className="animate-spin h-8 w-8 text-blue-500"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <p className="text-gray-400 text-sm mt-2">Loading location...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4 relative">
                            <div 
                                className="rounded-lg overflow-hidden"
                                style={{
                                    height: isFullScreenMap ? 'calc(100vh - 120px)' : '192px',
                                    width: '100%',
                                }}
                            >
                                <MapContainer
                                    center={mapCenter || defaultCenter}
                                    zoom={15}
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={isFullScreenMap}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    
                                    <MapController 
                                        center={mapCenter}
                                        selectedLocation={selectedLocation}
                                        filteredLocations={filteredLocations}
                                        hasUserLocation={hasValidCoordinates(userLocation)}
                                    />

                                    {/* History location markers */}
                                    {filteredLocations.map((location, index) => (
                                        <Marker
                                            key={index}
                                            position={[location.latitude, location.longitude]}
                                            icon={historyLocationIcon}
                                            eventHandlers={{
                                                click: () => handleMarkerClick(location),
                                            }}
                                        >
                                            <Popup>
                                                <div>
                                                    <p className="font-medium">
                                                        {location.displayName || 'Unknown location'}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {formatTimestamp(location.timestamp)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatDate(location.timestamp)}
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}

                                    {/* Current location marker */}
                                    {hasValidCoordinates(userLocation) && (
                                        <Marker
                                            position={[userLocation.latitude, userLocation.longitude]}
                                            icon={currentLocationIcon}
                                            eventHandlers={{
                                                click: () => handleMarkerClick(userLocation),
                                            }}
                                        >
                                            <Popup>
                                                <div>
                                                    <p className="font-medium">Current Location</p>
                                                    <p className="text-sm">
                                                        {userLocation.displayName || 'Unknown location'}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {formatTimestamp(Date.now())}
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}

                                    {/* Route polylines */}
                                    {polylinePositions.map((positions, index) => (
                                        <Polyline
                                            key={index}
                                            positions={positions}
                                            pathOptions={{
                                                color: getPolylineColor(filteredLocations[index + 1].timestamp, activeTab),
                                                opacity: 0.8,
                                                weight: 4,
                                            }}
                                        />
                                    ))}
                                </MapContainer>
                            </div>

                            {isFullScreenMap && (
                                <button
                                    onClick={toggleFullScreenMap}
                                    className="absolute top-4 right-4 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 z-[1000]"
                                    aria-label="Exit fullscreen"
                                >
                                    <Minimize2 size={20} />
                                </button>
                            )}
                        </div>
                    )}

                    {!isFullScreenMap && (
                        <div className="space-y-3">
                            {hasValidCoordinates(userLocation) && !isLoading ? (
                                <div className="mt-2 p-3 bg-[#34393E] rounded">
                                    <p className="text-gray-400 text-xs mt-1">Status: {isLocationActive ? 'Active' : 'Inactive'}</p>
                                    <p className="text-gray-400 text-xs">
                                        Time: {new Date().toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">{isLoading ? 'Loading location data...' : 'No location data available'}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!isFullScreenMap && (
                <div className="bg-[#2A2F33] rounded-lg p-4 mt-4">
                    <h3 className="text-white text-lg font-medium mb-4">My Routes</h3>

                    <div className="flex bg-[#34393E] rounded mb-4">
                        {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded' : 'text-gray-300'}`}
                            >
                                {tab === '1hour' ? '1 Hour' :
                                 tab === '8hours' ? '8 Hours' :
                                 tab === '12hours' ? '12 Hours' : '24 Hours'}
                            </button>
                        ))}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {filteredLocations.length > 0 ? (
                            filteredLocations.map((location, index) => (
                                <div
                                    key={index}
                                    className="mt-2 p-3 bg-[#34393E] rounded mb-2 border-l-4 border-blue-500 cursor-pointer hover:bg-[#3A3F44]"
                                    onClick={() => handleListItemClick(location)}
                                >
                                    {shouldShowDate(location.timestamp, index, filteredLocations) && (
                                        <div className="my-2 px-2 py-1 bg-[#222529] rounded text-gray-300 text-xs">
                                            {formatDate(location.timestamp)}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center text-white text-sm mb-1">
                                                <Clock size={14} className="mr-1 text-gray-400" />
                                                {formatTimestamp(location.timestamp)}
                                            </div>
                                            <p className="text-white text-sm">
                                                {location.displayName || 'Unknown location'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-sm text-center py-4">
                                No location history available for this period
                            </p>
                        )}
                    </div>
                </div>
            )}

            {isFullScreenMap && (
                <div className="fixed bottom-4 left-0 right-0 flex justify-center">
                    <div className="flex bg-[#34393E] rounded-full shadow-lg">
                        {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'}`}
                            >
                                {tab === '1hour' ? '1 Hour' :
                                 tab === '8hours' ? '8 Hours' :
                                 tab === '12hours' ? '12 Hours' : '24 Hours'}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationView;