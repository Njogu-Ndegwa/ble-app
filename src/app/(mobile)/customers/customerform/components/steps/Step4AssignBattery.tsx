'use client';

import React from 'react';
import { CreditCard, Battery, CheckCircle } from 'lucide-react';
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

  // If battery has been scanned, show simplified battery details and Complete Service button
  if (scannedBattery) {
    return (
      <div className="screen active">
        {/* Success Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle size={32} color="white" />
          </div>
          <h2 className="scan-title" style={{ marginBottom: '4px' }}>
            {t('sales.batteryScanned')}
          </h2>
          <p className="scan-subtitle">
            {t('sales.reviewAndComplete')}
          </p>
        </div>

        {/* Battery Info Card - Simplified */}
        <div className="battery-scanned-card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Battery size={28} className={`battery-icon ${batteryClass}`} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                {t('sales.newBattery')}
              </div>
              <div className="font-mono-oves" style={{ fontSize: '16px', fontWeight: 600 }}>
                {scannedBattery.shortId}
              </div>
            </div>
          </div>
          
          {/* Simple stats row */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px', 
            background: 'var(--color-bg-secondary)', 
            borderRadius: '8px' 
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono-oves" style={{ fontSize: '18px', fontWeight: 600 }}>
                {scannedBattery.chargeLevel}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {t('sales.chargeLevel')}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono-oves" style={{ fontSize: '18px', fontWeight: 600 }}>
                {energyKwh.toFixed(2)} kWh
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {t('sales.energyAvailable')}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Summary - Compact */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '12px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div className="preview-avatar" style={{ width: '40px', height: '40px', fontSize: '14px' }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{customerName}</div>
            <div className="font-mono-oves" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {subscriptionCode || formData.phone}
            </div>
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
              <span>{t('sales.completingService')}</span>
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              <span>{t('sales.completeService')}</span>
            </>
          )}
        </button>

        <p className="scan-hint" style={{ marginTop: '16px', fontSize: '12px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          {t('sales.firstBatteryPromo')}
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
