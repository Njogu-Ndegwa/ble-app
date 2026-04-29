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
import { isOdooEmployeeLoggedIn, getSelectedSAId, saveOdooEmployeeSessionFromMicrosoft } from '@/lib/ov-auth';

type AppState =
  | 'initializing'
  | 'splash'
  | 'onboarding'
  | 'landing'      // unauthenticated: shows public keypad + Sign In CTA
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

    // 2. Check for pending Microsoft context saved before redirect
    const pendingContext = consumeMicrosoftPendingContext();

    if (hasTokenParams) {
      const htmlSplash = document.getElementById('html-splash');
      if (htmlSplash) htmlSplash.style.display = 'none';
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');

      const userType = pendingContext?.userType ?? 'sales';
      const returnPath = pendingContext?.returnPath ?? '/';

      const result = parseMicrosoftCallback(params, userType);
      window.history.replaceState({}, '', '/');

      if (result.success) {
        console.info('[RootPage] Microsoft login SUCCESS → redirecting to', returnPath);
        // Bridge into unified ov-auth so the new SA flow recognises this session
        saveOdooEmployeeSessionFromMicrosoft(result.user);
      } else {
        console.info('[RootPage] Microsoft login FAILED:', result.error);
      }
      router.replace(returnPath);
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
      // Not logged in → go straight to the sign-in page.
      // Keypad is available as a "skip" option from there.
      router.replace('/signin');
      return;
    }
    const saId = getSelectedSAId();
    if (saId === null) {
      setAppState('selectSA');
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
        onSelected={() => setAppState('selectRole')}
        onSwitchAccount={() => {
          router.push('/signin');
        }}
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
