'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
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
  /** Canonical applet slug from the login response. Roles without a slug are always shown. */
  appletSlug?: string;
  disabled?: boolean;
  badgeKey?: string;
  icon:
    | { type: 'image'; src: string; gradient: string }
    | { type: 'lucide'; el: React.ReactNode; gradient: string };
}

/**
 * Mapping from this component's role id → canonical SA applet slug.
 * Roles whose id is not in this map are always shown (no applet guard).
 */
const APPLET_SLUG_MAP: Record<string, string> = {
  customerManagement: 'customer-management',
  products: 'products',
  orders: 'orders',
  rider: 'rider',
  activator: 'activator',
  sales: 'customers',
  attendant: 'attendant',
  keypad: 'keypad',
  bleDeviceManager: 'assets',
  location: 'location',
  mydevices: 'mydevices',
  ota: 'ota',
  ticketing: 'ticketing',
};

const ALL_ROLES: RoleConfig[] = [
  // Row 1: Data & logistics
  {
    id: 'customerManagement',
    labelKey: 'role.customerManagement',
    icon: { type: 'image', src: '/assets/Customer.svg', gradient: 'role-grad-customer' },
    path: '/customer-management',
    appletSlug: 'customer-management',
  },
  {
    id: 'products',
    labelKey: 'role.products',
    icon: { type: 'image', src: '/assets/Products.svg', gradient: 'role-grad-products' },
    path: '/products',
    appletSlug: 'products',
  },
  {
    id: 'orders',
    labelKey: 'role.orders',
    icon: { type: 'image', src: '/assets/Orders.svg', gradient: 'role-grad-orders' },
    path: '/orders',
    appletSlug: 'orders',
  },
  {
    id: 'rider',
    labelKey: 'role.rider',
    icon: { type: 'image', src: '/assets/Rider.svg', gradient: 'role-grad-rider' },
    path: '/rider/app',
    appletSlug: 'rider',
  },
  // Row 2: Field operations
  {
    id: 'activator',
    labelKey: 'role.activator',
    icon: { type: 'image', src: '/assets/Activator.svg', gradient: 'role-grad-activator' },
    path: '/activator',
    appletSlug: 'activator',
  },
  {
    id: 'sales',
    labelKey: 'role.salesRep',
    icon: { type: 'image', src: '/assets/Salesperson.svg', gradient: 'role-grad-sales' },
    path: '/customers/customerform',
    appletSlug: 'customers',
  },
  {
    id: 'attendant',
    labelKey: 'role.attendant',
    icon: { type: 'image', src: '/assets/Attendant2.svg', gradient: 'role-grad-attendant' },
    path: '/attendant/attendant',
    appletSlug: 'attendant',
  },
  {
    id: 'keypad',
    labelKey: 'role.keypad',
    icon: { type: 'image', src: '/assets/Keypad2.svg', gradient: 'role-grad-keypad' },
    path: '/keypad/keypad',
    appletSlug: 'keypad',
  },
  // Row 3: Device tools
  {
    id: 'bleDeviceManager',
    labelKey: 'role.bleDeviceManager',
    icon: { type: 'image', src: '/assets/BleDeviceAttendant.svg', gradient: 'role-grad-ble' },
    path: '/assets/ble-devices',
    appletSlug: 'assets',
  },
];

const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
const NAV_TIMEOUT_MS = 3000;

export default function SelectRole({ onSwitchSA }: Props) {
  const router = useRouter();
  const { t } = useI18n();

  const hiddenAtRef = useRef<number | null>(null);
  const wasIdleRef = useRef(false);
  const navFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive which roles are visible for the current SA
  const visibleRoles = useMemo(() => {
    const saApplets = getActiveSAApplets();

    if (saApplets.length === 0) {
      console.info('[SelectRole] No SA applets found — showing all', ALL_ROLES.length, 'roles (graceful degradation)');
      return ALL_ROLES;
    }

    const filtered = ALL_ROLES.filter(role => {
      const slug = role.appletSlug ?? APPLET_SLUG_MAP[role.id];
      if (!slug) return true;
      return saApplets.includes(slug);
    });

    console.info('[SelectRole] SA applets:', saApplets);
    console.info('[SelectRole] Visible roles (' + filtered.length + '/' + ALL_ROLES.length + '):', filtered.map(r => r.id));
    return filtered;
  }, []);

  const selectedSA = useMemo(() => getSelectedSA(), []);

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

  useEffect(() => {
    for (const role of visibleRoles) {
      if (!role.disabled) {
        router.prefetch(role.path);
      }
    }
  }, [router, visibleRoles]);

  useEffect(() => {
    return () => {
      if (navFallbackRef.current) clearTimeout(navFallbackRef.current);
    };
  }, []);

  const handleRoleClick = useCallback((role: RoleConfig) => {
    if (role.disabled) return;

    if (wasIdleRef.current) {
      window.location.href = role.path;
      return;
    }

    router.push(role.path);

    if (navFallbackRef.current) clearTimeout(navFallbackRef.current);
    navFallbackRef.current = setTimeout(() => {
      window.location.href = role.path;
    }, NAV_TIMEOUT_MS);
  }, [router]);

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      {/* Unified app header with SA switching */}
      <AppHeader onSwitchSA={onSwitchSA} />

      <main className="select-role-main">
        <div className="role-selection">
          {/* Hero card */}
          <div className="role-hero-card">
            <div className="role-hero-card-bg" />
            <div className="role-hero-card-img">
              <Image
                src="/assets/Bikes Oves.png"
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
                style={{ animationDelay: `${i * 60}ms` }}
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
