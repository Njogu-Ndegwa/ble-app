"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import QRCode from "qrcode";
import { useI18n } from '@/i18n';
import { useBridge } from "@/app/context/bridgeContext";

interface Subscription {
  id: number;
  subscription_code: string;
  status: string;
  product_id: number;
  product_name: string;
  price: number;
  currency: string;
  start_date: string;
  next_cycle_date: string;
  cycle_interval: number;
  cycle_unit: string;
  create_date: string;
}

interface QRGeneratorProps {
  customer: {
    id: number;
    name?: string;
    email?: string;
    partner_id?: number;
  } | null;
  isMqttConnected?: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  [key: string]: any;
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

const QRGenerator: React.FC<QRGeneratorProps> = ({ customer, isMqttConnected = false }) => {
  const { t } = useI18n();
  const { bridge } = useBridge();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrDataUrls, setQrDataUrls] = useState<{ [key: number]: string }>({});
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [bindingStatus, setBindingStatus] = useState<{ [key: number]: "idle" | "loading" | "success" | "error" }>({});
  const bridgeInitRef = useRef(false);
  const mqttConnectedRef = useRef<boolean>(false);

  // Update ref when prop changes
  useEffect(() => {
    mqttConnectedRef.current = isMqttConnected;
  }, [isMqttConnected]);

  // Setup bridge and location listener
  const setupBridge = (b: WebViewJavascriptBridge) => {
    if (bridgeInitRef.current) {
      return () => {};
    }
    bridgeInitRef.current = true;

    const reg = (name: string, handler: any) => {
      b.registerHandler(name, handler);
      return () => {
        b.registerHandler(name, () => {});
      };
    };

    const offLocationCallback = reg(
      "locationCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const rawLocationData = typeof data === 'string' ? JSON.parse(data) : data;

          if (!rawLocationData || typeof rawLocationData !== 'object') {
            responseCallback({ success: false, error: "Invalid format" });
            return;
          }

          const { latitude, longitude } = rawLocationData;

          if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            responseCallback({ success: false, error: "Invalid coordinates" });
            return;
          }

          setLastKnownLocation(rawLocationData);
          responseCallback({ success: true, location: rawLocationData });
        } catch (error) {
          console.error("Error processing location data:", error);
          responseCallback({ success: false, error: String(error) });
        }
      }
    );

    b.callHandler('startLocationListener', {}, (responseData) => {
      try {
        const parsedResponse = JSON.parse(responseData);
        if (parsedResponse?.respCode === "200") {
          console.log("QR Generator: Location listener started");
        } else {
          console.error("Failed to start location listener:", parsedResponse?.respMessage);
        }
      } catch (error) {
        console.error("Error parsing start location response:", error);
      }
    });

    return () => {
      offLocationCallback();
      bridgeInitRef.current = false;
    };
  };

  // Wait for MQTT connection with timeout
  const waitForMqttConnection = (maxWait: number = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
      if (mqttConnectedRef.current) {
        resolve(true);
        return;
      }

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (mqttConnectedRef.current) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          console.error("QR Generator: MQTT connection timeout");
          resolve(false);
        }
      }, 100);
    });
  };

  // Publish MQTT message for customer binding
  const publishCustomerBinding = async (subscriptionCode: string, subscriptionId: number) => {
    if (!bridge || !window.WebViewJavascriptBridge) {
      console.error("QR Generator: WebViewJavascriptBridge is not initialized.");
      toast.error(t("MQTT bridge not initialized"));
      return;
    }

    // Set loading state
    setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "loading" }));

    // Wait for MQTT connection before proceeding
    console.log("QR Generator: Waiting for MQTT connection...");
    const connected = await waitForMqttConnection(10000);
    if (!connected) {
      console.error("QR Generator: MQTT not connected. Cannot publish message.");
      setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "error" }));
      toast.error(t("MQTT not connected. Please try again."));
      return;
    }
    console.log("QR Generator: MQTT is connected. Proceeding with publish...");

    // Always use LOC001 as location_id
    const locationId = "LOC001";

    // Use subscription_code as plan_id
    const planId = subscriptionCode;
    const requestTopic = `emit/uxi/service/plan/${planId}/customer_binding`;
    const responseTopic = "echo/#";

    const correlationId = `binding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const correlationKey = `__customerBindingCorrelation_${subscriptionId}`;
    (window as any)[correlationKey] = correlationId;

    const content = {
      timestamp: new Date().toISOString(),
      plan_id: planId,
      correlation_id: correlationId,
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
      content,
    };

    console.log("QR Generator: Publishing MQTT message:", JSON.stringify(dataToPublish, null, 2));

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => {
        bridge.registerHandler(name, () => {});
      };
    };

    let settled = false;
    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          if (settled) {
            responseCallback({ success: true });
            return;
          }

          const parsedData = JSON.parse(data);
          const topic = parsedData.topic;
          const rawMessageContent = parsedData.message;

          if (topic.startsWith("echo/")) {
            console.log("QR Generator: Received MQTT response:", rawMessageContent);
            let responseData;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
              console.log("QR Generator: Parsed response data:", responseData);
            } catch (parseErr) {
              console.error("QR Generator: Error parsing response:", parseErr);
              responseData = rawMessageContent;
            }

            // Check correlation ID match
            const storedCorrelationId = (window as any)[correlationKey];
            const responseCorrelationId = responseData?.correlation_id || responseData?.metadata?.correlation_id;
            
            console.log("QR Generator: Stored Correlation ID:", storedCorrelationId);
            console.log("QR Generator: Response Correlation ID:", responseCorrelationId);

            const correlationMatches = 
              Boolean(storedCorrelationId) &&
              Boolean(responseCorrelationId) &&
              (responseCorrelationId === storedCorrelationId ||
               responseCorrelationId.startsWith(storedCorrelationId) ||
               storedCorrelationId.startsWith(responseCorrelationId));

            if (correlationMatches) {
              console.log("QR Generator: Correlation ID matches! Processing response");

              // Check for required signals
              const signals = responseData?.signals || responseData?.data?.signals || responseData?.metadata?.signals || [];
              console.log("QR Generator: Response signals:", signals);

              const requiredSignals = ["BINDING_ESTABLISHED", "SERVICE_VALIDATED", "LOCATION_ACTIONS_TRIGGERED"];
              const hasRequiredSignals = requiredSignals.every(signal => 
                Array.isArray(signals) && signals.includes(signal)
              );

              if (hasRequiredSignals) {
                console.log("QR Generator: All required signals found! Binding successful");
                settled = true;
                setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "success" }));
                toast.success(t("Location binding successful"));
                (window as any)[correlationKey] = null;
                cleanup();
              } else {
                console.warn("QR Generator: Required signals not found in response");
                console.warn("QR Generator: Expected signals:", requiredSignals);
                console.warn("QR Generator: Received signals:", signals);
                settled = true;
                setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "error" }));
                toast.error(t("Location binding failed"));
                (window as any)[correlationKey] = null;
                cleanup();
              }
            } else {
              console.log("QR Generator: Correlation ID does not match, ignoring response");
            }

            responseCallback({ success: true });
          }
        } catch (err) {
          console.error("QR Generator: Error processing MQTT callback:", err);
          responseCallback({ success: false, error: String(err) });
        }
      }
    );

    const subscribeToTopic = () =>
      new Promise<boolean>((resolve) => {
        console.log(`QR Generator: Subscribing to MQTT response topic: ${responseTopic}`);
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            console.log("QR Generator: MQTT subscribe response:", subscribeResponse);
            try {
              const subResp = typeof subscribeResponse === "string" ? JSON.parse(subscribeResponse) : subscribeResponse;
              if (subResp.respCode === "200") {
                console.log("QR Generator: Successfully subscribed to:", responseTopic);
                resolve(true);
              } else {
                console.error("QR Generator: Subscribe failed:", subResp.respDesc || subResp.error || "Unknown error");
                resolve(false);
              }
            } catch (err) {
              console.error("QR Generator: Error parsing subscribe response:", err);
              resolve(false);
            }
          }
        );
      });

    const publishMessage = () =>
      new Promise<boolean>((resolve) => {
        console.log(`QR Generator: Publishing MQTT message to topic: ${requestTopic}`);
        bridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (response) => {
            console.log("QR Generator: MQTT publish response:", response);
            try {
              const responseData = typeof response === "string" ? JSON.parse(response) : response;
              if (responseData.error || responseData.respCode !== "200") {
                console.error("QR Generator: MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
                resolve(false);
              } else {
                console.log("QR Generator: Successfully published customer binding request");
                resolve(true);
              }
            } catch (err) {
              console.error("QR Generator: Error parsing MQTT publish response:", err);
              resolve(false);
            }
          }
        );
      });

    // Timeout handler - declare before cleanup so it can be cleared
    const timeoutId = setTimeout(() => {
      if (!settled) {
        console.warn("QR Generator: Location binding timed out");
        setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "error" }));
        toast.error(t("Location binding timed out"));
        cleanup();
      }
    }, 30000); // 30 second timeout

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      console.log(`QR Generator: Cleaning up MQTT response handler and subscription for topic: ${responseTopic}`);
      offResponseHandler();
      (window as any)[correlationKey] = null;
      bridge.callHandler(
        "mqttUnSubTopic",
        { topic: responseTopic, qos: 0 },
        (unsubResponse) => {
          console.log("QR Generator: MQTT unsubscribe response:", unsubResponse);
        }
      );
    };

    // Retry logic with delays
    const maxRetries = 3;
    const retryDelay = 2000;
    let retries = 0;

    const attemptMqttOperations = async () => {
      while (retries < maxRetries) {
        console.log(`QR Generator: Attempting MQTT operations (Attempt ${retries + 1}/${maxRetries})`);
        
        // Check connection status before each attempt
        if (!mqttConnectedRef.current) {
          console.log("QR Generator: MQTT not connected, waiting...");
          const connected = await waitForMqttConnection(3000);
          if (!connected) {
            retries++;
            if (retries < maxRetries) {
              console.log(`QR Generator: Retrying after ${retryDelay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            } else {
              console.error("QR Generator: MQTT connection failed after retries");
              cleanup();
              return;
            }
          }
        }

        const subscribed = await subscribeToTopic();
        if (!subscribed) {
          retries++;
          if (retries < maxRetries) {
            console.log(`QR Generator: Retrying subscribe (${retries}/${maxRetries}) after ${retryDelay}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("QR Generator: Failed to subscribe after retries");
            cleanup();
            return;
          }
        }

        // Add small delay between subscribe and publish
        await new Promise((resolve) => setTimeout(resolve, 500));

        const published = await publishMessage();
        if (!published) {
          retries++;
          if (retries < maxRetries) {
            console.log(`QR Generator: Retrying publish (${retries}/${maxRetries}) after ${retryDelay}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error("QR Generator: Failed to publish after retries");
            cleanup();
            return;
          }
        }

        console.log("QR Generator: MQTT operations successful, waiting for response...");
        // Don't cleanup immediately - wait for response or timeout
        return;
      }
    };

    try {
      await attemptMqttOperations();
    } catch (err) {
      console.error("QR Generator: Error in MQTT operations:", err);
      clearTimeout(timeoutId);
      setBindingStatus((prev) => ({ ...prev, [subscriptionId]: "error" }));
      toast.error(t("Failed to publish location binding request"));
      cleanup();
    }
  };

  useEffect(() => {
    if (bridge) {
      return setupBridge(bridge);
    }
  }, [bridge]);

  useEffect(() => {
    console.log("QR Generator: Component mounted/updated, customer:", customer);
    
    // Try to get partner_id from customer prop or localStorage
    let partnerId: number | null = null;
    
    if (customer?.partner_id) {
      partnerId = customer.partner_id;
    } else {
      // Try to get from localStorage
      try {
        const storedCustomerData = localStorage.getItem("customerData_rider");
        if (storedCustomerData) {
          const parsed = JSON.parse(storedCustomerData);
          partnerId = parsed.partner_id || parsed.id || null;
          console.log("QR Generator: Got partner_id from localStorage:", partnerId);
        }
      } catch (e) {
        console.error("QR Generator: Error parsing customerData_rider:", e);
      }
    }
    
    if (!partnerId) {
      console.log("QR Generator: No partner_id available");
      setIsLoading(false);
      return;
    }

    const fetchSubscriptions = async () => {
      setIsLoading(true);
      try {
        console.log("QR Generator: Fetching subscriptions for partner_id:", partnerId);
        
        const token = localStorage.getItem("authToken_rider");
        
        if (!token) {
          console.error("QR Generator: No auth token found");
          toast.error(t("Authentication token not found. Please log in again."));
          setIsLoading(false);
          return;
        }

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          "X-API-KEY": "abs_connector_secret_key_2024",
          "Authorization": `Bearer ${token}`,
        };

        const url = `https://crm-omnivoltaic.odoo.com/api/customers/${partnerId}/subscriptions`;
        console.log("QR Generator: Fetching from URL:", url);

        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        console.log("QR Generator: Response status:", response.status);
        console.log("QR Generator: Response ok:", response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("QR Generator: Response error:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("QR Generator: Response data:", data);

        if (data.success && Array.isArray(data.subscriptions)) {
          console.log("QR Generator: Found subscriptions:", data.subscriptions.length);
          setSubscriptions(data.subscriptions);
          
          // Generate QR codes for each subscription
          const qrPromises = data.subscriptions.map(async (sub: Subscription) => {
            const qrData = {
              customer_id: data.customer_id,
              subscription_code: sub.subscription_code,
              product_name: sub.product_name,
            };
            
            try {
              const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
                width: 300,
                margin: 2,
                color: {
                  dark: "#000000",
                  light: "#FFFFFF",
                },
              });
              return { id: sub.id, dataUrl: qrDataUrl };
            } catch (error) {
              console.error(`Error generating QR code for subscription ${sub.id}:`, error);
              return { id: sub.id, dataUrl: null };
            }
          });

          const qrResults = await Promise.all(qrPromises);
          const qrMap: { [key: number]: string } = {};
          qrResults.forEach((result) => {
            if (result.dataUrl) {
              qrMap[result.id] = result.dataUrl;
            }
          });
          setQrDataUrls(qrMap);
          
          // Initialize binding status for all subscriptions
          const initialStatus: { [key: number]: "idle" } = {};
          data.subscriptions.forEach((sub: Subscription) => {
            initialStatus[sub.id] = "idle";
          });
          setBindingStatus(initialStatus);
        } else {
          console.error("QR Generator: Invalid response format:", data);
          console.error("QR Generator: data.success:", data.success);
          console.error("QR Generator: data.subscriptions:", data.subscriptions);
          console.error("QR Generator: Is array?", Array.isArray(data.subscriptions));
          throw new Error(data.message || "Failed to fetch subscriptions");
        }
      } catch (error: any) {
        console.error("QR Generator: Error fetching subscriptions:", error);
        console.error("QR Generator: Error details:", error.message, error.stack);
        toast.error(error.message || t("Failed to fetch subscriptions"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, [customer?.partner_id, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!customer?.partner_id && !customer?.id) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>{t("Please log in to view your subscription QR codes")}</p>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>{t("No subscriptions found")}</p>
        <p className="text-xs text-gray-500 mt-2">
          Partner ID: {customer?.partner_id || customer?.id || "N/A"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">{t("Subscription QR Codes")}</h2>
        <p className="text-gray-400 text-sm mb-6">
          {t("Each QR code contains your customer ID, subscription code, and product name")}
        </p>
      </div> */}

      <div className="grid gap-6">
        {subscriptions.map((subscription) => (
          <div
            key={subscription.id}
            className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-gray-700"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="flex-shrink-0">
                {qrDataUrls[subscription.id] ? (
                  <img
                    src={qrDataUrls[subscription.id]}
                    alt={`QR Code for ${subscription.subscription_code}`}
                    className="w-64 h-64 border-4 border-gray-700 rounded-lg bg-white p-2"
                  />
                ) : (
                  <div className="w-64 h-64 border-4 border-gray-700 rounded-lg bg-gray-700 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {subscription.product_name}
                </h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="font-medium">{t("Subscription Code:")}</span>{" "}
                    <span className="text-indigo-400">{subscription.subscription_code}</span>
                  </p>
                  <p>
                    <span className="font-medium">{t("Status:")}</span>{" "}
                    <span className="capitalize">{subscription.status}</span>
                  </p>
                  <p>
                    <span className="font-medium">{t("Price:")}</span>{" "}
                    {subscription.currency} {subscription.price.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-medium">{t("Next Cycle:")}</span>{" "}
                    {new Date(subscription.next_cycle_date).toLocaleDateString()}
                  </p>
                </div>
                
                {/* Location Binding Button */}
                <div className="mt-4">
                  <button
                    onClick={() => publishCustomerBinding(subscription.subscription_code, subscription.id)}
                    disabled={bindingStatus[subscription.id] === "loading"}
                    className={`w-full md:w-auto px-4 py-2 rounded-lg font-medium transition-all ${
                      bindingStatus[subscription.id] === "loading"
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : bindingStatus[subscription.id] === "success"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : bindingStatus[subscription.id] === "error"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {bindingStatus[subscription.id] === "loading" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t("Binding...")}</span>
                        </>
                      ) : bindingStatus[subscription.id] === "success" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t("Location Bound")}</span>
                        </>
                      ) : bindingStatus[subscription.id] === "error" ? (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>{t("Retry Location Binding")}</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4" />
                          <span>{t("Location Binding")}</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QRGenerator;