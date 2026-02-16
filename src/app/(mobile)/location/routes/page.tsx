'use client'

import React, { useState, useRef, useEffect } from 'react';
import LocationView from './LocationView';
import dynamic from 'next/dynamic';
import ProgressiveLoading from '../../../../components/loader/progressiveLoading';
import { connBleByMacAddress, initServiceBleData } from "../../../utils"
import { Toaster, toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
import { useI18n } from '@/i18n';

let bridgeHasBeenInitialized = false;

// Define interfaces and types
export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
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

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  locationName?: string;
  [key: string]: any;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

// NOTE: No default image - unmapped devices show no image to avoid confusing users

const AppContainer = () => {
  const { t } = useI18n();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
  const [attributeList, setServiceAttrList] = useState<any>([]);
  const [progress, setProgress] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [attrList, setAtrrList] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState<any>("");
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);

  const detectedDevicesRef = useRef(detectedDevices);
  const bridgeInitRef = useRef(false);
  const connectedDeviceRef = useRef<string | null>(null);
  const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);

  const { bridge } = useBridge();

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  useEffect(() => {
    detectedDevicesRef.current = detectedDevices;
  }, [detectedDevices]);

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
  };

  const handleBackToList = () => {
    setSelectedDevice(null);
  };

  const startConnection = (macAddress: string) => {
    if (macAddress === connectedDevice && attributeList.length > 0) {
      setSelectedDevice(macAddress);
    } else {
      setIsConnecting(true);
      setConnectingDeviceId(macAddress);
      setProgress(0);
      connBleByMacAddress(macAddress);
    }
  };

  const itemImageMap: { [key: string]: string } = {
    "PPSP": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1739505681/OVES-PRODUCTS/CROSS-GRID/Integrated%20Home%20Energy%20Systems%20-%20Oasis%E2%84%A2%20Series/ovT20-2400W/T20-2400W_efw5mh.png",
    "STOV": "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1738897820/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/E-STOVE-BLE-AF/E-STOVE-BLE-AF_Left_side_cvs2wl.png",
    "INVE": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731914963/OVES-PRODUCTS/CROSS-GRID/xGrid_Inverter_Charger/INVP-48V-6.2KW-HF/INVP-48V-6.2KW-HP_Left_Side_2024-1118_fo0hpr.png",
    "E-3P": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1733295976/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3%20Plus/E-3_L_wspsx8.png",
    "S-6": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1726639186/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/S-6/F_el4vpq.png",
    "E-3": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1690366674/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3/ovego-e-3-e-3_v2023114_c7mb0q.png",
    "BATP": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png",
    "CAMP": "https://res.cloudinary.com/oves/image/upload/v1627881710/OVES-PRODUCTS/OFF-GRID/ovCAMP%20SERIES/ovCAMP%20SERIES%20APPLIANCES/ovCamp%20Battery%20Hubs/6Ah%20ovCamp%20Hub%20Battery/6AH_W600_NB_uhlc3f.png",
    "HOME": "https://res.cloudinary.com/oves/image/upload/v1724910821/OVES-PRODUCTS/OFF-GRID/LUMN-HOME%20SERIES/LUMN-HOME%20SHARED%20COMPONENTS/LumnHome%20battery%20hub/lumn-home-battery-hub_front_NBG_HDR.png",
    "BATT": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
    "Batt": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
    "UBP1": "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743147157/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-1K/UBP1K_AC_Output_250W_ee1ar3.png",
    "UBP2": "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743155669/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-2K/UBP_2_AC_Output_._ottb1j.png"
  }

  // Get device image - returns undefined for unmapped devices (show nothing rather than confuse users)
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

  function convertRssiToFormattedString(rssi: number, txPower: number = -59, n: number = 2): string {
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }

  const handleStartLocationListener = () => {
    console.info("Requesting to start location listener");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      toast.error(t("Location service unavailable - bridge not found"));
      return;
    }
    window.WebViewJavascriptBridge.callHandler(
      'startLocationListener',
      {},
      (responseData) => {
        try {
          const parsedResponse = JSON.parse(responseData);
          if (parsedResponse?.respCode === "200") {
            setIsLocationListenerActive(true);
            handleGetLastLocation();
          } else {
            toast.error(t("Failed to start: ") + `${parsedResponse?.respMessage || t('Unknown error')}`);
          }
        } catch (error) {
          toast.error(t("Invalid response from location service"));
          console.error("Error parsing start location response:", error);
        }
      }
    );
  };

  const handleStopLocationListener = () => {
    console.info("Requesting to stop location listener");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      toast.error(t("Location service unavailable - bridge not found"));
      return;
    }

    toast.loading(t("Stopping location listener..."), { id: 'location-loading' });
    window.WebViewJavascriptBridge.callHandler(
      'stopLocationListener',
      {},
      (responseData) => {
        try {
          setIsLocationListenerActive(false);
          toast.dismiss('location-loading');
          toast.success(t("Location tracking stopped"));
        } catch (error) {
          toast.dismiss('location-loading');
          toast.error(t("Error stopping location service"));
          console.error("Error stopping location:", error);
        }
      }
    );
  };

  const handleGetLastLocation = () => {
    console.info("Requesting last known location");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      toast.error(t("Location service unavailable - bridge not found"));
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      'getLastLocation',
      {},
      (responseData) => {
        try {
          const parsedResponse = JSON.parse(responseData);
          const locationData = JSON.parse(parsedResponse.respData);
          if (locationData && typeof locationData.latitude === 'number' && typeof locationData.longitude === 'number') {
            const isSignificantChange = () => {
              if (!lastProcessedLocation.current) return true;
              const DISTANCE_THRESHOLD = 0.001; // ~100 meters
              return (
                Math.abs(lastProcessedLocation.current.lat - locationData.latitude) > DISTANCE_THRESHOLD ||
                Math.abs(lastProcessedLocation.current.lon - locationData.longitude) > DISTANCE_THRESHOLD
              );
            };

            if (isSignificantChange()) {
              setLastKnownLocation(locationData);
              lastProcessedLocation.current = {
                lat: locationData.latitude,
                lon: locationData.longitude,
              };
            }
            setIsLocationListenerActive(prev => prev);
          } else {
            toast.error(t("Invalid location data received"));
          }
        } catch (error) {
          toast.error(t("Failed to retrieve location"));
          console.error("Error parsing location data:", error);
        }
      }
    );
  };

  const setupBridge = (bridge: WebViewJavascriptBridge) => {
    const noop = () => { };
    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, noop);
    };

    if (!bridgeHasBeenInitialized) {
      bridgeHasBeenInitialized = true;
      try {
        bridge.init((_m, r) => r('js success!'));
      } catch (error) {
        console.error("Error initializing bridge:", error);
      }
    }

    const offPrint = reg('print', (data: string, resp: any) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.data) resp(parsed.data);
        else throw new Error('Parsed data is not in the expected format.');
      } catch (err) {
        console.error("Error parsing JSON in 'print':", err);
      }
    });

    const offFindBle = reg(
      'findBleDeviceCallBack',
      (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
        try {
          const d: BleDevice = JSON.parse(data);
          if (d.macAddress && d.name && d.rssi && d.name.includes('OVES')) {
            const raw = Number(d.rssi);
            d.rawRssi = raw;
            d.rssi = convertRssiToFormattedString(raw);
            d.imageUrl = getImageUrl(d.name);

            setDetectedDevices((prev) => {
              const exists = prev.some((p) => p.macAddress === d.macAddress);
              const next = exists
                ? prev.map((p) =>
                  p.macAddress === d.macAddress
                    ? {
                      ...p,
                      rssi: d.rssi,
                      rawRssi: d.rawRssi,
                    }
                    : p
                )
                : [...prev, d];
              return [...next].sort((a, b) => b.rawRssi - a.rawRssi);
            });

            resp({ success: true });
          } else {
            console.warn('Invalid device data format:', d);
          }
        } catch (err: any) {
          console.error('Error parsing BLE device data:', err);
          resp({ success: false, error: err.message });
        }
      }
    );

    const offBleConnectFail = reg('bleConnectFailCallBack', (data: string, resp: any) => {
      setIsConnecting(false);
      setProgress(0);
      toast.error(t('Connection failed! Please try reconnecting again.'), { id: 'connect-toast' });
      resp(data);
    });

    const offBleConnectSuccess = reg('bleConnectSuccessCallBack', (macAddress: string, resp: any) => {
      sessionStorage.setItem('connectedDeviceMac', macAddress);
      setConnectedDevice(macAddress);
      setIsScanning(false);
      const d = { serviceName: 'ATT', macAddress };
      setLoadingService('ATT');
      initServiceBleData(d);
      resp(macAddress);
    });

    const offInitComplete = reg('bleInitDataOnCompleteCallBack', (data: string, resp: any) => {
      const r = JSON.parse(data);
      setServiceAttrList(r.dataList.map((s: any, i: any) => ({ ...s, index: i })));
      resp(data);
    });

    const offInitData = reg('bleInitDataCallBack', (data: string, resp: any) => {
      try {
        const p = JSON.parse(data);
        resp(p);
      } catch (err) {
        console.error("Error parsing JSON data from 'bleInitDataCallBack' handler:", err);
      }
    });

    const offQr = reg('scanQrcodeResultCallBack', (data: string, resp: any) => {
      try {
        const p = JSON.parse(data);
        const qrVal = p.respData.value || '';
        handleQrCode(qrVal.slice(-6).toLowerCase());
      } catch (err) {
        console.error('Error processing QR code data:', err);
      }
      resp(data);
    });

    const offMqttRecv = reg('mqttMessageReceived', (data: string, resp: any) => {
      try {
        const p = JSON.parse(data);
        resp(p);
      } catch (err) {
        console.error('Error parsing MQTT message:', err);
      }
    });

    const offInitProg = reg('bleInitDataOnProgressCallBack', (data: string) => {
      try {
        const p = JSON.parse(data);
        setProgress(Math.round((p.progress / p.total) * 100));
      } catch (err) {
        console.error('Progress callback error:', err);
      }
    });

    const offConnectMqtt = reg('connectMqttCallBack', (data: string, resp: any) => {
      try {
        JSON.parse(data);
        setIsMqttConnected(true);
        resp('Received MQTT Connection Callback');
      } catch (err) {
        setIsMqttConnected(false);
        console.error('Error parsing MQTT connection callback:', err);
      }
    });

    const offSvcProg = reg('bleInitServiceDataOnProgressCallBack', (data: string) => {
      const p = JSON.parse(data);
      setProgress(Math.round((p.progress / p.total) * 100));
    });

    const offSvcComplete = reg(
      'bleInitServiceDataOnCompleteCallBack',
      (data: string, resp: any) => {
        const parsedData = JSON.parse(data);
        setServiceAttrList((prev: any) => {
          if (!prev || prev.length === 0) return [parsedData];
          const idx = prev.findIndex((s: any) => s.uuid === parsedData.uuid);
          if (idx >= 0) {
            const u = [...prev];
            u[idx] = parsedData;
            return u;
          }
          return [...prev, parsedData];
        });
        setTimeout(() => setLoadingService(null), 100);
        resp(data);
      }
    );

    const offSvcFail = reg('bleInitServiceDataFailureCallBack', () => setLoadingService(null));

    const offLocationCallback = reg(
      "locationCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

          toast.dismiss('location-loading');
          const dataPreview = JSON.stringify(rawLocationData, null, 2);

          if (!rawLocationData || typeof rawLocationData !== 'object') {
            toast.error(t("Invalid location data format"));
            responseCallback({ success: false, error: "Invalid format" });
            return;
          }

          const { latitude, longitude } = rawLocationData;

          if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            isNaN(latitude) || isNaN(longitude)) {
            toast.error(t("Invalid coordinates: Must be valid numbers"));
            responseCallback({ success: false, error: "Invalid coordinates" });
            return;
          }

          const isSignificantChange = () => {
            if (!lastProcessedLocation.current) return true;
            const DISTANCE_THRESHOLD = 0.001; // ~100 meters
            return (
              Math.abs(lastProcessedLocation.current.lat - latitude) > DISTANCE_THRESHOLD ||
              Math.abs(lastProcessedLocation.current.lon - longitude) > DISTANCE_THRESHOLD
            );
          };

          if (isSignificantChange()) {
            setLastKnownLocation(rawLocationData);
            lastProcessedLocation.current = {
              lat: latitude,
              lon: longitude,
            };

            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
              toast.error(t("Coordinates out of valid range"));
            } else if (latitude === 0 && longitude === 0) {
              toast.error(t("Location at (0,0) - possible GPS error"));
            }
          }

          responseCallback({ success: true, location: rawLocationData });
        } catch (error) {
          toast.error(t("Error processing location data"));
          console.error("Error processing location data:", error);
          responseCallback({ success: false, error: error });
        }
      }
    );

    // Generate unique client ID to avoid MQTT broker kicking off other connections
    const generateClientId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `oves-location-${timestamp}-${random}`;
    };

    const mqttConfig: MqttConfig = {
      username: 'Admin',
      password: '7xzUV@MT',
      clientId: generateClientId(),
      hostname: 'mqtt.omnivoltaic.com',
      port: 1883,
    };

    bridge.callHandler('connectMqtt', mqttConfig, (resp: string) => {
      try {
        const p = JSON.parse(resp);
        if (p.error) console.error('MQTT connection error:', p.error.message);
      } catch (err) {
        console.error('Error parsing MQTT response:', err);
      }
    });

    return () => {
      offPrint();
    
      offLocationCallback();

      if (connectedDeviceRef.current) {
        bridge.callHandler('disconnectBle', connectedDeviceRef.current, () => { });
      }

      bridge.callHandler('stopBleScan', '', () => { });
    };
  };

  useEffect(() => {
    if (bridge) {
      setupBridge(bridge);
      readDeviceInfo();
      handleStartLocationListener(); // Start location listener on mount
    }
  }, [bridge]);

  const startQrCodeScan = () => {
    console.info("Start QR Code Scan");
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('startQrCodeScan', 999, (responseData) => {
        console.info(responseData);
      });
    }
  };

  const handleServiceDataRequest = (serviceName: string) => {
    if (!selectedDevice) return;

    setLoadingService(serviceName);
    setProgress(0);

    const data = {
      serviceName: serviceName,
      macAddress: selectedDevice
    };

    initServiceBleData(data);
  };

  useEffect(() => {
    if (progress === 100 && attributeList.length > 0) {
      setIsConnecting(false);
      setSelectedDevice(connectingDeviceId);
      setAtrrList(attributeList);
      handlePublish(attributeList, loadingService);
    }
  }, [progress, attributeList]);

  useEffect(() => {
    if (!bridgeHasBeenInitialized) return;

    stopBleScan();

    const id = setTimeout(() => {
      startBleScan();
    }, 300);

    return () => {
      clearTimeout(id);
      stopBleScan();
    };
  }, [bridgeHasBeenInitialized]);

  const startBleScan = () => {
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler(
        "startBleScan",
        "",
        (responseData: string) => {
          try {
            const jsonData = JSON.parse(responseData);
            console.log("BLE Data:", jsonData);
          } catch (error) {
            console.error("Error parsing JSON data from 'startBleScan' response:", error);
          }
        }
      );
      setIsScanning(true);
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
    }
  };

  const stopBleScan = () => {
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
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
      toast.error(t("There was a problem connecting with device. Try doing it manually."));
    }
  };

  const handlePublish = (attributeList: any, serviceType: any) => {
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      return;
    }

    if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
      console.error("AttributeList is empty or invalid");
      toast.error(t("Error: Device data not available yet"));
      return;
    }

    const attService = attributeList.find((service: any) => service.serviceNameEnum === "ATT_SERVICE");

    if (!attService) {
      console.error("ATT_SERVICE not found in attributeList.");
      toast.error(t("ATT service data is required but not available yet"));
      return;
    }

    const opidChar = attService.characteristicList.find((char: any) => char.name === "opid");

    if (!opidChar || !opidChar.realVal) {
      console.error("opid characteristic not found or has no value in ATT_SERVICE.");
      toast.error(t("Device ID not available"));
      return;
    }

    const opidRealVal = opidChar.realVal;

    const serviceTypeMap: { [key: string]: string } = {
      'ATT': 'ATT_SERVICE',
      'CMD': 'CMD_SERVICE',
      'STS': 'STS_SERVICE',
      'DTA': 'DTA_SERVICE',
      'DIA': 'DIA_SERVICE',
    };

    const serviceNameEnum = serviceTypeMap[serviceType] || serviceType;

    const requestedService = attributeList.find((service: any) =>
      service.serviceNameEnum === serviceNameEnum
    );

    if (!requestedService) {
      console.error(`${serviceNameEnum} not found in attributeList.`);
      return;
    }

    const serviceData = requestedService.characteristicList.reduce((acc: any, char: any) => {
      if (char.realVal !== null && char.realVal !== undefined) {
        acc[char.name] = char.realVal;
      }
      return acc;
    }, {});

    if (Object.keys(serviceData).length === 0) {
      console.error(`No valid data found in ${serviceType} service.`);
      toast.error(t(`No data available to publish for ${serviceType}`));
      return;
    }

    const dataToPublish = {
      topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
      qos: 0,
      content: {
        [serviceType.toLowerCase()]: serviceData,
        timestamp: Date.now(),
        deviceInfo: androidId || ""
      }
    };

    console.info(dataToPublish, `Data to Publish for ${serviceType} service`);
    try {
      window.WebViewJavascriptBridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        (response) => {
          console.info(`MQTT Response for ${serviceType}:`, response);
          toast.success(t(`${serviceType} data published successfully`));
        }
      );
    } catch (error) {
      console.error(`Error publishing ${serviceType} data:`, error);
      toast.error(t(`Error publishing ${serviceType} data`));
    }
  };

  const readDeviceInfo = () => {
    if (!window.WebViewJavascriptBridge) {
      return;
    }
    try {
      window.WebViewJavascriptBridge.callHandler(
        'readDeviceInfo', "",
        (response) => {
          console.warn(response, "Response");
          const jsonData = JSON.parse(response);
          if (jsonData.respCode === "200" && jsonData.respData && jsonData.respData.ANDROID_ID) {
            const androidId = jsonData.respData.ANDROID_ID;
            setAndroidId(androidId);
            console.warn(androidId, "765---");
          }
        }
      );
    } catch (error) {
      console.error(`Error:`, error);
      toast.error(t(`Error reading device info data`));
    }
  };

  const publishAllAvailableServices = (attributeList: any) => {
    if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
      console.error("AttributeList is empty or invalid");
      toast.error(t("Error: Device data not available yet"));
      return;
    }

    const hasAttService = attributeList.some(service => service.serviceNameEnum === "ATT_SERVICE");

    if (!hasAttService) {
      console.error("ATT_SERVICE not found - required for publishing");
      toast.error(t("Cannot publish: ATT service data not available"));
      return;
    }

    const serviceTypes = ['ATT', 'CMD', 'STS', 'DTA', 'DIA'];

    const availableServices = serviceTypes.filter(type => {
      const serviceNameEnum = `${type}_SERVICE`;
      return attributeList.some(service => service.serviceNameEnum === serviceNameEnum);
    });

    if (availableServices.length === 0) {
      toast.error(t("No service data available to publish"));
      return;
    }

    availableServices.forEach((serviceType, index) => {
      setTimeout(() => {
        handlePublish(attributeList, serviceType);
      }, index * 500);
    });

    console.info("Publishing services:", availableServices);
  };

  const bleLoadingSteps = [
    { percentComplete: 10, message: t("Initializing Bluetooth connection...") },
    { percentComplete: 25, message: t("Reading ATT Service...") },
    { percentComplete: 45, message: t("Reading CMD Service...") },
    { percentComplete: 60, message: t("Reading STS Service...") },
    { percentComplete: 75, message: t("Reading DTA Service...") },
    { percentComplete: 90, message: t("Reading DIA Service...") }
  ];

  const handleBLERescan = () => {
    if (isScanning && detectedDevices.length === 0) {
      stopBleScan();
    } else {
      setConnectedDevice(null);
      setDetectedDevices([]);
      setSelectedDevice(null);
      setConnectingDeviceId(null);
      startBleScan();
    }
  };

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-text)',
            padding: '16px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-success)',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-error)',
              secondary: 'white',
            },
          },
        }}
      />
      <LocationView
        userLocation={lastKnownLocation}
        isLocationActive={isLocationListenerActive}
      />
      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage={t("Preparing to connect...")}
              completionMessage={t("Connection established!")}
              loadingSteps={bleLoadingSteps}
              onLoadingComplete={() => {}}
              autoProgress={false}
              progress={progress}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AppContainer;