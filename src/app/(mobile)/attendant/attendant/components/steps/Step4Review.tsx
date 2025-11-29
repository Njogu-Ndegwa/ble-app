'use client';

import React from 'react';
import BatterySwapVisual from '../BatterySwapVisual';
import { SwapData, CustomerData, getInitials } from '../types';

interface Step4Props {
  swapData: SwapData;
  customerData: CustomerData | null;
}

export default function Step4Review({ swapData, customerData }: Step4Props) {
  return (
    <div className="screen active">
      {/* Visual Battery Comparison */}
      <BatterySwapVisual 
        oldBattery={swapData.oldBattery} 
        newBattery={swapData.newBattery} 
      />

      {/* Energy Differential Badge */}
      <div className="energy-diff-badge">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>+{swapData.energyDiff.toFixed(1)} Wh</span>
      </div>

      {/* Cost Breakdown */}
      <div className="cost-card">
        <div className="cost-title">Cost Breakdown</div>
        <div className="cost-row">
          <span className="cost-label">Old Battery</span>
          <span className="cost-value">{(swapData.oldBattery?.energy || 0).toFixed(1)} Wh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">New Battery</span>
          <span className="cost-value">{(swapData.newBattery?.energy || 0).toFixed(1)} Wh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">Energy Differential</span>
          <span className="cost-value">{swapData.energyDiff.toFixed(1)} Wh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">Rate</span>
          <span className="cost-value">KES {swapData.rate}/Wh</span>
        </div>
        <div className="cost-total">
          <span className="cost-total-label">Total Due</span>
          <span className="cost-total-value">KES {swapData.cost.toFixed(2)}</span>
        </div>
      </div>

      {/* Customer Info */}
      {customerData && (
        <div className="customer-card" style={{ padding: '10px' }}>
          <div className="customer-header" style={{ marginBottom: 0 }}>
            <div className="customer-avatar">{getInitials(customerData.name)}</div>
            <div>
              <div className="customer-name">{customerData.name}</div>
              <div className="customer-id">{customerData.swapCount} swaps • Last: {customerData.lastSwap}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
