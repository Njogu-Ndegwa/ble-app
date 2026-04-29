'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Globe, LogOut, Layers } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  getStoredServiceAccounts,
  selectServiceAccount,
  getOdooEmployee,
  clearOdooEmployeeSession,
} from '@/lib/ov-auth';
import type { ServiceAccount } from '@/lib/sa-types';

interface Props {
  onSelected: () => void;
  onSwitchAccount: () => void;
}

export default function SelectSA({ onSelected, onSwitchAccount }: Props) {
  const { locale, setLocale, t } = useI18n();
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    setServiceAccounts(getStoredServiceAccounts());
    const emp = getOdooEmployee();
    if (emp) setEmployee({ name: emp.name, email: emp.email });
  }, []);

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  const handleSelect = (sa: ServiceAccount) => {
    setSelecting(sa.id);
    selectServiceAccount(sa);
    onSelected();
  };

  const handleLogout = () => {
    clearOdooEmployeeSession();
    onSwitchAccount();
  };

  const roleBadgeClass = (role: string) => {
    if (role === 'admin') return 'sa-badge sa-badge-admin';
    if (role === 'staff') return 'sa-badge sa-badge-staff';
    return 'sa-badge sa-badge-agent';
  };

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
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
              aria-label={t('role.switchLanguage')}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
            <button
              className="flow-header-logout"
              onClick={handleLogout}
              aria-label={t('sa.signOut')}
              title={t('sa.signOut')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="select-role-main">
        <div className="role-selection">
          {/* Greeting */}
          <div style={{ width: '100%', maxWidth: 420, marginBottom: 8 }}>
            {employee && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {t('auth.welcome')}, <strong style={{ color: 'var(--text-primary)' }}>{employee.name}</strong>
              </p>
            )}
            <h1 className="role-title" style={{ fontSize: 20, marginBottom: 4 }}>
              {t('sa.selectTitle')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {t('sa.selectDescription')}
            </p>
          </div>

          {/* SA cards */}
          {serviceAccounts.length === 0 ? (
            <div className="sa-error-card">
              <p className="sa-error-title">{t('sa.noAccessTitle')}</p>
              <p className="sa-error-desc">{t('sa.noAccounts')}</p>
              <p className="sa-error-hint">{t('sa.noAccessHint')}</p>
              <div className="sa-error-actions">
                <button className="btn btn-secondary" onClick={handleLogout}>
                  {t('sa.signOut')}
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-grid">
              {serviceAccounts.map(sa => {
                const isSelecting = selecting === sa.id;
                const appletCount = sa.applets?.length ?? 0;

                return (
                  <button
                    key={sa.id}
                    className="sa-card"
                    onClick={() => handleSelect(sa)}
                    disabled={selecting !== null}
                    style={{ opacity: selecting !== null && !isSelecting ? 0.5 : 1 }}
                  >
                    <div className="sa-card-name">
                      {isSelecting ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />
                          {sa.name}
                        </span>
                      ) : (
                        sa.name
                      )}
                    </div>
                    <div className="sa-card-badges">
                      <span className={roleBadgeClass(sa.my_role)}>
                        {sa.my_role}
                      </span>
                      {sa.account_class && (
                        <span className="sa-badge sa-badge-class">
                          {sa.account_class}
                        </span>
                      )}
                      <span className="sa-badge sa-badge-class" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Layers size={9} />
                        {appletCount} {appletCount === 1 ? t('sa.applet') : t('sa.applets')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
