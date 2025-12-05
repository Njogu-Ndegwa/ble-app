'use client';

import React from 'react';
import { InputMode } from './types';

interface InputModeToggleProps {
  /** Current input mode */
  mode: InputMode;
  /** Callback when mode changes */
  onModeChange: (mode: InputMode) => void;
  /** Label for scan mode */
  scanLabel?: string;
  /** Label for manual mode */
  manualLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional custom className */
  className?: string;
}

// Icons as components
const QrIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const EditIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

/**
 * InputModeToggle - Toggle between scan and manual input modes
 * 
 * Used across multiple steps in both Attendant and Sales workflows:
 * - Customer identification (Attendant)
 * - Payment collection (both flows)
 * 
 * @example
 * <InputModeToggle
 *   mode={inputMode}
 *   onModeChange={setInputMode}
 *   scanLabel="Scan QR"
 *   manualLabel="Enter ID"
 * />
 */
export default function InputModeToggle({
  mode,
  onModeChange,
  scanLabel = 'Scan QR',
  manualLabel = 'Enter ID',
  disabled = false,
  className = '',
}: InputModeToggleProps) {
  return (
    <div className={`input-toggle ${className}`}>
      <button
        className={`toggle-btn ${mode === 'scan' ? 'active' : ''}`}
        onClick={() => !disabled && onModeChange('scan')}
        disabled={disabled}
        type="button"
      >
        <QrIcon />
        {scanLabel}
      </button>
      <button
        className={`toggle-btn ${mode === 'manual' ? 'active' : ''}`}
        onClick={() => !disabled && onModeChange('manual')}
        disabled={disabled}
        type="button"
      >
        <EditIcon />
        {manualLabel}
      </button>
    </div>
  );
}
