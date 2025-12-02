'use client';

import React from 'react';
import { Bluetooth, Radio } from 'lucide-react';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PlanData,
  getInitials 
} from '../types';
import ScannerArea from '@/app/(mobile)/attendant/attendant/components/ScannerArea';

interface Step4Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  onScanBattery: () => void;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
  isScannerOpening?: boolean; // Prevents multiple scanner opens
  plans: PlanData[];  // Plans from Odoo API
}

export default function Step4AssignBattery({ 
  formData, 
  selectedPlanId, 
  onScanBattery,
  isBleScanning = false,
  detectedDevicesCount = 0,
  isScannerOpening = false,
  plans,
}: Step4Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);

  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>{t('sales.assignBattery')}</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '10px' }}>{t('sales.scanBatteryQr')}</p>

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
            <div className="detail-label">{t('sales.emailAddress')}</div>
            <div className="detail-value">{formData.email || 'N/A'}</div>
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
            {isBleScanning ? t('sales.scanningForDevices') : 'Bluetooth'}
          </span>
          <span className="bluetooth-notice-text">
            {isBleScanning 
              ? `${detectedDevicesCount} ${t('sales.devicesFound')}`
              : t('sales.scanBatteryQr')}
          </span>
        </div>
      </div>

      {/* Battery Scanner */}
      <ScannerArea onClick={onScanBattery} type="battery" disabled={isScannerOpening} />

      <p className="scan-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        {t('sales.scanBatteryQr')}
      </p>
    </div>
  );
}
