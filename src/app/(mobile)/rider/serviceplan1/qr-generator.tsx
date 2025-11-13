"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
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
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  [key: string]: any;
}

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

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const QRGenerator: React.FC<QRGeneratorProps> = ({ customer }) => {
  const { t } = useI18n();
  const { bridge } = useBridge();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrDataUrls, setQrDataUrls] = useState<{ [key: number]: string }>({});
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const bridgeInitRef = useRef(false);
  const mqttConnectedRef = useRef<boolean>(false);

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

    const offConnectMqtt = reg(
      "connectMqttCallBack",
      (data: string, resp: any) => {
        try {
          const parsed = JSON.parse(data);
          console.log("QR Generator: MQTT connection callback:", parsed);
          setIsMqttConnected(true);
          mqttConnectedRef.current = true;
          resp("Received MQTT Connection Callback");
        } catch (err) {
          setIsMqttConnected(false);
          mqttConnectedRef.current = false;
          console.error("QR Generator: Error parsing MQTT connection callback:", err);
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

    b.callHandler("connectMqtt", mqttConfig, (resp: string) => {
      try {
        const p = JSON.parse(resp);
        if (p.error) {
          console.error("QR Generator: MQTT connection error:", p.error.message);
          setIsMqttConnected(false);
        }
      } catch (err) {
        console.error("QR Generator: Error parsing MQTT response:", err);
        setIsMqttConnected(false);
      }
    });

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
      offConnectMqtt();
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
  const publishCustomerBinding = async (subscriptionCode: string) => {
    if (!bridge || !window.WebViewJavascriptBridge) {
      console.error("QR Generator: WebViewJavascriptBridge is not initialized.");
      return;
    }

    // Wait for MQTT connection before proceeding
    console.log("QR Generator: Waiting for MQTT connection...");
    const connected = await waitForMqttConnection(10000);
    if (!connected) {
      console.error("QR Generator: MQTT not connected. Cannot publish message.");
      return;
    }
    console.log("QR Generator: MQTT is connected. Proceeding with publish...");

    // Format location_id from coordinates or use default
    let locationId = "LOC001"; // Default
    if (lastKnownLocation?.latitude && lastKnownLocation?.longitude) {
      // Format as LOC{lat}{lng} or use coordinates directly
      locationId = `LOC${Math.round(lastKnownLocation.latitude * 1000)}${Math.round(lastKnownLocation.longitude * 1000)}`;
    }

    const requestTopic = `emit/uxi/service/plan/bss-plan-weekly-freedom-nairobi-v2-plan5/customer_binding`;
    const responseTopic = "echo/#";

    const content = {
      timestamp: new Date().toISOString(),
      plan_id: "bss-plan-weekly-freedom-nairobi-v2-plan5",
      correlation_id: `binding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
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

    const cleanup = () => {
      console.log(`QR Generator: Cleaning up MQTT response handler and subscription for topic: ${responseTopic}`);
      offResponseHandler();
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

        console.log("QR Generator: MQTT operations successful, scheduling cleanup");
        setTimeout(() => cleanup(), 15000);
        return;
      }
    };

    try {
      await attemptMqttOperations();
    } catch (err) {
      console.error("QR Generator: Error in MQTT operations:", err);
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
          
          // Auto-publish MQTT message for each subscription
          data.subscriptions.forEach((sub: Subscription) => {
            if (sub.subscription_code) {
              publishCustomerBinding(sub.subscription_code);
            }
          });
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
      <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">{t("Subscription QR Codes")}</h2>
        <p className="text-gray-400 text-sm mb-6">
          {t("Each QR code contains your customer ID, subscription code, and product name")}
        </p>
      </div>

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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QRGenerator;
