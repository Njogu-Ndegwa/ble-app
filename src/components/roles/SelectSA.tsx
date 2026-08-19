'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers, Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import AppHeader from '@/components/AppHeader';
import {
  getStoredServiceAccounts,
  selectServiceAccount,
  getOdooEmployee,
  getSelectedSAId,
  clearOdooEmployeeSession,
  fetchAndCacheServiceAccounts,
} from '@/lib/ov-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import { preloadRoleIcons } from '@/lib/preload-icons';

interface Props {
  onSelected: () => void;
  onSwitchAccount: () => void;
}

const LARGE_LIST_THRESHOLD = 8;
const SA_SELECTION_COUNTS_KEY = 'ov-sa-selection-counts';

function readSelectionCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SA_SELECTION_COUNTS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function recordSASelection(saId: number): Record<string, number> {
  const counts = readSelectionCounts();
  const next = { ...counts, [String(saId)]: (counts[String(saId)] ?? 0) + 1 };
  localStorage.setItem(SA_SELECTION_COUNTS_KEY, JSON.stringify(next));
  return next;
}

export default function SelectSA({ onSelected, onSwitchAccount }: Props) {
  const { t } = useI18n();
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [search, setSearch] = useState('');
  const [lastSAId, setLastSAId] = useState<number | null>(null);
  const [selectionCounts, setSelectionCounts] = useState<Record<string, number>>({});

  const isLargeList = serviceAccounts.length > LARGE_LIST_THRESHOLD;
  const visibleAccounts = useMemo(() => {
    if (!isLargeList) return serviceAccounts;

    const query = search.trim().toLocaleLowerCase();
    const filtered = serviceAccounts.filter((sa) => {
      if (!query) return true;
      return [sa.name, sa.account_code, sa.company_name, sa.partner?.name, sa.account_class]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => {
      const usageDifference = (selectionCounts[String(b.id)] ?? 0) - (selectionCounts[String(a.id)] ?? 0);
      if (usageDifference !== 0) return usageDifference;

      if (!query && lastSAId !== null) {
        const aIsLast = a.id === lastSAId;
        const bIsLast = b.id === lastSAId;
        if (aIsLast !== bIsLast) return aIsLast ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [isLargeList, lastSAId, search, selectionCounts, serviceAccounts]);

  useEffect(() => {
    // Pre-fetch role-grid icons while the user is choosing an SA so they're
    // already in the browser cache when SelectRole mounts.
    preloadRoleIcons();

    const stored = getStoredServiceAccounts();
    setServiceAccounts(stored);
    setLastSAId(getSelectedSAId());
    setSelectionCounts(readSelectionCounts());

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
    setSelectionCounts(recordSASelection(sa.id));
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

      <AppHeader />

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
            isLargeList ? (
              <div className="sa-large-list">
                <div className="sa-search-panel">
                  <div className="sa-search-heading">
                    <label htmlFor="mobile-service-account-search">
                      {t('sa.searchLabel') || 'Find a service account'}
                    </label>
                    <span>{t('sa.accountCount', { count: serviceAccounts.length }) || `${serviceAccounts.length} service accounts`}</span>
                  </div>
                  <div className="sa-search-field">
                    <Search size={17} aria-hidden="true" />
                    <input
                      id="mobile-service-account-search"
                      type="search"
                      autoFocus
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t('sa.searchPlaceholder') || 'Search by name, code, company, or location…'}
                      aria-label={t('sa.searchLabel') || 'Search service accounts'}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label={t('sa.clearSearch') || 'Clear search'}
                        className="sa-search-clear"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {visibleAccounts.length === 0 ? (
                  <div className="sa-no-matches">
                    <p>{t('sa.noMatches') || 'No matching service accounts'}</p>
                    <span>{t('sa.noMatchesHint') || 'Try a different name, code, company, or location.'}</span>
                  </div>
                ) : (
                  <div className="sa-list">
                    {lastSAId !== null && !search && visibleAccounts.some((sa) => sa.id === lastSAId) && (
                      <div className="sa-list-section-label">{t('sa.recent') || 'Recent'}</div>
                    )}
                    {visibleAccounts.map(sa => {
                      const isSelecting = selecting === sa.id;
                      const isLast = lastSAId === sa.id;
                      const appletCount = sa.applets?.length ?? 0;

                      return (
                        <button
                          key={sa.id}
                          type="button"
                          className="sa-list-item"
                          onClick={() => handleSelect(sa)}
                          disabled={selecting !== null}
                        >
                          <div className="sa-list-item-content">
                            <div className="sa-list-item-title">
                              <span>{isSelecting ? `${sa.name}…` : sa.name}</span>
                              {isLast && <span className="sa-card-last-used-pill">{t('sa.lastUsed') || 'Last Used'}</span>}
                            </div>
                            <div className="sa-card-badges">
                              <span className={roleBadgeClass(sa.my_role)}>{sa.my_role}</span>
                              {sa.account_class && <span className="sa-badge sa-badge-class">{sa.account_class}</span>}
                              <span className="sa-badge sa-badge-class sa-list-app-count">
                                <Layers size={9} />
                                {appletCount} {appletCount === 1 ? t('sa.applet') : t('sa.applets')}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="sa-list-chevron" size={18} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
            <div className="sa-grid">
              {serviceAccounts.map(sa => {
                const isSelecting = selecting === sa.id;
                const isLast = lastSAId === sa.id;
                const appletCount = sa.applets?.length ?? 0;

                return (
                  <button
                    key={sa.id}
                    className={`sa-card${isLast ? ' sa-card-last-used' : ''}`}
                    onClick={() => handleSelect(sa)}
                    disabled={selecting !== null}
                    style={{ opacity: selecting !== null && !isSelecting ? 0.5 : 1 }}
                  >
                    {isLast && <span className="sa-card-last-used-pill">{t('sa.lastUsed') || 'Last Used'}</span>}
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
            )
          )}
        </div>
      </main>
    </div>
  );
}
