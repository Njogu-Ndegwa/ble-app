"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { Search, MapPin, Navigation, X, Battery } from 'lucide-react';

export interface Station {
  id: number;
  name: string;
  address: string;
  distance: string;
  batteries: number;
  waitTime: string;
  lat?: number;
  lng?: number;
}

interface RiderStationsProps {
  stations: Station[];
  isLoading?: boolean;
  onNavigateToStation: (station: Station) => void;
  initialSelectedStationId?: number | null;
  onStationDeselected?: () => void;
}

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}


const RiderStations: React.FC<RiderStationsProps> = ({ 
  stations, 
  isLoading = false, 
  onNavigateToStation,
  initialSelectedStationId,
  onStationDeselected,
}) => {
  const { t } = useI18n();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const initialSelectionDoneRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<string | null>(null);

  // Auto-dismiss keyboard after user stops typing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set timeout to blur input after 1.5 seconds of no typing
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchInputRef.current?.blur();
      }, 1500);
    }
  };

  // Handle search submit (Enter key)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchInputRef.current?.blur();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  }, []);

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  };

  // Calculate distances and filter/sort stations
  const processedStations = useMemo(() => {
    let result = stations.map(station => {
      let distanceKm: number | null = null;
      if (userLocation && station.lat && station.lng) {
        distanceKm = calculateDistance(userLocation.lat, userLocation.lng, station.lat, station.lng);
      }
      return {
        ...station,
        distanceKm,
        formattedDistance: distanceKm !== null ? formatDistance(distanceKm) : null,
      };
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.address.toLowerCase().includes(query)
      );
    }

    // Sort by distance (nearest first)
    result.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return result;
  }, [stations, userLocation, searchQuery, calculateDistance]);

  // Load Leaflet CSS and JS, then initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const loadLeaflet = async () => {
      if (!window.L) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => initializeMap();
        script.onerror = () => {
          console.error('[STATIONS] Failed to load Leaflet library');
          initializeMap();
        };
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapContainerRef.current || !window.L) return;

      const defaultCenter: [number, number] = [-1.2921, 36.8219];
      let center: [number, number] = defaultCenter;
      
      if (stations.length > 0 && stations[0].lat && stations[0].lng) {
        const validStations = stations.filter(s => s.lat && s.lng);
        if (validStations.length > 0) {
          const avgLat = validStations.reduce((sum, s) => sum + (s.lat || 0), 0) / validStations.length;
          const avgLng = validStations.reduce((sum, s) => sum + (s.lng || 0), 0) / validStations.length;
          center = [avgLat, avgLng];
        }
      }

      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        center: center,
        zoom: 13,
        zoomControl: true,
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      setIsMapLoaded(true);
    };

    loadLeaflet();

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
  }, []);

  // Get user's current location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocationActive(true);
        
        if (mapInstanceRef.current && window.L) {
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLatLng([latitude, longitude]);
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

            userLocationMarkerRef.current = window.L.marker([latitude, longitude], {
              icon: userIcon,
            }).addTo(mapInstanceRef.current);
            userLocationMarkerRef.current.bindPopup(t('rider.yourLocation') || 'My Location');
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocationActive(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [t]);

  // Update markers when stations change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !isMapLoaded) return;

    markersRef.current.forEach((marker) => {
      if (marker && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];

    stations.forEach((station) => {
      if (!station.lat || !station.lng) return;

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

      const marker = window.L.marker([station.lat, station.lng], {
        icon: stationIcon,
      }).addTo(mapInstanceRef.current);

      // Click marker to show detail card (no popup needed)
      marker.on('click', () => handleSelectStation(station.id));
      markersRef.current.push(marker);
    });

    if (stations.length > 0 && stations.some(s => s.lat && s.lng)) {
      const validStations = stations.filter(s => s.lat && s.lng);
      if (validStations.length > 0) {
        const bounds = window.L.latLngBounds(validStations.map(s => [s.lat!, s.lng!]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [stations, isMapLoaded]);

  // Recalculate distance when user location changes and a station is selected
  useEffect(() => {
    if (selectedStation && userLocation && selectedStation.lat && selectedStation.lng) {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, selectedStation.lat, selectedStation.lng);
      setCalculatedDistance(formatDistance(dist));
    }
  }, [userLocation, selectedStation, calculateDistance]);

  // Handle initial station selection from Home page
  useEffect(() => {
    if (initialSelectedStationId && !initialSelectionDoneRef.current && stations.length > 0 && isMapLoaded) {
      const station = stations.find(s => s.id === initialSelectedStationId);
      if (station) {
        initialSelectionDoneRef.current = true;
        setSelectedStation(station);
        if (userLocation && station.lat && station.lng) {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, station.lat, station.lng);
          setCalculatedDistance(formatDistance(dist));
        }
        // Zoom to the selected station
        if (mapInstanceRef.current && station.lat && station.lng) {
          setTimeout(() => {
            mapInstanceRef.current.setView([station.lat, station.lng], 15, { animate: true });
          }, 300);
        }
      }
    }
  }, [initialSelectedStationId, stations, isMapLoaded, userLocation, calculateDistance]);

  const handleSelectStation = (stationId: number) => {
    const station = stations.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      if (userLocation && station.lat && station.lng) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, station.lat, station.lng);
        setCalculatedDistance(formatDistance(dist));
      } else {
        setCalculatedDistance(null);
      }
      if (mapInstanceRef.current && station.lat && station.lng) {
        mapInstanceRef.current.setView([station.lat, station.lng], 15, { animate: true });
      }
    }
  };

  const handleHideDetail = () => {
    setSelectedStation(null);
    setCalculatedDistance(null);
    // Notify parent that station was deselected
    onStationDeselected?.();
    // Remove route line
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
  };

  const handleNavigate = (station?: typeof processedStations[0] | Station) => {
    const targetStation = station || selectedStation;
    if (!targetStation) return;
    
    if (!userLocation) {
      toast.error(t('rider.locationRequired') || 'Enable location services to navigate');
      return;
    }

    if (!mapInstanceRef.current || !window.L) {
      toast.error(t('rider.mapNotReady') || 'Map is not ready');
      return;
    }

    if (!targetStation.lat || !targetStation.lng) {
      toast.error(t('rider.stationLocationMissing') || 'Station location missing');
      return;
    }

    try {
      // Remove existing route if any
      if (routeLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }

      // Draw route line from user location to station
      routeLineRef.current = window.L.polyline([
        [userLocation.lat, userLocation.lng],
        [targetStation.lat, targetStation.lng],
      ], {
        color: getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim() || '#00e5e5',
        weight: 4,
        opacity: 0.9,
      }).addTo(mapInstanceRef.current);

      // Fit map to show both user location and station
      const bounds = window.L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [targetStation.lat, targetStation.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      
      // Ensure station is selected and distance is calculated
      if (!selectedStation || selectedStation.id !== targetStation.id) {
        setSelectedStation(targetStation);
      }
      if (targetStation.lat && targetStation.lng) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, targetStation.lat, targetStation.lng);
        setCalculatedDistance(formatDistance(dist));
      }
      
      toast.success(`${t('rider.routeTo') || 'Route to'} ${targetStation.name}`);
    } catch (error: any) {
      console.error('Error drawing route:', error);
      toast.error(t('rider.routingError') || 'Failed to draw route');
    }
  };

  const centerOnUserLocation = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
    } else {
      toast.error(t('rider.locationNotAvailable') || 'Location not available');
    }
  };

  // Zoom to station when search matches and show detail card
  useEffect(() => {
    if (!searchQuery.trim() || !mapInstanceRef.current || !window.L) return;
    
    const query = searchQuery.toLowerCase().trim();
    const matchedStation = stations.find(s => 
      s.name.toLowerCase().includes(query) || 
      s.address.toLowerCase().includes(query)
    );
    
    if (matchedStation && matchedStation.lat && matchedStation.lng) {
      mapInstanceRef.current.setView([matchedStation.lat, matchedStation.lng], 15, { animate: true });
      // Also select the station to show detail card
      setSelectedStation(matchedStation);
      if (userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, matchedStation.lat, matchedStation.lng);
        setCalculatedDistance(formatDistance(dist));
      }
    }
  }, [searchQuery, stations, userLocation, calculateDistance]);

  return (
    <div className="stations-page">
      {/* Header */}
      <div className="stations-header">
        <h2 className="stations-title">{t('rider.swapStations') || 'Swap Stations'}</h2>
        <p className="stations-subtitle">{t('rider.findStationNearYou') || 'Find a station near you'}</p>
      </div>

      {/* Search Bar */}
      <form className="stations-search" onSubmit={handleSearchSubmit}>
        <div className="stations-search-input-wrapper">
          <Search size={18} className="stations-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="stations-search-input"
            placeholder={t('rider.searchStations') || 'Search stations...'}
            value={searchQuery}
            onChange={handleSearchChange}
            enterKeyHint="search"
          />
          {searchQuery && (
            <button 
              type="button"
              className="stations-search-clear" 
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <div className="stations-loading">
          <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: '16px' }}></div>
          <p>{t('common.loading') || 'Loading stations...'}</p>
        </div>
      ) : stations.length === 0 ? (
        <div className="stations-empty">
          <MapPin size={48} />
          <h4>{t('rider.noStationsAvailable') || 'No Stations Available'}</h4>
          <p>{t('rider.noStationsDesc') || 'Subscribe to a plan to access swap stations.'}</p>
        </div>
      ) : (
        <div className="stations-content">
          {/* Map Container */}
          <div className="stations-map-wrapper">
            <div ref={mapContainerRef} className="stations-map" />
            
            {/* Location Button */}
            <button className="stations-location-btn" onClick={centerOnUserLocation} title="My Location">
              <MapPin size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Selected Station Detail Card - Fixed position overlay */}
      {selectedStation && (
        <div className="station-detail-card">
          {/* Header with icon, name and address */}
          <div className="station-detail-header">
            <div className="station-detail-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div className="station-detail-info">
              <div className="station-detail-name">{selectedStation.name}</div>
              <div className="station-detail-address">{selectedStation.address}</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="station-detail-stats">
            <div className="station-detail-stat">
              <span className="station-detail-stat-value">{calculatedDistance || selectedStation.distance || '--'}</span>
              <span className="station-detail-stat-label">{t('rider.distance') || 'Distance'}</span>
            </div>
            <div className="station-detail-stat">
              <span className="station-detail-stat-value">{selectedStation.batteries}</span>
              <span className="station-detail-stat-label">{t('rider.batteries') || 'Batteries'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="station-detail-actions">
            <button className="station-detail-btn secondary" onClick={handleHideDetail}>
              {t('common.close') || 'Close'}
            </button>
            <button className="station-detail-btn primary" onClick={() => handleNavigate()}>
              <Navigation size={16} />
              {t('rider.navigate') || 'Navigate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderStations;
