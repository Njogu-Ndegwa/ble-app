"use client";

import React, { useEffect, useState } from 'react';
import { getSalesRoleUser, type EmployeeUser } from '@/lib/attendant-auth';
import { AppShell } from '@/components/layout';
import ChargerFlow from './ChargerFlow';

interface ChargerAppProps {
  // Retained for page-shell parity with the other applets; AppHeader owns sign-out.
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function ChargerApp({ onSwitchSA }: ChargerAppProps) {
  // Same posture as the Top-Up applet: no SA-slug gate (the tile itself is
  // restricted to the test company), but sign-in IS required — the Odoo plan
  // catalog and the ABS identify/billing calls both need the staff token.
  const [employee] = useState<EmployeeUser | null>(() => getSalesRoleUser());

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  return (
    <AppShell header={{ showBack: true, onSwitchSA }} width="narrow">
      {employee && <ChargerFlow employee={employee} />}
    </AppShell>
  );
}
