"use client";

import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  Loader2,
  Wallet,
  LayoutDashboard,
  Package,
  CreditCard,
  Menu,
  LogOut,
  X,
  MapPin,
  User,
  HelpCircle,
  Key,
} from "lucide-react";
import Dashboard from "./dashboard";
import Products from "./products";
import Payments from "./payments";
import ChargingStationFinder from "./ChargingStationFinder";
import Login from "./login";
import Ticketing from "./ticketing";
import Authenticate from "./authenticate";
import { useBridge } from "@/app/context/bridgeContext";

let bridgeHasBeenInitialized = false;

// Define interfaces (unchanged)
interface ServicePlan {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  suggested_billing_frequency?: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
  company_id?: number;
}

interface PaymentTransaction {
  id: string;
  planName: string;
  amount: number;
  date: string;
  status: "completed" | "pending" | "failed";
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  locationName?: string;
  [key: string]: any;
}

interface MqttConfig {
  username: string;
  password: string;
  clientId: string;
  hostname: string;
  port: number;
}

interface FleetIds {
  [serviceType: string]: string[];
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

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const AppContainer = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "products" | "transactions" | "charging stations" | "support" | "authenticate" | "login">("login");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [allPlans, setAllPlans] = useState<ServicePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [fleetIds, setFleetIds] = useState<FleetIds | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [locationActions, setLocationActions] = useState<any[]>([]);
  const [isBindingSuccessful, setIsBindingSuccessful] = useState<boolean>(false);
  const bridgeInitRef = useRef(false);
  const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
  const { bridge } = useBridge();

  // New: bindCustomerToLocation (adapted from ChargingStationFinder's handleServiceRequest)
  const bindCustomerToLocation = async (locationId: string) => {
    if (!bridge || !window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      // toast.error("Cannot connect to service: Bridge not initialized");
      handleBindingResult({ success: false });
      return;
    }

    console.info(`Initiating bindCustomerToLocation for locationId: ${locationId}`);

    const requestTopic = "call/abs/service/plan/service-plan-basic-latest-a/bind_customer";
    const responseTopic = "rtrn/abs/service/plan/service-plan-basic-latest-a/bind_customer";

    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: "service-plan-basic-latest-a",
      correlation_id: `bind-${Date.now()}`,
      actor: {
        type: "customer",
        id: "CUST-RIDER-001",
      },
      data: {
        action: "BIND_CUSTOMER_TO_LOCATION",
        location_id: locationId,
        requested_services: ["battery_swap"],
        authentication_method: "mobile_app",
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    // Register MQTT response handler
    const reg = (name: string, handler: any) => {
      console.info(`Registering handler for ${name}`);
      bridge.registerHandler(name, handler);
      return () => {
        console.info(`Unregistering handler for ${name}`);
        bridge.registerHandler(name, () => {});
      };
    };

    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedData = JSON.parse(data);
          const message = parsedData;
          const topic = message.topic;
          const rawMessageContent = message.message;

          if (topic === responseTopic) {
            console.info("Response matches topic:", responseTopic);
            let responseData;
            try {
              responseData = typeof rawMessageContent === "string" ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch (parseErr) {
              console.error("Error parsing MQTT message content:", parseErr);
              responseData = rawMessageContent;
            }

            if (responseData?.data?.success) {
              const sessionToken = responseData.data.metadata?.session_token;
              const locationActions = responseData.data.metadata?.location_actions || [];
              if (sessionToken) {
                console.info("Binding successful - Session Token:", sessionToken);
                handleBindingResult({ sessionToken, locationActions, success: true });
                toast.success("Binding successful! Session token received.");
              } else {
                console.error("No session token in response:", responseData);
                handleBindingResult({ success: false });
                // toast.error("No session token received");
              }
            } else {
              const errorReason = responseData?.data?.metadata?.reason || 
                                  responseData?.data?.signals?.[0] || 
                                  "Unknown error";
              console.error("MQTT binding failed:", errorReason);
              handleBindingResult({ success: false });
              // toast.error(`Binding failed: ${errorReason}`);
            }
            responseCallback({ success: true });
          }
        } catch (err) {
          console.error("Error processing MQTT callback:", err);
          // toast.error("Error processing response");
          handleBindingResult({ success: false });
          responseCallback({ success: false, error: String(err) });
        }
      }
    );

    // Subscribe to the response topic
    const subscribeToTopic = () =>
      new Promise<boolean>((resolve) => {
        console.info(`Subscribing to MQTT response topic: ${responseTopic}`);
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            console.info("MQTT subscribe response:", subscribeResponse);
            try {
              const subResp = typeof subscribeResponse === "string" ? JSON.parse(subscribeResponse) : subscribeResponse;
              if (subResp.respCode === "200") {
                console.info("Successfully subscribed to:", responseTopic);
                resolve(true);
              } else {
                console.error("Subscribe failed:", subResp.respDesc || subResp.error || "Unknown error");
                // toast.error("Failed to subscribe to MQTT topic");
                resolve(false);
              }
            } catch (err) {
              console.error("Error parsing subscribe response:", err);
              // toast.error("Error subscribing to MQTT topic");
              resolve(false);
            }
          }
        );
      });

    // Publish the message
    const publishMessage = () =>
      new Promise<boolean>((resolve) => {
        console.info(`Publishing MQTT message to topic: ${requestTopic}`);
        bridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (response) => {
            console.info("MQTT publish response:", response);
            try {
              const responseData = typeof response === "string" ? JSON.parse(response) : response;
              if (responseData.error || responseData.respCode !== "200") {
                console.error("MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
                // toast.error("Failed to publish binding request");
                resolve(false);
              } else {
                console.info("Successfully published binding request");
                toast.success("Binding request sent");
                resolve(true);
              }
            } catch (err) {
              console.error("Error parsing MQTT publish response:", err);
              // toast.error("Error publishing binding request");
              resolve(false);
            }
          }
        );
      });

    // Cleanup function
    const cleanup = () => {
      console.info(`Cleaning up MQTT response handler and subscription for topic: ${responseTopic}`);
      offResponseHandler();
      bridge.callHandler(
        "mqttUnSubTopic",
        { topic: responseTopic, qos: 0 },
        (unsubResponse) => {
          console.info("MQTT unsubscribe response:", unsubResponse);
        }
      );
    };

    // Execute MQTT operations with retry mechanism
    const maxRetries = 3;
    const retryDelay = 2000;
    let retries = 0;

    const attemptMqttOperations = async () => {
      while (retries < maxRetries) {
        console.info(`Attempting MQTT operations (Attempt ${retries + 1}/${maxRetries})`);
        const subscribed = await subscribeToTopic();
        if (!subscribed) {
          retries++;
          if (retries < maxRetries) {
            console.info(`Retrying MQTT subscribe (${retries}/${maxRetries}) after ${retryDelay}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("Failed to subscribe to MQTT topic after retries");
            // toast.error("Failed to subscribe to MQTT topic after retries");
            cleanup();
            return;
          }
        }

        const published = await publishMessage();
        if (!published) {
          retries++;
          if (retries < maxRetries) {
            console.info(`Retrying MQTT publish (${retries}/${maxRetries}) after ${retryDelay}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("Failed to publish MQTT message after retries");
            // toast.error("Failed to publish binding request after retries");
            cleanup();
            return;
          }
        }

        console.info("MQTT operations successful, scheduling cleanup");
        setTimeout(() => cleanup(), 15000);
        return;
      }
    };

    try {
      await attemptMqttOperations();
    } catch (err) {
      console.error("Error in MQTT operations:", err);
      // toast.error("Error in MQTT operations");
      cleanup();
    }
  };

  // Check local storage for email on mount (unchanged)
  useEffect(() => {
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        try {
          const response = await fetch(
            `${API_BASE}/customers/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": "abs_connector_secret_key_2024",
              },
              body: JSON.stringify({ email: storedEmail }),
            }
          );

          const data = await response.json();
          if (response.status === 200) {
            setCustomer(data.customer);
            setIsLoggedIn(true);
            setCurrentPage("dashboard");
          } else {
            localStorage.removeItem("userEmail");
            setCurrentPage("products");
          }
        } catch (error) {
          console.error("Error verifying stored email:", error);
          localStorage.removeItem("userEmail");
          setCurrentPage("products");
        }
      } else {
        setCurrentPage("products");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Fetch service plans (unchanged)
  useEffect(() => {
    const fetchPlans = async () => {
      if (!customer?.company_id) {
        setIsLoadingPlans(false);
        return;
      }
      setIsLoadingPlans(true);
      try {
        const response = await fetch(
          `${API_BASE}/products/subscription?company_id=${customer.company_id}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": "abs_connector_secret_key_2024",
            },
          }
        );

        const data = await response.json();

        if (data.success && Array.isArray(data.products)) {
          const plans: ServicePlan[] = data.products.map((product: any) => ({
            name: product.name,
            price: product.list_price,
            productId: product.product_id,
            default_code: product.default_code,
            suggested_billing_frequency: product.suggested_billing_frequency || "monthly",
          }));
          setAllPlans(plans);
        } else {
          throw new Error("Invalid response format or no products found");
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        setAllPlans([]);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [customer]);

  // Fetch fleet IDs (unchanged)
  useEffect(() => {
    if (isMqttConnected && bridge && lastKnownLocation) {
      console.info("MQTT connected, triggering fetchFleetIds");
      const planId = selectedPlan?.default_code || "service-plan-basic-latest-a";
      fetchFleetIds(planId);
    }
  }, [isMqttConnected, bridge, lastKnownLocation, selectedPlan]);

  const fetchFleetIds = (planId: string) => {
    if (!bridge || !window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      return;
    }

    if (!lastKnownLocation || typeof lastKnownLocation.latitude !== 'number' || typeof lastKnownLocation.longitude !== 'number') {
      console.error("Invalid location data:", lastKnownLocation);
      return;
    }

    console.info("Plan ID used:", planId);
    console.info("Constructing MQTT request for fleet IDs with planId:", planId);
    const requestTopic = `call/abs/service/plan/${planId}/get_assets`;
    const responseTopic = `rtrn/abs/service/plan/${planId}/get_assets`;
    
    const timestamp = new Date().toISOString();
    
    const content = {
      timestamp,
      plan_id: planId,
      correlation_id: "test-asset-discovery-001",
      actor: {
        type: "customer",
        id: "CUST-RIDER-001"
      },
      data: {
        action: "GET_REQUIRED_ASSET_IDS",
        rider_location: {
          lat: lastKnownLocation.latitude,
          lng: lastKnownLocation.longitude,
        },
        search_radius: 10,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content,
    };

    console.info("MQTT message sent to bridge:", JSON.stringify(dataToPublish));

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedData = JSON.parse(data);
          console.info("Received MQTT arrived callback data:", parsedData);

          const message = parsedData;
          const topic = message.topic;
          const rawMessageContent = message.message;

          if (topic === responseTopic) {
            console.info("Response received from rtrn topic:", JSON.stringify(message, null, 2));
            
            let responseData;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch (parseErr) {
              responseData = rawMessageContent;
            }

            if (responseData?.data?.success) {
              const fleetIds = responseData.data.metadata?.fleet_ids;
              if (fleetIds) {
                console.info("Resolved fleet IDs:", fleetIds);
                setFleetIds(fleetIds);
              } else {
                console.info("No fleet IDs in response:", responseData);
                setFleetIds(null);
              }
            } else {
              const errorReason = responseData?.data?.metadata?.reason || 
                                  responseData?.data?.signals?.[0] || 
                                  "Unknown error";
              console.error("MQTT request failed:", errorReason);
            }
            responseCallback({ success: true });
          }
        } catch (err) {
          console.error("Error parsing MQTT arrived callback:", err);
          responseCallback({ success: false, error: err });
        }
      }
    );

    window.WebViewJavascriptBridge.callHandler(
      "mqttSubTopic",
      { topic: responseTopic, qos: 0 },
      (subscribeResponse) => {
        console.info("MQTT subscribe response:", subscribeResponse);
        try {
          const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
          if (subResp.respCode === "200") {
            console.info("Subscribed to response topic successfully");
          } else {
            console.error("Subscribe failed:", subResp.respDesc || subResp.error);
          }
        } catch (err) {
          console.error("Error parsing subscribe response:", err);
        }
      }
    );

    try {
      window.WebViewJavascriptBridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        (response) => {
          console.info("MQTT publish response:", response);
          try {
            const responseData = typeof response === 'string' ? JSON.parse(response) : response;
            if (responseData.error || responseData.respCode !== "200") {
              console.error("MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
            } else {
              console.info("MQTT request published successfully");
            }
          } catch (err) {
            console.error("Error parsing MQTT publish response:", err);
          }
        }
      );
    } catch (err) {
      console.error("Error calling mqttPublishMsg:", err);
    }

    setTimeout(() => {
      console.info("Cleaning up MQTT response handler and subscription for:", responseTopic);
      offResponseHandler();
      bridge.callHandler(
        "mqttUnSubTopic",
        { topic: responseTopic, qos: 0 },
        (unsubResponse) => {
          console.info("MQTT unsubscribe response:", unsubResponse);
        }
      );
    }, 15000);
  };

  // Updated setupBridge to handle QR code scanning
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

    const offMqttRecv = reg(
      "mqttMsgArrivedCallBack",
      (data: string, resp: any) => {
        try {
          const p = JSON.parse(data);
          console.info("General MQTT arrived callback:", p);
          resp(p);
        } catch (err) {
          console.error("Error parsing general MQTT arrived callback:", err);
        }
      }
    );

    const offConnectMqtt = reg(
      "connectMqttCallBack",
      (data: string, resp: any) => {
        try {
          const parsed = JSON.parse(data);
          console.info("MQTT connection callback:", parsed);
          setIsMqttConnected(true);
          resp("Received MQTT Connection Callback");
        } catch (err) {
          setIsMqttConnected(false);
          console.error("Error parsing MQTT connection callback:", err);
        }
      }
    );

    const offLocationCallback = reg(
      "locationCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

          toast.dismiss('location-loading');
          const dataPreview = JSON.stringify(rawLocationData, null, 2);

          if (!rawLocationData || typeof rawLocationData !== 'object') {
            // toast.error("Invalid location data format");
            responseCallback({ success: false, error: "Invalid format" });
            return;
          }

          const { latitude, longitude } = rawLocationData;

          if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            // toast.error("Invalid coordinates: Must be valid numbers");
            responseCallback({ success: false, error: "Invalid coordinates" });
            return;
          }

          const isSignificantChange = () => {
            if (!lastProcessedLocation.current) return true;
            const DISTANCE_THRESHOLD = 0.001;
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
              // toast.error("Coordinates out of valid range");
            } else if (latitude === 0 && longitude === 0) {
              // toast.error("Location at (0,0) - possible GPS error");
            }
          }

          responseCallback({ success: true, location: rawLocationData });
        } catch (error) {
          // toast.error("Error processing location data");
          console.error("Error processing location data:", error);
          responseCallback({ success: false, error: error });
        }
      }
    );

    const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
      try {
        const p = JSON.parse(data);
        const qrVal = p.respData?.value || "";
        if (!qrVal) {
          throw new Error("No QR code value provided");
        }
        handleQrCode(qrVal);
        resp({ success: true });
      } catch (err) {
        console.error("Error processing QR code data:", err);
        // toast.error("Error processing QR code");
        resp({ success: false, error: String(err) });
      }
    });

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

    bridge.callHandler('startLocationListener', {}, (responseData) => {
      try {
        const parsedResponse = JSON.parse(responseData);
        if (parsedResponse?.respCode === "200") {
          setIsLocationListenerActive(true);
        } else {
          console.error("Failed to start location listener:", parsedResponse?.respMessage);
        }
      } catch (error) {
        console.error("Error parsing start location response:", error);
      }
    });

    return () => {
      offPrint();
      offMqttRecv();
      offConnectMqtt();
      offLocationCallback();
      offQr();
    };
  };

  useEffect(() => {
    if (bridge) {
      return setupBridge(bridge);
    }
  }, [bridge]);

  const startQrCodeScan = () => {
    console.info("Start QR Code Scan");
    if (bridge) {
      bridge.callHandler(
        "startQrCodeScan",
        999,
        (responseData: string) => {
          console.info("QR Code Scan Response:", responseData);
        }
      );
    } else {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error("Error: Bridge not initialized for QR code scanning");
    }
  };

  // Updated handleQrCode to trigger bindCustomerToLocation
  const handleQrCode = (code: string) => {
    try {
      if (!code || typeof code !== "string") {
        throw new Error("Invalid or empty QR code data");
      }

      let locationId: string | null = null;

      // Plain text format
      if (code.startsWith("location_id:")) {
        locationId = code.replace("location_id:", "").trim();
      } else {
        // URL parsing
        const url = new URL(code);
        locationId = url.searchParams.get('location_id');
      }

      if (locationId && currentPage === "authenticate") {
        console.info("Location ID extracted in authenticate page:", locationId);
        toast.success(`Location ID: ${locationId}`);
        bindCustomerToLocation(locationId);
        return locationId;
      } else if (locationId) {
        toast.success(`Location ID: ${locationId}`);
        return locationId;
      } else {
        const swapId = new URL(code).searchParams.get('swapId');
        if (swapId) {
          toast.success(`Swap ID: ${swapId}`);
          return null;
        }
        throw new Error("No location_id or swapId found");
      }
    } catch (err) {
      console.error("Error parsing QR code:", err);
      toast.error("Invalid QR code format");
      return null;
    }
  };

  const handleBindingResult = (result: { sessionToken?: string; locationActions?: any[]; success: boolean }) => {
    setSessionToken(result.sessionToken || null);
    setLocationActions(result.locationActions || []);
    setIsBindingSuccessful(result.success);
  };

  const initiateSubscriptionPurchase = async (plan: ServicePlan) => {
    if (!customer?.id) {
      toast.error("Customer data not available. Please sign in again.");
      return null;
    }
    if (!customer?.company_id) {
      toast.error("Company ID not available. Please sign in again.");
      return null;
    }

    try {
      const purchaseData = {
        auto_confirm: true,
        billing_frequency: plan.suggested_billing_frequency || "monthly",
        customer_id: customer.id,
        product_id: plan.productId,
      };

      const response = await fetch(
        `${API_BASE}/products/subscription/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify(purchaseData),
        }
      );

      const data = await response.json();

      if (response.ok && data.success && data.order?.id) {
        console.log("Subscription purchase initiated:", data);
        return data.order;
      } else {
        throw new Error(data.message || "Failed to initiate subscription purchase");
      }
    } catch (error: any) {
      console.error("Error initiating subscription purchase:", error);
      toast.error(error.message || "Failed to initiate subscription. Please try again.");
      return null;
    }
  };

  const handleSelectPlan = async (plan: ServicePlan) => {
    const order = await initiateSubscriptionPurchase(plan);
    if (order) {
      setSelectedPlan(plan);
      setOrderId(order.id);
      setShowPaymentModal(true);
    }
  };

  const handlePayNow = () => {
    if (selectedPlan) {
      console.log("Pay Now clicked for plan:", selectedPlan);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSubmit = async () => {
    const phoneRegex = /^\d{10}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber)) {
      toast.error("Please enter a valid 10-digit mobile number (e.g., 0768194214)");
      return;
    }

    if (!selectedPlan) {
      toast.error("No plan selected");
      return;
    }

    if (!customer) {
      toast.error("Customer data not available. Please sign in again.");
      return;
    }

    if (!orderId) {
      toast.error("Order data not available. Please select a plan again.");
      return;
    }

    setIsProcessingPayment(true);

    try {
      const orderResponse = await fetch(
        `${API_BASE}/products/subscription/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify({
            auto_confirm: true,
            billing_frequency: selectedPlan.suggested_billing_frequency || "monthly",
            customer_id: customer.id,
            product_id: selectedPlan.productId,
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success || !orderData.order?.subscription_code) {
        throw new Error(orderData.message || "Failed to get subscription code");
      }

      const subscriptionCode = orderData.order.subscription_code;

      const paymentData = {
        subscription_code: subscriptionCode,
        phone_number: phoneNumber,
      };

      const paymentResponse = await fetch(
        `${API_BASE}/payments/lipay/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify(paymentData),
        }
      );

      const paymentResult = await paymentResponse.json();

      if (paymentResponse.ok) {
        toast.success("Payment initiated successfully! Check your phone for confirmation.");
        setShowPaymentModal(false);
        setPhoneNumber("");
        setSelectedPlan(null);
        setOrderId(null);
      } else {
        throw new Error(paymentResult.message || "Payment initiation failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleProceedToService = () => {
    console.info("Proceed to Service clicked");
    toast.success("Proceeding to service...");
    setCurrentPage("dashboard");
    setIsBindingSuccessful(false);
  };

  const paymentHistory: PaymentTransaction[] = [
    {
      id: "TXN001",
      planName: "Battery Swap Monthly",
      amount: 29.99,
      date: "2025-10-10",
      status: "completed",
    },
  ];

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "charging stations", label: "Charging Stations", icon: MapPin },
    { id: "authenticate", label: "Authenticate", icon: Key },
    { id: "support", label: "Support", icon: HelpCircle },
    { id: "logout", label: "Logout", icon: LogOut },
  ];

  const handleLoginSuccess = (customerData: Customer) => {
    localStorage.setItem("userEmail", customerData.email);
    setIsLoggedIn(true);
    setCustomer(customerData);
    setSelectedPlan(null);
    setOrderId(null);
    setCurrentPage("products");
  };

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    setIsLoggedIn(false);
    setCustomer(null);
    setSelectedPlan(null);
    setOrderId(null);
    setCurrentPage("products");
    toast.success("Signed out successfully");
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setPhoneNumber("");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(value);
  };

  const handlePhoneKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePaymentSubmit();
    }
  };

  const renderMainContent = () => {
    if (isLoadingPlans) {
      return (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      );
    }

    if (selectedPlan) {
      return (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Confirm Product</h1>
            <p className="text-gray-400">
              Plan selected: {selectedPlan.name} - ${selectedPlan.price}
            </p>
            <p className="text-gray-400 text-sm mt-1">Code: {selectedPlan.default_code}</p>
          </div>
          <button
            onClick={handlePayNow}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Pay Now
          </button>
          <button
            onClick={() => {
              setSelectedPlan(null);
              setOrderId(null);
            }}
            className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Change Product
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard customer={customer} />;
      case "products":
        return isLoggedIn ? <Products allPlans={allPlans} onSelectPlan={handleSelectPlan} /> : <Login onLoginSuccess={handleLoginSuccess} />;
      case "transactions":
        return <Payments paymentHistory={paymentHistory} />;
      case "charging stations":
        return <ChargingStationFinder lastKnownLocation={lastKnownLocation} fleetIds={fleetIds} />;
      case "authenticate":
        return (
          <Authenticate
            onScan={startQrCodeScan}
            sessionToken={sessionToken}
            locationActions={locationActions}
            isBindingSuccessful={isBindingSuccessful}
            onProceedToService={handleProceedToService}
            onBindingResult={handleBindingResult}
            // Removed bridge and onHandleQrCode props
          />
        );
      case "support":
        return <Ticketing customer={customer} allPlans={allPlans} />;
      case "login":
        return <Login onLoginSuccess={handleLoginSuccess} />;
      default:
        return <Dashboard customer={customer} />;
    }
  };

  useEffect(() => {
    console.log("Current state:", { isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds, sessionToken, locationActions, isBindingSuccessful });
  }, [isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds, sessionToken, locationActions, isBindingSuccessful]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#333",
            color: "#fff",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #374151",
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

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
            <button
              onClick={handleCloseModal}
              disabled={isProcessingPayment}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="bg-indigo-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
              <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
              <p className="text-gray-400 text-sm mt-1">{selectedPlan?.default_code}</p>
              <p className="text-indigo-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
            </div>

            <div className="mb-6">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                Mobile Number
              </label>
              <div className="flex items-center">
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  onKeyPress={handlePhoneKeyPress}
                  placeholder="0768194214"
                  maxLength={10}
                  disabled={isProcessingPayment}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter your 10-digit mobile number (e.g., 0768194214)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isProcessingPayment}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                disabled={isProcessingPayment || phoneNumber.length !== 10}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Pay Now</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } transition-transform duration-300 ease-in-out`}
          >
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col h-full">
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === "logout") {
                          handleSignOut();
                        } else {
                          setCurrentPage(item.id as any);
                          setSidebarOpen(false);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                        currentPage === item.id
                          ? "bg-gray-600 text-white shadow-lg"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 rounded-full p-2">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{customer?.name || "User"}</p>
                    <p className="text-xs text-gray-400 truncate">{customer?.email || "No email"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className={`flex-1 flex flex-col ${sidebarOpen ? "hidden" : "flex"}`}>
            <div className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-white capitalize">{currentPage}</h1>
              <div className="w-6" />
            </div>

            <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppContainer;
