
// 'use client'

// import React, { useState, useRef } from 'react';
// import MobileListView from './MobileListView';
// import { useEffect } from 'react';
// import dynamic from 'next/dynamic';
// import ProgressiveLoading from '../../../../components/loader/progressiveLoading';
// import { connBleByMacAddress, initServiceBleData } from "../../../utils"
// import { Toaster, toast } from 'react-hot-toast';
// import { useBridge } from '@/app/context/bridgeContext';
// let bridgeHasBeenInitialized = false;
// // Define interfaces and types
// export interface BleDevice {
//     macAddress: string;
//     name: string;
//     rssi: string;
//     rawRssi: number;
//     imageUrl?: string;
//     firmwareVersion?: string;
//     deviceId?: string;
// }

// interface AppState {
//     bleData: any; // Could be refined based on actual data structure
//     detectedDevices: BleDevice[];
//     initBleData: any;
//     mqttMessage: any;
//     bridgeInitialized: boolean;
//     isScanning: boolean;
// }

// type AppAction =
//     | { type: "SET_BLE_DATA"; payload: any }
//     | { type: "ADD_DETECTED_DEVICE"; payload: BleDevice }
//     | { type: "SET_INIT_BLE_DATA"; payload: any }
//     | { type: "SET_MQTT_MESSAGE"; payload: any }
//     | { type: "SET_BRIDGE_INITIALIZED"; payload: boolean }
//     | { type: "SET_IS_SCANNING"; payload: boolean };

// interface MqttConfig {
//     username: string;
//     password: string;
//     clientId: string;
//     hostname: string;
//     port: number;
// }

// interface WebViewJavascriptBridge {
//     init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
//     registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
//     callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
// }


// // Declare global window.WebViewJavascriptBridge
// declare global {
//     interface Window {
//         WebViewJavascriptBridge?: WebViewJavascriptBridge;
//     }
// }
// const defaultImageUrl = "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png"


// const AppContainer = () => {
//     const { bridge } = useBridge()


//     useEffect(() => {
//         import('vconsole').then((module) => {
//             const VConsole = module.default;
//             new VConsole();
//         });
//     }, []);

//     const setupBridge = (bridge: WebViewJavascriptBridge) => {
//         console.error("Errorrrtrotorieutioerut")
//         const noop = () => {}; 
//         const reg = (name: string, handler: any) => {
//           bridge.registerHandler(name, handler);
//           return () => bridge.registerHandler(name, noop);
//         };

//         if (!bridgeHasBeenInitialized) {
//             bridgeHasBeenInitialized = true;
//             try {
//                 bridge.init((_m, r) => r('js success!'));
//               } catch (error) {
//                 console.error("Error initializing bridge:", error);
//               }
//           }
    
//         // Example of setting up handlers, adjust as needed
//         const offPrint = reg('print', (data: string, resp: any) => {
//           try {
//             const parsed = JSON.parse(data);
//             if (parsed?.data) resp(parsed.data);
//             else throw new Error('Parsed data is not in the expected format.');
//           } catch (err) {
//             console.error("Error parsing JSON in 'print':", err);
//           }
//         });

//             const offFindBle = reg(
//               'findBleDeviceCallBack',
//               (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
//                 console.error(data, "97----fs")
//               }
//             );
    
//         // Cleanup listeners when the component unmounts or the bridge changes
//         return () => {
//           offPrint(); // Cleanup this handler
//           offFindBle();
//           // Add cleanup for other handlers as needed
//         };
//       };

//     useEffect(() => {
//         console.log(bridge, "-----71------")
//         if (bridge) {
//             console.log(bridge, "-----71------")
//             setupBridge(bridge);
//             //   readDeviceInfo();
//         }
//     }, [bridge]);
//     return (
//         <div>Hello World</div>
//     )
// };

// export default AppContainer;



'use client'

import React, { useState, useRef } from 'react';
import MobileListView from './MobileListView';
import DeviceDetailView from './DeviceDetailView';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProgressiveLoading from '../../../../components/loader/progressiveLoading';
import { connBleByMacAddress, initServiceBleData } from "../../../utils"
import { Toaster, toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
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

interface AppState {
  bleData: any; // Could be refined based on actual data structure
  detectedDevices: BleDevice[];
  initBleData: any;
  mqttMessage: any;
  bridgeInitialized: boolean;
  isScanning: boolean;
}

type AppAction =
  | { type: "SET_BLE_DATA"; payload: any }
  | { type: "ADD_DETECTED_DEVICE"; payload: BleDevice }
  | { type: "SET_INIT_BLE_DATA"; payload: any }
  | { type: "SET_MQTT_MESSAGE"; payload: any }
  | { type: "SET_BRIDGE_INITIALIZED"; payload: boolean }
  | { type: "SET_IS_SCANNING"; payload: boolean };

interface MqttConfig {
  username: string;
  password: string;
  clientId: string;
  hostname: string;
  port: number;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}


// Declare global window.WebViewJavascriptBridge
declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}
const defaultImageUrl = "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png"


const AppContainer = () => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
  const [attributeList, setServiceAttrList] = useState<any>([])
  const [progress, setProgress] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [attrList, setAtrrList] = useState([])
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState<any>("")
  // Find the selected device data
  const deviceDetails = selectedDevice
    ? detectedDevices.find(device => device.macAddress === selectedDevice)
    : undefined;

  const detectedDevicesRef = useRef(detectedDevices);

  // 👇 replace the old global flag with a ref
  const bridgeInitRef = useRef(false);

  const { bridge } = useBridge(); // Access bridge from context

  const connectedDeviceRef = useRef<string | null>(null)
  useEffect(() => { connectedDeviceRef.current = connectedDevice }, [connectedDevice])
  console.error(connectedDeviceRef, "The Connected Device Reference---92---")
  // Update the ref whenever detectedDevices changes
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
    // setIsConnecting(true);
    // setConnectingDeviceId(macAddress);
    // setProgress(0); // Reset progress at the start
    // connBleByMacAddress(macAddress);
    if (macAddress === connectedDevice && attributeList.length > 0) {
      // Already connected, skip connection and go to details
      setSelectedDevice(macAddress);
    } else {
      // Start new connection
      setIsConnecting(true);
      setConnectingDeviceId(macAddress);
      setProgress(0);
      connBleByMacAddress(macAddress);
    }
  };

  const itemImageMap: { [key: string]: string } = {
    "PPSP": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1739505681/OVES-PRODUCTS/CROSS-GRID/Integrated%20Home%20Energy%20Systems%20-%20Oasis%E2%84%A2%20Series/ovT20-2400W/T20-2400W_efw5mh.png",
    "STOV": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1738897820/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/E-STOVE-BLE-AF/E-STOVE-BLE-AF_Left_side_cvs2wl.png",
    "INVE": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731914963/OVES-PRODUCTS/CROSS-GRID/xGrid_Inverter_Charger/INVP-48V-6.2KW-HF/INVP-48V-6.2KW-HP_Left_Side_2024-1118_fo0hpr.png",
    "E-3P": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1733295976/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3%20Plus/E-3_L_wspsx8.png",
    "S-6": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1726639186/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/S-6/F_el4vpq.png",
    "E-3": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1690366674/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3/ovego-e-3-e-3_v2023114_c7mb0q.png",
    "BATP": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png",
    "CAMP": "https://res.cloudinary.com/oves/image/upload/v1627881710/OVES-PRODUCTS/OFF-GRID/ovCAMP%20SERIES/ovCAMP%20SERIES%20APPLIANCES/ovCamp%20Battery%20Hubs/6Ah%20ovCamp%20Hub%20Battery/6AH_W600_NB_uhlc3f.png",
    "HOME": "https://res.cloudinary.com/oves/image/upload/v1724910821/OVES-PRODUCTS/OFF-GRID/LUMN-HOME%20SERIES/LUMN-HOME%20SHARED%20COMPONENTS/LumnHome%20battery%20hub/lumn-home-battery-hub_front_NBG_HDR.png",
    "BATT": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
    "Batt": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
    "UBP1": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1738909134/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-1K/UBP1000-250_AC_Output_250W_dlt63n.png"
  }

  const getImageUrl = (name: string): string => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      const keyword = parts[1];
      const mapKey = Object.keys(itemImageMap).find(
        (k) => k.toLowerCase() === keyword.toLowerCase()
      );
      if (mapKey) {
        const url = itemImageMap[mapKey];
        return url || defaultImageUrl;
      }
    }
    return defaultImageUrl;
  };





  function convertRssiToFormattedString(rssi: number, txPower: number = -59, n: number = 2): string {
    // Calculate distance using the logarithmic path-loss model
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }



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
      toast.error('Connection failed! Please try reconnecting again.', { id: 'connect-toast' });
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

    const mqttConfig: MqttConfig = {
      username: 'Admin',
      password: '7xzUV@MT',
      clientId: '123',
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

    // Cleanup when the component unmounts or dependencies change
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
    }

  }, [bridge]);




  // console.error(bridgeInitialized, "bridgeInitialized-----466-----")
  // console.error(bridgeHasBeenInitialized, "bridgeHasBeenInitialized-----467-----")
  console.error(detectedDevices, "Detected Devices-----468")

  const startQrCodeScan = () => {
    console.info("Start QR Code Scan")
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
      serviceName: serviceName, // ATT/STS/DIA/CMD/DTA
      macAddress: selectedDevice
    };

    initServiceBleData(data);
  };



  console.info(isMqttConnected, "Is Mqtt Connected")
  useEffect(() => {
    if (progress === 100 && attributeList.length > 0) {
      setIsConnecting(false); // Connection process complete
      setSelectedDevice(connectingDeviceId);
      setAtrrList(attributeList)
      // console.info(attributeList, "Attribute List -----441----")

      handlePublish(attributeList, loadingService)
    }
  }, [progress, attributeList])

  /*  Scan-cycle effect  */
  useEffect(() => {
    if (!bridgeHasBeenInitialized) return

    stopBleScan()                       // stop immediately

    const id = setTimeout(() => {
      /* give the native layer 300 ms, then start again */
      startBleScan()
    }, 300)

    /* cleanup */
    return () => {
      clearTimeout(id)                  // cancel pending restart
      stopBleScan()                     // and always stop when un-mounting
    }
  }, [bridgeHasBeenInitialized])


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

  // const stopBleScan = () => {
  //   if (window.WebViewJavascriptBridge && isScanning) {
  //     window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {
  //       console.log("Scanning stopped");
  //     });
  //     setIsScanning(false);
  //   } else {
  //     console.error("WebViewJavascriptBridge is not initialized or scanning is not active.");
  //   }
  // };
  const stopBleScan = () => {
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => { })
      setIsScanning(false)
    }
  }


  const handleQrCode = (code: string) => {
    const currentDevices = detectedDevicesRef.current;
    const matches = currentDevices.filter((device) => {
      const name = (device.name || "").toLowerCase();
      const last6FromName = name.slice(-6);
      return last6FromName === code
    });

    if (matches.length === 1) {
      startConnection(matches[0].macAddress)
    } else {
      toast.error("There was a problem connecting with device. Try doing it manually.")
    }

  }

  const handlePublish = (attributeList: any, serviceType: any) => {
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      // toast.error("Error: WebViewJavascriptBridge is not initialized.");
      return;
    }

    // First, ensure we have attributeList and it's an array
    if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
      console.error("AttributeList is empty or invalid");
      toast.error("Error: Device data not available yet");
      return;
    }

    // Find the ATT_SERVICE from the attributeList - this is required for all publish operations
    const attService = attributeList.find((service: any) => service.serviceNameEnum === "ATT_SERVICE");

    if (!attService) {
      console.error("ATT_SERVICE not found in attributeList.");
      toast.error("ATT service data is required but not available yet");
      // Queue this publish for retry after ATT service is loaded
      return;
    }

    // Get the opid from ATT_SERVICE
    const opidChar = attService.characteristicList.find((char: any) => char.name === "opid");

    if (!opidChar || !opidChar.realVal) {
      console.error("opid characteristic not found or has no value in ATT_SERVICE.");
      toast.error("Device ID not available");
      return;
    }

    const opidRealVal = opidChar.realVal; // e.g., "45AH2311000102"

    // Map service enum to match attributeList format
    const serviceTypeMap: { [key: string]: string } = {
      'ATT': 'ATT_SERVICE',
      'CMD': 'CMD_SERVICE',
      'STS': 'STS_SERVICE',
      'DTA': 'DTA_SERVICE',
      'DIA': 'DIA_SERVICE',
    };

    const serviceNameEnum = serviceTypeMap[serviceType] || serviceType;

    // Find the requested service from the attributeList
    const requestedService = attributeList.find((service: any) =>
      service.serviceNameEnum === serviceNameEnum
    );

    if (!requestedService) {
      console.error(`${serviceNameEnum} not found in attributeList.`);
      // toast.error(`${serviceType} service data not available yet`);
      return;
    }

    // Convert service data to key-value format
    const serviceData = requestedService.characteristicList.reduce((acc: any, char: any) => {
      // Skip null or undefined values
      if (char.realVal !== null && char.realVal !== undefined) {
        acc[char.name] = char.realVal;
      }
      return acc;
    }, {});

    // Check if we have data to publish
    if (Object.keys(serviceData).length === 0) {
      console.error(`No valid data found in ${serviceType} service.`);
      toast.error(`No data available to publish for ${serviceType}`);
      return;
    }

    // Define the data to publish
    const dataToPublish = {
      topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
      qos: 0,
      content: {
        // Use the service name as the key for the data object
        [serviceType.toLowerCase()]: serviceData,
        timestamp: Date.now(),
        deviceInfo: androidId || ""
      }
    };

    console.info(dataToPublish, `Data to Publish for ${serviceType} service`);
    // toast(`Preparing to publish ${serviceType} data`, {
    //   duration: 2000, // Show for 2 seconds
    // }); 
    // Try to publish via MQTT
    try {
      window.WebViewJavascriptBridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        (response) => {
          console.info(`MQTT Response for ${serviceType}:`, response);
          toast.success(`${serviceType} data published successfully`);
        }
      );
    } catch (error) {
      console.error(`Error publishing ${serviceType} data:`, error);
      toast.error(`Error publishing ${serviceType} data`);
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
            setAndroidId(androidId)
            console.warn(androidId, "765---")
          }
        }
      );
    } catch (error) {
      console.error(`Error :`, error);
      toast.error(`Error reding device info data`);
    }
  }

  // Optional: Helper function to publish all available services
  const publishAllAvailableServices = (attributeList: any) => {
    if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
      console.error("AttributeList is empty or invalid");
      toast.error("Error: Device data not available yet");
      return;
    }

    // Check if ATT service is available (required for all publishes)
    const hasAttService = attributeList.some(service => service.serviceNameEnum === "ATT_SERVICE");

    if (!hasAttService) {
      console.error("ATT_SERVICE not found - required for publishing");
      toast.error("Cannot publish: ATT service data not available");
      return;
    }

    // Map of service types to publish
    const serviceTypes = ['ATT', 'CMD', 'STS', 'DTA', 'DIA'];

    // Determine which services are available
    const availableServices = serviceTypes.filter(type => {
      const serviceNameEnum = `${type}_SERVICE`;
      return attributeList.some(service => service.serviceNameEnum === serviceNameEnum);
    });

    if (availableServices.length === 0) {
      toast.error("No service data available to publish");
      return;
    }

    // Publish each available service with a slight delay between them
    availableServices.forEach((serviceType, index) => {
      setTimeout(() => {
        handlePublish(attributeList, serviceType);
      }, index * 500); // 500ms delay between each publish
    });

    console.info("Publishing services:", availableServices);
  };

  const bleLoadingSteps = [
    { percentComplete: 10, message: "Initializing Bluetooth connection..." },
    { percentComplete: 25, message: "Reading ATT Service..." },
    { percentComplete: 45, message: "Reading CMD Service..." },
    { percentComplete: 60, message: "Reading STS Service..." },
    { percentComplete: 75, message: "Reading DTA Service..." },
    { percentComplete: 90, message: "Reading DIA Service.." }
  ];
  const handleBLERescan = () => {
    if (isScanning && detectedDevices.length === 0) {
      stopBleScan()
    }
    else {
      setConnectedDevice(null)
      setDetectedDevices([])
      setSelectedDevice(null)
      setConnectingDeviceId(null)
      startBleScan()
    }
  }


  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          // Customize default toast options
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          // Configure different types of toasts
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: 'white',
            },
          },
        }}
      />
      {!selectedDevice ? (
        <MobileListView
          items={detectedDevices}
          onStartConnection={startConnection}
          connectedDevice={connectedDevice}
          onScanQrCode={startQrCodeScan}
          onRescanBleItems={handleBLERescan}
          isScanning={isScanning}
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
          handlePublish={handlePublish} // Pass handlePublish to DeviceDetailView
        />
      )}
      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage="Preparing to connect..."
              completionMessage="Connection established!"
              loadingSteps={bleLoadingSteps}
              onLoadingComplete={() => { }} // Handled in callback
              autoProgress={false} // Use real progress
              progress={progress} // Pass real progress
            />
          </div>
        </div>
      )}

    </>
  );
};

export default AppContainer;
