/**
 * NetworkStatusBanner - A banner component that shows internet connectivity status
 * 
 * This component uses the browser's online/offline events to detect network status.
 * It's useful for informing users when they're offline, especially in regions with
 * unstable connections (e.g., China with VPN requirements).
 * 
 * Note: This detects device-level connectivity, not whether specific services are reachable.
 * For MQTT-specific connection status, use MqttReconnectBanner instead.
 * 
 * Usage:
 * ```typescript
 * import { NetworkStatusBanner } from '@/components/shared';
 * 
 * function MyFlow() {
 *   return (
 *     <div>
 *       <NetworkStatusBanner />
 *       {/* rest of your flow *\/}
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnline } from '@/lib/hooks';
import { useI18n } from '@/i18n';
import { colors } from '@/styles';

export interface NetworkStatusBannerProps {
  /** Show banner only when offline (default: true) */
  showOnlyWhenOffline?: boolean;
  /** Custom class name for the banner container */
  className?: string;
  /** Show reconnected message briefly when coming back online (default: true) */
  showReconnectedSuccess?: boolean;
  /** Callback when offline status is detected */
  onOffline?: () => void;
  /** Callback when online status is restored */
  onOnline?: () => void;
}

export default function NetworkStatusBanner({
  showOnlyWhenOffline = true,
  className = '',
  showReconnectedSuccess = true,
  onOffline,
  onOnline,
}: NetworkStatusBannerProps) {
  const isOnline = useOnline();
  const { t } = useI18n();
  
  // Track previous state to detect transitions
  const [wasOffline, setWasOffline] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Track offline/online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      onOffline?.();
    } else if (wasOffline && isOnline) {
      // Coming back online after being offline
      onOnline?.();
      if (showReconnectedSuccess) {
        setShowSuccess(true);
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setWasOffline(false);
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        setWasOffline(false);
      }
    }
  }, [isOnline, wasOffline, showReconnectedSuccess, onOffline, onOnline]);

  // Don't show anything if online and not showing success
  if (showOnlyWhenOffline && isOnline && !showSuccess) {
    return null;
  }

  // Show success banner briefly when coming back online
  if (showSuccess && isOnline) {
    return (
      <div 
        className={`flex items-center gap-2 px-4 py-2 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.success }}
      >
        <Wifi className="w-4 h-4" />
        <span>{t('network.backOnline') || 'Internet connection restored'}</span>
      </div>
    );
  }

  // Show offline banner
  if (!isOnline) {
    return (
      <div 
        className={`flex items-center justify-between gap-2 px-4 py-3 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.error }}
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              {t('network.offline') || 'No Internet Connection'}
            </span>
            <span className="text-xs opacity-90">
              {t('network.offlineHint') || 'Check your network or VPN connection'}
            </span>
          </div>
        </div>
        <AlertTriangle className="w-5 h-5 opacity-75" />
      </div>
    );
  }

  // Show connected status (if showOnlyWhenOffline is false)
  return (
    <div 
      className={`flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 text-sm rounded-lg ${className}`}
    >
      <Wifi className="w-4 h-4" />
      <span>{t('network.online') || 'Online'}</span>
    </div>
  );
}

/**
 * Helper function to determine if an error is likely network-related
 * Useful for displaying appropriate error messages to users
 */
export function isNetworkError(error: Error | string | unknown): boolean {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error);
  
  const networkErrorPatterns = [
    /network/i,
    /fetch/i,
    /timeout/i,
    /connection refused/i,
    /connection reset/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /net::ERR_/i,
    /NetworkError/i,
    /Failed to fetch/i,
    /Load failed/i,
    /Network request failed/i,
    /internet/i,
    /offline/i,
    /ERR_INTERNET_DISCONNECTED/i,
    /ERR_NETWORK_CHANGED/i,
    /ERR_CONNECTION_TIMED_OUT/i,
    /ERR_NAME_NOT_RESOLVED/i,
    /CORS/i, // Often indicates network/proxy issues
  ];

  return networkErrorPatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Get a user-friendly message for network errors
 */
export function getNetworkErrorMessage(
  error: Error | string | unknown,
  t?: (key: string) => string | undefined
): string {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error);

  // Check for specific error types
  if (/timeout/i.test(errorMessage)) {
    return t?.('network.errorTimeout') || 'Request timed out. Please check your connection and try again.';
  }
  
  if (/Failed to fetch|NetworkError|net::ERR_/i.test(errorMessage)) {
    return t?.('network.errorFetch') || 'Unable to connect. Please check your internet or VPN connection.';
  }
  
  if (/CORS/i.test(errorMessage)) {
    return t?.('network.errorCors') || 'Connection blocked. This may be a network or VPN issue.';
  }

  // Generic network error
  if (isNetworkError(error)) {
    return t?.('network.errorGeneric') || 'Network error. Please check your internet connection.';
  }

  // Not a network error - return original message
  return errorMessage;
}
