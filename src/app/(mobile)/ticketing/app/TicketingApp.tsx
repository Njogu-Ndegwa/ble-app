'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearSalesRoleLogin } from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import { AppShell } from '@/components/layout';
import Ticketing from './Ticketing';

interface TicketingAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TicketingApp({ onLogout }: TicketingAppProps) {
  const router = useRouter();

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
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

  return (
    <AppShell header={{ showBack: true }} width="wide">
      <div className="sales-screen-container">
        <Ticketing onLogout={handleLogout} />
      </div>
    </AppShell>
  );
}
