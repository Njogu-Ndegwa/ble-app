'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
  maxWaitTime?: number;
}

export default function SplashScreen({ 
  onComplete, 
  minDuration = 2000,  // Minimum time to show splash (for branding)
  maxWaitTime = 15000  // Maximum time to wait for initialization before showing retry
}: SplashScreenProps) {
  const { isBridgeReady, isMqttConnected } = useBridge();
  const [isHidden, setIsHidden] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const hasCompletedRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // Update status messages
  useEffect(() => {
    if (isRetrying) {
      setStatus(`Retrying connection... (${retryCount})`);
    } else if (!isBridgeReady) {
      setStatus('Connecting to device...');
    } else if (!isMqttConnected) {
      setStatus('Connecting to server...');
    } else {
      setStatus('Ready!');
      setShowRetry(false); // Hide retry button when connection succeeds
    }
  }, [isBridgeReady, isMqttConnected, isRetrying, retryCount]);

  // Complete when everything is ready AND minimum time has passed
  useEffect(() => {
    if (hasCompletedRef.current) return;

    const isReady = isBridgeReady && isMqttConnected;
    
    if (isReady && minTimeElapsed) {
      hasCompletedRef.current = true;
      console.info('=== Splash Complete: Bridge and MQTT ready ===');
      setShowRetry(false);
      setIsRetrying(false);
      setIsHidden(true);
      setTimeout(onComplete, 600);
    }
  }, [isBridgeReady, isMqttConnected, minTimeElapsed, onComplete]);

  // Handle retry logic
  const handleRetry = useCallback(() => {
    console.info('=== Manual retry initiated ===');
    setIsRetrying(true);
    setShowRetry(false);
    setRetryCount(prev => prev + 1);
    
    // Force page reload to reinitialize the bridge connection
    // This is the most reliable way to restart the WebViewJavascriptBridge connection
    window.location.reload();
  }, []);

  // After maxWaitTime, show retry option if not connected (instead of proceeding)
  useEffect(() => {
    // Clear any existing timer
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && !isBridgeReady) {
        // Bridge not ready after max wait - show retry button
        console.warn('=== Bridge connection failed after max wait time ===', {
          isBridgeReady,
          isMqttConnected
        });
        setShowRetry(true);
        setIsRetrying(false);
        setStatus('Connection failed');
      } else if (!hasCompletedRef.current && isBridgeReady && !isMqttConnected) {
        // Bridge ready but MQTT not connected - still allow proceeding after showing warning
        // MQTT may reconnect later, and bridge is the critical component
        console.warn('=== MQTT not connected but bridge is ready, proceeding ===', {
          isBridgeReady,
          isMqttConnected
        });
        // Give MQTT a bit more time, then proceed
        setTimeout(() => {
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true;
            setIsHidden(true);
            setTimeout(onComplete, 600);
          }
        }, 3000);
      }
    }, maxWaitTime);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [maxWaitTime, onComplete, isBridgeReady, isMqttConnected]);

  // Auto-retry a few times before showing manual retry button
  useEffect(() => {
    if (!isBridgeReady && minTimeElapsed && retryCount < 3 && !showRetry && !hasCompletedRef.current) {
      const autoRetryTimer = setTimeout(() => {
        if (!isBridgeReady && !hasCompletedRef.current) {
          console.info(`=== Auto-retry attempt ${retryCount + 1}/3 ===`);
          setRetryCount(prev => prev + 1);
          setIsRetrying(true);
          
          // Check again after a delay
          setTimeout(() => {
            setIsRetrying(false);
          }, 2000);
        }
      }, 5000 + (retryCount * 2000)); // Increasing delay: 5s, 7s, 9s

      return () => clearTimeout(autoRetryTimer);
    }
  }, [isBridgeReady, minTimeElapsed, retryCount, showRetry]);

  return (
    <div className={`splash-screen ${isHidden ? 'hidden' : ''}`}>
      <div className="splash-content">
        {/* Battery Swap Animation */}
        <div className="splash-animation">
          <div className="splash-arrows">
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
          </div>
          
          <div className="splash-battery">
            <div className="splash-battery-fill"></div>
          </div>
          
          <div className="splash-particles">
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
          </div>
        </div>

        <Image 
          src="/assets/Logo-Oves.png" 
          alt="Oves" 
          width={192}
          height={48}
          className="splash-logo-img"
          priority
        />
        
        <div className="splash-loading">
          <span>{status}</span>
          {!showRetry && (
            <div className="splash-loading-dots">
              <div className="splash-loading-dot"></div>
              <div className="splash-loading-dot"></div>
              <div className="splash-loading-dot"></div>
            </div>
          )}
        </div>

        {/* Retry button when connection fails */}
        {showRetry && (
          <div className="splash-retry">
            <p className="splash-retry-message">
              Unable to connect to the device bridge.
              <br />
              Please ensure you are using the OVES app.
            </p>
            <button 
              onClick={handleRetry}
              className="splash-retry-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="splash-retry-icon">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                <path d="M3 22v-6h6"></path>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
              </svg>
              Retry Connection
            </button>
          </div>
        )}

        {/* Status indicators */}
        <div className="splash-status">
          <div className={`splash-status-item ${isBridgeReady ? 'ready' : showRetry ? 'error' : ''}`}>
            <span className="splash-status-dot"></span>
            <span>Device</span>
          </div>
          <div className={`splash-status-item ${isMqttConnected ? 'ready' : (isBridgeReady && showRetry) ? 'error' : ''}`}>
            <span className="splash-status-dot"></span>
            <span>Server</span>
          </div>
        </div>
      </div>
    </div>
  );
}
