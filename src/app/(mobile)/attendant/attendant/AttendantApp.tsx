"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, LogOut, ArrowLeftRight } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { 
  getSalesRoleUser, 
  clearSalesRoleLogin,
  getSalesRoleToken,
  type EmployeeUser 
} from '@/lib/attendant-auth';
import AttendantFlow from './AttendantFlow';
import { 
  AttendantNav, 
  AttendantTransactions,
  AttendantProfile,
  AttendantSessions,
  type AttendantScreen 
} from './components';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { OrderListItem } from '@/lib/odoo-api';

interface AttendantAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function AttendantApp({ onLogout, onSwitchSA }: AttendantAppProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  
  // Screen management
  const [currentScreen, setCurrentScreen] = useState<AttendantScreen>('swap');
  
  // Selected session to restore (from sessions screen)
  const [selectedSession, setSelectedSession] = useState<OrderListItem | null>(null);
  const [selectedSessionReadOnly, setSelectedSessionReadOnly] = useState(false);
  
  // Employee info
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);

  // Current Service Account
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);
  
  // Load employee info and SA on mount
  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) {
      setEmployee(user);
    }
    setCurrentSA(getSelectedSA('attendant'));
  }, []);

  // Lock body overflow
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  // Handle browser back button
  const currentScreenRef = useRef(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    const handlePopState = () => {
      if (currentScreenRef.current !== 'swap') {
        setCurrentScreen('swap');
      } else {
        router.push('/');
      }
    };

    if (currentScreen !== 'swap') {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentScreen, router]);

  // Toggle locale function
  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  // Handle back to roles (navigate to role selection without logging out)
  const handleBackToRoles = useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle logout
  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    toast.success(t('common.logoutSuccess') || 'Signed out successfully');
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router, t]);

  // Handle navigation
  const handleNavigate = useCallback((screen: AttendantScreen) => {
    setCurrentScreen(screen);
  }, []);

  // Handle session selection from sessions screen
  const handleSelectSession = useCallback((order: OrderListItem, isReadOnly: boolean) => {
    // Store the selected session to pass to AttendantFlow
    setSelectedSession(order);
    setSelectedSessionReadOnly(isReadOnly);
    // Switch to swap screen - AttendantFlow will automatically restore the session
    setCurrentScreen('swap');
  }, []);
  
  // Callback to clear selected session after AttendantFlow consumes it
  const handleSessionConsumed = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionReadOnly(false);
  }, []);
  
  // For swap screen, render AttendantFlow with integrated bottom nav
  if (currentScreen === 'swap') {
    return (
      <AttendantFlow 
        onLogout={handleLogout}
        hideHeaderActions={false}
        renderBottomNav={() => (
          <AttendantNav 
            currentScreen={currentScreen}
            onNavigate={handleNavigate}
          />
        )}
        initialSession={selectedSession}
        initialSessionReadOnly={selectedSessionReadOnly}
        onInitialSessionConsumed={handleSessionConsumed}
      />
    );
  }

  // For other screens, render with header, content, and bottom nav
  return (
    <div className="attendant-container has-bottom-nav">
      <div className="attendant-bg-gradient" />
      
      {/* Header */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToRoles}
              aria-label={t('attendant.changeRole') || 'Change Role'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentSA && onSwitchSA && (
              <button
                onClick={onSwitchSA}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-brand/10 text-brand text-xs font-medium transition-colors hover:bg-brand/20 active:bg-brand/25"
                title={t('sa.switchAccount') || 'Switch'}
              >
                <ArrowLeftRight size={12} />
                <span className="max-w-[80px] truncate">{currentSA.name}</span>
              </button>
            )}
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage') || 'Switch Language'}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
            <button
              className="flow-header-logout"
              onClick={handleLogout}
              aria-label={t('common.logout') || 'Logout'}
              title={t('common.logout') || 'Logout'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="attendant-main attendant-main-screen">
        {currentScreen === 'transactions' && (
          <div className="attendant-screen-container">
            <AttendantTransactions />
          </div>
        )}
        {currentScreen === 'sessions' && (
          <div className="attendant-screen-container">
            <AttendantSessions onSelectSession={handleSelectSession} />
          </div>
        )}
        {currentScreen === 'profile' && (
          <div className="attendant-screen-container">
            <AttendantProfile 
              employee={employee}
              onLogout={handleLogout}
              serviceAccount={currentSA}
              onSwitchSA={onSwitchSA}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation - Always visible */}
      <AttendantNav 
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
