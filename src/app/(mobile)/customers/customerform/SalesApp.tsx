"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  
  // Screen management
  const [currentScreen, setCurrentScreen] = useState<SalesScreen>('sales');
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);
  
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

  // Handle navigation
  const handleNavigate = useCallback((screen: SalesScreen) => {
    // Clear selected session when navigating away from sales
    if (screen !== 'sales') {
      setSelectedSession(null);
      setSelectedSessionReadOnly(false);
    }
    setCurrentScreen(screen);
  }, []);

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
