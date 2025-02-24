
'use client'

import React, { useState } from 'react';
import MobileListView from './MobileListView';
import DeviceDetailView from './DeviceDetailView';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
// Sample data structure for devices
let bridgeHasBeenInitialized = false;
// Define interfaces and types
interface BleDevice {
  macAddress: string;
  name: string;
  rssi: number;
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
  // Find the selected device data
  const deviceDetails = selectedDevice 
    ? deviceData.find(device => device.id === selectedDevice) 
    : undefined;

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
  };

  const handleBackToList = () => {
    setSelectedDevice(null);
  };

  useEffect(() => {
    import('vconsole').then((module) => {
      const VConsole = module.default;
      new VConsole(); // Initialize VConsole
    });
  }, []);


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
            console.log("Raw data received from 'print':", data);
            const parsedData = JSON.parse(data);
            if (parsedData && parsedData.data) {
              responseCallback(parsedData.data);
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
              console.log(parsedData, "Parsed Data------2121----")
              if (parsedData.macAddress && parsedData.name && parsedData.rssi) {
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
            responseCallback(data);
          }
        );

        bridge.registerHandler(
          "bleInitDataCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedData = JSON.parse(data);
              responseCallback(parsedData);
            } catch (error) {
              console.error("Error parsing JSON data from 'bleInitDataCallBack' handler:", error);
            }
          }
        );

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

  // Render the list view or detail view based on selection
  return (
    <>
      {!selectedDevice ? (
        <MobileListView 
          items={deviceData}
          onDeviceSelect={handleDeviceSelect}
        />
      ) : (
        <DeviceDetailView 
          device={deviceDetails}
          onBack={handleBackToList}
        />
      )}
    </>
  );
};

export default AppContainer;