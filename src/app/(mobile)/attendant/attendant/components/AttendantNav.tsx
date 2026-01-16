"use client";

import React from 'react';
import { useI18n } from '@/i18n';

export type AttendantScreen = 'swap' | 'transactions' | 'sessions' | 'profile';

interface AttendantNavProps {
  currentScreen: AttendantScreen;
  onNavigate: (screen: AttendantScreen) => void;
}

const AttendantNav: React.FC<AttendantNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  return (
    <nav className="attendant-nav">
      <button 
        className={`attendant-nav-item ${currentScreen === 'swap' ? 'active' : ''}`}
        onClick={() => onNavigate('swap')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
          <path d="M17 8v12M17 20l4-4M17 20l-4-4"/>
        </svg>
        <span className="attendant-nav-label">{t('attendant.nav.swap') || 'Swap'}</span>
      </button>
      
      <button 
        className={`attendant-nav-item ${currentScreen === 'transactions' ? 'active' : ''}`}
        onClick={() => onNavigate('transactions')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M7 15h0M2 9.5h20"/>
        </svg>
        <span className="attendant-nav-label">{t('attendant.nav.transactions') || 'Transactions'}</span>
      </button>
      
      <button 
        className={`attendant-nav-item ${currentScreen === 'sessions' ? 'active' : ''}`}
        onClick={() => onNavigate('sessions')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="attendant-nav-label">{t('attendant.nav.sessions') || 'Sessions'}</span>
      </button>
      
      <button 
        className={`attendant-nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
        onClick={() => onNavigate('profile')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="attendant-nav-label">{t('attendant.nav.profile') || 'Profile'}</span>
      </button>
    </nav>
  );
};

export default AttendantNav;

