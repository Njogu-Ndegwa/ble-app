
'use client'

import React, { useState } from 'react';
import MobileListView from './MobileListView';
import DeviceDetailView from './DeviceDetailView';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProgressiveLoading from './loader';
import { connBleByMacAddress, initBleData } from "./utils"
import { Toaster, toast } from 'react-hot-toast';
import { ScanQrCode } from 'lucide-react';
// Sample data structure for devices
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
const imageUrl = "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png"
const deviceData = [
  {
    id: '1',
    title: "HESS-Bat242004",
    subtitle: "82:05:10:00:A9:48",
    info: "-90db ~ 10m",
    imageUrl: "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png",
    firmwareVersion: "1.4.7",
    deviceId: "VCUA2404:0019"
  },
  {
    id: '2',
    title: "HESS-Bat241008",
    subtitle: "82:05:10:00:B7:32",
    info: "-78db ~ 5m",
    imageUrl: "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png",
    firmwareVersion: "1.5.2",
    deviceId: "VCUA2404:0022"
  }
  // Add more devices as needed
];


const AppContainer = () => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
  const [attributeList, setServiceAttrList] = useState<any>()
  const [progress, setProgress] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [attrList, setAtrrList] = useState([])
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  // Find the selected device data
  const deviceDetails = selectedDevice
    ? detectedDevices.find(device => device.macAddress === selectedDevice)
    : undefined;

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
  useEffect(() => {
    import('vconsole').then((module) => {
      const VConsole = module.default;
      new VConsole(); // Initialize VConsole
    });
  }, []);

  function convertRssiToFormattedString(rssi: number, txPower: number = -59, n: number = 2): string {
    // Calculate distance using the logarithmic path-loss model
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }


  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const connectWebViewJavascriptBridge = (callback: (bridge: WebViewJavascriptBridge) => void) => {
      if (window.WebViewJavascriptBridge) {
        callback(window.WebViewJavascriptBridge);
      } else {
        const handleBridgeReady = () => {
          if (window.WebViewJavascriptBridge) {
            callback(window.WebViewJavascriptBridge);
          }
        };
        document.addEventListener("WebViewJavascriptBridgeReady", handleBridgeReady, false);

        timeoutId = setTimeout(() => {
          if (!window.WebViewJavascriptBridge) {
            console.error("WebViewJavascriptBridge is not initialized within the timeout period.");
          } else {
            callback(window.WebViewJavascriptBridge);
          }
        }, 3000);

        // Cleanup event listener and timeout on unmount
        return () => {
          document.removeEventListener("WebViewJavascriptBridgeReady", handleBridgeReady, false);
          clearTimeout(timeoutId);
        };
      }
    };

    const setupBridge = (bridge: WebViewJavascriptBridge) => {
      if (!bridgeHasBeenInitialized) {
        bridgeHasBeenInitialized = true;
        bridge.init((message: any, responseCallback: (response: any) => void) => {
          responseCallback("js success!");
        });

        bridge.registerHandler("print", (data: string, responseCallback: (response: any) => void) => {
          try {
            const parsedData = JSON.parse(data);
            if (parsedData && parsedData.data) {
              responseCallback(parsedData.data);
              console.log("Response Callback")
            } else {
              throw new Error("Parsed data is not in the expected format.");
            }
          } catch (error) {
            console.error("Error parsing JSON data from 'print' handler:", error);
          }
        });

        bridge.registerHandler(
          "findBleDeviceCallBack",
          (data: string, responseCallback: (response: { success: boolean; error?: string }) => void) => {
            try {
              const parsedData: BleDevice = JSON.parse(data);
              console.log({ "MacAddress": parsedData.macAddress, "Parsed Name": parsedData.name, "Parsed Rssi": parsedData.rssi });

              if (parsedData.macAddress && parsedData.name && parsedData.rssi) {
                // Store the raw rssi value for sorting, and use the formatted version for display
                const rawRssi = Number(parsedData.rssi);
                const formattedRssi = convertRssiToFormattedString(rawRssi);

                // Update the device data
                parsedData.rssi = formattedRssi; // Use formatted RSSI for display
                parsedData.rawRssi = rawRssi; // Store raw RSSI for sorting
                parsedData.imageUrl = imageUrl;

                setDetectedDevices(prevDevices => {
                  // Check if this device already exists in our array
                  const deviceExists = prevDevices.some(
                    device => device.macAddress === parsedData.macAddress
                  );

                  // If device doesn't exist, add it to the array
                  if (!deviceExists) {
                    console.log("Adding new device:", parsedData.name);
                    return [...prevDevices, parsedData];
                  }

                  // If the device exists, update RSSI or other properties
                  return prevDevices.map(device =>
                    device.macAddress === parsedData.macAddress
                      ? { ...device, rssi: parsedData.rssi, rawRssi: parsedData.rawRssi } // Update both formatted and raw RSSI
                      : device
                  );
                });

                // Sort the devices by raw RSSI, so the closest ones appear first
                setDetectedDevices(prevDevices => {
                  return prevDevices
                    .sort((a, b) => b.rawRssi - a.rawRssi); // Sort by raw RSSI in descending order
                });

                responseCallback({ success: true });
              } else {
                console.warn("Invalid device data format:", parsedData);
              }
            } catch (error) {
              console.error("Error parsing BLE device data:", error);
              responseCallback({ success: false, error: (error as Error).message });
            }
          }
        );


        bridge.registerHandler(
          "bleConnectFailCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            console.log("Bluetooth connection failed:", data);
            setIsConnecting(false); // Reset connection state on failure
            setProgress(0);
            toast.error('Connection failed!', { id: 'connect-toast' });
            responseCallback(data);
          }
        );

        bridge.registerHandler("bleConnectSuccessCallBack", (macAddress, responseCallback) => {
          sessionStorage.setItem('connectedDeviceMac', macAddress);
          setConnectedDevice(macAddress); // Set the connected device
          setIsScanning(false);
          initBleData(macAddress);
          responseCallback(macAddress);
        });

        // BLE service data initialization callback
        bridge.registerHandler("bleInitDataOnCompleteCallBack", (data, responseCallback) => {
          const resp = JSON.parse(data);
          setServiceAttrList(resp.dataList.map((service: any, index: any) => ({ ...service, index })));
          responseCallback(data);
        });

        bridge.registerHandler(
          "bleInitDataCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedData = JSON.parse(data);
              console.log(parsedData, "BleInitDataCallBack")
              responseCallback(parsedData);
            } catch (error) {
              console.error("Error parsing JSON data from 'bleInitDataCallBack' handler:", error);
            }
          }
        );

                // QR Scan callback using the latest device list via ref
                bridge.registerHandler("scanQrcodeResultCallBack", (data, responseCallback) => {
                  console.info("Debug: Received data from scanQrcodeResultCallBack:", data);
                  try {
                    const parsedData = JSON.parse(data);
                    console.info(parsedData, "Parsed Data")
                    const qrValue = parsedData.respData.value || "";
                    console.info(qrValue, "QrValue")
                    const last6FromBarcode = qrValue.slice(-6).toLowerCase();
                    handleQrCode(last6FromBarcode)
                    console.info(detectedDevices, "Detected devices")
                    const matches = detectedDevices.filter((device) => {
                      console.info(device, "Device")
                      const name = (device.name || "").toLowerCase();
                      console.info(name, "Device")
                      const last6FromName = name.slice(-6);
                      console.info(last6FromBarcode, "last6FromBarcode")
                      console.info(last6FromName, last6FromBarcode, "Codes---302")
                      return last6FromName === last6FromBarcode
                    });

                    console.info(matches, "Matches 302---")
                  } catch (error) {
                    console.error("Error processing QR code data:", error);
           
                  }
                  responseCallback(data);
                });     

        bridge.registerHandler(
          "mqttMessageReceived",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedMessage = JSON.parse(data);
              responseCallback(parsedMessage);
            } catch (error) {
              console.error("Error parsing MQTT message:", error);
            }
          }
        );

        bridge.registerHandler(
          "bleInitDataOnProgressCallBack",
          (data) => {
            try {
              const parsedData = JSON.parse(data);
              const progressPercentage = Math.round(
                (parsedData.progress / parsedData.total) * 100
              );
              setProgress(progressPercentage);

            } catch (error) {
              console.error("Progress callback error:", error);
            }
          }
        );

        bridge.registerHandler(
          "connectMqttCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedMessage = JSON.parse(data);
              console.info("MQTT Connection Callback:", parsedMessage);
              responseCallback("Received MQTT Connection Callback");
            } catch (error) {
              console.error("Error parsing MQTT connection callback:", error);
            }
          }
        );

        bridge.registerHandler(
          "mqttMsgArrivedCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            console.info("MQTT Message Arrived Callback:", data);
            responseCallback("Received MQTT Message");
          }
        );

        const mqttConfig: MqttConfig = {
          username: "Admin",
          password: "7xzUV@MT",
          clientId: "123",
          hostname: "mqtt.omnivoltaic.com",
          port: 1883,
        };
        bridge.callHandler("connectMqtt", mqttConfig, (responseData: string) => {
          try {
            const parsedResponse = JSON.parse(responseData);
            if (parsedResponse.error) {
              console.error("MQTT connection error:", parsedResponse.error.message);
            }
          } catch (error) {
            console.error("Error parsing MQTT response:", error);
          }
        });

        setBridgeInitialized(true); // Update state to prevent re-initialization
        console.log("WebViewJavascriptBridge initialized.");
      }
    };

    connectWebViewJavascriptBridge(setupBridge);

    return () => {
      console.log("-------250------")
    };
  }, [bridgeInitialized]); // Empty dependency array to run only once on mount

  const startQrCodeScan = () => {
    console.info("Start QR Code Scan")
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('startQrCodeScan', 999, (responseData) => {
        console.info(responseData);
      });
    }
  };

  useEffect(() => {
    if (progress === 100) {
      setIsConnecting(false); // Connection process complete
      setSelectedDevice(connectingDeviceId);
      setAtrrList(attributeList)
    }
  }, [progress, attributeList])

  useEffect(() => {
    if (bridgeInitialized) {
      startBleScan();
      return () => {
        stopBleScan();
      };
    }
  }, [bridgeInitialized]);

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
    if (window.WebViewJavascriptBridge && isScanning) {
      window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {
        console.log("Scanning stopped");
      });
      setIsScanning(false);
    } else {
      console.error("WebViewJavascriptBridge is not initialized or scanning is not active.");
    }
  };

  const handleQrCode = (code:string) => {
    console.info(code, "452")
    console.info(detectedDevices, "Detected Devices")
  }
  // Render the list view or detail view based on selection

  const bleLoadingSteps = [
    { percentComplete: 10, message: "Initializing Bluetooth connection..." },
    { percentComplete: 25, message: "Reading ATT Service..." },
    { percentComplete: 45, message: "Reading CMD Service..." },
    { percentComplete: 60, message: "Reading STS Service..." },
    { percentComplete: 75, message: "Reading DTA Service..." },
    { percentComplete: 90, message: "Reading DIA Service.." }
  ];

  console.info(detectedDevices, "Detected Devices")
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
        />
      ) : (
        <DeviceDetailView
          // @ts-ignore
          device={deviceDetails}
          attributeList={attrList}
          onBack={handleBackToList}
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