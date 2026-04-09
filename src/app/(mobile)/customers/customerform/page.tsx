'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import {
  isSalesRoleLoggedIn,
  getSalesRoleUser,
  getSalesRoleToken,
  clearSalesRoleLogin,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import {
  fetchMyServiceAccounts,
  saveSelectedSA,
  getSelectedSAId,
  hasSASelected,
  clearSelectedSA,
} from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';

const AppLoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
    <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
  </div>
);

const SalesApp = dynamic(() => import('./SalesApp'), {
  loading: AppLoadingFallback,
  ssr: false,
});

const Login = dynamic(() => import('../../attendant/attendant/login'), {
  loading: AppLoadingFallback,
  ssr: false,
});

const SelectServiceAccount = dynamic(() => import('@/components/ui/SelectServiceAccount'), {
  loading: AppLoadingFallback,
  ssr: false,
});

type Screen = 'login' | 'selectSA' | 'app';

function getInitialScreen(): { screen: Screen; user: EmployeeUser | null } {
  if (typeof window === 'undefined') return { screen: 'login', user: null };
  try {
    if (!isSalesRoleLoggedIn()) {
      clearSalesSession();
      return { screen: 'login', user: null };
    }
    const user = getSalesRoleUser();
    if (!user) {
      clearSalesSession();
      return { screen: 'login', user: null };
    }
    if (hasSASelected('sales')) return { screen: 'app', user };
    return { screen: 'selectSA', user };
  } catch {
    clearSalesRoleLogin();
    clearSalesSession();
    return { screen: 'login', user: null };
  }
}

export default function CustomerFormPage() {
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen().screen);
  const [user, setUser] = useState<EmployeeUser | null>(
    () => getInitialScreen().user,
  );

  const [saAccounts, setSaAccounts] = useState<ServiceAccount[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [saErrorKind, setSaErrorKind] = useState<
    'noAccounts' | 'loadFailed' | null
  >(null);

  const loadServiceAccounts = useCallback(async (token: string) => {
    setSaLoading(true);
    setSaErrorKind(null);
    try {
      const res = await fetchMyServiceAccounts(token);
      const accounts = res.service_accounts ?? [];
      setSaAccounts(accounts);

      if (accounts.length === 0) {
        setSaErrorKind('noAccounts');
        setScreen('selectSA');
        return;
      }

      if (accounts.length === 1 && res.auto_selected) {
        saveSelectedSA('sales', accounts[0]);
        setScreen('app');
        return;
      }

      setScreen('selectSA');
    } catch (err) {
      console.error('[SalesPage] Failed to load SAs:', err);
      setSaErrorKind('loadFailed');
      setScreen('selectSA');
    } finally {
      setSaLoading(false);
    }
  }, []);

  // When mounting into selectSA (already logged in, no SA chosen yet), fetch SAs
  useEffect(() => {
    if (screen === 'selectSA' && saAccounts.length === 0 && !saLoading) {
      const token = getSalesRoleToken();
      if (token) {
        loadServiceAccounts(token);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = useCallback(
    (customerData: any) => {
      const employeeUser: EmployeeUser = {
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        userType: 'sales',
      };
      setUser(employeeUser);

      const token = getSalesRoleToken();
      if (token) {
        loadServiceAccounts(token);
      } else {
        setScreen('app');
      }
    },
    [loadServiceAccounts],
  );

  const handleSASelect = useCallback((sa: ServiceAccount) => {
    saveSelectedSA('sales', sa);
    setScreen('app');
  }, []);

  const handleSARetry = useCallback(() => {
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

  const handleSignOut = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    clearSelectedSA('sales');
    setUser(null);
    setSaAccounts([]);
    setSaErrorKind(null);
    setScreen('login');
  }, []);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    clearSelectedSA('sales');
    setUser(null);
    setSaAccounts([]);
    setScreen('login');
  }, []);

  const handleSwitchSA = useCallback(() => {
    clearSelectedSA('sales');
    setSaAccounts([]);
    setScreen('selectSA');
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontFamily: "'Outfit', sans-serif",
          },
          success: {
            iconTheme: {
              primary: 'var(--color-success)',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-error)',
              secondary: 'white',
            },
          },
        }}
      />
      {screen === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} userType="sales" />
      )}
      {screen === 'selectSA' && (
        <SelectServiceAccount
          accounts={saAccounts}
          loading={saLoading}
          errorKind={saErrorKind}
          userName={user?.name ?? ''}
          userType="sales"
          lastSAId={getSelectedSAId('sales')}
          onSelect={handleSASelect}
          onSignOut={handleSignOut}
          onRetry={handleSARetry}
        />
      )}
      {screen === 'app' && <SalesApp onLogout={handleLogout} onSwitchSA={handleSwitchSA} />}
    </>
  );
}
