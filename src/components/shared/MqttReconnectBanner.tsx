/**
 * MqttReconnectBanner - A banner component that shows MQTT reconnection status
 * 
 * Use this component in flows to provide visual feedback when MQTT disconnects
 * and is attempting to reconnect. Particularly useful in regions with unstable
 * network connections (e.g., China with VPN issues).
 * 
 * Usage:
 * ```typescript
 * import { MqttReconnectBanner } from '@/components/shared';
 * 
 * function MyFlow() {
 *   return (
 *     <div>
 *       <MqttReconnectBanner />
 *       {/* rest of your flow *\/}
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useBridge } from '@/app/context/bridgeContext';
import { useI18n } from '@/i18n';
import { colors } from '@/styles';

export interface MqttReconnectBannerProps {
  /** Show banner only when disconnected/reconnecting (default: true) */
  showOnlyWhenDisconnected?: boolean;
  /** Custom class name for the banner container */
  className?: string;
  /** Callback when user taps manual reconnect */
  onReconnectTap?: () => void;
  /** Show success message briefly when reconnected (default: true) */
  showReconnectedSuccess?: boolean;
}

export default function MqttReconnectBanner({
  showOnlyWhenDisconnected = true,
  className = '',
  onReconnectTap,
  showReconnectedSuccess = true,
}: MqttReconnectBannerProps) {
  const { isMqttConnected, mqttReconnectionState, reconnectMqtt } = useBridge();
  const { t } = useI18n();
  
  // Track if we should show the "reconnected" success message
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasReconnecting, setWasReconnecting] = useState(false);

  // Show success message briefly when reconnected after being disconnected
  useEffect(() => {
    if (showReconnectedSuccess && wasReconnecting && isMqttConnected && !mqttReconnectionState.isReconnecting) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isMqttConnected, mqttReconnectionState.isReconnecting, wasReconnecting, showReconnectedSuccess]);

  // Track if we were reconnecting
  useEffect(() => {
    if (mqttReconnectionState.isReconnecting) {
      setWasReconnecting(true);
    } else if (isMqttConnected) {
      // Reset after showing success
      const timer = setTimeout(() => setWasReconnecting(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [mqttReconnectionState.isReconnecting, isMqttConnected]);

  const handleReconnectTap = () => {
    onReconnectTap?.();
    reconnectMqtt();
  };

  // Don't show anything if connected and not showing success
  if (showOnlyWhenDisconnected && isMqttConnected && !showSuccess && !mqttReconnectionState.isReconnecting) {
    return null;
  }

  // Show success banner briefly
  if (showSuccess && isMqttConnected) {
    return (
      <div 
        className={`flex items-center gap-2 px-4 py-2 bg-green-500/90 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.success }}
      >
        <CheckCircle className="w-4 h-4" />
        <span>{t('mqtt.reconnected') || 'Connection restored'}</span>
      </div>
    );
  }

  // Show reconnecting banner
  if (mqttReconnectionState.isReconnecting) {
    const { attemptCount, nextRetryIn } = mqttReconnectionState;
    
    return (
      <div 
        className={`flex items-center justify-between gap-2 px-4 py-2 bg-amber-500/90 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.warning }}
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>
            {nextRetryIn 
              ? (t('mqtt.reconnectingIn') || 'Reconnecting in {{seconds}}s...').replace('{{seconds}}', String(nextRetryIn))
              : (t('mqtt.reconnectingAttempt') || 'Reconnecting (attempt {{attempt}})').replace('{{attempt}}', String(attemptCount + 1))
            }
          </span>
        </div>
        <button 
          onClick={handleReconnectTap}
          className="px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
        >
          {t('mqtt.manualReconnect') || 'Tap to reconnect'}
        </button>
      </div>
    );
  }

  // Show max retries reached banner
  if (mqttReconnectionState.lastError?.includes('Max') || mqttReconnectionState.attemptCount >= 10) {
    return (
      <div 
        className={`flex items-center justify-between gap-2 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.error }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{t('mqtt.maxRetriesReached') || 'Unable to connect after multiple attempts. Please check your network.'}</span>
        </div>
        <button 
          onClick={handleReconnectTap}
          className="px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors flex-shrink-0"
        >
          {t('common.retry') || 'Retry'}
        </button>
      </div>
    );
  }

  // Show disconnected banner (not actively reconnecting)
  if (!isMqttConnected) {
    return (
      <div 
        className={`flex items-center justify-between gap-2 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg ${className}`}
        style={{ backgroundColor: colors.error }}
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>{t('mqtt.reconnectFailed') || 'Connection failed. Tap to retry.'}</span>
        </div>
        <button 
          onClick={handleReconnectTap}
          className="px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
        >
          {t('mqtt.manualReconnect') || 'Tap to reconnect'}
        </button>
      </div>
    );
  }

  // Show connected status (if showOnlyWhenDisconnected is false)
  return (
    <div 
      className={`flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 text-sm rounded-lg ${className}`}
    >
      <Wifi className="w-4 h-4" />
      <span>{t('common.connected') || 'Connected'}</span>
    </div>
  );
}
