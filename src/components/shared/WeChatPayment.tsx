'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n';
import {
  initiateZPay,
  verifyZPay,
  getOrderStatus,
  type InitiateZPayResponse,
} from '@/lib/odoo-api';

interface WeChatPaymentProps {
  orderId: number;
  amount: number;
  productName?: string;
  currencySymbol?: string;
  authToken?: string;
  onPaid: (tradeNo: string, totalPaid: number) => void;
  onError: (message: string) => void;
  isProcessing?: boolean;
}

type WeChatStatus = 'idle' | 'loading' | 'qr-ready' | 'polling' | 'verifying' | 'paid' | 'error';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export default function WeChatPayment({
  orderId,
  amount,
  productName,
  currencySymbol = 'KES',
  authToken,
  onPaid,
  onError,
  isProcessing = false,
}: WeChatPaymentProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<WeChatStatus>('idle');
  const [qrData, setQrData] = useState<InitiateZPayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const tradeNoRef = useRef<string>('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartRef.current = Date.now();
    setPollElapsed(0);
    setStatus('polling');

    pollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      const elapsed = Date.now() - pollStartRef.current;
      setPollElapsed(elapsed);

      if (elapsed >= POLL_TIMEOUT_MS) {
        stopPolling();
        setStatus('qr-ready');
        return;
      }

      try {
        const res = await getOrderStatus(orderId, authToken);
        if (
          res.success &&
          res.order &&
          (res.order.payment_status === 'paid' || res.order.remaining_amount <= 0.01)
        ) {
          stopPolling();
          if (!mountedRef.current) return;
          setStatus('paid');
          onPaid(tradeNoRef.current, res.order.paid_amount);
        }
      } catch {
        // polling errors are non-fatal — keep trying
      }
    }, POLL_INTERVAL_MS);
  }, [orderId, authToken, onPaid, stopPolling]);

  const handleInitiate = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const res = await initiateZPay(
        { order_id: orderId, amount, product_name: productName },
        authToken,
      );
      if (!mountedRef.current) return;

      if (res.success && (res.qr_img || res.pay_url)) {
        setQrData(res);
        tradeNoRef.current = res.trade_no;
        setStatus('qr-ready');
        startPolling();
      } else {
        throw new Error(res.message || 'Failed to create Z-Pay order');
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err.message || 'Failed to initiate WeChat payment';
      setError(msg);
      setStatus('error');
      onError(msg);
    }
  }, [orderId, amount, productName, authToken, onError, startPolling]);

  const handleVerify = useCallback(async () => {
    setStatus('verifying');
    setError(null);

    try {
      const res = await verifyZPay(
        { order_id: orderId, trade_no: tradeNoRef.current || undefined },
        authToken,
      );
      if (!mountedRef.current) return;

      if (res.paid) {
        stopPolling();
        setStatus('paid');
        onPaid(tradeNoRef.current, res.total_paid ?? amount);
      } else {
        setStatus('qr-ready');
        setError(res.message || 'Payment not yet received');
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err.message || 'Verification failed';
      setError(msg);
      setStatus('qr-ready');
    }
  }, [orderId, authToken, amount, onPaid, stopPolling]);

  // Auto-initiate on mount
  useEffect(() => {
    if (status === 'idle' && orderId && !isProcessing) {
      handleInitiate();
    }
  }, [status, orderId, isProcessing, handleInitiate]);

  const pollProgress = Math.min(pollElapsed / POLL_TIMEOUT_MS, 1);
  const pollSecondsLeft = Math.max(0, Math.ceil((POLL_TIMEOUT_MS - pollElapsed) / 1000));

  const qrSrc = qrData?.qr_img || qrData?.pay_url || '';

  return (
    <div className="wechat-payment" style={{ textAlign: 'center', padding: '0 16px 80px' }}>
      {(status === 'loading') && (
        <div style={{ padding: '40px 0' }}>
          <div className="spinner" style={{
            width: 40, height: 40, margin: '0 auto 16px',
            border: '3px solid var(--color-border)',
            borderTopColor: '#07C160',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Generating WeChat QR code...
          </p>
        </div>
      )}

      {(status === 'qr-ready' || status === 'polling' || status === 'verifying') && qrSrc && (
        <>
          <p style={{
            fontSize: 14,
            color: 'var(--color-text-secondary)',
            marginBottom: 12,
          }}>
            Scan with WeChat to pay
          </p>

          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 16,
            display: 'inline-block',
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <img
              src={qrSrc}
              alt="Scan with WeChat"
              style={{ width: 180, height: 180, display: 'block' }}
            />
          </div>

          {qrData?.trade_no && (
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
              Ref: {qrData.trade_no}
            </p>
          )}

          {status === 'polling' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: 'var(--color-border)',
                overflow: 'hidden',
                marginBottom: 6,
              }}>
                <div style={{
                  height: '100%',
                  width: `${pollProgress * 100}%`,
                  background: '#07C160',
                  borderRadius: 2,
                  transition: 'width 1s linear',
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Waiting for payment... {pollSecondsLeft}s remaining
              </p>
            </div>
          )}

          {error && (
            <p style={{
              fontSize: 13,
              color: 'var(--color-warning)',
              marginBottom: 12,
              padding: '8px 12px',
              background: 'var(--color-warning-soft)',
              borderRadius: 8,
            }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleVerify}
              disabled={status === 'verifying'}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid #07C160',
                background: 'transparent',
                color: '#07C160',
                fontWeight: 600,
                fontSize: 14,
                cursor: status === 'verifying' ? 'not-allowed' : 'pointer',
                opacity: status === 'verifying' ? 0.6 : 1,
              }}
            >
              {status === 'verifying' ? 'Checking...' : 'Verify Payment'}
            </button>

            <button
              type="button"
              onClick={handleInitiate}
              disabled={status === 'verifying'}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontWeight: 500,
                fontSize: 14,
                cursor: status === 'verifying' ? 'not-allowed' : 'pointer',
                opacity: status === 'verifying' ? 0.6 : 1,
              }}
            >
              New QR
            </button>
          </div>
        </>
      )}

      {status === 'paid' && (
        <div style={{ padding: '32px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
            background: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#07C160' }}>
            Payment received
          </p>
        </div>
      )}

      {status === 'error' && !qrSrc && (
        <div style={{ padding: '32px 0' }}>
          <p style={{ color: 'var(--color-error)', marginBottom: 16 }}>{error}</p>
          <button
            type="button"
            onClick={handleInitiate}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#07C160',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
