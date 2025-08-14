"use client";

import React, { useState, useRef } from "react";
import MobileListView from "./MobileListView";
import DeviceDetailView from "./DeviceDetailView";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressiveLoading from "../../../../components/loader/progressiveLoading";
import { connBleByMacAddress, initServiceBleData } from "../../../utils";
import { Toaster, toast } from "react-hot-toast";
import { useBridge } from "@/app/context/bridgeContext";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, Shield, Contact } from "lucide-react";
import { apiUrl } from "@/lib/apollo-client";

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
  bleData: any;
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

// Declare global window.WebViewJavascriptBridge
declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const defaultImageUrl =
  "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png";

const AppContainer = () => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
  const [attributeList, setServiceAttrList] = useState<any>([]);
  const [progress, setProgress] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
    null
  );
  const [attrList, setAtrrList] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState<any>("");
  const [contact, setContact] = useState<string>("");
  const [isContactSubmitted, setIsContactSubmitted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const router = useRouter();

  // Find the selected device data
  const deviceDetails = selectedDevice
    ? detectedDevices.find((device) => device.macAddress === selectedDevice)
    : undefined;

  const detectedDevicesRef = useRef(detectedDevices);
  const bridgeInitRef = useRef(false);
  const { bridge } = useBridge();
  const connectedDeviceRef = useRef<string | null>(null);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  useEffect(() => {
    detectedDevicesRef.current = detectedDevices;
  }, [detectedDevices]);

  useEffect(() => {
    if (selectedDevice) {
      window.history.pushState(
        { bleDetail: true },
        "",
        window.location.pathname
      );
    }

    const handlePopState = () => {
      if (selectedDevice) {
        handleBackToList();
        window.history.pushState(null, "", window.location.pathname);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedDevice]);

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

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate email or 10-digit phone number
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;
    const isEmail = emailRegex.test(contact);
    const isPhone = phoneRegex.test(contact);

    if (!isEmail && !isPhone) {
      toast.error("Please enter a valid email address or 10-digit phone number");
      return;
    }

    setIsLoading(true);
    const authToken = localStorage.getItem("access_token");
    if (!authToken) {
      toast.error("Please sign in to fetch customer data", { duration: 5000 });
      router.push("/signin");
      setIsLoading(false);
      return;
    }

    // Construct GraphQL query to search by email or phone
    const query = `
      query {
        getAllCustomers(first: 10, search: "${contact}") {
          page {
            edges {
              node {
                _id
                name
                type
                contact {
                  email
                  phone
                }
                address {
                  street
                  city
                }
              }
              cursor
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ query }),
      });

      console.log("API Response Status:", response.status, response.statusText);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("API Response Data:", result);

      if (result.errors) {
        const errorMessage = result.errors[0]?.message || "GraphQL query failed";
        console.error("GraphQL Errors:", result.errors);
        throw new Error(errorMessage);
      }

      const customers = result.data?.getAllCustomers?.page?.edges || [];
      if (customers.length > 0) {
        const customer = customers[0].node;
        sessionStorage.setItem("customerId", customer._id);
        toast.success(
          `Customer found! ${customer.name} (ID: ${customer._id})`
        );
        setIsContactSubmitted(true);
      } else {
        console.warn("No customers found for contact:", contact);
        toast.error("No customers found for this email or phone number");
      }
    } catch (error: any) {
      console.error("Error fetching customer data:", {
        message: error.message,
        stack: error.stack,
        contact,
        apiUrl,
      });
      toast.error(
        `Failed to fetch customer data: ${error.message || "Unknown error"}`,
        { duration: 5000 }
      );
    } finally {
      setIsLoading(false);
    }
  };

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
  };

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

  function convertRssiToFormattedString(
    rssi: number,
    txPower: number = -59,
    n: number = 2
  ): string {
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }

  const setupBridge = (bridge: WebViewJavascriptBridge) => {
    const noop = () => {};
    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, noop);
    };

    if (!bridgeHasBeenInitialized) {
      bridgeHasBeenInitialized = true;
      try {
        bridge.init((_m, r) => r("js success!"));
      } catch (error) {
        console.error("Error initializing bridge:", error);
      }
    }

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
            const raw = Number(d.rssi);
            d.rssi = convertRssiToFormattedString(raw);
            d.rawRssi = raw;
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
            console.warn("Invalid device data format:", d);
          }
        } catch (err: any) {
          console.error("Error parsing BLE device data:", err);
          resp({ success: false, error: err.message });
        }
      }
    );

    const offBleConnectFail = reg(
      "bleConnectFailCallBack",
      (data: string, resp: any) => {
        setIsConnecting(false);
        setProgress(0);
        toast.error("Connection failed! Please try reconnecting again.", {
          id: "connect-toast",
        });
        resp(data);
      }
    );

    const offBleConnectSuccess = reg(
      "bleConnectSuccessCallBack",
      (macAddress: string, resp: any) => {
        sessionStorage.setItem("connectedDeviceMac", macAddress);
        setConnectedDevice(macAddress);
        setIsScanning(false);
        const d = { serviceName: "ATT", macAddress };
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

    const offSvcFail = reg("bleInitServiceDataFailureCallBack", () =>
      setLoadingService(null)
    );

    const mqttConfig: MqttConfig = {
      username: "Admin",
      password: "7xzUV@MT",
      clientId: "123",
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
  }, [bridge]);

  const startQrCodeScan = () => {
    console.info("Start QR Code Scan");
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler(
        "startQrCodeScan",
        999,
        (responseData) => {
          console.info(responseData);
        }
      );
    }
  };

  const handleServiceDataRequest = (serviceName: string) => {
    if (!selectedDevice) return;

    setLoadingService(serviceName);
    setProgress(0);

    const data = {
      serviceName: serviceName,
      macAddress: selectedDevice,
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
            console.error(
              "Error parsing JSON data from 'startBleScan' response:",
              error
            );
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
        "There was a problem connecting with device. Try doing it manually."
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
      toast.error("Error: Device data not available yet");
      return;
    }

    const attService = attributeList.find(
      (service: any) => service.serviceNameEnum === "ATT_SERVICE"
    );

    if (!attService) {
      console.error("ATT_SERVICE not found in attributeList.");
      toast.error("ATT service data is required but not available yet");
      return;
    }

    const opidChar = attService.characteristicList.find(
      (char: any) => char.name === "opid"
    );

    if (!opidChar || !opidChar.realVal) {
      console.error(
        "opid characteristic not found or has no value in ATT_SERVICE."
      );
      toast.error("Device ID not available");
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
      toast.error(`No data available to publish for ${serviceType}`);
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

    console.info(dataToPublish, `Data to Publish for ${serviceType} service`);
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
        "readDeviceInfo",
        "",
        (response) => {
          console.warn(response, "Response");
          const jsonData = JSON.parse(response);
          if (
            jsonData.respCode === "200" &&
            jsonData.respData &&
            jsonData.respData.ANDROID_ID
          ) {
            const androidId = jsonData.respData.ANDROID_ID;
            setAndroidId(androidId);
            console.warn(androidId, "765---");
          }
        }
      );
    } catch (error) {
      console.error(`Error :`, error);
      toast.error(`Error reading device info data`);
    }
  };

  const publishAllAvailableServices = (attributeList: any) => {
    if (
      !attributeList ||
      !Array.isArray(attributeList) ||
      attributeList.length === 0
    ) {
      console.error("AttributeList is empty or invalid");
      toast.error("Error: Device data not available yet");
      return;
    }

    const hasAttService = attributeList.some(
      (service) => service.serviceNameEnum === "ATT_SERVICE"
    );

    if (!hasAttService) {
      console.error("ATT_SERVICE not found - required for publishing");
      toast.error("Cannot publish: ATT service data not available");
      return;
    }

    const serviceTypes = ["ATT", "CMD", "STS", "DTA", "DIA"];
    const availableServices = serviceTypes.filter((type) => {
      const serviceNameEnum = `${type}_SERVICE`;
      return attributeList.some(
        (service) => service.serviceNameEnum === serviceNameEnum
      );
    });

    if (availableServices.length === 0) {
      toast.error("No service data available to publish");
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
    { percentComplete: 10, message: "Initializing Bluetooth connection..." },
    { percentComplete: 25, message: "Reading ATT Service..." },
    { percentComplete: 45, message: "Reading CMD Service..." },
    { percentComplete: 60, message: "Reading STS Service..." },
    { percentComplete: 75, message: "Reading DTA Service..." },
    { percentComplete: 90, message: "Reading DIA Service.." },
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
            background: "#333",
            color: "#fff",
            padding: "16px",
            borderRadius: "8px",
          },
          success: {
            iconTheme: {
              primary: "#10B981",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "#EF4444",
              secondary: "white",
            },
          },
        }}
      />
      {!selectedDevice && !isContactSubmitted ? (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Unpair Asset Account
              </h1>
              <p className="text-gray-300 leading-relaxed">
                Enter a registered email address or phone number to begin the account unpairing process
              </p>
            </div>

            {/* Main Card */}
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-700/50 p-8">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">1</span>
                    </div>
                    <span className="ml-2 text-sm font-medium text-blue-400">Contact Verification</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-gray-400 text-sm font-semibold">2</span>
                    </div>
                    <span className="ml-2 text-sm font-medium text-gray-500">Account Unpairing</span>
                  </div>
                </div>
              </div>

              {/* Contact Input Section */}
              <div className="space-y-6">
                <div>
                  <label htmlFor="contact" className="block text-sm font-semibold text-gray-200 mb-3">
                    Email or Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Contact className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="contact"
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleContactSubmit(e);
                        }
                      }}
                      placeholder="Email or phone number"
                      className="w-full pl-12 pr-4 py-4 bg-gray-700/80 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-100 placeholder-gray-400"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button
                  onClick={handleContactSubmit}
                  disabled={isLoading || !contact}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !selectedDevice ? (
        <MobileListView
          items={detectedDevices}
          onStartConnection={startConnection}
          connectedDevice={connectedDevice}
          onScanQrCode={startQrCodeScan}
          onRescanBleItems={handleBLERescan}
          isScanning={isScanning}
          onSubmitQrCode={handleQrCode}

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
};

export default AppContainer;
// "use client";

// import React, { useState, useRef } from "react";
// import MobileListView from "./MobileListView";
// import DeviceDetailView from "./DeviceDetailView";
// import { useEffect } from "react";
// import dynamic from "next/dynamic";
// import ProgressiveLoading from "../../../../components/loader/progressiveLoading";
// import { connBleByMacAddress, initServiceBleData } from "../../../utils";
// import { Toaster, toast } from "react-hot-toast";
// import { useBridge } from "@/app/context/bridgeContext";
// import { useRouter } from "next/navigation";
// import { Mail, ArrowRight, Shield } from "lucide-react";
// import { apiUrl } from "@/lib/apollo-client";

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

// interface AppState {
//   bleData: any;
//   detectedDevices: BleDevice[];
//   initBleData: any;
//   mqttMessage: any;
//   bridgeInitialized: boolean;
//   isScanning: boolean;
// }

// type AppAction =
//   | { type: "SET_BLE_DATA"; payload: any }
//   | { type: "ADD_DETECTED_DEVICE"; payload: BleDevice }
//   | { type: "SET_INIT_BLE_DATA"; payload: any }
//   | { type: "SET_MQTT_MESSAGE"; payload: any }
//   | { type: "SET_BRIDGE_INITIALIZED"; payload: boolean }
//   | { type: "SET_IS_SCANNING"; payload: boolean };

// interface MqttConfig {
//   username: string;
//   password: string;
//   clientId: string;
//   hostname: string;
//   port: number;
// }

// interface WebViewJavascriptBridge {
//   init: (
//     callback: (message: any, responseCallback: (response: any) => void) => void
//   ) => void;
//   registerHandler: (
//     handlerName: string,
//     handler: (data: string, responseCallback: (response: any) => void) => void
//   ) => void;
//   callHandler: (
//     handlerName: string,
//     data: any,
//     callback: (responseData: string) => void
//   ) => void;
// }

// // Declare global window.WebViewJavascriptBridge
// declare global {
//   interface Window {
//     WebViewJavascriptBridge?: WebViewJavascriptBridge;
//   }
// }

// const defaultImageUrl =
//   "https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png";

// const AppContainer = () => {
//   const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
//   const [bridgeInitialized, setBridgeInitialized] = useState<boolean>(false);
//   const [isScanning, setIsScanning] = useState<boolean>(false);
//   const [detectedDevices, setDetectedDevices] = useState<BleDevice[]>([]);
//   const [attributeList, setServiceAttrList] = useState<any>([]);
//   const [progress, setProgress] = useState(0);
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
//     null
//   );
//   const [attrList, setAtrrList] = useState([]);
//   const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
//   const [loadingService, setLoadingService] = useState<string | null>(null);
//   const [androidId, setAndroidId] = useState<any>("");
//   const [email, setEmail] = useState<string>("");
//   const [isEmailSubmitted, setIsEmailSubmitted] = useState<boolean>(false);
//   const [isLoading, setIsLoading] = useState<boolean>(false);

//   const router = useRouter();

//   // Find the selected device data
//   const deviceDetails = selectedDevice
//     ? detectedDevices.find((device) => device.macAddress === selectedDevice)
//     : undefined;

//   const detectedDevicesRef = useRef(detectedDevices);
//   const bridgeInitRef = useRef(false);
//   const { bridge } = useBridge();
//   const connectedDeviceRef = useRef<string | null>(null);

//   useEffect(() => {
//     connectedDeviceRef.current = connectedDevice;
//   }, [connectedDevice]);

//   useEffect(() => {
//     detectedDevicesRef.current = detectedDevices;
//   }, [detectedDevices]);

//   useEffect(() => {
//     if (selectedDevice) {
//       window.history.pushState(
//         { bleDetail: true },
//         "",
//         window.location.pathname
//       );
//     }

//     const handlePopState = () => {
//       if (selectedDevice) {
//         handleBackToList();
//         window.history.pushState(null, "", window.location.pathname);
//       }
//     };

//     window.addEventListener("popstate", handlePopState);
//     return () => window.removeEventListener("popstate", handlePopState);
//   }, [selectedDevice]);

//   const handleDeviceSelect = (deviceId: string) => {
//     setSelectedDevice(deviceId);
//   };

//   const handleBackToList = () => {
//     setSelectedDevice(null);
//   };

//   const startConnection = (macAddress: string) => {
//     if (macAddress === connectedDevice && attributeList.length > 0) {
//       setSelectedDevice(macAddress);
//     } else {
//       setIsConnecting(true);
//       setConnectingDeviceId(macAddress);
//       setProgress(0);
//       connBleByMacAddress(macAddress);
//     }
//   };

//   const handleEmailSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//       toast.error("Please enter a valid email address");
//       return;
//     }

//     setIsLoading(true);
//     const authToken = localStorage.getItem("access_token");
//     if (!authToken) {
//       toast.error("Please sign in to fetch customer data", { duration: 5000 });
//       router.push("/signin");
//       setIsLoading(false);
//       return;
//     }

//     const query = `
//       query {
//         getAllCustomers(first: 10, search: "${email}") {
//           page {
//             edges {
//               node {
//                 _id
//                 name
//                 type
//                 contact {
//                   email
//                   phone
//                 }
//                 address {
//                   street
//                   city
//                 }
//               }
//               cursor
//             }
//           }
//         }
//       }
//     `;

//     try {
//       const response = await fetch(apiUrl, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${authToken}`,
//         },
//         body: JSON.stringify({ query }),
//       });

//       console.log("API Response Status:", response.status, response.statusText);
//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error("API Error Response:", errorText);
//         throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
//       }

//       const result = await response.json();
//       console.log("API Response Data:", result);

//       if (result.errors) {
//         const errorMessage = result.errors[0]?.message || "GraphQL query failed";
//         console.error("GraphQL Errors:", result.errors);
//         throw new Error(errorMessage);
//       }

//       const customers = result.data?.getAllCustomers?.page?.edges || [];
//       if (customers.length > 0) {
//         const customer = customers[0].node;
//         sessionStorage.setItem("customerId", customer._id);
//         toast.success(
//           `Customer found! ${customer.name} (ID: ${customer._id})`
//         );
//         setIsEmailSubmitted(true);
//       } else {
//         console.warn("No customers found for email:", email);
//         toast.error("No customers found for this email");
//       }
//     } catch (error: any) {
//       console.error("Error fetching customer data:", {
//         message: error.message,
//         stack: error.stack,
//         email,
//         apiUrl,
//       });
//       toast.error(
//         `Failed to fetch customer data: ${error.message || "Unknown error"}`,
//         { duration: 5000 }
//       );
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const itemImageMap: { [key: string]: string } = {
//     PPSP: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1739505681/OVES-PRODUCTS/CROSS-GRID/Integrated%20Home%20Energy%20Systems%20-%20Oasis%E2%84%A2%20Series/ovT20-2400W/T20-2400W_efw5mh.png",
//     STOV: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1738897820/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/E-STOVE-BLE-AF/E-STOVE-BLE-AF_Left_side_cvs2wl.png",
//     INVE: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731914963/OVES-PRODUCTS/CROSS-GRID/xGrid_Inverter_Charger/INVP-48V-6.2KW-HF/INVP-48V-6.2KW-HP_Left_Side_2024-1118_fo0hpr.png",
//     "E-3P":
//       "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1733295976/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3%20Plus/E-3_L_wspsx8.png",
//     "S-6":
//       "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1726639186/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/S-6/F_el4vpq.png",
//     "E-3":
//       "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1690366674/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3/ovego-e-3-e-3_v2023114_c7mb0q.png",
//     BATP: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png",
//     CAMP: "https://res.cloudinary.com/oves/image/upload/v1627881710/OVES-PRODUCTS/OFF-GRID/ovCAMP%20SERIES/ovCAMP%20SERIES%20APPLIANCES/ovCamp%20Battery%20Hubs/6Ah%20ovCamp%20Hub%20Battery/6AH_W600_NB_uhlc3f.png",
//     HOME: "https://res.cloudinary.com/oves/image/upload/v1724910821/OVES-PRODUCTS/OFF-GRID/LUMN-HOME%20SERIES/LUMN-HOME%20SHARED%20COMPONENTS/LumnHome%20battery%20hub/lumn-home-battery-hub_front_NBG_HDR.png",
//     BATT: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
//     Batt: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
//     UBP1: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743147157/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-1K/UBP1K_AC_Output_250W_ee1ar3.png",
//     UBP2: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743155669/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-2K/UBP_2_AC_Output_._ottb1j.png",
//   };

//   const getImageUrl = (name: string): string => {
//     const parts = name.split(" ");
//     if (parts.length >= 2) {
//       const keyword = parts[1];
//       const mapKey = Object.keys(itemImageMap).find(
//         (k) => k.toLowerCase() === keyword.toLowerCase()
//       );
//       if (mapKey) {
//         const url = itemImageMap[mapKey];
//         return url || defaultImageUrl;
//       }
//     }
//     return defaultImageUrl;
//   };

//   function convertRssiToFormattedString(
//     rssi: number,
//     txPower: number = -59,
//     n: number = 2
//   ): string {
//     const distance = Math.pow(10, (txPower - rssi) / (10 * n));
//     return `${rssi}db ~ ${distance.toFixed(0)}m`;
//   }

//   const setupBridge = (bridge: WebViewJavascriptBridge) => {
//     const noop = () => {};
//     const reg = (name: string, handler: any) => {
//       bridge.registerHandler(name, handler);
//       return () => bridge.registerHandler(name, noop);
//     };

//     if (!bridgeHasBeenInitialized) {
//       bridgeHasBeenInitialized = true;
//       try {
//         bridge.init((_m, r) => r("js success!"));
//       } catch (error) {
//         console.error("Error initializing bridge:", error);
//       }
//     }

//     const offPrint = reg("print", (data: string, resp: any) => {
//       try {
//         const parsed = JSON.parse(data);
//         if (parsed?.data) resp(parsed.data);
//         else throw new Error("Parsed data is not in the expected format.");
//       } catch (err) {
//         console.error("Error parsing JSON in 'print':", err);
//       }
//     });

//     const offFindBle = reg(
//       "findBleDeviceCallBack",
//       (
//         data: string,
//         resp: (r: { success: boolean; error?: string }) => void
//       ) => {
//         try {
//           const d: BleDevice = JSON.parse(data);
//           if (d.macAddress && d.name && d.rssi && d.name.includes("OVES")) {
//             const raw = Number(d.rssi);
//             d.rawRssi = raw;
//             d.rssi = convertRssiToFormattedString(raw);
//             d.imageUrl = getImageUrl(d.name);

//             setDetectedDevices((prev) => {
//               const exists = prev.some((p) => p.macAddress === d.macAddress);
//               const next = exists
//                 ? prev.map((p) =>
//                     p.macAddress === d.macAddress
//                       ? {
//                           ...p,
//                           rssi: d.rssi,
//                           rawRssi: d.rawRssi,
//                         }
//                       : p
//                   )
//                 : [...prev, d];
//               return [...next].sort((a, b) => b.rawRssi - a.rawRssi);
//             });

//             resp({ success: true });
//           } else {
//             console.warn("Invalid device data format:", d);
//           }
//         } catch (err: any) {
//           console.error("Error parsing BLE device data:", err);
//           resp({ success: false, error: err.message });
//         }
//       }
//     );

//     const offBleConnectFail = reg(
//       "bleConnectFailCallBack",
//       (data: string, resp: any) => {
//         setIsConnecting(false);
//         setProgress(0);
//         toast.error("Connection failed! Please try reconnecting again.", {
//           id: "connect-toast",
//         });
//         resp(data);
//       }
//     );

//     const offBleConnectSuccess = reg(
//       "bleConnectSuccessCallBack",
//       (macAddress: string, resp: any) => {
//         sessionStorage.setItem("connectedDeviceMac", macAddress);
//         setConnectedDevice(macAddress);
//         setIsScanning(false);
//         const d = { serviceName: "ATT", macAddress };
//         setLoadingService("ATT");
//         initServiceBleData(d);
//         resp(macAddress);
//       }
//     );

//     const offInitComplete = reg(
//       "bleInitDataOnCompleteCallBack",
//       (data: string, resp: any) => {
//         const r = JSON.parse(data);
//         setServiceAttrList(
//           r.dataList.map((s: any, i: any) => ({ ...s, index: i }))
//         );
//         resp(data);
//       }
//     );

//     const offInitData = reg(
//       "bleInitDataCallBack",
//       (data: string, resp: any) => {
//         try {
//           const p = JSON.parse(data);
//           resp(p);
//         } catch (err) {
//           console.error(
//             "Error parsing JSON data from 'bleInitDataCallBack' handler:",
//             err
//           );
//         }
//       }
//     );

//     const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
//       try {
//         const p = JSON.parse(data);
//         const qrVal = p.respData.value || "";
//         handleQrCode(qrVal.slice(-6).toLowerCase());
//       } catch (err) {
//         console.error("Error processing QR code data:", err);
//       }
//       resp(data);
//     });

//     const offMqttRecv = reg(
//       "mqttMessageReceived",
//       (data: string, resp: any) => {
//         try {
//           const p = JSON.parse(data);
//           resp(p);
//         } catch (err) {
//           console.error("Error parsing MQTT message:", err);
//         }
//       }
//     );

//     const offInitProg = reg("bleInitDataOnProgressCallBack", (data: string) => {
//       try {
//         const p = JSON.parse(data);
//         setProgress(Math.round((p.progress / p.total) * 100));
//       } catch (err) {
//         console.error("Progress callback error:", err);
//       }
//     });

//     const offConnectMqtt = reg(
//       "connectMqttCallBack",
//       (data: string, resp: any) => {
//         try {
//           JSON.parse(data);
//           setIsMqttConnected(true);
//           resp("Received MQTT Connection Callback");
//         } catch (err) {
//           setIsMqttConnected(false);
//           console.error("Error parsing MQTT connection callback:", err);
//         }
//       }
//     );

//     const offSvcProg = reg(
//       "bleInitServiceDataOnProgressCallBack",
//       (data: string) => {
//         const p = JSON.parse(data);
//         setProgress(Math.round((p.progress / p.total) * 100));
//       }
//     );

//     const offSvcComplete = reg(
//       "bleInitServiceDataOnCompleteCallBack",
//       (data: string, resp: any) => {
//         const parsedData = JSON.parse(data);
//         setServiceAttrList((prev: any) => {
//           if (!prev || prev.length === 0) return [parsedData];
//           const idx = prev.findIndex((s: any) => s.uuid === parsedData.uuid);
//           if (idx >= 0) {
//             const u = [...prev];
//             u[idx] = parsedData;
//             return u;
//           }
//           return [...prev, parsedData];
//         });
//         setTimeout(() => setLoadingService(null), 100);
//         resp(data);
//       }
//     );

//     const offSvcFail = reg("bleInitServiceDataFailureCallBack", () =>
//       setLoadingService(null)
//     );

//     const mqttConfig: MqttConfig = {
//       username: "Admin",
//       password: "7xzUV@MT",
//       clientId: "123",
//       hostname: "mqtt.omnivoltaic.com",
//       port: 1883,
//     };

//     bridge.callHandler("connectMqtt", mqttConfig, (resp: string) => {
//       try {
//         const p = JSON.parse(resp);
//         if (p.error) console.error("MQTT connection error:", p.error.message);
//       } catch (err) {
//         console.error("Error parsing MQTT response:", err);
//       }
//     });

//     return () => {
//       offPrint();
//       offFindBle();
//       offBleConnectFail();
//       offBleConnectSuccess();
//       offInitComplete();
//       offInitData();
//       offQr();
//       offMqttRecv();
//       offInitProg();
//       offConnectMqtt();
//       offSvcProg();
//       offSvcComplete();
//       offSvcFail();

//       if (connectedDeviceRef.current) {
//         bridge.callHandler(
//           "disconnectBle",
//           connectedDeviceRef.current,
//           () => {}
//         );
//       }

//       bridge.callHandler("stopBleScan", "", () => {});
//     };
//   };

//   useEffect(() => {
//     if (bridge) {
//       setupBridge(bridge);
//       readDeviceInfo();
//     }
//   }, [bridge]);

//   const startQrCodeScan = () => {
//     console.info("Start QR Code Scan");
//     if (window.WebViewJavascriptBridge) {
//       window.WebViewJavascriptBridge.callHandler(
//         "startQrCodeScan",
//         999,
//         (responseData) => {
//           console.info(responseData);
//         }
//       );
//     }
//   };

//   const handleServiceDataRequest = (serviceName: string) => {
//     if (!selectedDevice) return;

//     setLoadingService(serviceName);
//     setProgress(0);

//     const data = {
//       serviceName: serviceName,
//       macAddress: selectedDevice,
//     };

//     initServiceBleData(data);
//   };

//   useEffect(() => {
//     if (progress === 100 && attributeList.length > 0) {
//       setIsConnecting(false);
//       setSelectedDevice(connectingDeviceId);
//       setAtrrList(attributeList);
//       handlePublish(attributeList, loadingService);
//     }
//   }, [progress, attributeList]);

//   useEffect(() => {
//     if (!bridgeHasBeenInitialized) return;

//     stopBleScan();

//     const id = setTimeout(() => {
//       startBleScan();
//     }, 300);

//     return () => {
//       clearTimeout(id);
//       stopBleScan();
//     };
//   }, [bridgeHasBeenInitialized]);

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
//             console.error(
//               "Error parsing JSON data from 'startBleScan' response:",
//               error
//             );
//           }
//         }
//       );
//       setIsScanning(true);
//     } else {
//       console.error("WebViewJavascriptBridge is not initialized.");
//     }
//   };

//   const stopBleScan = () => {
//     if (window.WebViewJavascriptBridge) {
//       window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
//       setIsScanning(false);
//     }
//   };

//   const handleQrCode = (code: string) => {
//     const currentDevices = detectedDevicesRef.current;
//     const matches = currentDevices.filter((device) => {
//       const name = (device.name || "").toLowerCase();
//       const last6FromName = name.slice(-6);
//       return last6FromName === code;
//     });

//     if (matches.length === 1) {
//       startConnection(matches[0].macAddress);
//     } else {
//       toast.error(
//         "There was a problem connecting with device. Try doing it manually."
//       );
//     }
//   };

//   const handlePublish = (attributeList: any, serviceType: any) => {
//     if (!window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       return;
//     }

//     if (
//       !attributeList ||
//       !Array.isArray(attributeList) ||
//       attributeList.length === 0
//     ) {
//       console.error("AttributeList is empty or invalid");
//       toast.error("Error: Device data not available yet");
//       return;
//     }

//     const attService = attributeList.find(
//       (service: any) => service.serviceNameEnum === "ATT_SERVICE"
//     );

//     if (!attService) {
//       console.error("ATT_SERVICE not found in attributeList.");
//       toast.error("ATT service data is required but not available yet");
//       return;
//     }

//     const opidChar = attService.characteristicList.find(
//       (char: any) => char.name === "opid"
//     );

//     if (!opidChar || !opidChar.realVal) {
//       console.error(
//         "opid characteristic not found or has no value in ATT_SERVICE."
//       );
//       toast.error("Device ID not available");
//       return;
//     }

//     const opidRealVal = opidChar.realVal;

//     const serviceTypeMap: { [key: string]: string } = {
//       ATT: "ATT_SERVICE",
//       CMD: "CMD_SERVICE",
//       STS: "STS_SERVICE",
//       DTA: "DTA_SERVICE",
//       DIA: "DIA_SERVICE",
//     };

//     const serviceNameEnum = serviceTypeMap[serviceType] || serviceType;

//     const requestedService = attributeList.find(
//       (service: any) => service.serviceNameEnum === serviceNameEnum
//     );

//     if (!requestedService) {
//       console.error(`${serviceNameEnum} not found in attributeList.`);
//       return;
//     }

//     const serviceData = requestedService.characteristicList.reduce(
//       (acc: any, char: any) => {
//         if (char.realVal !== null && char.realVal !== undefined) {
//           acc[char.name] = char.realVal;
//         }
//         return acc;
//       },
//       {}
//     );

//     if (Object.keys(serviceData).length === 0) {
//       console.error(`No valid data found in ${serviceType} service.`);
//       toast.error(`No data available to publish for ${serviceType}`);
//       return;
//     }

//     const dataToPublish = {
//       topic: `dt/OVAPPBLE/DEVICENAME/${opidRealVal}`,
//       qos: 0,
//       content: {
//         // Use the service name as the key for the data object
//         [serviceType.toLowerCase()]: serviceData,
//         timestamp: Date.now(),
//         deviceInfo: androidId || "",
//       },
//     };

//     console.info(dataToPublish, `Data to Publish for ${serviceType} service`);
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
//       return;
//     }
//     try {
//       window.WebViewJavascriptBridge.callHandler(
//         "readDeviceInfo",
//         "",
//         (response) => {
//           console.warn(response, "Response");
//           const jsonData = JSON.parse(response);
//           if (
//             jsonData.respCode === "200" &&
//             jsonData.respData &&
//             jsonData.respData.ANDROID_ID
//           ) {
//             const androidId = jsonData.respData.ANDROID_ID;
//             setAndroidId(androidId);
//             console.warn(androidId, "765---");
//           }
//         }
//       );
//     } catch (error) {
//       console.error(`Error :`, error);
//       toast.error(`Error reading device info data`);
//     }
//   };

//   const publishAllAvailableServices = (attributeList: any) => {
//     if (
//       !attributeList ||
//       !Array.isArray(attributeList) ||
//       attributeList.length === 0
//     ) {
//       console.error("AttributeList is empty or invalid");
//       toast.error("Error: Device data not available yet");
//       return;
//     }

//     const hasAttService = attributeList.some(
//       (service) => service.serviceNameEnum === "ATT_SERVICE"
//     );

//     if (!hasAttService) {
//       console.error("ATT_SERVICE not found - required for publishing");
//       toast.error("Cannot publish: ATT service data not available");
//       return;
//     }

//     const serviceTypes = ["ATT", "CMD", "STS", "DTA", "DIA"];
//     const availableServices = serviceTypes.filter((type) => {
//       const serviceNameEnum = `${type}_SERVICE`;
//       return attributeList.some(
//         (service) => service.serviceNameEnum === serviceNameEnum
//       );
//     });

//     if (availableServices.length === 0) {
//       toast.error("No service data available to publish");
//       return;
//     }

//     availableServices.forEach((serviceType, index) => {
//       setTimeout(() => {
//         handlePublish(attributeList, serviceType);
//       }, index * 500);
//     });

//     console.info("Publishing services:", availableServices);
//   };

//   const bleLoadingSteps = [
//     { percentComplete: 10, message: "Initializing Bluetooth connection..." },
//     { percentComplete: 25, message: "Reading ATT Service..." },
//     { percentComplete: 45, message: "Reading CMD Service..." },
//     { percentComplete: 60, message: "Reading STS Service..." },
//     { percentComplete: 75, message: "Reading DTA Service..." },
//     { percentComplete: 90, message: "Reading DIA Service.." },
//   ];

//   const handleBLERescan = () => {
//     if (isScanning && detectedDevices.length === 0) {
//       stopBleScan();
//     } else {
//       setConnectedDevice(null);
//       setDetectedDevices([]);
//       setSelectedDevice(null);
//       setConnectingDeviceId(null);
//       startBleScan();
//     }
//   };

//   return (
//     <>
//       <Toaster
//         position="top-center"
//         toastOptions={{
//           duration: 3000,
//           style: {
//             background: "#333",
//             color: "#fff",
//             padding: "16px",
//             borderRadius: "8px",
//           },
//           success: {
//             iconTheme: {
//               primary: "#10B981",
//               secondary: "white",
//             },
//           },
//           error: {
//             iconTheme: {
//               primary: "#EF4444",
//               secondary: "white",
//             },
//           },
//         }}
//       />
//       {!selectedDevice && !isEmailSubmitted ? (
//         <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
//           <div className="w-full max-w-md">
//             {/* Header */}
//             <div className="text-center mb-8">
//               <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
//                 <Shield className="w-8 h-8 text-white" />
//               </div>
//               <h1 className="text-3xl font-bold text-white mb-2">
//                 Pair Asset Account
//               </h1>
//               <p className="text-gray-300 leading-relaxed">
//                 Enter the customer registered email address to begin the account pairing process
//               </p>
//             </div>

//             {/* Main Card */}
//             <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-700/50 p-8">
//               {/* Progress Indicator */}
//               <div className="flex items-center justify-center mb-8">
//                 <div className="flex items-center space-x-4">
//                   <div className="flex items-center">
//                     <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
//                       <span className="text-white text-sm font-semibold">1</span>
//                     </div>
//                     <span className="ml-2 text-sm font-medium text-blue-400">Email Verification</span>
//                   </div>
//                   <ArrowRight className="w-4 h-4 text-gray-500" />
//                   <div className="flex items-center">
//                     <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
//                       <span className="text-gray-400 text-sm font-semibold">2</span>
//                     </div>
//                     <span className="ml-2 text-sm font-medium text-gray-500">Account Pairing</span>
//                   </div>
//                 </div>
//               </div>

//               {/* Email Input Section */}
//               <div className="space-y-6">
//                 <div>
//                   <label htmlFor="email" className="block text-sm font-semibold text-gray-200 mb-3">
//                     Email Address
//                   </label>
//                   <div className="relative">
//                     <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
//                       <Mail className="h-5 w-5 text-gray-400" />
//                     </div>
//                     <input
//                       id="email"
//                       type="email"
//                       value={email}
//                       onChange={(e) => setEmail(e.target.value)}
//                       onKeyDown={(e) => {
//                         if (e.key === 'Enter') {
//                           handleEmailSubmit(e);
//                         }
//                       }}
//                       placeholder="Enter your registered email"
//                       className="w-full pl-12 pr-4 py-4 bg-gray-700/80 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-100 placeholder-gray-400"
//                       disabled={isLoading}
//                     />
//                   </div>
//                 </div>

//                 <button
//                   onClick={handleEmailSubmit}
//                   disabled={isLoading || !email}
//                   className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center space-x-2"
//                 >
//                   {isLoading ? (
//                     <>
//                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                       <span>Verifying...</span>
//                     </>
//                   ) : (
//                     <>
//                       <span>Continue</span>
//                       <ArrowRight className="w-5 h-5" />
//                     </>
//                   )}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       ) : !selectedDevice ? (
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
//         //@ts-ignore
//           device={deviceDetails}
//           attributeList={attrList}
//           onBack={handleBackToList}
//           onRequestServiceData={handleServiceDataRequest}
//           isLoadingService={loadingService}
//           serviceLoadingProgress={progress}
//           handlePublish={handlePublish}
//         />
//       )}
//       {isConnecting && (
//         <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
//           <div className="w-full max-w-md">
//             <ProgressiveLoading
//               initialMessage="Preparing to connect..."
//               completionMessage="Connection established!"
//               loadingSteps={bleLoadingSteps}
//               onLoadingComplete={() => {}}
//               autoProgress={false}
//               progress={progress}
//             />
//           </div>
//         </div>
//       )}
//     </>
//   );
// };

// export default AppContainer;