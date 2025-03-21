
'use client'

import React, { useState, useRef } from 'react';
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
const defaultImageUrl = "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png"


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
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  // Find the selected device data
  const deviceDetails = selectedDevice
    ? detectedDevices.find(device => device.macAddress === selectedDevice)
    : undefined;

  const detectedDevicesRef = useRef(detectedDevices);

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


  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    //This function checks if the bridge is already available. If not, it sets up an event listener and timeout to handle the initialization.

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

    //The setupBridge function initializes the bridge and registers multiple handlers to communicate with the native side:
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

              if (parsedData.macAddress && parsedData.name && parsedData.rssi && parsedData.name.includes("OVES")) {
                // Store the raw rssi value for sorting, and use the formatted version for display
                const rawRssi = Number(parsedData.rssi);
                const formattedRssi = convertRssiToFormattedString(rawRssi);

                // Update the device data
                parsedData.rssi = formattedRssi; // Use formatted RSSI for display
                parsedData.rawRssi = rawRssi; // Store raw RSSI for sorting
                parsedData.imageUrl = getImageUrl(parsedData.name);

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
            toast.error('Connection failed! Please try reconnecting again.', { id: 'connect-toast' });
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
              setIsMqttConnected(true)
              console.info("MQTT Connection Callback:", parsedMessage);
              responseCallback("Received MQTT Connection Callback");
            } catch (error) {
              setIsMqttConnected(false)
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
console.info(isMqttConnected, "Is Mqtt Connected")
  useEffect(() => {
    if (progress === 100) {
      setIsConnecting(false); // Connection process complete
      setSelectedDevice(connectingDeviceId);
      setAtrrList(attributeList)
      handlePublish(attributeList)
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

  const handleQrCode = (code: string) => {
    console.info(code, "452")
    const currentDevices = detectedDevicesRef.current;
    console.info(currentDevices, "Current devices via ref");
    const matches = currentDevices.filter((device) => {
      console.info(device, "Device")
      const name = (device.name || "").toLowerCase();
      console.info(name, "Device")
      const last6FromName = name.slice(-6);
      console.info(code, "last6FromBarcode")
      console.info(last6FromName, code, "Codes---302")
      return last6FromName === code
    });

    console.info(matches[0], "Matches----462----")
    if (matches.length === 1) {
      startConnection(matches[0].macAddress)
    } else {
      toast.error("There was a problem connecting with device. Try doing it manually.")
    }
  }
  // Render the list view or detail view based on selection

  const handlePublish = (attributeList: any) => {

    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Error: WebViewJavascriptBridge is not initialized.");

      return;
    }


    // Find the STS_SERVICE from the attributeList
    const stsService = attributeList.find((service: any) => service.serviceNameEnum === "STS_SERVICE");

    if (!stsService) {
      console.error("STS_SERVICE not found in attributeList.");
      toast.error("Error: STS_SERVICE not found.");
      return;
    }
    const stsData = stsService.characteristicList.reduce((acc: any, char: any) => {
      acc[char.name] = char.realVal;
      return acc;
    }, {});

    console.info(stsData, "STS Data");

    const attService = attributeList.find((service: any) => service.serviceNameEnum === "ATT_SERVICE");

    if (!attService) {
        console.error("ATT_SERVICE not found in attributeList.");
        toast.error("Error: ATT_SERVICE not found.");
        return;
    }

    // Find the opid characteristic and get its realVal
    const opidChar = attService.characteristicList.find((char: any) => char.name === "opid");

    console.info(opidChar, "opid")
    if (!opidChar) {
        console.error("opid characteristic not found in ATT_SERVICE.");
        toast.error("Error: opid not found in ATT_SERVICE.");
        return;
    }

    const opidRealVal = opidChar.realVal; // e.g., "45AH2311000102"

    // Define the data to publish in the new format
    const dataToPublish = {
        topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
        qos: 0,
        content: {
            sts: stsData,
            timestamp: Date.now(),
            deviceInfo: "mac_address"
        }
    };



    console.info(dataToPublish, "Data to Publish");

    try {
      window.WebViewJavascriptBridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish), // Try stringifying the data
        (response) => {
          console.info(`MQTT Response for`, response);

        }
      );
    } catch (error) {
      console.error(
        `Error calling WebViewJavascriptBridge`,
        error
      );
      toast.error(`Error publishing `);
    }

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