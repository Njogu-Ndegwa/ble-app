'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Maximize2, Minimize2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

interface LocationData {
    latitude: number;
    longitude: number;
    timestamp: number;
    [key: string]: any;
}

interface LocationViewProps {
    isLocationActive: boolean;
    handleStartLocationListener: () => void;
    handleStopLocationListener: () => void;
    handleGetLastLocation: () => void;
    lastKnownLocation: LocationData | null;
}

const LocationView: React.FC<LocationViewProps> = ({
    isLocationActive,
    handleStartLocationListener,
    handleStopLocationListener,
    handleGetLastLocation,
    lastKnownLocation,
}) => {
    const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
    const [activeTab, setActiveTab] = useState<string>('1hour');
    const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
    const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // New loading state

    const initialized = useRef(false);
    const processingLocation = useRef(false);
    const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const DEBOUNCE_DELAY = 5000; // 5 seconds debounce delay

    // Google Maps API key (must be set in environment variable)
    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCj4szs84b3W-K6QSDV79gd8CK3tmKdDZ0';
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
    }

    // Map container style
    const mapContainerStyle = {
        height: isFullScreenMap ? 'calc(100vh - 60px)' : '192px',
        width: '100%',
        borderRadius: isFullScreenMap ? '0' : '8px',
        overflow: 'hidden',
    };

    // Color coding for different time periods
    const getPolylineColor = (timestamp: number, activeTab: string): string => {
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
    };

    // Load location history from localStorage on mount
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

    // Automatically start location tracking on mount if not active
    useEffect(() => {
        if (initialized.current && !isLocationActive) {
            handleStartLocationListener();
        }
    }, [isLocationActive, handleStartLocationListener]);

    // Show welcome notification on mount if tracking is active
    useEffect(() => {
        if (initialized.current && isLocationActive) {
            toast.success('Location tracking is active', { id: 'location-active', duration: 3000 });
            console.log('Location tracking is active');
        }
    }, [isLocationActive]);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);
    // Update loading state based on lastKnownLocation
    useEffect(() => {
        if (lastKnownLocation) {
            if (
                lastKnownLocation.latitude !== 0 &&
                lastKnownLocation.longitude !== 0 &&
                !isNaN(lastKnownLocation.latitude) &&
                !isNaN(lastKnownLocation.longitude)
            ) {
                setIsLoading(false); // Valid location received, stop loading
            } else {
                setIsLoading(true); // Invalid location, keep loading
            }
        } else {
            setIsLoading(true); // No location data yet
        }
    }, [lastKnownLocation]);
    // Fallback to stop loading after a timeout (e.g., 10 seconds) to avoid infinite loading
   useEffect(() => {
  if (lastKnownLocation) {
    if (
      lastKnownLocation.latitude !== 0 &&
      lastKnownLocation.longitude !== 0 &&
      !isNaN(lastKnownLocation.latitude) &&
      !isNaN(lastKnownLocation.longitude)
    ) {
      setIsLoading(false); // Valid location received, stop loading
    } else {
      setIsLoading(true); // Invalid location, keep loading
    }
  } else {
    setIsLoading(true); // No location data yet
  }
}, [lastKnownLocation]);
    // Function to check if location has changed significantly
    const hasLocationChangedSignificantly = (newLat: number, newLon: number): boolean => {
        if (!lastProcessedLocation.current) return true;

        const DISTANCE_THRESHOLD = 0.001; // Approx 100 meters
        return (
            Math.abs(lastProcessedLocation.current.lat - newLat) > DISTANCE_THRESHOLD ||
            Math.abs(lastProcessedLocation.current.lon - newLon) > DISTANCE_THRESHOLD
        );
    };

    // Process new location data with debouncing
    useEffect(() => {
        if (!lastKnownLocation || processingLocation.current) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (
                lastKnownLocation.latitude === 0 ||
                lastKnownLocation.longitude === 0 ||
                isNaN(lastKnownLocation.latitude) ||
                isNaN(lastKnownLocation.longitude)
            ) {
                return;
            }

            if (!hasLocationChangedSignificantly(lastKnownLocation.latitude, lastKnownLocation.longitude)) {
                return;
            }

            processingLocation.current = true;

            const newLocation = {
                ...lastKnownLocation,
                timestamp: Date.now(),
            };

            setLocationHistory((prev) => {
                const updatedHistory = [newLocation, ...prev];
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const trimmedHistory = updatedHistory.filter((loc) => loc.timestamp >= sevenDaysAgo);

                const serialized = JSON.stringify(trimmedHistory);
                const sizeInBytes = new Blob([serialized]).size;
                const maxStorage = 5 * 1024 * 1024; // 5MB
                if (sizeInBytes > maxStorage * 0.9) {
                    toast.error('Storage limit approaching. Clearing older data.');
                    trimmedHistory.splice(1000); // Keep newest 1000 points
                }

                try {
                    localStorage.setItem('locationHistory', JSON.stringify(trimmedHistory));
                } catch (error) {
                    console.error('Error saving location history to localStorage:', error);
                    toast.error('Failed to save location data.');
                }
                return trimmedHistory;
            });

            lastProcessedLocation.current = {
                lat: lastKnownLocation.latitude,
                lon: lastKnownLocation.longitude,
            };

            processingLocation.current = false;
        }, DEBOUNCE_DELAY);
    }, [lastKnownLocation]);

    // Filter locations and adjust map bounds
    useEffect(() => {
        const now = Date.now();
        const filterByTimeRange = () => {
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

            const filtered = locationHistory.filter(
                (location) =>
                    location.timestamp >= timeThreshold &&
                    location.latitude !== 0 &&
                    location.longitude !== 0 &&
                    !isNaN(location.latitude) &&
                    !isNaN(location.longitude)
            );

            if (activeTab === '24hours' && filtered.length > 1000) {
                const step = Math.ceil(filtered.length / 500);
                return filtered.filter((_, index) => index % step === 0);
            }

            return filtered;
        };

        const filtered = filterByTimeRange();
        setFilteredLocations(filtered);

        if (mapRef.current && window.google && window.google.maps) {
            if (filtered.length > 0) {
                try {
                    if (filtered.length === 1) {
                        mapRef.current.setCenter({
                            lat: filtered[0].latitude,
                            lng: filtered[0].longitude,
                        });
                        mapRef.current.setZoom(15);
                    } else {
                        const bounds = new google.maps.LatLngBounds();
                        filtered.forEach((loc) => {
                            bounds.extend({ lat: loc.latitude, lng: loc.longitude });
                        });
                        mapRef.current.fitBounds(bounds, 50);
                    }
                } catch (error) {
                    console.error('Error setting map bounds:', error);
                    if (lastKnownLocation && lastKnownLocation.latitude !== 0 && lastKnownLocation.longitude !== 0) {
                        mapRef.current.setCenter({
                            lat: lastKnownLocation.latitude,
                            lng: lastKnownLocation.longitude,
                        });
                        mapRef.current.setZoom(15);
                    } else {
                        mapRef.current.setCenter({ lat: -1.286389, lng: 36.817223 }); // Nairobi default
                        mapRef.current.setZoom(10);
                    }
                }
            } else {
                console.warn('No valid locations to display for the selected time period');
                if (lastKnownLocation && lastKnownLocation.latitude !== 0 && lastKnownLocation.longitude !== 0) {
                    mapRef.current.setCenter({
                        lat: lastKnownLocation.latitude,
                        lng: lastKnownLocation.longitude,
                    });
                    mapRef.current.setZoom(15);
                } else {
                    mapRef.current.setCenter({ lat: -1.286389, lng: 36.817223 });
                    mapRef.current.setZoom(10);
                }
            }
        }
    }, [activeTab, locationHistory, lastKnownLocation]);

    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const shouldShowDate = (timestamp: number, index: number, locations: LocationData[]): boolean => {
        if (index === 0) return true;
        const prevDate = new Date(locations[index - 1].timestamp).toDateString();
        const currentDate = new Date(timestamp).toDateString();
        return prevDate !== currentDate;
    };

    const onMapLoad = useCallback(
        (map: google.maps.Map) => {
            console.log('Map loaded successfully');
            mapRef.current = map;

            if (isFullScreenMap) {
                map.setZoom(14);
            } else {
                map.setZoom(15);
            }

            if (filteredLocations.length > 0) {
                try {
                    const bounds = new google.maps.LatLngBounds();
                    filteredLocations.forEach((loc) => {
                        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
                    });
                    map.fitBounds(bounds, 50);
                } catch (error) {
                    console.error('Error setting initial map bounds:', error);
                }
            }
        },
        [filteredLocations, isFullScreenMap]
    );

    const handleMarkerClick = (location: LocationData) => {
        setSelectedLocation(location);
    };

    const handleListItemClick = (location: LocationData) => {
        setMapCenter({ lat: location.latitude, lng: location.longitude });
        setSelectedLocation(location);

        if (mapRef.current) {
            mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
            mapRef.current.setZoom(16);
        }
    };

    const toggleFullScreenMap = () => {
        setIsFullScreenMap((prev) => !prev);

        setTimeout(() => {
            if (mapRef.current) {
                google.maps.event.trigger(mapRef.current, 'resize');

                if (filteredLocations.length > 0) {
                    try {
                        const bounds = new google.maps.LatLngBounds();
                        filteredLocations.forEach((loc) => {
                            bounds.extend({ lat: loc.latitude, lng: loc.longitude });
                        });
                        mapRef.current.fitBounds(bounds, 50);
                    } catch (error) {
                        console.error('Error resetting map bounds after resize:', error);
                    }
                }
            }
        }, 100);
    };

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
                            style={{ touchAction: 'manipulation' }}
                            aria-label="Maximize map"
                        >
                            <Maximize2 size={20} />
                        </button>
                    )}

                    {GOOGLE_MAPS_API_KEY ? (
                        isLoading ? (
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
                        ) : lastKnownLocation &&
                            lastKnownLocation.latitude !== 0 &&
                            lastKnownLocation.longitude !== 0 ? (
                            <div className="mb-4 relative">
                                <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={
                                            mapCenter || {
                                                lat: lastKnownLocation.latitude,
                                                lng: lastKnownLocation.longitude,
                                            }
                                        }
                                        zoom={15}
                                        options={{
                                            disableDefaultUI: false,
                                            zoomControl: true,
                                            mapTypeControl: isFullScreenMap,
                                            scaleControl: isFullScreenMap,
                                            streetViewControl: isFullScreenMap,
                                            rotateControl: isFullScreenMap,
                                            fullscreenControl: false,
                                            draggable: true,
                                            keyboardShortcuts: true,
                                            scrollwheel: true,
                                        }}
                                        onLoad={onMapLoad}
                                    >
                                        {filteredLocations.map((location, index) => (
                                            <Marker
                                                key={index}
                                                position={{ lat: location.latitude, lng: location.longitude }}
                                                title={`Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`}
                                                onClick={() => handleMarkerClick(location)}
                                            />
                                        ))}

                                        {
                                            filteredLocations.length > 1 && activeTab === '7days'
                                                ? (() => {
                                                    // Group locations by date
                                                    const locationsByDay = filteredLocations.reduce((acc, location) => {
                                                        const date = new Date(location.timestamp).toDateString();
                                                        if (!acc[date]) acc[date] = [];
                                                        acc[date].push(location);
                                                        return acc;
                                                    }, {} as Record<string, LocationData[]>);

                                                    // Render polylines for each day
                                                    return Object.values(locationsByDay).flatMap((dayLocations, dayIndex) =>
                                                        dayLocations.length > 1
                                                            ? dayLocations.slice(1).map((location, index) => (
                                                                <Polyline
                                                                    key={`${dayIndex}-${index}`}
                                                                    path={[
                                                                        {
                                                                            lat: dayLocations[index].latitude,
                                                                            lng: dayLocations[index].longitude,
                                                                        },
                                                                        {
                                                                            lat: location.latitude,
                                                                            lng: location.longitude,
                                                                        },
                                                                    ]}
                                                                    options={{
                                                                        strokeColor: getPolylineColor(location.timestamp, activeTab),
                                                                        strokeOpacity: 0.8,
                                                                        strokeWeight: 4,
                                                                    }}
                                                                />
                                                            ))
                                                            : []
                                                    );
                                                })()
                                                : filteredLocations.length > 1 &&
                                                filteredLocations.slice(1).map((location, index) => (
                                                    <Polyline
                                                        key={index}
                                                        path={[
                                                            {
                                                                lat: filteredLocations[index].latitude,
                                                                lng: filteredLocations[index].longitude,
                                                            },
                                                            {
                                                                lat: location.latitude,
                                                                lng: location.longitude,
                                                            },
                                                        ]}
                                                        options={{
                                                            strokeColor: getPolylineColor(location.timestamp, activeTab),
                                                            strokeOpacity: 0.8,
                                                            strokeWeight: 4,
                                                        }}
                                                    />
                                                ))
                                        }

                                        {selectedLocation && (
                                            <InfoWindow
                                                position={{
                                                    lat: selectedLocation.latitude,
                                                    lng: selectedLocation.longitude,
                                                }}
                                                onCloseClick={() => setSelectedLocation(null)}
                                            >
                                                <div className="text-black">
                                                    <p>Lat: {selectedLocation.latitude.toFixed(4)}</p>
                                                    <p>Lon: {selectedLocation.longitude.toFixed(4)}</p>
                                                    <p>{formatTimestamp(selectedLocation.timestamp)}</p>
                                                    <p>{formatDate(selectedLocation.timestamp)}</p>
                                                </div>
                                            </InfoWindow>
                                        )}

                                        {isFullScreenMap && (
                                            <div className="absolute top-4 right-4 z-[1000]">
                                                <button
                                                    onClick={toggleFullScreenMap}
                                                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                                                    style={{ touchAction: 'manipulation' }}
                                                    aria-label="Exit fullscreen"
                                                >
                                                    <Minimize2 size={20} />
                                                </button>
                                            </div>
                                        )}
                                    </GoogleMap>
                                </LoadScript>
                            </div>
                        ) : (
                            <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
                                <p className="text-gray-400 text-sm">No valid location data available</p>
                            </div>
                        )
                    ) : (
                        <div className="mb-4 h-48 bg-[#34393E] rounded-lg flex items-center justify-center">
                            <p className="text-gray-400 text-sm">Google Maps API key missing</p>
                        </div>
                    )}

                    {!isFullScreenMap && (
                        <div className="space-y-3">
                            {lastKnownLocation && !isLoading ? (
                                <div className="mt-2 p-3 bg-[#34393E] rounded">
                                    <p className="text-white text-sm">Lat: {lastKnownLocation.latitude.toFixed(4)}</p>
                                    <p className="text-white text-sm">Lon: {lastKnownLocation.longitude.toFixed(4)}</p>
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
                        <button
                            onClick={() => setActiveTab('1hour')}
                            className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === '1hour' ? 'bg-blue-500 text-white rounded' : 'text-gray-300'
                                }`}
                        >
                            1 Hour
                        </button>
                        <button
                            onClick={() => setActiveTab('8hours')}
                            className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === '8hours' ? 'bg-blue-500 text-white rounded' : 'text-gray-300'
                                }`}
                        >
                            8 Hours
                        </button>
                        <button
                            onClick={() => setActiveTab('12hours')}
                            className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === '12hours' ? 'bg-blue-500 text-white rounded' : 'text-gray-300'
                                }`}
                        >
                            12 Hours
                        </button>
                        <button
                            onClick={() => setActiveTab('24hours')}
                            className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === '24hours' ? 'bg-blue-500 text-white rounded' : 'text-gray-300'
                                }`}
                        >
                            24 Hours
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {filteredLocations.length > 0 ? (
                            (() => {
                                const groupedByDate = filteredLocations.reduce((acc, location) => {
                                    const date = new Date(location.timestamp).toDateString();
                                    if (!acc[date]) acc[date] = [];
                                    acc[date].push(location);
                                    return acc;
                                }, {} as Record<string, LocationData[]>);

                                return Object.entries(groupedByDate).map(([date, locations], dateIndex) => (
                                    <div key={dateIndex}>
                                        <div className="my-2 px-2 py-1 bg-[#222529] rounded text-gray-300 text-xs">
                                            {formatDate(locations[0].timestamp)}
                                        </div>
                                        {locations.map((location, index) => (
                                            <div
                                                key={index}
                                                className="mt-2 p-3 bg-[#34393E] rounded mb-2 border-l-4 border-blue-500 cursor-pointer hover:bg-[#3A3F44]"
                                                onClick={() => handleListItemClick(location)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center text-white text-sm mb-1">
                                                            <Clock size={14} className="mr-1 text-gray-400" />
                                                            {formatTimestamp(location.timestamp)}
                                                        </div>
                                                        <p className="text-white text-sm">Lat: {location.latitude.toFixed(4)}</p>
                                                        <p className="text-white text-sm">Lon: {location.longitude.toFixed(4)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ));
                            })()
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
                        <button
                            onClick={() => setActiveTab('1hour')}
                            className={`py-2 px-4 text-center text-sm ${activeTab === '1hour' ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'
                                }`}
                        >
                            1 Hour
                        </button>
                        <button
                            onClick={() => setActiveTab('8hours')}
                            className={`py-2 px-4 text-center text-sm ${activeTab === '8hours' ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'
                                }`}
                        >
                            8 Hours
                        </button>
                        <button
                            onClick={() => setActiveTab('12hours')}
                            className={`py-2 px-4 text-center text-sm ${activeTab === '12hours' ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'
                                }`}
                        >
                            12 Hours
                        </button>
                        <button
                            onClick={() => setActiveTab('24hours')}
                            className={`py-2 px-4 text-center text-sm ${activeTab === '24hours' ? 'bg-blue-500 text-white rounded-full' : 'text-gray-300'
                                }`}
                        >
                            24 Hours
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationView;