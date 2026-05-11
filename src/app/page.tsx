// app/page.tsx
'use client';

import { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import SelectRole from '@/components/roles/SelectRole';
import SelectSA from '@/components/roles/SelectSA';
import PublicLanding from '@/components/roles/PublicLanding';
import { parseMicrosoftCallback, consumeMicrosoftPendingContext } from '@/lib/attendant-auth';
import { isOdooEmployeeLoggedIn, getSelectedSAId, getStoredServiceAccounts, selectServiceAccount, saveOdooEmployeeSession, saveOdooEmployeeSessionFromMicrosoft } from '@/lib/ov-auth';
import type { OdooEmployeeSession } from '@/lib/sa-types';

type AppState =
  | 'initializing'
  | 'splash'
  | 'landing'      // unauthenticated: keypad public app + Sign In CTA
  | 'selectSA'     // authenticated but no SA chosen yet
  | 'selectRole'   // authenticated + SA selected: shows SA-filtered applet grid
  | 'microsoftCallback';

const SPLASH_SHOWN_KEY = 'oves-splash-shown';

/**
 * Compute the initial AppState synchronously so the very first paint already
 * shows the right screen on return visits instead of flashing the spinner.
 *
 * Rules (evaluated in order):
 *  1. Microsoft OAuth callback in URL → must go through the full async effect.
 *  2. Splash not yet shown this session → show SplashScreen.
 *  3. Splash already shown + logged in + SA selected → go straight to SelectRole.
 *  4. Splash already shown + logged in + single SA (will auto-select) → SelectRole.
 *  5. Splash already shown + logged in + multiple/no SAs → SelectSA.
 *  6. Splash already shown + not logged in → 'initializing' (effect redirects to /signin).
 */
function getInitialAppState(): AppState {
  if (typeof window === 'undefined') return 'initializing';

  // Microsoft callback carries a `token=` param in search or hash
  if (
    window.location.search.includes('token=') ||
    window.location.hash.includes('token=')
  ) {
    return 'initializing';
  }

  try {
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) !== 'true') return 'splash';
  } catch {
    return 'splash';
  }

  // Splash already shown — resolve from localStorage (all synchronous)
  if (!isOdooEmployeeLoggedIn()) return 'initializing'; // effect redirects to /signin

  const saId = getSelectedSAId();
  if (saId !== null) return 'selectRole';

  const accounts = getStoredServiceAccounts();
  // Single SA will be auto-selected by the effect; show selectRole immediately
  if (accounts.length === 1 && accounts[0].id != null) return 'selectRole';

  return 'selectSA';
}

export default function Index() {
  const router = useRouter();

  // Always start with 'initializing' so server HTML and client hydration tree
  // are identical (both render the loading spinner). useLayoutEffect then
  // immediately snaps to the real state before the browser paints, so the
  // user never sees a flash and React never logs a hydration mismatch.
  const [appState, setAppState] = useState<AppState>('initializing');
  useLayoutEffect(() => {
    setAppState(getInitialAppState());
  }, []);

  useEffect(() => {
    // 1. Check for Microsoft OAuth callback tokens in URL query string OR hash fragment
    let params = new URLSearchParams(window.location.search);
    let tokenVal = params.get('token');
    let employeeIdVal = params.get('employee_id');

    if (!tokenVal && window.location.hash) {
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);
      if (hashParams.get('token')) {
        params = hashParams;
        tokenVal = hashParams.get('token');
        employeeIdVal = hashParams.get('employee_id');
      }
    }

    const hasTokenParams = !!(tokenVal && employeeIdVal);

    // 2. Check for pending Microsoft context saved before redirect
    const pendingContext = consumeMicrosoftPendingContext();

    if (hasTokenParams) {
      const htmlSplash = document.getElementById('html-splash');
      if (htmlSplash) htmlSplash.style.display = 'none';
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');

      const userType = pendingContext?.userType ?? 'sales';

      const result = parseMicrosoftCallback(params, userType);
      // Clean the URL without triggering a navigation (avoids router.replace not
      // re-firing useEffect since router is a stable reference)
      window.history.replaceState({}, '', '/');

      if (result.success) {
        const sessionDataParam = params.get('session_data');
        if (sessionDataParam) {
          try {
            const sessionData = JSON.parse(atob(sessionDataParam)) as OdooEmployeeSession;
            saveOdooEmployeeSession(sessionData);
          } catch {
            saveOdooEmployeeSessionFromMicrosoft(result.user);
          }
        } else {
          saveOdooEmployeeSessionFromMicrosoft(result.user);
        }

        resolveAuthState();
      } else {
        console.warn('[RootPage] Microsoft SSO callback failed:', result.error);
        router.replace('/signin');
      }
      return;
    }

    if (pendingContext) {
      const htmlSplash = document.getElementById('html-splash');
      if (htmlSplash) htmlSplash.style.display = 'none';
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');

      const returnPath = pendingContext.returnPath ?? '/';
      window.history.replaceState({}, '', '/');
      router.replace(returnPath);
      return;
    }

    // 3. Normal app launch
    const splashShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);

    if (splashShown === 'true') {
      resolveAuthState();
    } else {
      setAppState('splash');
    }
  }, [router]);

  /** Determine which authenticated state to show after splash. */
  const resolveAuthState = useCallback(() => {
    if (!isOdooEmployeeLoggedIn()) {
      router.replace('/signin');
      return;
    }
    const saId = getSelectedSAId();
    if (saId === null) {
      // Auto-select if the user has exactly one SA (e.g. resumed session after
      // page refresh where selectServiceAccount wasn't called again yet).
      const accounts = getStoredServiceAccounts();
      const validSingle = accounts.length === 1 && accounts[0].id != null;
      if (validSingle) {
        selectServiceAccount(accounts[0]);
        setAppState('selectRole');
      } else {
        setAppState('selectSA');
      }
    } else {
      setAppState('selectRole');
    }
  }, [router]);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    resolveAuthState();
  }, [resolveAuthState]);

  // Stable callbacks for SelectSA so its useEffect dependency stays quiet
  const handleSASelected = useCallback(() => setAppState('selectRole'), []);
  const handleSASwitch = useCallback(() => router.push('/signin'), [router]);

  // ── Renders ────────────────────────────────────────────────────────────────

  if (appState === 'initializing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  if (appState === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'landing') {
    return (
      <PublicLanding
        onSignIn={() => router.push('/signin')}
      />
    );
  }

  if (appState === 'selectSA') {
    return (
      <SelectSA
        onSelected={handleSASelected}
        onSwitchAccount={handleSASwitch}
      />
    );
  }

  if (appState === 'selectRole') {
    return (
      <SelectRole
        onSwitchSA={() => setAppState('selectSA')}
      />
    );
  }

  return null;
}
