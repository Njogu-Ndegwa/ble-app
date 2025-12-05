'use client';

import React from 'react';
import { CreditCard, Battery, Zap, CheckCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PlanData,
  BatteryData,
  getInitials,
  getBatteryClass 
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
  subscriptionCode?: string;  // Subscription ID from payment confirmation - used for battery allocation
  // NEW: Scanned battery data
  scannedBattery?: BatteryData | null;
  onCompleteService?: () => void;
  isCompletingService?: boolean;
}

export default function Step4AssignBattery({ 
  formData, 
  selectedPlanId, 
  onScanBattery,
  isBleScanning = false,
  detectedDevicesCount = 0,
  isScannerOpening = false,
  plans,
  subscriptionCode = '',
  scannedBattery = null,
  onCompleteService,
  isCompletingService = false,
}: Step4Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate energy in kWh for display (energy is stored in Wh)
  const energyKwh = scannedBattery ? (scannedBattery.energy / 1000) : 0;
  const batteryClass = scannedBattery ? getBatteryClass(scannedBattery.chargeLevel) : 'full';

  // If battery has been scanned, show battery details and Complete Service button
  if (scannedBattery) {
    return (
      <div className="screen active">
        <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>
          {t('sales.batteryScanned') || 'Battery Scanned'}
        </h2>
        <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '16px' }}>
          {t('sales.reviewAndComplete') || 'Review and complete the service'}
        </p>

        {/* Customer Preview Card - Compact */}
        <div className="preview-card" style={{ marginBottom: '16px' }}>
          <div className="preview-header">
            <div className="preview-avatar">{initials}</div>
            <div>
              <div className="preview-name">{customerName}</div>
              <div className="preview-phone font-mono-oves">{formData.phone || '+254 XXX XXX XXX'}</div>
            </div>
            <span className="preview-badge">{selectedPlan?.name || 'No Plan'}</span>
          </div>
          {subscriptionCode && (
            <div className="preview-details" style={{ paddingTop: '8px' }}>
              <div className="detail-item">
                <div className="detail-label">
                  <CreditCard size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {t('sales.subscriptionId') || 'Subscription ID'}
                </div>
                <div className="detail-value font-mono-oves" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {subscriptionCode}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scanned Battery Card - Prominent Display */}
        <div className="battery-scanned-card">
          <div className="battery-scanned-header">
            <div className="battery-scanned-icon-wrapper">
              <Battery size={24} className={`battery-icon ${batteryClass}`} />
              <CheckCircle size={14} className="battery-check-icon" />
            </div>
            <div className="battery-scanned-info">
              <span className="battery-scanned-label">{t('sales.newBattery') || 'New Battery'}</span>
              <span className="battery-scanned-id font-mono-oves">{scannedBattery.shortId}</span>
            </div>
          </div>
          
          <div className="battery-scanned-stats">
            <div className="battery-stat">
              <Zap size={16} className="battery-stat-icon" />
              <div className="battery-stat-content">
                <span className="battery-stat-value font-mono-oves">{energyKwh.toFixed(3)} kWh</span>
                <span className="battery-stat-label">{t('sales.energyAvailable') || 'Energy Available'}</span>
              </div>
            </div>
            <div className="battery-stat">
              <Battery size={16} className={`battery-stat-icon ${batteryClass}`} />
              <div className="battery-stat-content">
                <span className="battery-stat-value font-mono-oves">{scannedBattery.chargeLevel}%</span>
                <span className="battery-stat-label">{t('sales.chargeLevel') || 'Charge Level'}</span>
              </div>
            </div>
          </div>

          {/* Battery visual charge indicator */}
          <div className="battery-charge-bar">
            <div 
              className={`battery-charge-fill ${batteryClass}`}
              style={{ width: `${scannedBattery.chargeLevel}%` }}
            />
          </div>
        </div>

        {/* Complete Service Button */}
        <button
          className="complete-service-btn"
          onClick={onCompleteService}
          disabled={isCompletingService}
        >
          {isCompletingService ? (
            <>
              <div className="btn-spinner"></div>
              <span>{t('sales.completingService') || 'Completing Service...'}</span>
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              <span>{t('sales.completeService') || 'Complete Service'}</span>
            </>
          )}
        </button>

        <p className="scan-hint" style={{ marginTop: '12px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {t('sales.firstBatteryPromo') || 'First battery is provided as a promotional offer'}
        </p>
      </div>
    );
  }

  // Initial state - No battery scanned yet
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
          {subscriptionCode && (
            <div className="detail-item">
              <div className="detail-label">
                <CreditCard size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                {t('sales.subscriptionId') || 'Subscription ID'}
              </div>
              <div className="detail-value font-mono-oves" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                {subscriptionCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Battery Scanner - No Bluetooth status section */}
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
