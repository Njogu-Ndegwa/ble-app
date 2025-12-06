'use client';

import React from 'react';
import { useI18n } from '@/i18n';

export type ScannerType = 'qr' | 'battery';
// Size prop kept for backward compatibility but all scanners use consistent 140px size
export type ScannerSize = 'normal' | 'small' | 'large';

interface ScannerAreaProps {
  /** Callback when scanner area is tapped */
  onClick: () => void;
  /** Type of scan - kept for semantics but both use QR icon */
  type?: ScannerType;
  /** Size variant - deprecated, all scanners now use consistent 140px size */
  size?: ScannerSize;
  /** Disable the scanner (e.g., while scanner is opening) */
  disabled?: boolean;
  /** Custom label - falls back to translated "Tap to scan" */
  label?: string;
  /** Optional custom className */
  className?: string;
}

// Consistent size for all scan areas across workflows
// Using 140x140px as a balanced size that works well across all steps
const CONSISTENT_STYLE: React.CSSProperties = { 
  width: '140px', 
  height: '140px', 
  margin: '16px auto' 
};

/**
 * ScannerArea - A reusable QR/barcode scanner trigger component
 * 
 * Used across multiple workflows:
 * - Attendant: Customer QR scan, Old Battery scan, New Battery scan, Payment scan
 * - Sales: Battery assignment scan, Payment scan
 * 
 * @example
 * <ScannerArea onClick={handleScan} type="qr" />
 * <ScannerArea onClick={handleBatteryScan} type="battery" disabled={isScanning} />
 */
export default function ScannerArea({
  onClick,
  type = 'qr',
  size = 'normal', // Kept for backward compatibility but ignored
  disabled = false,
  label,
  className = '',
}: ScannerAreaProps) {
  const { t } = useI18n();
  
  // Use provided label or fall back to translated text or default
  const displayLabel = label || t('common.tapToScan') || 'Tap to scan';

  const handleClick = () => {
    // Prevent triggering if disabled (scanner already opening)
    if (disabled) return;
    onClick();
  };

  return (
    <div
      className={`scanner-area ${disabled ? 'scanner-area-disabled' : ''} ${className}`}
      onClick={handleClick}
      style={{
        ...CONSISTENT_STYLE,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={displayLabel}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="scanner-frame">
        <div className="scanner-corners">
          <div className="scanner-corner-bl"></div>
          <div className="scanner-corner-br"></div>
        </div>
        
        {/* Show loading spinner when scanner is opening */}
        {disabled ? (
          <div className="scanner-loading">
            <div className="scanner-spinner"></div>
          </div>
        ) : (
          <>
            <div className="scanner-icon">
              {/* Consistent QR code icon for all scan types - since all steps scan QR codes */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            {/* Clear prompt so users know to tap */}
            <div className="scanner-tap-prompt">
              <span>{displayLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
