'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { defaultImageUrl, itemImageMap } from '../constants/imageUrls';
import { connBleByMacAddress, initBleData, initServiceBleData } from '@/app/utils';

// Define interfaces
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

// Define context type
interface BridgeContextType {
    bridgeInitialized: boolean;
    isScanning: boolean;
    detectedDevices: BleDevice[];
    connectedDevice: string | null;
    isMqttConnected: boolean;
    isConnecting: boolean;
    connectingDeviceId: string | null;
    progress: number;
    attributeList: any[];
    attrList: any[];
    loadingService: string | null;
    startBleScan: () => void;
    stopBleScan: () => void;
    startConnection: (macAddress: string) => void;
    startQrCodeScan: () => void;
    handleBLERescan: () => void;
    setSelectedDevice: (deviceId: string | null) => void;
    handleServiceDataRequest: (serviceName: string) => void;
    handlePublish: (attributeList: any, serviceType: any) => void;
}

// Create the context
const BridgeContext = createContext<BridgeContextType | undefined>(undefined);

// Bridge state variable - holds the global initialization state
let bridgeHasBeenInitialized = false;

// Context provider component
export const BridgeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // States
    const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
    const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [attributeList, setServiceAttrList] = useState<any[]>([]);
    const [attrList, setAtrrList] = useState<any[]>([]);
    const [loadingService, setLoadingService] = useState<string | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [androidId, setAndroidId] = useState<any>("")


    
    // Create a ref to the detected devices for use in QR code scanning
    const detectedDevicesRef = useRef(detectedDevices);

    // Update the ref whenever detectedDevices changes
    useEffect(() => {
        detectedDevicesRef.current = detectedDevices;
    }, [detectedDevices]);

    // Helper function for RSSI conversion
    function convertRssiToFormattedString(rssi: number, txPower: number = -59, n: number = 2): string {
        const distance = Math.pow(10, (txPower - rssi) / (10 * n));
        return `${rssi}db ~ ${distance.toFixed(0)}m`;
    }

    const getImageUrl = (name: string): string => {
        const parts = name.split(" ");
        if (parts.length >= 2) {
            const keyword = parts[1];
            const mapKey = Object.keys(itemImageMap).find(
                (k) => k.toLowerCase() === keyword.toLowerCase()
            );
            return mapKey ? itemImageMap[mapKey] : defaultImageUrl;
        }
        return defaultImageUrl;
    };
        useEffect(() => {
        import('vconsole').then((module) => {
            const VConsole = module.default;
            new VConsole(); // Initialize VConsole
        });
    }, []);

    // Initialize bridge
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

                // Register all handlers
                bridge.registerHandler("print", (data: string, responseCallback: (response: any) => void) => {
                    try {
                        const parsedData = JSON.parse(data);
                        if (parsedData && parsedData.data) {
                            responseCallback(parsedData.data);
                            console.log("Response Callback");
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
                                const rawRssi = Number(parsedData.rssi);
                                const formattedRssi = convertRssiToFormattedString(rawRssi);
                                parsedData.rssi = formattedRssi;
                                parsedData.rawRssi = rawRssi;
                                parsedData.imageUrl = getImageUrl(parsedData.name);

                                setDetectedDevices(prevDevices => {
                                    const deviceExists = prevDevices.some(
                                        device => device.macAddress === parsedData.macAddress
                                    );

                                    if (!deviceExists) {
                                        console.log("Adding new device:", parsedData.name);
                                        return [...prevDevices, parsedData];
                                    }

                                    return prevDevices.map(device =>
                                        device.macAddress === parsedData.macAddress
                                            ? { ...device, rssi: parsedData.rssi, rawRssi: parsedData.rawRssi }
                                            : device
                                    );
                                });

                                setDetectedDevices(prevDevices => {
                                    return prevDevices.sort((a, b) => b.rawRssi - a.rawRssi);
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
                        setIsConnecting(false);
                        setProgress(0);
                        toast.error('Connection failed! Please try reconnecting again.', { id: 'connect-toast' });
                        responseCallback(data);
                    }
                );

                bridge.registerHandler("bleConnectSuccessCallBack", (macAddress, responseCallback) => {
                    sessionStorage.setItem('connectedDeviceMac', macAddress);
                    setConnectedDevice(macAddress);
                    setIsScanning(false);
                    const data = {
                        serviceName: "ATT",
                        macAddress: macAddress
                    };
                    setLoadingService("ATT");
                    initServiceBleData(data);
                    responseCallback(macAddress);
                });

                bridge.registerHandler("bleInitServiceDataOnProgressCallBack", (data, responseCallback) => {
                    console.info(data, "Service data progress update");
                    try {
                        const parsedData = JSON.parse(data);
                        const progressPercentage = Math.round((parsedData.progress / parsedData.total) * 100);
                        setProgress(progressPercentage);
                    } catch (error) {
                        console.error("Error parsing service progress data:", error);
                    }
                    responseCallback(data);
                });

                bridge.registerHandler("bleInitServiceDataOnCompleteCallBack", (data, responseCallback) => {
                    console.info(data, "Service data initialization complete");
                    try {
                        const parsedData = JSON.parse(data);
                        setServiceAttrList(prev => {
                            const existingService = prev.find(s => s.serviceNameEnum === parsedData.serviceNameEnum);
                            if (existingService) {
                                return prev.map(s =>
                                    s.serviceNameEnum === parsedData.serviceNameEnum ? parsedData : s
                                );
                            }
                            return [...prev, parsedData];
                        });
                        setAtrrList(prev => {
                            const existingService = prev.find(s => s.serviceNameEnum === parsedData.serviceNameEnum);
                            if (existingService) {
                                return prev.map(s =>
                                    s.serviceNameEnum === parsedData.serviceNameEnum ? parsedData : s
                                );
                            }
                            return [...prev, parsedData];
                        });
                        setLoadingService(null);
                    } catch (error) {
                        console.error("Error parsing service complete data:", error);
                    }
                    responseCallback(data);
                });

                bridge.registerHandler("bleInitServiceDataFailureCallBack", (data, responseCallback) => {
                    console.info(data, "Service data initialization failed");
                    setLoadingService(null);
                    toast.error('Failed to load service data');
                    responseCallback(data);
                });

                bridge.registerHandler("bleInitDataOnCompleteCallBack", (data, responseCallback) => {
                    const resp = JSON.parse(data);
                    const updatedList = resp.dataList.map((service: any, index: any) => ({ ...service, index }));
                    setServiceAttrList(updatedList);
                    setAtrrList(updatedList);
                    responseCallback(data);
                });

                bridge.registerHandler(
                    "bleInitDataFailureCallBack",
                    (data: string, responseCallback: (response: any) => void) => {
                        try {
                            const parsedData = JSON.parse(data);
                            console.error("BLE data initialization failed:", parsedData);
                            setIsConnecting(false);
                            setProgress(0);
                            toast.error('Failed to initialize BLE data', { id: 'ble-init-failure' });
                            responseCallback(data);
                        } catch (error) {
                            console.error("Error parsing BLE init failure data:", error);
                            responseCallback(data);
                        }
                    }
                );

                bridge.registerHandler(
                    "bleInitDataCallBack",
                    (data: string, responseCallback: (response: any) => void) => {
                        try {
                            const parsedData = JSON.parse(data);
                            console.log(parsedData, "BleInitDataCallBack");
                            responseCallback(parsedData);
                        } catch (error) {
                            console.error("Error parsing JSON data from 'bleInitDataCallBack' handler:", error);
                        }
                    }
                );

                bridge.registerHandler("scanQrcodeResultCallBack", (data, responseCallback) => {
                    console.info("Debug: Received data from scanQrcodeResultCallBack:", data);
                    try {
                        const parsedData = JSON.parse(data);
                        console.info(parsedData, "Parsed Data");
                        const qrValue = parsedData.respData.value || "";
                        console.info(qrValue, "QrValue");
                        const last6FromBarcode = qrValue.slice(-6).toLowerCase();

                        const currentDevices = detectedDevicesRef.current;
                        console.info(currentDevices, "Current devices via ref");
                        const matches = currentDevices.filter((device) => {
                            const name = (device.name || "").toLowerCase();
                            const last6FromName = name.slice(-6);
                            console.info(last6FromName, last6FromBarcode, "Codes comparison");
                            return last6FromName === last6FromBarcode;
                        });

                        console.info(matches[0], "Matching device");
                        if (matches.length === 1) {
                            startConnection(matches[0].macAddress);
                        } else {
                            toast.error("There was a problem connecting with device. Try doing it manually.");
                        }
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
                            console.info(data, "Data progress");
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
                            setIsMqttConnected(true);
                            console.info("MQTT Connection Callback:", parsedMessage);
                            responseCallback("Received MQTT Connection Callback");
                        } catch (error) {
                            setIsMqttConnected(false);
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

                setBridgeInitialized(true);
                console.log("WebViewJavascriptBridge initialized.");
            }
        };

        connectWebViewJavascriptBridge(setupBridge);
        readDeviceInfo()

        return () => {
            console.log("-------250------")
          };
    }, []);

    // Auto-scan when bridge is initialized
    useEffect(() => {
        if (bridgeInitialized) {
            startBleScan();
            return () => {
                stopBleScan();
            };
        }
    }, [bridgeInitialized]);

    // Effect for handling 100% progress
    // useEffect(() => {
    //     if (progress === 100 && attributeList.length > 0) {
    //         setIsConnecting(false);
    //         setSelectedDevice(connectingDeviceId);
    //         setAtrrList(attributeList);
    //         handlePublish(attributeList);
    //     }
    // }, [progress, attributeList]);

    useEffect(() => {
        if (progress === 100 && attributeList.length > 0) {
          setIsConnecting(false); // Connection process complete
          setSelectedDevice(connectingDeviceId);
          setAtrrList(attributeList)
          // console.info(attributeList, "Attribute List -----441----")
    
          handlePublish(attributeList, loadingService)
        }
      }, [progress, attributeList])

    // Function to start BLE scanning
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

    // Function to stop BLE scanning
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

    // Function to start connection
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

    // Function to start QR code scan
    const startQrCodeScan = () => {
        if (window.WebViewJavascriptBridge) {
            window.WebViewJavascriptBridge.callHandler('startQrCodeScan', 999, (responseData) => {
                console.info(responseData);
            });
        }
    };
   
    // Function to handle BLE rescan
    const handleBLERescan = () => {
        if (isScanning && detectedDevices.length === 0) {
            stopBleScan();
        } else {
            setConnectedDevice(null);
            setDetectedDevices([]);
            setConnectingDeviceId(null);
            setSelectedDevice(null);
            startBleScan();
        }
    };

    // Function to handle service data request
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

    // Function to handle MQTT publish
    const handlePublish = (attributeList: any, serviceType: any) => {
        if (!window.WebViewJavascriptBridge) {
          console.error("WebViewJavascriptBridge is not initialized.");
          toast.error("Error: WebViewJavascriptBridge is not initialized.");
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
          'DIA': 'DIA_SERVICE'
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
          console.error("WebViewJavascriptBridge is not initialized.");
          toast.error("Error: WebViewJavascriptBridge is not initialized.");
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
    // Set up context value
    const contextValue: BridgeContextType = {
        bridgeInitialized,
        isScanning,
        detectedDevices,
        connectedDevice,
        isMqttConnected,
        isConnecting,
        connectingDeviceId,
        progress,
        attributeList,
        attrList,
        loadingService,
        startBleScan,
        stopBleScan,
        startConnection,
        startQrCodeScan,
        handleBLERescan,
        setSelectedDevice: (deviceId: string | null) => setConnectingDeviceId(deviceId),
        handleServiceDataRequest,
        handlePublish
    };

    return (
        <BridgeContext.Provider value={contextValue}>
            {children}
        </BridgeContext.Provider>
    );
};

// Custom hook to use the bridge context
export const useBridge = () => {
    const context = useContext(BridgeContext);
    if (context === undefined) {
        throw new Error('useBridge must be used within a BridgeProvider');
    }
    return context;
};