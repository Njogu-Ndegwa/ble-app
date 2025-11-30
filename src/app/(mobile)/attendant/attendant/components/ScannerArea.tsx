'use client';

import React from 'react';

interface ScannerAreaProps {
  onClick: () => void;
  type?: 'qr' | 'battery'; // Kept for backward compatibility, but all types use same QR icon
  size?: 'normal' | 'small'; // Deprecated - all scanners now use consistent size
}

export default function ScannerArea({ onClick }: ScannerAreaProps) {
  // Consistent size for all scan areas in the Attendant workflow
  // Using 140x140px as a balanced size that works well across all steps
  const consistentStyle = { width: '140px', height: '140px', margin: '16px auto' };

  return (
    <div className="scanner-area" onClick={onClick} style={consistentStyle}>
      <div className="scanner-frame">
        <div className="scanner-corners">
          <div className="scanner-corner-bl"></div>
          <div className="scanner-corner-br"></div>
        </div>
        {/* No animated scanner line - it was misleading users into thinking scanning was active */}
        <div className="scanner-icon">
          {/* Consistent QR code icon for all scan types - since all steps scan QR codes */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </div>
        {/* Clear prompt so users know to tap */}
        <div className="scanner-tap-prompt">
          <span>Tap to scan</span>
        </div>
      </div>
    </div>
  );
}
