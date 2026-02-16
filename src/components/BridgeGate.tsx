'use client';

import React, { useEffect, useState } from 'react';
import { useBridge } from '@/app/context/bridgeContext';

interface BridgeGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireMqtt?: boolean;
}

/**
 * BridgeGate - Ensures the native bridge is fully initialized before rendering children.
 * 
 * This component acts as a gate that:
 * 1. Shows a loading state while the bridge is initializing
 * 2. Optionally waits for MQTT to be connected
 * 3. Only renders children once everything is ready
 * 
 * Use this to wrap any page/component that needs bridge functionality (scanning, MQTT, etc.)
 */
export default function BridgeGate({ 
  children, 
  fallback,
  requireMqtt = false 
}: BridgeGateProps) {
  const { bridge, isBridgeReady, isMqttConnected } = useBridge();
  const [showTimeout, setShowTimeout] = useState(false);
  const [initStatus, setInitStatus] = useState<string>('Initializing...');

  // Update status message based on current state
  useEffect(() => {
    if (!bridge) {
      setInitStatus('Connecting to native bridge...');
    } else if (!isBridgeReady) {
      setInitStatus('Initializing bridge...');
    } else if (requireMqtt && !isMqttConnected) {
      setInitStatus('Connecting to server...');
    } else {
      setInitStatus('Ready!');
    }
  }, [bridge, isBridgeReady, isMqttConnected, requireMqtt]);

  // Show timeout message after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  // Check if we're ready to render children
  const isReady = isBridgeReady && (!requireMqtt || isMqttConnected);

  // If ready, render children
  if (isReady) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default loading UI
  return (
    <div className="fixed inset-0 bg-gradient-page flex flex-col items-center justify-center z-50">
      {/* Logo or brand */}
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
          <svg 
            className="w-10 h-10 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" 
            />
          </svg>
        </div>
      </div>

      {/* Loading spinner */}
      <div className="relative mb-6">
        <div className="w-12 h-12 border-4 border-border border-t-teal-500 rounded-full animate-spin"></div>
      </div>

      {/* Status message */}
      <p className="text-text-secondary text-sm mb-2">{initStatus}</p>

      {/* Progress indicators */}
      <div className="flex items-center gap-3 mt-4">
        <div className={`flex items-center gap-2 text-xs ${bridge ? 'text-teal-400' : 'text-text-muted'}`}>
          <div className={`w-2 h-2 rounded-full ${bridge ? 'bg-teal-400' : 'bg-bg-elevated'}`}></div>
          Bridge
        </div>
        <div className={`flex items-center gap-2 text-xs ${isBridgeReady ? 'text-teal-400' : 'text-text-muted'}`}>
          <div className={`w-2 h-2 rounded-full ${isBridgeReady ? 'bg-teal-400' : 'bg-bg-elevated'}`}></div>
          Initialized
        </div>
        {requireMqtt && (
          <div className={`flex items-center gap-2 text-xs ${isMqttConnected ? 'text-teal-400' : 'text-text-muted'}`}>
            <div className={`w-2 h-2 rounded-full ${isMqttConnected ? 'bg-teal-400' : 'bg-bg-elevated'}`}></div>
            Connected
          </div>
        )}
      </div>

      {/* Timeout message */}
      {showTimeout && !isReady && (
        <div className="mt-8 px-6 text-center">
          <p className="text-amber-400 text-sm mb-2">
            Taking longer than expected...
          </p>
          <p className="text-text-muted text-xs">
            Please ensure you&apos;re using the app within the native container.
            <br />
            If running in a browser, some features may not be available.
          </p>
        </div>
      )}
    </div>
  );
}
