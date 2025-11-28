// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';

type AppState = 'splash' | 'onboarding' | 'selectRole';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('splash');

  const hasSeenOnboarding = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  };

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const handleSplashComplete = useCallback(() => {
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
