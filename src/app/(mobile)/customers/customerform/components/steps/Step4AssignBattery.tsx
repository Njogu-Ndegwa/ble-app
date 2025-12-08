'use client';

import React from 'react';
import { CreditCard, CheckCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { 
  BatteryInputSelector,
  BatteryCard,
  getInitials,
} from '@/components/shared';
import type { BatteryData, BleDevice, BatteryInputMode } from '@/components/shared';
import { CustomerFormData, PlanData } from '../types';

interface Step4Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  /** Callback when QR scan is triggered */
  onScanBattery: () => void;
  /** Callback when a device is manually selected */
  onDeviceSelect?: (device: BleDevice) => void;
  /** List of detected BLE devices for manual selection */
  detectedDevices?: BleDevice[];
  /** Whether BLE scanning is in progress */
  isBleScanning?: boolean;
  /** Callback to start/restart BLE scanning */
  onStartScan?: () => void;
  /** Currently selected device MAC */
  selectedDeviceMac?: string | null;
  detectedDevicesCount?: number;
  isScannerOpening?: boolean;
  plans: PlanData[];
  subscriptionCode?: string;
  scannedBattery?: BatteryData | null;
  onCompleteService?: () => void;
  isCompletingService?: boolean;
  /** Current input mode */
  inputMode?: BatteryInputMode;
  /** Callback when input mode changes */
  onInputModeChange?: (mode: BatteryInputMode) => void;
  /** Callback to re-scan a different battery (clears current scanned battery) */
  onRescanBattery?: () => void;
}

/**
 * Step4AssignBattery - Assign battery to new customer
 * 
 * Uses the shared BatteryInputSelector component (same as Attendant workflow)
 * with mode="assign" for consistent scan-to-bind functionality.
 * Supports both QR scanning and manual device selection.
 * 
 * Note: BLE connection progress is handled by the parent flow's BleProgressModal,
 * following the same pattern as the Attendant workflow.
 * 
 * Shows:
 * - Pre-scan: Customer preview card + BatteryInputSelector
 * - Post-scan: Battery card + customer summary + Complete Service button
 */
export default function Step4AssignBattery({ 
  formData, 
  selectedPlanId, 
  onScanBattery,
  onDeviceSelect,
  detectedDevices = [],
  isBleScanning = false,
  onStartScan,
  selectedDeviceMac,
  isScannerOpening = false,
  plans,
  subscriptionCode = '',
  scannedBattery = null,
  onCompleteService,
  isCompletingService = false,
  inputMode,
  onInputModeChange,
  onRescanBattery,
}: Step4Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);

  // Handle device selection
  const handleDeviceSelect = (device: BleDevice) => {
    if (onDeviceSelect) {
      onDeviceSelect(device);
    }
  };

  // If battery has been scanned, show simplified battery details and Complete Service button
  if (scannedBattery) {
    return (
      <div className="screen active">
        {/* Battery Success Card using shared component */}
        <BatteryCard
          battery={scannedBattery}
          variant="success"
          title={t('sales.newBattery')}
        />

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

        {/* Rescan Battery Button - allows scanning a different battery */}
        {onRescanBattery && !isCompletingService && (
          <button
            className="rescan-battery-btn"
            onClick={onRescanBattery}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '12px 16px',
              marginTop: '12px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={16} />
            <span>{t('sales.scanDifferentBattery') || 'Scan Different Battery'}</span>
          </button>
        )}

        <p className="scan-hint" style={{ marginTop: '16px', fontSize: '12px' }}>
          <InfoIcon />
          {t('sales.firstBatteryPromo')}
        </p>
      </div>
    );
  }

  // Initial state - No battery scanned yet
  // Uses shared BatteryInputSelector component with mode="assign"
  return (
    <div className="screen active">
      {/* Customer Preview Card - Sales-specific context before scanner */}
      <CustomerPreviewCard
        customerName={customerName}
        initials={initials}
        phone={formData.phone}
        email={formData.email}
        planName={selectedPlan?.name}
        subscriptionCode={subscriptionCode}
      />

      {/* Battery Selector - Shared BatteryInputSelector component */}
      {/* Note: BLE progress/errors are handled by BleProgressModal at the flow level */}
      <BatteryInputSelector
        mode="assign"
        onScan={onScanBattery}
        onDeviceSelect={handleDeviceSelect}
        detectedDevices={detectedDevices}
        isScanning={isBleScanning}
        onStartScan={onStartScan}
        selectedDeviceMac={selectedDeviceMac}
        isScannerOpening={isScannerOpening}
        inputMode={inputMode}
        onInputModeChange={onInputModeChange}
      />
    </div>
  );
}

/**
 * CustomerPreviewCard - Shows customer info context before battery scan
 * Sales-specific component that displays customer details.
 */
function CustomerPreviewCard({
  customerName,
  initials,
  phone,
  email,
  planName,
  subscriptionCode,
}: {
  customerName: string;
  initials: string;
  phone: string;
  email: string;
  planName?: string;
  subscriptionCode?: string;
}) {
  const { t } = useI18n();
  
  return (
    <div className="preview-card" style={{ marginBottom: '16px' }}>
      <div className="preview-header">
        <div className="preview-avatar">{initials}</div>
        <div>
          <div className="preview-name">{customerName}</div>
          <div className="preview-phone font-mono-oves">{phone || '+254 XXX XXX XXX'}</div>
        </div>
        <span className="preview-badge">{planName || 'No Plan'}</span>
      </div>
      <div className="preview-details">
        <div className="detail-item">
          <div className="detail-label">{t('sales.emailAddress')}</div>
          <div className="detail-value">{email || 'N/A'}</div>
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
  );
}

// Helper icon component
function InfoIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ width: '14px', height: '14px' }}
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}
