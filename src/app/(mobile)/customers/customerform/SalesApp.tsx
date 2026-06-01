"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import SalesFlow from './SalesFlow';
import SalesNav, { type SalesScreen } from './components/SalesNav';
import SalesProfile from './components/SalesProfile';
import SalesSessions from './components/SalesSessions';
import SalesTransactions from './components/SalesTransactions';
import SalesCustomers from './components/SalesCustomers';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import AppHeader from '@/components/AppHeader';
import type { OrderListItem } from '@/lib/odoo-api';

interface SalesAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function SalesApp({ onLogout, onSwitchSA }: SalesAppProps) {
  const router = useRouter();
  const { t } = useI18n();
  
  // Screen management
  const [currentScreen, setCurrentScreen] = useState<SalesScreen>('sales');
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

  // Suppress the pending-session prompt on re-entry via bottom nav after the
  // first check (same pattern as AttendantApp).
  const [hasCompletedInitialSessionCheck, setHasCompletedInitialSessionCheck] = useState(false);

  // True while a sales registration is mid-flow — blocks bottom-nav tab
  // switches so the salesperson can't abandon an in-progress registration.
  const [isSalesInProgress, setIsSalesInProgress] = useState(false);

  // Session management for resuming
  const [selectedSession, setSelectedSession] = useState<OrderListItem | null>(null);
  const [selectedSessionReadOnly, setSelectedSessionReadOnly] = useState(false);

  // Lock body overflow for fixed container
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  // Load employee data and SA on mount
  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) {
      setEmployee(user);
    }
    setCurrentSA(getSelectedSA('sales'));
  }, []);

  // Handle navigation. Refuse to leave the sales screen mid-flow — the
  // registration must be finished (it auto-saves and can be resumed later).
  const handleNavigate = useCallback((screen: SalesScreen) => {
    if (isSalesInProgress && screen !== 'sales') {
      toast.error(
        t('session.finishBeforeSwitching') ||
          'Finish the current registration before switching tabs.',
      );
      return;
    }
    // Clear selected session when navigating away from sales
    if (screen !== 'sales') {
      setSelectedSession(null);
      setSelectedSessionReadOnly(false);
    }
    setCurrentScreen(screen);
  }, [isSalesInProgress, t]);

  // Handle logout
  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router]);

  // Handle session selection from sessions list
  const handleSelectSession = useCallback((order: OrderListItem, isReadOnly: boolean) => {
    setSelectedSession(order);
    setSelectedSessionReadOnly(isReadOnly);
    setCurrentScreen('sales');
  }, []);

  // Handle session consumed (after resuming)
  const handleSessionConsumed = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionReadOnly(false);
  }, []);

  const handleInitialSessionCheckComplete = useCallback(() => {
    setHasCompletedInitialSessionCheck(true);
  }, []);

  // If on 'sales' screen, show SalesFlow with full control
  if (currentScreen === 'sales') {
    return (
      <SalesFlow
        onLogout={handleLogout}
        renderBottomNav={() => (
          <SalesNav
            currentScreen={currentScreen}
            onNavigate={handleNavigate}
          />
        )}
        initialSession={selectedSession}
        initialSessionReadOnly={selectedSessionReadOnly}
        onInitialSessionConsumed={handleSessionConsumed}
        skipSessionCheck={hasCompletedInitialSessionCheck}
        onInitialSessionCheckComplete={handleInitialSessionCheckComplete}
        onSessionActiveChange={setIsSalesInProgress}
      />
    );
  }

  // Other screens with standard layout
  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      
      <AppHeader showBack onSwitchSA={onSwitchSA} />
      {/* Main Content */}
      <main className="sales-main sales-main-screen">
        {currentScreen === 'customers' && (
          <div className="sales-screen-container">
            <SalesCustomers />
          </div>
        )}
        {currentScreen === 'sessions' && (
          <div className="sales-screen-container">
            <SalesSessions onSelectSession={handleSelectSession} />
          </div>
        )}
        {currentScreen === 'transactions' && (
          <div className="sales-screen-container">
            <SalesTransactions />
          </div>
        )}
        {currentScreen === 'profile' && (
          <div className="sales-screen-container">
            <SalesProfile 
              employee={employee}
              onLogout={handleLogout}
              serviceAccount={currentSA}
              onSwitchSA={onSwitchSA}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation - Always visible */}
      <SalesNav 
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
