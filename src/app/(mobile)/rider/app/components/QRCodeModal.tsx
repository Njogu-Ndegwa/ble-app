"use client";

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '@/i18n';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, customerId }) => {
  const { t } = useI18n();
  const [transactionId, setTransactionId] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code when showQR changes
  useEffect(() => {
    if (showQR && transactionId.trim() && canvasRef.current) {
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
  }, [showQR, transactionId, customerId]);

  const handleGenerateQR = () => {
    if (transactionId.trim()) {
      setShowQR(true);
    }
  };

  const handleReset = () => {
    setShowQR(false);
    setTransactionId('');
    setQrDataUrl('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`qr-modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="qr-modal">
        <div className="qr-modal-header">
          <h3 className="qr-modal-title">{t('Payment QR Code')}</h3>
          <button className="qr-modal-close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="qr-modal-body">
          {!showQR ? (
            /* Input Section */
            <div className="qr-input-section">
              <p className="qr-modal-desc">
                {t('Enter your payment transaction ID from MTN Mobile Money, Flooz, or bank transfer to generate a QR code for the attendant.')}
              </p>
              
              <div className="qr-input-group">
                <label className="qr-input-label">{t('Transaction ID')}</label>
                <input 
                  type="text" 
                  className="qr-input" 
                  placeholder={t('e.g. TXN-892741 or M-PESA code')}
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
                {t('Generate QR Code')}
              </button>
            </div>
          ) : (
            /* QR Display Section */
            <div className="qr-display-section">
              <div className="qr-code-container">
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
              <div className="qr-transaction-info">
                <span className="qr-transaction-label">{t('Transaction ID')}:</span>
                <span className="qr-transaction-value">{transactionId}</span>
              </div>
              <p className="qr-instruction">
                {t('Show this QR code to the swap attendant to verify your payment.')}
              </p>
              
              <button className="qr-new-btn" onClick={handleReset}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                {t('Enter New Transaction')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
