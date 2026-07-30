"use client";

import React, { useEffect, useState } from 'react';
import {
  getSalesRoleUser,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { AppShell } from '@/components/layout';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  // Retained for page-shell parity with the other applets; AppHeader owns sign-out.
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onSwitchSA }: TopupAppProps) {
  // No SA-slug authorization gate: the Top-Up applet is open to every signed-in
  // staff member (the `topup` slug can't be provisioned backend-side). Sign-in
  // itself is still required because the Odoo plan catalog needs the staff token.
  const [employee] = useState<EmployeeUser | null>(() => getSalesRoleUser());

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  return (
    <AppShell header={{ showBack: true, onSwitchSA }} width="narrow">
      {employee && <TopupFlow employee={employee} />}
    </AppShell>
  );
}
