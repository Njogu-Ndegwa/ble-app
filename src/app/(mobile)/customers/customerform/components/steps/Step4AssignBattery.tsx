'use client';

import React from 'react';
import { CreditCard, CheckCircle, RefreshCw, Gift, Zap, AlertCircle, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { 
  BatteryInputSelector,
  BatteryCard,
  getInitials,
} from '@/components/shared';
import type { BatteryData, BleDevice, BatteryInputMode } from '@/components/shared';
import { CustomerFormData, PlanData } from '../types';
import { calculateSwapPayment } from '@/lib/swap-payment';

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
  /** Callback to stop BLE scanning */
  onStopScan?: () => void;
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
  /** Rate per kWh (from customer identification) */
  rate?: number;
  /** Currency symbol (from customer identification) */
  currencySymbol?: string;
  /** Whether customer has been identified (rate is available) */
  customerIdentified?: boolean;
  /** Whether customer identification is in progress (including retries) */
  isIdentifying?: boolean;
  /** Whether customer identification has failed after all retries */
  identificationFailed?: boolean;
  /** Callback for manual identification retry */
  onManualIdentify?: () => void;
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
  onStopScan,
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
  rate = 0,
  currencySymbol = '',
  customerIdentified = false,
  isIdentifying = false,
  identificationFailed = false,
  onManualIdentify,
}: Step4Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate energy cost using centralized calculateSwapPayment function
  // This ensures consistent rounding behavior with the Attendant flow
  const paymentCalc = scannedBattery && rate > 0
    ? calculateSwapPayment({
        newBatteryEnergyWh: scannedBattery.energy,
        oldBatteryEnergyWh: 0, // First-time customer - no old battery
        ratePerKwh: rate,
        quotaTotal: 0, // First-time customer - no quota
        quotaUsed: 0,
      })
    : null;
  
  const energyKwh = paymentCalc?.energyDiff ?? 0;
  const calculatedCost = paymentCalc?.cost ?? 0;

  // Handle device selection
  const handleDeviceSelect = (device: BleDevice) => {
    if (onDeviceSelect) {
      onDeviceSelect(device);
    }
  };

  // If battery has been scanned, show compact battery details + rescan option
  // Complete Service is handled by the bottom action bar (SalesActionBar)
  if (scannedBattery) {
    return (
      <div className="screen active" style={{ paddingTop: '8px' }}>
        {/* Battery Success Card using shared component - compact variant */}
        <BatteryCard
          battery={scannedBattery}
          variant="success"
          title={t('sales.newBattery')}
          compact
        />

        {/* Identification Status / First-Time Customer Discount Card */}
        {identificationFailed ? (
          <IdentificationFailedCard onRetry={onManualIdentify} />
        ) : (
          <FirstTimeDiscountCard
            energyKwh={energyKwh}
            rate={rate}
            cost={calculatedCost}
            currencySymbol={currencySymbol || selectedPlan?.currencySymbol || 'KES'}
            isLoading={isIdentifying || (!customerIdentified && rate === 0)}
          />
        )}

        {/* Customer Summary - Ultra Compact inline row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '6px 8px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '6px',
          marginBottom: '10px'
        }}>
          <div className="preview-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: '12px' }}>{customerName}</div>
            <div className="font-mono-oves" style={{ fontSize: '10px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subscriptionCode || formData.phone}
            </div>
          </div>
        </div>

        {/* Rescan Battery Button - allows scanning a different battery */}
        {onRescanBattery && !isCompletingService && (
          <button
            className="rescan-battery-btn"
            onClick={onRescanBattery}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={14} />
            <span>{t('sales.scanDifferentBattery') || 'Scan Different Battery'}</span>
          </button>
        )}

        <p className="scan-hint" style={{ marginTop: '10px', fontSize: '11px' }}>
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
        onStopScan={onStopScan}
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

/**
 * FirstTimeDiscountCard - Shows energy cost as first-time customer discount
 * Displays the calculated energy value that is being given as a promotional benefit
 * Compact design for tight layouts
 */
function FirstTimeDiscountCard({
  energyKwh,
  rate,
  cost,
  currencySymbol,
  isLoading = false,
}: {
  energyKwh: number;
  rate: number;
  cost: number;
  currencySymbol: string;
  isLoading?: boolean;
}) {
  const { t } = useI18n();
  
  if (isLoading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 229, 229, 0.08) 0%, rgba(0, 180, 180, 0.04) 100%)',
        border: '1px solid rgba(0, 229, 229, 0.2)',
        borderRadius: '8px',
        padding: '8px 10px',
        marginBottom: '10px',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          color: 'var(--color-text-secondary)',
          fontSize: '12px',
        }}>
          <div className="btn-spinner" style={{ width: '12px', height: '12px' }}></div>
          <span>{t('sales.loadingPricing') || 'Loading pricing...'}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0, 229, 229, 0.1) 0%, rgba(0, 180, 180, 0.05) 100%)',
      border: '1px solid rgba(0, 229, 229, 0.3)',
      borderRadius: '8px',
      padding: '8px 10px',
      marginBottom: '10px',
    }}>
      {/* Ultra compact single-row layout */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        {/* Gift icon */}
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          background: 'rgba(0, 229, 229, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Gift size={12} style={{ color: 'var(--color-primary)' }} />
        </div>
        
        {/* Label */}
        <span style={{ 
          fontWeight: 500, 
          fontSize: '12px',
          color: 'var(--color-primary)',
        }}>
          {t('sales.firstTimeDiscount') || 'First Battery Free'}:
        </span>

        {/* Energy value */}
        <span className="font-mono-oves" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          {energyKwh.toFixed(2)} kWh × {currencySymbol} {rate.toFixed(2)} =
        </span>

        {/* Cost with strikethrough + FREE */}
        <span 
          className="font-mono-oves" 
          style={{ 
            fontWeight: 600, 
            fontSize: '12px',
            color: 'var(--color-primary)',
            textDecoration: 'line-through',
            textDecorationColor: 'var(--color-success)',
            textDecorationThickness: '2px',
          }}
        >
          {currencySymbol} {cost.toFixed(2)}
        </span>
        <span style={{ 
          fontSize: '11px', 
          color: 'var(--color-success)',
          fontWeight: 600,
        }}>
          FREE
        </span>
      </div>
    </div>
  );
}

/**
 * IdentificationFailedCard - Shows when customer identification failed after retries
 * Provides a manual retry button to trigger identification again
 */
function IdentificationFailedCard({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255, 100, 100, 0.1) 0%, rgba(200, 50, 50, 0.05) 100%)',
      border: '1px solid rgba(255, 100, 100, 0.3)',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '10px',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '8px',
      }}>
        {/* Alert icon */}
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: 'rgba(255, 100, 100, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertCircle size={14} style={{ color: 'var(--color-error, #ff6464)' }} />
        </div>
        
        {/* Message */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '13px',
            color: 'var(--color-error, #ff6464)',
          }}>
            {t('sales.identificationFailed') || 'Service data unavailable'}
          </div>
          <div style={{ 
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginTop: '2px',
          }}>
            {t('sales.identificationFailedHint') || 'Unable to fetch pricing information'}
          </div>
        </div>
      </div>
      
      {/* Retry Button */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(0, 229, 229, 0.1)',
            border: '1px solid var(--color-primary)',
            borderRadius: '6px',
            color: 'var(--color-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <RotateCcw size={14} />
          <span>{t('sales.retryIdentification') || 'Retry Identification'}</span>
        </button>
      )}
    </div>
  );
}
