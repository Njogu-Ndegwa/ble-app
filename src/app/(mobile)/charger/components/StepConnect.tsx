"use client";

/**
 * Step 3 — connect to the charger.
 *
 * This is the original MVP scan/connect screen, unchanged in behaviour except
 * that it now hands the connected charger up to the flow instead of owning the
 * dispense UI itself.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BatteryCharging, Bluetooth, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

import {
  connBleByMacAddress,
  disconnBleByMacAddress,
  initServiceBleData,
} from '@/app/utils';
import { useBridge } from '@/app/context/bridgeContext';
import { useI18n } from '@/i18n';
import type { ConnectedCharger, GattService } from '../lib/types';

const EMA_ALPHA = 0.3;
const CONNECT_TIMEOUT_MS = 30_000;

/**
 * Only devices whose advertised name contains this string are listed.
 * TODO: narrow to the charger's real name prefix once hardware is available —
 * today this also lists batteries, which the operator has to skip past.
 */
const DEVICE_NAME_FILTER = 'OVES';

/** Charge control lives in CMD, per Esther's confirmation that the charger
 *  reuses the battery ATT/CMD/STS/DTA/DIA service structure. */
const CONTROL_SERVICE = 'CMD';

interface ChargerDevice {
  macAddress: string;
  name: string;
  rawRssi: number;
  smoothedRssi: number;
}

interface StepConnectProps {
  onBack: () => void;
  onConnected: (charger: ConnectedCharger) => void;
}

export default function StepConnect({ onBack, onConnected }: StepConnectProps) {
  const { t } = useI18n();
  const { bridge } = useBridge();

  const [devices, setDevices] = useState<ChargerDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingMac, setConnectingMac] = useState<string | null>(null);
  const [serviceProgress, setServiceProgress] = useState(0);
  const [loadingService, setLoadingService] = useState(false);

  const devicesRef = useRef<ChargerDevice[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedMacRef = useRef<string | null>(null);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);

  const flushDeviceBatch = useCallback(() => {
    batchTimerRef.current = null;
    setDevices(devicesRef.current);
  }, []);

  const scheduleDeviceBatch = useCallback(() => {
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(flushDeviceBatch, 300);
    }
  }, [flushDeviceBatch]);

  const setupBridge = useCallback(
    (b: NonNullable<ReturnType<typeof useBridge>['bridge']>) => {
      const noop = () => {};
      const reg = (name: string, handler: any) => {
        b.registerHandler(name, handler);
        return () => b.registerHandler(name, noop);
      };

      const offFind = reg(
        'findBleDeviceCallBack',
        (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
          try {
            const d = JSON.parse(data);
            if (
              d.macAddress && d.name && d.rssi != null
              && String(d.name).includes(DEVICE_NAME_FILTER)
            ) {
              const mac = String(d.macAddress).trim().toUpperCase();
              const raw = Number(d.rssi);
              const prev = devicesRef.current;
              const existing = prev.find((p) => p.macAddress === mac);
              const smoothedRssi = existing
                ? EMA_ALPHA * raw + (1 - EMA_ALPHA) * existing.smoothedRssi
                : raw;
              const next = existing
                ? prev.map((p) => (p.macAddress === mac ? { ...p, rawRssi: raw, smoothedRssi } : p))
                : [...prev, { macAddress: mac, name: d.name, rawRssi: raw, smoothedRssi }];
              devicesRef.current = [...next].sort((a, z) => z.smoothedRssi - a.smoothedRssi);
              scheduleDeviceBatch();
              resp({ success: true });
            } else {
              resp({ success: false, error: 'filtered' });
            }
          } catch (err: any) {
            resp({ success: false, error: err?.message });
          }
        },
      );

      const offConnectFail = reg('bleConnectFailCallBack', (data: string, resp: any) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setConnectingMac(null);
        toast.error(t('charger.connectFailed'), { id: 'charger-connect' });
        resp(data);
      });

      const offConnectSuccess = reg(
        'bleConnectSuccessCallBack',
        (macAddress: string, resp: any) => {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          const mac = macAddress.trim().toUpperCase();
          sessionStorage.setItem('connectedDeviceMac', mac);
          connectedMacRef.current = mac;
          setIsScanning(false);
          setServiceProgress(0);
          setLoadingService(true);
          initServiceBleData({ serviceName: CONTROL_SERVICE, macAddress: mac });
          resp(macAddress);
        },
      );

      const offSvcProgress = reg('bleInitServiceDataOnProgressCallBack', (data: string) => {
        try {
          const p = JSON.parse(data);
          setServiceProgress(Math.round((p.progress / p.total) * 100));
        } catch {
          /* ignore */
        }
      });

      const offSvcComplete = reg(
        'bleInitServiceDataOnCompleteCallBack',
        (data: string, resp: any) => {
          try {
            const parsed: GattService = JSON.parse(data);
            const mac = connectedMacRef.current;
            setConnectingMac(null);
            setLoadingService(false);
            setServiceProgress(100);
            if (mac) {
              const device = devicesRef.current.find((d) => d.macAddress === mac);
              onConnectedRef.current({
                macAddress: mac,
                name: device?.name || t('charger.charger'),
                controlService: parsed,
              });
            }
          } catch {
            setLoadingService(false);
            setConnectingMac(null);
            toast.error(t('charger.serviceLoadFailed'));
          }
          resp(data);
        },
      );

      const offSvcFail = reg('bleInitServiceDataFailureCallBack', (data: string, resp: any) => {
        setConnectingMac(null);
        setLoadingService(false);
        toast.error(t('charger.serviceLoadFailed'));
        resp(data);
      });

      return () => {
        offFind();
        offConnectFail();
        offConnectSuccess();
        offSvcProgress();
        offSvcComplete();
        offSvcFail();
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current);
          batchTimerRef.current = null;
        }
        b.callHandler('stopBleScan', '', () => {});
      };
    },
    [scheduleDeviceBatch, t],
  );

  useEffect(() => {
    if (!bridge) return;
    return setupBridge(bridge);
  }, [bridge, setupBridge]);

  const startBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;
    devicesRef.current = [];
    setDevices([]);
    window.WebViewJavascriptBridge.callHandler('startBleScan', '', () => {});
    setIsScanning(true);
  }, []);

  const stopBleScan = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
      flushDeviceBatch();
    }
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    }
    setIsScanning(false);
  }, [flushDeviceBatch]);

  // Auto-start scanning once the bridge is ready (same pattern as Keypad —
  // handlers are registered in the effect above, which runs first).
  useEffect(() => {
    if (!bridge) return;
    const id = setTimeout(() => startBleScan(), 300);
    return () => {
      clearTimeout(id);
      stopBleScan();
    };
  }, [bridge, startBleScan, stopBleScan]);

  const connectToCharger = (mac: string) => {
    if (connectingMac) return;
    stopBleScan();
    setConnectingMac(mac);
    connBleByMacAddress(mac);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null;
      setConnectingMac(null);
      toast.error(t('charger.connectTimedOut'), { id: 'charger-connect' });
    }, CONNECT_TIMEOUT_MS);
  };

  // Nothing here works without the Android shell's bridge. Say so explicitly
  // instead of leaving a dead Scan button and an empty list.
  if (!bridge) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, padding: 12, fontSize: 13,
            background: 'var(--error-soft, var(--bg-secondary))',
            color: 'var(--error, var(--text-primary))',
            border: '1px solid var(--error, var(--border))', borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t('charger.bridgeUnavailable')}</span>
        </div>
        <button type="button" onClick={onBack} className="btn btn-secondary" style={{ width: '100%' }}>
          {t('sales.back') || 'Back'}
        </button>
      </div>
    );
  }

  if (loadingService) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Loader2
          size={28}
          className="animate-spin"
          style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }}
        />
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
          {t('charger.readingData')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {serviceProgress}%
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('charger.connectTitle')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('charger.connectHint')}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bluetooth size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('charger.nearby')}
          </span>
          {isScanning && (
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <button
          className="btn btn-secondary"
          style={{ flex: '0 0 auto', padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => (isScanning ? stopBleScan() : startBleScan())}
        >
          <RefreshCw size={13} />
          {isScanning ? t('charger.stop') : t('charger.scan')}
        </button>
      </div>

      {devices.length === 0 ? (
        <div
          style={{
            textAlign: 'center', padding: '48px 24px',
            border: '1px dashed var(--border-primary, #333)', borderRadius: 12,
            color: 'var(--text-muted)', fontSize: 14,
          }}
        >
          {isScanning ? t('charger.searching') : t('charger.noDevices')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map((d) => {
            const isThisConnecting = connectingMac === d.macAddress;
            return (
              <button
                key={d.macAddress}
                onClick={() => connectToCharger(d.macAddress)}
                disabled={!!connectingMac}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderRadius: 12, border: '1px solid var(--border-primary, #333)',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))', textAlign: 'left',
                  opacity: connectingMac && !isThisConnecting ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(34,197,94,0.12)',
                  }}
                >
                  <BatteryCharging size={20} style={{ color: '#22c55e' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {d.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {d.macAddress} · {Math.round(d.smoothedRssi)}dB
                  </div>
                </div>
                {isThisConnecting ? (
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>
                    {t('charger.connect')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          const mac = connectedMacRef.current;
          if (mac) disconnBleByMacAddress(mac, () => {});
          onBack();
        }}
        style={{
          width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
          color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
        }}
      >
        {t('sales.back') || 'Back'}
      </button>
    </div>
  );
}
