'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBridge } from '@/app/context/bridgeContext';
import { parseCustomerQr, type ParsedCustomerQr } from '@/lib/qr/parseCustomerQr';

/**
 * Native customer-QR scanning, encapsulated so any applet can reuse the exact
 * mechanism the swap (attendant) / sales workflows use:
 *   1. `bridge.callHandler('startQrCodeScan', …)` opens the native scanner.
 *   2. The native app calls back the registered `scanQrcodeResultCallBack`
 *      handler with `{ respData: { value: "<qr text>" } }`.
 *   3. The QR text is parsed (`parseCustomerQr`) and handed to `onScanned`.
 *
 * It owns the fragile bits that were previously copy-pasted into AttendantFlow
 * and SalesFlow: a synchronous busy guard (React state is stale within a tick),
 * a safety timeout, and a visibility-resume recovery so a scanner that closes
 * without firing the JS callback can't leave the trigger permanently disabled.
 *
 * Outside the native WebView there is no bridge: `scannerAvailable` is false and
 * `startScan()` invokes `onUnavailable` instead of opening anything, so callers
 * can fall back to manual entry.
 */
interface UseQrScanOptions {
  /** Fired with parsed customer data when a QR is read successfully. */
  onScanned: (data: ParsedCustomerQr) => void;
  /** Fired when the scan returns nothing usable (cancelled or unreadable). */
  onUnreadable?: () => void;
  /** Fired synchronously when startScan runs but the native bridge isn't ready. */
  onUnavailable?: () => void;
}

interface UseQrScanResult {
  /** Open the native scanner (or call onUnavailable when there's no bridge). */
  startScan: () => void;
  /** True from tap until the native result/timeout — drive the scanner's disabled state. */
  isScannerOpening: boolean;
  /** True only inside the native WebView, where scanning actually works. */
  scannerAvailable: boolean;
}

// Reset the trigger if the native scanner never returns a JS callback.
const SCAN_TIMEOUT_MS = 60000;

export function useQrScan({
  onScanned,
  onUnreadable,
  onUnavailable,
}: UseQrScanOptions): UseQrScanResult {
  const { bridge, isBridgeReady } = useBridge();
  const [isScannerOpening, setIsScannerOpening] = useState(false);

  // Keep callbacks in a ref so the long-lived native handler (registered once
  // when the bridge becomes ready) always calls the latest closure.
  const cbRef = useRef({ onScanned, onUnreadable, onUnavailable });
  useEffect(() => {
    cbRef.current = { onScanned, onUnreadable, onUnavailable };
  });

  // Synchronous guards — React state lags a tick behind a tap.
  const busyRef = useRef(false);
  const initiatedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scannerAvailable = !!bridge && isBridgeReady;

  const startScan = useCallback(() => {
    if (busyRef.current) return;
    if (!bridge || !isBridgeReady) {
      cbRef.current.onUnavailable?.();
      return;
    }
    busyRef.current = true;
    initiatedRef.current = true;
    setIsScannerOpening(true);

    clearScanTimeout();
    timeoutRef.current = setTimeout(() => {
      busyRef.current = false;
      initiatedRef.current = false;
      setIsScannerOpening(false);
    }, SCAN_TIMEOUT_MS);

    bridge.callHandler('startQrCodeScan', 999, (ack: string) => {
      console.info('[useQrScan] startQrCodeScan native ack:', ack);
    });
  }, [bridge, isBridgeReady, clearScanTimeout]);

  // Register the native result handler once the bridge is ready.
  useEffect(() => {
    if (!bridge || !isBridgeReady) return;

    bridge.registerHandler(
      'scanQrcodeResultCallBack',
      (data: string, responseCallback: (response: unknown) => void) => {
        initiatedRef.current = false;
        busyRef.current = false;
        clearScanTimeout();
        setIsScannerOpening(false);

        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          const qrVal: string = parsed?.respData?.value || '';
          if (!qrVal) {
            // Empty value = user cancelled the native scanner.
            cbRef.current.onUnreadable?.();
            responseCallback({ success: false, cancelled: true });
            return;
          }
          const customer = parseCustomerQr(qrVal);
          if (!customer) {
            cbRef.current.onUnreadable?.();
            responseCallback({ success: false, error: 'unreadable' });
            return;
          }
          cbRef.current.onScanned(customer);
          responseCallback({ success: true });
        } catch (err) {
          console.error('[useQrScan] Error parsing QR callback:', err);
          cbRef.current.onUnreadable?.();
          responseCallback({ success: false, error: String(err) });
        }
      },
    );
  }, [bridge, isBridgeReady, clearScanTimeout]);

  // Recover stale "opening" state: some WebViews close the scanner (cancel,
  // back gesture) without ever invoking the JS callback, which would otherwise
  // leave busyRef/isScannerOpening stuck and block every future tap.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && initiatedRef.current) {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          pending = null;
          busyRef.current = false;
          initiatedRef.current = false;
          setIsScannerOpening(false);
          clearScanTimeout();
        }, 500);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (pending) clearTimeout(pending);
    };
  }, [clearScanTimeout]);

  // Clean up any pending safety timeout on unmount.
  useEffect(() => () => clearScanTimeout(), [clearScanTimeout]);

  return { startScan, isScannerOpening, scannerAvailable };
}

export default useQrScan;
