'use client';

import React from 'react';
import { BatteryData, getBatteryClass } from './types';

interface BatterySwapVisualProps {
  oldBattery: BatteryData | null;
  newBattery: BatteryData | null;
}

export default function BatterySwapVisual({ oldBattery, newBattery }: BatterySwapVisualProps) {
  const oldLevel = oldBattery?.chargeLevel || 0;
  const newLevel = newBattery?.chargeLevel || 100;
  const oldEnergy = oldBattery?.energy || 0;
  const newEnergy = newBattery?.energy || 0;

  return (
    <div className="battery-swap-visual">
      {/* Old Battery (Returning) */}
      <div className="battery-swap-item">
        <div className={`battery-icon-swap ${getBatteryClass(oldLevel)}`}>
          <div 
            className="battery-level-swap" 
            style={{ '--level': `${oldLevel}%` } as React.CSSProperties}
          ></div>
          <span className="battery-percent">{oldEnergy.toFixed(0)} Wh</span>
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
          ></div>
          <span className="battery-percent">{newEnergy.toFixed(0)} Wh</span>
        </div>
        <div className="battery-swap-label">RECEIVING</div>
        <div className="battery-swap-id">{newBattery?.shortId || '---'}</div>
      </div>
    </div>
  );
}
