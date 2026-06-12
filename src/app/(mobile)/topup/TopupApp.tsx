"use client";

import React, { useEffect, useState } from 'react';
import {
  getSalesRoleUser,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import AppHeader from '@/components/AppHeader';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  // Retained for page-shell parity with the other applets; AppHeader owns sign-out.
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onSwitchSA }: TopupAppProps) {
  const [employee] = useState<EmployeeUser | null>(() => getSalesRoleUser());

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack onSwitchSA={onSwitchSA} />
      <main className="sales-main">
        {employee && <TopupFlow employee={employee} />}
      </main>
    </div>
  );
}
