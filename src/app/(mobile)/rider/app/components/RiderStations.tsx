"use client";

import React, { useState } from 'react';
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
  onNavigateToStation: (station: Station) => void;
}

const RiderStations: React.FC<RiderStationsProps> = ({ stations, onNavigateToStation }) => {
  const { t } = useI18n();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const handleSelectStation = (stationId: number) => {
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

  // Station positions for the map (for demo purposes)
  const stationPositions = [
    { top: '20%', left: '25%' },
    { top: '65%', left: '60%' },
    { top: '30%', left: '70%' },
    { top: '75%', left: '30%' },
    { top: '45%', left: '85%' },
  ];

  return (
    <div className="rider-screen active">
      <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Swap Stations')}</h2>
      <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('Find a station near you')}</p>

      <div className="full-map-container">
        <div className="map-visual">
          <div className="map-grid"></div>
          {/* User Location */}
          <div className="map-user-pulse"></div>
          <div className="map-user-marker"></div>
          {/* Station Pins */}
          {stations.map((station, idx) => {
            const pos = stationPositions[idx] || stationPositions[0];
            return (
              <div 
                key={station.id}
                className="map-station-pin" 
                style={{ top: pos.top, left: pos.left }}
                onClick={() => handleSelectStation(station.id)}
              >
                <div className="map-station-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <span className="map-station-label">{station.name.split(' ')[0]}</span>
              </div>
            );
          })}
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
                <div className="station-detail-stat-value">{selectedStation.batteries}</div>
                <div className="station-detail-stat-label">{t('Batteries')}</div>
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
