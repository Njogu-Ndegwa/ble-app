// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import SplashScreen from '@/components/splash/SplashScreen';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import SelectRole from '@/components/roles/SelectRole';
import { useBridge } from '@/app/context/bridgeContext';

type AppState = 'splash' | 'onboarding' | 'selectRole';

const ONBOARDING_STORAGE_KEY = 'oves-onboarding-seen';

export default function Index() {
  const { isBridgeReady, isMqttConnected } = useBridge();
  
  // Determine initial state: skip splash if bridge/MQTT are already connected
  // (e.g., when returning from a role via "Change Role" button)
  const getInitialState = (): AppState => {
    if (isBridgeReady && isMqttConnected) {
      // Already connected - skip splash, go directly to appropriate screen
      if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') {
        return 'selectRole';
      }
      return 'onboarding';
    }
    return 'splash';
  };

  const [appState, setAppState] = useState<AppState>(getInitialState);

  // Update state if bridge/MQTT become ready while still on splash
  // This handles the case where initial render had them as false but they're quickly ready
  useEffect(() => {
    if (appState === 'splash' && isBridgeReady && isMqttConnected) {
      // Connections ready - skip remaining splash time
      if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') {
        setAppState('selectRole');
      } else {
        setAppState('onboarding');
      }
    }
  }, [appState, isBridgeReady, isMqttConnected]);

  // If user is on selectRole but bridge becomes disconnected, go back to splash
  // This ensures the app doesn't operate without a working bridge connection
  useEffect(() => {
    if (appState === 'selectRole' && !isBridgeReady) {
      console.warn('Bridge disconnected while on selectRole, returning to splash');
      setAppState('splash');
    }
  }, [appState, isBridgeReady]);

  const hasSeenOnboarding = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  };

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const handleSplashComplete = useCallback(() => {
    // Only proceed if bridge is ready
    if (!isBridgeReady) {
      console.warn('Splash complete called but bridge not ready, staying on splash');
      return;
    }
    
    if (hasSeenOnboarding()) {
      setAppState('selectRole');
    } else {
      setAppState('onboarding');
    }
  }, [isBridgeReady]);

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
