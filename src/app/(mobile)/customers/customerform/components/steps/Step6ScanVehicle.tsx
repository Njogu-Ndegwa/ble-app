'use client';

import React, { useCallback } from 'react';
import { CheckCircle, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ScannerArea } from '@/components/shared';
import { CustomerFormData } from '../types';

interface Step6ScanVehicleProps {
  /** Customer form data for context display */
  formData: CustomerFormData;
  /** Callback when QR scan is triggered */
  onScanVehicle: () => void;
  /** Scanned vehicle ID (null if not scanned yet) */
  scannedVehicleId?: string | null;
  /** Subscription code for context */
  subscriptionCode?: string;
  /** Callback to clear current vehicle and rescan a different one */
  onRescanVehicle?: () => void;
}

/**
 * Step6ScanVehicle - Scan vehicle QR code before battery assignment
 * 
 * When no vehicle is scanned: full scan prompt with customer context.
 * When a vehicle is already scanned: compact current-assignment card
 * plus the scanner area so the user can rescan in a single tap.
 */
export default function Step6ScanVehicle({
  formData,
  onScanVehicle,
  scannedVehicleId = null,
  subscriptionCode = '',
  onRescanVehicle,
}: Step6ScanVehicleProps) {
  const { t } = useI18n();
  
  const customerName = `${formData.firstName} ${formData.lastName}`;

  const handleRescanTap = useCallback(() => {
    onRescanVehicle?.();
    onScanVehicle();
  }, [onRescanVehicle, onScanVehicle]);

  if (scannedVehicleId) {
    return (
      <div className="screen active">
        {/* Current Assignment Card */}
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
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 200, 83, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Truck size={20} style={{ color: 'var(--color-success)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                marginBottom: '2px',
              }}>
                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                <span style={{ 
                  fontWeight: 600, 
                  fontSize: '12px',
                  color: 'var(--color-success)',
                }}>
                  {t('sales.currentVehicle') || 'Current Vehicle'}
                </span>
              </div>
              <div className="font-mono-oves" style={{ 
                fontSize: '15px', 
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}>
                {scannedVehicleId}
              </div>
            </div>
          </div>
        </div>

        {/* Scanner — single tap to replace */}
        <div className="scan-prompt">
          <h1 className="scan-title" style={{ fontSize: '18px', marginBottom: '4px' }}>
            {t('sales.scanDifferentVehicle') || 'Scan Different Vehicle'}
          </h1>
          <p className="scan-subtitle" style={{ fontSize: '13px' }}>
            {t('sales.scanToReplace') || 'Scan a new QR code to replace the current vehicle'}
          </p>

          <ScannerArea
            onClick={handleRescanTap}
            type="qr"
            label={t('common.tapToScan') || 'Tap to scan'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="screen active">
      <div className="scan-prompt">
        <h1 className="scan-title">{t('sales.scanVehicle') || 'Scan Vehicle'}</h1>
        <p className="scan-subtitle">{t('sales.scanVehicleQr') || 'Scan the vehicle QR code'}</p>
        
        <ScannerArea 
          onClick={onScanVehicle} 
          type="qr" 
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
