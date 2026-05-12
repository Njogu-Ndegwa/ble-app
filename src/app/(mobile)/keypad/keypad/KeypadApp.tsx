"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";

import MobileListView from "./MobileListView";
import DeviceDetailView from "./DeviceDetailView";
import ProgressiveLoading from "../../../../components/loader/progressiveLoading";
import { connBleByMacAddress, initServiceBleData, disconnBleByMacAddress } from "../../../utils";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from "@/i18n";
import KeypadNav, { type KeypadTab } from './components/KeypadNav';
import DeviceManagerProfile from '../../assets/ble-devices/components/DeviceManagerProfile';
import AppHeader from '@/components/AppHeader';
import { Power } from 'lucide-react';
import { clearAllAuth } from '@/lib/attendant-auth';

type KeypadScreen = 'devices' | 'profile';

const EMA_ALPHA = 0.3;

export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
  smoothedRssi: number;
  imageUrl?: string;
  firmwareVersion?: string;
  deviceId?: string;
}

interface MqttConfig {
  username: string;
  password: string;
  clientId: string;
  hostname: string;
  port: number;
}

interface WebViewJavascriptBridge {
  init: (
    callback: (message: any, responseCallback: (response: any) => void) => void
  ) => void;
  registerHandler: (
    handlerName: string,
    handler: (data: string, responseCallback: (response: any) => void) => void
  ) => void;
  callHandler: (
    handlerName: string,
    data: any,
    callback: (responseData: string) => void
  ) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const itemImageMap: { [key: string]: string } = {
  PPSP: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1739505681/OVES-PRODUCTS/CROSS-GRID/Integrated%20Home%20Energy%20Systems%20-%20Oasis%E2%84%A2%20Series/ovT20-2400W/T20-2400W_efw5mh.png",
  STOV: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1738897820/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/E-STOVE-BLE-AF/E-STOVE-BLE-AF_Left_side_cvs2wl.png",
  INVE: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731914963/OVES-PRODUCTS/CROSS-GRID/xGrid_Inverter_Charger/INVP-48V-6.2KW-HF/INVP-48V-6.2KW-HP_Left_Side_2024-1118_fo0hpr.png",
  "E-3P":
    "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1733295976/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3%20Plus/E-3_L_wspsx8.png",
  "S-6":
    "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1726639186/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/S-6/F_el4vpq.png",
  "E-3":
    "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1690366674/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3/ovego-e-3-e-3_v2023114_c7mb0q.png",
  BATP: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png",
  CAMP: "https://res.cloudinary.com/oves/image/upload/v1627881710/OVES-PRODUCTS/OFF-GRID/ovCAMP%20SERIES/ovCAMP%20SERIES%20APPLIANCES/ovCamp%20Battery%20Hubs/6Ah%20ovCamp%20Hub%20Battery/6AH_W600_NB_uhlc3f.png",
  HOME: "https://res.cloudinary.com/oves/image/upload/v1724910821/OVES-PRODUCTS/OFF-GRID/LUMN-HOME%20SERIES/LUMN-HOME%20SHARED%20COMPONENTS/LumnHome%20battery%20hub/lumn-home-battery-hub_front_NBG_HDR.png",
  BATT: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
  Batt: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
  UBP1: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743147157/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-1K/UBP1K_AC_Output_250W_ee1ar3.png",
  UBP2: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743155669/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-2K/UBP_2_AC_Output_._ottb1j.png",
  BT73: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1770020682/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat30Ah/E-Mob-Bat30Ah%20New%20Shell/E-Mob-Bat30Ah_PNG_y3dfxy.png",
  BT74: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1770020635/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_PNG_poanss.png",
  BT7H: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1755251939/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat100Ah/E-Mob-Bat100Ah-PNG_egieyn.png",
  FRZR: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1770021563/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/BD-228DV%20Freezer/BD-228DV_PNG_qqnaow.png",
};

const KeypadApp: React.FC = () => {
  const router = useRouter();
  const { t } = useI18n();
  const [currentScreen, setCurrentScreen] = useState<KeypadScreen>('devices');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
  const [attributeList, setServiceAttrList] = useState<any>([]);
  const [progress, setProgress] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [attrList, setAtrrList] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState<any>("");

  const deviceDetails = selectedDevice
    ? detectedDevices.find((device) => device.macAddress === selectedDevice)
    : undefined;

  const detectedDevicesRef = useRef(detectedDevices);
  const { bridge } = useBridge();

  // Throttle device list updates to avoid re-render storms when many BLE
  // advertisements arrive (can be 10-50+/sec). Devices are accumulated in a
  // ref and flushed to React state at most every 300 ms.
  const deviceBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushDeviceBatch = useCallback(() => {
    deviceBatchTimerRef.current = null;
    const list = detectedDevicesRef.current;
    console.info(
      '[Keypad BLE] flush → rendering', list.length, 'device(s):',
      list.map(d => `${d.name} (${d.macAddress}) rssi=${d.rawRssi} smoothed=${d.smoothedRssi.toFixed(1)}`)
    );
    setDetectedDevices(list);
  }, []);

  const scheduleDeviceBatch = useCallback(() => {
    if (!deviceBatchTimerRef.current) {
      deviceBatchTimerRef.current = setTimeout(flushDeviceBatch, 300);
    }
  }, [flushDeviceBatch]);

  useEffect(() => {
    return () => {
      if (deviceBatchTimerRef.current) {
        clearTimeout(deviceBatchTimerRef.current);
        deviceBatchTimerRef.current = null;
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    };
  }, []);

  const connectedDeviceRef = useRef<string | null>(null);
  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  const selectedDeviceRef = useRef(selectedDevice);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  const handleBackToList = useCallback((alreadyDisconnected = false) => {
    if (!alreadyDisconnected && connectedDeviceRef.current) {
      disconnBleByMacAddress(connectedDeviceRef.current, (resp: any) => {
        try {
          const parsed = typeof resp === 'string' ? JSON.parse(resp) : resp;
          const ok = parsed?.respCode === '200' || parsed?.respData === true;
          if (ok) {
            toast.success(t('Disconnected from device'), { duration: 1500 });
          } else {
            toast.error(t('Failed to disconnect device'), { duration: 1500 });
          }
        } catch {
          toast.error(t('Failed to disconnect device'), { duration: 1500 });
        }
      });
    }
    setSelectedDevice(null);
    sessionStorage.removeItem("connectedDeviceMac");
    setConnectedDevice(null);
    setServiceAttrList([]);
    setAtrrList([]);
    setLoadingService(null);
    setProgress(0);
    setConnectingDeviceId(null);
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setIsConnecting(false);
  }, [t]);

  useEffect(() => {
    if (selectedDevice) {
      window.history.pushState(
        { bleDetail: true },
        "",
        window.location.pathname
      );
    }

    const handlePopState = () => {
      if (selectedDeviceRef.current) {
        handleBackToList();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedDevice, handleBackToList]);

  const startConnection = (macAddress: string) => {
    if (macAddress === connectedDevice && attributeList.length > 0) {
      setSelectedDevice(macAddress);
    } else {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      setIsConnecting(true);
      setConnectingDeviceId(macAddress);
      setProgress(0);
      connBleByMacAddress(macAddress);
      connectTimeoutRef.current = setTimeout(() => {
        connectTimeoutRef.current = null;
        setIsConnecting(false);
        setProgress(0);
        toast.error(t('Connection timed out. Please try again.'), { id: 'connect-toast' });
      }, 30_000);
    }
  };

  const getImageUrl = (name: string): string | undefined => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      const keyword = parts[1];
      const mapKey = Object.keys(itemImageMap).find(
        (k) => k.toLowerCase() === keyword.toLowerCase()
      );
      if (mapKey) {
        return itemImageMap[mapKey] || undefined;
      }
    }
    return undefined;
  };

  function convertRssiToFormattedString(
    rssi: number,
    txPower: number = -59,
    n: number = 2
  ): string {
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return t('{rssi}db ~ {distance}m', { rssi: String(rssi), distance: distance.toFixed(0) });
  }

  const setupBridge = (bridge: WebViewJavascriptBridge) => {
    const noop = () => {};
    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, noop);
    };

    // NOTE: bridge.init() is already called in bridgeContext.tsx — do NOT
    // call init() again here. Each mount re-initialising the bridge causes
    // native force-closes when navigating BLE/Keypad/MyDevices via bottom nav.

    const offPrint = reg("print", (data: string, resp: any) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.data) resp(parsed.data);
        else throw new Error("Parsed data is not in the expected format.");
      } catch (err) {
        console.error("Error parsing JSON in 'print':", err);
      }
    });

    const offFindBle = reg(
      "findBleDeviceCallBack",
      (
        data: string,
        resp: (r: { success: boolean; error?: string }) => void
      ) => {
        try {
          const d: BleDevice = JSON.parse(data);
          if (d.macAddress && d.name && d.rssi && d.name.includes("OVES")) {
            // Normalize MAC to uppercase+trimmed so it always matches the value
            // stored by bleConnectSuccessCallBack, regardless of OS/device format.
            d.macAddress = d.macAddress.trim().toUpperCase();
            const raw = Number(d.rssi);
            d.rawRssi = raw;
            d.rssi = convertRssiToFormattedString(raw);
            d.imageUrl = getImageUrl(d.name);

            const prev = detectedDevicesRef.current;
            const existing = prev.find((p) => p.macAddress === d.macAddress);
            const smoothedRssi = existing
              ? EMA_ALPHA * d.rawRssi + (1 - EMA_ALPHA) * existing.smoothedRssi
              : d.rawRssi;

            if (existing) {
              console.info(`[Keypad BLE] update  ${d.name} (${d.macAddress}) rawRssi=${raw} smoothed=${smoothedRssi.toFixed(1)}`);
            } else {
              console.info(`[Keypad BLE] NEW     ${d.name} (${d.macAddress}) rawRssi=${raw} — total now ${prev.length + 1}`);
            }

            const next = existing
              ? prev.map((p) =>
                  p.macAddress === d.macAddress
                    ? { ...p, rssi: d.rssi, rawRssi: d.rawRssi, smoothedRssi }
                    : p
                )
              : [...prev, { ...d, smoothedRssi }];

            detectedDevicesRef.current = [...next].sort((a, b) => b.smoothedRssi - a.smoothedRssi);
            scheduleDeviceBatch();

            resp({ success: true });
          } else {
            console.warn('[Keypad BLE] rejected packet (no OVES / missing fields):', d);
          }
        } catch (err: any) {
          console.error('[Keypad BLE] failed to parse BLE advertisement:', err, '| raw data:', data);
          resp({ success: false, error: err.message });
        }
      }
    );

    const offBleConnectFail = reg(
      "bleConnectFailCallBack",
      (data: string, resp: any) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        console.info('[Keypad BLE] connection FAILED — raw:', data);
        setIsConnecting(false);
        setProgress(0);
        toast.error(t('Connection failed! Please try reconnecting again.'), {
          id: "connect-toast",
        });
        resp(data);
      }
    );

    const offBleConnectSuccess = reg(
      "bleConnectSuccessCallBack",
      (macAddress: string, resp: any) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        // Normalize to match the uppercase+trimmed format used in findBleDeviceCallBack.
        const normalizedMac = macAddress.trim().toUpperCase();
        console.info('[Keypad BLE] connected to', normalizedMac, '— starting ATT service init');
        sessionStorage.setItem("connectedDeviceMac", normalizedMac);
        setConnectedDevice(normalizedMac);
        setIsScanning(false);
        const d = { serviceName: "ATT", macAddress: normalizedMac };
        setLoadingService("ATT");
        initServiceBleData(d);
        resp(macAddress);
      }
    );

    const offInitComplete = reg(
      "bleInitDataOnCompleteCallBack",
      (data: string, resp: any) => {
        const r = JSON.parse(data);
        setServiceAttrList(
          r.dataList.map((s: any, i: any) => ({ ...s, index: i }))
        );
        resp(data);
      }
    );

    const offInitData = reg(
      "bleInitDataCallBack",
      (data: string, resp: any) => {
        try {
          const p = JSON.parse(data);
          resp(p);
        } catch (err) {
          console.error(
            "Error parsing JSON data from 'bleInitDataCallBack' handler:",
            err
          );
        }
      }
    );

    const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
      try {
        const p = JSON.parse(data);
        const qrVal = p.respData.value || "";
        handleQrCode(qrVal.slice(-6).toLowerCase());
      } catch (err) {
        console.error("Error processing QR code data:", err);
      }
      resp(data);
    });

    const offMqttRecv = reg(
      "mqttMessageReceived",
      (data: string, resp: any) => {
        try {
          const p = JSON.parse(data);
          resp(p);
        } catch (err) {
          console.error("Error parsing MQTT message:", err);
        }
      }
    );

    const offInitProg = reg("bleInitDataOnProgressCallBack", (data: string) => {
      try {
        const p = JSON.parse(data);
        setProgress(Math.round((p.progress / p.total) * 100));
      } catch (err) {
        console.error("Progress callback error:", err);
      }
    });

    const offConnectMqtt = reg(
      "connectMqttCallBack",
      (data: string, resp: any) => {
        try {
          JSON.parse(data);
          setIsMqttConnected(true);
          resp("Received MQTT Connection Callback");
        } catch (err) {
          setIsMqttConnected(false);
          console.error("Error parsing MQTT connection callback:", err);
        }
      }
    );

    const offSvcProg = reg(
      "bleInitServiceDataOnProgressCallBack",
      (data: string) => {
        const p = JSON.parse(data);
        setProgress(Math.round((p.progress / p.total) * 100));
      }
    );

    const offSvcComplete = reg(
      "bleInitServiceDataOnCompleteCallBack",
      (data: string, resp: any) => {
        const parsedData = JSON.parse(data);
        setServiceAttrList((prev: any) => {
          let updated: any[];
          if (!prev || prev.length === 0) {
            updated = [parsedData];
          } else {
            const idx = prev.findIndex((s: any) => s.uuid === parsedData.uuid);
            if (idx >= 0) {
              updated = [...prev];
              updated[idx] = parsedData;
            } else {
              updated = [...prev, parsedData];
            }
          }
          // Sync attrList immediately so DeviceDetailView gets the new service
          // without waiting for the progress===100 effect, which can miss the
          // update if the native side doesn't fire a final 100% progress callback.
          setAtrrList(updated);
          return updated;
        });
        setTimeout(() => setLoadingService(null), 100);
        resp(data);
      }
    );

    const offSvcFail = reg("bleInitServiceDataFailureCallBack", () =>
      setLoadingService(null)
    );

    const generateClientId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `oves-keypad-${timestamp}-${random}`;
    };

    const mqttConfig: MqttConfig = {
      username: "Admin",
      password: "7xzUV@MT",
      clientId: generateClientId(),
      hostname: "mqtt.omnivoltaic.com",
      port: 1883,
    };

    bridge.callHandler("connectMqtt", mqttConfig, (resp: string) => {
      try {
        const p = JSON.parse(resp);
        if (p.error) console.error("MQTT connection error:", p.error.message);
      } catch (err) {
        console.error("Error parsing MQTT response:", err);
      }
    });

    return () => {
      offPrint();
      offFindBle();
      offBleConnectFail();
      offBleConnectSuccess();
      offInitComplete();
      offInitData();
      offQr();
      offMqttRecv();
      offInitProg();
      offConnectMqtt();
      offSvcProg();
      offSvcComplete();
      offSvcFail();

      if (deviceBatchTimerRef.current) {
        clearTimeout(deviceBatchTimerRef.current);
        deviceBatchTimerRef.current = null;
        flushDeviceBatch();
      }

      if (connectedDeviceRef.current) {
        bridge.callHandler(
          "disconnectBle",
          connectedDeviceRef.current,
          () => {}
        );
      }

      bridge.callHandler("stopBleScan", "", () => {});
    };
  };

  useEffect(() => {
    if (bridge) {
      setupBridge(bridge);
      readDeviceInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  const qrScanInitiatedRef = useRef(false);

  useEffect(() => {
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && qrScanInitiatedRef.current) {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null;
          if (isScanning) {
            console.info('Resetting scanning state - user returned without scanning');
            setIsScanning(false);
          }
          qrScanInitiatedRef.current = false;
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [isScanning]);

  const startQrCodeScan = () => {
    if (window.WebViewJavascriptBridge) {
      qrScanInitiatedRef.current = true;
      window.WebViewJavascriptBridge.callHandler(
        "startQrCodeScan",
        999,
        () => {}
      );
    }
  };

  const handleServiceDataRequest = (serviceName: string) => {
    if (!selectedDevice) return;

    setLoadingService(serviceName);
    setProgress(0);

    const data = {
      serviceName,
      macAddress: selectedDevice,
    };

    initServiceBleData(data);
  };

  useEffect(() => {
    if (progress === 100 && attributeList.length > 0 && connectingDeviceId) {
      setIsConnecting(false);
      setSelectedDevice(connectingDeviceId);
      setAtrrList(attributeList);
      handlePublish(attributeList, loadingService);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, attributeList]);

  // Start the BLE scan as soon as the WebView bridge is available.
  //
  // We deliberately gate on `bridge` (the React state from useBridge()) and
  // NOT on a module-level "bridgeHasBeenInitialized" flag. That flag pattern
  // was broken: a plain `let` doesn't trigger a re-render when flipped, so
  // the scan effect's deps never appeared to change on the render where
  // setupBridge ran. The scan therefore couldn't start until some *other*
  // setState happened to re-render the component — either setAndroidId
  // (from readDeviceInfo's callback) or setIsMqttConnected (from the MQTT
  // connect callback).
  //
  // Pre-d2e4d27 this never showed up because each applet's setupBridge
  // also called bridge.init(), which flushes native→JS messages queued
  // during page boot. Those flushed messages hit the freshly registered
  // BLE/MQTT handlers and produced an immediate setState, masking the bug.
  // After d2e4d27 moved bridge.init() into BridgeProvider (to fix native
  // force-closes), the flush happens before per-applet handlers exist, so
  // the messages go to BridgeProvider's no-op handler instead and the bug
  // becomes visible: scan-start ends up tied to the MQTT handshake to
  // mqtt.omnivoltaic.com:1883, which on a marginal cell connection can
  // sit at 10–20s. That's the "list empty for 20s before any device
  // shows" customer report.
  //
  // Gating on `bridge` makes React actually observe the change. Effects
  // within a single render commit in declaration order, and the [bridge]
  // setupBridge effect above runs before this one — so when `bridge`
  // flips from null → non-null, handlers are registered first, then the
  // scan starts in the same commit. Scan-start no longer waits on MQTT.
  useEffect(() => {
    if (!bridge) return;

    const id = setTimeout(() => {
      startBleScan();
    }, 300);

    return () => {
      clearTimeout(id);
      stopBleScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  const startBleScan = () => {
    if (window.WebViewJavascriptBridge) {
      console.info('[Keypad BLE] startBleScan called');
      window.WebViewJavascriptBridge.callHandler(
        "startBleScan",
        "",
        () => {}
      );
      setIsScanning(true);
    } else {
      console.warn('[Keypad BLE] startBleScan: WebViewJavascriptBridge not available');
    }
  };

  const stopBleScan = () => {
    if (deviceBatchTimerRef.current) {
      clearTimeout(deviceBatchTimerRef.current);
      deviceBatchTimerRef.current = null;
      flushDeviceBatch();
    }
    if (window.WebViewJavascriptBridge) {
      console.info('[Keypad BLE] stopBleScan called — total devices found:', detectedDevicesRef.current.length);
      window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
      setIsScanning(false);
    }
  };

  const handleQrCode = (code: string) => {
    const currentDevices = detectedDevicesRef.current;
    const matches = currentDevices.filter((device) => {
      const name = (device.name || "").toLowerCase();
      const last6FromName = name.slice(-6);
      return last6FromName === code;
    });

    if (matches.length === 1) {
      startConnection(matches[0].macAddress);
    } else {
      toast.error(
        t('There was a problem connecting with device. Try doing it manually.')
      );
    }
  };

  const handlePublish = (attributeList: any, serviceType: any) => {
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      return;
    }

    if (
      !attributeList ||
      !Array.isArray(attributeList) ||
      attributeList.length === 0
    ) {
      console.error("AttributeList is empty or invalid");
      toast.error(t('Error: Device data not available yet'));
      return;
    }

    const attService = attributeList.find(
      (service: any) => service.serviceNameEnum === "ATT_SERVICE"
    );

    if (!attService) {
      console.error("ATT_SERVICE not found in attributeList.");
      toast.error(t('ATT service data is required but not available yet'));
      return;
    }

    const opidChar = attService.characteristicList.find(
      (char: any) => char.name === "opid"
    );

    if (!opidChar || !opidChar.realVal) {
      console.error(
        "opid characteristic not found or has no value in ATT_SERVICE."
      );
      toast.error(t('Device ID not available'));
      return;
    }

    const opidRealVal = opidChar.realVal;

    const serviceTypeMap: { [key: string]: string } = {
      ATT: "ATT_SERVICE",
      CMD: "CMD_SERVICE",
      STS: "STS_SERVICE",
      DTA: "DTA_SERVICE",
      DIA: "DIA_SERVICE",
    };

    const serviceNameEnum = serviceTypeMap[serviceType] || serviceType;

    const requestedService = attributeList.find(
      (service: any) => service.serviceNameEnum === serviceNameEnum
    );

    if (!requestedService) {
      console.error(`${serviceNameEnum} not found in attributeList.`);
      return;
    }

    const serviceData = requestedService.characteristicList.reduce(
      (acc: any, char: any) => {
        if (char.realVal !== null && char.realVal !== undefined) {
          acc[char.name] = char.realVal;
        }
        return acc;
      },
      {}
    );

    if (Object.keys(serviceData).length === 0) {
      console.error(`No valid data found in ${serviceType} service.`);
      toast.error(t('No data available to publish for {service}', { service: serviceType }));
      return;
    }

    const dataToPublish = {
      topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
      qos: 0,
      content: {
        [serviceType.toLowerCase()]: serviceData,
        timestamp: Date.now(),
        deviceInfo: androidId || "",
      },
    };

    try {
      window.WebViewJavascriptBridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        () => {}
      );
    } catch (error) {
      console.error(`Error publishing ${serviceType} data:`, error);
      toast.error(t('Error publishing {service} data', { service: serviceType }));
    }
  };

  const readDeviceInfo = () => {
    if (!window.WebViewJavascriptBridge) {
      return;
    }
    try {
      window.WebViewJavascriptBridge.callHandler(
        "readDeviceInfo",
        "",
        (response) => {
          const jsonData = JSON.parse(response);
          if (
            jsonData.respCode === "200" &&
            jsonData.respData &&
            jsonData.respData.ANDROID_ID
          ) {
            const androidId = jsonData.respData.ANDROID_ID;
            setAndroidId(androidId);
          }
        }
      );
    } catch (error) {
      console.error(`Error :`, error);
      toast.error(t('Error reading device info data'));
    }
  };

  const bleLoadingSteps = [
    { percentComplete: 10, message: t('Initializing Bluetooth connection...') },
    { percentComplete: 25, message: t('Reading ATT Service...') },
    { percentComplete: 45, message: t('Reading CMD Service...') },
    { percentComplete: 60, message: t('Reading STS Service...') },
    { percentComplete: 75, message: t('Reading DTA Service...') },
    { percentComplete: 90, message: t('Reading DIA Service..') },
  ];

  const handleBLERescan = () => {
    if (isScanning && detectedDevices.length === 0) {
      console.info('[Keypad BLE] rescan: already scanning with 0 devices — stopping');
      stopBleScan();
    } else {
      console.info('[Keypad BLE] rescan: clearing', detectedDevices.length, 'device(s) and restarting scan');
      setConnectedDevice(null);
      detectedDevicesRef.current = [];
      setDetectedDevices([]);
      setSelectedDevice(null);
      setConnectingDeviceId(null);
      startBleScan();
    }
  };

  const handleBackToRoles = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleDisconnectDevice = useCallback(() => {
    if (!selectedDevice) return;
    disconnBleByMacAddress(selectedDevice, (resp: any) => {
      try {
        const parsed = typeof resp === 'string' ? JSON.parse(resp) : resp;
        const ok = parsed?.respCode === '200' || parsed?.respData === true;
        if (ok) {
          toast.success(t('Disconnected from device'), { id: 'disconnect-toast', duration: 1500 });
          setTimeout(() => handleBackToList(true), 500);
        } else {
          toast.error(t('Failed to disconnect device'), { id: 'disconnect-error', duration: 1500 });
        }
      } catch {
        toast.error(t('Failed to disconnect device'), { id: 'disconnect-error', duration: 1500 });
      }
    });
  }, [selectedDevice, handleBackToList, t]);

  const handleLogout = useCallback(() => {
    try {
      clearAllAuth();
    } catch {
      /* ignore storage errors */
    }
    router.replace('/signin');
  }, [router]);

  const handleNavigate = useCallback((tab: KeypadTab) => {
    switch (tab) {
      case 'keypad':
        if (selectedDevice) handleBackToList();
        setCurrentScreen('devices');
        break;
      case 'profile':
        setCurrentScreen('profile');
        break;
    }
  }, [selectedDevice, handleBackToList]);

  const currentTab: KeypadTab = currentScreen === 'profile' ? 'profile' : 'keypad';

  return (
    <div className="attendant-container has-bottom-nav">
      <div className="attendant-bg-gradient" />
      <AppHeader
        showBack
        onBack={selectedDevice ? handleBackToList : handleBackToRoles}
        title={selectedDevice ? (deviceDetails?.name ?? t('Device')) : undefined}
        actions={selectedDevice ? (
          <button
            onClick={handleDisconnectDevice}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-error)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-error-soft)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title={t('Disconnect Device') || 'Disconnect Device'}
            aria-label={t('Disconnect Device') || 'Disconnect Device'}
          >
            <Power className="w-5 h-5" />
          </button>
        ) : undefined}
      />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "var(--toast-bg)",
            color: "var(--toast-text)",
            padding: "16px",
            borderRadius: "8px",
          },
          success: {
            iconTheme: {
              primary: "var(--color-success)",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--color-error)",
              secondary: "white",
            },
          },
        }}
      />

      <main className="attendant-main attendant-main-screen">
        <div className="attendant-screen-container">
          {currentScreen === 'devices' ? (
            !selectedDevice ? (
              <MobileListView
                items={detectedDevices}
                onStartConnection={startConnection}
                connectedDevice={connectedDevice}
                onScanQrCode={startQrCodeScan}
                onRescanBleItems={handleBLERescan}
                isScanning={isScanning}
                title={t('nav.keypad') || 'Keypad'}
              />
            ) : (
              <DeviceDetailView
                // @ts-ignore
                device={deviceDetails}
                attributeList={attrList}
                onBack={handleBackToList}
                onRequestServiceData={handleServiceDataRequest}
                isLoadingService={loadingService}
                serviceLoadingProgress={progress}
                handlePublish={handlePublish}
              />
            )
          ) : (
            <DeviceManagerProfile
              onChangeRole={handleBackToRoles}
              onLogout={handleLogout}
              toolLabel={t('keypad.profile.toolName') || 'Keypad'}
            />
          )}
        </div>
      </main>

      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage={t('Preparing to connect...')}
              completionMessage={t('Connection established!')}
              loadingSteps={bleLoadingSteps}
              onLoadingComplete={() => {}}
              autoProgress={false}
              progress={progress}
            />
          </div>
        </div>
      )}

      <KeypadNav currentTab={currentTab} onNavigate={handleNavigate} />
    </div>
  );
};

export default KeypadApp;
