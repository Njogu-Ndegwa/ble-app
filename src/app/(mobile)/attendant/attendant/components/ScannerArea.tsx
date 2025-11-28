'use client';

import React from 'react';

interface ScannerAreaProps {
  onClick: () => void;
  type?: 'qr' | 'battery';
  size?: 'normal' | 'small';
}

export default function ScannerArea({ onClick, type = 'qr', size = 'normal' }: ScannerAreaProps) {
  const sizeStyle = size === 'small' 
    ? { width: '120px', height: '120px', margin: '12px auto' } 
    : {};

  return (
    <div className="scanner-area" onClick={onClick} style={sizeStyle}>
      <div className="scanner-frame">
        <div className="scanner-corners">
          <div className="scanner-corner-bl"></div>
          <div className="scanner-corner-br"></div>
        </div>
        <div className="scanner-line"></div>
        <div className="scanner-icon">
          {type === 'qr' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
