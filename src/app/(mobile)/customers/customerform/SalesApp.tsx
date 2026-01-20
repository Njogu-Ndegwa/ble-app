"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import Image from 'next/image';
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
import type { OrderListItem } from '@/lib/odoo-api';

interface SalesAppProps {
  onLogout?: () => void;
}

export default function SalesApp({ onLogout }: SalesAppProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  
  // Screen management
  const [currentScreen, setCurrentScreen] = useState<SalesScreen>('sales');
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  
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

  // Load employee data on mount
  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) {
      setEmployee(user);
    }
  }, []);

  // Toggle locale function
  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

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

  // Handle back to role selection
  const handleBackToRoles = useCallback(() => {
    router.push('/');
  }, [router]);

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
      
      {/* Header */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToRoles}
              aria-label={t('attendant.changeRole') || 'Change Role'}
              title={t('attendant.changeRole') || 'Change Role'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
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
          <div className="flow-header-right">
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage') || 'Switch Language'}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="sales-main sales-main-screen">
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
