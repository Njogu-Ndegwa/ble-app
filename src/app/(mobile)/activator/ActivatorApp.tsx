"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import ActivatorFlow from './ActivatorFlow';
import ActivatorNav, { type ActivatorScreen } from './components/ActivatorNav';
import ActivatorSessions from './components/ActivatorSessions';
import { WorkflowProfile } from '@/components/shared';
import type { OrderListItem } from '@/lib/odoo-api';

interface ActivatorAppProps {
  onLogout?: () => void;
}

export default function ActivatorApp({ onLogout }: ActivatorAppProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const [currentScreen, setCurrentScreen] = useState<ActivatorScreen>('activate');
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);

  const [selectedSession, setSelectedSession] = useState<OrderListItem | null>(null);
  const [selectedSessionReadOnly, setSelectedSessionReadOnly] = useState(false);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) setEmployee(user);
  }, []);

  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  const handleNavigate = useCallback((screen: ActivatorScreen) => {
    if (screen !== 'activate') {
      setSelectedSession(null);
      setSelectedSessionReadOnly(false);
    }
    setCurrentScreen(screen);
  }, []);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router]);

  const handleBackToRoles = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleSelectSession = useCallback((order: OrderListItem, isReadOnly: boolean) => {
    setSelectedSession(order);
    setSelectedSessionReadOnly(isReadOnly);
    setCurrentScreen('activate');
  }, []);

  const handleSessionConsumed = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionReadOnly(false);
  }, []);

  if (currentScreen === 'activate') {
    return (
      <ActivatorFlow
        onLogout={handleLogout}
        renderBottomNav={() => (
          <ActivatorNav
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

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />

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
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
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

      <main className="sales-main sales-main-screen">
        {currentScreen === 'sessions' && (
          <div className="sales-screen-container">
            <ActivatorSessions onSelectSession={handleSelectSession} />
          </div>
        )}
        {currentScreen === 'profile' && (
          <div className="sales-screen-container">
            <WorkflowProfile
              employee={employee}
              onLogout={handleLogout}
              roleIconSrc="/assets/Activator.svg"
              roleLabel={t('role.activator') || 'Activator'}
              employeeIdLabel={t('sales.profile.employeeId') || 'Employee ID'}
              fallbackInitials="AC"
            />
          </div>
        )}
      </main>

      <ActivatorNav
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
