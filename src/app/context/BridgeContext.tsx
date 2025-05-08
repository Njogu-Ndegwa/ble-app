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
    attributeList: any;
    startBleScan: () => void;
    stopBleScan: () => void;
    startConnection: (macAddress: string) => void;
    startQrCodeScan: () => void;
    handleBLERescan: () => void;
    setSelectedDevice: (deviceId: string | null) => void;
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
    const [attributeList, setServiceAttrList] = useState<any>([]);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    
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
    
    // useEffect(() => {
    //     import('vconsole').then((module) => {
    //         const VConsole = module.default;
    //         new VConsole(); // Initialize VConsole
    //     });
    // }, []);

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

                // Print handler
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

                // Find BLE device callback
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

                // BLE connection failure callback
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
                
                // BLE connection success callback
                bridge.registerHandler("bleConnectSuccessCallBack", (macAddress, responseCallback) => {
                    setConnectedDevice(macAddress); // Set the connected device
                    setIsScanning(false);
                    
                    // Initialize BLE data
                    initBleData(macAddress);
                    responseCallback(macAddress);
                });

                // Service data progress callback
                bridge.registerHandler("bleInitServiceDataOnProgressCallBack", (data, responseCallback) => {
                    console.info(data, "Service data progress update");
                    responseCallback(data);
                });

                // Service data complete callback
                bridge.registerHandler("bleInitServiceDataOnCompleteCallBack", (data, responseCallback) => {
                    console.info(data, "Service data initialization complete");
                    responseCallback(data);
                });

                // Service data failure callback
                bridge.registerHandler("bleInitServiceDataFailureCallBack", (data, responseCallback) => {
                    console.info(data, "Service data initialization failed");
                    responseCallback(data);
                });

                // BLE data complete callback
                bridge.registerHandler("bleInitDataOnCompleteCallBack", (data, responseCallback) => {
                    const resp = JSON.parse(data);
                    setServiceAttrList(resp.dataList.map((service: any, index: any) => ({ ...service, index })));
                    responseCallback(data);
                });

                // BLE data failure callback
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

                // BLE init data callback
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

                // QR code scan result callback
                bridge.registerHandler("scanQrcodeResultCallBack", (data, responseCallback) => {
                    console.info("Debug: Received data from scanQrcodeResultCallBack:", data);
                    try {
                        const parsedData = JSON.parse(data);
                        console.info(parsedData, "Parsed Data");
                        const qrValue = parsedData.respData.value || "";
                        console.info(qrValue, "QrValue");
                        const last6FromBarcode = qrValue.slice(-6).toLowerCase();

                        // Find device with matching code
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

                // MQTT message received callback
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

                // BLE init data progress callback
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

                // MQTT connection callback
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

                // MQTT message arrived callback
                bridge.registerHandler(
                    "mqttMsgArrivedCallBack",
                    (data: string, responseCallback: (response: any) => void) => {
                        console.info("MQTT Message Arrived Callback:", data);
                        responseCallback("Received MQTT Message");
                    }
                );

                // Setup MQTT connection
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

        return () => {
            console.log("Bridge context cleanup");
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
    useEffect(() => {
        if (progress === 100) {
            setIsConnecting(false); // Connection process complete
            setSelectedDevice(connectingDeviceId);
            if (attributeList.length > 0) {
                handlePublish(attributeList);
            }
        }
    }, [progress, attributeList, connectingDeviceId]);

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

    // Function to start connection - FIXED: Now uses connBleByMacAddress from utils
    const startConnection = (macAddress: string) => {
        if (macAddress === connectedDevice && attributeList.length > 0) {
            // Already connected, skip connection and go to details
            setSelectedDevice(macAddress);
        } else {
            // Start new connection
            setIsConnecting(true);
            setConnectingDeviceId(macAddress);
            setProgress(0);
            // Use the imported utility function instead of direct bridge call
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
        }
        else {
            setConnectedDevice(null);
            setDetectedDevices([]);
            setConnectingDeviceId(null);
            setSelectedDevice(null);
            startBleScan();
        }
    };

    // Function to handle MQTT publish
    const handlePublish = (attributeList: any) => {
        if (!window.WebViewJavascriptBridge || !attributeList) {
            console.error("WebViewJavascriptBridge is not initialized or attributeList is empty.");
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

        if (!opidChar) {
            console.error("opid characteristic not found in ATT_SERVICE.");
            toast.error("Error: opid not found in ATT_SERVICE.");
            return;
        }

        const opidRealVal = opidChar.realVal;

        // Define the data to publish
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
                JSON.stringify(dataToPublish),
                (response) => {
                    console.info(`MQTT Response:`, response);
                }
            );
        } catch (error) {
            console.error(`Error calling WebViewJavascriptBridge`, error);
            toast.error(`Error publishing message`);
        }
    };

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
        startBleScan,
        stopBleScan,
        startConnection,
        startQrCodeScan,
        handleBLERescan,
        setSelectedDevice: (deviceId: string | null) => setConnectingDeviceId(deviceId)
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