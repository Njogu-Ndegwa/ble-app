'use client';

import React from 'react';
import { CheckCircle, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ScannerArea } from '@/components/shared';
import { CustomerFormData } from '../types';

interface Step6ScanVehicleProps {
  /** Customer form data for context display */
  formData: CustomerFormData;
  /** Callback when QR scan is triggered */
  onScanVehicle: () => void;
  /** Whether scanner is currently opening (prevents multiple opens) */
  isScannerOpening?: boolean;
  /** Scanned vehicle ID (null if not scanned yet) */
  scannedVehicleId?: string | null;
  /** Subscription code for context */
  subscriptionCode?: string;
}

/**
 * Step6ScanVehicle - Scan vehicle QR code before battery assignment
 * 
 * This step captures the vehicle ID that the customer is purchasing.
 * It's a simple QR scan step - no BLE connection needed.
 * 
 * Flow:
 * 1. User scans vehicle QR code
 * 2. Vehicle ID is captured and stored
 * 3. User proceeds to battery assignment
 */
export default function Step6ScanVehicle({
  formData,
  onScanVehicle,
  isScannerOpening = false,
  scannedVehicleId = null,
  subscriptionCode = '',
}: Step6ScanVehicleProps) {
  const { t } = useI18n();
  
  const customerName = `${formData.firstName} ${formData.lastName}`;

  // If vehicle has been scanned, show success state
  if (scannedVehicleId) {
    return (
      <div className="screen active">
        {/* Vehicle Scanned Success Card */}
        <div className="preview-card" style={{ 
          marginBottom: '16px',
          borderColor: 'var(--color-success)',
          background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.1) 0%, rgba(0, 150, 60, 0.05) 100%)',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '4px 0',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(0, 200, 83, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Truck size={24} style={{ color: 'var(--color-success)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                marginBottom: '4px',
              }}>
                <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                <span style={{ 
                  fontWeight: 600, 
                  fontSize: '14px',
                  color: 'var(--color-success)',
                }}>
                  {t('sales.vehicleScanned') || 'Vehicle Scanned'}
                </span>
              </div>
              <div className="font-mono-oves" style={{ 
                fontSize: '16px', 
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}>
                {scannedVehicleId}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Context - Compact */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 10px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <div className="preview-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
            {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: '13px' }}>{customerName}</div>
            {subscriptionCode && (
              <div className="font-mono-oves" style={{ 
                fontSize: '11px', 
                color: 'var(--color-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {subscriptionCode}
              </div>
            )}
          </div>
        </div>

        {/* Proceed hint */}
        <p className="scan-hint" style={{ marginTop: '8px', fontSize: '12px' }}>
          <InfoIcon />
          {t('sales.vehicleScannedProceed') || 'Tap Continue below to assign battery'}
        </p>
      </div>
    );
  }

  // Initial state - prompt to scan vehicle
  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">{t('sales.scanVehicle') || 'Scan Vehicle'}</h1>
        <p className="scan-subtitle">{t('sales.scanVehicleQr') || 'Scan the vehicle QR code'}</p>
        
        <ScannerArea 
          onClick={onScanVehicle} 
          type="qr" 
          disabled={isScannerOpening}
          label={t('common.tapToScan') || 'Tap to scan'}
        />
        
        <p className="scan-hint">
          <InfoIcon />
          {t('sales.vehicleScanHint') || 'Scan the QR code on the vehicle being assigned to customer'}
        </p>
      </div>

      {/* Customer Context Card */}
      <div className="preview-card" style={{ marginTop: '16px' }}>
        <div className="preview-header">
          <div className="preview-avatar">
            {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
          </div>
          <div>
            <div className="preview-name">{customerName}</div>
            <div className="preview-phone font-mono-oves">{formData.phone || formData.email || 'N/A'}</div>
          </div>
        </div>
        {subscriptionCode && (
          <div className="preview-details">
            <div className="detail-item">
              <div className="detail-label">{t('sales.subscriptionId') || 'Subscription ID'}</div>
              <div className="detail-value font-mono-oves" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                {subscriptionCode}
              </div>
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
