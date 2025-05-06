
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
import NonDeviceDetailView from './NonDeviceDetailView';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthProvider';

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
interface Contact {
  name: string;
  phoneNumber: string;
}
interface OcrResult {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number,
    y: number,
    width: number,
    height: number
  }
}

// Interface for location data
interface LocationData {
  latitude: number;
  longitude: number;
  [key: string]: any;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}
type NetworkType = 'wifi' | 'cellular' | 'offline' | 'unknown' | 'ethernet';


// Declare global window.WebViewJavascriptBridge
declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}
type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'maplocation' | 'settings' | 'location' | 'debug';




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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [networkType, setNetworkType] = useState<NetworkType>('unknown');
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState<any>("")
  // const [userRole, setUserRole] = useState<'Distributor' | 'Customer'>('Customer'); // Default to Distributor
  const [isToggled, setIsToggled] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  // const [activePage, setActivePage] = useState<PageType>('assets');
  // const [activeSubPage, setActiveSubPage] = useState<string>('cmd'); // Default to 'cmd'
  // const [activeSubPage, setActiveSubPage] = useState<string>('cmd');
  // const [activeSubPage, setActiveSubPage] = useState<string>(isAuthenticated ? 'bledevices' : 'cmd'); // Conditional default
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeSubPage, setActiveSubPage] = useState<string>(
    isAuthenticated ? 'bledevices' : 'cmd'
  );
  
  
  useEffect(() => {
    // This will only run on the client side
    setActiveSubPage(isAuthenticated ? 'bledevices' : 'cmd');
  }, [isAuthenticated]);

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
  // Handler for updating activePage and activeSubPage with restrictions
const handleSubMenuItemClick = (menuId: PageType, itemId: string) => {
  // List of restricted pages when not authenticated
  const restrictedPages = [
    'settings',
    'dashboard',
    'customer',
    'team',
    'company',
    'maplocation',
    'location',
    'debug'
  ];

  if (!isAuthenticated && restrictedPages.includes(menuId)) {
    router.push('/login');
    return;
  }

  // Continue with normal navigation if authenticated or page isn't restricted
  setActiveSubPage(itemId);
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

  useEffect(() => {
    import('vconsole').then((module) => {
      const VConsole = module.default;
      new VConsole();
    });
  }, []);


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
        bridge.registerHandler(
          "choosePictureCallBack",
          (data: any, responseCallback: (response: any) => void) => {
            try {
              const result = typeof data === 'string' ? JSON.parse(data) : data;
              const base64StringRaw = result?.base64Str || result?.base64 || result?.base64Srr;

              if (!base64StringRaw) {
                toast.error("No base64 field found in data", { duration: 4000 });
                throw new Error("No base64 field provided");
              }
              if (typeof base64StringRaw !== 'string') {
                toast.error("Base64 is not a string", { duration: 4000 });
                throw new Error("Base64 data is not a string");
              }
              if (base64StringRaw.length === 0) {
                toast.error("Base64 string is empty", { duration: 4000 });
                throw new Error("Base64 string is empty");
              }
              if (base64StringRaw.length < 100) {
                toast.error("Base64 too short: " + base64StringRaw.length, { duration: 4000 });
                throw new Error("Base64 string too short");
              }

              const base64String = base64StringRaw.replace(/[^A-Za-z0-9+/=]/g, '');
              if (base64String.length === 0) {
                toast.error("Base64 empty after cleaning", { duration: 4000 });
                throw new Error("Base64 string empty after cleaning");
              }
              if (!/^[A-Za-z0-9+/=]+$/.test(base64String)) {
                toast.error("Invalid base64 chars found", { duration: 4000 });
                throw new Error("Base64 string contains invalid characters");
              }

              const mimeType = result?.mimeType || result?.type || getMimeTypeFromBase64(base64String);
              const imageData = `data:${mimeType};base64,${base64String}`;

              setSelectedImage(imageData);
              console.info(`Image loaded in Page, length: ${imageData.length}`, { duration: 4000 });

              // toast.success(`Image loaded in Page, length: ${imageData.length}`, { duration: 4000 });

              responseCallback({ success: true, imageData });
            } catch (error) {
              const errorInfo = error instanceof Error ? error.message : String(error);
              toast.error(`Failed to load image: ${errorInfo}`, { duration: 4000 });
              responseCallback({ success: false, error: errorInfo });
            }
          }
        );

        // Helper function to detect MIME type from base64 prefix
        const getMimeTypeFromBase64 = (base64: string): string => {
          if (base64.startsWith("/9j/")) return "image/jpeg"; // JPEG
          if (base64.startsWith("iVBORw0KGgo")) return "image/png"; // PNG
          if (base64.startsWith("R0lGOD")) return "image/gif"; // GIF
          return "image/jpeg"; // Default fallback
        };

        bridge.registerHandler(
          "saveImageCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const parsedData = JSON.parse(data);
              console.info("Image save result:", parsedData);

              if (parsedData.success) {
                toast.success("Image saved successfully");
              } else {
                toast.error("Failed to save image: " + (parsedData.error || "Unknown error"));
              }

              responseCallback({ received: true });
            } catch (error) {
              console.error("Error processing save response:", error);
              toast.error("Error processing save response");
              responseCallback({ received: false });
            }
          }
        );
        // Handles reading contacts callback
        // In page.tsx - modify your readContactsCallBack handler
        bridge.registerHandler("readContactsCallBack", (data: string, responseCallback: (response: any) => void) => {
          try {
            const rawContactsData = typeof data === 'string' ? JSON.parse(data) : data;
            toast.dismiss('contacts-loading');

            console.log("Raw contacts data received:", rawContactsData);

            if (!Array.isArray(rawContactsData)) {
              toast.error("Invalid contacts data format");
              responseCallback({ success: false, error: "Invalid format" });
              return;
            }

            const formattedContacts = rawContactsData.map((contact, index) => ({
              name: contact.name || `Unknown Contact ${index}`,
              phoneNumber: contact.phoneNumber || 'No Phone Number'
            }));

            // Create a completely new array to ensure React detects the change
            setContacts([...formattedContacts]);

            // Add a second state update to force re-render
            setTimeout(() => {
              setContacts(prev => [...prev]);
            }, 100);

            toast.success(`Contacts updated successfully: ${formattedContacts.length} contacts`);
            responseCallback({ success: true, count: formattedContacts.length });
          } catch (error) {
            toast.dismiss('contacts-loading');
            toast.error("Failed to process contacts");
            toast.error(`Error details: ${String(error)}`);
            responseCallback({ success: false, error: String(error) });
          }
        });
        // Handles fingerprint verification callback
        bridge.registerHandler(
          "fingerprintVerificationCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            console.log("Callback triggered with raw data:", data);
            try {
              const rawFingerprintData = typeof data === 'string' ? JSON.parse(data) : data;
              console.info("Parsed fingerprint data:", rawFingerprintData);

              // Toast the raw fingerprint data immediately
              const dataString = JSON.stringify(rawFingerprintData, null, 2);
              // toast(`Raw Fingerprint Data:\n${dataString}`, { duration: 10000 });
              toast.dismiss('fingerprint-loading');

              // Validate data
              if (!rawFingerprintData || typeof rawFingerprintData !== 'object') {
                toast.error("Invalid fingerprint data received");
                responseCallback({ success: false, error: "Invalid raw data format" });
                return;
              }

              // Check success conditions
              const isSuccess = rawFingerprintData.respData === "true" || rawFingerprintData.respCode === "200";
              if (isSuccess) {
                toast.success("Fingerprint verified successfully", { duration: 5000 });
                responseCallback({ success: true });
              } else {
                const errorMsg = rawFingerprintData.respDesc || "Verification failed";
                toast.error(errorMsg);
                responseCallback({ success: false, error: errorMsg });
              }
            } catch (error) {
              console.error("Error processing fingerprint data:", error);
              toast.error(`Error: ${error}`);
              responseCallback({ success: false, error: String(error) || "Invalid response data" });
            }
          }
        );

        bridge.registerHandler(
          "callPhoneCallback",
          (data: string, responseCallback: (response: any) => void) => {
            console.log("Call phone callback triggered with raw data:", data);
            toast(`Raw callback data: ${data}`, { duration: 5000 });

            try {
              const phoneData = typeof data === 'string' ? JSON.parse(data) : data;
              console.info("Parsed phone data:", phoneData);
              toast(`Parsed callback response: ${JSON.stringify(phoneData, null, 2)}`, { duration: 5000 });

              toast.dismiss('phone-call-loading');

              if (!phoneData || typeof phoneData !== 'object') {
                toast.error("Invalid phone data received");
                responseCallback({ success: false, error: "Invalid data format" });
                return;
              }

              const dialedNumber = phoneData.phoneNumber || phoneData.phone || 'Not provided';
              toast(`Callback phone number: ${dialedNumber}`, { duration: 5000 }); // Check for 746663686237...

              const isSuccess = phoneData.respCode === "200" || phoneData.success === true;
              if (isSuccess) {
                toast.success(`Phone call initiated for ${dialedNumber}`, { duration: 5000 });
                // Warn if number looks incorrect
                if (dialedNumber.length > 15 || dialedNumber.includes('746663686237')) {
                  toast.error(`Warning: Dialed number may be incorrect (${dialedNumber})`, { duration: 10000 });
                }
                responseCallback({
                  success: true,
                  phoneNumber: dialedNumber
                });
              } else {
                const errorMsg = phoneData.respDesc || "Failed to initiate phone call";
                toast.error(errorMsg);
                responseCallback({
                  success: false,
                  error: errorMsg,
                  phoneNumber: dialedNumber
                });
              }
            } catch (error) {
              console.error("Error processing phone data:", error);
              toast.error(`Error: ${error}`);
              responseCallback({
                success: false,
                error: String(error) || "Invalid response data"
              });
            }
          }
        );
        bridge.registerHandler(
          "sendSmsCallback",
          (data: string, responseCallback: (response: any) => void) => {
            console.log("Send SMS callback triggered with raw data:", data);
            // toast(`Raw SMS callback data: ${data}`, { duration: 5000 });

            try {
              const smsData = typeof data === 'string' ? JSON.parse(data) : data;
              console.info("Parsed SMS data:", smsData);
              // toast(`Parsed SMS data: ${JSON.stringify(smsData, null, 2)}`, { duration: 5000 });

              toast.dismiss('sms-loading');

              if (!smsData || typeof smsData !== 'object') {
                toast.error("Invalid SMS data received");
                responseCallback({ success: false, error: "Invalid data format" });
                return;
              }

              const phoneNumber = smsData.phoneNumber || smsData.phone || 'Unknown';
              const message = smsData.message || smsData.content || '';

              const isSuccess = smsData.respCode === "200" || smsData.success === true;
              if (isSuccess) {
                toast.success(`SMS app opened for ${phoneNumber}${message ? ' with message' : ''}`, { duration: 5000 });
                responseCallback({
                  success: true,
                  phoneNumber,
                  message
                });
              } else {
                const errorMsg = smsData.respDesc || "Failed to open SMS app";
                toast.error(errorMsg);
                responseCallback({
                  success: false,
                  error: errorMsg,
                  phoneNumber,
                  message
                });
              }
            } catch (error) {
              console.error("Error processing SMS data:", error);
              toast.error(`Error: ${error}`);
              responseCallback({
                success: false,
                error: String(error) || "Invalid response data"
              });
            }
          }
        );
        bridge.registerHandler(
          "openOcrCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            console.log("OCR callback triggered with raw data:", data);
            try {
              let rawOcrData: any;

              // Handle different response types
              if (typeof data === 'string') {
                if (data.trim() === "") {
                  rawOcrData = { respCode: "400", respData: "", respDesc: "No data received" };
                } else {
                  try {
                    rawOcrData = JSON.parse(data); // Try parsing as JSON
                  } catch {
                    rawOcrData = { respCode: "200", respData: data, respDesc: "Plain text received" }; // Fallback to plain text
                  }
                }
              } else {
                rawOcrData = data; // Use as-is if not a string
              }

              console.info("Parsed OCR data:", rawOcrData);

              // Toast the raw OCR data
              const dataString = JSON.stringify(rawOcrData, null, 2);
              // toast(`Raw OCR Data:\n${dataString}`, { duration: 10000 });
              toast.dismiss('ocr-loading');

              // Validate data
              if (!rawOcrData || typeof rawOcrData !== 'object') {
                toast.error("Invalid OCR data received");
                responseCallback({ success: false, error: "Invalid raw data format" });
                return;
              }

              // Check success conditions
              const isSuccess = rawOcrData.respData && (rawOcrData.respCode === "200");
              if (isSuccess) {
                toast.success("OCR processed successfully");
                responseCallback({ success: true, extractedText: rawOcrData.respData });
              } else {
                const errorMsg = rawOcrData.respDesc || "OCR processing failed";
                toast.error(errorMsg);
                responseCallback({ success: false, error: errorMsg });
              }
            } catch (error) {
              console.error("Error processing OCR data:", error);
              toast.error(`Error: ${error}`);
              responseCallback({ success: false, error: String(error) || "Invalid response data" });
            }
          }
        );


        // Handles location updates callback
        bridge.registerHandler(
          "locationCallBack",
          (data: string, responseCallback: (response: any) => void) => {
            try {
              const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

              toast.dismiss('location-loading');
              const dataPreview = JSON.stringify(rawLocationData, null, 2);
              // toast(`Location: ${dataPreview}`, { duration: 3000 });

              if (!rawLocationData || typeof rawLocationData !== 'object') {
                toast.error("Invalid location data format");
                responseCallback({ success: false, error: "Invalid format" });
                return;
              }

              const { latitude, longitude } = rawLocationData;

              if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
                isNaN(latitude) || isNaN(longitude)) {
                toast.error("Invalid coordinates: Must be valid numbers");
                responseCallback({ success: false, error: "Invalid coordinates" });
                return;
              }

              // Update last known location
              setLastKnownLocation(rawLocationData);

              // Validate coordinates range
              if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                toast.error("Coordinates out of valid range");
              } else if (latitude === 0 && longitude === 0) {
                toast.error("Location at (0,0) - possible GPS error");
              } else {
                // toast.success(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
              }

              responseCallback({ success: true, location: rawLocationData });
            } catch (error) {
              toast.error("Error processing location data");
              responseCallback({ success: false, error: error });
            }
          }
        );
        bridge.registerHandler(
          'getNetworkTypeCallback',
          (data: string, responseCallback: (response: any) => void) => {
            console.log("getNetworkTypeCallback triggered with raw data:", data);
            toast(`Raw callback data: ${data}`, { duration: 5000 });

            try {
              const networkData = typeof data === 'string' ? JSON.parse(data) : data;
              console.info("Parsed network data:", networkData);
              toast(`Parsed network data: ${JSON.stringify(networkData, null, 2)}`, { duration: 5000 });

              toast.dismiss('network-loading');

              if (!networkData || typeof networkData !== 'object') {
                console.error("Invalid network data received:", networkData);
                toast.error("Invalid network data received");
                responseCallback({ success: false, error: "Invalid data format" });
                return;
              }

              const isSuccess = networkData.respCode === '200' || networkData.success === true;
              if (!isSuccess) {
                const errorMsg = networkData.respDesc || "Failed to get network type";
                console.error("Network type error:", errorMsg);
                toast.error(errorMsg);
                responseCallback({ success: false, error: errorMsg });
                return;
              }

              const networkTypeRaw = networkData.respData || 'unknown';
              let networkType: NetworkType;

              switch (networkTypeRaw.toLowerCase()) {
                case 'wifi':
                case 'wi-fi':
                  networkType = 'wifi';
                  break;
                case 'cellular':
                case '4g':
                case '5g':
                case '3g':
                case 'lte':
                  networkType = 'cellular';
                  break;
                case 'none':
                case 'offline':
                  networkType = 'offline';
                  break;
                case 'ethernet':
                  networkType = 'ethernet';
                  break;
                default:
                  networkType = 'unknown';
                  console.warn("Unrecognized network type:", networkTypeRaw);
                  toast.error(`Unrecognized network type: ${networkTypeRaw}`);
              }

              console.info("Resolved network type:", networkType);
              toast.success(`Network type: ${networkType}`, { duration: 5000 });
              setNetworkType(networkType); // Update page.tsx state
              responseCallback({ success: true, networkType });
            } catch (error) {
              console.error("Error processing network data:", error);
              toast.error(`Error: ${error}`);
              responseCallback({ success: false, error: String(error) || "Invalid response data" });
            }
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

  const handleChooseImage = () => {
    console.info("Initiating image selection");
    if (window.WebViewJavascriptBridge) {
      console.log("Bridge is available, calling choosePicture");
      window.WebViewJavascriptBridge.callHandler(
        'choosePicture',
        1,
        (responseData) => {
          console.log('Image selection response:', responseData);
          if (!responseData) {
            toast.error("No response from image picker");
          }
        }
      );
    } else {
      console.error("WebViewJavascriptBridge not available");
      toast.error("Cannot access image picker");
    }
  };

  const handleReadContacts = () => {
    console.info("Requesting contacts from device");
    if (window.WebViewJavascriptBridge) {
      toast.success("Reading contacts...");
      window.WebViewJavascriptBridge.callHandler(
        'readContacts',  // Make sure this matches the native-side handler name
        {},  // Empty object as parameter - adjust if your native side expects specific parameters
        (responseData: string) => {
          console.log('Native response to readContacts request:', responseData);
          // The actual contacts will come through the readContactsCallBack handler
        }
      );
    } else {
      console.error("WebViewJavascriptBridge not available");
      toast.error("Cannot access contacts - bridge not available");
    }
  };

  // Modify your handleFingerprintVerification function
  const handleFingerprintVerification = () => {
    console.info("Requesting fingerprint verification");

    if (window.WebViewJavascriptBridge) {
      toast("Reading fingerprint...", { id: 'fingerprint-loading' });
      window.WebViewJavascriptBridge.callHandler(
        'fingerprintVerification',  // The native handler name
        {},
        (responseData: string) => {
          console.log("Inline callback - Native response (ignored):", responseData);
          // Ignore this for now, rely on registered handler
        }
      );
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Cannot verify fingerprint - bridge not available");
    }
  };
  const handleCallPhone = (phoneNumber: string) => {
    console.info("Initiating call for:", phoneNumber);
    const cleanedNumber = phoneNumber.replace(/\D/g, ''); // Keep only digits, matches handleSendSms

    // toast(`Sending phone number: ${cleanedNumber}`, { duration: 5000 }); // Confirm: 0713505817
    // toast(`Sending data: ${JSON.stringify({ phoneNumber: cleanedNumber, phone: cleanedNumber })}`, { duration: 5000 }); // Debug payload

    if (!cleanedNumber || cleanedNumber.length < 10 || cleanedNumber.length > 15) {
      console.error("Invalid phone number:", cleanedNumber);
      toast.error("Invalid phone number format");
      return;
    }

    if (window.WebViewJavascriptBridge) {
      toast.loading("Initiating phone call...", { id: 'phone-call-loading' });
      window.WebViewJavascriptBridge.callHandler(
        'callPhone',
        { phoneNumber: cleanedNumber, phone: cleanedNumber }, // Send both keys
        (responseData: string) => {
          console.info("Inline call response:", responseData);
          // toast(`Inline native response: ${responseData}`, { duration: 5000 }); // E.g., {"respCode":"200",...}
        }
      );
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Cannot initiate phone call - bridge not available");
    }
  };
  const handleSendSms = (phoneNumber: string, message: string) => {
    console.info("Initiating SMS for:", phoneNumber, "with message:", message);
    const cleanedNumber = phoneNumber.replace(/\D/g, ''); // Keep only digits
    const trimmedMessage = message.trim(); // Will be "" for blank

    // toast(`Sending SMS to: ${cleanedNumber}`, { duration: 5000 });
    // toast(`Message: ${trimmedMessage || 'blank'}`, { duration: 5000 });
    // toast(`Sending data: ${JSON.stringify({ phoneNumber: cleanedNumber, phone: cleanedNumber, message: trimmedMessage, content: trimmedMessage })}`, { duration: 5000 });

    if (!cleanedNumber || cleanedNumber.length < 10 || cleanedNumber.length > 15) {
      console.error("Invalid phone number:", cleanedNumber);
      toast.error("Invalid phone number format");
      return;
    }

    if (window.WebViewJavascriptBridge) {
      // toast.loading("Opening SMS...", { id: 'sms-loading' });
      window.WebViewJavascriptBridge.callHandler(
        'sendSms',
        {
          phoneNumber: cleanedNumber,
          phone: cleanedNumber, // For compatibility
          message: trimmedMessage,
          content: trimmedMessage // For native key mismatch
        },
        (responseData: string) => {
          console.info("Inline SMS response:", responseData);
          // toast(`Inline SMS response: ${responseData}`, { duration: 5000 });
        }
      );
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Cannot open SMS - bridge not available");
    }
  };

  const handleOpenOcr = () => {
    toast.loading("Scanning text...", { id: 'ocr-loading' });
    console.info("Requesting to open OCR");

    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler(
        'openOcr',  // The native handler name
        {}, // Send input text to native side
        (responseData: string) => {
          console.log("Inline callback - Native OCR response (ignored):", responseData);
          // Rely on registered handler
        }
      );
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Cannot process OCR - bridge not available");
    }
  };
  const handleStartLocationListener = () => {
    console.info("Requesting to start location listener");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      // toast.error("Location service unavailable - bridge not found");
      return;
    }

    toast.loading("Starting location listener...", { id: 'location-loading' });
    window.WebViewJavascriptBridge.callHandler(
      'startLocationListener',
      {},
      (responseData) => {
        try {
          const parsedResponse = JSON.parse(responseData);
          if (parsedResponse?.respCode === "200") {
            setIsLocationListenerActive(true);
            toast.dismiss('location-loading');
            // toast.success("Location tracking started");
            handleGetLastLocation();
          } else {
            toast.dismiss('location-loading');
            toast.error(`Failed to start: ${parsedResponse?.respMessage || 'Unknown error'}`);
          }
        } catch (error) {
          toast.dismiss('location-loading');
          toast.error("Invalid response from location service");
          console.error("Error parsing start location response:", error);
        }
      }
    );
  };

  const handleStopLocationListener = () => {
    console.info("Requesting to stop location listener");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      // toast.error("Location service unavailable - bridge not found");
      return;
    }

    toast.loading("Stopping location listener...", { id: 'location-loading' });
    window.WebViewJavascriptBridge.callHandler(
      'stopLocationListener',
      {},
      (responseData) => {
        try {
          setIsLocationListenerActive(false);
          toast.dismiss('location-loading');
          toast.success("Location tracking stopped");
        } catch (error) {
          toast.dismiss('location-loading');
          toast.error("Error stopping location service");
          console.error("Error stopping location:", error);
        }
      }
    );
  };

  const handleGetLastLocation = () => {
    console.info("Requesting last known location");
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge not available");
      // toast.error("Location service unavailable - bridge not found");
      return;
    }

    toast.loading("Fetching last known location...", { id: 'location-loading' });
    window.WebViewJavascriptBridge.callHandler(
      'getLastLocation',
      {},
      (responseData) => {
        try {
          const parsedResponse = JSON.parse(responseData);
          const locationData = JSON.parse(parsedResponse.respData);
          if (locationData && typeof locationData.latitude === 'number' && typeof locationData.longitude === 'number') {
            setLastKnownLocation(locationData);
            // Only set active if the listener is actually running
            setIsLocationListenerActive(prev => prev); // Preserve current state
            toast.dismiss('location-loading');
            // toast.success(`Location retrieved: Lat ${locationData.latitude.toFixed(4)}, Lon ${locationData.longitude.toFixed(4)}`);
          } else {
            toast.dismiss('location-loading');
            toast.error("Invalid location data received");
          }
        } catch (error) {
          toast.dismiss('location-loading');
          toast.error("Failed to retrieve location");
          console.error("Error parsing location data:", error);
        }
      }
    );
  };
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
  const handleGetNetworkType = (): Promise<NetworkType> => {
    return new Promise((resolve, reject) => {
      console.info("Requesting network type");

      if (!window.WebViewJavascriptBridge) {
        console.error("WebViewJavascriptBridge is not initialized");
        toast.error("Cannot check network - bridge not available");
        toast.dismiss('network-loading');
        reject(new Error("Bridge not available"));
        return;
      }

      window.WebViewJavascriptBridge.callHandler('getNetworkType', null, (responseData: string) => {
        console.info("Inline getNetworkType response:", responseData);
        // toast(`Inline native response: ${responseData}`, { duration: 5000 });

        try {
          const networkData = JSON.parse(responseData);
          toast.dismiss('network-loading');

          if (!networkData || typeof networkData !== 'object') {
            console.error("Invalid network data received:", networkData);
            toast.error("Invalid network data received");
            reject(new Error("Invalid data format"));
            return;
          }

          const isSuccess = networkData.respCode === '200';
          if (!isSuccess) {
            const errorMsg = networkData.respDesc || "Failed to get network type";
            console.error("Network type error:", errorMsg);
            toast.error(errorMsg);
            reject(new Error(errorMsg));
            return;
          }

          const networkTypeRaw = networkData.respData || 'unknown';
          let networkType: NetworkType;

          switch (networkTypeRaw.toLowerCase()) {
            case 'wifi':
            case 'wi-fi':
              networkType = 'wifi';
              break;
            case 'cellular':
            case '4g':
            case '5g':
            case '3g':
            case 'lte':
              networkType = 'cellular';
              break;
            case 'none':
            case 'offline':
              networkType = 'offline';
              break;
            case 'ethernet':
              networkType = 'ethernet';
              break;
            default:
              networkType = 'unknown';
              console.warn("Unrecognized network type:", networkTypeRaw);
              toast.error(`Unrecognized network type: ${networkTypeRaw}`);
          }

          console.info("Resolved network type:", networkType);
          toast.success(`Network type: ${networkType}`, { duration: 5000 });
          setNetworkType(networkType); // Update page.tsx state
          resolve(networkType); // Resolve promise for MobileListView
        } catch (error) {
          console.error("Error processing network data:", error);
          toast.error(`Error: ${error}`);
          reject(error);
        }
      });
    });
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
      console.error("WebViewJavascriptBridge is not initialized.");
      // toast.error("Error: WebViewJavascriptBridge is not initialized.");
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

      { activeSubPage === 'bledevices' ? (
        <ProtectedRoute>
          {!selectedDevice ? (
           <MobileListView
           items={detectedDevices}
           onStartConnection={startConnection}
           connectedDevice={connectedDevice}
           onScanQrCode={startQrCodeScan}
           onRescanBleItems={handleBLERescan}
           isScanning={isScanning}
           activePage='assets'
           activeSubPage='bledevices'
           onSubMenuItemClick={handleSubMenuItemClick}
         />
          ) : (
            <DeviceDetailView
              //@ts-ignore
              device={deviceDetails}
              attributeList={attrList}
              onBack={handleBackToList}
              onRequestServiceData={handleServiceDataRequest}
              isLoadingService={loadingService}
              serviceLoadingProgress={progress}
              handlePublish={handlePublish}
            />
          )}
        </ProtectedRoute>
      ) : 
     activeSubPage === 'cmd' ? (
        !selectedDevice ? (
          <MobileListView
            items={detectedDevices}
            onStartConnection={startConnection}
            connectedDevice={connectedDevice}
            onScanQrCode={startQrCodeScan}
            onRescanBleItems={handleBLERescan}
            isScanning={isScanning}
            activePage='assets'
            activeSubPage={activeSubPage}
            onSubMenuItemClick={handleSubMenuItemClick}
          />
        ) : (
          <NonDeviceDetailView
            //@ts-ignore
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
        <MobileListView
          items={detectedDevices}
          onStartConnection={startConnection}
          connectedDevice={connectedDevice}
          onScanQrCode={startQrCodeScan}
          onRescanBleItems={handleBLERescan}
          isScanning={isScanning}
          activePage='assets'
          activeSubPage={activeSubPage}
          onSubMenuItemClick={handleSubMenuItemClick}
        />
      )}
      {isReloading && <LoadingOverlay />}

      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <ProgressiveLoading
              initialMessage="Preparing to connect..."
              completionMessage="Connection established!"
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
}

export default AppContainer;