"use client";

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';

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
}

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

const RiderStations: React.FC<RiderStationsProps> = ({ stations, isLoading = false, onNavigateToStation }) => {
  const { t } = useI18n();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocationActive, setIsLocationActive] = useState(false);


  // Load Leaflet CSS and JS, then initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const loadLeaflet = async () => {
      if (!window.L) {
        // Load Leaflet CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(cssLink);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => {
          initializeMap();
        };
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

    // Default center (Nairobi, Kenya)
    const defaultCenter: [number, number] = [-1.2921, 36.8219];
    
    // Calculate center from stations if available
    let center: [number, number] = defaultCenter;
    if (stations.length > 0 && stations[0].lat && stations[0].lng) {
      const validStations = stations.filter(s => s.lat && s.lng);
      if (validStations.length > 0) {
        const avgLat = validStations.reduce((sum, s) => sum + (s.lat || 0), 0) / validStations.length;
        const avgLng = validStations.reduce((sum, s) => sum + (s.lng || 0), 0) / validStations.length;
        center = [avgLat, avgLng];
      }
    }

    // Initialize map
    mapInstanceRef.current = window.L.map(mapContainerRef.current, {
      center: center,
      zoom: 13,
      zoomControl: true,
    });

    // Add OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

      setIsMapLoaded(true);
    };

    loadLeaflet();

    return () => {
      // Clean up route line
      if (routeLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      
      // Clean up user location marker
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
        
        // Update user location marker on map
        if (mapInstanceRef.current && window.L) {
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            // Create user location marker
            userLocationMarkerRef.current = window.L.marker([latitude, longitude], {
              icon: window.L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
              }),
            }).addTo(mapInstanceRef.current);
            
            userLocationMarkerRef.current.bindPopup(t('rider.yourLocation') || 'Your Location');
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocationActive(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [t]);

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

    // Add markers for each station
    stations.forEach((station) => {
      if (!station.lat || !station.lng) return;

      const marker = window.L.marker([station.lat, station.lng], {
        icon: window.L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(mapInstanceRef.current);

      marker.bindPopup(`
        <div style="color: #000; font-family: system-ui; min-width: 150px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${station.name}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px;">${station.address}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px;">Distance: ${station.distance}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px;">Batteries: ${station.batteries}</p>
          <p style="margin: 0 0 8px 0; font-size: 12px;">Wait Time: ${station.waitTime}</p>
        </div>
      `);

      marker.on('click', () => {
        setSelectedStation(station);
      });

      markersRef.current.push(marker);
    });

    // Fit map bounds to show all stations
    if (stations.length > 0 && stations.some(s => s.lat && s.lng)) {
      const validStations = stations.filter(s => s.lat && s.lng);
      if (validStations.length > 0) {
        const bounds = window.L.latLngBounds(
          validStations.map(s => [s.lat!, s.lng!])
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [stations, isMapLoaded]);


  const handleSelectStation = (stationId: number) => {
    const station = stations.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      // Center map on selected station
      if (mapInstanceRef.current && station.lat && station.lng) {
        mapInstanceRef.current.setView([station.lat, station.lng], 15);
      }
    }
  };

  const handleHideDetail = () => {
    setSelectedStation(null);
  };

  const handleNavigate = () => {
    if (!selectedStation) return;
    
    if (!userLocation) {
      toast.error(t('rider.locationRequired') || 'Location is required for navigation. Please enable location services.');
      return;
    }

    if (!mapInstanceRef.current || !window.L) {
      toast.error(t('rider.mapNotReady') || 'Map is not ready. Please wait a moment.');
      return;
    }

    if (!selectedStation.lat || !selectedStation.lng) {
      toast.error(t('rider.stationLocationMissing') || 'Station location is missing.');
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
        [selectedStation.lat, selectedStation.lng],
      ];

      routeLineRef.current = window.L.polyline(routeCoordinates, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(mapInstanceRef.current);

      // Fit map to show both locations
      const bounds = window.L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [selectedStation.lat, selectedStation.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    } catch (error: any) {
      console.error('Error drawing route:', error);
      toast.error(t('rider.routingError') || 'Failed to draw route. Please try again.');
    }
  };

  return (
    <div className="rider-screen active">
      <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('rider.swapStations') || 'Swap Stations'}</h2>
      <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('rider.findStationNearYou') || 'Find a station near you'}</p>

      {isLoading ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: '16px' }}></div>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)', 
            lineHeight: '1.5'
          }}>
            {t('common.loading') || 'Loading stations...'}
          </p>
        </div>
      ) : stations.length === 0 ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            marginBottom: '24px',
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px', color: 'var(--text-muted)' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <h4 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--text-primary)', 
            marginBottom: '8px' 
          }}>
            {t('rider.noStationsAvailable') || 'No Stations Available'}
          </h4>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)', 
            lineHeight: '1.5',
            maxWidth: '300px'
          }}>
            {t('rider.noStationsDesc') || 'You need an active subscription to view available swap stations. Please subscribe to a plan to access stations.'}
          </p>
        </div>
      ) : (
        <div className="full-map-container">
          <div 
            ref={mapContainerRef}
            style={{ 
              width: '100%', 
              height: '100%', 
              minHeight: '400px',
              borderRadius: '8px',
              zIndex: 1,
            }}
          />
          
          {selectedStation && (
          <div className="station-detail-card">
            <div className="station-detail-header">
              <div className="station-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <div className="station-detail-info">
                <div className="station-detail-name">{selectedStation.name}</div>
                <div className="station-detail-address">{selectedStation.address}</div>
              </div>
            </div>
            <div className="station-detail-stats">
              <div className="station-detail-stat">
                <div className="station-detail-stat-value">{selectedStation.distance}</div>
                <div className="station-detail-stat-label">{t('rider.distance') || 'Distance'}</div>
              </div>
              <div className="station-detail-stat">
                <div className="station-detail-stat-value">{selectedStation.batteries}</div>
                <div className="station-detail-stat-label">{t('rider.batteries') || 'Batteries'}</div>
              </div>
              <div className="station-detail-stat">
                <div className="station-detail-stat-value">{selectedStation.waitTime}</div>
                <div className="station-detail-stat-label">{t('rider.waitTime') || 'Wait Time'}</div>
              </div>
            </div>
            <div className="station-detail-actions">
              <button className="btn btn-secondary" onClick={handleHideDetail}>
                {t('common.close') || 'Close'}
              </button>
              <button className="btn btn-primary" onClick={handleNavigate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                {t('Navigate') || 'Navigate'}
              </button>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default RiderStations;
