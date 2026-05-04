// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';
import SelectSA from '@/components/roles/SelectSA';
import PublicLanding from '@/components/roles/PublicLanding';
import { parseMicrosoftCallback, consumeMicrosoftPendingContext } from '@/lib/attendant-auth';
import { isOdooEmployeeLoggedIn, getSelectedSAId, getStoredServiceAccounts, selectServiceAccount, saveOdooEmployeeSession, saveOdooEmployeeSessionFromMicrosoft } from '@/lib/ov-auth';
import type { OdooEmployeeSession } from '@/lib/sa-types';

type AppState =
  | 'initializing'
  | 'splash'
  | 'onboarding'
  | 'landing'      // unauthenticated: keypad public app + Sign In CTA
  | 'selectSA'     // authenticated but no SA chosen yet
  | 'selectRole'   // authenticated + SA selected: shows SA-filtered applet grid
  | 'microsoftCallback';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';
const SPLASH_SHOWN_KEY = 'oves-splash-shown';

export default function Index() {
  const router = useRouter();

  const [appState, setAppState] = useState<AppState>('initializing');

  useEffect(() => {
    console.info('[RootPage] useEffect fired. Full URL:', window.location.href);

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

    const employeeNameVal = params.get('employee_name');
    const employeeEmailVal = params.get('employee_email');
    const hasTokenParams = !!(tokenVal && employeeIdVal);

    // RAW token dump — remove before production
    if (hasTokenParams) {
      console.log('[MSCallback] ===== RAW CALLBACK PARAMS =====');
      console.log('[MSCallback] token:', tokenVal);
      console.log('[MSCallback] employee_id:', employeeIdVal);
      console.log('[MSCallback] employee_name:', employeeNameVal);
      console.log('[MSCallback] employee_email:', employeeEmailVal);
      const sessionDataRaw = params.get('session_data');
      console.log('[MSCallback] session_data (raw base64):', sessionDataRaw);
      if (sessionDataRaw) {
        try {
          console.log('[MSCallback] session_data (decoded):', JSON.parse(atob(sessionDataRaw)));
        } catch {
          console.log('[MSCallback] session_data decode failed');
        }
      }
      console.log('[MSCallback] all params:', Object.fromEntries(params.entries()));
      console.log('[MSCallback] ===================================');
    }

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
        console.info('[RootPage] Microsoft SSO callback SUCCESS');
        console.info('[RootPage] employee:', result.user.name, '| id:', result.user.employeeId, '| email:', result.user.email);
        console.info('[RootPage] token (first 40):', result.user.accessToken?.slice(0, 40));

        // The callback URL includes a `session_data` param: a base64-encoded JSON blob
        // that contains the full OdooEmployeeSession (token, employee, service_accounts,
        // applets, auto_selected). Using it is equivalent to a normal email login response.
        const sessionDataParam = params.get('session_data');
        if (sessionDataParam) {
          try {
            const decoded = atob(sessionDataParam);
            const sessionData = JSON.parse(decoded) as OdooEmployeeSession;
            console.info('[RootPage] session_data decoded — SAs:', sessionData.service_accounts?.length, '| auto_selected:', sessionData.auto_selected);
            sessionData.service_accounts?.forEach(sa => {
              console.info(`[RootPage]   SA #${sa.id} "${sa.name}" applets: [${sa.applets?.join(', ')}]`);
            });
            console.info('[RootPage] Full session_data:', JSON.stringify(sessionData, null, 2));
            saveOdooEmployeeSession(sessionData);
          } catch (e) {
            console.warn('[RootPage] Failed to decode session_data — falling back to basic token save:', e);
            saveOdooEmployeeSessionFromMicrosoft(result.user);
          }
        } else {
          console.info('[RootPage] No session_data param in callback — using basic token save');
          saveOdooEmployeeSessionFromMicrosoft(result.user);
        }

        resolveAuthState();
      } else {
        console.info('[RootPage] Microsoft SSO callback FAILED:', result.error);
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

  /** Determine which authenticated state to show after splash/onboarding. */
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
      if (accounts.length === 1) {
        console.info('[RootPage] resolveAuthState: single SA found — auto-selecting SA #', accounts[0].id);
        selectServiceAccount(accounts[0]);
        setAppState('selectRole');
      } else {
        setAppState('selectSA');
      }
    } else {
      setAppState('selectRole');
    }
  }, [router]);

  const hasSeenOnboarding = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  };

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    if (hasSeenOnboarding()) {
      resolveAuthState();
    } else {
      setAppState('onboarding');
    }
  }, [resolveAuthState]);

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
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

  if (appState === 'onboarding') {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
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
