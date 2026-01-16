"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { 
  getAttendantRoleUser, 
  clearAttendantRoleLogin,
  getAttendantRoleToken,
  type EmployeeUser 
} from '@/lib/attendant-auth';
import AttendantFlow from './AttendantFlow';
import { 
  AttendantNav, 
  AttendantTransactions,
  AttendantProfile,
  type AttendantScreen 
} from './components';
import { SessionsHistory } from '@/components/shared';
import type { OrderListItem } from '@/lib/odoo-api';

interface AttendantAppProps {
  onLogout?: () => void;
}

export default function AttendantApp({ onLogout }: AttendantAppProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  
  // Screen management
  const [currentScreen, setCurrentScreen] = useState<AttendantScreen>('swap');
  
  // Employee info
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  
  // Sessions history modal state (for viewing from sessions screen)
  const [showSessionsHistory, setShowSessionsHistory] = useState(false);
  
  // Load employee info on mount
  useEffect(() => {
    const user = getAttendantRoleUser();
    if (user) {
      setEmployee(user);
    }
  }, []);

  // Lock body overflow
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If we're not on swap, go to swap
      if (currentScreen !== 'swap') {
        setCurrentScreen('swap');
        // Prevent default back navigation by pushing state again
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Push initial state to history when screen changes
    if (currentScreen !== 'swap') {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentScreen]);

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
    clearAttendantRoleLogin();
    toast.success(t('common.logoutSuccess') || 'Signed out successfully');
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router, t]);

  // Handle navigation
  const handleNavigate = useCallback((screen: AttendantScreen) => {
    // Special handling for sessions - just open the modal
    if (screen === 'sessions') {
      setShowSessionsHistory(true);
      return;
    }
    setCurrentScreen(screen);
  }, []);

  // Handle session selection from history
  const handleSelectSession = useCallback((order: OrderListItem, isReadOnly: boolean) => {
    setShowSessionsHistory(false);
    // Switch to swap screen and it will handle session restoration
    setCurrentScreen('swap');
    // The AttendantFlow handles session restoration internally via its own SessionsHistory
    // For now, we'll just navigate to swap - the user can use the history button there
    // In a future iteration, we could pass the selected order to AttendantFlow
  }, []);

  // Render current screen content
  const renderScreenContent = () => {
    switch (currentScreen) {
      case 'swap':
        return (
          <AttendantFlow 
            onLogout={handleLogout}
            hideHeaderActions={true} // Hide header actions since we have bottom nav
          />
        );
      case 'transactions':
        return (
          <div className="attendant-screen-container">
            <AttendantTransactions />
          </div>
        );
      case 'profile':
        return (
          <div className="attendant-screen-container">
            <AttendantProfile 
              employee={employee}
              onLogout={handleLogout}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // For swap screen, AttendantFlow handles its own header
  if (currentScreen === 'swap') {
    return (
      <>
        <AttendantFlow 
          onLogout={handleLogout}
          hideHeaderActions={false}
          renderBottomNav={() => (
            <AttendantNav 
              currentScreen={currentScreen}
              onNavigate={handleNavigate}
            />
          )}
        />
        
        {/* Sessions History Modal */}
        <SessionsHistory
          isVisible={showSessionsHistory}
          onClose={() => setShowSessionsHistory(false)}
          onSelectSession={handleSelectSession}
          authToken={getAttendantRoleToken() || ''}
          workflowType="attendant"
        />
      </>
    );
  }

  // For other screens, render with header and nav
  return (
    <div className="attendant-container">
      <div className="attendant-bg-gradient" />
      
      {/* Header */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={() => setCurrentScreen('swap')}
              aria-label={t('common.back') || 'Back'}
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
          <div className="flow-header-right">
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
      <main className="attendant-main attendant-main-full">
        {renderScreenContent()}
      </main>

      {/* Bottom Navigation */}
      <AttendantNav 
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
      />

      {/* Sessions History Modal */}
      <SessionsHistory
        isVisible={showSessionsHistory}
        onClose={() => setShowSessionsHistory(false)}
        onSelectSession={handleSelectSession}
        authToken={getAttendantRoleToken() || ''}
        workflowType="attendant"
      />
    </div>
  );
}

