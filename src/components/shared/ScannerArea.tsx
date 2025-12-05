'use client';

import React from 'react';

export type ScannerType = 'qr' | 'battery';
export type ScannerSize = 'normal' | 'small' | 'large';

interface ScannerAreaProps {
  /** Callback when scanner area is tapped */
  onClick: () => void;
  /** Type of scan - kept for semantics but both use QR icon */
  type?: ScannerType;
  /** Size variant - defaults to 'normal' */
  size?: ScannerSize;
  /** Disable the scanner (e.g., while scanner is opening) */
  disabled?: boolean;
  /** Custom label for accessibility */
  label?: string;
  /** Optional custom className */
  className?: string;
}

// Size mappings
const SIZE_STYLES: Record<ScannerSize, React.CSSProperties> = {
  small: { width: '120px', height: '120px', margin: '12px auto' },
  normal: { width: '140px', height: '140px', margin: '16px auto' },
  large: { width: '160px', height: '160px', margin: '20px auto' },
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
  size = 'normal',
  disabled = false,
  label = 'Tap to scan',
  className = '',
}: ScannerAreaProps) {
  const sizeStyle = SIZE_STYLES[size];

  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  return (
    <div
      className={`scanner-area ${disabled ? 'scanner-area-disabled' : ''} ${className}`}
      onClick={handleClick}
      style={{
        ...sizeStyle,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
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
        
        {disabled ? (
          <div className="scanner-loading">
            <div className="scanner-spinner"></div>
          </div>
        ) : (
          <>
            <div className="scanner-icon">
              {/* QR code icon - used for all scan types since all scan QR codes */}
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
            <div className="scanner-tap-prompt">
              <span>{label}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
