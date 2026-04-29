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
    console.info('[SelectSA] Stored SAs on mount:', stored.length, stored.map(a => `#${a.id} ${a.name}`));
    setServiceAccounts(stored);

    const emp = getOdooEmployee();
    if (emp) setEmployee({ name: emp.name, email: emp.email });

    // After Microsoft SSO the SA list is not embedded in the callback — fetch it live
    if (stored.length === 0) {
      setFetchingAccounts(true);
      fetchAndCacheServiceAccounts().then(accounts => {
        console.info('[SelectSA] Live fetch returned', accounts.length, 'SA(s):', accounts.map(a => `#${a.id} ${a.name}`));
        if (accounts.length === 1) {
          // Single SA — auto-select and skip the picker, same as the normal login path
          console.info('[SelectSA] Single SA after live fetch — auto-selecting SA #', accounts[0].id);
          selectServiceAccount(accounts[0]);
          onSelected();
          return;
        }
        if (accounts.length > 0) setServiceAccounts(accounts);
        setFetchingAccounts(false);
      });
    }
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
          {fetchingAccounts ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              <span>{t('common.loading') || 'Loading accounts…'}</span>
            </div>
          ) : serviceAccounts.length === 0 ? (
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
