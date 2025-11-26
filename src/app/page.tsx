// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';

type AppState = 'splash' | 'onboarding';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';

export default function Index() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>('splash');

  const hasSeenOnboarding = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  };

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const goToNextPage = useCallback(() => {
    router.replace('/keypad/keypad');
  }, [router]);

  const handleSplashComplete = useCallback(() => {
    if (hasSeenOnboarding()) {
      goToNextPage();
    } else {
      setAppState('onboarding');
    }
  }, [goToNextPage]);

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
    goToNextPage();
  }, [goToNextPage]);

  if (appState === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'onboarding') {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  return null;
}
