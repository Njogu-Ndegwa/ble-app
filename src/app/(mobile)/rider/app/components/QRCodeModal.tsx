"use client";

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '@/i18n';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  subscriptionCode?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, customerId, subscriptionCode }) => {
  const { t } = useI18n();
  const [transactionId, setTransactionId] = useState('');
  const [showQR, setShowQR] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-generate QR code when modal opens with subscription code
  useEffect(() => {
    if (isOpen && subscriptionCode && canvasRef.current) {
      // Reset state when modal opens
      setShowQR(false);
      setTransactionId('');
      
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
        } else {
          setShowQR(true);
        }
      });
    } else if (isOpen && !subscriptionCode) {
      // Reset state if no subscription code
      setShowQR(false);
      setTransactionId('');
    }
  }, [isOpen, subscriptionCode]);

  useEffect(() => {
    if (showQR && transactionId.trim() && canvasRef.current && !subscriptionCode) {
      // Only use transaction ID flow if no subscription code is provided
      const qrData = JSON.stringify({
        type: 'payment_verification',
        customerId: customerId || 'unknown',
        transactionId: transactionId,
        timestamp: new Date().toISOString(),
      });

      QRCode.toCanvas(canvasRef.current, qrData, {
        width: 180,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }, (error) => {
        if (error) console.error('QR code generation error:', error);
      });
    }
  }, [showQR, transactionId, customerId, subscriptionCode]);

  const handleGenerateQR = () => {
    if (transactionId.trim()) {
      setShowQR(true);
    }
  };

  const handleReset = () => {
    setShowQR(false);
    setTransactionId('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // If subscription code is provided, show QR directly
  const shouldShowTransactionInput = !subscriptionCode;

  if (!isOpen) return null;

  return (
    <div className={`qr-modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="qr-modal">
        <div className="qr-modal-header">
          <h3 className="qr-modal-title">
            {subscriptionCode 
              ? (t('rider.myQrCode') || 'My QR Code')
              : (t('rider.paymentQrCode') || 'Payment QR Code')
            }
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
          ) : !showQR ? (
            // Show transaction ID input if no subscription code
            <div className="qr-input-section">
              <p className="qr-modal-desc">
                {t('rider.qrPaymentDesc') || 'Enter your payment transaction ID from MTN Mobile Money, Flooz, or bank transfer to generate a QR code for the attendant.'}
              </p>
              
              <div className="qr-input-group">
                <label className="qr-input-label">{t('sales.transactionId') || 'Transaction ID'}</label>
                <input 
                  type="text" 
                  className="qr-input" 
                  placeholder={t('rider.transactionIdPlaceholder') || 'e.g. TXN-892741 or transaction code'}
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              
              <button 
                className="qr-generate-btn" 
                onClick={handleGenerateQR}
                disabled={!transactionId.trim()}
                style={{ opacity: transactionId.trim() ? 1 : 0.5 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                {t('rider.generateQrCode') || 'Generate QR Code'}
              </button>
            </div>
          ) : (
            // Show transaction QR code
            <div className="qr-display-section">
              <div className="qr-code-container">
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
              <div className="qr-transaction-info">
                <span className="qr-transaction-label">{t('sales.transactionId') || 'Transaction ID'}:</span>
                <span className="qr-transaction-value">{transactionId}</span>
              </div>
              <p className="qr-instruction">
                {t('rider.qrVerifyDesc') || 'Show this QR code to the swap attendant to verify your payment.'}
              </p>
              
              <button className="qr-new-btn" onClick={handleReset}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                {t('rider.enterNewTransaction') || 'Enter New Transaction'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;

