// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';
import { parseMicrosoftCallback, consumeMicrosoftPendingContext } from '@/lib/attendant-auth';

type AppState = 'splash' | 'onboarding' | 'selectRole' | 'microsoftCallback';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';
const SPLASH_SHOWN_KEY = 'oves-splash-shown';

/**
 * Detect whether this page load is a Microsoft OAuth return.
 * Checks URL query params, hash fragment, AND the localStorage pending flag.
 */
function detectMicrosoftReturn(): {
  hasTokenParams: boolean;
  pendingContext: ReturnType<typeof consumeMicrosoftPendingContext>;
} {
  if (typeof window === 'undefined') return { hasTokenParams: false, pendingContext: null };

  const params = new URLSearchParams(window.location.search);
  let hasTokenParams = !!(params.get('token') && params.get('employee_id'));

  // Also check hash fragment (Odoo may redirect with tokens in the hash)
  if (!hasTokenParams && window.location.hash) {
    const hashStr = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashStr);
    hasTokenParams = !!(hashParams.get('token') && hashParams.get('employee_id'));
  }

  const pendingContext = consumeMicrosoftPendingContext();
  return { hasTokenParams, pendingContext };
}

export default function Index() {
  const router = useRouter();

  const [msReturn] = useState(() => detectMicrosoftReturn());

  const getInitialState = (): AppState => {
    if (typeof window === 'undefined') return 'splash';

    // Microsoft callback: either we have token params, or we have a pending context flag
    if (msReturn.hasTokenParams || msReturn.pendingContext) {
      return 'microsoftCallback';
    }

    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true') {
      return 'selectRole';
    }

    return 'splash';
  };

  const [appState, setAppState] = useState<AppState>(getInitialState);

  useEffect(() => {
    if (appState !== 'microsoftCallback') return;

    const userType = msReturn.pendingContext?.userType ?? 'sales';
    const returnPath = msReturn.pendingContext?.returnPath ?? '/attendant/attendant';

    if (msReturn.hasTokenParams) {
      // Odoo appended token params — parse and save the session
      const params = new URLSearchParams(window.location.search);
      const result = parseMicrosoftCallback(params, userType);

      window.history.replaceState({}, '', '/');

      if (result.success) {
        console.log('[MicrosoftCallback] Login successful, redirecting to', returnPath);
        router.replace(returnPath);
      } else {
        console.error('[MicrosoftCallback]', result.error);
        // Tokens were present but invalid — redirect to the login page
        // so user can retry, rather than showing splash/onboarding
        router.replace(returnPath);
      }
    } else {
      // No token params in URL, but we know this IS a Microsoft redirect
      // (the pending context flag was set before leaving).
      // Odoo may have set a session cookie instead of URL params.
      // Redirect the user back to where they started so they can proceed.
      console.log('[MicrosoftCallback] No token params in URL, redirecting to', returnPath);
      window.history.replaceState({}, '', '/');
      router.replace(returnPath);
    }
  }, [appState, router, msReturn]);

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

  if (appState === 'microsoftCallback') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted, #888)' }}>Signing in with Microsoft…</p>
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
