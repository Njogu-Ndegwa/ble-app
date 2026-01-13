"use client";

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

interface Station {
  id: number;
  name: string;
  distance: string;
  batteries: number;
  lat?: number;
  lng?: number;
}

interface BikeInfo {
  model: string;
  vehicleId: string | null;
  totalSwaps: number;
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface RiderHomeProps {
  userName: string;
  balance: number;
  currency?: string;
  bike: BikeInfo;
  nearbyStations: Station[];
  isLoadingStations?: boolean;
  isLoadingBike?: boolean;
  onFindStation: () => void;
  onShowQRCode: () => void;
  onTopUp: () => void;
  onSelectStation: (stationId: number) => void;
  onViewAllStations: () => void;
}

const RiderHome: React.FC<RiderHomeProps> = ({
  userName,
  balance,
  currency = 'XOF',
  bike,
  nearbyStations,
  isLoadingStations = false,
  isLoadingBike = false,
  onFindStation,
  onShowQRCode,
  onTopUp,
  onSelectStation,
  onViewAllStations,
}) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('rider.goodMorning') || 'Good morning,';
    if (hour < 17) return t('rider.goodAfternoon') || 'Good afternoon,';
    return t('rider.goodEvening') || 'Good evening,';
  };

  const getPaymentStateClass = (paymentState: string): string => {
    switch (paymentState) {
      case 'PAID':
      case 'active': return 'active';
      case 'RENEWAL_DUE': return 'warning';
      case 'OVERDUE':
      case 'inactive': return 'inactive';
      case 'PENDING': return 'pending';
      default: return 'active';
    }
  };

  const getPaymentStateLabel = (paymentState: string): string => {
    switch (paymentState) {
      case 'PAID':
      case 'active': return t('common.active') || 'Active';
      case 'RENEWAL_DUE': return t('attendant.renewalDue') || 'Renewal Due';
      case 'OVERDUE':
      case 'inactive': return t('attendant.overdue') || 'Overdue';
      case 'PENDING': return t('common.pending') || 'Pending';
      default: return paymentState === 'active' ? (t('common.active') || 'Active') : paymentState;
    }
  };

  // Load Leaflet and initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || isLoadingStations) return;

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
          console.error('[HOME MAP] Failed to load Leaflet library');
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
      const validStations = nearbyStations.filter(s => s.lat && s.lng);
      if (validStations.length > 0) {
        const avgLat = validStations.reduce((sum, s) => sum + (s.lat || 0), 0) / validStations.length;
        const avgLng = validStations.reduce((sum, s) => sum + (s.lng || 0), 0) / validStations.length;
        center = [avgLat, avgLng];
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

    if (nearbyStations.length > 0) {
      loadLeaflet();
    }

    return () => {
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
  }, [nearbyStations.length, isLoadingStations]);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation || !mapInstanceRef.current || !window.L || !isMapLoaded) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        // Add or update user location marker
        if (mapInstanceRef.current && window.L) {
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            userLocationMarkerRef.current = window.L.marker([latitude, longitude], {
              icon: window.L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
                iconSize: [20, 32],
                iconAnchor: [10, 32],
                popupAnchor: [1, -28],
                shadowSize: [32, 32],
              }),
            }).addTo(mapInstanceRef.current);
            userLocationMarkerRef.current.bindPopup(t('rider.yourLocation') || 'Your Location');
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isMapLoaded, t]);

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

    // Get first 5 stations to match the list
    const stationsToShow = nearbyStations.slice(0, 5);
    const validStations: typeof stationsToShow = [];
    
    // Add markers for each station
    stationsToShow.forEach((station, index) => {
      // Check if station has valid coordinates
      if (typeof station.lat !== 'number' || typeof station.lng !== 'number' || 
          isNaN(station.lat) || isNaN(station.lng) ||
          station.lat === 0 || station.lng === 0) {
        console.warn(`[HOME MAP] Station ${station.id} (${station.name}) has invalid coordinates:`, { lat: station.lat, lng: station.lng });
        return;
      }

      // Add small offset for markers at exact same location to prevent overlap
      // This ensures all markers are visible even if stations are very close
      const offsetLat = station.lat + (index * 0.0001); // ~11 meters per 0.0001 degree
      const offsetLng = station.lng + (index * 0.0001);

      const marker = window.L.marker([offsetLat, offsetLng], {
        icon: window.L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
          iconSize: [20, 32],
          iconAnchor: [10, 32],
          popupAnchor: [1, -28],
          shadowSize: [32, 32],
        }),
      }).addTo(mapInstanceRef.current);

      marker.bindPopup(`
        <div style="color: #000; font-family: system-ui; min-width: 120px;">
          <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600;">${station.name}</h3>
          <p style="margin: 0; font-size: 11px;">Batteries: ${station.batteries}</p>
        </div>
      `);

      marker.on('click', () => {
        onSelectStation(station.id);
      });

      markersRef.current.push(marker);
      validStations.push(station);
    });

    console.info(`[HOME MAP] Created ${markersRef.current.length} markers out of ${stationsToShow.length} stations`);

    // Fit map bounds to show all stations (using original coordinates, not offset)
    if (validStations.length > 0) {
      const bounds = window.L.latLngBounds(
        validStations.map(s => [s.lat!, s.lng!])
      );
      // Use larger padding and set maxZoom to ensure all markers are visible even if close
      mapInstanceRef.current.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 18 // Prevent zooming in too much so all markers stay visible
      });
      
      // If all stations are at the same location, ensure minimum zoom
      const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
      if (boundsSize < 100) { // Less than 100 meters apart
        mapInstanceRef.current.setZoom(15, { animate: false });
      }
    }
  }, [nearbyStations, isMapLoaded, onSelectStation]);

  return (
    <div className="rider-screen active">
      {/* Dashboard Header */}
      <div className="rider-dashboard-header">
        <div className="rider-greeting">{getGreeting()}</div>
        <div className="rider-name">{userName}</div>
      </div>

      {/* My Bike Card */}
      <div className="rider-bike-card">
        <div className="rider-bike-header">
          <div>
            <div className="rider-bike-label">{t('rider.myBike') || 'My Bike'}</div>
            {/* <div className="rider-bike-model">{bike.model}</div> */}
          </div>
          <span className={`rider-bike-status ${getPaymentStateClass(bike.paymentState)}`}>
            {getPaymentStateLabel(bike.paymentState)}
          </span>
        </div>
        <div className="rider-bike-content">
          <div className="rider-bike-image">
            {bike.imageUrl ? (
              <Image 
                src={bike.imageUrl} 
                alt={bike.model}
                width={100}
                height={70}
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <Image 
                src="/assets/Rider.png" 
                alt={bike.model}
                width={100}
                height={70}
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
          <div className="rider-bike-info">
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">{t('rider.vehicleId') || 'Vehicle ID'}</span>
              {isLoadingBike ? (
                <span className="rider-bike-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                  <span style={{ opacity: 0.6 }}>{t('common.loading') || 'Loading...'}</span>
                </span>
              ) : (
                <span className="rider-bike-detail-value">{bike.vehicleId || 'N/A'}</span>
              )}
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">{t('rider.totalSwaps') || 'Total Swaps'}</span>
              {isLoadingBike ? (
                <span className="rider-bike-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                  <span style={{ opacity: 0.6 }}>{t('common.loading') || 'Loading...'}</span>
                </span>
              ) : (
                <span className="rider-bike-detail-value">{bike.totalSwaps}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Balance Card */}
      {/* <div className="account-balance-card">
        <div className="account-balance-info">
          <div className="account-balance-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v12M8 10h8M8 14h8" stroke="var(--bg-primary)" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <div>
            <div className="account-balance-label">{t('rider.accountBalance') || 'Account Balance'}</div>
            <div className="account-balance-value">{currency} {balance.toLocaleString()}</div>
          </div>
        </div>
        <button className="account-balance-action" onClick={onTopUp}>
          {t('rider.topUp') || 'Top Up'}
        </button>
      </div> */}

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-action" onClick={onFindStation}>
          <div className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span className="quick-action-label">{t('rider.findStation') || 'Find Station'}</span>
        </div>
        <div className="quick-action" onClick={onShowQRCode}>
          <div className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <span className="quick-action-label">{t('rider.myQrCode') || 'My QR Code'}</span>
        </div>
      </div>

      {/* Nearby Stations Section */}
      <div className="rider-section-header">
        <span className="rider-section-title">{t('rider.nearbyStations') || 'Nearby Stations'}</span>
        {nearbyStations.length > 0 && (
          <span className="rider-section-link" onClick={onViewAllStations}>{t('rider.viewMap') || 'View Map'}</span>
        )}
      </div>
      
      {isLoadingStations ? (
        <div style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 20px',
          textAlign: 'center',
          marginTop: '12px'
        }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }}></div>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)', 
            lineHeight: '1.5',
            margin: 0
          }}>
            {t('common.loading') || 'Loading stations...'}
          </p>
        </div>
      ) : !isLoadingStations && nearbyStations.length === 0 ? (
        <div style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 20px',
          textAlign: 'center',
          marginTop: '12px'
        }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '30px', height: '30px', color: 'var(--text-muted)' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)', 
            lineHeight: '1.5',
            margin: 0
          }}>
            {t('rider.noStationsDesc') || 'You need an active subscription to view available swap stations. Please subscribe to a plan to access stations.'}
          </p>
        </div>
      ) : (
        <div className="stations-map-container">
          {/* OpenStreetMap */}
          <div 
            ref={mapContainerRef}
            style={{ 
              width: '100%', 
              height: '250px',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              marginBottom: '12px',
            }}
          />
          
          {/* Station List */}
          <div className="stations-list">
            {nearbyStations.slice(0, 5).map((station) => (
              <div 
                key={station.id} 
                className="station-item"
                onClick={() => onSelectStation(station.id)}
              >
                <div className="station-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <div className="station-info">
                  <div className="station-name">{station.name}</div>
                  <div className="station-details">
                    <span className="station-availability">
                      <span className={`station-availability-dot ${station.batteries < 5 ? 'low' : ''}`}></span>
                      {station.batteries} {t('rider.batteries') || 'batteries'}
                    </span>
                  </div>
                </div>
                <button className="station-nav-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderHome;

