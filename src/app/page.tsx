
// 'use client'

// import React, { useState, useRef } from 'react';
// import MobileListView from './MobileListView';
// import DeviceDetailView from './DeviceDetailView';
// import { useEffect } from 'react';
// import ProgressiveLoading from './loader';
// import { connBleByMacAddress, initBleData, initServiceBleData } from "./utils"
// import { Toaster, toast } from 'react-hot-toast';
// import ProtectedRoute from '@/app/components/protectedRoute';
// import { defaultImageUrl, itemImageMap } from '@/app/constants/imageUrls';
// import { bleLoadingSteps } from './constants/loadingStepsConfig';

// // Sample data structure for devices
// let bridgeHasBeenInitialized = false;
// // Define interfaces and types
// export interface BleDevice {
//   macAddress: string;
//   name: string;
//   rssi: string;
//   rawRssi: number;
//   imageUrl?: string;
//   firmwareVersion?: string;
//   deviceId?: string;
// }

// interface MqttConfig {
//   username: string;
//   password: string;
//   clientId: string;
//   hostname: string;
//   port: number;
// }

// interface WebViewJavascriptBridge {
//   init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
//   registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
//   callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
// }

// // Declare global window.WebViewJavascriptBridge
// declare global {
//   interface Window {
//     WebViewJavascriptBridge?: WebViewJavascriptBridge;
//   }
// }


// const AppContainer = () => {
//   const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
//   const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
//   const [isScanning, setIsScanning] = useState<boolean>(false)
//   const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
//   const [attributeList, setServiceAttrList] = useState<any>([])
//   const [progress, setProgress] = useState(0)
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
//   const [attrList, setAtrrList] = useState([])
//   const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
//   const [loadingService, setLoadingService] = useState<string | null>(null);
//   const [androidId, setAndroidId] = useState<any>("")
//   // Find the selected device data
//   const deviceDetails = selectedDevice
//     ? detectedDevices.find(device => device.macAddress === selectedDevice)
//     : undefined;

//   const detectedDevicesRef = useRef(detectedDevices);

//   // Update the ref whenever detectedDevices changes
//   useEffect(() => {
//     detectedDevicesRef.current = detectedDevices;
//   }, [detectedDevices]);

//   const handleDeviceSelect = (deviceId: string) => {
//     setSelectedDevice(deviceId);
//   };

//   const handleBackToList = () => {
//     setSelectedDevice(null);
//   };

//   const startConnection = (macAddress: string) => {
//     // setIsConnecting(true);
//     // setConnectingDeviceId(macAddress);
//     // setProgress(0); // Reset progress at the start
//     // connBleByMacAddress(macAddress);
//     if (macAddress === connectedDevice && attributeList.length > 0) {
//       // Already connected, skip connection and go to details
//       setSelectedDevice(macAddress);
//     } else {
//       // Start new connection
//       setIsConnecting(true);
//       setConnectingDeviceId(macAddress);
//       setProgress(0);
//       connBleByMacAddress(macAddress);
//     }
//   };

//   const getImageUrl = (name: string): string => {
//     const parts = name.split(" ");
//     if (parts.length >= 2) {
//       const keyword = parts[1];
//       const mapKey = Object.keys(itemImageMap).find(
//         (k) => k.toLowerCase() === keyword.toLowerCase()
//       );
//       return mapKey ? itemImageMap[mapKey] : defaultImageUrl;
//     }
//     return defaultImageUrl;
//   };

//   // useEffect(() => {
//   //   import('vconsole').then((module) => {
//   //     const VConsole = module.default;
//   //     new VConsole();
//   //   });
//   // }, []);


//  useEffect(() => {
//     // Check if we've already reloaded
//     const hasReloaded = sessionStorage.getItem('hasReloaded');
    
//     if (!hasReloaded) {
//       sessionStorage.setItem('hasReloaded', 'true');
//       setTimeout(() => {
//         window.location.reload();
//       }, 5000);
//     }

//     return () => {
//       sessionStorage.removeItem('hasReloaded');
//     };
//   }, []);

//   function convertRssiToFormattedString(rssi: number, txPower: number = -59, n: number = 2): string {
//     // Calculate distance using the logarithmic path-loss model
//     const distance = Math.pow(10, (txPower - rssi) / (10 * n));
//     return `${rssi}db ~ ${distance.toFixed(0)}m`;
//   }


//   useEffect(() => {
//     let timeoutId: NodeJS.Timeout;

//     const connectWebViewJavascriptBridge = (callback: (bridge: WebViewJavascriptBridge) => void) => {
//       if (window.WebViewJavascriptBridge) {
//         callback(window.WebViewJavascriptBridge);
//       } else {
//         const handleBridgeReady = () => {
//           if (window.WebViewJavascriptBridge) {
//             callback(window.WebViewJavascriptBridge);
//           }
//         };
//         document.addEventListener("WebViewJavascriptBridgeReady", handleBridgeReady, false);

//         timeoutId = setTimeout(() => {
//           if (!window.WebViewJavascriptBridge) {
//             console.error("WebViewJavascriptBridge is not initialized within the timeout period.");
//           } else {
//             callback(window.WebViewJavascriptBridge);
//           }
//         }, 3000);

//         // Cleanup event listener and timeout on unmount
//         return () => {
//           document.removeEventListener("WebViewJavascriptBridgeReady", handleBridgeReady, false);
//           clearTimeout(timeoutId);
//         };
//       }
//     };

//     const setupBridge = (bridge: WebViewJavascriptBridge) => {
//       if (!bridgeHasBeenInitialized) {
//         bridgeHasBeenInitialized = true;
//         bridge.init((message: any, responseCallback: (response: any) => void) => {
//           responseCallback("js success!");
//         });

//         bridge.registerHandler("print", (data: string, responseCallback: (response: any) => void) => {
//           try {
//             const parsedData = JSON.parse(data);
//             if (parsedData && parsedData.data) {
//               responseCallback(parsedData.data);
//               console.log("Response Callback")
//             } else {
//               throw new Error("Parsed data is not in the expected format.");
//             }
//           } catch (error) {
//             console.error("Error parsing JSON data from 'print' handler:", error);
//           }
//         });

//         bridge.registerHandler(
//           "findBleDeviceCallBack",
//           (data: string, responseCallback: (response: { success: boolean; error?: string }) => void) => {
//             try {
//               const parsedData: BleDevice = JSON.parse(data);
//               console.log({ "MacAddress": parsedData.macAddress, "Parsed Name": parsedData.name, "Parsed Rssi": parsedData.rssi });

//               if (parsedData.macAddress && parsedData.name && parsedData.rssi && parsedData.name.includes("OVES")) {
//                 // Store the raw rssi value for sorting, and use the formatted version for display
//                 const rawRssi = Number(parsedData.rssi);
//                 const formattedRssi = convertRssiToFormattedString(rawRssi);

//                 // Update the device data
//                 parsedData.rssi = formattedRssi; // Use formatted RSSI for display
//                 parsedData.rawRssi = rawRssi; // Store raw RSSI for sorting
//                 parsedData.imageUrl = getImageUrl(parsedData.name);

//                 setDetectedDevices(prevDevices => {
//                   // Check if this device already exists in our array
//                   const deviceExists = prevDevices.some(
//                     device => device.macAddress === parsedData.macAddress
//                   );

//                   // If device doesn't exist, add it to the array
//                   if (!deviceExists) {
//                     console.log("Adding new device:", parsedData.name);
//                     return [...prevDevices, parsedData];
//                   }

//                   // If the device exists, update RSSI or other properties
//                   return prevDevices.map(device =>
//                     device.macAddress === parsedData.macAddress
//                       ? { ...device, rssi: parsedData.rssi, rawRssi: parsedData.rawRssi } // Update both formatted and raw RSSI
//                       : device
//                   );
//                 });

//                 // Sort the devices by raw RSSI, so the closest ones appear first
//                 setDetectedDevices(prevDevices => {
//                   return prevDevices
//                     .sort((a, b) => b.rawRssi - a.rawRssi); // Sort by raw RSSI in descending order
//                 });

//                 responseCallback({ success: true });
//               } else {
//                 console.warn("Invalid device data format:", parsedData);
//               }
//             } catch (error) {
//               console.error("Error parsing BLE device data:", error);
//               responseCallback({ success: false, error: (error as Error).message });
//             }
//           }
//         );


//         bridge.registerHandler(
//           "bleConnectFailCallBack",
//           (data: string, responseCallback: (response: any) => void) => {
//             console.log("Bluetooth connection failed:", data);
//             setIsConnecting(false); // Reset connection state on failure
//             setProgress(0);
//             toast.error('Connection failed! Please try reconnecting again.', { id: 'connect-toast' });
//             responseCallback(data);
//           }
//         );

//         bridge.registerHandler("bleConnectSuccessCallBack", (macAddress, responseCallback) => {
//           sessionStorage.setItem('connectedDeviceMac', macAddress);
//           setConnectedDevice(macAddress); // Set the connected device
//           setIsScanning(false);
//           // initBleData(macAddress);
//           const data = {
//             serviceName: "ATT", // ATT/STS/DIA/CMD/xx
//             macAddress: macAddress
//           };
//           setLoadingService("ATT")
//           initServiceBleData(data)
//           responseCallback(macAddress);
//         });

//         // BLE service data initialization callback
//         bridge.registerHandler("bleInitDataOnCompleteCallBack", (data, responseCallback) => {
//           const resp = JSON.parse(data);
//           setServiceAttrList(resp.dataList.map((service: any, index: any) => ({ ...service, index })));
//           responseCallback(data);
//         });

//         bridge.registerHandler(
//           "bleInitDataCallBack",
//           (data: string, responseCallback: (response: any) => void) => {
//             try {
//               const parsedData = JSON.parse(data);
//               console.log(parsedData, "BleInitDataCallBack")
//               responseCallback(parsedData);
//             } catch (error) {
//               console.error("Error parsing JSON data from 'bleInitDataCallBack' handler:", error);
//             }
//           }
//         );

//         // QR Scan callback using the latest device list via ref
//         bridge.registerHandler("scanQrcodeResultCallBack", (data, responseCallback) => {
//           console.info("Debug: Received data from scanQrcodeResultCallBack:", data);
//           try {
//             const parsedData = JSON.parse(data);
//             console.info(parsedData, "Parsed Data")
//             const qrValue = parsedData.respData.value || "";
//             console.info(qrValue, "QrValue")
//             const last6FromBarcode = qrValue.slice(-6).toLowerCase();
//             handleQrCode(last6FromBarcode)


//           } catch (error) {
//             console.error("Error processing QR code data:", error);

//           }
//           responseCallback(data);
//         });

//         bridge.registerHandler(
//           "mqttMessageReceived",
//           (data: string, responseCallback: (response: any) => void) => {
//             try {
//               const parsedMessage = JSON.parse(data);
//               console.warn("Mqtt Message Recieved --337")
//               responseCallback(parsedMessage);
//             } catch (error) {
//               console.error("Error parsing MQTT message:", error);
//             }
//           }
//         );

//         bridge.registerHandler(
//           "bleInitDataOnProgressCallBack",
//           (data) => {
//             try {
//               const parsedData = JSON.parse(data);
//               const progressPercentage = Math.round(
//                 (parsedData.progress / parsedData.total) * 100
//               );
//               // setProgress(progressPercentage);

//             } catch (error) {
//               console.error("Progress callback error:", error);
//             }
//           }
//         );

//         bridge.registerHandler(
//           "connectMqttCallBack",
//           (data: string, responseCallback: (response: any) => void) => {
//             try {
//               const parsedMessage = JSON.parse(data);
//               setIsMqttConnected(true)
//               // console.info("MQTT Connection Callback:", parsedMessage);
//               responseCallback("Received MQTT Connection Callback");
//             } catch (error) {
//               setIsMqttConnected(false)
//               console.error("Error parsing MQTT connection callback:", error);
//             }
//           }
//         );

//         bridge.registerHandler("bleInitServiceDataOnProgressCallBack", function (data,
//           responseCallback) {
//           console.info(data);
//           const obj = JSON.parse(data);
//           // console.log(obj.total, "Total------376----");
//           // console.log(obj.progress, "Progress --------377------");
//           const parsedData = JSON.parse(data);
//           const progressPercentage = Math.round(
//             (parsedData.progress / parsedData.total) * 100
//           );
//           setProgress(progressPercentage);
//         });

//         bridge.registerHandler("bleInitServiceDataOnCompleteCallBack", function (data,
//           responseCallback) {

//           const parsedData = JSON.parse(data);
//           // console.info(parsedData, "On Complete----382---");
//           setServiceAttrList((prevList: any) => {
//             // If the list is empty, start a new array
//             if (!prevList || prevList.length === 0) {
//               return [parsedData];
//             }

//             // Find if service with same UUID already exists
//             const existingServiceIndex = prevList.findIndex(
//               (service: any) => service.uuid === parsedData.uuid
//             );

//             if (existingServiceIndex >= 0) {
//               // Service exists, replace it
//               const updatedList = [...prevList];
//               updatedList[existingServiceIndex] = parsedData;
//               return updatedList;
//             } else {
//               // Service doesn't exist, add it
//               return [...prevList, parsedData];
//             }
//           });
//           setTimeout(() => {
//             setLoadingService(null);
//           }, 100)

//         });
//         bridge.registerHandler("bleInitServiceDataFailureCallBack", function (data, responseCallback) {
//           console.info(data);
//           setLoadingService(null);
//         });

//         bridge.registerHandler(
//           "mqttMsgArrivedCallBack",
//           (data: string, responseCallback: (response: any) => void) => {
//             // console.info("MQTT Message Arrived Callback:", data);
//             console.warn("Mqtt Message Recieved --429")
//             responseCallback("Received MQTT Message");
//           }
//         );

//         const mqttConfig: MqttConfig = {
//           username: "Admin",
//           password: "7xzUV@MT",
//           clientId: "123",
//           hostname: "mqtt.omnivoltaic.com",
//           port: 1883,
//         };
//         bridge.callHandler("connectMqtt", mqttConfig, (responseData: string) => {
//           try {
//             const parsedResponse = JSON.parse(responseData);
//             if (parsedResponse.error) {
//               console.error("MQTT connection error:", parsedResponse.error.message);
//             }
//           } catch (error) {
//             console.error("Error parsing MQTT response:", error);
//           }
//         });

//         setBridgeInitialized(true); // Update state to prevent re-initialization
//         console.log("WebViewJavascriptBridge initialized.");
//       }
//     };

//     connectWebViewJavascriptBridge(setupBridge);
//     readDeviceInfo()
//     return () => {
//       console.log("-------250------")
//     };

//   }, [bridgeInitialized]); // Empty dependency array to run only once on mount

//   const startQrCodeScan = () => {
//     console.info("Start QR Code Scan")
//     if (window.WebViewJavascriptBridge) {
//       window.WebViewJavascriptBridge.callHandler('startQrCodeScan', 999, (responseData) => {
//         console.info(responseData);
//       });
//     }
//   };

//   const handleServiceDataRequest = (serviceName: string) => {
//     if (!selectedDevice) return;

//     setLoadingService(serviceName);
//     setProgress(0);

//     const data = {
//       serviceName: serviceName, // ATT/STS/DIA/CMD/DTA
//       macAddress: selectedDevice
//     };

//     initServiceBleData(data);
//   };



//   console.info(isMqttConnected, "Is Mqtt Connected")
//   useEffect(() => {
//     if (progress === 100 && attributeList.length > 0) {
//       setIsConnecting(false); // Connection process complete
//       setSelectedDevice(connectingDeviceId);
//       setAtrrList(attributeList)
//       // console.info(attributeList, "Attribute List -----441----")

//       handlePublish(attributeList, loadingService)
//     }
//   }, [progress, attributeList])

//   useEffect(() => {
//     if (bridgeInitialized) {
//       startBleScan();
//       return () => {
//         stopBleScan();
//       };
//     }
//   }, [bridgeInitialized]);

//   const startBleScan = () => {
//     if (window.WebViewJavascriptBridge) {
//       window.WebViewJavascriptBridge.callHandler(
//         "startBleScan",
//         "",
//         (responseData: string) => {
//           try {
//             const jsonData = JSON.parse(responseData);
//             console.log("BLE Data:", jsonData);
//           } catch (error) {
//             console.error("Error parsing JSON data from 'startBleScan' response:", error);
//           }
//         }
//       );
//       setIsScanning(true);
//     } else {
//       console.error("WebViewJavascriptBridge is not initialized.");
//     }
//   };

//   const stopBleScan = () => {
//     if (window.WebViewJavascriptBridge && isScanning) {
//       window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {
//         console.log("Scanning stopped");
//       });
//       setIsScanning(false);
//     } else {
//       console.error("WebViewJavascriptBridge is not initialized or scanning is not active.");
//     }
//   };

//   const handleQrCode = (code: string) => {
//     const currentDevices = detectedDevicesRef.current;
//     const matches = currentDevices.filter((device) => {
//       const name = (device.name || "").toLowerCase();
//       const last6FromName = name.slice(-6);
//       return last6FromName === code
//     });

//     if (matches.length === 1) {
//       startConnection(matches[0].macAddress)
//     } else {
//       toast.error("There was a problem connecting with device. Try doing it manually.")
//     }
//     // const matches = detectedDevices.filter((device) => {
//     //   console.info(device, "Device")
//     //   const name = (device.name || "").toLowerCase();
//     //   console.info(name, "Device")
//     //   const last6FromName = name.slice(-6);
//     //   console.info(last6FromBarcode, "last6FromBarcode")
//     //   console.info(last6FromName, last6FromBarcode, "Codes---302")
//     //   return last6FromName === last6FromBarcode
//     // });

//     // console.info(matches, "Matches 302---")
//   }
//   // Render the list view or detail view based on selection

//   // const handlePublish = (attributeList: any) => {

//   //   if (!window.WebViewJavascriptBridge) {
//   //     console.error("WebViewJavascriptBridge is not initialized.");
//   //     toast.error("Error: WebViewJavascriptBridge is not initialized.");

//   //     return;
//   //   }


//   //   // Find the STS_SERVICE from the attributeList
//   //   const stsService = attributeList.find((service: any) => service.serviceNameEnum === "STS_SERVICE");

//   //   if (!stsService) {
//   //     console.error("STS_SERVICE not found in attributeList.");
//   //     toast.error("Error: STS_SERVICE not found.");
//   //     return;
//   //   }
//   //   const stsData = stsService.characteristicList.reduce((acc: any, char: any) => {
//   //     acc[char.name] = char.realVal;
//   //     return acc;
//   //   }, {});

//   //   console.info(stsData, "STS Data");

//   //   const attService = attributeList.find((service: any) => service.serviceNameEnum === "ATT_SERVICE");

//   //   if (!attService) {
//   //       console.error("ATT_SERVICE not found in attributeList.");
//   //       toast.error("Error: ATT_SERVICE not found.");
//   //       return;
//   //   }

//   //   // Find the opid characteristic and get its realVal
//   //   const opidChar = attService.characteristicList.find((char: any) => char.name === "opid");

//   //   console.info(opidChar, "opid")
//   //   if (!opidChar) {
//   //       console.error("opid characteristic not found in ATT_SERVICE.");
//   //       toast.error("Error: opid not found in ATT_SERVICE.");
//   //       return;
//   //   }

//   //   const opidRealVal = opidChar.realVal; // e.g., "45AH2311000102"

//   //   // Define the data to publish in the new format
//   //   const dataToPublish = {
//   //       topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
//   //       qos: 0,
//   //       content: {
//   //           sts: stsData,
//   //           timestamp: Date.now(),
//   //           deviceInfo: "mac_address"
//   //       }
//   //   };



//   //   console.info(dataToPublish, "Data to Publish");

//   //   try {
//   //     window.WebViewJavascriptBridge.callHandler(
//   //       "mqttPublishMsg",
//   //       JSON.stringify(dataToPublish), // Try stringifying the data
//   //       (response) => {
//   //         console.info(`MQTT Response for`, response);

//   //       }
//   //     );
//   //   } catch (error) {
//   //     console.error(
//   //       `Error calling WebViewJavascriptBridge`,
//   //       error
//   //     );
//   //     toast.error(`Error publishing `);
//   //   }

//   // };

//   const handlePublish = (attributeList: any, serviceType: any) => {
//     if (!window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error("Error: WebViewJavascriptBridge is not initialized.");
//       return;
//     }
 
//     // First, ensure we have attributeList and it's an array
//     if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
//       console.error("AttributeList is empty or invalid");
//       toast.error("Error: Device data not available yet");
//       return;
//     }
 
//     // Find the ATT_SERVICE from the attributeList - this is required for all publish operations
//     const attService = attributeList.find((service: any) => service.serviceNameEnum === "ATT_SERVICE");
 
//     if (!attService) {
//       console.error("ATT_SERVICE not found in attributeList.");
//       toast.error("ATT service data is required but not available yet");
//       // Queue this publish for retry after ATT service is loaded
//       return;
//     }
 
//     // Get the opid from ATT_SERVICE
//     const opidChar = attService.characteristicList.find((char: any) => char.name === "opid");
 
//     if (!opidChar || !opidChar.realVal) {
//       console.error("opid characteristic not found or has no value in ATT_SERVICE.");
//       toast.error("Device ID not available");
//       return;
//     }
 
//     const opidRealVal = opidChar.realVal; // e.g., "45AH2311000102"
 
//     // Map service enum to match attributeList format
//     const serviceTypeMap: { [key: string]: string } = {
//       'ATT': 'ATT_SERVICE',
//       'CMD': 'CMD_SERVICE',
//       'STS': 'STS_SERVICE',
//       'DTA': 'DTA_SERVICE',
//       'DIA': 'DIA_SERVICE',
//     };
 
//     const serviceNameEnum = serviceTypeMap[serviceType] || serviceType;
 
//     // Find the requested service from the attributeList
//     const requestedService = attributeList.find((service: any) =>
//       service.serviceNameEnum === serviceNameEnum
//     );
 
//     if (!requestedService) {
//       console.error(`${serviceNameEnum} not found in attributeList.`);
//       // toast.error(`${serviceType} service data not available yet`);
//       return;
//     }
 
//     // Convert service data to key-value format
//     const serviceData = requestedService.characteristicList.reduce((acc: any, char: any) => {
//       // Skip null or undefined values
//       if (char.realVal !== null && char.realVal !== undefined) {
//         acc[char.name] = char.realVal;
//       }
//       return acc;
//     }, {});
 
//     // Check if we have data to publish
//     if (Object.keys(serviceData).length === 0) {
//       console.error(`No valid data found in ${serviceType} service.`);
//       toast.error(`No data available to publish for ${serviceType}`);
//       return;
//     }
 
//     // Define the data to publish
//     const dataToPublish = {
//       topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
//       qos: 0,
//       content: {
//         // Use the service name as the key for the data object
//         [serviceType.toLowerCase()]: serviceData,
//         timestamp: Date.now(),
//         deviceInfo: androidId || ""
//       }
//     };
 
//     console.info(dataToPublish, `Data to Publish for ${serviceType} service`);
//     // toast(`Preparing to publish ${serviceType} data`, {
//     //   duration: 2000, // Show for 2 seconds
//     // }); 
//     // Try to publish via MQTT
//     try {
//       window.WebViewJavascriptBridge.callHandler(
//         "mqttPublishMsg",
//         JSON.stringify(dataToPublish),
//         (response) => {
//           console.info(`MQTT Response for ${serviceType}:`, response);
//           toast.success(`${serviceType} data published successfully`);
//         }
//       );
//     } catch (error) {
//       console.error(`Error publishing ${serviceType} data:`, error);
//       toast.error(`Error publishing ${serviceType} data`);
//     }
//   };
//   const readDeviceInfo = () => {
//     if (!window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error("Error: WebViewJavascriptBridge is not initialized.");
//       return;
//     }
//     try {
//       window.WebViewJavascriptBridge.callHandler(
//         'readDeviceInfo', "",
//         (response) => {
//           console.warn(response, "Response");
//           const jsonData = JSON.parse(response);
//           if (jsonData.respCode === "200" && jsonData.respData && jsonData.respData.ANDROID_ID) {
//             const androidId = jsonData.respData.ANDROID_ID;
//             setAndroidId(androidId)
//             console.warn(androidId, "765---")
//           }
//         }
//       );
//     } catch (error) {
//       console.error(`Error :`, error);
//       toast.error(`Error reding device info data`);
//     }
//   }

//   // Optional: Helper function to publish all available services
//   const publishAllAvailableServices = (attributeList: any) => {
//     if (!attributeList || !Array.isArray(attributeList) || attributeList.length === 0) {
//       console.error("AttributeList is empty or invalid");
//       toast.error("Error: Device data not available yet");
//       return;
//     }

//     // Check if ATT service is available (required for all publishes)
//     const hasAttService = attributeList.some(service => service.serviceNameEnum === "ATT_SERVICE");

//     if (!hasAttService) {
//       console.error("ATT_SERVICE not found - required for publishing");
//       toast.error("Cannot publish: ATT service data not available");
//       return;
//     }

//     // Map of service types to publish
//     const serviceTypes = ['ATT', 'CMD', 'STS', 'DTA', 'DIA'];

//     // Determine which services are available
//     const availableServices = serviceTypes.filter(type => {
//       const serviceNameEnum = `${type}_SERVICE`;
//       return attributeList.some(service => service.serviceNameEnum === serviceNameEnum);
//     });

//     if (availableServices.length === 0) {
//       toast.error("No service data available to publish");
//       return;
//     }

//     // Publish each available service with a slight delay between them
//     availableServices.forEach((serviceType, index) => {
//       setTimeout(() => {
//         handlePublish(attributeList, serviceType);
//       }, index * 500); // 500ms delay between each publish
//     });

//     console.info("Publishing services:", availableServices);
//   };
//   const handleBLERescan = () => {
//     if (isScanning && detectedDevices.length === 0) {
//       stopBleScan()
//     }
//     else {
//       setConnectedDevice(null)
//       setDetectedDevices([])
//       setSelectedDevice(null)
//       setConnectingDeviceId(null)
//       startBleScan()
//     }
//   }


//   return (
//     <>
//     <ProtectedRoute>
//       <Toaster
//         position="top-center"
//         toastOptions={{
//           // Customize default toast options
//           duration: 3000,
//           style: {
//             background: '#333',
//             color: '#fff',
//             padding: '16px',
//             borderRadius: '8px',
//           },
//           // Configure different types of toasts
//           success: {
//             iconTheme: {
//               primary: '#10B981',
//               secondary: 'white',
//             },
//           },
//           error: {
//             iconTheme: {
//               primary: '#EF4444',
//               secondary: 'white',
//             },
//           },
//         }}
//       />
//       {!selectedDevice ? (
//         <MobileListView
//           items={detectedDevices}
//           onStartConnection={startConnection}
//           connectedDevice={connectedDevice}
//           onScanQrCode={startQrCodeScan}
//           onRescanBleItems={handleBLERescan}
//           isScanning={isScanning}
//         />
//       ) : (
//         <DeviceDetailView
//           // @ts-ignore
//           device={deviceDetails}
//           attributeList={attrList}
//           onBack={handleBackToList}
//           onRequestServiceData={handleServiceDataRequest}
//           isLoadingService={loadingService}
//           serviceLoadingProgress={progress}
//           handlePublish={handlePublish} // Pass handlePublish to DeviceDetailView
//         />
//       )}
//       {isConnecting && (
//         <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
//           <div className="w-full max-w-md">
//             <ProgressiveLoading
//               initialMessage="Preparing to connect..."
//               completionMessage="Connection established!"
//               loadingSteps={bleLoadingSteps}
//               onLoadingComplete={() => { }} // Handled in callback
//               autoProgress={false} // Use real progress
//               progress={progress} // Pass real progress
//             />
//           </div>
//         </div>
//       )}
// </ProtectedRoute>
//     </>
//   );
// };

// export default AppContainer;


'use client'

import React, { useState, useRef } from 'react';
import MobileListView from './MobileListView';
import DeviceDetailView from './DeviceDetailView';
import { useEffect } from 'react';
import ProgressiveLoading from './loader';
import { connBleByMacAddress, initBleData, initServiceBleData } from "./utils"
import { Toaster, toast } from 'react-hot-toast';
import ProtectedRoute from '@/app/components/protectedRoute';
import { defaultImageUrl, itemImageMap } from '@/app/constants/imageUrls';
import { bleLoadingSteps } from './constants/loadingStepsConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, View } from 'lucide-react';
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
  const [userRole, setUserRole] = useState<'Distributor' | 'Customer'>('Customer'); // Default to Distributor
  const [isToggled, setIsToggled] = useState(false);
  const [isReloading, setIsReloading] = useState(false);



  // Load userRole from AsyncStorage on startup
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        if (storedRole) {
          setUserRole(storedRole as 'Customer' | 'Distributor');
        }
      } catch (error) {
        console.error('Error loading user role from AsyncStorage:', error);
      }
    };
    loadUserRole();
  }, []);

  // Function to toggle the role and save to AsyncStorage
  const toggleRole = async () => {
    const newRole = userRole === 'Distributor' ? 'Customer' : 'Distributor';
    try {
      await AsyncStorage.setItem('userRole', newRole);
      setUserRole(newRole);
      setIsToggled(!isToggled);
    } catch (error) {
      console.error('Error saving user role to AsyncStorage:', error);
    }
  };
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
  //   import('vconsole').then((module) => {
  //     const VConsole = module.default;
  //     new VConsole();
  //   });
  // }, []);


  useEffect(() => {
    // Check if we've already reloaded
    const hasReloaded = sessionStorage.getItem('hasReloaded');
  
    if (!hasReloaded) {
      // Set reloading state to true to show the loading indicator
      setIsReloading(true);
      
      // Store that we're going to reload
      sessionStorage.setItem('hasReloaded', 'true');
      
      // Set a timeout for the reload
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }
  
    return () => {
      sessionStorage.removeItem('hasReloaded');
    };
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
          // initBleData(macAddress);
          const data = {
            serviceName: "ATT", // ATT/STS/DIA/CMD/xx
            macAddress: macAddress
          };
          setLoadingService("ATT")
          initServiceBleData(data)
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
              console.warn("Mqtt Message Recieved --337")
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
              // setProgress(progressPercentage);

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
              // console.info("MQTT Connection Callback:", parsedMessage);
              responseCallback("Received MQTT Connection Callback");
            } catch (error) {
              setIsMqttConnected(false)
              console.error("Error parsing MQTT connection callback:", error);
            }
          }
        );

        bridge.registerHandler("bleInitServiceDataOnProgressCallBack", function (data,
          responseCallback) {
          console.info(data);
          const obj = JSON.parse(data);
          // console.log(obj.total, "Total------376----");
          // console.log(obj.progress, "Progress --------377------");
          const parsedData = JSON.parse(data);
          const progressPercentage = Math.round(
            (parsedData.progress / parsedData.total) * 100
          );
          setProgress(progressPercentage);
        });

        bridge.registerHandler("bleInitServiceDataOnCompleteCallBack", function (data,
          responseCallback) {

          const parsedData = JSON.parse(data);
          // console.info(parsedData, "On Complete----382---");
          setServiceAttrList((prevList: any) => {
            // If the list is empty, start a new array
            if (!prevList || prevList.length === 0) {
              return [parsedData];
            }

            // Find if service with same UUID already exists
            const existingServiceIndex = prevList.findIndex(
              (service: any) => service.uuid === parsedData.uuid
            );

            if (existingServiceIndex >= 0) {
              // Service exists, replace it
              const updatedList = [...prevList];
              updatedList[existingServiceIndex] = parsedData;
              return updatedList;
            } else {
              // Service doesn't exist, add it
              return [...prevList, parsedData];
            }
          });
          setTimeout(() => {
            setLoadingService(null);
          }, 100)

        });
        bridge.registerHandler("bleInitServiceDataFailureCallBack", function (data, responseCallback) {
          console.info(data);
          setLoadingService(null);
        });

        bridge.registerHandler(
          "mqttMsgArrivedCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            // console.info("MQTT Message Arrived Callback:", data);
            console.warn("Mqtt Message Recieved --429")
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
    readDeviceInfo()
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
  const LoadingOverlay = () => (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-800 font-medium">Initializing application...</p>
        <p className="text-gray-600 text-sm mt-2">Please wait, page will reload shortly</p>
      </div>
    </div>
  );


  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
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
      
      {/* Role Switcher Section - Only visible when no device is selected */}
      {!selectedDevice && (
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center text-white gap-2">
            {/* <View size={20} /> */}
            <span className="font-semibold">{userRole} View</span>
          </div>
          
          <button
            onClick={toggleRole}
            className="relative inline-flex items-center h-6 rounded-full w-12 transition-colors focus:outline-none"
          >
            <span 
              className={`${isToggled ? 'bg-blue-500' : 'bg-gray-600'} 
                absolute left-0 inline-block h-6 w-12 rounded-full transition-colors`}
            />
            <span 
              className={`${isToggled ? 'translate-x-6' : 'translate-x-1'} 
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
      )}

      {userRole === 'Distributor' ? (
        <ProtectedRoute>
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
              handlePublish={handlePublish}
              userRole={userRole} // Pass userRole
            />
          )}
        </ProtectedRoute>
      ) : (
        <>
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
              handlePublish={handlePublish}
              userRole={userRole} // Pass userRole
            />
          )}
        </>
      )}
          {isReloading && <LoadingOverlay />}

      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage="Preparing to connect..."
              completionMessage="Connection established!"
              loadingSteps={bleLoadingSteps}
              onLoadingComplete={() => { }}
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