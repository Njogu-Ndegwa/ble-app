'use client';

import React from 'react';
import { Battery, CheckCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { BatteryData, getBatteryClass, formatEnergyKwh } from './types';

export type BatteryCardVariant = 'compact' | 'detailed' | 'success';

interface BatteryCardProps {
  /** Battery data to display */
  battery: BatteryData;
  /** Card variant */
  variant?: BatteryCardVariant;
  /** Optional title/label */
  title?: string;
  /** Whether battery is connected/active */
  isConnected?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * BatteryCard - Reusable battery information display component
 * 
 * Used to display battery information in various contexts:
 * - Returned battery summary
 * - New battery details
 * - Assigned battery confirmation
 * 
 * @example
 * <BatteryCard 
 *   battery={scannedBattery} 
 *   variant="detailed" 
 *   title="New Battery"
 *   isConnected
 * />
 */
export default function BatteryCard({
  battery,
  variant = 'compact',
  title,
  isConnected = false,
  className = '',
}: BatteryCardProps) {
  const { t } = useI18n();
  
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;
  const batteryClass = getBatteryClass(chargeLevel);

  if (variant === 'success') {
    return (
      <BatterySuccessCard
        battery={battery}
        title={title}
        className={className}
      />
    );
  }

  if (variant === 'detailed') {
    return (
      <BatteryDetailedCard
        battery={battery}
        title={title}
        isConnected={isConnected}
        className={className}
      />
    );
  }

  // Compact variant
  return (
    <div className={`battery-return-card ${className}`}>
      <div className="battery-return-header">
        <span className="battery-return-label">
          {title || t('attendant.returnedBattery')}
        </span>
        {isConnected && (
          <span className="battery-return-status">✓ Connected</span>
        )}
      </div>
      <div className="battery-return-content">
        <div className="battery-return-id">{battery.shortId || '---'}</div>
        <div className="battery-return-charge">
          <div className={`battery-return-icon ${batteryClass}`}>
            <div 
              className="battery-return-fill" 
              style={{ '--level': `${chargeLevel}%` } as React.CSSProperties}
            />
          </div>
          <span className="battery-return-percent">
            {energyKwh.toFixed(3)} kWh
          </span>
          <span className="battery-return-unit">
            {t('attendant.energyRemaining')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VARIANT COMPONENTS
// ============================================

function BatteryDetailedCard({
  battery,
  title,
  isConnected,
  className = '',
}: {
  battery: BatteryData;
  title?: string;
  isConnected?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;
  const batteryClass = getBatteryClass(chargeLevel);

  return (
    <div className={`battery-scanned-card ${className}`} style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Battery size={28} className={`battery-icon ${batteryClass}`} />
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
            {title || t('sales.newBattery')}
          </div>
          <div className="font-mono-oves" style={{ fontSize: '16px', fontWeight: 600 }}>
            {battery.shortId}
          </div>
        </div>
        {isConnected && (
          <CheckCircle size={20} color="var(--success)" style={{ marginLeft: 'auto' }} />
        )}
      </div>
      
      {/* Stats row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '12px', 
        background: 'var(--color-bg-secondary)', 
        borderRadius: '8px' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="font-mono-oves" style={{ fontSize: '18px', fontWeight: 600 }}>
            {chargeLevel}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {t('sales.chargeLevel') || 'Charge'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="font-mono-oves" style={{ fontSize: '18px', fontWeight: 600 }}>
            {energyKwh.toFixed(2)} kWh
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {t('sales.energyAvailable') || 'Energy'}
          </div>
        </div>
      </div>
    </div>
  );
}

function BatterySuccessCard({
  battery,
  title,
  className = '',
}: {
  battery: BatteryData;
  title?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;

  return (
    <div className={className}>
      {/* Success Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <CheckCircle size={32} color="white" />
        </div>
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>
          {t('sales.batteryScanned') || 'Battery Scanned'}
        </h2>
        <p className="scan-subtitle">
          {t('sales.reviewAndComplete') || 'Review and complete'}
        </p>
      </div>

      <BatteryDetailedCard
        battery={battery}
        title={title}
        isConnected
      />
    </div>
  );
}

// ============================================
// BATTERY SWAP VISUAL
// ============================================

interface BatterySwapVisualProps {
  /** Old battery being returned */
  oldBattery: BatteryData | null;
  /** New battery being issued */
  newBattery: BatteryData | null;
  /** Optional className */
  className?: string;
}

/**
 * BatterySwapVisual - Shows side-by-side comparison of old and new batteries
 */
export function BatterySwapVisual({
  oldBattery,
  newBattery,
  className = '',
}: BatterySwapVisualProps) {
  const oldLevel = oldBattery?.chargeLevel ?? 0;
  const newLevel = newBattery?.chargeLevel ?? 0;
  const oldEnergyKwh = (oldBattery?.energy ?? 0) / 1000;
  const newEnergyKwh = (newBattery?.energy ?? 0) / 1000;

  return (
    <div className={`battery-swap-visual ${className}`}>
      {/* Old Battery (Returning) */}
      <div className="battery-swap-item">
        <div className={`battery-icon-swap ${getBatteryClass(oldLevel)}`}>
          <div 
            className="battery-level-swap" 
            style={{ '--level': `${oldLevel}%` } as React.CSSProperties}
          />
          <span className="battery-percent">{oldEnergyKwh.toFixed(2)} kWh</span>
        </div>
        <div className="battery-swap-label">RETURNING</div>
        <div className="battery-swap-id">{oldBattery?.shortId || '---'}</div>
      </div>
      
      {/* Arrow */}
      <div className="swap-arrow-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
      
      {/* New Battery (Receiving) */}
      <div className="battery-swap-item">
        <div className={`battery-icon-swap ${getBatteryClass(newLevel)}`}>
          <div 
            className="battery-level-swap" 
            style={{ '--level': `${newLevel}%` } as React.CSSProperties}
          />
          <span className="battery-percent">{newEnergyKwh.toFixed(2)} kWh</span>
        </div>
        <div className="battery-swap-label">RECEIVING</div>
        <div className="battery-swap-id">{newBattery?.shortId || '---'}</div>
      </div>
    </div>
  );
}
