'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Zap, FolderTree, LifeBuoy, MessagesSquare } from 'lucide-react';
import { useI18n } from '@/i18n';
import AppHeader from '@/components/AppHeader';
import { getActiveSAApplets, getSelectedSA } from '@/lib/ov-auth';

interface Props {
  /** Called when the user wants to switch to a different SA (no re-login). */
  onSwitchSA?: () => void;
}

interface RoleConfig {
  id: string;
  labelKey: string;
  path: string;
  /**
   * Canonical applet slug(s) from the login response. A role is shown when the
   * SA's applet list contains ANY of the listed slugs. Roles without a slug are
   * always shown.
   */
  appletSlug?: string | string[];
  disabled?: boolean;
  badgeKey?: string;
  icon:
    | { type: 'image'; src: string; gradient: string }
    | { type: 'lucide'; el: React.ReactNode; gradient: string };
}

/**
 * Mapping from this component's role id → canonical SA applet slug(s).
 * Roles whose id is not in this map are always shown (no applet guard).
 * An array value means the role is shown when the SA has ANY of those slugs.
 */
const APPLET_SLUG_MAP: Record<string, string | string[]> = {
  customerManagement: 'customer-management',
  products: 'products',
  orders: 'orders',
  rider: 'rider',
  activator: 'activator',
  sales: 'customers',
  attendant: 'attendant',
  manualSwap: 'externalswap',
  topUpSwap: 'topupswap',
  keypad: 'keypad',
  // Both 'assets' and 'mydevices' grant access to the Device Manager tile.
  bleDeviceManager: ['assets', 'mydevices'],
  location: 'location',
  ota: 'ota',
  ticketing: 'ticketing',
  // End-user Support applet — separate slug so SAs can get the lightweight
  // experience without the agent Ticketing board (mirrors the desktop portal).
  support: 'ticketing-customer',
  rollup: 'rollup',
  // Backend grants the Top-Up app via the `energytopup` slug.
  topup: 'energytopup',
};

const ALL_ROLES: RoleConfig[] = [
  // Row 1: Data & logistics
  {
    id: 'customerManagement',
    labelKey: 'role.customerManagement',
    icon: { type: 'image', src: '/assets/optimized/Customer.png', gradient: 'role-grad-customer' },
    path: '/customer-management',
    appletSlug: 'customer-management',
  },
  {
    id: 'products',
    labelKey: 'role.products',
    icon: { type: 'image', src: '/assets/optimized/Products.png', gradient: 'role-grad-products' },
    path: '/products',
    appletSlug: 'products',
  },
  {
    id: 'orders',
    labelKey: 'role.orders',
    icon: { type: 'image', src: '/assets/optimized/Orders.png', gradient: 'role-grad-orders' },
    path: '/orders',
    appletSlug: 'orders',
  },
  {
    id: 'rider',
    labelKey: 'role.rider',
    icon: { type: 'image', src: '/assets/optimized/Rider.png', gradient: 'role-grad-rider' },
    path: '/rider/app',
    appletSlug: 'rider',
  },
  // Row 2: Field operations
  {
    id: 'activator',
    labelKey: 'role.activator',
    icon: { type: 'image', src: '/assets/optimized/Activator.png', gradient: 'role-grad-activator' },
    path: '/activator',
    appletSlug: 'activator',
  },
  {
    id: 'sales',
    labelKey: 'role.salesRep',
    icon: { type: 'image', src: '/assets/optimized/Salesperson.png', gradient: 'role-grad-sales' },
    path: '/customers/customerform',
    appletSlug: 'customers',
  },
  {
    id: 'attendant',
    labelKey: 'role.attendant',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/attendant',
    appletSlug: 'attendant',
  },
  {
    id: 'manualSwap',
    labelKey: 'role.manualSwap',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/manual-swap',
    appletSlug: 'externalswap',
  },
  {
    id: 'topUpSwap',
    labelKey: 'role.topUpSwap',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/topup-swap',
    appletSlug: 'topupswap',
  },
  {
    id: 'keypad',
    labelKey: 'role.keypad',
    icon: { type: 'image', src: '/assets/optimized/Keypad2.png', gradient: 'role-grad-keypad' },
    path: '/keypad/keypad',
    appletSlug: 'keypad',
  },
  // Row 3: Device tools
  {
    id: 'bleDeviceManager',
    labelKey: 'role.bleDeviceManager',
    icon: { type: 'image', src: '/assets/optimized/BleDeviceAttendant.png', gradient: 'role-grad-ble' },
    path: '/assets/ble-devices',
    // Visible when the SA has either 'assets' OR 'mydevices' in its applet list.
    appletSlug: ['assets', 'mydevices'],
  },
  // Row 4: Management
  {
    id: 'rollup',
    labelKey: 'role.rollup',
    icon: { type: 'lucide', el: <FolderTree size={28} color="#fff" />, gradient: 'role-grad-rollup' },
    path: '/rollup',
    appletSlug: 'rollup',
  },
  {
    id: 'ticketing',
    labelKey: 'role.ticketing',
    icon: { type: 'lucide', el: <LifeBuoy size={28} color="#fff" />, gradient: 'role-grad-ticketing' },
    path: '/ticketing/app',
    appletSlug: 'ticketing',
  },
  {
    id: 'support',
    labelKey: 'role.support',
    icon: { type: 'lucide', el: <MessagesSquare size={28} color="#fff" />, gradient: 'role-grad-support' },
    path: '/support/app',
    appletSlug: 'ticketing-customer',
  },
  {
    id: 'topup',
    labelKey: 'role.topup',
    icon: { type: 'lucide', el: <Zap size={28} color="#fff" />, gradient: 'role-grad-activator' },
    path: '/topup',
    // Shown only when the SA grants the `energytopup` slug.
    appletSlug: 'energytopup',
  },
];

const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
// Last-resort full-reload timeout for a stalled SPA navigation. Must be
// generous: on a first launch over a slow network the navigation legitimately
// takes several seconds while applet chunks download, and a premature
// window.location.href ABANDONS that in-flight download and restarts the whole
// document (HTML + every shared chunk + providers + hydration) — turning a
// slow open into a 20s one. The user sees the loading overlay meanwhile.
const NAV_TIMEOUT_MS = 15000;
const ROLE_SEEN_KEY = 'oves-role-seen';
// Delay before the first background prefetch and spacing between each one.
// Firing all ~13 prefetches at once on first launch competes with the
// service-worker precache and the user's first tap for mobile bandwidth.
const PREFETCH_INITIAL_DELAY_MS = 800;
const PREFETCH_STAGGER_MS = 350;

export default function SelectRole({ onSwitchSA }: Props) {
  const router = useRouter();
  const { t } = useI18n();

  // Skip the stagger animation when returning from an applet — the user has
  // already seen the entrance animation and the delay makes icons look slow.
  const isReturn = useRef(false);
  useEffect(() => {
    try {
      isReturn.current = sessionStorage.getItem(ROLE_SEEN_KEY) === 'true';
      sessionStorage.setItem(ROLE_SEEN_KEY, 'true');
    } catch { /* ignore */ }
  }, []);

  const hiddenAtRef = useRef<number | null>(null);
  const wasIdleRef = useRef(false);
  const navFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive which roles are visible for the current SA.
  // An empty applet list means this SA has no granted apps — return [] so the
  // caller renders an empty state instead of falling back to all roles.
  const visibleRoles = useMemo(() => {
    const saApplets = getActiveSAApplets();

    if (saApplets.length === 0) {
      return [] as RoleConfig[];
    }

    const filtered = ALL_ROLES.filter(role => {
      const slug = role.appletSlug ?? APPLET_SLUG_MAP[role.id];
      if (!slug) return true;
      const slugs = Array.isArray(slug) ? slug : [slug];
      return slugs.some(s => saApplets.includes(s));
    });

    return filtered;
  }, []);

  const selectedSA = useMemo(() => getSelectedSA(), []);

  // Auto-navigate when the SA only grants access to a single applet — no need
  // to show the selection grid in that case (e.g. a rider-only account).
  useEffect(() => {
    if (visibleRoles.length === 1 && !visibleRoles[0].disabled) {
      router.replace(visibleRoles[0].path);
    }
  }, [visibleRoles, router]);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        wasIdleRef.current = !!hiddenAt && (Date.now() - hiddenAt) >= IDLE_THRESHOLD_MS;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const prefetchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = prefetchTimersRef.current;
    let delay = PREFETCH_INITIAL_DELAY_MS;
    for (const role of visibleRoles) {
      if (!role.disabled) {
        timers.push(setTimeout(() => router.prefetch(role.path), delay));
        delay += PREFETCH_STAGGER_MS;
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [router, visibleRoles]);

  useEffect(() => {
    return () => {
      if (navFallbackRef.current) clearTimeout(navFallbackRef.current);
    };
  }, []);

  // The applet being navigated to, if any. Drives the instant loading overlay
  // and ignores further taps (rage-click guard) until navigation completes —
  // SelectRole unmounts on success, which also clears the fallback timer.
  const [navigatingRole, setNavigatingRole] = useState<RoleConfig | null>(null);

  const handleRoleClick = useCallback((role: RoleConfig) => {
    if (role.disabled || navigatingRole) return;

    // The tapped applet is now the ONLY download that matters: cancel every
    // prefetch not yet started so its chunks don't have to share a slow
    // mobile pipe with a dozen background downloads. (Measured under Fast-3G
    // throttle: with prefetches competing, tap-to-open took 11-17s; without,
    // the navigation gets the full link.)
    prefetchTimersRef.current.forEach(clearTimeout);
    prefetchTimersRef.current = [];

    setNavigatingRole(role);

    if (wasIdleRef.current) {
      window.location.href = role.path;
      return;
    }

    router.push(role.path);

    if (navFallbackRef.current) clearTimeout(navFallbackRef.current);
    navFallbackRef.current = setTimeout(() => {
      window.location.href = role.path;
    }, NAV_TIMEOUT_MS);
  }, [router, navigatingRole]);

  // Don't flash the grid while the single-applet redirect is in progress
  if (visibleRoles.length === 1 && !visibleRoles[0].disabled) {
    return null;
  }

  // SA has no applets assigned — show a clear error instead of all roles
  if (visibleRoles.length === 0) {
    return (
      <div className="select-role-container">
        <div className="select-role-bg-gradient" />
        <AppHeader onSwitchSA={onSwitchSA} />
        <main className="select-role-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '32px 24px', maxWidth: 320 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {t('role.noAppsTitle') || 'No apps available'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              {t('role.noAppsDescription') || 'This account has no apps assigned. Contact your administrator or switch to a different account.'}
            </p>
            {onSwitchSA && (
              <button
                className="btn btn-secondary"
                onClick={onSwitchSA}
                style={{ width: '100%' }}
              >
                {t('sa.switchAccount') || 'Switch Service Account'}
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      {/* Instant feedback while the tapped applet loads. Painted within one
          frame of the tap so even a slow first-launch navigation never looks
          frozen (the #1 rage-click trigger). */}
      {navigatingRole && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
            background: 'var(--bg-primary)',
          }}
        >
          <div className={`role-app-icon ${navigatingRole.icon.gradient}`}>
            {navigatingRole.icon.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={navigatingRole.icon.src}
                alt=""
                className="role-app-icon-img"
                draggable={false}
              />
            ) : (
              navigatingRole.icon.el
            )}
          </div>
          <span className="role-app-label" style={{ fontSize: 15 }}>
            {t(navigatingRole.labelKey)}
          </span>
          <div className="loading-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      )}

      {/* Unified app header with SA switching */}
      <AppHeader onSwitchSA={onSwitchSA} />

      <main className="select-role-main">
        <div className="role-selection">
          {/* Hero card */}
          <div className="role-hero-card">
            <div className="role-hero-card-bg" />
            <div className="role-hero-card-img">
              <Image
                src="/assets/optimized/Bikes Oves.png"
                alt="Electric Bikes"
                width={320}
                height={200}
                priority
              />
            </div>
            <div className="role-hero-card-content">
              <div className="role-hero-card-pill">
                <Zap size={10} />
                <span>E-Mobility</span>
              </div>
              <h1 className="role-title">{t('role.selectTitle')}</h1>
              {selectedSA && (
                <p className="role-description" style={{ marginTop: 4 }}>
                  <span style={{ opacity: 0.7 }}>{t('sa.activeAccount')}:</span>{' '}
                  <strong>{selectedSA.name}</strong>
                </p>
              )}
            </div>
          </div>

          {/* App grid */}
          <div className="role-grid">
            {visibleRoles.map((role, i) => (
              <div
                key={role.id}
                className={`role-app ${role.disabled ? 'disabled' : ''}`}
                onClick={() => handleRoleClick(role)}
                style={{ animationDelay: isReturn.current ? '0ms' : `${i * 30}ms` }}
              >
                <div className={`role-app-icon ${role.icon.gradient}`}>
                  {role.icon.type === 'image' ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={role.icon.src}
                        alt={t(role.labelKey)}
                        className="role-app-icon-img"
                        draggable={false}
                        fetchPriority="high"
                      />
                    </>
                  ) : (
                    role.icon.el
                  )}
                  {role.badgeKey && (
                    <span className="role-app-badge">{t(role.badgeKey)}</span>
                  )}
                </div>
                <span className="role-app-label">{t(role.labelKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
