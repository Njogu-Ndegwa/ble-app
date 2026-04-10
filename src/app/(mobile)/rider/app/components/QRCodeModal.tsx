"use client";

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '@/i18n';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  subscriptionCode?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, subscriptionCode }) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-generate QR code when modal opens with subscription code
  useEffect(() => {
    if (isOpen && subscriptionCode && canvasRef.current) {
      // Generate QR code with subscription code
      const qrData = subscriptionCode;
      
      QRCode.toCanvas(canvasRef.current, qrData, {
        width: 180,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }, (error) => {
        if (error) {
          console.error('QR code generation error:', error);
        }
      });
    }
  }, [isOpen, subscriptionCode]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`qr-modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="qr-modal">
        <div className="qr-modal-header">
          <h3 className="qr-modal-title">
            {t('rider.myQrCode') || 'My QR Code'}
          </h3>
          <button className="qr-modal-close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="qr-modal-body">
          {subscriptionCode ? (
            // Show QR code directly with subscription code
            <div className="qr-display-section">
              <div className="qr-code-container">
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
              <div className="qr-transaction-info">
                <span className="qr-transaction-label">{t('rider.subscriptionCode') || 'Subscription Code'}:</span>
                <span className="qr-transaction-value">{subscriptionCode}</span>
              </div>
              <p className="qr-instruction">
                {t('rider.qrIdentifyDesc') || 'Show this QR code to the swap attendant to identify your account.'}
              </p>
            </div>
          ) : (
            // Show no QR code available message
            <div className="qr-display-section" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                margin: '0 auto 24px',
                borderRadius: '50%',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px', color: 'var(--text-muted)' }}>
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2"/>
                </svg>
              </div>
              <h4 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: 'var(--text-primary)', 
                marginBottom: '8px' 
              }}>
                {t('rider.noQrCodeAvailable') || 'No QR Code Available'}
              </h4>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--text-muted)', 
                lineHeight: '1.5' 
              }}>
                {t('rider.noQrCodeDesc') || 'You need an active subscription to generate a QR code. Please contact support or subscribe to a plan.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
