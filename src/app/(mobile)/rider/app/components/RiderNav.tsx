"use client";

import React from 'react';
import { useI18n } from '@/i18n';

interface RiderNavProps {
  currentScreen: 'home' | 'stations' | 'activity' | 'profile';
  onNavigate: (screen: 'home' | 'stations' | 'activity' | 'profile') => void;
}

const RiderNav: React.FC<RiderNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  return (
    <nav className="rider-nav">
      <button 
        className={`rider-nav-item ${currentScreen === 'home' ? 'active' : ''}`}
        onClick={() => onNavigate('home')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="rider-nav-label">{t('rider.home') || 'Home'}</span>
      </button>
      
      <button 
        className={`rider-nav-item ${currentScreen === 'stations' ? 'active' : ''}`}
        onClick={() => onNavigate('stations')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="rider-nav-label">{t('rider.stations') || 'Stations'}</span>
      </button>
      
      <button 
        className={`rider-nav-item ${currentScreen === 'activity' ? 'active' : ''}`}
        onClick={() => onNavigate('activity')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="rider-nav-label">{t('rider.activity') || 'Activity'}</span>
      </button>
      
      <button 
        className={`rider-nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
        onClick={() => onNavigate('profile')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="rider-nav-label">{t('rider.profile') || 'Profile'}</span>
      </button>
    </nav>
  );
};

export default RiderNav;

