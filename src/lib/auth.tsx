// app/lib/auth.ts
import { jwtDecode } from 'jwt-decode';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter, usePathname } from "next/navigation";
import { isOdooEmployeeLoggedIn, getActiveSAApplets } from './ov-auth';

interface DecodedToken {
  user_id: number;
  username: string | null;
  email: string;
  user_type: string;
  exp: number;
}

export const getDecodedToken = (): any | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    console.log(token, "Token---17----")
    if (token) {
      try {
        const decoded = jwtDecode<any>(token);
        if (decoded.exp * 1000 > Date.now()) {
          return decoded;
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }
  return null;
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token')
  }
  return null
}

export const isAuthenticated = (): boolean => {
  // Accept either ERM GraphQL token (legacy) or Odoo employee token (new unified flow)
  return getDecodedToken() !== null || isOdooEmployeeLoggedIn();
};

const PUBLIC_ROUTES = ["/keypad", "/signin", "/signup", "/rider", "/attendant", "/customers", "/activator", "/customer-management", "/orders", "/products"] as const;

export function isAuth(Component: any) {
  return function ProtectedPage(props: any) {
    /* `isAuthenticated()` returns true/false (⚠️ be sure to CALL the fn) */
    const loggedIn   = isAuthenticated();
    const pathname   = usePathname();
    const router     = useRouter();

    /** Is the current URL in our allow-list? */
    const isPublic = PUBLIC_ROUTES.some(p => pathname.startsWith(p));

    /** Client-side redirect for unauthenticated users on private pages */
    useEffect(() => {
      if (!loggedIn && !isPublic) {
        router.replace("/signin");
      }
    }, [loggedIn, isPublic, router]);

    /* Avoid flashing protected content while deciding */
    if (!loggedIn && !isPublic) return null;

    return <Component {...props} />;
  };
}

/**
 * Applet slug → sidebar menu IDs that belong to that applet.
 * Used to map SA applets (from login response) to the sidebar's canViewMenu checks.
 */
const APPLET_MENU_IDS: Record<string, string[]> = {
  assets: ['assets', 'bledevices', 'fleetview', 'devicelocator'],
  mydevices: ['mydevices', 'devices'],
  ota: ['ota', 'deviceota', 'upload'],
  keypad: ['keypad'],
  rider: ['rider', 'app', 'serviceplan1'],
  attendant: ['attendant'],
  customers: ['customers', 'myportfolio', 'payments'],
  'customer-management': ['customer-management'],
  orders: ['orders'],
  products: ['products'],
  activator: ['activator'],
  ticketing: ['ticketing', 'support'],
  location: ['location', 'routes'],
};

// Always-visible menu items regardless of applet config
const ALWAYS_VISIBLE_MENU_IDS = ['logout', 'divider-1', 'divider-2', 'divider-3', 'myaccount', 'resetpassword', 'settings'];

// Custom hook for menu visibility
export const useMenuVisibility = () => {
  // --- SA-based visibility (new unified flow) ---
  const saApplets = getActiveSAApplets();

  if (saApplets.length > 0) {
    // Build a flat set of allowed menu IDs from the SA's applet list
    const allowed = new Set<string>(ALWAYS_VISIBLE_MENU_IDS);
    saApplets.forEach(slug => {
      const ids = APPLET_MENU_IDS[slug] ?? [];
      ids.forEach(id => allowed.add(id));
    });

    const canViewMenu = (menuId: string): boolean => allowed.has(menuId);
    return { canViewMenu, userType: 'SA_USER' };
  }

  // --- Legacy role-based visibility (fallback) ---
  const decoded = getDecodedToken();
  const userType = decoded?.roleName?.replace(/\s/g, '_')?.toUpperCase() || 'CUSTOMER';

  const menuPermissions: Record<string, string[]> = {
    SUPER_ADMIN: [
      'dashboard', 'overview', 'overview1',
      'assets', 'bledevices', 'fleetview', 'devicelocator',
      'mydevices', 'devices',
      'keypad',
      'customers', 'myportfolio', 'payments',
      'team', 'members', 'chat',
      'ticketing', 'support',
      'company', 'request', 'updates',
      'myaccount', 'resetpassword',
      'settings',
      'debug', 'console', 'reportissue',
      'divider-1', 'divider-2', 'divider-3',
      'logout',
    ],
    DISTRIBUTOR: [
      'dashboard', 'overview', 'overview1',
      'assets', 'bledevices',
      'mydevices', 'devices',
      'ota', 'deviceota', 'upload',
      'keypad',
      'customers', 'myportfolio', 'payments',
      'ticketing', 'support',
      'team', 'members', 'chat',
      'company', 'request', 'updates',
      'myaccount', 'resetpassword',
      'settings',
      'debug', 'console', 'reportissue',
      'divider-1', 'divider-2', 'divider-3',
      'logout',
    ],
    GENERAL_AGENT: [
      'assets', 'bledevices',
      'keypad',
      'location', 'routes',
      'ticketing', 'support',
      'logout',
    ],
    CUSTOMER: [
      'keypad',
      'rider', 'app',
      'attendant',
    ],
  };

  const canViewMenu = (menuId: string): boolean =>
    menuPermissions[userType as keyof typeof menuPermissions]?.includes(menuId) || false;

  return { canViewMenu, userType };
};