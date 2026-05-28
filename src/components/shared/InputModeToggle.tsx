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
  /** Label for wechat mode */
  wechatLabel?: string;
  /** Show the WeChat Pay tab */
  showWechat?: boolean;
  /** Show the Scan QR tab (default true) */
  showScan?: boolean;
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

const WeChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66l-.7 2.1 2.46-1.23c.78.22 1.6.34 2.46.34.24 0 .47-.01.7-.03A5.95 5.95 0 0 1 9.5 14c0-3.31 3.13-6 7-6 .24 0 .47.01.7.03C16.17 5.65 13.13 4 9.5 4zm-2.7 3.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm5.4 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zM16.5 9c-3.31 0-6 2.24-6 5s2.69 5 6 5c.73 0 1.43-.11 2.07-.32l1.97.99-.56-1.68C21.17 16.89 22 15.53 22 14c0-2.76-2.69-5-5.5-5zm-2.1 3a.72.72 0 1 1 0 1.44.72.72 0 0 1 0-1.44zm4.2 0a.72.72 0 1 1 0 1.44.72.72 0 0 1 0-1.44z"/>
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
  wechatLabel = 'WeChat',
  showWechat = false,
  showScan = true,
  disabled = false,
  className = '',
}: InputModeToggleProps) {
  return (
    <div className={`input-toggle ${className}`}>
      {showScan && (
        <button
          className={`toggle-btn ${mode === 'scan' ? 'active' : ''}`}
          onClick={() => !disabled && onModeChange('scan')}
          disabled={disabled}
          type="button"
        >
          <QrIcon />
          {scanLabel}
        </button>
      )}
      <button
        className={`toggle-btn ${mode === 'manual' ? 'active' : ''}`}
        onClick={() => !disabled && onModeChange('manual')}
        disabled={disabled}
        type="button"
      >
        <EditIcon />
        {manualLabel}
      </button>
      {showWechat && (
        <button
          className={`toggle-btn ${mode === 'wechat' ? 'active' : ''}`}
          onClick={() => !disabled && onModeChange('wechat')}
          disabled={disabled}
          type="button"
        >
          <WeChatIcon />
          {wechatLabel}
        </button>
      )}
    </div>
  );
}
