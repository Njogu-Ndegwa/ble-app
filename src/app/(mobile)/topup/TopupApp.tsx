"use client";

import React, { useEffect, useState } from 'react';
import {
  getSalesRoleUser,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { getActiveSAApplets } from '@/lib/ov-auth';
import { useI18n } from '@/i18n';
import AppHeader from '@/components/AppHeader';
import TopupFlow from './TopupFlow';

interface TopupAppProps {
  // Retained for page-shell parity with the other applets; AppHeader owns sign-out.
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function TopupApp({ onSwitchSA }: TopupAppProps) {
  const { t } = useI18n();
  const [employee] = useState<EmployeeUser | null>(() => getSalesRoleUser());

  const saApplets = getActiveSAApplets();
  const denied = saApplets.length > 0 && !saApplets.includes('topup');

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
        {denied ? (
          <div role="alert" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
            {t('topup.notAuthorized') || 'This account does not have access to the Top-Up applet.'}
          </div>
        ) : (
          employee && <TopupFlow employee={employee} />
        )}
      </main>
    </div>
  );
}
