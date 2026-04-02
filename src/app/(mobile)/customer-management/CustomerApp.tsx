'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser,
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';
import CustomerManagement from './CustomerManagement';

interface CustomerAppProps {
  onLogout?: () => void;
}

export default function CustomerApp({ onLogout }: CustomerAppProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    const user = getSalesRoleUser();
    if (user) {
      setEmployee(user);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router]);

  const handleBackToRoles = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />

      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              className="flow-header-back"
              onClick={handleBackToRoles}
              aria-label={t('attendant.changeRole') || 'Change Role'}
              title={t('attendant.changeRole') || 'Change Role'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
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
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage') || 'Switch Language'}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          <CustomerManagement onLogout={handleLogout} />
        </div>
      </main>
    </div>
  );
}
