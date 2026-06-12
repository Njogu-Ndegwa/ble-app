"use client";

import React, { useEffect, useState } from 'react';
import {
  getSalesRoleUser,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import AppHeader from '@/components/AppHeader';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onSwitchSA }: TopupAppProps) {
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);

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
