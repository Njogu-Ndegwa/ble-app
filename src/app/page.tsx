// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';
import { parseMicrosoftCallback } from '@/lib/attendant-auth';

type AppState = 'splash' | 'onboarding' | 'selectRole' | 'microsoftCallback';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';
const SPLASH_SHOWN_KEY = 'oves-splash-shown';

export default function Index() {
  const router = useRouter();

  const getInitialState = (): AppState => {
    if (typeof window === 'undefined') return 'splash';

    const params = new URLSearchParams(window.location.search);
    if (params.get('token') && params.get('employee_id')) {
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

    const params = new URLSearchParams(window.location.search);
    const result = parseMicrosoftCallback(params, 'sales');

    // Clean the URL so token doesn't linger in the address bar
    window.history.replaceState({}, '', '/');

    if (result.success) {
      router.replace('/attendant/attendant');
    } else {
      console.error('[MicrosoftCallback]', result.error);
      setAppState('selectRole');
    }
  }, [appState, router]);

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
