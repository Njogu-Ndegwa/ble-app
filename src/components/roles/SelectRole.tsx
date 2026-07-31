'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Zap, BatteryCharging } from 'lucide-react';
import { useI18n } from '@/i18n';
import AppHeader from '@/components/AppHeader';
import { getActiveSAApplets, getSelectedSA, getSelectedSAId } from '@/lib/ov-auth';

interface Props {
  /** Called when the user wants to switch to a different SA (no re-login). */
  onSwitchSA?: () => void;
}

/** Catalog sections, rendered in this order. Labels: role.category.<id>. */
type RoleCategory = 'field' | 'rider' | 'devices' | 'mgmt' | 'support';
const CATEGORY_ORDER: RoleCategory[] = ['field', 'rider', 'devices', 'mgmt', 'support'];

interface RoleConfig {
  id: string;
  labelKey: string;
  path: string;
  category: RoleCategory;
  /**
   * Pinned into the "My Apps" row for users who haven't customized it yet.
   * Only applies when the SA actually grants the applet.
   */
  defaultPinned?: boolean;
  /**
   * Canonical applet slug(s) from the login response. A role is shown when the
   * SA's applet list contains ANY of the listed slugs. Roles without a slug are
   * always shown.
   */
  appletSlug?: string | string[];
  /**
   * When true, the role is only visible while the selected SA is the test
   * company (see TEST_COMPANY_SA_PATTERN) — used to trial unreleased applets
   * without granting a backend applet slug.
   */
  testCompanyOnly?: boolean;
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
  riderBasic: 'rider-basic',
  activator: 'activator',
  sales: 'customers',
  attendant: 'attendant',
  manualSwap: 'externalswap',
  topUpSwap: 'topupswap',
  keypad: 'keypad',
  // Both 'assets' and 'mydevices' grant access to the Device Manager tile.
  bleDeviceManager: ['assets', 'mydevices'],
  // Fleet/asset management — same slug the desktop portal maps to its
  // Fleets applet, so one SA grant lights up both surfaces.
  fleets: 'assets',
  // Assembly Cell (Build Records on MOs) — mirrors the desktop portal.
  assembly: 'assembly-cell',
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

/**
 * SAs whose name matches this pattern are treated as the test company.
 * Roles flagged `testCompanyOnly` surface only for these SAs, so unreleased
 * MVP applets can be trialed in production builds without a backend change.
 */
const TEST_COMPANY_SA_PATTERN = /test/i;

const ALL_ROLES: RoleConfig[] = [
  {
    id: 'customerManagement',
    labelKey: 'role.customerManagement',
    icon: { type: 'image', src: '/assets/optimized/Customer.png', gradient: 'role-grad-customer' },
    path: '/customer-management',
    appletSlug: 'customer-management',
    category: 'mgmt',
  },
  {
    id: 'products',
    labelKey: 'role.products',
    icon: { type: 'image', src: '/assets/optimized/Products.png', gradient: 'role-grad-products' },
    path: '/products',
    appletSlug: 'products',
    category: 'mgmt',
  },
  {
    id: 'orders',
    labelKey: 'role.orders',
    icon: { type: 'image', src: '/assets/optimized/Orders.png', gradient: 'role-grad-orders' },
    path: '/orders',
    appletSlug: 'orders',
    category: 'mgmt',
  },
  {
    id: 'rider',
    labelKey: 'role.rider',
    icon: { type: 'image', src: '/assets/optimized/Rider.png', gradient: 'role-grad-rider' },
    path: '/rider/app',
    appletSlug: 'rider',
    category: 'rider',
    defaultPinned: true,
  },
  {
    // Rider without the self-service energy Top-Up button — same applet,
    // separate slug so SAs that use the standalone Energy Top-Up applet can
    // grant it independently of the full rider experience.
    id: 'riderBasic',
    labelKey: 'role.riderBasic',
    icon: { type: 'image', src: '/assets/optimized/Rider.png', gradient: 'role-grad-rider' },
    path: '/rider-basic/app',
    appletSlug: 'rider-basic',
    category: 'rider',
    defaultPinned: true,
  },
  {
    id: 'activator',
    labelKey: 'role.activator',
    icon: { type: 'image', src: '/assets/optimized/Activator.png', gradient: 'role-grad-activator' },
    path: '/activator',
    appletSlug: 'activator',
    category: 'field',
  },
  {
    id: 'sales',
    labelKey: 'role.salesRep',
    icon: { type: 'image', src: '/assets/optimized/Salesperson.png', gradient: 'role-grad-sales' },
    path: '/customers/customerform',
    appletSlug: 'customers',
    category: 'field',
    defaultPinned: true,
  },
  {
    id: 'attendant',
    labelKey: 'role.attendant',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/attendant',
    appletSlug: 'attendant',
    category: 'field',
    defaultPinned: true,
  },
  {
    id: 'manualSwap',
    labelKey: 'role.manualSwap',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/manual-swap',
    appletSlug: 'externalswap',
    category: 'field',
  },
  {
    id: 'topUpSwap',
    labelKey: 'role.topUpSwap',
    icon: { type: 'image', src: '/assets/optimized/Attendant2.png', gradient: 'role-grad-attendant' },
    path: '/attendant/topup-swap',
    appletSlug: 'topupswap',
    category: 'field',
  },
  {
    id: 'keypad',
    labelKey: 'role.keypad',
    icon: { type: 'image', src: '/assets/optimized/Keypad2.png', gradient: 'role-grad-keypad' },
    path: '/keypad/keypad',
    appletSlug: 'keypad',
    category: 'devices',
  },
  {
    id: 'bleDeviceManager',
    labelKey: 'role.bleDeviceManager',
    icon: { type: 'image', src: '/assets/optimized/BleDeviceAttendant.png', gradient: 'role-grad-ble' },
    path: '/assets/ble-devices',
    // Visible when the SA has either 'assets' OR 'mydevices' in its applet list.
    appletSlug: ['assets', 'mydevices'],
    category: 'devices',
    defaultPinned: true,
  },
  {
    id: 'fleets',
    labelKey: 'role.fleets',
    icon: { type: 'image', src: '/assets/optimized/Fleets.png', gradient: 'role-grad-customer' },
    path: '/fleets',
    // Same slug as the desktop portal's Fleets applet. The BLE Device
    // Manager tile also matches 'assets', so SAs with that grant see both.
    appletSlug: 'assets',
    category: 'mgmt',
  },
  {
    id: 'assembly',
    labelKey: 'role.assembly',
    icon: { type: 'image', src: '/assets/optimized/Assembly.png', gradient: 'role-grad-orders' },
    path: '/assembly',
    appletSlug: 'assembly-cell',
    category: 'mgmt',
  },
  {
    id: 'charger',
    labelKey: 'role.charger',
    icon: { type: 'lucide', el: <BatteryCharging size={28} color="#fff" />, gradient: 'role-grad-keypad' },
    path: '/charger',
    // MVP under evaluation — only visible in the test company SA.
    testCompanyOnly: true,
    category: 'devices',
  },
  {
    id: 'rollup',
    labelKey: 'role.rollup',
    icon: { type: 'image', src: '/assets/optimized/Rollup.png', gradient: 'role-grad-rollup' },
    path: '/rollup',
    appletSlug: 'rollup',
    category: 'mgmt',
  },
  {
    id: 'ticketing',
    labelKey: 'role.ticketing',
    icon: { type: 'image', src: '/assets/optimized/Ticketing.png', gradient: 'role-grad-ticketing' },
    path: '/ticketing/app',
    appletSlug: 'ticketing',
    category: 'support',
    defaultPinned: true,
  },
  {
    id: 'support',
    labelKey: 'role.support',
    icon: { type: 'image', src: '/assets/optimized/Support.png', gradient: 'role-grad-support' },
    path: '/support/app',
    appletSlug: 'ticketing-customer',
    category: 'support',
  },
  {
    id: 'topup',
    labelKey: 'role.topup',
    icon: { type: 'image', src: '/assets/optimized/TopUp.png', gradient: 'role-grad-activator' },
    path: '/topup',
    // Shown only when the SA grants the `energytopup` slug.
    appletSlug: 'energytopup',
    category: 'field',
    defaultPinned: true,
  },
];

// "My Apps" pins — ordered role ids, persisted per service account (same
// per-SA namespacing as the `ov_sa_applets_<id>` applet cache). The stored
// list is only the user's customization; defaults come from `defaultPinned`.
const FAVS_KEY_PREFIX = 'ov_launcher_favs_';
const MAX_PINS = 8;

function favsKey(): string {
  const saId = getSelectedSAId();
  return `${FAVS_KEY_PREFIX}${saId ?? 'default'}`;
}

/**
 * Load the pinned role ids for the active SA, dropping any that the SA no
 * longer grants (revoked applets silently fall out of My Apps). Falls back to
 * the registry's `defaultPinned` roles when the user has never customized.
 */
function loadPins(visibleRoles: RoleConfig[]): string[] {
  const visibleIds = new Set(visibleRoles.map(r => r.id));
  try {
    const raw = localStorage.getItem(favsKey());
    if (raw) {
      const ids: unknown = JSON.parse(raw);
      if (Array.isArray(ids)) {
        return ids.filter((id): id is string => typeof id === 'string' && visibleIds.has(id));
      }
    }
  } catch { /* corrupted or unavailable storage → defaults */ }
  return visibleRoles
    .filter(r => r.defaultPinned && !r.disabled)
    .slice(0, MAX_PINS)
    .map(r => r.id);
}

function savePins(ids: string[]) {
  try {
    localStorage.setItem(favsKey(), JSON.stringify(ids));
  } catch { /* storage full/unavailable — pins just won't persist */ }
}

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
    const isTestCompany = TEST_COMPANY_SA_PATTERN.test(getSelectedSA()?.name ?? '');

    if (saApplets.length === 0 && !isTestCompany) {
      return [] as RoleConfig[];
    }

    const filtered = ALL_ROLES.filter(role => {
      // Test-company-only roles bypass the applet-slug check entirely: they
      // are shown for the test company SA and hidden everywhere else.
      if (role.testCompanyOnly) return isTestCompany;
      const slug = role.appletSlug ?? APPLET_SLUG_MAP[role.id];
      if (!slug) return true;
      const slugs = Array.isArray(slug) ? slug : [slug];
      return slugs.some(s => saApplets.includes(s));
    });

    return filtered;
  }, []);

  const selectedSA = useMemo(() => getSelectedSA(), []);

  // ----- My Apps (pinned) + catalog sections -----
  const [pins, setPins] = useState<string[]>(() => loadPins(visibleRoles));
  // Latest pins for event handlers that outlive a render (drag end).
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Role id being drag-reordered within My Apps (edit mode only).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const pinnedRoles = useMemo(
    () => pins
      .map(id => visibleRoles.find(r => r.id === id))
      .filter((r): r is RoleConfig => !!r),
    [pins, visibleRoles],
  );

  const sections = useMemo(
    () => CATEGORY_ORDER
      .map(category => ({ category, roles: visibleRoles.filter(r => r.category === category) }))
      .filter(s => s.roles.length > 0),
    [visibleRoles],
  );

  const pinnedSet = useMemo(() => new Set(pins), [pins]);

  const pinRole = useCallback((id: string) => {
    if (pins.includes(id)) return;
    if (pins.length >= MAX_PINS) {
      showToast(t('role.myAppsFull') || `My Apps is full (max ${MAX_PINS})`);
      return;
    }
    const next = [...pins, id];
    savePins(next);
    setPins(next);
  }, [pins, showToast, t]);

  const unpinRole = useCallback((id: string) => {
    const next = pins.filter(x => x !== id);
    savePins(next);
    setPins(next);
  }, [pins]);

  // Pointer-based reorder within My Apps. Deliberately NOT the HTML5 drag API
  // (unusable in the Android WebView); a ghost follows the pointer and the
  // array live-reorders via elementFromPoint hit-testing on the other tiles.
  const handlePinPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (!editing) return;
    // The − badge handles its own tap; don't turn it into a drag.
    if ((e.target as HTMLElement).closest('.role-pin-badge')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 6) return;
        started = true;
        setDraggingId(id);
      }
      setGhostPos({ x: ev.clientX, y: ev.clientY });
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const overId = (under?.closest?.('[data-pin-id]') as HTMLElement | null)?.dataset.pinId;
      if (overId && overId !== id) {
        setPins(prev => {
          const from = prev.indexOf(id);
          const to = prev.indexOf(overId);
          if (from < 0 || to < 0 || from === to) return prev;
          const next = [...prev];
          next.splice(from, 1);
          next.splice(to, 0, id);
          return next;
        });
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      setDraggingId(null);
      setGhostPos(null);
      if (started) savePins(pinsRef.current);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [editing]);

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
    if (role.disabled || navigatingRole || editing) return;

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
  }, [router, navigatingRole, editing]);

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

          {/* My Apps — user-pinned shortcuts, edited via the Edit toggle */}
          <div className="role-section-head">
            <span className="role-section-title">
              {t('role.myApps') || 'My Apps'}
              {editing && <span className="role-section-count"> {pins.length}/{MAX_PINS}</span>}
            </span>
            <button
              type="button"
              className={`role-edit-btn ${editing ? 'active' : ''}`}
              onClick={() => setEditing(e => !e)}
            >
              {editing ? (t('role.editDone') || 'Done') : (t('role.edit') || 'Edit')}
            </button>
          </div>
          <div className={`role-fav-zone ${editing ? 'editing' : ''}`}>
            {pinnedRoles.length > 0 ? (
              <div className="role-grid">
                {pinnedRoles.map((role, i) => renderTile(role, i, 'pins'))}
              </div>
            ) : (
              <p className="role-fav-empty">
                {editing
                  ? (t('role.myAppsEmptyHint') || 'Tap + on any app below to pin it here')
                  : (t('role.myAppsEmpty') || 'No pinned apps — tap Edit to add your favorites')}
              </p>
            )}
          </div>

          {/* Full catalog, grouped by company-defined category. Pinning never
              removes an app from here — My Apps is a shortcut row, not a move. */}
          {sections.map(({ category, roles }) => (
            <div key={category}>
              <div className="role-section-head">
                <span className="role-section-title">{t(`role.category.${category}`) || category}</span>
              </div>
              <div className="role-grid">
                {roles.map((role, i) => renderTile(role, pinnedRoles.length + i, 'catalog'))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Drag ghost following the pointer while reordering My Apps */}
      {draggingId && ghostPos && (() => {
        const role = visibleRoles.find(r => r.id === draggingId);
        if (!role) return null;
        return (
          <div className="role-drag-ghost" style={{ left: ghostPos.x, top: ghostPos.y }}>
            <div className={`role-app-icon ${role.icon.gradient}`}>
              {role.icon.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={role.icon.src} alt="" className="role-app-icon-img" draggable={false} />
              ) : (
                role.icon.el
              )}
            </div>
          </div>
        );
      })()}

      {toast && <div className="role-toast">{toast}</div>}
    </div>
  );

  function renderTile(role: RoleConfig, index: number, zone: 'pins' | 'catalog') {
    const isPinned = pinnedSet.has(role.id);
    const canPin = zone === 'catalog' && editing && !isPinned && !role.disabled;
    const dimmed = zone === 'catalog' && editing && isPinned;
    return (
      <div
        key={role.id}
        className={[
          'role-app',
          role.disabled ? 'disabled' : '',
          dimmed ? 'pinned-dim' : '',
          zone === 'pins' && draggingId === role.id ? 'dragging' : '',
          zone === 'pins' && editing ? 'pin-editing' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => (canPin ? pinRole(role.id) : handleRoleClick(role))}
        onPointerDown={zone === 'pins' ? (e) => handlePinPointerDown(e, role.id) : undefined}
        data-pin-id={zone === 'pins' ? role.id : undefined}
        style={{ animationDelay: isReturn.current ? '0ms' : `${index * 30}ms` }}
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
        {editing && zone === 'pins' && (
          <button
            type="button"
            className="role-pin-badge minus"
            aria-label={t('role.unpin') || 'Unpin'}
            onClick={(e) => { e.stopPropagation(); unpinRole(role.id); }}
          >
            −
          </button>
        )}
        {canPin && (
          <button
            type="button"
            className="role-pin-badge plus"
            aria-label={t('role.pin') || 'Pin to My Apps'}
            onClick={(e) => { e.stopPropagation(); pinRole(role.id); }}
          >
            +
          </button>
        )}
        <span className="role-app-label">{t(role.labelKey)}</span>
      </div>
    );
  }
}
