"use client";

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';

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
  vehicleId: string;
  lastSwap: string;
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
  onFindStation,
  onShowQRCode,
  onTopUp,
  onSelectStation,
  onViewAllStations,
}) => {
  const { t } = useI18n();
  
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
            <div className="rider-bike-model">{bike.model}</div>
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
              <span className="rider-bike-detail-value">{bike.vehicleId}</span>
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">{t('rider.lastSwap') || 'Last Swap'}</span>
              <span className="rider-bike-detail-value">{bike.lastSwap}</span>
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">{t('rider.totalSwaps') || 'Total Swaps'}</span>
              <span className="rider-bike-detail-value">{bike.totalSwaps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Balance Card */}
      <div className="account-balance-card">
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
      </div>

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
        <span className="rider-section-link" onClick={onViewAllStations}>{t('rider.viewMap') || 'View Map'}</span>
      </div>
      
      <div className="stations-map-container">
        {/* Simulated Map */}
        <div className="stations-map">
          <div className="map-visual">
            <div className="map-grid"></div>
            <div className="map-user-pulse"></div>
            <div className="map-user-marker"></div>
            {nearbyStations.slice(0, 3).map((station, idx) => {
              const positions = [
                { top: '25%', left: '30%' },
                { top: '60%', left: '70%' },
                { top: '35%', left: '75%' },
              ];
              const pos = positions[idx] || positions[0];
              return (
                <div 
                  key={station.id}
                  className="map-station-pin" 
                  style={{ top: pos.top, left: pos.left }}
                  onClick={() => onSelectStation(station.id)}
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
        </div>
        
        {/* Station List */}
        <div className="stations-list">
          {nearbyStations.slice(0, 2).map((station) => (
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
                  <span className="station-distance">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {station.distance}
                  </span>
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
    </div>
  );
};

export default RiderHome;

