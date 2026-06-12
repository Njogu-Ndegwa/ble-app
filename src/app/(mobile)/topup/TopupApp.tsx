"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import AppHeader from '@/components/AppHeader';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onLogout, onSwitchSA }: TopupAppProps) {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  // currentSA is loaded for completeness alongside the employee.
  const [_currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

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

  // AppHeader's built-in avatar dropdown handles sign-out via clearAllAuth.
  // handleLogout is the supplemental path so the page-level state machine
  // (page.tsx) can reset when the user logs out through the SA-switch flow.
  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      <AppHeader showBack onSwitchSA={onSwitchSA} />
      {employee && <TopupFlow employee={employee} />}
    </div>
  );
}
