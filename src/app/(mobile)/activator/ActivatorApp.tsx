"use client";

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import ActivatorNav, { type ActivatorScreen } from './components/ActivatorNav';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import AppHeader from '@/components/AppHeader';
import type { OrderListItem } from '@/lib/odoo-api';

const ActivatorFlow = dynamic(() => import('./ActivatorFlow'), { ssr: false });
const ActivatorSessions = dynamic(() => import('./components/ActivatorSessions'), { ssr: false });
const WorkflowProfile = dynamic(() => import('@/components/shared').then(m => ({ default: m.WorkflowProfile })), { ssr: false });

interface ActivatorAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function ActivatorApp({ onLogout, onSwitchSA }: ActivatorAppProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [currentScreen, setCurrentScreen] = useState<ActivatorScreen>('activate');
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

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
    setCurrentSA(getSelectedSA('sales'));
  }, []);

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
      <AppHeader />

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
              serviceAccount={currentSA}
              onSwitchSA={onSwitchSA}
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
