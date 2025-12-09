"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';
import type { SwapStation } from '@/lib/services';

export interface Station {
  id: number | string;
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
  onNavigateToStation: (station: Station) => void;
  userLocation?: { lat: number; lng: number };
  isLoading?: boolean;
  error?: string | null;
}

const RiderStations: React.FC<RiderStationsProps> = ({ 
  stations, 
  onNavigateToStation,
  userLocation,
  isLoading = false,
  error = null,
}) => {
  const { t } = useI18n();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleSelectStation = (stationId: number | string) => {
    const station = stations.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
    }
  };

  const handleHideDetail = () => {
    setSelectedStation(null);
  };

  const handleNavigate = () => {
    if (selectedStation) {
      onNavigateToStation(selectedStation);
    }
  };

  // Calculate station positions on the map based on actual coordinates
  const getStationPosition = (station: Station, index: number): { top: string; left: string } => {
    if (!station.lat || !station.lng || !userLocation) {
      // Fallback positions for demo
      const positions = [
        { top: '20%', left: '25%' },
        { top: '65%', left: '60%' },
        { top: '30%', left: '70%' },
        { top: '75%', left: '30%' },
        { top: '45%', left: '85%' },
      ];
      return positions[index % positions.length];
    }

    // Calculate relative position based on coordinates
    const latDiff = station.lat - userLocation.lat;
    const lngDiff = station.lng - userLocation.lng;
    
    // Scale factor to map coordinate differences to percentage positions
    // This creates a view window around the user's location
    const scaleFactor = 500; // Adjust based on desired map zoom level
    
    // Convert to percentage (50% is center where user is)
    const left = Math.min(95, Math.max(5, 50 + lngDiff * scaleFactor));
    const top = Math.min(85, Math.max(10, 50 - latDiff * scaleFactor));
    
    return { top: `${top}%`, left: `${left}%` };
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rider-screen active">
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Swap Stations')}</h2>
        <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('Finding stations near you...')}</p>
        
        <div className="full-map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('Loading stations...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rider-screen active">
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Swap Stations')}</h2>
        <p className="scan-subtitle" style={{ marginBottom: '16px', color: 'var(--error)' }}>{error}</p>
        
        <div className="full-map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <h3 className="empty-state-title">{t('Unable to load stations')}</h3>
            <p className="empty-state-desc">{t('Please check your connection and try again')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (stations.length === 0) {
    return (
      <div className="rider-screen active">
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Swap Stations')}</h2>
        <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('No stations available')}</p>
        
        <div className="full-map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <h3 className="empty-state-title">{t('No stations nearby')}</h3>
            <p className="empty-state-desc">{t('No swap stations found in your area')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rider-screen active">
      <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Swap Stations')}</h2>
      <p className="scan-subtitle" style={{ marginBottom: '16px' }}>
        {t('Find a station near you')} • {stations.length} {t('stations')}
      </p>

      <div className="full-map-container" ref={mapContainerRef}>
        <div className="map-visual">
          <div className="map-grid"></div>
          {/* User Location */}
          <div className="map-user-pulse"></div>
          <div className="map-user-marker"></div>
          {/* Station Pins */}
          {stations.map((station, idx) => {
            const pos = getStationPosition(station, idx);
            const isSelected = selectedStation?.id === station.id;
            return (
              <div 
                key={station.id}
                className={`map-station-pin ${isSelected ? 'selected' : ''}`}
                style={{ 
                  top: pos.top, 
                  left: pos.left,
                  transform: isSelected ? 'scale(1.2)' : undefined,
                  zIndex: isSelected ? 20 : 5,
                }}
                onClick={() => handleSelectStation(station.id)}
              >
                <div className="map-station-icon" style={{
                  background: station.batteries < 3 ? '#f0a500' : 'var(--success)',
                }}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <span className="map-station-label">{station.name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        
        {/* Station List at bottom of map */}
        <div className="stations-list" style={{ 
          position: 'absolute', 
          bottom: selectedStation ? '140px' : '10px', 
          left: '10px', 
          right: '10px',
          maxHeight: '150px',
          overflowY: 'auto',
          transition: 'bottom 0.3s ease',
        }}>
          {stations.slice(0, 3).map((station) => (
            <div 
              key={station.id} 
              className={`station-item ${selectedStation?.id === station.id ? 'selected' : ''}`}
              onClick={() => handleSelectStation(station.id)}
              style={{
                background: selectedStation?.id === station.id ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                borderColor: selectedStation?.id === station.id ? 'var(--accent)' : 'transparent',
                borderWidth: 1,
                borderStyle: 'solid',
              }}
            >
              <div className="station-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <div className="station-info">
                <div className="station-name">{station.name}</div>
                <div className="station-details">
                  <span className="station-distance">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {station.distance}
                  </span>
                  <span className="station-availability">
                    <span className={`station-availability-dot ${station.batteries < 3 ? 'low' : ''}`}></span>
                    {station.batteries} {t('batteries')}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {station.waitTime}
                  </span>
                </div>
              </div>
              <button 
                className="station-nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToStation(station);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </button>
            </div>
          ))}
          {stations.length > 3 && (
            <p style={{ 
              textAlign: 'center', 
              color: 'var(--text-muted)', 
              fontSize: 11, 
              padding: '8px 0',
              margin: 0,
            }}>
              {t('and')} {stations.length - 3} {t('more stations')}
            </p>
          )}
        </div>
        
        {/* Selected Station Detail Card */}
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
                <div className="station-detail-stat-label">{t('Distance')}</div>
              </div>
              <div className="station-detail-stat">
                <div className="station-detail-stat-value" style={{
                  color: selectedStation.batteries < 3 ? '#f0a500' : 'var(--success)',
                }}>
                  {selectedStation.batteries}
                </div>
                <div className="station-detail-stat-label">{t('Available')}</div>
              </div>
              <div className="station-detail-stat">
                <div className="station-detail-stat-value">{selectedStation.waitTime}</div>
                <div className="station-detail-stat-label">{t('Wait Time')}</div>
              </div>
            </div>
            <div className="station-detail-actions">
              <button className="btn btn-secondary" onClick={handleHideDetail}>
                {t('Close')}
              </button>
              <button className="btn btn-primary" onClick={handleNavigate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                {t('Navigate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiderStations;
