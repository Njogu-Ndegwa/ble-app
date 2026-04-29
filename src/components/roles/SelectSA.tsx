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
  fetchAndCacheServiceAccounts,
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
  const [fetchingAccounts, setFetchingAccounts] = useState(false);

  useEffect(() => {
    const stored = getStoredServiceAccounts();
    setServiceAccounts(stored);

    const emp = getOdooEmployee();
    if (emp) setEmployee({ name: emp.name, email: emp.email });

    // Live fetch is only triggered when no accounts were saved at login time
    // (e.g. Microsoft SSO without session_data).  For normal email/password login,
    // accounts are already stored and this branch is skipped.
    if (stored.length === 0) {
      setFetchingAccounts(true);
      fetchAndCacheServiceAccounts().then(accounts => {
        if (accounts.length === 1) {
          selectServiceAccount(accounts[0]);
          onSelected();
          return;
        }
        if (accounts.length > 0) setServiceAccounts(accounts);
        setFetchingAccounts(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (sa: ServiceAccount) => {
    setSelecting(sa.id);
    selectServiceAccount(sa);
    onSelected();
  };

  const handleLogout = () => {
    clearOdooEmployeeSession();
    onSwitchAccount();
  };

  const toggleLocale = () => {
    const next = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(next);
  };

  const roleBadgeClass = (role: string) => {
    if (role === 'admin') return 'sa-badge sa-badge-admin';
    if (role === 'staff') return 'sa-badge sa-badge-staff';
    return 'sa-badge sa-badge-agent';
  };

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      {/* Minimal header — SelectSA is a pre-selection step, no full profile menu needed */}
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
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage') || 'Language'}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
            <button
              className="flow-header-logout"
              onClick={handleLogout}
              aria-label={t('sa.signOut') || 'Sign Out'}
              title={t('sa.signOut') || 'Sign Out'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="select-role-main">
        <div className="sa-page-body">
          {/* Hero / intro block */}
          <div className="sa-hero">
            <div className="sa-hero-icon">
              <Layers size={26} />
            </div>
            <div className="sa-hero-text">
              {employee && (
                <p className="sa-hero-greeting">
                  {t('auth.welcome') || 'Welcome'},{' '}
                  <strong>{employee.name}</strong>
                </p>
              )}
              <h1 className="sa-hero-title">
                {t('sa.selectTitle') || 'Select Service Account'}
              </h1>
              <p className="sa-hero-desc">
                {t('sa.selectDescription') || 'Choose the workspace you want to work in.'}
              </p>
            </div>
          </div>

          {/* Account cards */}
          {fetchingAccounts ? (
            <div className="sa-loading">
              <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              <span>{t('common.loading') || 'Loading accounts…'}</span>
            </div>
          ) : serviceAccounts.length === 0 ? (
            <div className="sa-error-card">
              <p className="sa-error-title">{t('sa.noAccessTitle') || 'No Access'}</p>
              <p className="sa-error-desc">{t('sa.noAccounts') || 'No service accounts found.'}</p>
              <p className="sa-error-hint">{t('sa.noAccessHint') || 'Contact your administrator.'}</p>
              <div className="sa-error-actions">
                <button className="btn btn-secondary" onClick={handleLogout}>
                  {t('sa.signOut') || 'Sign Out'}
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
