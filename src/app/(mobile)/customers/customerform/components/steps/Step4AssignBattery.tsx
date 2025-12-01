'use client';

import React from 'react';
import { Bluetooth, Radio } from 'lucide-react';
import { 
  CustomerFormData, 
  PlanData, 
  AVAILABLE_PLANS, 
  getInitials, 
  maskNationalId 
} from '../types';

interface Step4Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  onScanBattery: () => void;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
}

export default function Step4AssignBattery({ 
  formData, 
  selectedPlanId, 
  onScanBattery,
  isBleScanning = false,
  detectedDevicesCount = 0,
}: Step4Props) {
  const selectedPlan = AVAILABLE_PLANS.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);

  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>Assign Battery</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '10px' }}>Scan a battery to assign to customer</p>

      {/* Customer Preview Card */}
      <div className="preview-card">
        <div className="preview-header">
          <div className="preview-avatar">{initials}</div>
          <div>
            <div className="preview-name">{customerName}</div>
            <div className="preview-phone font-mono-oves">{formData.phone || '+254 XXX XXX XXX'}</div>
          </div>
          <span className="preview-badge">{selectedPlan?.name || 'No Plan'}</span>
        </div>
        <div className="preview-details">
          <div className="detail-item">
            <div className="detail-label">Vehicle</div>
            <div className="detail-value">{formData.vehicleReg || 'N/A'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">National ID</div>
            <div className="detail-value">{maskNationalId(formData.nationalId) || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* BLE Scanning Status */}
      <div className={`bluetooth-notice ${isBleScanning ? 'ble-scanning-active' : ''}`}>
        <div className="bluetooth-notice-icon">
          {isBleScanning ? (
            <Radio size={20} className="ble-scanning-icon" />
          ) : (
            <Bluetooth size={20} />
          )}
        </div>
        <div className="bluetooth-notice-content">
          <span className="bluetooth-notice-title">
            {isBleScanning ? 'Scanning for Batteries...' : 'Bluetooth Required'}
          </span>
          <span className="bluetooth-notice-text">
            {isBleScanning 
              ? `${detectedDevicesCount} ${detectedDevicesCount === 1 ? 'battery' : 'batteries'} detected nearby`
              : 'Please ensure Bluetooth is ON to read battery levels'}
          </span>
        </div>
      </div>

      {/* Battery Scanner */}
      <div className="scanner-area" onClick={onScanBattery} style={{ width: '140px', height: '140px', margin: '10px auto' }}>
        <div className="scanner-frame">
          <div className="scanner-corners" style={{ inset: '12px' }}>
            <div className="scanner-corner-bl"></div>
            <div className="scanner-corner-br"></div>
          </div>
          <div className="scanner-line"></div>
          <div className="scanner-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '36px', height: '36px' }}>
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <path d="M22 10v4"/>
              <path d="M6 10v4"/>
            </svg>
          </div>
          <div className="scanner-tap-prompt">
            <span>Tap to scan</span>
          </div>
        </div>
      </div>

      <p className="scan-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        Battery energy will be read via Bluetooth
      </p>
    </div>
  );
}
