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
import { useI18n } from '@/i18n';

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
    const { t } = useI18n();
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
        const colorInfo = typeof document !== 'undefined'
            ? getComputedStyle(document.documentElement).getPropertyValue('--color-info').trim() || '#3B82F6'
            : '#3B82F6';
        const colorInfoLight = typeof document !== 'undefined'
            ? getComputedStyle(document.documentElement).getPropertyValue('--color-info-light').trim() || '#93C5FD'
            : '#93C5FD';

        switch (activeTab) {
            case '1hour':
                return timeDiff < 30 * 60 * 1000 ? colorInfo : colorInfoLight;
            case '8hours':
                return timeDiff < 4 * 60 * 60 * 1000 ? colorInfo : colorInfoLight;
            case '12hours':
                return timeDiff < 6 * 60 * 60 * 1000 ? colorInfo : colorInfoLight;
            case '24hours':
                return timeDiff < 12 * 60 * 60 * 1000 ? colorInfo : colorInfoLight;
            default:
                return colorInfo;
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
                    toast.error(t('Failed to load location history.'));
                }
            }
            initialized.current = true;
        }
    }, []);

    // Show welcome notification
    useEffect(() => {
        if (initialized.current && isLocationActive) {
            toast.success(t('Location tracking is active'), { id: 'location-active', duration: 3000 });
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
                    toast.error(t('Failed to save location data.'));
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
        <div className={`p-4 bg-gradient-page ${isFullScreenMap ? 'fixed inset-0 z-50' : 'min-h-screen'}`}>
            <Toaster />

            {isFullScreenMap && (
                <div className="flex justify-center items-center p-2 bg-bg-tertiary mb-2 rounded-lg">
                    <h2 className="text-text-primary text-lg font-medium">{t('Map View')}</h2>
                </div>
            )}

            <div className={`${isFullScreenMap ? '' : 'mt-2'}`}>
                <div className="bg-bg-tertiary rounded-lg p-4 relative">
                    {!isFullScreenMap && <h3 className="text-text-primary text-lg font-medium mb-2">Map View</h3>}

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
                        <div className="mb-4 h-48 bg-bg-tertiary rounded-lg flex items-center justify-center">
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
                                <p className="text-text-secondary text-sm mt-2">{t('Loading location...')}</p>
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
                                                        {location.displayName || t('Unknown location')}
                                                    </p>
                                                    <p className="text-sm text-text-secondary mt-1">
                                                        {formatTimestamp(location.timestamp)}
                                                    </p>
                                                    <p className="text-xs text-text-secondary">
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
                                                    <p className="font-medium">{t('Current Location')}</p>
                                                    <p className="text-sm">
                                                        {userLocation.displayName || t('Unknown location')}
                                                    </p>
                                                    <p className="text-sm text-text-secondary mt-1">
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
                                <div className="mt-2 p-3 bg-bg-tertiary rounded">
                                    <p className="text-text-secondary text-xs mt-1">{t('Status')}: {isLocationActive ? t('Active') : t('Inactive')}</p>
                                    <p className="text-text-secondary text-xs">
                                        {t('Time')}: {new Date().toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-text-secondary text-sm">{isLoading ? t('Loading location data...') : t('No location data available')}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!isFullScreenMap && (
                <div className="bg-bg-tertiary rounded-lg p-4 mt-4">
                    <h3 className="text-text-primary text-lg font-medium mb-4">{t('My Routes')}</h3>

                    <div className="flex bg-bg-tertiary rounded mb-4">
                        {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded' : 'text-text-primary'}`}
                            >
                                {tab === '1hour' ? t('1 Hour') :
                                 tab === '8hours' ? t('8 Hours') :
                                 tab === '12hours' ? t('12 Hours') : t('24 Hours')}
                            </button>
                        ))}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {filteredLocations.length > 0 ? (
                            filteredLocations.map((location, index) => (
                                <div
                                    key={index}
                                    className="mt-2 p-3 bg-bg-tertiary rounded mb-2 border-l-4 border-blue-500 cursor-pointer hover:bg-bg-elevated"
                                    onClick={() => handleListItemClick(location)}
                                >
                                    {shouldShowDate(location.timestamp, index, filteredLocations) && (
                                        <div className="my-2 px-2 py-1 bg-bg-secondary rounded text-text-primary text-xs">
                                            {formatDate(location.timestamp)}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center text-text-primary text-sm mb-1">
                                                <Clock size={14} className="mr-1 text-text-secondary" />
                                                {formatTimestamp(location.timestamp)}
                                            </div>
                                            <p className="text-text-primary text-sm">
                                                {location.displayName || t('Unknown location')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-text-secondary text-sm text-center py-4">
                                {t('No location history available for this period')}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {isFullScreenMap && (
                <div className="fixed bottom-4 left-0 right-0 flex justify-center">
                    <div className="flex bg-bg-tertiary rounded-full shadow-lg">
                        {['1hour', '8hours', '12hours', '24hours'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-2 px-4 text-center text-sm ${activeTab === tab ? 'bg-blue-500 text-white rounded-full' : 'text-text-primary'}`}
                            >
                                {tab === '1hour' ? t('1 Hour') :
                                 tab === '8hours' ? t('8 Hours') :
                                 tab === '12hours' ? t('12 Hours') : t('24 Hours')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationView;