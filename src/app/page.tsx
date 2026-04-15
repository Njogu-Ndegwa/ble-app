// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';
import { parseMicrosoftCallback, consumeMicrosoftPendingContext } from '@/lib/attendant-auth';

type AppState = 'initializing' | 'splash' | 'onboarding' | 'selectRole' | 'microsoftCallback';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';
const SPLASH_SHOWN_KEY = 'oves-splash-shown';

export default function Index() {
  const router = useRouter();

  // Start as 'initializing' — all browser-dependent detection happens in useEffect
  const [appState, setAppState] = useState<AppState>('initializing');

  // Runs once on the client after mount — determines real state
  useEffect(() => {
    // 1. Check for Microsoft OAuth callback tokens in URL query string
    const params = new URLSearchParams(window.location.search);
    const hasTokenParams = !!(params.get('token') && params.get('employee_id'));

    // 2. Check for the pending context we saved before redirecting to Odoo
    const pendingContext = consumeMicrosoftPendingContext();

    if (hasTokenParams) {
      // Tokens in URL — parse, save session, redirect to the app
      const userType = pendingContext?.userType ?? 'sales';
      const returnPath = pendingContext?.returnPath ?? '/attendant/attendant';

      const result = parseMicrosoftCallback(params, userType);
      window.history.replaceState({}, '', '/');

      if (result.success) {
        console.log('[MicrosoftCallback] Login successful, redirecting to', returnPath);
      } else {
        console.error('[MicrosoftCallback]', result.error);
      }
      router.replace(returnPath);
      return;
    }

    if (pendingContext) {
      // No tokens in URL but we know user just came back from Microsoft
      // (flag was saved before leaving). Redirect to the original page.
      const returnPath = pendingContext.returnPath ?? '/attendant/attendant';
      console.log('[MicrosoftCallback] No token params, redirecting to', returnPath);
      window.history.replaceState({}, '', '/');
      router.replace(returnPath);
      return;
    }

    // 3. Normal app launch — determine splash / onboarding / selectRole
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true') {
      setAppState('selectRole');
    } else {
      setAppState('splash');
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
      setAppState('selectRole');
    } else {
      setAppState('onboarding');
    }
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
    setAppState('selectRole');
  }, []);

  // Show a brief loading screen while determining state (SSR + first client frame)
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

  if (appState === 'selectRole') {
    return <SelectRole />;
  }

  return null;
}
