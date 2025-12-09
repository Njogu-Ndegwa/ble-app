"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Settings,
  QrCode,
} from "lucide-react";
import Dashboard from "./dashboard";
import Products from "./products";
import Payments from "./payments";
import ChargingStationFinder from "./ChargingStationFinder";
import Login from "./login";
import Ticketing from "./ticketing";
import SettingsPage from "./settings";
import QRGenerator from "./qr-generator";
import PaymentQR from "./payment-qr";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from '@/i18n';

let bridgeHasBeenInitialized = false;

// Define interfaces (unchanged)
interface ServicePlan {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  suggested_billing_frequency?: string;
  currency_symbol?: string;
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

interface Station {
  id: number;
  name: string;
  location: string;
  distance: string;
  batteryLevel: number;
  availableChargers: number;
  status: string;
  lat: number;
  lng: number;
  fleetId: string;
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

const AppContainer: React.FC = () => {
  const { t } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState<boolean>(false);
  const [showAttendantPaymentModal, setShowAttendantPaymentModal] = useState<boolean>(false);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [receipt, setReceipt] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "products" | "transactions" | "charging stations" | "support" | "settings" | "qr-generator" | "payment-qr">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const [allPlans, setAllPlans] = useState<ServicePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [plansCurrentPage, setPlansCurrentPage] = useState<number>(1);
  const [plansTotalPages, setPlansTotalPages] = useState<number>(1);
  const [plansTotalCount, setPlansTotalCount] = useState<number>(0);
  const [plansPageSize] = useState<number>(20);
  const [fleetIds, setFleetIds] = useState<FleetIds | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const bridgeInitRef = useRef(false);
  const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
  const prevCustomerIdRef = useRef<number | null>(null);
  const { bridge } = useBridge();


  // Check local storage for email on mount (unchanged)
  useEffect(() => {
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem("userEmail");
      const storedToken = localStorage.getItem("authToken_rider");
      
      // If we have a token, verify it's still valid by calling dashboard
      if (storedToken && storedEmail) {
        try {
          const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
            "Authorization": `Bearer ${storedToken}`,
          };

          const response = await fetch(`${API_BASE}/customer/dashboard`, {
            method: "GET",
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            // Token is valid, user is logged in
            // Restore customer data - merge dashboard response with stored data
            let customerData: Customer | null = null;
            
            // Get stored customer data first (has complete info like partner_id, phone)
            const storedCustomerDataStr = localStorage.getItem("customerData_rider");
            let storedCustomerData: Customer | null = null;
            if (storedCustomerDataStr) {
              try {
                storedCustomerData = JSON.parse(storedCustomerDataStr);
                console.log("checkAuth: Stored customer data from localStorage:", storedCustomerData);
                console.log("checkAuth: Stored partner_id:", storedCustomerData?.partner_id);
              } catch (e) {
                console.error("Error parsing stored customer data:", e);
              }
            }
            
            console.log("checkAuth: Dashboard response customer:", data.customer);
            console.log("checkAuth: Dashboard customer id:", data.customer?.id);
            
            // Merge dashboard response with stored data
            // IMPORTANT: Always prioritize storedCustomerData for id and partner_id (from login)
            // Only use dashboard response for name/email updates
            if (storedCustomerData) {
              // Use stored data as base (has correct id and partner_id from login)
              // If partner_id is missing in stored data, use dashboard customer.id as partner_id
              // (dashboard customer.id is typically the partner_id)
              let partnerId = storedCustomerData.partner_id;
              
              if (!partnerId && data.customer?.id) {
                // Dashboard customer.id is the partner_id
                partnerId = data.customer.id;
                console.log("checkAuth: Using dashboard customer.id as partner_id:", partnerId);
              }
              
              customerData = {
                id: storedCustomerData.id || data.customer?.id || 0, // Use stored id, or dashboard id if stored is missing
                name: data.customer?.name || storedCustomerData.name || "",
                email: data.customer?.email || storedEmail || storedCustomerData.email || "",
                phone: storedCustomerData.phone || data.customer?.phone || "",
                partner_id: partnerId, // Use stored, or fallback to dashboard customer.id
                company_id: 14, // Hardcode company_id to 14
              };
              console.log("checkAuth: Restored customer data with partner_id:", customerData.partner_id);
              console.log("checkAuth: Final customerData:", customerData);
            } else if (data.customer) {
              // Fallback if no stored data (shouldn't happen normally)
              // Dashboard customer.id is the partner_id
              customerData = {
                id: data.customer.id || 0,
                name: data.customer.name || "",
                email: data.customer.email || storedEmail || "",
                phone: data.customer.phone || "",
                partner_id: data.customer.partner_id || data.customer.id, // Use customer.id as partner_id
                company_id: 14, // Hardcode company_id to 14
              };
              console.log("checkAuth: Using dashboard customer data (fallback) with partner_id:", customerData.partner_id);
            }
            
            if (customerData && customerData.id) {
              // Update localStorage with merged customer data
              localStorage.setItem("customerData_rider", JSON.stringify(customerData));
              setCustomer(customerData);
            setIsLoggedIn(true);
            setCurrentPage("dashboard");
          } else {
              // No customer data available, clear and redirect
            localStorage.removeItem("userEmail");
              localStorage.removeItem("authToken_rider");
              localStorage.removeItem("customerData_rider");
              setCurrentPage("products");
            }
          } else {
            // Token invalid, clear and redirect
            localStorage.removeItem("userEmail");
            localStorage.removeItem("authToken_rider");
            localStorage.removeItem("customerData_rider");
            setCurrentPage("products");
          }
        } catch (error) {
          console.error("Error verifying token:", error);
          localStorage.removeItem("userEmail");
          localStorage.removeItem("authToken_rider");
          localStorage.removeItem("customerData_rider");
          setCurrentPage("products");
        }
      } else {
        // No token or email, redirect to products/login
        setCurrentPage("products");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Fetch service plans with pagination
  useEffect(() => {
    const fetchPlans = async () => {
      if (!customer?.id) {
        setIsLoadingPlans(false);
        return;
      }
      setIsLoadingPlans(true);
      try {
        // Get token from localStorage
        const token = localStorage.getItem("authToken_rider");
        
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          "X-API-KEY": "abs_connector_secret_key_2024",
        };

        // Add Bearer token if available
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(
          `${API_BASE}/products/subscription?page=${plansCurrentPage}&limit=${plansPageSize}`,
          {
            method: "GET",
            headers,
          }
        );

        const data = await response.json();

        if (data.success && Array.isArray(data.products)) {
          const plans: ServicePlan[] = data.products.map((product: any) => ({
            name: product.name || '',
            price: product.list_price || 0,
            productId: product.product_id || 0,
            default_code: product.default_code || '',
            suggested_billing_frequency: product.subscription_info?.suggested_billing_frequency || "monthly",
            currency_symbol: product.currency_symbol || '$',
          }));
          setAllPlans(plans);
          
          // Update pagination state from response
          if (data.pagination) {
            setPlansTotalPages(data.pagination.total_pages || 1);
            setPlansTotalCount(data.pagination.total_count || data.products.length);
            setPlansCurrentPage(data.pagination.current_page || plansCurrentPage);
          } else {
            // Fallback if pagination info not in response
            setPlansTotalPages(1);
            setPlansTotalCount(data.products.length);
          }
        } else {
          throw new Error("Invalid response format or no products found");
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        setAllPlans([]);
        setPlansTotalPages(1);
        setPlansTotalCount(0);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [customer?.id, plansCurrentPage, plansPageSize]);

  // Reset to page 1 when customer changes (but not on initial mount)
  useEffect(() => {
    if (customer?.id && prevCustomerIdRef.current !== null && prevCustomerIdRef.current !== customer.id) {
      setPlansCurrentPage(1);
    }
    prevCustomerIdRef.current = customer?.id || null;
  }, [customer?.id]);

  // Handler for pagination page changes
  const handlePlansPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= plansTotalPages && newPage !== plansCurrentPage) {
      setPlansCurrentPage(newPage);
      // fetchPlans will be called automatically via useEffect
    }
  };

  // Fetch active subscription to get planId
  const fetchActiveSubscription = useCallback(async (partnerId: number) => {
    try {
      console.info("Fetching active subscription for partner_id:", partnerId);
      const token = localStorage.getItem("authToken_rider");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = `https://crm-omnivoltaic.odoo.com/api/customers/${partnerId}/subscriptions?page=1&limit=20`;
      console.info("Subscriptions endpoint:", url);
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        console.error("Failed to fetch subscriptions:", response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.info("=== Active Subscription Response ===");
      console.info("Response Status:", response.status);
      console.info("Full Response Data:", JSON.stringify(data, null, 2));

      if (data.success && Array.isArray(data.subscriptions)) {
        // Find the first active subscription
        const activeSubscription = data.subscriptions.find(
          (sub: any) => sub.status === "active"
        );

        if (activeSubscription) {
          console.info("Active subscription found:", activeSubscription.subscription_code);
          setActivePlanId(activeSubscription.subscription_code);
          return activeSubscription.subscription_code;
        } else {
          // This is expected for new users who haven't purchased a product yet
          console.info("No active subscription found - user may need to purchase a product first");
          return null;
        }
      } else {
        // Empty subscriptions array is normal for new users
        if (data.success && (!data.subscriptions || data.subscriptions.length === 0)) {
          console.info("No subscriptions found - user may need to purchase a product first");
        } else {
          console.warn("Invalid response format:", data);
        }
        return null;
      }
    } catch (error) {
      console.error("Error fetching active subscription:", error);
      return null;
    }
  }, []);

  // Reset activePlanId when customer logs out
  useEffect(() => {
    if (!customer?.id) {
      setActivePlanId(null);
    }
  }, [customer?.id]);

  // Fetch fleet IDs (unchanged)
  useEffect(() => {
    // Removed automatic fetchFleetIds - now triggered manually via "Find stations near me" button
  }, [isMqttConnected, bridge, lastKnownLocation, selectedPlan]);

  // Handler to manually trigger station finding
  const handleFindStations = async () => {
    if (!bridge || !lastKnownLocation) {
      toast.error(t("Location not available. Please wait for GPS to initialize."));
      return;
    }
    if (!isMqttConnected) {
      toast.error(t("MQTT not connected. Please wait a moment and try again."));
      return;
    }
    if (!customer?.id) {
      toast.error(t("Please log in to find stations."));
      return;
    }

    if (!customer.partner_id) {
      toast.error(t("Partner information not available. Please log in again."));
      return;
    }

    // Fetch active subscription if not already loaded
    let planId = activePlanId;
    if (!planId) {
      toast.loading(t("Checking subscription status..."), { id: "checking-subscription" });
      planId = await fetchActiveSubscription(customer.partner_id);
      toast.dismiss("checking-subscription");
      
      if (!planId) {
        toast.error(t("No active subscription found. Please purchase a product first."));
        return;
      }
    }
   
    fetchFleetIds(planId);
  };

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
      correlation_id: `asset-discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    let assetResponseHandled = false;

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
                // Fetch stations immediately after fleetIds are set
                fetchStationsFromAPI(fleetIds);
              } else {
                console.info("No fleet IDs in response:", responseData);
                setFleetIds(null);
                setStations([]);
              }
            } else {
              const errorReason = responseData?.data?.metadata?.reason || 
                                  responseData?.data?.signals?.[0] || 
                                  "Unknown error";
              console.error("MQTT request failed:", errorReason);
            }
            assetResponseHandled = true;
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
      console.info("MQTT handler cleanup status", {
        assetResponseHandled,
      });
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

  // Calculate distance in kilometers
  const calculateDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): string => {
    const distance = calculateDistanceKm(lat1, lon1, lat2, lon2);
    return distance.toFixed(1) + " km";
  };

  // Fetch stations from API when fleetIds are available using GraphQL
  const fetchStationsFromAPI = async (fleetIds: FleetIds) => {
    if (!fleetIds.swap_station_fleet || fleetIds.swap_station_fleet.length === 0) {
      return;
    }

    setIsLoadingStations(true);
    try {
      console.info("Page: Fetching real stations from GraphQL API for fleet IDs:", fleetIds.swap_station_fleet);
      
      // Use the thing microservice GraphQL endpoint
      const graphqlEndpoint = "https://thing-microservice-prod.omnivoltaic.com/graphql";
      
      // Get access token for authentication
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      
      // GraphQL query
      const query = `
        query GetFleetAvatars($fleetIds: [String!]!) {
          getFleetAvatarsSummary(fleetIds: $fleetIds) {
            fleets {
              fleetId
              items {
                oemItemID
                opid
                updatedAt
                coordinates {
                  plat
                  plong
                }
                Charge_slot {
                  cnum
                  btid
                  chst
                  rsoc
                  reca
                  pckv
                  pckc
                }
              }
            }
            missingFleetIds
          }
        }
      `;

      const response = await fetch(graphqlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query,
          variables: {
            fleetIds: fleetIds.swap_station_fleet,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Page: Failed to fetch stations:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        setIsLoadingStations(false);
        return;
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error("Page: GraphQL errors:", result.errors);
        setIsLoadingStations(false);
        return;
      }

      const data = result.data?.getFleetAvatarsSummary;
      console.info(`Page: GraphQL API response received:`, JSON.stringify(data, null, 2));

      if (!data || !data.fleets || !Array.isArray(data.fleets)) {
        console.warn("Page: Invalid response structure from GraphQL API", data);
        setIsLoadingStations(false);
        return;
      }
      
      console.info(`Page: Found ${data.fleets.length} fleets in response`);
      console.info(`Page: missingFleetIds from API:`, data.missingFleetIds);

      const allStations: Station[] = [];
      const location = lastKnownLocation || {
        latitude: -1.2921,
        longitude: 36.8219,
      };

      // Process each fleet in the response
      data.fleets.forEach((fleet: any) => {
        const fleetId = fleet.fleetId;
        const items = fleet.items || [];
        
        console.info(`Page: Processing fleet ${fleetId} with ${items.length} items`);

        items.forEach((stationData: any, index: number) => {
          const coordinates = stationData.coordinates;
          console.info(`Page: Processing item ${index}, coordinates:`, coordinates);
          
          if (!coordinates || typeof coordinates.plat !== 'number' || typeof coordinates.plong !== 'number') {
            console.warn(`Page: Invalid coordinates for item ${index}:`, coordinates);
            return;
          }

          const chargeSlots = stationData.Charge_slot || [];
          
          const availableSlots = chargeSlots.filter((slot: any) => 
            slot.chst === 0 && slot.btid && slot.btid.trim() !== ""
          ).length;
          const totalSlots = chargeSlots.length;
          
          const slotsWithBattery = chargeSlots.filter((slot: any) => 
            slot.rsoc > 0 && slot.btid && slot.btid.trim() !== ""
          );
          const avgBatteryLevel = slotsWithBattery.length > 0
            ? slotsWithBattery.reduce((sum: number, slot: any) => sum + (slot.rsoc || 0), 0) / slotsWithBattery.length
            : 0;

          const opid = stationData.opid || "";
          const stationId = Math.abs(
            parseInt(fleetId.substring(fleetId.length - 8), 36) + 
            (opid ? parseInt(opid.substring(opid.length - 4), 36) : 0) + 
            index
          ) % 100000;

          const distanceKm = calculateDistanceKm(
            location.latitude,
            location.longitude,
            coordinates.plat,
            coordinates.plong
          );

          console.info(`Page: Station ${opid || `index ${index}`} - Distance: ${distanceKm.toFixed(2)}km, Location: (${location.latitude}, ${location.longitude}) to (${coordinates.plat}, ${coordinates.plong})`);

          // Filter stations within 500km radius (or show all if no location is available)
          if (distanceKm <= 500 || !lastKnownLocation) {
            const station = {
              id: stationId,
              name: opid ? `Station ${opid}` : `Swap Station ${index + 1}`,
              location: `${coordinates.plat.toFixed(4)}, ${coordinates.plong.toFixed(4)}`,
              distance: calculateDistance(
                location.latitude,
                location.longitude,
                coordinates.plat,
                coordinates.plong
              ),
              batteryLevel: Math.round(avgBatteryLevel * 100) / 100,
              availableChargers: availableSlots,
              status: availableSlots > 0 ? "available" : availableSlots === 0 && totalSlots > 0 ? "busy" : "limited",
              lat: coordinates.plat,
              lng: coordinates.plong,
              fleetId: fleetId,
            };
            
            console.info(`Page: Adding station:`, station);
            allStations.push(station);
          } else {
            console.warn(`Page: Station ${opid || `index ${index}`} filtered out - distance ${distanceKm.toFixed(2)}km exceeds 500km`);
          }
        });
      });

      console.info(`Page: Fetched ${allStations.length} stations from GraphQL API`);
      console.info(`Page: Processed ${data.fleets.length} fleets`);
      if (data.missingFleetIds && data.missingFleetIds.length > 0) {
        console.warn(`Page: Missing fleet IDs:`, data.missingFleetIds);
      } else {
        console.info(`Page: All fleet IDs found (missingFleetIds is empty)`);
      }
      setStations(allStations);
    } catch (error) {
      console.error("Page: Error fetching real stations:", error);
    } finally {
      setIsLoadingStations(false);
    }
  };

  // setupBridge (unchanged)
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
            toast.error(t("Invalid location data format"));
            responseCallback({ success: false, error: "Invalid format" });
            return;
          }

          const { latitude, longitude } = rawLocationData;

          if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            toast.error(t("Invalid coordinates: Must be valid numbers"));
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
              toast.error(t("Coordinates out of valid range"));
            } else if (latitude === 0 && longitude === 0) {
              toast.error(t("Location at (0,0) - possible GPS error"));
            }
          }

          responseCallback({ success: true, location: rawLocationData });
        } catch (error) {
          toast.error(t("Error processing location data"));
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
        toast.error(t("Error processing QR code"));
        resp({ success: false, error: String(err) });
      }
    });

    // Generate unique client ID to avoid conflicts when multiple devices connect
    // Format: rider-{userId}-{timestamp}-{random}
    const generateClientId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      // Try to get user ID from customer state, localStorage, or use guest
      let userId = "guest";
      try {
        if (customer?.id || customer?.partner_id) {
          userId = String(customer.id || customer.partner_id);
        } else {
          const storedCustomer = localStorage.getItem("customerData_rider");
          if (storedCustomer) {
            const parsed = JSON.parse(storedCustomer);
            userId = String(parsed.id || parsed.partner_id || "guest");
          }
        }
      } catch (e) {
        console.warn("Could not get user ID for client ID generation:", e);
      }
      return `rider-${userId}-${timestamp}-${random}`;
    };

    const mqttConfig: MqttConfig = {
      username: "Admin",
      password: "7xzUV@MT",
      clientId: generateClientId(),
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
      toast.error(t("Error: Bridge not initialized for QR code scanning"));
    }
  };

  // handleQrCode (unchanged)
  const handleQrCode = (code: string) => {
    try {
      if (!code || typeof code !== "string") {
        throw new Error("Invalid or empty QR code data");
      }

      let locationId: string | null = null;

      if (code.startsWith("location_id:")) {
        locationId = code.replace("location_id:", "").trim();
      } else {
        const url = new URL(code);
        locationId = url.searchParams.get('location_id');
      }

      if (locationId) {
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
      toast.error(t("Invalid QR code format"));
      return null;
    }
  };


  const initiateSubscriptionPurchase = async (plan: ServicePlan) => {
    if (!customer?.id) {
      toast.error(t("Customer data not available. Please sign in again."));
      return null;
    }
    // company_id is hardcoded to 14, so this check is no longer needed
    // if (!customer?.company_id) {
    //   toast.error(t("Company ID not available. Please sign in again."));
    //   return null;
    // }

    try {
      // Get token from localStorage
      const token = localStorage.getItem("authToken_rider");
      
      const purchaseData = {
        billing_frequency: plan.suggested_billing_frequency || "monthly",
        customer_id: customer.partner_id ?? customer.id,
        product_id: plan.productId,
        price: plan.price,
      };

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };

      // Add Bearer token if available
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `https://crm-omnivoltaic.odoo.com/api/products/subscription/purchase`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(purchaseData),
        }
      );

      const data = await response.json();

      console.info("=== Subscription Purchase Response ===");
      console.info("Response Status:", response.status);
      console.info("Response OK:", response.ok);
      console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
      console.info("Full Response Data:", JSON.stringify(data, null, 2));
      console.info("Payload Sent:", JSON.stringify(purchaseData, null, 2));

      if (response.ok && data.success && data.order?.id) {
        console.info("Subscription purchase initiated successfully");
        console.info("Order Details:", JSON.stringify(data.order, null, 2));
        return data.order;
      } else {
        console.error("Subscription purchase failed:", data);
        throw new Error(data.message || "Failed to initiate subscription purchase");
      }
    } catch (error: any) {
      console.error("Error initiating subscription purchase:", error);
      toast.error(error.message || t("Failed to initiate subscription. Please try again."));
      return null;
    }
  };

  const handleSelectPlan = async (plan: ServicePlan) => {
    const order = await initiateSubscriptionPurchase(plan);
    if (order) {
      setSelectedPlan(plan);
      setOrderId(order.id);
      setPendingOrder(order);
      setShowPaymentOptions(true); // Show payment options instead of payment modal
    }
  };

  const handlePayByYourself = () => {
    setShowPaymentOptions(false);
    setShowPaymentModal(true); // Show payment modal for self-payment
  };

  const handlePayThroughAttendant = async () => {
    if (!selectedPlan) {
      toast.error(t("No plan selected"));
      return;
    }
    if (!orderId) {
      toast.error(t("Order data not available. Please select a plan again."));
      return;
    }
    if (!pendingOrder?.subscription_code) {
      toast.error(t("Subscription reference not available. Please select the plan again."));
      return;
    }

    // Reset transaction ID and receipt inputs
    setTransactionId("");
    setReceipt("");
    setShowPaymentOptions(false);
    setShowAttendantPaymentModal(true);
  };

  const handleTopUp = async () => {
    if (!selectedPlan) {
      toast.error(t("No plan selected"));
      return;
    }
    if (!orderId) {
      toast.error(t("Order data not available. Please select a plan again."));
      return;
    }
    if (!pendingOrder?.subscription_code) {
      toast.error(t("Subscription reference not available. Please select the plan again."));
      return;
    }

    // Reset transaction ID, receipt, and service ID inputs
    setTransactionId("");
    setReceipt("");
    setServiceId("");
    setShowPaymentOptions(false);
    setShowTopUpModal(true);
  };

  const handleAttendantPaymentConfirm = async () => {
    if (!transactionId.trim()) {
      toast.error(t("Please enter the transaction ID from your text messages"));
      return;
    }

    if (!pendingOrder?.subscription_code) {
      toast.error(t("Subscription details not available. Please select the plan again."));
      return;
    }

    setIsProcessingPayment(true);

    try {
      const token = localStorage.getItem("authToken_rider");
      
      const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const payload = {
        subscription_code: pendingOrder.subscription_code,
        receipt: transactionId.trim(),
      };

      const response = await fetch(
        `${API_BASE}/lipay/manual-confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      console.info("=== Attendant Payment Confirmation Response ===");
      console.info("Response Status:", response.status);
      console.info("Response OK:", response.ok);
      console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
      console.info("Full Response Data:", JSON.stringify(result, null, 2));
      console.info("Payload Sent:", JSON.stringify(payload, null, 2));

      if (response.ok) {
        console.info("Payment confirmation successful");
        toast.success(t("Payment confirmation successful"));
        
        // Wait 5 seconds then publish to payment_and_service
        const subscriptionCode = pendingOrder?.subscription_code;
        if (subscriptionCode && window.WebViewJavascriptBridge && bridge) {
          console.info("=== Scheduling Payment and Service Publish (5 seconds) ===");
          console.info("Subscription Code:", subscriptionCode);
          
          // Capture receipt value before setTimeout
          const receiptValue = transactionId.trim();
          
          setTimeout(() => {
            console.info("=== Publishing Payment and Service to MQTT (after 5 second delay) ===");
            
            // Get assigned battery code from localStorage
            const assignedBatteryCode = localStorage.getItem("assignedBatteryCode");
            const batteryId = assignedBatteryCode ? `BAT_NEW_${assignedBatteryCode}` : "BAT_NEW_001";
            
            const mqttPayload = {
              timestamp: new Date().toISOString(),
              plan_id: subscriptionCode,
              correlation_id: `att-payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              actor: {
                type: "attendant",
                id: "attendant-001",
              },
              data: {
                action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
                attendant_station: "STATION_001",
                payment_data: {
                  service_id: "service-electricity-togo-1",
                  payment_amount: 10,
                  payment_reference: receiptValue,
                  payment_method: "MPESA",
                  payment_type: "DEPOSIT",
                },
                service_data: {
                  new_battery_id: batteryId,
                },
              },
            };

            const mqttTopic = `emit/uxi/attendant/plan/${subscriptionCode}/payment_and_service`;
            const dataToPublish = {
              topic: mqttTopic,
              qos: 0,
              content: mqttPayload,
            };

            console.info("Topic:", mqttTopic);
            console.info("Payload:", JSON.stringify(mqttPayload, null, 2));
            console.info("Bridge available:", !!window.WebViewJavascriptBridge);

            try {
              if (window.WebViewJavascriptBridge) {
                console.info("=== Calling mqttPublishMsg handler ===");
                window.WebViewJavascriptBridge.callHandler(
                  "mqttPublishMsg",
                  JSON.stringify(dataToPublish),
                  (mqttResponse) => {
                    console.info("=== MQTT Publish Response Received ===");
                    console.info("Raw Response:", mqttResponse);
                    try {
                      const responseData = typeof mqttResponse === 'string' ? JSON.parse(mqttResponse) : mqttResponse;
                      console.info("Parsed Response:", JSON.stringify(responseData, null, 2));
                      if (responseData.error || responseData.respCode !== "200") {
                        console.error("❌ MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
                        toast.error(t("Failed to publish payment and service"));
                      } else {
                        console.info("✅ Payment and service published to MQTT successfully");
                        toast.success(t("Payment and service completed"));
                      }
                    } catch (err) {
                      console.error("❌ Error parsing MQTT publish response:", err);
                      toast.error(t("Error processing MQTT response"));
                    }
                  }
                );
                console.info("=== mqttPublishMsg handler called successfully ===");
              } else {
                console.error("❌ WebViewJavascriptBridge not available for MQTT publish");
                toast.error(t("Bridge not available"));
              }
            } catch (publishError) {
              console.error("❌ Error calling mqttPublishMsg:", publishError);
              toast.error(t("Failed to publish: ") + (publishError as Error).message);
            }
          }, 8000); // 5 second delay
        }
        
        setShowAttendantPaymentModal(false);
        setShowPaymentOptions(false);
        setSelectedPlan(null);
        setOrderId(null);
        setPendingOrder(null);
        setTransactionId("");
        setReceipt("");
        // Refresh dashboard or navigate to transactions
        setCurrentPage("dashboard");
      } else {
        console.error("Payment confirmation failed:", result);
        throw new Error(result.message || result.error || t("Payment confirmation failed"));
      }
    } catch (error: any) {
      console.error("Error confirming attendant payment:", error);
      toast.error(error.message || t("Failed to confirm payment. Please try again."));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleTopUpPaymentConfirm = async () => {
    if (!transactionId.trim()) {
      toast.error(t("Please enter the transaction ID from your text messages"));
      return;
    }

    if (!serviceId.trim()) {
      toast.error(t("Please enter the service ID"));
      return;
    }

    if (!pendingOrder?.subscription_code) {
      toast.error(t("Subscription details not available. Please select the plan again."));
      return;
    }

    setIsProcessingPayment(true);

    try {
      const token = localStorage.getItem("authToken_rider");
      
      const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const payload = {
        subscription_code: pendingOrder.subscription_code,
        receipt: transactionId.trim(),
        service_id: serviceId.trim(),
      };

      const response = await fetch(
        `${API_BASE}/lipay/manual-confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      console.info("=== Top Up Payment Confirmation Response ===");
      console.info("Response Status:", response.status);
      console.info("Response OK:", response.ok);
      console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
      console.info("Full Response Data:", JSON.stringify(result, null, 2));
      console.info("Payload Sent:", JSON.stringify(payload, null, 2));

      if (response.ok) {
        console.info("Top up payment confirmation successful");
        toast.success(t("Top up payment confirmed successfully!"));
        setShowTopUpModal(false);
        setShowPaymentOptions(false);
        setSelectedPlan(null);
        setOrderId(null);
        setPendingOrder(null);
        setTransactionId("");
        setReceipt("");
        setServiceId("");
        // Refresh dashboard or navigate to transactions
        setCurrentPage("dashboard");
      } else {
        console.error("Top up payment confirmation failed:", result);
        throw new Error(result.message || result.error || t("Top up payment confirmation failed"));
      }
    } catch (error: any) {
      console.error("Error confirming top up payment:", error);
      toast.error(error.message || t("Failed to confirm top up payment. Please try again."));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentSubmit = async () => {
    const phoneRegex = /^\d{10}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber)) {
      toast.error(t("Please enter a valid 10-digit mobile number (e.g., 0768194214)"));
      return;
    }

    if (!selectedPlan) {
      toast.error(t("No plan selected"));
      return;
    }

    if (!customer) {
      toast.error(t("Customer data not available. Please sign in again."));
      return;
    }

    if (!orderId || !pendingOrder?.subscription_code) {
      toast.error(t("Subscription details not available. Please select the plan again."));
      return;
    }

    setIsProcessingPayment(true);

    try {
      const token = localStorage.getItem("authToken_rider");
      const subscriptionCode = pendingOrder.subscription_code;

      const paymentData = {
        subscription_code: subscriptionCode,
        phone_number: phoneNumber,
        amount: selectedPlan.price,
      };

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const paymentResponse = await fetch(
        `${API_BASE}/payments/lipay/initiate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(paymentData),
        }
      );

      const paymentResult = await paymentResponse.json();

      console.info("=== Payment Initiation Response ===");
      console.info("Response Status:", paymentResponse.status);
      console.info("Response OK:", paymentResponse.ok);
      console.info("Response Headers:", Object.fromEntries(paymentResponse.headers.entries()));
      console.info("Full Response Data:", JSON.stringify(paymentResult, null, 2));
      console.info("Payload Sent:", JSON.stringify(paymentData, null, 2));

      if (paymentResponse.ok) {
        console.info("Payment initiation successful");
        toast.success(t("Payment initiated successfully! Check your phone for confirmation."));
        setShowPaymentModal(false);
        setPhoneNumber("");
        setSelectedPlan(null);
        setOrderId(null);
        setPendingOrder(null);
      } else {
        console.error("Payment initiation failed:", paymentResult);
        throw new Error(paymentResult.message || t("Payment initiation failed. Please try again."));
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || t("Payment failed. Please try again."));
    } finally {
      setIsProcessingPayment(false);
    }
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
    { id: "dashboard", labelKey: "Dashboard", icon: LayoutDashboard },
    { id: "products", labelKey: "Products", icon: Package },
    { id: "transactions", labelKey: "Transactions", icon: CreditCard },
    { id: "charging stations", labelKey: "Charging Stations", icon: MapPin },
    { id: "support", labelKey: "Support", icon: HelpCircle },
    { id: "settings", labelKey: "Settings", icon: Settings },
    { id: "payment-qr", labelKey: "Payment QR", icon: Wallet },
    { id: "qr-generator", labelKey: "My QR", icon: QrCode },
    { id: "logout", labelKey: "Logout", icon: LogOut },
  ];

  const handleLoginSuccess = (customerData: Customer) => {
    console.log("handleLoginSuccess: Received customerData:", customerData);
    console.log("handleLoginSuccess: partner_id:", customerData.partner_id);
    
    // Hardcode company_id to 14
    const customerWithCompanyId = {
      ...customerData,
      company_id: 14,
    };
    
    localStorage.setItem("userEmail", customerWithCompanyId.email);
    // Save customer data to localStorage for restoration
    localStorage.setItem("customerData_rider", JSON.stringify(customerWithCompanyId));
    
    // Verify what was saved
    const saved = localStorage.getItem("customerData_rider");
    console.log("handleLoginSuccess: Saved to localStorage:", saved);
    
    setIsLoggedIn(true);
    setCustomer(customerWithCompanyId);
    setSelectedPlan(null);
    setOrderId(null);
    setPendingOrder(null);
    setCurrentPage("products");
  };

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("authToken_rider");
    localStorage.removeItem("customerData_rider");
    setIsLoggedIn(false);
    setCustomer(null);
    setSelectedPlan(null);
    setOrderId(null);
    setPendingOrder(null);
    setCurrentPage("products");
    toast.success(t("Signed out successfully"));
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setShowPaymentOptions(false);
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

    if (selectedPlan && showPaymentOptions) {
      return (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{t("Confirm Product")}</h1>
            <p className="text-gray-400">
              {t("Plan selected:")} {selectedPlan.name} - ${selectedPlan.price}
            </p>
            <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan.default_code}</p>
          </div>
          <button
            onClick={handlePayByYourself}
            disabled={isProcessingPayment}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
          >
            {t("Pay by Yourself")}
          </button>
          <button
            onClick={handlePayThroughAttendant}
            disabled={isProcessingPayment}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
          >
            {isProcessingPayment ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("Processing...")}
              </>
            ) : (
              <>{t("Pay through Attendant")}</>
            )}
          </button>
          {/* <button
            onClick={handleTopUp}
            disabled={isProcessingPayment}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
          >
            {isProcessingPayment ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("Processing...")}
              </>
            ) : (
              <>{t("Top Up")}</>
            )}
          </button> */}
          <button
            onClick={() => {
              setSelectedPlan(null);
              setOrderId(null);
              setShowPaymentOptions(false);
              setPendingOrder(null);
            }}
            disabled={isProcessingPayment}
            className="w-full mt-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
          >
            {t("Change Product")}
          </button>
        </div>
      );
    }

    if (selectedPlan) {
      return (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{t("Confirm Product")}</h1>
            <p className="text-gray-400">
              {t("Plan selected:")} {selectedPlan.name} - ${selectedPlan.price}
            </p>
            <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan.default_code}</p>
          </div>
          <button
            onClick={handlePayByYourself}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            {t("Pay by Yourself")}
          </button>
          <button
            onClick={handlePayThroughAttendant}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            {t("Pay through Attendant")}
          </button>
          {/* <button
            onClick={handleTopUp}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            {t("Top Up")}
          </button> */}
          <button
            onClick={() => {
              setSelectedPlan(null);
              setOrderId(null);
              setPendingOrder(null);
            }}
            className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            {t("Change Product")}
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard customer={customer} />;
      case "products":
        return (
          <Products 
            allPlans={allPlans} 
            onSelectPlan={handleSelectPlan}
            currentPage={plansCurrentPage}
            totalPages={plansTotalPages}
            totalCount={plansTotalCount}
            pageSize={plansPageSize}
            isLoading={isLoadingPlans}
            onPageChange={handlePlansPageChange}
          />
        );
      case "transactions":
        return <Payments paymentHistory={paymentHistory} />;
      case "charging stations":
        return <ChargingStationFinder lastKnownLocation={lastKnownLocation} fleetIds={fleetIds} stations={stations} isLoadingStations={isLoadingStations} onFindStations={handleFindStations} />;
      case "support":
        return <Ticketing customer={customer} allPlans={allPlans} />;
      case "settings":
        return <SettingsPage />;
      case "payment-qr":
        return <PaymentQR customer={customer} />;
      case "qr-generator":
        return <QRGenerator customer={customer} isMqttConnected={isMqttConnected} />;
      default:
        return <Dashboard customer={customer} />;
    }
  };

  useEffect(() => {
    console.log("Current state:", { isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds });
  }, [isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds]);

  // Show loading state while checking auth (same as Attendant)
  if (isCheckingAuth) {
    return (
      <div className="splash-screen">
        <div className="splash-loading">
          <div className="splash-loading-dots">
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
          </div>
        </div>
      </div>
    );
  }

  // When not logged in, render Login directly (same pattern as Attendant/Sales)
  if (!isLoggedIn) {
    return (
      <>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              fontSize: "13px",
              fontFamily: "'Outfit', sans-serif",
            },
            success: {
              iconTheme: {
                primary: "#00d9a0",
                secondary: "white",
              },
            },
            error: {
              iconTheme: {
                primary: "#ff5a5a",
                secondary: "white",
              },
            },
          }}
        />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // When logged in, render the full app with sidebar and navigation
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
              <h2 className="text-2xl font-bold text-white mb-2">{t("Complete Payment")}</h2>
              <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
              <p className="text-gray-400 text-sm mt-1">{selectedPlan?.default_code}</p>
              <p className="text-indigo-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
            </div>

            <div className="mb-6">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                {t("Mobile Number")}
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
                {t("Enter your 10-digit mobile number (e.g., 0768194214)")}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isProcessingPayment}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handlePaymentSubmit}
                disabled={isProcessingPayment || phoneNumber.length !== 10}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("Processing...")}
                  </>
                ) : (
                  <>{t("Pay Now")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendant Payment Modal */}
      {showAttendantPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
            <button
              onClick={() => {
                setShowAttendantPaymentModal(false);
                setTransactionId("");
                setReceipt("");
              }}
              disabled={isProcessingPayment}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="bg-green-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t("Pay via Attendant")}</h2>
              <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
              <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan?.default_code}</p>
              <p className="text-green-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
            </div>

            {/* Transaction ID Input Section */}
            <div className="mb-6">
              <label htmlFor="transactionId" className="block text-sm font-medium text-gray-300 mb-2">
                {t("Transaction ID")}
              </label>
              <input
                id="transactionId"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder={t("Enter transaction ID from your text messages")}
                disabled={isProcessingPayment}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("Enter the transaction ID you received via text message from the attendant.")}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAttendantPaymentModal(false);
                  setTransactionId("");
                  setReceipt("");
                }}
                disabled={isProcessingPayment}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleAttendantPaymentConfirm}
                disabled={isProcessingPayment || !transactionId.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("Confirming...")}
                  </>
                ) : (
                  <>{t("Confirm Payment")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Up Payment Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
            <button
              onClick={() => {
                setShowTopUpModal(false);
                setTransactionId("");
                setReceipt("");
                setServiceId("");
              }}
              disabled={isProcessingPayment}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="bg-blue-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t("Top Up")}</h2>
              <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
              <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan?.default_code}</p>
              <p className="text-blue-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
            </div>

            {/* Transaction ID Input Section */}
            <div className="mb-4">
              <label htmlFor="topUpTransactionId" className="block text-sm font-medium text-gray-300 mb-2">
                {t("Transaction ID")}
              </label>
              <input
                id="topUpTransactionId"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder={t("Enter transaction ID from your text messages")}
                disabled={isProcessingPayment}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("Enter the transaction ID you received via text message from the attendant.")}
              </p>
            </div>

            {/* Service ID Input Section */}
            <div className="mb-6">
              <label htmlFor="serviceId" className="block text-sm font-medium text-gray-300 mb-2">
                {t("Service ID")}
              </label>
              <input
                id="serviceId"
                type="text"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                placeholder={t("Enter service ID")}
                disabled={isProcessingPayment}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("Enter the service ID for the top up.")}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTransactionId("");
                  setReceipt("");
                  setServiceId("");
                }}
                disabled={isProcessingPayment}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleTopUpPaymentConfirm}
                disabled={isProcessingPayment || !transactionId.trim() || !serviceId.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("Confirming...")}
                  </>
                ) : (
                  <>{t("Confirm Top Up")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{t("Menu")}</h2>
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
                  {t(item.labelKey)}
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

      {/* Main content area */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white capitalize">{t(menuItems.find((i) => i.id === currentPage)?.labelKey || currentPage)}</h1>
          <div className="w-6" />
        </div>

        <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
      </div>
    </div>
  );
};

export default AppContainer;
// "use client";

// import React, { useState, useEffect, useRef, useCallback } from "react";
// import { Toaster, toast } from "react-hot-toast";
// import {
//   Loader2,
//   Wallet,
//   LayoutDashboard,
//   Package,
//   CreditCard,
//   Menu,
//   LogOut,
//   X,
//   MapPin,
//   User,
//   HelpCircle,
//   Settings,
//   QrCode,
// } from "lucide-react";
// import Dashboard from "./dashboard";
// import Products from "./products";
// import Payments from "./payments";
// import ChargingStationFinder from "./ChargingStationFinder";
// import Login from "./login";
// import Ticketing from "./ticketing";
// import SettingsPage from "./settings";
// import QRGenerator from "./qr-generator";
// import { useBridge } from "@/app/context/bridgeContext";
// import { useI18n } from '@/i18n';

// let bridgeHasBeenInitialized = false;

// // Define interfaces (unchanged)
// interface ServicePlan {
//   name: string;
//   price: number;
//   productId: number;
//   default_code: string;
//   suggested_billing_frequency?: string;
//   currency_symbol?: string;
// }

// interface Customer {
//   id: number;
//   name: string;
//   email: string;
//   phone: string;
//   partner_id?: number;
//   company_id?: number;
// }

// interface PaymentTransaction {
//   id: string;
//   planName: string;
//   amount: number;
//   date: string;
//   status: "completed" | "pending" | "failed";
// }

// interface LocationData {
//   latitude: number;
//   longitude: number;
//   timestamp?: number;
//   locationName?: string;
//   [key: string]: any;
// }

// interface MqttConfig {
//   username: string;
//   password: string;
//   clientId: string;
//   hostname: string;
//   port: number;
// }

// interface FleetIds {
//   [serviceType: string]: string[];
// }

// interface Station {
//   id: number;
//   name: string;
//   location: string;
//   distance: string;
//   batteryLevel: number;
//   availableChargers: number;
//   status: string;
//   lat: number;
//   lng: number;
//   fleetId: string;
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

// declare global {
//   interface Window {
//     WebViewJavascriptBridge?: WebViewJavascriptBridge;
//   }
// }

// const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

// const AppContainer = () => {
//   const { t } = useI18n();
//   const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
//   const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
//   const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
//   const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
//   const [showPaymentOptions, setShowPaymentOptions] = useState<boolean>(false);
//   const [showAttendantPaymentModal, setShowAttendantPaymentModal] = useState<boolean>(false);
//   const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
//   const [phoneNumber, setPhoneNumber] = useState<string>("");
//   const [transactionId, setTransactionId] = useState<string>("");
//   const [receipt, setReceipt] = useState<string>("");
//   const [serviceId, setServiceId] = useState<string>("");
//   const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
//   const [customer, setCustomer] = useState<Customer | null>(null);
//   const [orderId, setOrderId] = useState<number | null>(null);
//   const [pendingOrder, setPendingOrder] = useState<any>(null);
//   const [currentPage, setCurrentPage] = useState<"dashboard" | "products" | "transactions" | "charging stations" | "support" | "login" | "settings" | "qr-generator">("login");
//   const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
//   const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false);
//   const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
//   const [allPlans, setAllPlans] = useState<ServicePlan[]>([]);
//   const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
//   const [plansCurrentPage, setPlansCurrentPage] = useState<number>(1);
//   const [plansTotalPages, setPlansTotalPages] = useState<number>(1);
//   const [plansTotalCount, setPlansTotalCount] = useState<number>(0);
//   const [plansPageSize] = useState<number>(20);
//   const [fleetIds, setFleetIds] = useState<FleetIds | null>(null);
//   const [stations, setStations] = useState<Station[]>([]);
//   const [isLoadingStations, setIsLoadingStations] = useState<boolean>(false);
//   const [activePlanId, setActivePlanId] = useState<string | null>(null);
//   const bridgeInitRef = useRef(false);
//   const lastProcessedLocation = useRef<{ lat: number; lon: number } | null>(null);
//   const prevCustomerIdRef = useRef<number | null>(null);
//   const { bridge } = useBridge();


//   // Check local storage for email on mount (unchanged)
//   useEffect(() => {
//     const checkAuth = async () => {
//       const storedEmail = localStorage.getItem("userEmail");
//       const storedToken = localStorage.getItem("authToken_rider");
      
//       // If we have a token, verify it's still valid by calling dashboard
//       if (storedToken && storedEmail) {
//         try {
//           const headers: HeadersInit = {
//             "Content-Type": "application/json",
//             "X-API-KEY": "abs_connector_secret_key_2024",
//             "Authorization": `Bearer ${storedToken}`,
//           };

//           const response = await fetch(`${API_BASE}/customer/dashboard`, {
//             method: "GET",
//             headers,
//           });

//           if (response.ok) {
//             const data = await response.json();
//             // Token is valid, user is logged in
//             // Restore customer data - merge dashboard response with stored data
//             let customerData: Customer | null = null;
            
//             // Get stored customer data first (has complete info like partner_id, phone)
//             const storedCustomerDataStr = localStorage.getItem("customerData_rider");
//             let storedCustomerData: Customer | null = null;
//             if (storedCustomerDataStr) {
//               try {
//                 storedCustomerData = JSON.parse(storedCustomerDataStr);
//                 console.log("checkAuth: Stored customer data from localStorage:", storedCustomerData);
//                 console.log("checkAuth: Stored partner_id:", storedCustomerData?.partner_id);
//               } catch (e) {
//                 console.error("Error parsing stored customer data:", e);
//               }
//             }
            
//             console.log("checkAuth: Dashboard response customer:", data.customer);
//             console.log("checkAuth: Dashboard customer id:", data.customer?.id);
            
//             // Merge dashboard response with stored data
//             // IMPORTANT: Always prioritize storedCustomerData for id and partner_id (from login)
//             // Only use dashboard response for name/email updates
//             if (storedCustomerData) {
//               // Use stored data as base (has correct id and partner_id from login)
//               // If partner_id is missing in stored data, use dashboard customer.id as partner_id
//               // (dashboard customer.id is typically the partner_id)
//               let partnerId = storedCustomerData.partner_id;
              
//               if (!partnerId && data.customer?.id) {
//                 // Dashboard customer.id is the partner_id
//                 partnerId = data.customer.id;
//                 console.log("checkAuth: Using dashboard customer.id as partner_id:", partnerId);
//               }
              
//               customerData = {
//                 id: storedCustomerData.id || data.customer?.id || 0, // Use stored id, or dashboard id if stored is missing
//                 name: data.customer?.name || storedCustomerData.name || "",
//                 email: data.customer?.email || storedEmail || storedCustomerData.email || "",
//                 phone: storedCustomerData.phone || data.customer?.phone || "",
//                 partner_id: partnerId, // Use stored, or fallback to dashboard customer.id
//                 company_id: 14, // Hardcode company_id to 14
//               };
//               console.log("checkAuth: Restored customer data with partner_id:", customerData.partner_id);
//               console.log("checkAuth: Final customerData:", customerData);
//             } else if (data.customer) {
//               // Fallback if no stored data (shouldn't happen normally)
//               // Dashboard customer.id is the partner_id
//               customerData = {
//                 id: data.customer.id || 0,
//                 name: data.customer.name || "",
//                 email: data.customer.email || storedEmail || "",
//                 phone: data.customer.phone || "",
//                 partner_id: data.customer.partner_id || data.customer.id, // Use customer.id as partner_id
//                 company_id: 14, // Hardcode company_id to 14
//               };
//               console.log("checkAuth: Using dashboard customer data (fallback) with partner_id:", customerData.partner_id);
//             }
            
//             if (customerData && customerData.id) {
//               // Update localStorage with merged customer data
//               localStorage.setItem("customerData_rider", JSON.stringify(customerData));
//               setCustomer(customerData);
//             setIsLoggedIn(true);
//             setCurrentPage("dashboard");
//           } else {
//               // No customer data available, clear and redirect
//             localStorage.removeItem("userEmail");
//               localStorage.removeItem("authToken_rider");
//               localStorage.removeItem("customerData_rider");
//               setCurrentPage("products");
//             }
//           } else {
//             // Token invalid, clear and redirect
//             localStorage.removeItem("userEmail");
//             localStorage.removeItem("authToken_rider");
//             localStorage.removeItem("customerData_rider");
//             setCurrentPage("products");
//           }
//         } catch (error) {
//           console.error("Error verifying token:", error);
//           localStorage.removeItem("userEmail");
//           localStorage.removeItem("authToken_rider");
//           localStorage.removeItem("customerData_rider");
//           setCurrentPage("products");
//         }
//       } else {
//         // No token or email, redirect to products/login
//         setCurrentPage("products");
//       }
//       await new Promise(resolve => setTimeout(resolve, 2000));
//       setIsCheckingAuth(false);
//     };

//     checkAuth();
//   }, []);

//   // Fetch service plans with pagination
//   useEffect(() => {
//     const fetchPlans = async () => {
//       if (!customer?.id) {
//         setIsLoadingPlans(false);
//         return;
//       }
//       setIsLoadingPlans(true);
//       try {
//         // Get token from localStorage
//         const token = localStorage.getItem("authToken_rider");
        
//         const headers: HeadersInit = {
//           "Content-Type": "application/json",
//           "X-API-KEY": "abs_connector_secret_key_2024",
//         };

//         // Add Bearer token if available
//         if (token) {
//           headers["Authorization"] = `Bearer ${token}`;
//         }

//         const response = await fetch(
//           `${API_BASE}/products/subscription?page=${plansCurrentPage}&limit=${plansPageSize}`,
//           {
//             method: "GET",
//             headers,
//           }
//         );

//         const data = await response.json();

//         if (data.success && Array.isArray(data.products)) {
//           const plans: ServicePlan[] = data.products.map((product: any) => ({
//             name: product.name || '',
//             price: product.list_price || 0,
//             productId: product.product_id || 0,
//             default_code: product.default_code || '',
//             suggested_billing_frequency: product.subscription_info?.suggested_billing_frequency || "monthly",
//             currency_symbol: product.currency_symbol || '$',
//           }));
//           setAllPlans(plans);
          
//           // Update pagination state from response
//           if (data.pagination) {
//             setPlansTotalPages(data.pagination.total_pages || 1);
//             setPlansTotalCount(data.pagination.total_count || data.products.length);
//             setPlansCurrentPage(data.pagination.current_page || plansCurrentPage);
//           } else {
//             // Fallback if pagination info not in response
//             setPlansTotalPages(1);
//             setPlansTotalCount(data.products.length);
//           }
//         } else {
//           throw new Error("Invalid response format or no products found");
//         }
//       } catch (error) {
//         console.error("Error fetching plans:", error);
//         setAllPlans([]);
//         setPlansTotalPages(1);
//         setPlansTotalCount(0);
//       } finally {
//         setIsLoadingPlans(false);
//       }
//     };

//     fetchPlans();
//   }, [customer?.id, plansCurrentPage, plansPageSize]);

//   // Reset to page 1 when customer changes (but not on initial mount)
//   useEffect(() => {
//     if (customer?.id && prevCustomerIdRef.current !== null && prevCustomerIdRef.current !== customer.id) {
//       setPlansCurrentPage(1);
//     }
//     prevCustomerIdRef.current = customer?.id || null;
//   }, [customer?.id]);

//   // Handler for pagination page changes
//   const handlePlansPageChange = (newPage: number) => {
//     if (newPage >= 1 && newPage <= plansTotalPages && newPage !== plansCurrentPage) {
//       setPlansCurrentPage(newPage);
//       // fetchPlans will be called automatically via useEffect
//     }
//   };

//   // Fetch active subscription to get planId
//   const fetchActiveSubscription = useCallback(async (partnerId: number) => {
//     try {
//       console.info("Fetching active subscription for partner_id:", partnerId);
//       const token = localStorage.getItem("authToken_rider");
//       const headers: HeadersInit = {
//         "Content-Type": "application/json",
//         "X-API-KEY": "abs_connector_secret_key_2024",
//       };
//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const url = `https://crm-omnivoltaic.odoo.com/api/customers/${partnerId}/subscriptions?page=1&limit=20`;
//       console.info("Subscriptions endpoint:", url);
//       const response = await fetch(url, {
//         method: "GET",
//         headers,
//       });

//       if (!response.ok) {
//         console.error("Failed to fetch subscriptions:", response.status, response.statusText);
//         return null;
//       }

//       const data = await response.json();
//       console.info("=== Active Subscription Response ===");
//       console.info("Response Status:", response.status);
//       console.info("Full Response Data:", JSON.stringify(data, null, 2));

//       if (data.success && Array.isArray(data.subscriptions)) {
//         // Find the first active subscription
//         const activeSubscription = data.subscriptions.find(
//           (sub: any) => sub.status === "active"
//         );

//         if (activeSubscription) {
//           console.info("Active subscription found:", activeSubscription.subscription_code);
//           setActivePlanId(activeSubscription.subscription_code);
//           return activeSubscription.subscription_code;
//         } else {
//           // This is expected for new users who haven't purchased a product yet
//           console.info("No active subscription found - user may need to purchase a product first");
//           return null;
//         }
//       } else {
//         // Empty subscriptions array is normal for new users
//         if (data.success && (!data.subscriptions || data.subscriptions.length === 0)) {
//           console.info("No subscriptions found - user may need to purchase a product first");
//         } else {
//           console.warn("Invalid response format:", data);
//         }
//         return null;
//       }
//     } catch (error) {
//       console.error("Error fetching active subscription:", error);
//       return null;
//     }
//   }, []);

//   // Reset activePlanId when customer logs out
//   useEffect(() => {
//     if (!customer?.id) {
//       setActivePlanId(null);
//     }
//   }, [customer?.id]);

//   // Fetch fleet IDs (unchanged)
//   useEffect(() => {
//     // Removed automatic fetchFleetIds - now triggered manually via "Find stations near me" button
//   }, [isMqttConnected, bridge, lastKnownLocation, selectedPlan]);

//   // Handler to manually trigger station finding
//   const handleFindStations = async () => {
//     if (!bridge || !lastKnownLocation) {
//       toast.error(t("Location not available. Please wait for GPS to initialize."));
//       return;
//     }
//     if (!isMqttConnected) {
//       toast.error(t("MQTT not connected. Please wait a moment and try again."));
//       return;
//     }
//     if (!customer?.id) {
//       toast.error(t("Please log in to find stations."));
//       return;
//     }

//     if (!customer.partner_id) {
//       toast.error(t("Partner information not available. Please log in again."));
//       return;
//     }

//     // Fetch active subscription if not already loaded
//     let planId = activePlanId;
//     if (!planId) {
//       toast.loading(t("Checking subscription status..."), { id: "checking-subscription" });
//       planId = await fetchActiveSubscription(customer.partner_id);
//       toast.dismiss("checking-subscription");
      
//       if (!planId) {
//         toast.error(t("No active subscription found. Please purchase a product first."));
//         return;
//       }
//     }
   
//     fetchFleetIds(planId);
//   };

//   const fetchFleetIds = (planId: string) => {
//     if (!bridge || !window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       return;
//     }

//     if (!lastKnownLocation || typeof lastKnownLocation.latitude !== 'number' || typeof lastKnownLocation.longitude !== 'number') {
//       console.error("Invalid location data:", lastKnownLocation);
//       return;
//     }

//     console.info("Plan ID used:", planId);
//     console.info("Constructing MQTT request for fleet IDs with planId:", planId);
//     const requestTopic = `call/abs/service/plan/${planId}/get_assets`;
//     const responseTopic = `rtrn/abs/service/plan/${planId}/get_assets`;
    
//     const timestamp = new Date().toISOString();
    
//     const content = {
//       timestamp,
//       plan_id: planId,
//       correlation_id: `asset-discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//       actor: {
//         type: "customer",
//         id: "CUST-RIDER-001"
//       },
//       data: {
//         action: "GET_REQUIRED_ASSET_IDS",
//         rider_location: {
//           lat: lastKnownLocation.latitude,
//           lng: lastKnownLocation.longitude,
//         },
//         search_radius: 10,
//       },
//     };

//     const dataToPublish = {
//       topic: requestTopic,
//       qos: 0,
//       content,
//     };

//     console.info("MQTT message sent to bridge:", JSON.stringify(dataToPublish));

//     const reg = (name: string, handler: any) => {
//       bridge.registerHandler(name, handler);
//       return () => bridge.registerHandler(name, () => {});
//     };

//     let assetResponseHandled = false;

//     const offResponseHandler = reg(
//       "mqttMsgArrivedCallBack",
//       (data: string, responseCallback: (response: any) => void) => {
//         try {
//           const parsedData = JSON.parse(data);
//           console.info("Received MQTT arrived callback data:", parsedData);

//           const message = parsedData;
//           const topic = message.topic;
//           const rawMessageContent = message.message;

//           if (topic === responseTopic) {
//             console.info("Response received from rtrn topic:", JSON.stringify(message, null, 2));
            
//             let responseData;
//             try {
//               responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
//             } catch (parseErr) {
//               responseData = rawMessageContent;
//             }

//             if (responseData?.data?.success) {
//               const fleetIds = responseData.data.metadata?.fleet_ids;
//               if (fleetIds) {
//                 console.info("Resolved fleet IDs:", fleetIds);
//                 setFleetIds(fleetIds);
//                 // Fetch stations immediately after fleetIds are set
//                 fetchStationsFromAPI(fleetIds);
//               } else {
//                 console.info("No fleet IDs in response:", responseData);
//                 setFleetIds(null);
//                 setStations([]);
//               }
//             } else {
//               const errorReason = responseData?.data?.metadata?.reason || 
//                                   responseData?.data?.signals?.[0] || 
//                                   "Unknown error";
//               console.error("MQTT request failed:", errorReason);
//             }
//             assetResponseHandled = true;
//             responseCallback({ success: true });
//           }
//         } catch (err) {
//           console.error("Error parsing MQTT arrived callback:", err);
//           responseCallback({ success: false, error: err });
//         }
//       }
//     );

//     window.WebViewJavascriptBridge.callHandler(
//       "mqttSubTopic",
//       { topic: responseTopic, qos: 0 },
//       (subscribeResponse) => {
//         console.info("MQTT subscribe response:", subscribeResponse);
//         try {
//           const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
//           if (subResp.respCode === "200") {
//             console.info("Subscribed to response topic successfully");
//           } else {
//             console.error("Subscribe failed:", subResp.respDesc || subResp.error);
//           }
//         } catch (err) {
//           console.error("Error parsing subscribe response:", err);
//         }
//       }
//     );

//     try {
//       window.WebViewJavascriptBridge.callHandler(
//         "mqttPublishMsg",
//         JSON.stringify(dataToPublish),
//         (response) => {
//           console.info("MQTT publish response:", response);
//           try {
//             const responseData = typeof response === 'string' ? JSON.parse(response) : response;
//             if (responseData.error || responseData.respCode !== "200") {
//               console.error("MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
//             } else {
//               console.info("MQTT request published successfully");
//             }
//           } catch (err) {
//             console.error("Error parsing MQTT publish response:", err);
//           }
//         }
//       );
//     } catch (err) {
//       console.error("Error calling mqttPublishMsg:", err);
//     }

//     setTimeout(() => {
//       console.info("MQTT handler cleanup status", {
//         assetResponseHandled,
//       });
//       console.info("Cleaning up MQTT response handler and subscription for:", responseTopic);
//       offResponseHandler();
//       bridge.callHandler(
//         "mqttUnSubTopic",
//         { topic: responseTopic, qos: 0 },
//         (unsubResponse) => {
//           console.info("MQTT unsubscribe response:", unsubResponse);
//         }
//       );
//     }, 15000);
//   };

//   // Calculate distance in kilometers
//   const calculateDistanceKm = (
//     lat1: number,
//     lon1: number,
//     lat2: number,
//     lon2: number
//   ): number => {
//     const R = 6371; // Earth's radius in km
//     const dLat = (lat2 - lat1) * (Math.PI / 180);
//     const dLon = (lon2 - lon1) * (Math.PI / 180);
//     const a =
//       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//       Math.cos(lat1 * (Math.PI / 180)) *
//         Math.cos(lat2 * (Math.PI / 180)) *
//         Math.sin(dLon / 2) *
//         Math.sin(dLon / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c;
//   };

//   const calculateDistance = (
//     lat1: number,
//     lon1: number,
//     lat2: number,
//     lon2: number
//   ): string => {
//     const distance = calculateDistanceKm(lat1, lon1, lat2, lon2);
//     return distance.toFixed(1) + " km";
//   };

//   // Fetch stations from API when fleetIds are available using GraphQL
//   const fetchStationsFromAPI = async (fleetIds: FleetIds) => {
//     if (!fleetIds.swap_station_fleet || fleetIds.swap_station_fleet.length === 0) {
//       return;
//     }

//     setIsLoadingStations(true);
//     try {
//       console.info("Page: Fetching real stations from GraphQL API for fleet IDs:", fleetIds.swap_station_fleet);
      
//       // Use the thing microservice GraphQL endpoint
//       const graphqlEndpoint = "https://thing-microservice-prod.omnivoltaic.com/graphql";
      
//       // Get access token for authentication
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      
//       // GraphQL query
//       const query = `
//         query GetFleetAvatars($fleetIds: [String!]!) {
//           getFleetAvatarsSummary(fleetIds: $fleetIds) {
//             fleets {
//               fleetId
//               items {
//                 oemItemID
//                 opid
//                 updatedAt
//                 coordinates {
//                   plat
//                   plong
//                 }
//                 Charge_slot {
//                   cnum
//                   btid
//                   chst
//                   rsoc
//                   reca
//                   pckv
//                   pckc
//                 }
//               }
//             }
//             missingFleetIds
//           }
//         }
//       `;

//       const response = await fetch(graphqlEndpoint, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           ...(token ? { authorization: `Bearer ${token}` } : {}),
//         },
//         body: JSON.stringify({
//           query,
//           variables: {
//             fleetIds: fleetIds.swap_station_fleet,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error(`Page: Failed to fetch stations:`, {
//           status: response.status,
//           statusText: response.statusText,
//           error: errorText,
//         });
//         setIsLoadingStations(false);
//         return;
//       }

//       const result = await response.json();
      
//       if (result.errors) {
//         console.error("Page: GraphQL errors:", result.errors);
//         setIsLoadingStations(false);
//         return;
//       }

//       const data = result.data?.getFleetAvatarsSummary;
//       console.info(`Page: GraphQL API response received:`, JSON.stringify(data, null, 2));

//       if (!data || !data.fleets || !Array.isArray(data.fleets)) {
//         console.warn("Page: Invalid response structure from GraphQL API", data);
//         setIsLoadingStations(false);
//         return;
//       }
      
//       console.info(`Page: Found ${data.fleets.length} fleets in response`);
//       console.info(`Page: missingFleetIds from API:`, data.missingFleetIds);

//       const allStations: Station[] = [];
//       const location = lastKnownLocation || {
//         latitude: -1.2921,
//         longitude: 36.8219,
//       };

//       // Process each fleet in the response
//       data.fleets.forEach((fleet: any) => {
//         const fleetId = fleet.fleetId;
//         const items = fleet.items || [];
        
//         console.info(`Page: Processing fleet ${fleetId} with ${items.length} items`);

//         items.forEach((stationData: any, index: number) => {
//           const coordinates = stationData.coordinates;
//           console.info(`Page: Processing item ${index}, coordinates:`, coordinates);
          
//           if (!coordinates || typeof coordinates.plat !== 'number' || typeof coordinates.plong !== 'number') {
//             console.warn(`Page: Invalid coordinates for item ${index}:`, coordinates);
//             return;
//           }

//           const chargeSlots = stationData.Charge_slot || [];
          
//           const availableSlots = chargeSlots.filter((slot: any) => 
//             slot.chst === 0 && slot.btid && slot.btid.trim() !== ""
//           ).length;
//           const totalSlots = chargeSlots.length;
          
//           const slotsWithBattery = chargeSlots.filter((slot: any) => 
//             slot.rsoc > 0 && slot.btid && slot.btid.trim() !== ""
//           );
//           const avgBatteryLevel = slotsWithBattery.length > 0
//             ? slotsWithBattery.reduce((sum: number, slot: any) => sum + (slot.rsoc || 0), 0) / slotsWithBattery.length
//             : 0;

//           const opid = stationData.opid || "";
//           const stationId = Math.abs(
//             parseInt(fleetId.substring(fleetId.length - 8), 36) + 
//             (opid ? parseInt(opid.substring(opid.length - 4), 36) : 0) + 
//             index
//           ) % 100000;

//           const distanceKm = calculateDistanceKm(
//             location.latitude,
//             location.longitude,
//             coordinates.plat,
//             coordinates.plong
//           );

//           console.info(`Page: Station ${opid || `index ${index}`} - Distance: ${distanceKm.toFixed(2)}km, Location: (${location.latitude}, ${location.longitude}) to (${coordinates.plat}, ${coordinates.plong})`);

//           // Filter stations within 500km radius (or show all if no location is available)
//           if (distanceKm <= 500 || !lastKnownLocation) {
//             const station = {
//               id: stationId,
//               name: opid ? `Station ${opid}` : `Swap Station ${index + 1}`,
//               location: `${coordinates.plat.toFixed(4)}, ${coordinates.plong.toFixed(4)}`,
//               distance: calculateDistance(
//                 location.latitude,
//                 location.longitude,
//                 coordinates.plat,
//                 coordinates.plong
//               ),
//               batteryLevel: Math.round(avgBatteryLevel * 100) / 100,
//               availableChargers: availableSlots,
//               status: availableSlots > 0 ? "available" : availableSlots === 0 && totalSlots > 0 ? "busy" : "limited",
//               lat: coordinates.plat,
//               lng: coordinates.plong,
//               fleetId: fleetId,
//             };
            
//             console.info(`Page: Adding station:`, station);
//             allStations.push(station);
//           } else {
//             console.warn(`Page: Station ${opid || `index ${index}`} filtered out - distance ${distanceKm.toFixed(2)}km exceeds 500km`);
//           }
//         });
//       });

//       console.info(`Page: Fetched ${allStations.length} stations from GraphQL API`);
//       console.info(`Page: Processed ${data.fleets.length} fleets`);
//       if (data.missingFleetIds && data.missingFleetIds.length > 0) {
//         console.warn(`Page: Missing fleet IDs:`, data.missingFleetIds);
//       } else {
//         console.info(`Page: All fleet IDs found (missingFleetIds is empty)`);
//       }
//       setStations(allStations);
//     } catch (error) {
//       console.error("Page: Error fetching real stations:", error);
//     } finally {
//       setIsLoadingStations(false);
//     }
//   };

//   // setupBridge (unchanged)
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

//     const offMqttRecv = reg(
//       "mqttMsgArrivedCallBack",
//       (data: string, resp: any) => {
//         try {
//           const p = JSON.parse(data);
//           console.info("General MQTT arrived callback:", p);
//           resp(p);
//         } catch (err) {
//           console.error("Error parsing general MQTT arrived callback:", err);
//         }
//       }
//     );

//     const offConnectMqtt = reg(
//       "connectMqttCallBack",
//       (data: string, resp: any) => {
//         try {
//           const parsed = JSON.parse(data);
//           console.info("MQTT connection callback:", parsed);
//           setIsMqttConnected(true);
//           resp("Received MQTT Connection Callback");
//         } catch (err) {
//           setIsMqttConnected(false);
//           console.error("Error parsing MQTT connection callback:", err);
//         }
//       }
//     );

//     const offLocationCallback = reg(
//       "locationCallBack",
//       (data: string, responseCallback: (response: any) => void) => {
//         try {
//           const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

//           toast.dismiss('location-loading');
//           const dataPreview = JSON.stringify(rawLocationData, null, 2);

//           if (!rawLocationData || typeof rawLocationData !== 'object') {
//             toast.error(t("Invalid location data format"));
//             responseCallback({ success: false, error: "Invalid format" });
//             return;
//           }

//           const { latitude, longitude } = rawLocationData;

//           if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
//             toast.error(t("Invalid coordinates: Must be valid numbers"));
//             responseCallback({ success: false, error: "Invalid coordinates" });
//             return;
//           }

//           const isSignificantChange = () => {
//             if (!lastProcessedLocation.current) return true;
//             const DISTANCE_THRESHOLD = 0.001;
//             return (
//               Math.abs(lastProcessedLocation.current.lat - latitude) > DISTANCE_THRESHOLD ||
//               Math.abs(lastProcessedLocation.current.lon - longitude) > DISTANCE_THRESHOLD
//             );
//           };

//           if (isSignificantChange()) {
//             setLastKnownLocation(rawLocationData);
//             lastProcessedLocation.current = {
//               lat: latitude,
//               lon: longitude,
//             };

//             if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
//               toast.error(t("Coordinates out of valid range"));
//             } else if (latitude === 0 && longitude === 0) {
//               toast.error(t("Location at (0,0) - possible GPS error"));
//             }
//           }

//           responseCallback({ success: true, location: rawLocationData });
//         } catch (error) {
//           toast.error(t("Error processing location data"));
//           console.error("Error processing location data:", error);
//           responseCallback({ success: false, error: error });
//         }
//       }
//     );

//     const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
//       try {
//         const p = JSON.parse(data);
//         const qrVal = p.respData?.value || "";
//         if (!qrVal) {
//           throw new Error("No QR code value provided");
//         }
//         handleQrCode(qrVal);
//         resp({ success: true });
//       } catch (err) {
//         console.error("Error processing QR code data:", err);
//         toast.error(t("Error processing QR code"));
//         resp({ success: false, error: String(err) });
//       }
//     });

//     // Generate unique client ID to avoid conflicts when multiple devices connect
//     // Format: rider-{userId}-{timestamp}-{random}
//     const generateClientId = () => {
//       const timestamp = Date.now();
//       const random = Math.random().toString(36).substring(2, 9);
//       // Try to get user ID from customer state, localStorage, or use guest
//       let userId = "guest";
//       try {
//         if (customer?.id || customer?.partner_id) {
//           userId = String(customer.id || customer.partner_id);
//         } else {
//           const storedCustomer = localStorage.getItem("customerData_rider");
//           if (storedCustomer) {
//             const parsed = JSON.parse(storedCustomer);
//             userId = String(parsed.id || parsed.partner_id || "guest");
//           }
//         }
//       } catch (e) {
//         console.warn("Could not get user ID for client ID generation:", e);
//       }
//       return `rider-${userId}-${timestamp}-${random}`;
//     };

//     const mqttConfig: MqttConfig = {
//       username: "Admin",
//       password: "7xzUV@MT",
//       clientId: generateClientId(),
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

//     bridge.callHandler('startLocationListener', {}, (responseData) => {
//       try {
//         const parsedResponse = JSON.parse(responseData);
//         if (parsedResponse?.respCode === "200") {
//           setIsLocationListenerActive(true);
//         } else {
//           console.error("Failed to start location listener:", parsedResponse?.respMessage);
//         }
//       } catch (error) {
//         console.error("Error parsing start location response:", error);
//       }
//     });

//     return () => {
//       offPrint();
//       offMqttRecv();
//       offConnectMqtt();
//       offLocationCallback();
//       offQr();
//     };
//   };

//   useEffect(() => {
//     if (bridge) {
//       return setupBridge(bridge);
//     }
//   }, [bridge]);

//   const startQrCodeScan = () => {
//     console.info("Start QR Code Scan");
//     if (bridge) {
//       bridge.callHandler(
//         "startQrCodeScan",
//         999,
//         (responseData: string) => {
//           console.info("QR Code Scan Response:", responseData);
//         }
//       );
//     } else {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error(t("Error: Bridge not initialized for QR code scanning"));
//     }
//   };

//   // handleQrCode (unchanged)
//   const handleQrCode = (code: string) => {
//     try {
//       if (!code || typeof code !== "string") {
//         throw new Error("Invalid or empty QR code data");
//       }

//       let locationId: string | null = null;

//       if (code.startsWith("location_id:")) {
//         locationId = code.replace("location_id:", "").trim();
//       } else {
//         const url = new URL(code);
//         locationId = url.searchParams.get('location_id');
//       }

//       if (locationId) {
//         toast.success(`Location ID: ${locationId}`);
//         return locationId;
//       } else {
//         const swapId = new URL(code).searchParams.get('swapId');
//         if (swapId) {
//           toast.success(`Swap ID: ${swapId}`);
//           return null;
//         }
//         throw new Error("No location_id or swapId found");
//       }
//     } catch (err) {
//       console.error("Error parsing QR code:", err);
//       toast.error(t("Invalid QR code format"));
//       return null;
//     }
//   };


//   const initiateSubscriptionPurchase = async (plan: ServicePlan) => {
//     if (!customer?.id) {
//       toast.error(t("Customer data not available. Please sign in again."));
//       return null;
//     }
//     // company_id is hardcoded to 14, so this check is no longer needed
//     // if (!customer?.company_id) {
//     //   toast.error(t("Company ID not available. Please sign in again."));
//     //   return null;
//     // }

//     try {
//       // Get token from localStorage
//       const token = localStorage.getItem("authToken_rider");
      
//       const purchaseData = {
//         billing_frequency: plan.suggested_billing_frequency || "monthly",
//         customer_id: customer.partner_id ?? customer.id,
//         product_id: plan.productId,
//         price: plan.price,
//       };

//       const headers: HeadersInit = {
//         "Content-Type": "application/json",
//         "X-API-KEY": "abs_connector_secret_key_2024",
//       };

//       // Add Bearer token if available
//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const response = await fetch(
//         `https://crm-omnivoltaic.odoo.com/api/products/subscription/purchase`,
//         {
//           method: "POST",
//           headers,
//           body: JSON.stringify(purchaseData),
//         }
//       );

//       const data = await response.json();

//       console.info("=== Subscription Purchase Response ===");
//       console.info("Response Status:", response.status);
//       console.info("Response OK:", response.ok);
//       console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
//       console.info("Full Response Data:", JSON.stringify(data, null, 2));
//       console.info("Payload Sent:", JSON.stringify(purchaseData, null, 2));

//       if (response.ok && data.success && data.order?.id) {
//         console.info("Subscription purchase initiated successfully");
//         console.info("Order Details:", JSON.stringify(data.order, null, 2));
//         return data.order;
//       } else {
//         console.error("Subscription purchase failed:", data);
//         throw new Error(data.message || "Failed to initiate subscription purchase");
//       }
//     } catch (error: any) {
//       console.error("Error initiating subscription purchase:", error);
//       toast.error(error.message || t("Failed to initiate subscription. Please try again."));
//       return null;
//     }
//   };

//   const handleSelectPlan = async (plan: ServicePlan) => {
//     const order = await initiateSubscriptionPurchase(plan);
//     if (order) {
//       setSelectedPlan(plan);
//       setOrderId(order.id);
//       setPendingOrder(order);
//       setShowPaymentOptions(true); // Show payment options instead of payment modal
//     }
//   };

//   const handlePayByYourself = () => {
//     setShowPaymentOptions(false);
//     setShowPaymentModal(true); // Show payment modal for self-payment
//   };

//   const handlePayThroughAttendant = async () => {
//     if (!selectedPlan) {
//       toast.error(t("No plan selected"));
//       return;
//     }
//     if (!orderId) {
//       toast.error(t("Order data not available. Please select a plan again."));
//       return;
//     }
//     if (!pendingOrder?.subscription_code) {
//       toast.error(t("Subscription reference not available. Please select the plan again."));
//       return;
//     }

//     // Reset transaction ID and receipt inputs
//     setTransactionId("");
//     setReceipt("");
//     setShowPaymentOptions(false);
//     setShowAttendantPaymentModal(true);
//   };

//   const handleTopUp = async () => {
//     if (!selectedPlan) {
//       toast.error(t("No plan selected"));
//       return;
//     }
//     if (!orderId) {
//       toast.error(t("Order data not available. Please select a plan again."));
//       return;
//     }
//     if (!pendingOrder?.subscription_code) {
//       toast.error(t("Subscription reference not available. Please select the plan again."));
//       return;
//     }

//     // Reset transaction ID, receipt, and service ID inputs
//     setTransactionId("");
//     setReceipt("");
//     setServiceId("");
//     setShowPaymentOptions(false);
//     setShowTopUpModal(true);
//   };

//   const handleAttendantPaymentConfirm = async () => {
//     if (!transactionId.trim()) {
//       toast.error(t("Please enter the transaction ID from your text messages"));
//       return;
//     }

//     if (!pendingOrder?.subscription_code) {
//       toast.error(t("Subscription details not available. Please select the plan again."));
//       return;
//     }

//     setIsProcessingPayment(true);

//     try {
//       const token = localStorage.getItem("authToken_rider");
      
//       const headers: HeadersInit = {
//             "Content-Type": "application/json",
//             "X-API-KEY": "abs_connector_secret_key_2024",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const payload = {
//         subscription_code: pendingOrder.subscription_code,
//         receipt: transactionId.trim(),
//       };

//       const response = await fetch(
//         `${API_BASE}/lipay/manual-confirm`,
//         {
//           method: "POST",
//           headers,
//           body: JSON.stringify(payload),
//         }
//       );

//       const result = await response.json();

//       console.info("=== Attendant Payment Confirmation Response ===");
//       console.info("Response Status:", response.status);
//       console.info("Response OK:", response.ok);
//       console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
//       console.info("Full Response Data:", JSON.stringify(result, null, 2));
//       console.info("Payload Sent:", JSON.stringify(payload, null, 2));

//       if (response.ok) {
//         console.info("Payment confirmation successful");
//         toast.success(t("Payment confirmed successfully!"));
//         setShowAttendantPaymentModal(false);
//         setShowPaymentOptions(false);
//         setSelectedPlan(null);
//         setOrderId(null);
//         setPendingOrder(null);
//         setTransactionId("");
//         setReceipt("");
//         // Refresh dashboard or navigate to transactions
//         setCurrentPage("dashboard");
//       } else {
//         console.error("Payment confirmation failed:", result);
//         throw new Error(result.message || result.error || t("Payment confirmation failed"));
//       }
//     } catch (error: any) {
//       console.error("Error confirming attendant payment:", error);
//       toast.error(error.message || t("Failed to confirm payment. Please try again."));
//     } finally {
//       setIsProcessingPayment(false);
//     }
//   };

//   const handleTopUpPaymentConfirm = async () => {
//     if (!transactionId.trim()) {
//       toast.error(t("Please enter the transaction ID from your text messages"));
//       return;
//     }

//     if (!serviceId.trim()) {
//       toast.error(t("Please enter the service ID"));
//       return;
//     }

//     if (!pendingOrder?.subscription_code) {
//       toast.error(t("Subscription details not available. Please select the plan again."));
//       return;
//     }

//     setIsProcessingPayment(true);

//     try {
//       const token = localStorage.getItem("authToken_rider");
      
//       const headers: HeadersInit = {
//             "Content-Type": "application/json",
//             "X-API-KEY": "abs_connector_secret_key_2024",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const payload = {
//         subscription_code: pendingOrder.subscription_code,
//         receipt: transactionId.trim(),
//         service_id: serviceId.trim(),
//       };

//       const response = await fetch(
//         `${API_BASE}/lipay/manual-confirm`,
//         {
//           method: "POST",
//           headers,
//           body: JSON.stringify(payload),
//         }
//       );

//       const result = await response.json();

//       console.info("=== Top Up Payment Confirmation Response ===");
//       console.info("Response Status:", response.status);
//       console.info("Response OK:", response.ok);
//       console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
//       console.info("Full Response Data:", JSON.stringify(result, null, 2));
//       console.info("Payload Sent:", JSON.stringify(payload, null, 2));

//       if (response.ok) {
//         console.info("Top up payment confirmation successful");
//         toast.success(t("Top up payment confirmed successfully!"));
//         setShowTopUpModal(false);
//         setShowPaymentOptions(false);
//         setSelectedPlan(null);
//         setOrderId(null);
//         setPendingOrder(null);
//         setTransactionId("");
//         setReceipt("");
//         setServiceId("");
//         // Refresh dashboard or navigate to transactions
//         setCurrentPage("dashboard");
//       } else {
//         console.error("Top up payment confirmation failed:", result);
//         throw new Error(result.message || result.error || t("Top up payment confirmation failed"));
//       }
//     } catch (error: any) {
//       console.error("Error confirming top up payment:", error);
//       toast.error(error.message || t("Failed to confirm top up payment. Please try again."));
//     } finally {
//       setIsProcessingPayment(false);
//     }
//   };

//   const handlePaymentSubmit = async () => {
//     const phoneRegex = /^\d{10}$/;
//     if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber)) {
//       toast.error(t("Please enter a valid 10-digit mobile number (e.g., 0768194214)"));
//       return;
//     }

//     if (!selectedPlan) {
//       toast.error(t("No plan selected"));
//       return;
//     }

//     if (!customer) {
//       toast.error(t("Customer data not available. Please sign in again."));
//       return;
//     }

//     if (!orderId || !pendingOrder?.subscription_code) {
//       toast.error(t("Subscription details not available. Please select the plan again."));
//       return;
//     }

//     setIsProcessingPayment(true);

//     try {
//       const token = localStorage.getItem("authToken_rider");
//       const subscriptionCode = pendingOrder.subscription_code;

//       const paymentData = {
//         subscription_code: subscriptionCode,
//         phone_number: phoneNumber,
//         amount: selectedPlan.price,
//       };

//       const headers: HeadersInit = {
//         "Content-Type": "application/json",
//         "X-API-KEY": "abs_connector_secret_key_2024",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const paymentResponse = await fetch(
//         `${API_BASE}/payments/lipay/initiate`,
//         {
//           method: "POST",
//           headers,
//           body: JSON.stringify(paymentData),
//         }
//       );

//       const paymentResult = await paymentResponse.json();

//       console.info("=== Payment Initiation Response ===");
//       console.info("Response Status:", paymentResponse.status);
//       console.info("Response OK:", paymentResponse.ok);
//       console.info("Response Headers:", Object.fromEntries(paymentResponse.headers.entries()));
//       console.info("Full Response Data:", JSON.stringify(paymentResult, null, 2));
//       console.info("Payload Sent:", JSON.stringify(paymentData, null, 2));

//       if (paymentResponse.ok) {
//         console.info("Payment initiation successful");
//         toast.success(t("Payment initiated successfully! Check your phone for confirmation."));
//         setShowPaymentModal(false);
//         setPhoneNumber("");
//         setSelectedPlan(null);
//         setOrderId(null);
//         setPendingOrder(null);
//       } else {
//         console.error("Payment initiation failed:", paymentResult);
//         throw new Error(paymentResult.message || t("Payment initiation failed. Please try again."));
//       }
//     } catch (error: any) {
//       console.error("Payment error:", error);
//       toast.error(error.message || t("Payment failed. Please try again."));
//     } finally {
//       setIsProcessingPayment(false);
//     }
//   };


//   const paymentHistory: PaymentTransaction[] = [
//     {
//       id: "TXN001",
//       planName: "Battery Swap Monthly",
//       amount: 29.99,
//       date: "2025-10-10",
//       status: "completed",
//     },
//   ];

//   const menuItems = [
//     { id: "dashboard", labelKey: "Dashboard", icon: LayoutDashboard },
//     { id: "products", labelKey: "Products", icon: Package },
//     { id: "transactions", labelKey: "Transactions", icon: CreditCard },
//     { id: "charging stations", labelKey: "Charging Stations", icon: MapPin },
//     { id: "support", labelKey: "Support", icon: HelpCircle },
//     { id: "settings", labelKey: "Settings", icon: Settings },
//     { id: "qr-generator", labelKey: "My QR", icon: QrCode },
//     { id: "logout", labelKey: "Logout", icon: LogOut },
//   ];

//   const handleLoginSuccess = (customerData: Customer) => {
//     console.log("handleLoginSuccess: Received customerData:", customerData);
//     console.log("handleLoginSuccess: partner_id:", customerData.partner_id);
    
//     // Hardcode company_id to 14
//     const customerWithCompanyId = {
//       ...customerData,
//       company_id: 14,
//     };
    
//     localStorage.setItem("userEmail", customerWithCompanyId.email);
//     // Save customer data to localStorage for restoration
//     localStorage.setItem("customerData_rider", JSON.stringify(customerWithCompanyId));
    
//     // Verify what was saved
//     const saved = localStorage.getItem("customerData_rider");
//     console.log("handleLoginSuccess: Saved to localStorage:", saved);
    
//     setIsLoggedIn(true);
//     setCustomer(customerWithCompanyId);
//     setSelectedPlan(null);
//     setOrderId(null);
//     setPendingOrder(null);
//     setCurrentPage("products");
//   };

//   const handleSignOut = () => {
//     localStorage.removeItem("userEmail");
//     localStorage.removeItem("authToken_rider");
//     localStorage.removeItem("customerData_rider");
//     setIsLoggedIn(false);
//     setCustomer(null);
//     setSelectedPlan(null);
//     setOrderId(null);
//     setPendingOrder(null);
//     setCurrentPage("products");
//     toast.success(t("Signed out successfully"));
//   };

//   const handleCloseModal = () => {
//     setShowPaymentModal(false);
//     setShowPaymentOptions(false);
//     setPhoneNumber("");
//   };

//   const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value.replace(/\D/g, "").slice(0, 10);
//     setPhoneNumber(value);
//   };

//   const handlePhoneKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter") {
//       handlePaymentSubmit();
//     }
//   };

//   const renderMainContent = () => {
//     if (isLoadingPlans) {
//       return (
//         <div className="flex justify-center items-center h-full">
//           <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
//         </div>
//       );
//     }

//     if (selectedPlan && showPaymentOptions) {
//       return (
//         <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
//           <div className="text-center mb-8">
//             <h1 className="text-2xl font-bold text-white mb-2">{t("Confirm Product")}</h1>
//             <p className="text-gray-400">
//               {t("Plan selected:")} {selectedPlan.name} - ${selectedPlan.price}
//             </p>
//             <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan.default_code}</p>
//           </div>
//           <button
//             onClick={handlePayByYourself}
//             disabled={isProcessingPayment}
//             className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
//           >
//             {t("Pay by Yourself")}
//           </button>
//           <button
//             onClick={handlePayThroughAttendant}
//             disabled={isProcessingPayment}
//             className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
//           >
//             {isProcessingPayment ? (
//               <>
//                 <Loader2 className="w-5 h-5 animate-spin" />
//                 {t("Processing...")}
//               </>
//             ) : (
//               <>{t("Pay through Attendant")}</>
//             )}
//           </button>
//           <button
//             onClick={handleTopUp}
//             disabled={isProcessingPayment}
//             className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
//           >
//             {isProcessingPayment ? (
//               <>
//                 <Loader2 className="w-5 h-5 animate-spin" />
//                 {t("Processing...")}
//               </>
//             ) : (
//               <>{t("Top Up")}</>
//             )}
//           </button>
//           <button
//             onClick={() => {
//               setSelectedPlan(null);
//               setOrderId(null);
//               setShowPaymentOptions(false);
//               setPendingOrder(null);
//             }}
//             disabled={isProcessingPayment}
//             className="w-full mt-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed"
//           >
//             {t("Change Product")}
//           </button>
//         </div>
//       );
//     }

//     if (selectedPlan) {
//       return (
//         <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
//           <div className="text-center mb-8">
//             <h1 className="text-2xl font-bold text-white mb-2">{t("Confirm Product")}</h1>
//             <p className="text-gray-400">
//               {t("Plan selected:")} {selectedPlan.name} - ${selectedPlan.price}
//             </p>
//             <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan.default_code}</p>
//           </div>
//           <button
//             onClick={handlePayByYourself}
//             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             {t("Pay by Yourself")}
//           </button>
//           <button
//             onClick={handlePayThroughAttendant}
//             className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             {t("Pay through Attendant")}
//           </button>
//           <button
//             onClick={handleTopUp}
//             className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             {t("Top Up")}
//           </button>
//           <button
//             onClick={() => {
//               setSelectedPlan(null);
//               setOrderId(null);
//               setPendingOrder(null);
//             }}
//             className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             {t("Change Product")}
//           </button>
//         </div>
//       );
//     }

//     switch (currentPage) {
//       case "dashboard":
//         return <Dashboard customer={customer} />;
//       case "products":
//         return isLoggedIn ? (
//           <Products 
//             allPlans={allPlans} 
//             onSelectPlan={handleSelectPlan}
//             currentPage={plansCurrentPage}
//             totalPages={plansTotalPages}
//             totalCount={plansTotalCount}
//             pageSize={plansPageSize}
//             isLoading={isLoadingPlans}
//             onPageChange={handlePlansPageChange}
//           />
//         ) : <Login onLoginSuccess={handleLoginSuccess} />;
//       case "transactions":
//         return <Payments paymentHistory={paymentHistory} />;
//       case "charging stations":
//         return <ChargingStationFinder lastKnownLocation={lastKnownLocation} fleetIds={fleetIds} stations={stations} isLoadingStations={isLoadingStations} onFindStations={handleFindStations} />;
//       case "support":
//         return <Ticketing customer={customer} allPlans={allPlans} />;
//       case "settings":
//         return <SettingsPage />;
//       case "qr-generator":
//         return <QRGenerator customer={customer} isMqttConnected={isMqttConnected} />;
//       case "login":
//         return <Login onLoginSuccess={handleLoginSuccess} />;
//       default:
//         return <Dashboard customer={customer} />;
//     }
//   };

//   useEffect(() => {
//     console.log("Current state:", { isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds });
//   }, [isLoggedIn, selectedPlan, customer, currentPage, allPlans, orderId, lastKnownLocation, fleetIds]);

//   if (isCheckingAuth) {
//     return (
//       <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex items-center justify-center">
//         <Loader2 className="w-12 h-12 animate-spin text-gray-600" />
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex">
//       <Toaster
//         position="top-center"
//         toastOptions={{
//           duration: 3000,
//           style: {
//             background: "#333",
//             color: "#fff",
//             padding: "16px",
//             borderRadius: "12px",
//             border: "1px solid #374151",
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

//       {showPaymentModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
//             <button
//               onClick={handleCloseModal}
//               disabled={isProcessingPayment}
//               className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
//             >
//               <X className="w-6 h-6" />
//             </button>

//             <div className="text-center mb-6">
//               <div className="bg-indigo-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
//                 <Wallet className="w-8 h-8 text-white" />
//               </div>
//               <h2 className="text-2xl font-bold text-white mb-2">{t("Complete Payment")}</h2>
//               <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
//               <p className="text-gray-400 text-sm mt-1">{selectedPlan?.default_code}</p>
//               <p className="text-indigo-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
//             </div>

//             <div className="mb-6">
//               <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
//                 {t("Mobile Number")}
//               </label>
//               <div className="flex items-center">
//                 <input
//                   id="phone"
//                   type="tel"
//                   value={phoneNumber}
//                   onChange={handlePhoneChange}
//                   onKeyPress={handlePhoneKeyPress}
//                   placeholder="0768194214"
//                   maxLength={10}
//                   disabled={isProcessingPayment}
//                   className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//                 />
//               </div>
//               <p className="text-xs text-gray-500 mt-1">
//                 {t("Enter your 10-digit mobile number (e.g., 0768194214)")}
//               </p>
//             </div>

//             <div className="flex gap-3">
//               <button
//                 onClick={handleCloseModal}
//                 disabled={isProcessingPayment}
//                 className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
//               >
//                 {t("Cancel")}
//               </button>
//               <button
//                 onClick={handlePaymentSubmit}
//                 disabled={isProcessingPayment || phoneNumber.length !== 10}
//                 className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 {isProcessingPayment ? (
//                   <>
//                     <Loader2 className="w-5 h-5 animate-spin" />
//                     {t("Processing...")}
//                   </>
//                 ) : (
//                   <>{t("Pay Now")}</>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Attendant Payment Modal */}
//       {showAttendantPaymentModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
//             <button
//               onClick={() => {
//                 setShowAttendantPaymentModal(false);
//                 setTransactionId("");
//                 setReceipt("");
//               }}
//               disabled={isProcessingPayment}
//               className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
//             >
//               <X className="w-6 h-6" />
//             </button>

//             <div className="text-center mb-6">
//               <div className="bg-green-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
//                 <User className="w-8 h-8 text-white" />
//               </div>
//               <h2 className="text-2xl font-bold text-white mb-2">{t("Pay via Attendant")}</h2>
//               <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
//               <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan?.default_code}</p>
//               <p className="text-green-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
//             </div>

//             {/* Transaction ID Input Section */}
//             <div className="mb-6">
//               <label htmlFor="transactionId" className="block text-sm font-medium text-gray-300 mb-2">
//                 {t("Transaction ID")}
//               </label>
//               <input
//                 id="transactionId"
//                 type="text"
//                 value={transactionId}
//                 onChange={(e) => setTransactionId(e.target.value)}
//                 placeholder={t("Enter transaction ID from your text messages")}
//                 disabled={isProcessingPayment}
//                 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//               />
//               <p className="text-xs text-gray-500 mt-1">
//                 {t("Enter the transaction ID you received via text message from the attendant.")}
//               </p>
//             </div>

//             <div className="flex gap-3">
//               <button
//                 onClick={() => {
//                   setShowAttendantPaymentModal(false);
//                   setTransactionId("");
//                   setReceipt("");
//                 }}
//                 disabled={isProcessingPayment}
//                 className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
//               >
//                 {t("Cancel")}
//               </button>
//               <button
//                 onClick={handleAttendantPaymentConfirm}
//                 disabled={isProcessingPayment || !transactionId.trim()}
//                 className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 {isProcessingPayment ? (
//                   <>
//                     <Loader2 className="w-5 h-5 animate-spin" />
//                     {t("Confirming...")}
//                   </>
//                 ) : (
//                   <>{t("Confirm Payment")}</>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Top Up Payment Modal */}
//       {showTopUpModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
//             <button
//               onClick={() => {
//                 setShowTopUpModal(false);
//                 setTransactionId("");
//                 setReceipt("");
//                 setServiceId("");
//               }}
//               disabled={isProcessingPayment}
//               className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
//             >
//               <X className="w-6 h-6" />
//             </button>

//             <div className="text-center mb-6">
//               <div className="bg-blue-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
//                 <Wallet className="w-8 h-8 text-white" />
//               </div>
//               <h2 className="text-2xl font-bold text-white mb-2">{t("Top Up")}</h2>
//               <p className="text-gray-400 text-sm">{selectedPlan?.name}</p>
//               <p className="text-gray-400 text-sm mt-1">{t("Code:")} {selectedPlan?.default_code}</p>
//               <p className="text-blue-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
//             </div>

//             {/* Transaction ID Input Section */}
//             <div className="mb-4">
//               <label htmlFor="topUpTransactionId" className="block text-sm font-medium text-gray-300 mb-2">
//                 {t("Transaction ID")}
//               </label>
//               <input
//                 id="topUpTransactionId"
//                 type="text"
//                 value={transactionId}
//                 onChange={(e) => setTransactionId(e.target.value)}
//                 placeholder={t("Enter transaction ID from your text messages")}
//                 disabled={isProcessingPayment}
//                 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//               />
//               <p className="text-xs text-gray-500 mt-1">
//                 {t("Enter the transaction ID you received via text message from the attendant.")}
//               </p>
//             </div>

//             {/* Service ID Input Section */}
//             <div className="mb-6">
//               <label htmlFor="serviceId" className="block text-sm font-medium text-gray-300 mb-2">
//                 {t("Service ID")}
//               </label>
//               <input
//                 id="serviceId"
//                 type="text"
//                 value={serviceId}
//                 onChange={(e) => setServiceId(e.target.value)}
//                 placeholder={t("Enter service ID")}
//                 disabled={isProcessingPayment}
//                 className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//               />
//               <p className="text-xs text-gray-500 mt-1">
//                 {t("Enter the service ID for the top up.")}
//               </p>
//             </div>

//             <div className="flex gap-3">
//               <button
//                 onClick={() => {
//                   setShowTopUpModal(false);
//                   setTransactionId("");
//                   setReceipt("");
//                   setServiceId("");
//                 }}
//                 disabled={isProcessingPayment}
//                 className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
//               >
//                 {t("Cancel")}
//               </button>
//               <button
//                 onClick={handleTopUpPaymentConfirm}
//                 disabled={isProcessingPayment || !transactionId.trim() || !serviceId.trim()}
//                 className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 {isProcessingPayment ? (
//                   <>
//                     <Loader2 className="w-5 h-5 animate-spin" />
//                     {t("Confirming...")}
//                   </>
//                 ) : (
//                   <>{t("Confirm Top Up")}</>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {!isLoggedIn ? (
//         <Login onLoginSuccess={handleLoginSuccess} />
//       ) : (
//         <>
//           <div
//             className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${
//               sidebarOpen ? "translate-x-0" : "-translate-x-full"
//             } transition-transform duration-300 ease-in-out`}
//           >
//             <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
//               <h2 className="text-xl font-bold text-white">{t("Menu")}</h2>
//               <button
//                 onClick={() => setSidebarOpen(false)}
//                 className="text-gray-400 hover:text-white"
//               >
//                 <X className="w-6 h-6" />
//               </button>
//             </div>

//             <div className="flex flex-col h-full">
//               <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
//                 {menuItems.map((item) => {
//                   const Icon = item.icon;
//                   return (
//                     <button
//                       key={item.id}
//                       onClick={() => {
//                         if (item.id === "logout") {
//                           handleSignOut();
//                         } else {
//                           setCurrentPage(item.id as any);
//                           setSidebarOpen(false);
//                         }
//                       }}
//                       className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
//                         currentPage === item.id
//                           ? "bg-gray-600 text-white shadow-lg"
//                           : "text-gray-300 hover:bg-gray-700 hover:text-white"
//                       }`}
//                     >
//                       <Icon className="w-5 h-5" />
//                       {t(item.labelKey)}
//                     </button>
//                   );
//                 })}
//               </nav>

//               <div className="p-4 border-t border-gray-700">
//                 <div className="flex items-center gap-3">
//                   <div className="bg-blue-600 rounded-full p-2">
//                     <User className="w-5 h-5 text-white" />
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium text-white truncate">{customer?.name || "User"}</p>
//                     <p className="text-xs text-gray-400 truncate">{customer?.email || "No email"}</p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {sidebarOpen && (
//             <div
//               className="fixed inset-0 bg-black bg-opacity-50 z-40"
//               onClick={() => setSidebarOpen(false)}
//             />
//           )}

//           <div className={`flex-1 flex flex-col ${sidebarOpen ? "hidden" : "flex"}`}>
//             <div className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700">
//               <button
//                 onClick={() => setSidebarOpen(true)}
//                 className="text-gray-400 hover:text-white"
//               >
//                 <Menu className="w-6 h-6" />
//               </button>
//               <h1 className="text-xl font-bold text-white capitalize">{t(menuItems.find((i) => i.id === currentPage)?.labelKey || currentPage)}</h1>
//               <div className="w-6" />
//             </div>

//             <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// };

// export default AppContainer;
