'use client';

import React from 'react';
import { CreditCard, CheckCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { 
  ScannerArea,
  BatteryCard,
  getInitials,
} from '@/components/shared';
import type { BatteryData, BleScanState } from '@/components/shared';
import { CustomerFormData, PlanData } from '../types';

interface Step4Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  onScanBattery: () => void;
  isBleScanning?: boolean;
  detectedDevicesCount?: number;
  isScannerOpening?: boolean;
  plans: PlanData[];
  subscriptionCode?: string;
  scannedBattery?: BatteryData | null;
  onCompleteService?: () => void;
  isCompletingService?: boolean;
  bleScanState?: BleScanState;
  onCancelBleOperation?: () => void;
  onRetryConnection?: () => void;
}

/**
 * Step4AssignBattery - Assign battery to new customer
 * 
 * Uses shared ScannerArea and BatteryCard components
 */
export default function Step4AssignBattery({ 
  formData, 
  selectedPlanId, 
  onScanBattery,
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

        <p className="scan-hint" style={{ marginTop: '16px', fontSize: '12px' }}>
          <InfoIcon />
          {t('sales.firstBatteryPromo')}
        </p>
      </div>
    );
  }

  // Initial state - No battery scanned yet
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>
        {t('sales.assignBattery')}
      </h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '10px' }}>
        {t('sales.scanBatteryQr')}
      </p>

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

      {/* Battery Scanner using shared component */}
      <ScannerArea 
        onClick={onScanBattery} 
        type="battery" 
        disabled={isScannerOpening}
        label={t('common.tapToScan') || 'Tap to scan'}
      />

      <p className="scan-hint">
        <InfoIcon />
        {t('sales.scanBatteryQr')}
      </p>
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
