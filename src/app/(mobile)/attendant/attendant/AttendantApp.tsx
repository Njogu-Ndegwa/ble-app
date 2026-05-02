"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
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
import AppHeader from '@/components/AppHeader';
import type { OrderListItem } from '@/lib/odoo-api';

interface AttendantAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function AttendantApp({ onLogout, onSwitchSA }: AttendantAppProps) {
  const router = useRouter();
  const { t } = useI18n();
  
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
      <AppHeader showBack onSwitchSA={onSwitchSA} />
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
