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
  /** Compact mode - reduces padding and sizes for tight layouts */
  compact?: boolean;
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
  compact = false,
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
        compact={compact}
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
  // Use actualBatteryId (OPID/PPID from ATT service) as primary display
  const displayId = battery.actualBatteryId || battery.shortId || '---';
  
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
        <div className="battery-return-id">{displayId}</div>
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
  compact = false,
}: {
  battery: BatteryData;
  title?: string;
  isConnected?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;
  const batteryClass = getBatteryClass(chargeLevel);
  
  // Use actualBatteryId (OPID/PPID from ATT service) as primary display
  const displayId = battery.actualBatteryId || battery.shortId;

  return (
    <div className={`battery-scanned-card ${className}`} style={{ marginBottom: compact ? '10px' : '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '8px' : '12px', marginBottom: compact ? '10px' : '16px' }}>
        <Battery size={compact ? 22 : 28} className={`battery-icon ${batteryClass}`} />
        <div>
          <div style={{ fontSize: compact ? '11px' : '12px', color: 'var(--color-text-secondary)', marginBottom: '1px' }}>
            {title || t('sales.newBattery')}
          </div>
          <div className="font-mono-oves" style={{ fontSize: compact ? '14px' : '16px', fontWeight: 600 }}>
            {displayId}
          </div>
        </div>
        {isConnected && (
          <CheckCircle size={compact ? 16 : 20} color="var(--success)" style={{ marginLeft: 'auto' }} />
        )}
      </div>
      
      {/* Stats row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: compact ? '8px 10px' : '12px', 
        background: 'var(--color-bg-secondary)', 
        borderRadius: compact ? '6px' : '8px' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="font-mono-oves" style={{ fontSize: compact ? '15px' : '18px', fontWeight: 600 }}>
            {chargeLevel}%
          </div>
          <div style={{ fontSize: compact ? '10px' : '11px', color: 'var(--color-text-secondary)' }}>
            {t('sales.chargeLevel') || 'Charge'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="font-mono-oves" style={{ fontSize: compact ? '15px' : '18px', fontWeight: 600 }}>
            {energyKwh.toFixed(2)} kWh
          </div>
          <div style={{ fontSize: compact ? '10px' : '11px', color: 'var(--color-text-secondary)' }}>
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
  compact = false,
}: {
  battery: BatteryData;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;

  // Compact mode: inline success indicator instead of large header
  if (compact) {
    return (
      <div className={className}>
        {/* Compact Success Header - inline */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '10px',
          padding: '6px 10px',
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '6px',
        }}>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CheckCircle size={14} color="white" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#10b981' }}>
            {t('sales.batteryScanned') || 'Battery Scanned'}
          </span>
        </div>

        <BatteryDetailedCard
          battery={battery}
          title={title}
          isConnected
          compact
        />
      </div>
    );
  }

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
 * Uses actualBatteryId (OPID/PPID from ATT service) as the primary display ID
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
  
  // Use actualBatteryId (OPID/PPID from ATT service) as primary display
  const oldDisplayId = oldBattery?.actualBatteryId || oldBattery?.shortId || '---';
  const newDisplayId = newBattery?.actualBatteryId || newBattery?.shortId || '---';

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
        <div className="battery-swap-id">{oldDisplayId}</div>
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
        <div className="battery-swap-id">{newDisplayId}</div>
      </div>
    </div>
  );
}
