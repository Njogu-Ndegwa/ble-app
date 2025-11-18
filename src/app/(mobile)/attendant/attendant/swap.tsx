"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
// import { toast } from "react-hot-toast";
import {
  Camera,
  Loader2,
  CheckCircle,
  XCircle,
  Battery,
  User,
  UserPlus,
  QrCode,
  Shield,
  PackageCheck,
  AlertTriangle,
  X,
} from "lucide-react";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from "@/i18n";

// ABS topics use hardcoded payloads as per docs; publish via bridge like BLE page..
// PLAN_ID is now dynamically set from subscription_code in scanned QR code
const ATTENDANT_ID = "attendant-001";
const STATION = "STATION_001";

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

interface SwapProps {
  customer: {
    id?: number;
    name?: string;
    email?: string;
    partner_id?: number;
    company_id?: number;
  } | null;
}

const Swap: React.FC<SwapProps> = ({ customer }) => {
  const { t } = useI18n();
  const { bridge } = useBridge();
  const [currentPhase, setCurrentPhase] = useState<"A1" | "A2" | "A3" | "A4">(
    "A1"
  );
  const [customerType, setCustomerType] = useState<
    "first-time" | "returning" | null
  >(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [equipmentData, setEquipmentData] = useState<any>(null);
  const [isScanningCustomer, setIsScanningCustomer] = useState<boolean>(false);
  const [isScanningEquipment, setIsScanningEquipment] =
    useState<boolean>(false);
  const [isScanningCheckin, setIsScanningCheckin] = useState<boolean>(false);
  const [isScanningCheckout, setIsScanningCheckout] = useState<boolean>(false);
  const [customerIdentified, setCustomerIdentified] = useState<boolean>(false);
  const [customerIdentificationResponse, setCustomerIdentificationResponse] =
    useState<{
      received: boolean;
      status?: "success" | "error";
      data?: any;
    }>({ received: false });
  const [equipmentIdentified, setEquipmentIdentified] =
    useState<boolean>(false);
  const [equipmentIdentificationResponse, setEquipmentIdentificationResponse] =
    useState<{
      received: boolean;
      status?: "success" | "error";
      data?: any;
    }>({ received: false });
  const [checkinEquipmentId, setCheckinEquipmentId] = useState<string | null>(
    null
  );
  const [checkoutEquipmentId, setCheckoutEquipmentId] = useState<string | null>(
    null
  );
  const [checkoutEnergyTransferred, setCheckoutEnergyTransferred] = useState<string>("");
  const [checkinEnergyTransferred, setCheckinEnergyTransferred] = useState<string>("");
  const [dynamicPlanId, setDynamicPlanId] = useState<string>(""); // Will be set from subscription_code in QR code
  const [paymentState, setPaymentState] = useState<string | null>(null);
  const [serviceStates, setServiceStates] = useState<Array<{
    service_id: string;
    used: number;
    quota: number;
    current_asset: string | null;
  }>>([]);
  
  // Phase A2 validation states
  const [validationStatus, setValidationStatus] = useState<{
    customer?: "pending" | "success" | "error";
    payment?: "pending" | "success" | "error";
    equipment?: "pending" | "success" | "error";
    quota?: "pending" | "success" | "error";
  }>({});
  const [isRunningValidations, setIsRunningValidations] =
    useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<any>({});
  // Phase A3 states (Transaction Execution)
  const [isRunningPhase3, setIsRunningPhase3] = useState<boolean>(false);
  const [phase3Status, setPhase3Status] = useState<{
    checkin?: "pending" | "success" | "error";
    checkout?: "pending" | "success" | "error";
  }>({});
  // Phase A4 states (Reporting)
  const [isRunningPhase4, setIsRunningPhase4] = useState<boolean>(false);
  const [phase4Status, setPhase4Status] = useState<{
    activity?: "pending" | "success" | "error";
    usage?: "pending" | "success" | "error";
  }>({});
  
  const bridgeInitRef = useRef(false);
  const scanTypeRef = useRef<
    "customer" | "equipment" | "checkin" | "checkout" | null
  >(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

  const formatDisplayValue = (value?: string | number, fallback?: string) => {
    if (value === undefined || value === null || value === "") {
      return fallback ?? t("N/A");
    }
    const strValue = String(value);
    return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
  };

  const mqttPublish = useCallback(
    (topic: string, content: any) => {
      if (!window.WebViewJavascriptBridge) {
        // toast.error(t("MQTT disconnected"));
        return;
      }
      try {
        const dataToPublish = { topic, qos: 0, content };
        // toast(t("Publishing to") + ` ${topic}`);
        window.WebViewJavascriptBridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (resp: any) => {
            try {
              const r = typeof resp === "string" ? JSON.parse(resp) : resp;
              // Expecting respCode/respDesc shape from native layer
              if (r?.respCode === "200" || r?.respData === true) {
                // toast.success(t("Published to") + ` ${topic}`);
              } else {
                // toast.error((r?.respDesc as string) || t("Publish failed"));
              }
            } catch {
              // Unknown response, still consider it attempted
              // toast.success(t("Published to") + ` ${topic}`);
            }
          }
        );
      } catch (err) {
        // toast.error(t("Publish failed"));
      }
    },
    [t]
  );

  type ValidationStepKey = "customer" | "payment" | "equipment" | "quota";

  interface ValidationStepConfig {
    key: ValidationStepKey;
    requestTopic: string;
    correlationPrefix: string;
    buildPayload: (correlationId: string) => any;
    requiredSignals?: string[];
    responseTopic?: string;
    timeoutMs?: number;
  }

  const runValidationStep = useCallback(
    (config: ValidationStepConfig) => {
      if (!bridge) {
        return Promise.reject({
          message: "Bridge not available for MQTT operations",
        });
      }

      const correlationId = `${config.correlationPrefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`;

      const responseTopic = config.responseTopic ?? "echo/#";
      const payload = config.buildPayload(correlationId);
      const dataToPublish = {
        topic: config.requestTopic,
        qos: 0,
        content: payload,
      };

      console.info("=== Validation MQTT ===");
      console.info("Step:", config.key);
      console.info("Request Topic:", config.requestTopic);
      console.info("Correlation ID:", correlationId);
      console.info("Payload:", JSON.stringify(payload, null, 2));

      return new Promise<any>((resolve, reject) => {
        const correlationKey = `__validationCorrelation_${config.key}`;
        // Store correlation ID immediately
        (window as any)[correlationKey] = correlationId;
        console.info(`[${config.key}] Stored correlation ID in promise: ${correlationKey} = ${correlationId}`);

        let settled = false;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          (window as any)[correlationKey] = null;
          deregister();
          try {
            bridge.callHandler(
              "mqttUnSubTopic",
              { topic: responseTopic, qos: 0 },
              () => {}
            );
          } catch (err) {
            console.warn("Validation unsubscribe error", err);
          }
        };

        const reg = (name: string, handler: any) => {
          bridge.registerHandler(name, handler);
          return () => bridge.registerHandler(name, () => {});
        };

        const handleIncomingMessage = (
          data: string,
          responseCallback: (response: any) => void
        ) => {
          try {
            console.info(`[${config.key}] ===== VALIDATION HANDLER CALLED =====`);
            console.info(`[${config.key}] Raw message received (type: ${typeof data}):`, data);
            
            // Parse the incoming data - it might be a string or already an object
            let parsedData: any;
            try {
              parsedData = typeof data === "string" ? JSON.parse(data) : data;
            } catch (e) {
              console.error(`[${config.key}] Failed to parse data:`, e);
              responseCallback({ success: false, error: "Failed to parse message" });
              return;
            }
            
            // Handle different message formats
            // Format 1: Direct format with topic and message
            // Format 2: Wrapped format with callbackId, data, handlerName (from native bridge)
            let topic: string | undefined;
            let rawMessage: any;
            
            if (parsedData.topic && parsedData.message) {
              // Direct format
              topic = parsedData.topic;
              rawMessage = parsedData.message;
            } else if (parsedData.data) {
              // Wrapped format - parse the data field (could be string or object)
              let innerData: any;
              try {
                innerData = typeof parsedData.data === "string" 
                  ? JSON.parse(parsedData.data) 
                  : parsedData.data;
              } catch (parseErr) {
                console.error(`[${config.key}] Failed to parse inner data field:`, parseErr);
                // Try to extract topic and message directly if parsing fails
                innerData = parsedData.data;
              }
              
              if (innerData && typeof innerData === "object") {
                topic = innerData.topic;
                rawMessage = innerData.message;
              } else {
                // If innerData is not an object, try to parse it as a string
                try {
                  const parsedInner = typeof innerData === "string" ? JSON.parse(innerData) : innerData;
                  topic = parsedInner?.topic;
                  rawMessage = parsedInner?.message;
                } catch (e) {
                  console.error(`[${config.key}] Could not extract topic/message from data field`);
                }
              }
            } else {
              console.error(`[${config.key}] Unknown message format:`, parsedData);
              responseCallback({ success: false, error: "Unknown message format" });
              return;
            }
            
            console.info(`[${config.key}] Parsed topic:`, topic);
            console.info(`[${config.key}] Expected topic:`, responseTopic);
            
            if (!topic) {
              console.warn(`[${config.key}] No topic found in message, ignoring`);
              responseCallback({ success: true });
              return;
            }

            // Check if this is a response topic
            // If responseTopic is a wildcard (contains #), check prefix match
            // Otherwise, check for exact match or prefix match for echo/rtrn topics
            const isWildcard = responseTopic.includes("#");
            let isResponseTopic = false;
            
            if (topic) {
              if (isWildcard) {
                // For wildcard topics, check prefix match
                const baseTopic = responseTopic.replace("#", "").replace("+", "");
                isResponseTopic = topic.startsWith(baseTopic) || 
                  (responseTopic.includes("echo/") && topic.startsWith("echo/")) ||
                  (responseTopic.includes("rtrn/") && topic.startsWith("rtrn/"));
              } else {
                // For exact topics, use exact match
                // This ensures we match the exact topic like: echo/abs/service/plan/231214/validate_customer_status
                const exactMatch = topic === responseTopic;
                
                isResponseTopic = exactMatch;
                
                console.info(`[${config.key}] Topic matching details:`, {
                  exactMatch,
                  topic,
                  responseTopic,
                  match: isResponseTopic
                });
              }
            }
            
            console.info(`[${config.key}] Received message on topic: ${topic}`);
            console.info(`[${config.key}] Expected response topic: ${responseTopic}`);
            console.info(`[${config.key}] Is wildcard: ${isWildcard}`);
            console.info(`[${config.key}] Is response topic: ${isResponseTopic}`);
            
            if (isResponseTopic) {
              let responseData: any;
              try {
                responseData =
                  typeof rawMessage === "string"
                    ? JSON.parse(rawMessage)
                    : rawMessage;
              } catch (err) {
                responseData = rawMessage;
              }

              console.info("=== Validation MQTT Response ===");
              console.info("Step:", config.key);
              console.info("Response Topic:", topic);
              console.info("Expected Response Topic Pattern:", responseTopic);
              console.info("Response Payload:", JSON.stringify(responseData, null, 2));

              const storedCorrelationId = (window as any)[correlationKey];
              const responseCorrelationId =
                responseData?.correlation_id ||
                responseData?.data?.correlation_id ||
                responseData?.metadata?.correlation_id;

              console.info(`[${config.key}] Stored Correlation ID:`, storedCorrelationId);
              console.info(`[${config.key}] Response Correlation ID:`, responseCorrelationId);
              console.info(`[${config.key}] Settled status:`, settled);

              // Don't process if already settled
              if (settled) {
                console.warn(`[${config.key}] Handler already settled, ignoring response`);
                responseCallback({ success: true });
                return;
              }

              // Enhanced correlation matching: handle cases where response correlation ID has suffixes
              // e.g., stored: "att-customer-val-123-abc", response: "att-customer-val-123-abc_abs_customer_status"
              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId + "_") ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId) ||
                  // Also check if response correlation ID contains the stored one (for cases with suffixes)
                  responseCorrelationId.includes(storedCorrelationId));

              console.info(`[${config.key}] Correlation matches:`, correlationMatches);
              if (!correlationMatches) {
                console.warn(`[${config.key}] Correlation mismatch - stored: "${storedCorrelationId}", response: "${responseCorrelationId}"`);
              }

              if (correlationMatches && !settled) {
                const successFlag =
                  responseData?.success === true ||
                  responseData?.data?.success === true ||
                  responseData?.metadata?.success === true;

                console.info(`[${config.key}] Success flag check:`, {
                  topLevel: responseData?.success,
                  dataLevel: responseData?.data?.success,
                  metadataLevel: responseData?.metadata?.success,
                  final: successFlag
                });

                const collectedSignals = new Set<string>();
                const pushSignals = (signals?: any) => {
                  if (Array.isArray(signals)) {
                    signals.forEach((signal) => {
                      if (typeof signal === "string") {
                        collectedSignals.add(signal);
                      }
                    });
                  }
                };
                pushSignals(responseData?.signals);
                pushSignals(responseData?.data?.signals);
                pushSignals(responseData?.metadata?.signals);

                console.info(`[${config.key}] Collected signals:`, Array.from(collectedSignals));
                console.info(`[${config.key}] Required signals:`, config.requiredSignals);

                const hasRequiredSignal =
                  !config.requiredSignals ||
                  config.requiredSignals.some((signal) =>
                    collectedSignals.has(signal)
                  );

                console.info(`[${config.key}] Has required signal:`, hasRequiredSignal);

                if (successFlag && hasRequiredSignal) {
                  console.info(`[${config.key}] Validation successful! Resolving...`);
                  cleanup();
                  resolve(responseData);
                } else {
                  const bestError =
                    responseData?.data?.error ||
                    responseData?.error ||
                    responseData?.data?.message ||
                    responseData?.message ||
                    (!successFlag
                      ? "Validation failed: success flag false"
                      : "Validation failed: required signals missing");

                  console.warn(`[${config.key}] Validation failed:`, bestError);
                  cleanup();
                  reject({
                    message: bestError,
                    response: responseData,
                  });
                }
              } else if (!correlationMatches) {
                console.warn(`[${config.key}] Correlation did not match - stored: "${storedCorrelationId}", response: "${responseCorrelationId}"`);
              } else if (settled) {
                console.warn(`[${config.key}] Handler already settled, ignoring response`);
              }

              // Always call responseCallback to acknowledge message receipt
              responseCallback({ success: true });
            } else {
              // Message received but not for this validation step
              console.info(`[${config.key}] Message received on topic "${topic}" but not matching expected topic "${responseTopic}"`);
              responseCallback({ success: true });
            }
          } catch (err: any) {
            console.error("Validation response parse error", err);
            responseCallback({ success: false, error: err?.message });
          }
        };

        // Register the handler FIRST, before subscribing
        // This ensures we catch the response even if it arrives quickly
        // NOTE: This REPLACES any existing handler (like setupBridge's handler)
        console.info(`[${config.key}] About to register validation handler for topic: ${responseTopic}`);
        console.info(`[${config.key}] Correlation ID that will be stored: ${correlationId}`);
        
        // Store correlation ID BEFORE registering handler to ensure it's available
        (window as any)[correlationKey] = correlationId;
        
        // IMPORTANT: Register handler BEFORE subscribing to ensure it's ready to receive messages
        // This handler will replace any existing handler (like setupBridge's handler)
        const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);
        console.info(`[${config.key}] Validation handler registered successfully for topic: ${responseTopic}`);
        console.info(`[${config.key}] Stored correlation ID in window: ${correlationKey} = ${correlationId}`);
        console.info(`[${config.key}] Verification - correlation ID in window:`, (window as any)[correlationKey]);
        console.info(`[${config.key}] Handler registration complete. Ready to receive messages.`);
        console.info(`[${config.key}] Handler function will log when called: "[${config.key}] ===== VALIDATION HANDLER CALLED ====="`);

        const timeoutId = window.setTimeout(() => {
          if (!settled) {
            console.warn(`Validation timeout for step: ${config.key}`);
            cleanup();
            reject({
              message: "Validation timed out",
            });
          }
        }, config.timeoutMs ?? 30000);

        const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
          bridge.callHandler(
            "mqttSubTopic",
            { topic: responseTopic, qos: 0 },
            (subscribeResponse: any) => {
              try {
                const subResp =
                  typeof subscribeResponse === "string"
                    ? JSON.parse(subscribeResponse)
                    : subscribeResponse;
                const errorMessage =
                  (subResp?.respDesc || subResp?.error || "").toString();
                const isConnectionError = errorMessage
                  .toLowerCase()
                  .includes("not connected") ||
                  errorMessage.toLowerCase().includes("disconnected");

                if (subResp?.respCode === "200") {
                  console.info(`[${config.key}] Successfully subscribed to ${responseTopic}`);
                  setTimeout(() => {
                    try {
                      console.info(`[${config.key}] Publishing to ${config.requestTopic}`);
                      bridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
                        (publishResponse: any) => {
                          try {
                            const pubResp =
                              typeof publishResponse === "string"
                                ? JSON.parse(publishResponse)
                                : publishResponse;
                            const pubMessage =
                              (pubResp?.respDesc || pubResp?.error || "").toString();
                            const pubConnectionError = pubMessage
                              .toLowerCase()
                              .includes("not connected") ||
                              pubMessage.toLowerCase().includes("disconnected");

                            if (pubResp?.error || pubResp?.respCode !== "200") {
                              if (pubConnectionError && retryCount < maxRetries) {
                                setTimeout(() => {
                                  attemptMqttOperations(retryCount + 1, maxRetries);
                                }, 1000);
                              } else {
                                cleanup();
                                reject({
                                  message: pubMessage || "Publish failed",
                                });
                              }
                            }
                          } catch (err) {
                            console.error(
                              "Validation publish response parse error",
                              err
                            );
                          }
          }
        );
      } catch (err) {
                      console.error("Validation publish error", err);
                      if (retryCount < maxRetries) {
                        setTimeout(() => {
                          attemptMqttOperations(retryCount + 1, maxRetries);
                        }, 1000);
                      } else {
                        cleanup();
                        reject({
                          message: "Error calling mqttPublishMsg",
                        });
                      }
                    }
                  }, 300);
                } else if (isConnectionError && retryCount < maxRetries) {
                  setTimeout(() => {
                    attemptMqttOperations(retryCount + 1, maxRetries);
                  }, 1000);
                } else {
                  cleanup();
                  reject({
                    message: errorMessage || "Subscribe failed",
                  });
                }
              } catch (err) {
                console.error("Validation subscribe response parse error", err);
                if (retryCount < maxRetries) {
                  setTimeout(() => {
                    attemptMqttOperations(retryCount + 1, maxRetries);
                  }, 1000);
                } else {
                  cleanup();
                  reject({
                    message: "Error parsing subscribe response",
                  });
                }
              }
            }
          );
        };

        attemptMqttOperations();
      });
    },
    [bridge]
  );

  const handleCustomerIdentification = useCallback(
    (qrCodeData: string) => {
      if (!bridge) {
        console.error("Bridge not available for MQTT operations");
        setCustomerIdentificationResponse({
          received: true,
          status: "error",
          data: { error: "Bridge not available" },
        });
        return;
      }

      setIsScanningCustomer(false);
      setCustomerIdentificationResponse({ received: false });

      let parsedData: any = qrCodeData;
      try {
        const maybeParsed = JSON.parse(qrCodeData);
        if (maybeParsed && typeof maybeParsed === "object") {
          parsedData = maybeParsed;
        }
      } catch (err) {
        parsedData = qrCodeData;
      }

      const normalizedData: any = {
        customer_id:
          typeof parsedData === "object"
            ? parsedData.customer_id ||
              parsedData.customerId ||
              parsedData.customer?.id ||
              qrCodeData
            : qrCodeData,
        subscription_code:
          typeof parsedData === "object"
            ? parsedData.subscription_code ||
              parsedData.subscriptionCode ||
              parsedData.subscription?.code
            : undefined,
        product_name:
          typeof parsedData === "object"
            ? parsedData.product_name ||
              parsedData.productName ||
              parsedData.product?.name
            : undefined,
        name:
          typeof parsedData === "object"
            ? parsedData.name || parsedData.customer_name
            : undefined,
        raw: qrCodeData,
      };

      setCustomerData(normalizedData);

      // Extract subscription_code and use it as plan_id
      const subscriptionCode = normalizedData.subscription_code;
      if (!subscriptionCode) {
        console.error("No subscription_code found in QR code");
        setCustomerIdentificationResponse({
          received: true,
          status: "error",
          data: { error: "QR code missing subscription_code. Please scan a valid QR code." },
        });
        return;
      }

      // Set subscription_code as plan_id for all MQTT operations
      setDynamicPlanId(subscriptionCode);
      console.info("Using subscription_code as plan_id:", subscriptionCode);

      // Use subscription_code as plan_id
      const currentPlanId = subscriptionCode;

      // Extract customer_id for qr_code_data
      const customerId = normalizedData.customer_id;
      // Format qr_code_data as "QR_CUSTOMER_TEST_" followed by customer_id
      const formattedQrCodeData = `QR_CUSTOMER_TEST_${customerId}`;

      // Generate unique correlation ID for this request
      const correlationId = `att-customer-id-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Publish to MQTT with logging
      const requestTopic = `emit/uxi/attendant/plan/${currentPlanId}/identify_customer`;
      const responseTopic = `echo/abs/service/plan/${currentPlanId}/identify_customer`;

      const payload = {
        timestamp: new Date().toISOString(),
        plan_id: currentPlanId,
        correlation_id: correlationId,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "IDENTIFY_CUSTOMER",
          qr_code_data: formattedQrCodeData,
          attendant_station: STATION,
        },
      };

      const dataToPublish = {
        topic: requestTopic,
        qos: 0,
        content: payload,
      };

      console.info("=== Customer Identification MQTT ===");
      console.info("Request Topic:", requestTopic);
      console.info("Response Topic:", responseTopic);
      console.info("Payload:", JSON.stringify(payload, null, 2));
      console.info("Correlation ID:", correlationId);

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

            // Check if this is the specific customer identification response topic
            // Use currentPlanId from closure (subscriptionCode || dynamicPlanId)
            const expectedResponseTopic = `echo/abs/service/plan/${currentPlanId}/identify_customer`;
            if (topic && topic === expectedResponseTopic) {
              console.info(
                "Response received from customer identification topic:",
                JSON.stringify(message, null, 2)
              );

              let responseData;
              try {
                responseData =
                  typeof rawMessageContent === "string"
                    ? JSON.parse(rawMessageContent)
                    : rawMessageContent;
              } catch (parseErr) {
                responseData = rawMessageContent;
              }

              console.info("=== Customer Identification MQTT Response ===");
              console.info(
                "Full Response Data:",
                JSON.stringify(responseData, null, 2)
              );
              console.info("Response Topic:", topic);

              // Check if this response matches our customer identification request
              const storedCorrelationId = (window as any)
                .__customerIdentificationCorrelationId;
              const responseCorrelationId =
                responseData?.correlation_id ||
                responseData?.metadata?.correlation_id;

              console.info("Stored Correlation ID:", storedCorrelationId);
              console.info("Response Correlation ID:", responseCorrelationId);

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches) {
                console.info(
                  "Correlation ID matches! Processing customer identification response"
                );

                // Check for success and required signals in response
                const success = responseData?.success ?? responseData?.data?.success ?? false;
                const signals =
                  responseData?.signals ||
                  responseData?.data?.signals ||
                  responseData?.metadata?.signals ||
                  [];
                console.info("Response success:", success);
                console.info("Response signals:", signals);

                // Check if response contains success: true and required signal
                const hasRequiredSignal =
                  success === true &&
                  Array.isArray(signals) &&
                  signals.includes("CUSTOMER_IDENTIFIED_SUCCESS");

                console.info(
                  "Response has required signal:",
                  hasRequiredSignal
                );
                console.info("Signals found:", signals);

                if (hasRequiredSignal) {
                  console.info(
                    "Customer identification successful! Required signal found in response."
                  );
                  
                  // Extract paymentState and serviceStates from response
                  const servicePlanData = responseData?.data?.metadata?.service_plan_data;
                  if (servicePlanData) {
                    const extractedPaymentState = servicePlanData.paymentState;
                    const extractedServiceStates = servicePlanData.serviceStates || [];
                    
                    console.info("Extracted paymentState:", extractedPaymentState);
                    console.info("Extracted serviceStates:", extractedServiceStates);
                    
                    setPaymentState(extractedPaymentState);
                    setServiceStates(extractedServiceStates);
                  } else {
                    // Try alternative paths in case structure is different
                    const altPaymentState = responseData?.data?.metadata?.paymentState || 
                                           responseData?.metadata?.paymentState;
                    const altServiceStates = responseData?.data?.metadata?.serviceStates ||
                                            responseData?.metadata?.serviceStates ||
                                            [];
                    
                    if (altPaymentState) {
                      setPaymentState(altPaymentState);
                    }
                    if (Array.isArray(altServiceStates) && altServiceStates.length > 0) {
                      setServiceStates(altServiceStates);
                    }
                  }
                  
                  setCustomerIdentificationResponse({
                    received: true,
                    status: "success",
                    data: responseData,
                  });
                  setCustomerIdentified(true);
                  // Clear the stored correlation ID
                  (window as any).__customerIdentificationCorrelationId = null;
                  // Cleanup handler after successful response
                  setTimeout(() => {
                    offResponseHandler();
                  }, 1000);
                } else {
                  console.warn(
                    "Customer identification response does not contain required signals"
                  );

                  const errorMessage = "Customer identification failed.";

                  console.error("Error details:", errorMessage);

                  setCustomerIdentificationResponse({
                    received: true,
                    status: "error",
                    data: { ...responseData, error: errorMessage },
                  });

                  // Clear the stored correlation ID
                  (window as any).__customerIdentificationCorrelationId = null;
                }
              } else {
                console.info(
                  "Correlation ID does not match, ignoring this message"
                );
              }
              responseCallback({ success: true });
            }
          } catch (err) {
            console.error("Error parsing MQTT arrived callback:", err);
            responseCallback({ success: false, error: err });
          }
        }
      );

      // Store correlation ID for response matching
      (window as any).__customerIdentificationCorrelationId = correlationId;

      // Attempt MQTT operations with retry on connection errors
      const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
        console.info(
          `=== Attempting MQTT Operations (Attempt ${retryCount + 1}/${
            maxRetries + 1
          }) ===`
        );

        let subscribeSuccess = false;
        let publishSuccess = false;

        // Subscribe to response topic first (like rider code)
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            console.info("MQTT subscribe response:", subscribeResponse);
            try {
              const subResp =
                typeof subscribeResponse === "string"
                  ? JSON.parse(subscribeResponse)
                  : subscribeResponse;
              const errorMessage = subResp.respDesc || subResp.error || "";
              const isConnectionError =
                errorMessage.toLowerCase().includes("not connected") ||
                errorMessage.toLowerCase().includes("disconnected");

              if (subResp.respCode === "200") {
                console.info("Subscribed to response topic successfully");
                subscribeSuccess = true;

                // Wait a moment after subscribe before publishing
                setTimeout(() => {
                  // Then publish
                  try {
                    bridge.callHandler(
                      "mqttPublishMsg",
                      JSON.stringify(dataToPublish),
                      (response) => {
                        console.info("MQTT publish response:", response);
                        try {
                          const responseData =
                            typeof response === "string"
                              ? JSON.parse(response)
                              : response;
                          const pubErrorMessage =
                            responseData.respDesc || responseData.error || "";
                          const isPubConnectionError =
                            pubErrorMessage
                              .toLowerCase()
                              .includes("not connected") ||
                            pubErrorMessage
                              .toLowerCase()
                              .includes("disconnected");

                          if (
                            responseData.error ||
                            responseData.respCode !== "200"
                          ) {
                            if (
                              isPubConnectionError &&
                              retryCount < maxRetries
                            ) {
                              console.warn(
                                `MQTT publish connection error. Retrying in 1 second... (${
                                  retryCount + 1
                                }/${maxRetries})`
                              );
                              setTimeout(() => {
                                attemptMqttOperations(
                                  retryCount + 1,
                                  maxRetries
                                );
                              }, 1000);
                            } else {
                              console.error(
                                "MQTT publish error:",
                                pubErrorMessage || "Unknown error"
                              );
                              setCustomerIdentificationResponse({
                                received: true,
                                status: "error",
                                data: {
                                  error: pubErrorMessage || "Publish failed",
                                },
                              });
                            }
                          } else {
                            console.info("MQTT request published successfully");
                            publishSuccess = true;
                          }
                        } catch (err) {
                          console.error(
                            "Error parsing MQTT publish response:",
                            err
                          );
                        }
                      }
                    );
                  } catch (err) {
                    console.error("Error calling mqttPublishMsg:", err);
                    if (retryCount < maxRetries) {
                      setTimeout(() => {
                        attemptMqttOperations(retryCount + 1, maxRetries);
                      }, 1000);
                    } else {
                      setCustomerIdentificationResponse({
                        received: true,
                        status: "error",
                        data: { error: "Error calling mqttPublishMsg" },
                      });
                    }
                  }
                }, 300);
              } else if (isConnectionError && retryCount < maxRetries) {
                console.warn(
                  `MQTT subscribe connection error. Retrying in 1 second... (${
                    retryCount + 1
                  }/${maxRetries})`
                );
                setTimeout(() => {
                  attemptMqttOperations(retryCount + 1, maxRetries);
                }, 1000);
              } else {
                console.error(
                  "Subscribe failed:",
                  errorMessage || "Unknown error"
                );
                setCustomerIdentificationResponse({
                  received: true,
                  status: "error",
                  data: { error: errorMessage || "Subscribe failed" },
                });
              }
            } catch (err) {
              console.error("Error parsing subscribe response:", err);
              if (retryCount < maxRetries) {
                setTimeout(() => {
                  attemptMqttOperations(retryCount + 1, maxRetries);
                }, 1000);
              } else {
                setCustomerIdentificationResponse({
                  received: true,
                  status: "error",
                  data: { error: "Error parsing subscribe response" },
                });
              }
            }
          }
        );
      };

      // Start attempting operations - will retry on connection errors
      setTimeout(() => {
        attemptMqttOperations();
      }, 500);

      // Note: No automatic cleanup timeout here - handler cleans up when response is received
      // or when validation steps complete. This prevents interference with validation handlers
      // that also subscribe to echo/#.
    },
    [bridge, t, dynamicPlanId]
  );

  const handleEquipmentIdentification = useCallback(
    (equipmentBarcode: string) => {
      if (!bridge) {
        console.error("Bridge not available for MQTT operations");
        setEquipmentIdentificationResponse({ received: true, status: "error", data: { error: "Bridge not available" } });
        return;
      }

      if (!dynamicPlanId) {
        console.error("Plan ID not set. Customer identification must be completed first.");
        setEquipmentIdentificationResponse({ received: true, status: "error", data: { error: "Customer identification required first" } });
        return;
      }

      setIsScanningEquipment(false);
      setEquipmentIdentificationResponse({ received: false });

      // Normalize equipment data - extract ID if JSON, otherwise use raw string
      let parsedData: any = equipmentBarcode;
      try {
        const maybeParsed = JSON.parse(equipmentBarcode);
        if (maybeParsed && typeof maybeParsed === "object") {
          parsedData = maybeParsed;
        }
      } catch (err) {
        parsedData = equipmentBarcode;
      }

      // Extract equipment ID from various possible formats
      let normalizedEquipmentId: string;
      if (typeof parsedData === "object") {
        normalizedEquipmentId =
          parsedData.equipment_id ||
          parsedData.equipmentId ||
          parsedData.id ||
          parsedData.barcode ||
          equipmentBarcode;
      } else {
        normalizedEquipmentId = equipmentBarcode;
      }

      // Ensure it's always a string
      const equipmentIdString = String(normalizedEquipmentId || "");
      
      // Remove any existing prefix if present (e.g., "BAT_NEW_ATT_" or "BAT_RETURN_ATT_")
      // const cleanEquipmentId = equipmentIdString.replace(/^BAT_(NEW|RETURN)_ATT_/i, '');
      
      // Format equipment ID with BAT_NEW_ATT_ prefix for equipment identification
      const formattedEquipmentId = `BAT_NEW_ATT_${equipmentIdString}`;
      
      setEquipmentData(equipmentIdString); // Store original for display
      
      // Generate unique correlation ID for this request
      const correlationId = `att-equipment-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Publish to MQTT with logging
      const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/identify_equipment`;
      const responseTopic = `echo/abs/service/plan/${dynamicPlanId}/identify_equipment`;
      
      const payload = {
        timestamp: new Date().toISOString(),
        plan_id: dynamicPlanId,
        correlation_id: correlationId,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "IDENTIFY_RETURNED_EQUIPMENT",
          equipment_id: formattedEquipmentId,
          attendant_station: STATION,
        },
      };

      const dataToPublish = {
        topic: requestTopic,
        qos: 0,
        content: payload,
      };

      console.info("=== Equipment Identification MQTT ===");
      console.info("Request Topic:", requestTopic);
      console.info("Response Topic:", responseTopic);
      console.info("Payload:", JSON.stringify(payload, null, 2));
      console.info("Correlation ID:", correlationId);

      const reg = (name: string, handler: any) => {
        bridge.registerHandler(name, handler);
        return () => bridge.registerHandler(name, () => {});
      };

      const offResponseHandler = reg(
        "mqttMsgArrivedCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            // Handle wrapped message format from native bridge
            let parsedData: any;
            try {
              parsedData = typeof data === "string" ? JSON.parse(data) : data;
            } catch (e) {
              console.error("Equipment identification: Failed to parse data:", e);
              responseCallback({ success: false, error: "Failed to parse message" });
              return;
            }

            // Extract topic and message from different formats
            let topic: string | undefined;
            let rawMessageContent: any;
            
            if (parsedData.topic && parsedData.message) {
              // Direct format
              topic = parsedData.topic;
              rawMessageContent = parsedData.message;
            } else if (parsedData.data) {
              // Wrapped format - parse the data field
              const innerData = typeof parsedData.data === "string" 
                ? JSON.parse(parsedData.data) 
                : parsedData.data;
              topic = innerData?.topic;
              rawMessageContent = innerData?.message;
            } else {
              // Unknown format, skip
              responseCallback({ success: true });
              return;
            }

            console.info("Equipment identification: Received message on topic:", topic);

            // If validation is starting or in progress, skip processing - let validation handler handle it
            if ((window as any).__validationInProgress || (window as any).__validationWillStartSoon) {
              // Check if this is a validation topic - if so, definitely skip
              const isValidationTopic = topic && (
                topic.includes("validate_customer_status") ||
                topic.includes("validate_payment_status") ||
                topic.includes("validate_equipment_condition") ||
                topic.includes("validate_service_quota") ||
                topic.includes("/validate")
              );
              
              if (isValidationTopic) {
                console.info("Equipment identification: Validation active, skipping validation message");
                responseCallback({ success: true });
                return;
              }
            }

            // Check if this is the specific equipment identification response topic
            const expectedResponseTopic = `echo/abs/service/plan/${dynamicPlanId}/identify_equipment`;
            if (topic && topic === expectedResponseTopic) {
              console.info("Response received from equipment identification topic:", { topic, rawMessageContent });
              
              let responseData;
              try {
                responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
              } catch (parseErr) {
                responseData = rawMessageContent;
              }

              console.info("=== Equipment Identification MQTT Response ===");
              console.info("Full Response Data:", JSON.stringify(responseData, null, 2));
              console.info("Response Topic:", topic);

              // Check if this response matches our equipment identification request
              const storedCorrelationId = (window as any).__equipmentIdentificationCorrelationId;
              const responseCorrelationId = responseData?.correlation_id || responseData?.metadata?.correlation_id;

              console.info("Stored Correlation ID:", storedCorrelationId);
              console.info("Response Correlation ID:", responseCorrelationId);

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches) {
                console.info("Correlation ID matches! Processing equipment identification response");

                // Check for success and required signals in response
                const success = responseData?.success ?? responseData?.data?.success ?? false;
                const signals =
                  responseData?.signals ||
                  responseData?.data?.signals ||
                  responseData?.metadata?.signals ||
                  [];
                console.info("Response success:", success);
                console.info("Response signals:", signals);

                // Check if response contains success: true and required signal
                const hasRequiredSignal =
                  success === true &&
                  Array.isArray(signals) &&
                  signals.includes("EQUIPMENT_BELONGS_TO_USER");

                console.info("Response has required signal:", hasRequiredSignal);
                console.info("Signals found:", signals);

                if (hasRequiredSignal) {
                  console.info("Equipment identification successful!");
                  setEquipmentIdentificationResponse({
                    received: true,
                    status: "success",
                    data: responseData,
                  });
                  setEquipmentIdentified(true);
                  // Clear the stored correlation ID
                  (window as any).__equipmentIdentificationCorrelationId = null;
                  
                  // Mark that validation will start soon - this prevents handler cleanup from interfering
                  // Validation will start automatically via useEffect when equipmentIdentified becomes true
                  (window as any).__validationWillStartSoon = true;
                  
                  // Don't cleanup handler - let validation handler replace it when it registers
                  // This prevents race conditions where cleanup happens after validation handler registers
                  console.info("Equipment identification: Validation will start soon, skipping handler cleanup to avoid conflicts");
                } else {
                  console.warn("Equipment identification response indicates failure");
                  const errorMessage = 
                    responseData?.data?.error ||
                    responseData?.data?.message ||
                    responseData?.error ||
                    responseData?.message ||
                    "Equipment identification failed";

                  console.error("Error details:", errorMessage);
                  setEquipmentIdentificationResponse({
                    received: true,
                    status: "error",
                    data: { ...responseData, error: errorMessage },
                  });
                  // Clear the stored correlation ID
                  (window as any).__equipmentIdentificationCorrelationId = null;
                }
              } else {
                console.info("Correlation ID does not match, ignoring this message");
              }
              responseCallback({ success: true });
            } else {
              // Not an equipment identification topic - skip and let other handlers process it
              // This is important for validation handlers that might be active
              console.info("Equipment identification: Message not for equipment identification, skipping");
              responseCallback({ success: true });
            }
        } catch (err) {
            console.error("Error parsing MQTT arrived callback:", err);
            responseCallback({ success: false, error: err });
          }
        }
      );

      // Store correlation ID for response matching
      (window as any).__equipmentIdentificationCorrelationId = correlationId;

      // Attempt MQTT operations with retry on connection errors
      const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
        console.info(`=== Attempting MQTT Operations (Attempt ${retryCount + 1}/${maxRetries + 1}) ===`);
        
        // Subscribe to response topic first (like rider code)
        bridge.callHandler(
          "mqttSubTopic",
          { topic: responseTopic, qos: 0 },
          (subscribeResponse) => {
            console.info("MQTT subscribe response:", subscribeResponse);
            try {
              const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
              const errorMessage = subResp.respDesc || subResp.error || "";
              const isConnectionError = errorMessage.toLowerCase().includes("not connected") || 
                                       errorMessage.toLowerCase().includes("disconnected");
              
              if (subResp.respCode === "200") {
                console.info("Subscribed to response topic successfully");
                
                // Wait a moment after subscribe before publishing
                setTimeout(() => {
                  // Then publish
                  try {
                    bridge.callHandler(
                      "mqttPublishMsg",
                      JSON.stringify(dataToPublish),
                      (response) => {
                        console.info("MQTT publish response:", response);
                        try {
                          const responseData = typeof response === 'string' ? JSON.parse(response) : response;
                          const pubErrorMessage = responseData.respDesc || responseData.error || "";
                          const isPubConnectionError = pubErrorMessage.toLowerCase().includes("not connected") || 
                                                       pubErrorMessage.toLowerCase().includes("disconnected");
                          
                          if (responseData.error || responseData.respCode !== "200") {
                            if (isPubConnectionError && retryCount < maxRetries) {
                              console.warn(`MQTT publish connection error. Retrying in 1 second... (${retryCount + 1}/${maxRetries})`);
                              setTimeout(() => {
                                attemptMqttOperations(retryCount + 1, maxRetries);
                              }, 1000);
            } else {
                              console.error("MQTT publish error:", pubErrorMessage || "Unknown error");
                              setEquipmentIdentificationResponse({ 
                                received: true, 
                                status: "error", 
                                data: { error: pubErrorMessage || "Publish failed" } 
                              });
                            }
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
                    if (retryCount < maxRetries) {
                      setTimeout(() => {
                        attemptMqttOperations(retryCount + 1, maxRetries);
                      }, 1000);
            } else {
                      setEquipmentIdentificationResponse({ 
                        received: true, 
                        status: "error", 
                        data: { error: "Error calling mqttPublishMsg" } 
                      });
                    }
                  }
                }, 300);
              } else if (isConnectionError && retryCount < maxRetries) {
                console.warn(`MQTT subscribe connection error. Retrying in 1 second... (${retryCount + 1}/${maxRetries})`);
                setTimeout(() => {
                  attemptMqttOperations(retryCount + 1, maxRetries);
                }, 1000);
            } else {
                console.error("Subscribe failed:", errorMessage || "Unknown error");
                setEquipmentIdentificationResponse({ 
                  received: true, 
                  status: "error", 
                  data: { error: errorMessage || "Subscribe failed" } 
                });
              }
            } catch (err) {
              console.error("Error parsing subscribe response:", err);
              if (retryCount < maxRetries) {
                setTimeout(() => {
                  attemptMqttOperations(retryCount + 1, maxRetries);
                }, 1000);
            } else {
                setEquipmentIdentificationResponse({ 
                  received: true, 
                  status: "error", 
                  data: { error: "Error parsing subscribe response" } 
                });
              }
            }
          }
        );
      };

      // Start attempting operations - will retry on connection errors
      setTimeout(() => {
        attemptMqttOperations();
      }, 500);

      // Note: No automatic cleanup timeout here - handler cleans up when response is received
      // or when validation steps complete. This prevents interference with validation handlers
      // that also subscribe to echo/#.
    },
    [bridge, t, dynamicPlanId]
  );

  const setupBridge = useCallback(
    (b: WebViewJavascriptBridge) => {
      const noop = () => {};
      const reg = (name: string, handler: any) => {
        b.registerHandler(name, handler);
        return () => b.registerHandler(name, noop);
      };

      if (!bridgeInitRef.current) {
        bridgeInitRef.current = true;
        try {
          b.init((_m, r) => r("js success!"));
        } catch (err) {
          console.error("Bridge init error", err);
        }
      }

      // MQTT message callback for echo/# responses
      // NOTE: This handler may be replaced by validation handlers temporarily
      // When validation handlers register, they replace this handler
      // When they unregister, this handler should be restored
      // IMPORTANT: Check for active validation handlers before processing
      const offMqttRecv = reg(
        "mqttMsgArrivedCallBack",
        (data: string, resp: any) => {
          // FIRST check if there's an active validation handler
          // If so, don't process - let the validation handler process it
          // Validation handlers register themselves and should handle their own messages
          const hasActiveValidationHandler = 
            (window as any).__validationCorrelation_customer ||
            (window as any).__validationCorrelation_payment ||
            (window as any).__validationCorrelation_equipment ||
            (window as any).__validationCorrelation_quota;
          
          // Also check if this is a validation topic - if so, skip processing entirely
          // Validation handlers will have registered themselves to handle these
          let isValidationTopic = false;
          try {
            const parsedData = typeof data === "string" ? JSON.parse(data) : data;
            let topic: string | undefined;
            
            if (parsedData.topic) {
              topic = parsedData.topic;
            } else if (parsedData.data) {
              const innerData = typeof parsedData.data === "string" 
                ? JSON.parse(parsedData.data) 
                : parsedData.data;
              topic = innerData?.topic;
            }
            
            isValidationTopic = Boolean(topic && (
              topic.includes("validate_customer_status") ||
              topic.includes("validate_payment_status") ||
              topic.includes("validate_equipment_condition") ||
              topic.includes("validate_service_quota") ||
              topic.includes("/validate")
            ));
          } catch (e) {
            // If we can't parse, continue with other checks
          }
          
          if (hasActiveValidationHandler || isValidationTopic) {
            console.info("=== setupBridge: Skipping message - validation handler should process ===");
            console.info("Active validation handlers:", {
              customer: !!(window as any).__validationCorrelation_customer,
              payment: !!(window as any).__validationCorrelation_payment,
              equipment: !!(window as any).__validationCorrelation_equipment,
              quota: !!(window as any).__validationCorrelation_quota
            });
            console.info("Is validation topic:", isValidationTopic);
            // Still acknowledge the message but don't process it
            // The validation handler should have registered itself and will process it
            resp({ success: true });
            return;
          }
          
          console.info("=== setupBridge handler CALLED ===");
          console.info("Raw data received:", data);
          try {
            // Handle different message formats
            let parsedData: any;
            try {
              parsedData = typeof data === "string" ? JSON.parse(data) : data;
            } catch (e) {
              console.error("setupBridge: Failed to parse data:", e);
              resp({ success: false, error: "Failed to parse message" });
              return;
            }
            
            // Extract topic and message from different formats
            let topic: string | undefined;
            let rawMessageContent: any;
            
            if (parsedData.topic && parsedData.message) {
              // Direct format
              topic = parsedData.topic;
              rawMessageContent = parsedData.message;
            } else if (parsedData.data) {
              // Wrapped format - parse the data field
              const innerData = typeof parsedData.data === "string" 
                ? JSON.parse(parsedData.data) 
                : parsedData.data;
              topic = innerData.topic;
              rawMessageContent = innerData.message;
            } else {
              console.error("setupBridge: Unknown message format:", parsedData);
              resp({ success: false, error: "Unknown message format" });
              return;
            }

            console.info("=== MQTT Message Received (setupBridge handler) ===");
            console.info("Topic:", topic);
            console.info("Raw Message:", rawMessageContent);

            // Check if this is a validation topic - if so, don't process it here
            // Validation topics are handled by runValidationStep handlers
            const isValidationTopic = topic && (
              topic.includes("validate_customer_status") ||
              topic.includes("validate_payment_status") ||
              topic.includes("validate_equipment_condition") ||
              topic.includes("validate_service_quota") ||
              topic.includes("/validate")
            );
            
            // Check if there's an active validation handler by checking for correlation IDs
            const hasActiveValidationHandler = 
              (window as any).__validationCorrelation_customer ||
              (window as any).__validationCorrelation_payment ||
              (window as any).__validationCorrelation_equipment ||
              (window as any).__validationCorrelation_quota;
            
            // If it's a validation topic OR there's an active validation handler, skip processing
            // The validation handler should be registered and will handle it
            if (isValidationTopic || hasActiveValidationHandler) {
              if (isValidationTopic) {
                console.info("=== setupBridge: Skipping validation topic, validation handler should process it ===");
                console.info("=== setupBridge: Active validation handlers detected:", {
                  customer: !!(window as any).__validationCorrelation_customer,
                  payment: !!(window as any).__validationCorrelation_payment,
                  equipment: !!(window as any).__validationCorrelation_equipment,
                  quota: !!(window as any).__validationCorrelation_quota
                });
              }
              resp({ success: true });
              return;
            }
            
            // Only process non-validation echo topics for customer identification
            if (topic && topic.startsWith("echo/") && !isValidationTopic) {
              console.info(
                "Processing echo/# response for customer identification"
              );

              let responseData: any;
              try {
                responseData =
                  typeof rawMessageContent === "string"
                    ? JSON.parse(rawMessageContent)
                    : rawMessageContent;
              } catch (err) {
                console.warn(
                  "Could not parse message as JSON, using raw:",
                  err
                );
                responseData = rawMessageContent;
              }

              console.info("=== Customer Identification MQTT Response ===");
              console.info(
                "Full Response Data:",
                JSON.stringify(responseData, null, 2)
              );
              console.info("Response Topic:", topic);

              // Check if this response matches our customer identification request
              const storedCorrelationId = (window as any)
                .__customerIdentificationCorrelationId;
              const responseCorrelationId =
                responseData?.correlation_id ||
                responseData?.metadata?.correlation_id;

              console.info("Stored Correlation ID:", storedCorrelationId);
              console.info("Response Correlation ID:", responseCorrelationId);

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches) {
                console.info(
                  "Correlation ID matches! Processing customer identification response"
                );

                // Check for required signals in response
                const signals =
                  responseData?.signals ||
                  responseData?.data?.signals ||
                  responseData?.metadata?.signals ||
                  [];
                console.info("Response signals:", signals);

                // Check if response contains required signals
                const hasRequiredSignal =
                  Array.isArray(signals) &&
                  (signals.includes("CUSTOMER_IDENTIFICATION_REQUESTED") ||
                    signals.includes("CUSTOMER_IDENTIFIED_SUCCESS"));

                console.info(
                  "Response has required signal:",
                  hasRequiredSignal
                );
                console.info("Signals found:", signals);

                if (hasRequiredSignal) {
                  console.info(
                    "Customer identification successful! Required signal found in response."
                  );
                  
                  // Extract paymentState and serviceStates from response
                  const servicePlanData = responseData?.data?.metadata?.service_plan_data;
                  if (servicePlanData) {
                    const extractedPaymentState = servicePlanData.paymentState;
                    const extractedServiceStates = servicePlanData.serviceStates || [];
                    
                    console.info("Extracted paymentState:", extractedPaymentState);
                    console.info("Extracted serviceStates:", extractedServiceStates);
                    
                    setPaymentState(extractedPaymentState);
                    setServiceStates(extractedServiceStates);
                  } else {
                    // Try alternative paths in case structure is different
                    const altPaymentState = responseData?.data?.metadata?.paymentState || 
                                           responseData?.metadata?.paymentState;
                    const altServiceStates = responseData?.data?.metadata?.serviceStates ||
                                            responseData?.metadata?.serviceStates ||
                                            [];
                    
                    if (altPaymentState) {
                      setPaymentState(altPaymentState);
                    }
                    if (Array.isArray(altServiceStates) && altServiceStates.length > 0) {
                      setServiceStates(altServiceStates);
                    }
                  }
                  
                  setCustomerIdentificationResponse({
                    received: true,
                    status: "success",
                    data: responseData,
                  });
                  setCustomerIdentified(true);
                  // Clear the stored correlation ID
                  (window as any).__customerIdentificationCorrelationId = null;
                } else {
                  console.warn(
                    "Customer identification response does not contain required signals"
                  );

                  const errorMessage =
                    "Customer identification failed. Please check the details.";

                  console.error("Error details:", errorMessage);

                  setCustomerIdentificationResponse({
                    received: true,
                    status: "error",
                    data: { ...responseData, error: errorMessage },
                  });

                  // Clear the stored correlation ID
                  (window as any).__customerIdentificationCorrelationId = null;
                }
              } else {
                console.info(
                  "Correlation ID does not match, ignoring this message"
                );
                console.info(
                  "This might be a response for a different request"
                );
              }
            }

            resp({ success: true });
          } catch (err) {
            console.error("Error processing MQTT message:", err);
            resp({ success: false, error: String(err) });
          }
        }
      );

      // QR code scan callback
      const offQr = reg(
        "scanQrcodeResultCallBack",
        (data: string, resp: any) => {
        try {
          const p = JSON.parse(data);
          const qrVal = p.respData?.value || "";
          console.info("QR code scanned:", qrVal);
          
          if (!qrVal) {
            throw new Error("No QR code value provided");
          }

          // Use ref to determine which scan type is active
          if (scanTypeRef.current === "customer") {
            console.info("Processing customer QR code:", qrVal);
            handleCustomerIdentification(qrVal);
          } else if (scanTypeRef.current === "equipment") {
            console.info("Processing equipment barcode:", qrVal);
            handleEquipmentIdentification(qrVal);
            } else if (scanTypeRef.current === "checkin") {
              console.info("Processing check-in equipment barcode:", qrVal);
              // Normalize equipment ID from scanned barcode
              let parsedData: any = qrVal;
              try {
                const maybeParsed = JSON.parse(qrVal);
                if (maybeParsed && typeof maybeParsed === "object") {
                  parsedData = maybeParsed;
                }
              } catch (err) {
                parsedData = qrVal;
              }

              let normalizedEquipmentId: string;
              if (typeof parsedData === "object") {
                normalizedEquipmentId =
                  parsedData.equipment_id ||
                  parsedData.equipmentId ||
                  parsedData.id ||
                  parsedData.barcode ||
                  qrVal;
          } else {
                normalizedEquipmentId = qrVal;
              }

              setCheckinEquipmentId(normalizedEquipmentId);
              setIsScanningCheckin(false);
              scanTypeRef.current = null;
              // toast.success(t("Equipment scanned for check-in"));
            } else if (scanTypeRef.current === "checkout") {
              console.info("Processing checkout equipment barcode:", qrVal);
              // Normalize equipment ID from scanned barcode
              let parsedData: any = qrVal;
              try {
                const maybeParsed = JSON.parse(qrVal);
                if (maybeParsed && typeof maybeParsed === "object") {
                  parsedData = maybeParsed;
                }
              } catch (err) {
                parsedData = qrVal;
              }

              let normalizedEquipmentId: string;
              if (typeof parsedData === "object") {
                normalizedEquipmentId =
                  parsedData.equipment_id ||
                  parsedData.equipmentId ||
                  parsedData.id ||
                  parsedData.barcode ||
                  qrVal;
              } else {
                normalizedEquipmentId = qrVal;
              }

              setCheckoutEquipmentId(normalizedEquipmentId);
              setIsScanningCheckout(false);
              scanTypeRef.current = null;
              // toast.success(t("Equipment scanned for checkout"));
            } else {
              console.warn(
                "QR code scanned but no active scan type:",
                scanTypeRef.current
              );
              // toast.error(t("No active scan session"));
          }

          resp({ success: true });
        } catch (err) {
          console.error("Error processing QR code data:", err);
            // toast.error(t("Error processing QR code"));
          setIsScanningCustomer(false);
          setIsScanningEquipment(false);
            setIsScanningCheckin(false);
            setIsScanningCheckout(false);
          scanTypeRef.current = null;
          resp({ success: false, error: String(err) });
        }
        }
      );

      const offConnectMqtt = reg(
        "connectMqttCallBack",
        (data: string, resp: any) => {
          try {
            const parsedData =
              typeof data === "string" ? JSON.parse(data) : data;
            console.info("=== MQTT Connection Callback ===");
            console.info(
              "Connection Callback Data:",
              JSON.stringify(parsedData, null, 2)
            );

            // Check if connection was successful
            const isConnected =
              parsedData?.connected === true ||
              parsedData?.status === "connected" ||
              parsedData?.respCode === "200" ||
              (parsedData && !parsedData.error);

            if (isConnected) {
              console.info("MQTT connection confirmed as connected");
              setIsMqttConnected(true);
            } else {
              console.warn(
                "MQTT connection callback indicates not connected:",
                parsedData
              );
              setIsMqttConnected(false);
            }
            resp("Received MQTT Connection Callback");
          } catch (err) {
            console.error("Error parsing MQTT connection callback:", err);
            // If we can parse it, assume connection might be OK but log the error
            console.warn("Assuming MQTT connection is OK despite parse error");
            setIsMqttConnected(true);
            resp("Received MQTT Connection Callback");
          }
        }
      );

      // Generate unique client ID to avoid conflicts when multiple devices connect
      // Format: attendant-{timestamp}-{random}
      const generateClientId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `attendant-${ATTENDANT_ID}-${timestamp}-${random}`;
      };

      const mqttConfig: MqttConfig = {
        username: "Admin",
        password: "7xzUV@MT",
        clientId: generateClientId(),
        hostname: "mqtt.omnivoltaic.com",
        port: 1883,
      };

      console.info("=== Initiating MQTT Connection ===");
      console.info("MQTT Config:", { ...mqttConfig, password: "***" });

      b.callHandler("connectMqtt", mqttConfig, (resp: string) => {
        try {
          const p = typeof resp === "string" ? JSON.parse(resp) : resp;
          console.info("=== MQTT Connect Response ===");
          console.info("Connect Response:", JSON.stringify(p, null, 2));

          if (p.error) {
            console.error("MQTT connection error:", p.error.message || p.error);
            setIsMqttConnected(false);
          } else if (p.respCode === "200" || p.success === true) {
            console.info("MQTT connection initiated successfully");
            // Connection state will be confirmed by connectMqttCallBack
          } else {
            console.warn(
              "MQTT connection response indicates potential issue:",
              p
            );
          }
        } catch (err) {
          console.error("Error parsing MQTT response:", err);
          // Don't set connection to false on parse error, wait for callback
        }
      });

      return () => {
        offMqttRecv();
        offQr();
        offConnectMqtt();
      };
    },
    [handleCustomerIdentification, handleEquipmentIdentification, t]
  );

  useEffect(() => {
    if (bridge) {
      // Check if there's an active validation handler or validation in progress
      // This prevents setupBridge from replacing validation handlers
      const hasActiveValidationHandler = 
        (window as any).__validationCorrelation_customer ||
        (window as any).__validationCorrelation_payment ||
        (window as any).__validationCorrelation_equipment ||
        (window as any).__validationCorrelation_quota;
      
      const validationInProgress = (window as any).__validationInProgress === true;
      
      if (hasActiveValidationHandler || validationInProgress) {
        console.info("setupBridge useEffect: Validation active, skipping handler registration to avoid conflicts", {
          hasActiveValidationHandler,
          validationInProgress,
          customer: !!(window as any).__validationCorrelation_customer,
          payment: !!(window as any).__validationCorrelation_payment,
          equipment: !!(window as any).__validationCorrelation_equipment,
          quota: !!(window as any).__validationCorrelation_quota
        });
        return;
      }
      
      const cleanup = setupBridge(bridge as unknown as WebViewJavascriptBridge);
      return cleanup;
    }
  }, [bridge, setupBridge]);

  const startQrCodeScan = () => {
    if (!window.WebViewJavascriptBridge) {
      // toast.error(t("Bridge not initialized"));
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      "startQrCodeScan",
      999,
      (responseData: string) => {
        console.info("QR Code Scan Response:", responseData);
      }
    );
  };

  const handleStartCustomerScan = () => {
    setCustomerData(null);
    setCustomerIdentified(false);
    setPaymentState(null);
    setServiceStates([]);
    scanTypeRef.current = "customer";
    setIsScanningCustomer(true);
    startQrCodeScan();
  };

  const handleStartEquipmentScan = () => {
    setEquipmentData(null);
    setEquipmentIdentified(false);
    scanTypeRef.current = "equipment";
    setIsScanningEquipment(true);
    startQrCodeScan();
  };

  const handleStartCheckinScan = () => {
    setCheckinEquipmentId(null);
    scanTypeRef.current = "checkin";
    setIsScanningCheckin(true);
    startQrCodeScan();
  };

  const handleStartCheckoutScan = () => {
    setCheckoutEquipmentId(null);
    scanTypeRef.current = "checkout";
    setIsScanningCheckout(true);
    startQrCodeScan();
  };

  const resetFlow = useCallback(() => {
    setCustomerData(null);
    setEquipmentData(null);
    setCustomerIdentified(false);
    setCustomerIdentificationResponse({ received: false });
    setEquipmentIdentified(false);
    setEquipmentIdentificationResponse({ received: false });
    setPaymentState(null);
    setServiceStates([]);
    setIsScanningCustomer(false);
    setIsScanningEquipment(false);
    setIsScanningCheckin(false);
    setIsScanningCheckout(false);
    setCheckinEquipmentId(null);
    setCheckoutEquipmentId(null);
    setCheckoutEnergyTransferred("");
    setCheckinEnergyTransferred("");
    setDynamicPlanId(""); // Reset plan_id
    scanTypeRef.current = null;
    setCurrentPhase("A1");
    setCustomerType(null);
    setValidationStatus({});
    setValidationResults({});
    setIsRunningValidations(false);
    setIsRunningPhase3(false);
    setPhase3Status({});
    setIsSwapModalOpen(false);
    (window as any).__customerIdentificationCorrelationId = null;
    (window as any).__equipmentIdentificationCorrelationId = null;
  }, []);

  const handleProceedToA2 = () => {
    setCurrentPhase("A2");
    setValidationStatus({});
    setValidationResults({});
    // toast.success(t("Proceeding to phase 2..."));
  };

  const handleStartValidations = useCallback(() => {
    if (!bridge) {
      setValidationStatus({
        customer: "error",
      });
      setValidationResults({
        customer: { error: "Bridge not available" },
      });
      return;
    }

    if (!dynamicPlanId) {
      setValidationStatus({
        customer: "error",
      });
      setValidationResults({
        customer: { error: "Plan ID not set. Customer identification required." },
      });
      setIsRunningValidations(false);
      (window as any).__validationInProgress = false;
      return;
    }

    // Clean up any lingering equipment identification handlers before starting validation
    // This ensures validation handlers can properly register and receive messages
    console.info("=== Cleaning up equipment identification handlers before validation ===");
    (window as any).__equipmentIdentificationCorrelationId = null;
    (window as any).__customerIdentificationCorrelationId = null;
    
    // Mark that validation is starting - this prevents setupBridge from replacing handlers
    // We'll set the correlation ID immediately so setupBridge knows validation is active
    // The actual correlation ID will be set when each validation step runs
    (window as any).__validationInProgress = true;
    (window as any).__validationWillStartSoon = false; // Clear the "will start soon" flag

    const hasEquipmentValidation = equipmentIdentified && Boolean(equipmentData);

    setIsRunningValidations(true);
    setValidationResults({});
    setValidationStatus({
      customer: "pending",
      payment: "pending",
      equipment: hasEquipmentValidation ? "pending" : undefined,
      quota: "pending",
    });

    const run = async () => {
      // Add a small delay to ensure any previous handlers are fully cleaned up
      // This is especially important for returning customers where equipment identification
      // handlers might still be active
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const scannedCustomerId = customerData?.customer_id;

      if (!scannedCustomerId) {
        setValidationStatus((prev) => ({
          ...prev,
          customer: "error",
          equipment: undefined,
          quota: undefined,
        }));
        setValidationResults({
          customer: {
            error: "Missing customer ID from scan",
          },
        });
        setIsRunningValidations(false);
        return;
      }

      try {
        const customerResponse = await runValidationStep({
          key: "customer",
          requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_customer`,
          responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_customer_status`,
          correlationPrefix: "att-customer-val",
          requiredSignals: ["CUSTOMER_STATUS_ACTIVE"],
          buildPayload: (correlationId) => ({
            timestamp: new Date().toISOString(),
            plan_id: dynamicPlanId,
            correlation_id: correlationId,
            actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "VALIDATE_CUSTOMER_STATUS",
              customer_id: `customer-test-rider-${scannedCustomerId}`,
            },
          }),
        });

        setValidationStatus((prev) => ({ ...prev, customer: "success" }));
        setValidationResults((prev: any) => ({
          ...prev,
          customer: {
            message: "Customer status active",
            response: customerResponse,
          },
        }));
      } catch (err: any) {
        setValidationStatus((prev) => ({
          ...prev,
          customer: "error",
          payment: undefined,
          equipment: undefined,
          quota: undefined,
        }));
        setValidationResults((prev: any) => ({
          ...prev,
          customer: {
            error: err?.message || "Customer validation failed",
            response: err?.response,
          },
        }));
        setIsRunningValidations(false);
        return;
      }

      // Payment validation for all customers
      try {
        const paymentResponse = await runValidationStep({
          key: "payment",
          requestTopic: `emit/uxi/attendant/plan/${dynamicPlanId}/validate_payment`,
          responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_payment_status`,
          correlationPrefix: "att-payment-val",
          requiredSignals: ["PAYMENT_STATUS_GOOD"],
          buildPayload: (correlationId) => ({
        timestamp: new Date().toISOString(),
            plan_id: dynamicPlanId,
            correlation_id: correlationId,
        actor: {
          type: "attendant",
              id: "attendant-001",
        },
        data: {
          action: "VALIDATE_PAYMENT_STATUS",
              emergency_wait_approved: false,
              asset_ready_to_deploy: true,
            },
          }),
        });

        setValidationStatus((prev) => ({ ...prev, payment: "success" }));
        setValidationResults((prev: any) => ({
          ...prev,
          payment: {
            message: "Payment status validated",
            response: paymentResponse,
          },
        }));
      } catch (err: any) {
        setValidationStatus((prev) => ({
          ...prev,
          payment: "error",
          equipment: undefined,
          quota: undefined,
        }));
        setValidationResults((prev: any) => ({
          ...prev,
          payment: {
            error: err?.message || "Payment validation failed",
            response: err?.response,
          },
        }));
        setIsRunningValidations(false);
        return;
      }

      if (hasEquipmentValidation) {
        try {
          const equipmentResponse = await runValidationStep({
            key: "equipment",
            requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_equipment_condition`,
            responseTopic: "rtrn/#",
            correlationPrefix: "att-condition-val",
            requiredSignals: ["EQUIPMENT_CONDITION_VALIDATION_REQUESTED"],
            timeoutMs: 45000, // 45 seconds for equipment validation
            buildPayload: (correlationId) => ({
          timestamp: new Date().toISOString(),
              plan_id: dynamicPlanId,
              correlation_id: correlationId,
              actor: { type: "attendant", id: ATTENDANT_ID },
          data: {
            action: "VALIDATE_EQUIPMENT_CONDITION",
                equipment_id: "BAT_RETURN_ATT_001",
                damage_assessment_required: false,
              },
            }),
          });

          setValidationStatus((prev) => ({ ...prev, equipment: "success" }));
          setValidationResults((prev: any) => ({
            ...prev,
            equipment: {
              message: "Equipment condition validated",
              response: equipmentResponse,
            },
          }));
        } catch (err: any) {
          setValidationStatus((prev) => ({
            ...prev,
            equipment: "error",
            quota: undefined,
          }));
          setValidationResults((prev: any) => ({
            ...prev,
            equipment: {
              error: err?.message || "Equipment validation failed",
              response: err?.response,
            },
          }));
          setIsRunningValidations(false);
          return;
        }
      }

      try {
        const quotaResponse = await runValidationStep({
          key: "quota",
          requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_quota`,
          responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_service_quota`,
          correlationPrefix: "att-quota-val",
          requiredSignals: ["QUOTA_AVAILABLE"],
          buildPayload: (correlationId) => ({
        timestamp: new Date().toISOString(),
            plan_id: dynamicPlanId,
            correlation_id: correlationId,
            actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "VALIDATE_SERVICE_QUOTA",
        },
          }),
        });

        setValidationStatus((prev) => ({ ...prev, quota: "success" }));
        setValidationResults((prev: any) => ({
          ...prev,
          quota: {
            message: "Service quota validated",
            response: quotaResponse,
          },
        }));
      } catch (err: any) {
        setValidationStatus((prev) => ({
          ...prev,
          quota: "error",
        }));
        setValidationResults((prev: any) => ({
          ...prev,
          quota: {
            error: err?.message || "Service quota validation failed",
            response: err?.response,
          },
        }));
        setIsRunningValidations(false);
        return;
      }

      setIsRunningValidations(false);
      // Clear validation in progress flag when all validations complete
      (window as any).__validationInProgress = false;
    };

    run().catch((err) => {
      console.error("Unexpected validation error", err);
      setIsRunningValidations(false);
      // Clear validation in progress flag on error
      (window as any).__validationInProgress = false;
    });
  }, [bridge, customerData, equipmentData, equipmentIdentified, runValidationStep, dynamicPlanId]);

  const ValidationItem = ({
    label,
    status,
    isLoading,
    details,
  }: {
    label: string;
    status?: "pending" | "success" | "error";
    isLoading: boolean;
    details?: any;
  }) => (
    <div className="bg-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{t(label)}</span>
        {(status === "pending" || (isLoading && !status)) && (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        )}
        {status === "success" && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        {status === "error" && <XCircle className="w-5 h-5 text-red-500" />}
        {!isLoading && !status && (
          <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />
        )}
      </div>
      {status === "success" && (
        <div className="mt-2 text-xs text-gray-400">
          {details?.message || details?.status || t("Validation passed")}
        </div>
      )}
      {status === "error" && (
        <div className="mt-2 text-xs text-red-300">
          {details?.error || details?.message || t("Validation failed")}
        </div>
      )}
    </div>
  );

  const allValidationsComplete = () => {
    const required: string[] = ["customer", "payment"];
    
    if (equipmentIdentified) {
      required.push("equipment");
    }
    
    required.push("quota");
    
    return required.every(
      (key) =>
        validationStatus[key as keyof typeof validationStatus] === "success"
    );
  };

  // Show proceed button instead of auto-advancing from Phase 2

  // Handlers for Phase A3 operations
  const handleEquipmentCheckin = useCallback(() => {
    if (!checkinEquipmentId || !bridge) {
      console.error("Check-in equipment ID or bridge not available");
      setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
      setIsRunningPhase3(false);
      return;
    }

    if (!dynamicPlanId) {
      console.error("Plan ID not set. Customer identification required.");
      setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
      setIsRunningPhase3(false);
      return;
    }

    setIsRunningPhase3(true);
    setPhase3Status({
      checkin: "pending",
      checkout: undefined,
    });

    // Format equipment ID: BAT_RETURN_ATT_{scanned_id}
    const formattedEquipmentId = `BAT_RETURN_ATT_${checkinEquipmentId}`;
    const correlationId = `att-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/equipment_checkin`;
    const responseTopic = "rtrn/#";

    // Build payload
    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: correlationId,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "EQUIPMENT_CHECKIN",
        equipment_id: formattedEquipmentId,
        condition_accepted: true,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    console.info("=== Equipment Check-In MQTT ===");
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Payload:", JSON.stringify(payload, null, 2));
    console.info("Correlation ID:", correlationId);

    const correlationKey = "__equipmentCheckinCorrelationId";
    (window as any)[correlationKey] = correlationId;

    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      (window as any)[correlationKey] = null;
      deregister();
      try {
        bridge.callHandler(
          "mqttUnSubTopic",
          { topic: responseTopic, qos: 0 },
          () => {}
        );
      } catch (err) {
        console.warn("Check-in unsubscribe error", err);
      }
    };

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    const handleIncomingMessage = (
      data: string,
      responseCallback: (response: any) => void
    ) => {
      try {
        const parsedData = JSON.parse(data);
        const topic = parsedData.topic;
        const rawMessage = parsedData.message;

        if (topic && (topic.startsWith("rtrn/") || topic.startsWith("echo/"))) {
          let responseData: any;
          try {
            responseData =
              typeof rawMessage === "string"
                ? JSON.parse(rawMessage)
                : rawMessage;
          } catch (err) {
            responseData = rawMessage;
          }

          console.info("=== Equipment Check-In MQTT Response ===");
          console.info("Response Topic:", topic);
          console.info("Response Payload:", JSON.stringify(responseData, null, 2));

          const storedCorrelationId = (window as any)[correlationKey];
          const responseCorrelationId =
            responseData?.correlation_id ||
            responseData?.metadata?.correlation_id;

          console.info("Stored Correlation ID:", storedCorrelationId);
          console.info("Response Correlation ID:", responseCorrelationId);

          if (settled) {
            console.warn("Handler already settled, ignoring response");
            responseCallback({ success: true });
            return;
          }

          const correlationMatches =
            Boolean(storedCorrelationId) &&
            Boolean(responseCorrelationId) &&
            (responseCorrelationId === storedCorrelationId ||
              responseCorrelationId.startsWith(storedCorrelationId) ||
              storedCorrelationId.startsWith(responseCorrelationId));

          console.info("Correlation matches:", correlationMatches);

          if (correlationMatches && !settled) {
            const successFlag =
              responseData?.success === true ||
              responseData?.data?.success === true ||
              responseData?.metadata?.success === true;

            const signals = responseData?.signals || responseData?.data?.signals || responseData?.metadata?.signals || [];
            const hasRequiredSignal = Array.isArray(signals) && signals.includes("EQUIPMENT_CHECKIN_REQUESTED");

            console.info("Success flag:", successFlag);
            console.info("Signals:", signals);
            console.info("Has required signal:", hasRequiredSignal);

            if (successFlag && hasRequiredSignal) {
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkin: "success" }));
              setIsRunningPhase3(false);
            } else {
              const errorMessage =
                responseData?.data?.error ||
                responseData?.error ||
                responseData?.data?.message ||
                responseData?.message ||
                (!successFlag
                  ? "Equipment check-in failed: success flag false"
                  : "Equipment check-in failed: required signal not found");

              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
              setIsRunningPhase3(false);
              console.error("Check-in error:", errorMessage);
            }
          }

          responseCallback({ success: true });
        }
      } catch (err: any) {
        console.error("Error parsing check-in response:", err);
        responseCallback({ success: false, error: err?.message });
      }
    };

    const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        console.warn("Equipment check-in timed out");
        cleanup();
        setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
        setIsRunningPhase3(false);
      }
    }, 45000);

    const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
      bridge.callHandler(
        "mqttSubTopic",
        { topic: responseTopic, qos: 0 },
        (subscribeResponse: any) => {
          try {
            const subResp =
              typeof subscribeResponse === "string"
                ? JSON.parse(subscribeResponse)
                : subscribeResponse;
            const errorMessage =
              (subResp?.respDesc || subResp?.error || "").toString();
            const isConnectionError = errorMessage
              .toLowerCase()
              .includes("not connected") ||
              errorMessage.toLowerCase().includes("disconnected");

            if (subResp?.respCode === "200") {
              console.info("Successfully subscribed to", responseTopic);
              setTimeout(() => {
                try {
                  console.info("Publishing check-in request to", requestTopic);
                  bridge.callHandler(
                    "mqttPublishMsg",
                    JSON.stringify(dataToPublish),
                    (publishResponse: any) => {
                      try {
                        const pubResp =
                          typeof publishResponse === "string"
                            ? JSON.parse(publishResponse)
                            : publishResponse;
                        const pubMessage =
                          (pubResp?.respDesc || pubResp?.error || "").toString();
                        const pubConnectionError = pubMessage
                          .toLowerCase()
                          .includes("not connected") ||
                          pubMessage.toLowerCase().includes("disconnected");

                        if (pubResp?.error || pubResp?.respCode !== "200") {
                          if (pubConnectionError && retryCount < maxRetries) {
                            setTimeout(() => {
                              attemptMqttOperations(retryCount + 1, maxRetries);
                            }, 1000);
                          } else {
                            clearTimeout(timeoutId);
                            cleanup();
                            setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
                            setIsRunningPhase3(false);
                            console.error("Check-in publish error:", pubMessage);
                          }
                        } else {
                          console.info("Check-in request published successfully");
                        }
                      } catch (err) {
                        console.error("Error parsing publish response:", err);
                      }
                    }
                  );
                } catch (err) {
                  console.error("Error calling mqttPublishMsg:", err);
                  if (retryCount < maxRetries) {
                    setTimeout(() => {
                      attemptMqttOperations(retryCount + 1, maxRetries);
                    }, 1000);
                  } else {
                    clearTimeout(timeoutId);
                    cleanup();
                    setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
                    setIsRunningPhase3(false);
                  }
                }
              }, 300);
            } else if (isConnectionError && retryCount < maxRetries) {
              setTimeout(() => {
                attemptMqttOperations(retryCount + 1, maxRetries);
              }, 1000);
            } else {
              clearTimeout(timeoutId);
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
              setIsRunningPhase3(false);
              console.error("Subscribe failed:", errorMessage);
            }
          } catch (err) {
            console.error("Error parsing subscribe response:", err);
            if (retryCount < maxRetries) {
              setTimeout(() => {
                attemptMqttOperations(retryCount + 1, maxRetries);
              }, 1000);
            } else {
              clearTimeout(timeoutId);
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
              setIsRunningPhase3(false);
            }
          }
        }
      );
    };

    setTimeout(() => {
      attemptMqttOperations();
    }, 500);
  }, [bridge, checkinEquipmentId, dynamicPlanId]);

  // Function to run Phase 4 operations (activity_report, workflow_update, usage_report)
  const runPhase4Operations = useCallback(() => {
    if (!dynamicPlanId) {
      console.error("Plan ID not set. Cannot proceed with Phase 4 reporting.");
      return;
    }

    console.info("=== Starting Phase 4 Operations ===");

    // Activity Report
    mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/activity_report`, {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: `att-activity-${Date.now()}`,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "REPORT_ATTENDANT_ACTIVITY",
        activity_type: "battery_swap_completed",
        activity_data: JSON.stringify({
          duration: 180,
          customer_satisfaction: "high",
        }),
        attendant_station: STATION,
      },
    });

    // Workflow Update
    mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/workflow_update`, {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: `att-workflow-${Date.now()}`,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "UPDATE_WORKFLOW_STATE",
        workflow_stage: "A3",
        stage_transition: "A3_to_A4",
        process_status: "completed",
        performance_metrics: JSON.stringify({
          duration: 300,
          efficiency: 0.95,
        }),
      },
    });

    // Usage Report
    const formattedCheckoutId = checkoutEquipmentId
      ? `BAT_NEW_ATT_${checkoutEquipmentId}`
      : "BAT_NEW_ATT_001";
    const formattedCheckinId = checkinEquipmentId
      ? `BAT_RETURN_ATT_${checkinEquipmentId}`
      : null;

    // Calculate energy transferred based on customer type
    // For returning customers: energy_transferred = checkout_energy - checkin_energy
    // For first-time customers: energy_transferred = checkout_energy
    const checkoutEnergy = checkoutEnergyTransferred.trim()
      ? parseFloat(checkoutEnergyTransferred)
      : 0;
    const checkinEnergy = checkinEnergyTransferred.trim()
      ? parseFloat(checkinEnergyTransferred)
      : 0;
    
    let energyTransferred = 0;
    if (customerType === "returning") {
      // For returning customers, calculate the difference
      energyTransferred = checkoutEnergy - checkinEnergy;
      console.info(`[Phase 4] Returning customer - Energy calculation: ${checkoutEnergy} (checkout) - ${checkinEnergy} (checkin) = ${energyTransferred} kWh`);
    } else {
      // For first-time customers, use checkout energy directly
      energyTransferred = checkoutEnergy;
      console.info(`[Phase 4] First-time customer - Energy transferred: ${energyTransferred} kWh`);
    }
    
    // Ensure energy is not negative
    if (energyTransferred < 0) {
      console.warn(`[Phase 4] Calculated energy is negative (${energyTransferred}), setting to 0`);
      energyTransferred = 0;
    }

    const serviceCompletionDetails: Record<string, any> = {
      new_battery_id: formattedCheckoutId,
      energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
      service_duration: 240,
      attendant_station: STATION,
    };

    if (customerType === "returning" && formattedCheckinId) {
      serviceCompletionDetails.old_battery_id = formattedCheckinId;
    }

    mqttPublish(`emit/uxi/billing/plan/${dynamicPlanId}/usage_report`, {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: `att-usage-report-${Date.now()}`,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "REPORT_SERVICE_USAGE_TO_ODOO",
        usage_type: "battery_swap_completed",
        service_completion_details: serviceCompletionDetails,
      },
    });

    console.info("=== Phase 4 Operations Completed ===");
    
    // Wait a moment for MQTT publishes to complete, then reset flow
    setTimeout(() => {
      resetFlow();
    }, 500);
    }, [dynamicPlanId, checkoutEquipmentId, checkinEquipmentId, customerType, checkoutEnergyTransferred, checkinEnergyTransferred, mqttPublish, resetFlow]);

  const handleEquipmentCheckout = useCallback(() => {
    if (!checkoutEquipmentId || !bridge) {
      console.error("Checkout equipment ID or bridge not available");
      setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
      setIsRunningPhase3(false);
      return;
    }

    if (!dynamicPlanId) {
      console.error("Plan ID not set. Customer identification required.");
      setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
      setIsRunningPhase3(false);
      return;
    }

    setIsRunningPhase3(true);
    setPhase3Status((prev: any) => ({ ...prev, checkout: "pending" }));

    // Format equipment ID: BAT_NEW_ATT_{scanned_id}
    const formattedEquipmentId = `BAT_NEW_ATT_${checkoutEquipmentId}`;
    const correlationId = `att-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/equipment_checkout`;
    const responseTopic = "rtrn/#";

    // Calculate energy transferred based on customer type
    // For returning customers: energy_transferred = checkout_energy - checkin_energy
    // For first-time customers: energy_transferred = checkout_energy
    const checkoutEnergy = checkoutEnergyTransferred.trim()
      ? parseFloat(checkoutEnergyTransferred)
      : 0;
    const checkinEnergy = checkinEnergyTransferred.trim()
      ? parseFloat(checkinEnergyTransferred)
      : 0;
    
    let energyTransferred = 0;
    if (customerType === "returning") {
      // For returning customers, calculate the difference
      energyTransferred = checkoutEnergy - checkinEnergy;
      console.info(`[Checkout] Returning customer - Energy calculation: ${checkoutEnergy} (checkout) - ${checkinEnergy} (checkin) = ${energyTransferred} kWh`);
    } else {
      // For first-time customers, use checkout energy directly
      energyTransferred = checkoutEnergy;
      console.info(`[Checkout] First-time customer - Energy transferred: ${energyTransferred} kWh`);
    }
    
    // Ensure energy is not negative
    if (energyTransferred < 0) {
      console.warn(`[Checkout] Calculated energy is negative (${energyTransferred}), setting to 0`);
      energyTransferred = 0;
    }

    // Build payload - same for both first-time and returning customers
    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: correlationId,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "EQUIPMENT_CHECKOUT",
        replacement_equipment_id: formattedEquipmentId,
        energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
        service_duration: 240,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    console.info("=== Equipment Checkout MQTT ===");
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Payload:", JSON.stringify(payload, null, 2));
    console.info("Correlation ID:", correlationId);

    const correlationKey = "__equipmentCheckoutCorrelationId";
    (window as any)[correlationKey] = correlationId;

    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      (window as any)[correlationKey] = null;
      deregister();
      try {
        bridge.callHandler(
          "mqttUnSubTopic",
          { topic: responseTopic, qos: 0 },
          () => {}
        );
      } catch (err) {
        console.warn("Checkout unsubscribe error", err);
      }
    };

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    const handleIncomingMessage = (
      data: string,
      responseCallback: (response: any) => void
    ) => {
      try {
        const parsedData = JSON.parse(data);
        const topic = parsedData.topic;
        const rawMessage = parsedData.message;

        if (topic && (topic.startsWith("rtrn/") || topic.startsWith("echo/"))) {
          let responseData: any;
          try {
            responseData =
              typeof rawMessage === "string"
                ? JSON.parse(rawMessage)
                : rawMessage;
          } catch (err) {
            responseData = rawMessage;
          }

          console.info("=== Equipment Checkout MQTT Response ===");
          console.info("Response Topic:", topic);
          console.info("Response Payload:", JSON.stringify(responseData, null, 2));

          const storedCorrelationId = (window as any)[correlationKey];
          const responseCorrelationId =
            responseData?.correlation_id ||
            responseData?.metadata?.correlation_id;

          console.info("Stored Correlation ID:", storedCorrelationId);
          console.info("Response Correlation ID:", responseCorrelationId);

          if (settled) {
            console.warn("Handler already settled, ignoring response");
            responseCallback({ success: true });
            return;
          }

          const correlationMatches =
            Boolean(storedCorrelationId) &&
            Boolean(responseCorrelationId) &&
            (responseCorrelationId === storedCorrelationId ||
              responseCorrelationId.startsWith(storedCorrelationId) ||
              storedCorrelationId.startsWith(responseCorrelationId));

          console.info("Correlation matches:", correlationMatches);

          if (correlationMatches && !settled) {
            const successFlag =
              responseData?.success === true ||
              responseData?.data?.success === true ||
              responseData?.metadata?.success === true;

            const signals = responseData?.signals || responseData?.data?.signals || responseData?.metadata?.signals || [];
            const hasRequiredSignal = Array.isArray(signals) && signals.includes("EQUIPMENT_CHECKOUT_REQUESTED");

            console.info("Success flag:", successFlag);
            console.info("Signals:", signals);
            console.info("Has required signal:", hasRequiredSignal);

            if (successFlag && hasRequiredSignal) {
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkout: "success" }));
              setIsRunningPhase3(false);
              
              // Automatically run Phase 4 operations after successful checkout
              runPhase4Operations();
            } else {
              const errorMessage =
                responseData?.data?.error ||
                responseData?.error ||
                responseData?.data?.message ||
                responseData?.message ||
                (!successFlag
                  ? "Equipment checkout failed: success flag false"
                  : "Equipment checkout failed: required signal not found");

              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
              setIsRunningPhase3(false);
              console.error("Checkout error:", errorMessage);
            }
          }

          responseCallback({ success: true });
        }
      } catch (err: any) {
        console.error("Error parsing checkout response:", err);
        responseCallback({ success: false, error: err?.message });
      }
    };

    const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        console.warn("Equipment checkout timed out");
        cleanup();
        setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
        setIsRunningPhase3(false);
      }
    }, 45000);

    const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
      bridge.callHandler(
        "mqttSubTopic",
        { topic: responseTopic, qos: 0 },
        (subscribeResponse: any) => {
          try {
            const subResp =
              typeof subscribeResponse === "string"
                ? JSON.parse(subscribeResponse)
                : subscribeResponse;
            const errorMessage =
              (subResp?.respDesc || subResp?.error || "").toString();
            const isConnectionError = errorMessage
              .toLowerCase()
              .includes("not connected") ||
              errorMessage.toLowerCase().includes("disconnected");

            if (subResp?.respCode === "200") {
              console.info("Successfully subscribed to", responseTopic);
              setTimeout(() => {
                try {
                  console.info("Publishing checkout request to", requestTopic);
                  bridge.callHandler(
                    "mqttPublishMsg",
                    JSON.stringify(dataToPublish),
                    (publishResponse: any) => {
                      try {
                        const pubResp =
                          typeof publishResponse === "string"
                            ? JSON.parse(publishResponse)
                            : publishResponse;
                        const pubMessage =
                          (pubResp?.respDesc || pubResp?.error || "").toString();
                        const pubConnectionError = pubMessage
                          .toLowerCase()
                          .includes("not connected") ||
                          pubMessage.toLowerCase().includes("disconnected");

                        if (pubResp?.error || pubResp?.respCode !== "200") {
                          if (pubConnectionError && retryCount < maxRetries) {
                            setTimeout(() => {
                              attemptMqttOperations(retryCount + 1, maxRetries);
                            }, 1000);
                          } else {
                            clearTimeout(timeoutId);
                            cleanup();
                            setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
                            setIsRunningPhase3(false);
                            console.error("Checkout publish error:", pubMessage);
                          }
                        } else {
                          console.info("Checkout request published successfully");
                        }
                      } catch (err) {
                        console.error("Error parsing publish response:", err);
                      }
                    }
                  );
                } catch (err) {
                  console.error("Error calling mqttPublishMsg:", err);
                  if (retryCount < maxRetries) {
                    setTimeout(() => {
                      attemptMqttOperations(retryCount + 1, maxRetries);
                    }, 1000);
                  } else {
                    clearTimeout(timeoutId);
                    cleanup();
                    setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
                    setIsRunningPhase3(false);
                  }
                }
              }, 300);
            } else if (isConnectionError && retryCount < maxRetries) {
              setTimeout(() => {
                attemptMqttOperations(retryCount + 1, maxRetries);
              }, 1000);
            } else {
              clearTimeout(timeoutId);
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
              setIsRunningPhase3(false);
              console.error("Subscribe failed:", errorMessage);
            }
          } catch (err) {
            console.error("Error parsing subscribe response:", err);
            if (retryCount < maxRetries) {
              setTimeout(() => {
                attemptMqttOperations(retryCount + 1, maxRetries);
              }, 1000);
            } else {
              clearTimeout(timeoutId);
              cleanup();
              setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
              setIsRunningPhase3(false);
            }
          }
        }
      );
    };

    setTimeout(() => {
      attemptMqttOperations();
    }, 500);
  }, [bridge, checkoutEquipmentId, checkoutEnergyTransferred, checkinEnergyTransferred, customerType, dynamicPlanId, runPhase4Operations]);

  // Auto-progression: Customer identification success → start validation
  useEffect(() => {
    if (
      isSwapModalOpen &&
      customerIdentified &&
      customerIdentificationResponse.status === "success" &&
      currentPhase === "A1" &&
      !isRunningValidations &&
      Object.keys(validationStatus).length === 0
    ) {
      // For returning customers, also wait for equipment identification
      if (customerType === "returning" && !equipmentIdentified) {
        return;
      }
      
      console.info("Auto-progressing: Customer identified, starting validation...");
      setCurrentPhase("A2");
      handleStartValidations();
    }
  }, [
    isSwapModalOpen,
    customerIdentified,
    customerIdentificationResponse.status,
    currentPhase,
    isRunningValidations,
    validationStatus,
    handleStartValidations,
    customerType,
    equipmentIdentified,
  ]);

  // Auto-progression: Validation success → show checkin (returning) or checkout (first-time)
  useEffect(() => {
    if (
      isSwapModalOpen &&
      allValidationsComplete() &&
      currentPhase === "A2" &&
      !isRunningValidations
    ) {
      console.info("Auto-progressing: Validations complete, moving to transaction execution...");
      setCurrentPhase("A3");
      // For returning customers, checkin will be shown first
      // For first-time customers, checkout will be shown directly
    }
  }, [
    isSwapModalOpen,
    currentPhase,
    isRunningValidations,
    validationStatus,
    equipmentIdentified,
    equipmentData,
  ]);

  // Auto-progression: Checkin success → show checkout (for returning customers)
  useEffect(() => {
    if (
      isSwapModalOpen &&
      customerType === "returning" &&
      currentPhase === "A3" &&
      phase3Status.checkin === "success" &&
      phase3Status.checkout !== "success"
    ) {
      console.info("Auto-progressing: Checkin complete, ready for checkout...");
      // Checkout UI will be shown automatically since checkin is successful
    }
  }, [
    isSwapModalOpen,
    customerType,
    currentPhase,
    phase3Status.checkin,
    phase3Status.checkout,
  ]);

  // Render modal content for unified swap workflow
  const renderModalContent = () => {
    // Phase A1: Customer Identification
    if (currentPhase === "A1") {
      const stepTitle = customerType === "returning" 
        ? t("Returning Customer Swap")
        : t("First-Time Customer Swap");
      
      return (
        <div className="space-y-6 p-4 max-h-[80vh] overflow-y-auto">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {stepTitle}
            </h2>
            <p className="text-gray-400 text-sm">{t("Step 1: Customer Identification")}</p>
          </div>

          {/* Customer Identification */}
          <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">
                {t("Customer Identification")}
              </h3>
            </div>

            {!customerIdentified ? (
              <div className="space-y-4">
                {!customerData ? (
                  <>
                    <p className="text-gray-400 text-sm">
                      {t("Scan customer QR code to identify")}
                    </p>
                    <button
                      onClick={handleStartCustomerScan}
                      disabled={isScanningCustomer}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
                    >
                      {isScanningCustomer ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t("Scanning...")}
                        </>
                      ) : (
                        <>
                          <QrCode className="w-5 h-5" />
                          {t("Scan Customer QR Code")}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    {!customerIdentificationResponse.received ? (
                      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="font-medium">{t("Processing...")}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {t("Identification in progress.")}
                        </p>
                      </div>
                    ) : customerIdentificationResponse.status === "error" ? (
                      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                          <XCircle className="w-5 h-5" />
                          <span className="font-medium">
                            {t("Identification Failed")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {customerIdentificationResponse.data?.error ||
                            t("Customer identification failed. Please try again.")}
                        </p>
                        <button
                          onClick={() => {
                            setCustomerData(null);
                            setCustomerIdentificationResponse({ received: false });
                            handleStartCustomerScan();
                          }}
                          className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                          {t("Retry Scan")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("Customer Identified")}</span>
                </div>
                {customerData && (
                  <div className="bg-gray-600 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t("Customer ID")}:
                      </span>{" "}
                      {formatDisplayValue(customerData.customer_id)}
                    </p>
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">{t("Name")}:</span>{" "}
                      {formatDisplayValue(
                        customerData.name || customerData.product_name
                      )}
                    </p>
                    
                    {/* Payment State */}
                    {paymentState && (
                      <div className="pt-2 border-t border-gray-500">
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">{t("Payment State")}:</span>{" "}
                          <span className={`font-semibold ${
                            paymentState === "CURRENT" ? "text-green-400" :
                            paymentState === "OVERDUE" ? "text-red-400" :
                            "text-yellow-400"
                          }`}>
                            {paymentState}
                          </span>
                        </p>
                      </div>
                    )}
                    
                    {/* Service States */}
                    {serviceStates && serviceStates.length > 0 && (
                      <div className="pt-2 border-t border-gray-500">
                        <p className="text-sm font-medium text-white mb-2">{t("Service States")}:</p>
                        <div className="space-y-2">
                          {serviceStates.map((service, index) => (
                            <div key={index} className="bg-gray-700 rounded-lg p-3 space-y-1">
                              <p className="text-xs text-gray-300">
                                <span className="font-medium text-white">{t("Service ID")}:</span>{" "}
                                {formatDisplayValue(service.service_id)}
                              </p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-300">
                                  <span className="font-medium text-white">{t("Used")}:</span> {service.used}
                                </span>
                                <span className="text-gray-300">
                                  <span className="font-medium text-white">{t("Quota")}:</span> {service.quota.toLocaleString()}
                                </span>
                              </div>
                              {service.current_asset && (
                                <p className="text-xs text-gray-300">
                                  <span className="font-medium text-white">{t("Current Asset")}:</span>{" "}
                                  {formatDisplayValue(service.current_asset)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Equipment Identification (Returning Customers Only) */}
          {customerIdentified && customerType === "returning" && (
            <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
              <div className="flex items-center gap-3 mb-4">
                <Battery className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">
                  {t("Equipment Identification")}
                </h3>
              </div>

              {!equipmentIdentified ? (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    {t("Scan battery barcode to identify")}
                  </p>
                  <button
                    onClick={handleStartEquipmentScan}
                    disabled={isScanningEquipment}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {isScanningEquipment ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t("Scanning...")}
                      </>
                    ) : (
                      <>
                        <QrCode className="w-5 h-5" />
                        {t("Scan Equipment Barcode")}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{t("Equipment Identified")}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Phase A2: Validation
    if (currentPhase === "A2") {
      const stepTitle = customerType === "returning" 
        ? t("Returning Customer Swap")
        : t("First-Time Customer Swap");
      
      return (
        <div className="space-y-6 p-4 max-h-[80vh] overflow-y-auto">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {stepTitle}
            </h2>
            <p className="text-gray-400 text-sm">{t("Step 2: Validation")}</p>
          </div>

          {/* Validation Steps */}
          <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">
                {t("Running Validations...")}
              </h3>
            </div>

            <div className="space-y-3">
              <ValidationItem
                label={t("Customer Status")}
                status={validationStatus.customer}
                isLoading={isRunningValidations}
                details={validationResults.customer}
              />
              <ValidationItem
                label={t("Payment Status")}
                status={validationStatus.payment}
                isLoading={isRunningValidations}
                details={validationResults.payment}
              />
              {equipmentIdentified && (
                <ValidationItem
                  label={t("Equipment Condition")}
                  status={validationStatus.equipment}
                  isLoading={isRunningValidations}
                  details={validationResults.equipment}
                />
              )}
              <ValidationItem
                label={t("Service Quota")}
                status={validationStatus.quota}
                isLoading={isRunningValidations}
                details={validationResults.quota}
              />
            </div>

            {!isRunningValidations &&
              Object.keys(validationStatus).length === 0 && (
              <button
                onClick={handleStartValidations}
                className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
              >
                <Shield className="w-5 h-5" />
                {t("Start Validation")}
              </button>
            )}

            {allValidationsComplete() && (
              <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("All Checks Passed!")}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {t("Proceeding to equipment check-in...")}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Phase A3: Transaction Execution (Checkin & Checkout)
    if (currentPhase === "A3") {
      const stepTitle = customerType === "returning" 
        ? t("Returning Customer Swap")
        : t("First-Time Customer Swap");
      
      return (
        <div className="space-y-6 p-4 max-h-[80vh] overflow-y-auto">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {stepTitle}
            </h2>
            <p className="text-gray-400 text-sm">{t("Step 3: Transaction Execution")}</p>
          </div>

          <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
            {/* Equipment Check-In */}
            {customerType === "returning" && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <Battery className="w-6 h-6 text-orange-300" />
                  <h3 className="text-lg font-semibold text-white">
                    {t("Equipment Check-In")}
                  </h3>
                </div>

                {isRunningPhase3 && phase3Status.checkin === "pending" && (
                  <div className="flex items-center gap-2 text-yellow-400 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("Processing check-in...")}</span>
                  </div>
                )}

                {phase3Status.checkin === "success" && (
                  <div className="flex items-center gap-2 text-green-400 mb-4">
                    <CheckCircle className="w-5 h-5" />
                    <span>{t("Check-in successful")}</span>
                  </div>
                )}

                {checkinEquipmentId && (
                  <div className="bg-gray-600 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t("Equipment ID")}:
                      </span>{" "}
                      {formatDisplayValue(checkinEquipmentId)}
                    </p>
                  </div>
                )}

                {checkinEquipmentId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("Energy at Check-In (kWh)")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={checkinEnergyTransferred}
                      onChange={(e) => setCheckinEnergyTransferred(e.target.value)}
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {t("Enter the energy level of the returned battery")}
                    </p>
                  </div>
                )}

                {phase3Status.checkin !== "success" && (
                  <div className="space-y-3">
                    <button
                      onClick={handleStartCheckinScan}
                      disabled={isScanningCheckin}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                    >
                      {isScanningCheckin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                          <span className="whitespace-nowrap">{t("Scanning...")}</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
                        </>
                      )}
                    </button>
                    {checkinEquipmentId && 
                      (phase3Status.checkin === "pending" || phase3Status.checkin === "error" || phase3Status.checkin === undefined) && (
                      <button
                        onClick={handleEquipmentCheckin}
                        disabled={isRunningPhase3}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <span className="whitespace-nowrap">{t("Process Check-In")}</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Equipment Checkout */}
            {((customerType === "returning" && phase3Status.checkin === "success") ||
              customerType === "first-time") && (
              <>
                <div className="flex items-center gap-3 mb-2 mt-4">
                  <PackageCheck className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">
                    {t("Equipment Checkout")}
                  </h3>
                </div>

                {isRunningPhase3 && phase3Status.checkout === "pending" && (
                  <div className="flex items-center gap-2 text-yellow-400 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("Processing checkout...")}</span>
                  </div>
                )}

                {phase3Status.checkout === "success" && (
                  <div className="flex items-center gap-2 text-green-400 mb-4">
                    <CheckCircle className="w-5 h-5" />
                    <span>{t("Checkout successful")}</span>
                  </div>
                )}

                {checkoutEquipmentId && (
                  <div className="bg-gray-600 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t("Equipment ID")}:
                      </span>{" "}
                      {formatDisplayValue(checkoutEquipmentId)}
                    </p>
                  </div>
                )}

                {checkoutEquipmentId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {customerType === "returning" 
                        ? t("Energy at Checkout (kWh)")
                        : t("Energy Transferred (kWh)")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={checkoutEnergyTransferred}
                      onChange={(e) => setCheckoutEnergyTransferred(e.target.value)}
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {customerType === "returning"
                        ? t("Enter the energy level of the new battery. Energy transferred will be calculated as: Checkout - Check-in")
                        : t("Enter the energy level of the new battery")}
                    </p>
                  </div>
                )}

                {phase3Status.checkout !== "success" && (
                  <div className="space-y-3">
                    <button
                      onClick={handleStartCheckoutScan}
                      disabled={isScanningCheckout}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                    >
                      {isScanningCheckout ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                          <span className="whitespace-nowrap">{t("Scanning...")}</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
                        </>
                      )}
                    </button>
                    {checkoutEquipmentId && 
                      (phase3Status.checkout === "pending" || phase3Status.checkout === "error" || phase3Status.checkout === undefined) && (
                      <button
                        onClick={handleEquipmentCheckout}
                        disabled={isRunningPhase3}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <span className="whitespace-nowrap">{t("Process Checkout")}</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {((customerType === "returning" &&
              phase3Status.checkin === "success" &&
              phase3Status.checkout === "success") ||
              (customerType === "first-time" &&
                phase3Status.checkout === "success")) && (
              <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">{t("Processing and completing swap...")}</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {t("Please wait while we finalize the transaction.")}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // Render modal if swap modal is open
  if (isSwapModalOpen && (customerType === "returning" || customerType === "first-time")) {
    const isSwapComplete = 
      customerType === "returning"
        ? (phase3Status.checkin === "success" && phase3Status.checkout === "success")
        : (phase3Status.checkout === "success");

    const modalTitle = customerType === "returning" 
      ? t("Returning Customer Swap")
      : t("First-Time Customer Swap");

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1D22] border border-gray-700 rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">
              {modalTitle}
            </h2>
            {!isSwapComplete && (
              <button
                onClick={resetFlow}
                className="text-gray-400 hover:text-white bg-gray-800 rounded-full p-1 transition-colors"
                title={t("Cancel")}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {renderModalContent()}
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === "A2" && !isSwapModalOpen) {
    return (
      <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center mb-6">
          {/* <h2 className="text-2xl font-bold text-white mb-2">
            {t("Attendant")}
          </h2> */}
          <p className="text-gray-400">{t("Transaction Execution")}</p>
      </div>

        <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
          {customerType === "returning" && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Battery className="w-6 h-6 text-orange-300" />
                <h3 className="text-lg font-semibold text-white">
                  {t("Equipment Check-In")}
                </h3>
              </div>
              <div className="bg-gray-600 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
                  <span className="text-white text-sm">
                    {t("Receive and process returned equipment")}
            </span>
                  {isRunningPhase3 && phase3Status.checkin === "pending" && (
                    <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                  )}
                  {phase3Status.checkin === "success" && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
          </div>
                {checkinEquipmentId && (
                  <div className="mt-2 p-2 bg-gray-700 rounded text-xs text-gray-300 overflow-hidden">
                    <span className="font-medium">{t("Equipment ID")}:</span>{" "}
                    <span className="break-all inline-block max-w-full">
                      {formatDisplayValue(checkinEquipmentId)}
                    </span>
        </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleStartCheckinScan}
                    disabled={
                      isScanningCheckin || phase3Status.checkin === "success"
                    }
                    className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    {isScanningCheckin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span className="whitespace-nowrap">{t("Scanning...")}</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
                      </>
                    )}
                  </button>
                  {checkinEquipmentId && phase3Status.checkin !== "success" && (
                    <button
                      onClick={handleEquipmentCheckin}
                      disabled={isRunningPhase3}
                      className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                    >
                      <span className="whitespace-nowrap">{t("Process Check-In")}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 mt-4 mb-2">
            <PackageCheck className="w-6 h-6 text-blue-300" />
            <h3 className="text-lg font-semibold text-white">
              {t("Equipment Checkout")}
            </h3>
          </div>
          <div className="bg-gray-600 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">
                {t("Prepare and hand over replacement equipment")}
              </span>
              {isRunningPhase3 && phase3Status.checkout === "pending" && (
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              )}
              {phase3Status.checkout === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
            {checkoutEquipmentId && (
              <div className="mt-2 p-2 bg-gray-700 rounded text-xs text-gray-300 overflow-hidden">
                <span className="font-medium">{t("Equipment ID")}:</span>{" "}
                <span className="break-all inline-block max-w-full">
                  {formatDisplayValue(checkoutEquipmentId)}
                </span>
              </div>
            )}
            {checkoutEquipmentId && (
              <div className="mt-2">
                <label className="block text-sm text-gray-300 mb-1">
                  {t("Energy Transferred (kWh)")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={checkoutEnergyTransferred}
                  onChange={(e) => setCheckoutEnergyTransferred(e.target.value)}
                  placeholder="e.g., 80.0"
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleStartCheckoutScan}
                disabled={
                  isScanningCheckout || phase3Status.checkout === "success"
                }
                className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
              >
                {isScanningCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    <span className="whitespace-nowrap">{t("Scanning...")}</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
                  </>
                )}
              </button>
              {checkoutEquipmentId && phase3Status.checkout !== "success" && (
                <button
                  onClick={handleEquipmentCheckout}
                  disabled={isRunningPhase3}
                  className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                >
                  <span className="whitespace-nowrap">{t("Process Checkout")}</span>
                </button>
              )}
            </div>
          </div>

          {((customerType === "returning" &&
            phase3Status.checkin === "success" &&
            phase3Status.checkout === "success") ||
            (customerType === "first-time" &&
              phase3Status.checkout === "success")) && (
            <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">{t("Processing and completing swap...")}</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                {t("Please wait while we finalize the transaction.")}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setCurrentPhase("A2")}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {t("Back to Validation")}
            </button>
            <button
              onClick={resetFlow}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {t("Reset")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Customer Type Selection Screen
  if (!customerType) {
    return (
      <div className="space-y-6 p-4">
        <div className="text-center mb-6">
          {/* <h2 className="text-2xl font-bold text-white mb-2">
            {t("Battery Swap")}
          </h2> */}
          <p className="text-gray-400">{t("Select Customer Type")}</p>
        </div>

        <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-4">
          <p className="text-gray-300 text-sm mb-4">
            {t(
              "Please select the type of customer to proceed with the battery swap workflow."
            )}
          </p>

          <button
            onClick={() => {
              setCustomerType("first-time");
              setIsSwapModalOpen(true);
              setCurrentPhase("A1");
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02]"
          >
            <UserPlus className="w-6 h-6" />
            <div className="text-left">
              <div className="font-bold">{t("First-Time Customer")}</div>
              <div className="text-sm font-normal opacity-90">
                {t("New customer - No equipment check-in required")}
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setCustomerType("returning");
              setIsSwapModalOpen(true);
              setCurrentPhase("A1");
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02]"
          >
            <User className="w-6 h-6" />
            <div className="text-left">
              <div className="font-bold">{t("Returning Customer")}</div>
              <div className="text-sm font-normal opacity-90">
                {t("Returning customer - Equipment check-in required")}
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center mb-6">
        {/* <h2 className="text-2xl font-bold text-white mb-2">
          {t("Battery Swap")}
        </h2> */}
        <p className="text-gray-400">
          {customerType === "first-time"
            ? t("First-Time Customer - Customer Identification")
            : t("Returning Customer - Customer & Equipment Identification")}
        </p>
      </div>

      {/* Phase A1 - Customer Identification */}
      <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">
            {t("Customer Identification")}
          </h3>
        </div>

        {!customerIdentified ? (
          <div className="space-y-4">
            {!customerData ? (
              <>
            <p className="text-gray-400 text-sm">
              {t("Scan customer QR code to identify")}
            </p>
            <button
              onClick={handleStartCustomerScan}
              disabled={isScanningCustomer}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isScanningCustomer ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("Scanning...")}
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  {t("Scan Customer QR Code")}
                </>
              )}
            </button>
              </>
            ) : (
              <div className="space-y-3">
                {!customerIdentificationResponse.received ? (
                  <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-medium">{t("Processing...")}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t("Identification in progress.")}
                    </p>
                    {customerData && (
                      <div className="mt-3 bg-gray-600 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-gray-300">
                          <span className="font-medium text-white">
                            {t("Scanned ID")}:
                          </span>{" "}
                          {formatDisplayValue(customerData.customer_id)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : customerIdentificationResponse.status === "error" ? (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">
                        {t("Identification Failed")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {customerIdentificationResponse.data?.error ||
                        t("Customer identification failed. Please try again.")}
                    </p>
                    <button
                      onClick={() => {
                        setCustomerData(null);
                        setCustomerIdentificationResponse({ received: false });
                        handleStartCustomerScan();
                      }}
                      className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                      {t("Retry Scan")}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{t("Customer Identified")}</span>
            </div>
            {customerData && (
              <div className="bg-gray-600 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">
                    {t("Customer ID")}:
                  </span>{" "}
                  {formatDisplayValue(customerData.customer_id)}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">{t("Name")}:</span>{" "}
                  {formatDisplayValue(
                    customerData.name || customerData.product_name
                  )}
                </p>
                {customerData.subscription_code && (
                <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">
                      {t("Subscription")}:
                    </span>{" "}
                    {formatDisplayValue(customerData.subscription_code)}
                  </p>
                )}
                
                {/* Payment State */}
                {paymentState && (
                  <div className="pt-2 border-t border-gray-500">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">{t("Payment State")}:</span>{" "}
                      <span className={`font-semibold ${
                        paymentState === "CURRENT" ? "text-green-400" :
                        paymentState === "OVERDUE" ? "text-red-400" :
                        "text-yellow-400"
                      }`}>
                        {paymentState}
                      </span>
                    </p>
                  </div>
                )}
                
                {/* Service States */}
                {serviceStates && serviceStates.length > 0 && (
                  <div className="pt-2 border-t border-gray-500">
                    <p className="text-sm font-medium text-white mb-2">{t("Service States")}:</p>
                    <div className="space-y-2">
                      {serviceStates.map((service, index) => (
                        <div key={index} className="bg-gray-700 rounded-lg p-3 space-y-1">
                          <p className="text-xs text-gray-300">
                            <span className="font-medium text-white">{t("Service ID")}:</span>{" "}
                            {formatDisplayValue(service.service_id)}
                          </p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">
                              <span className="font-medium text-white">{t("Used")}:</span> {service.used}
                            </span>
                            <span className="text-gray-300">
                              <span className="font-medium text-white">{t("Quota")}:</span> {service.quota.toLocaleString()}
                            </span>
                          </div>
                          {service.current_asset && (
                            <p className="text-xs text-gray-300">
                              <span className="font-medium text-white">{t("Current Asset")}:</span>{" "}
                              {formatDisplayValue(service.current_asset)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase A1 - Equipment Identification (Returning Customers Only) */}
      {customerType === "returning" && (
      <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
        <div className="flex items-center gap-3 mb-4">
          <Battery className="w-6 h-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">
              {t("Equipment Identification")}
          </h3>
        </div>

        {!equipmentIdentified ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              {t("Scan battery barcode to identify")}
            </p>
            <button
              onClick={handleStartEquipmentScan}
                disabled={isScanningEquipment || !customerIdentified}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isScanningEquipment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("Scanning...")}
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  {t("Scan Equipment Barcode")}
                </>
              )}
            </button>
              {!customerIdentified && (
                <p className="text-xs text-gray-400">
                  {customerData && !customerIdentificationResponse.received
                    ? t("Waiting for customer identification response...")
                    : customerIdentificationResponse.status === "error"
                    ? t("Customer identification failed. Please retry.")
                    : t("Scan customer first to enable equipment scan")}
                </p>
              )}
              {equipmentData && !equipmentIdentificationResponse.received && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-xs">{t("Waiting for equipment identification response...")}</p>
                </div>
              )}
              {equipmentIdentificationResponse.received && equipmentIdentificationResponse.status === "error" && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium text-sm">{t("Equipment identification failed")}</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    {equipmentIdentificationResponse.data?.error || t("Please retry scanning the equipment.")}
                  </p>
                  <button
                    onClick={handleStartEquipmentScan}
                    className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-200"
                  >
                    {t("Retry Scan")}
                  </button>
                </div>
              )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{t("Equipment Identified")}</span>
            </div>
            {equipmentData && (
                <div className="bg-gray-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm text-gray-300 break-words max-w-full">
                    <span className="font-medium text-white">
                      {t("Equipment ID")}:
                    </span>{" "}
                    <span className="break-all inline-block max-w-full">
                      {formatDisplayValue(equipmentData)}
                    </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Action Buttons */}
      {customerIdentified && (customerType === "first-time" || equipmentIdentified) && (
        <div className="flex gap-3">
          <button
            onClick={resetFlow}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            {t("Reset")}
          </button>
          <button
            onClick={handleProceedToA2}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            {t("Validation")}
          </button>
        </div>
      )}
    </div>
  );
};

export default Swap;
// "use client";

// import React, { useState, useEffect, useCallback, useRef } from "react";
// // import { toast } from "react-hot-toast";
// import {
//   Camera,
//   Loader2,
//   CheckCircle,
//   XCircle,
//   Battery,
//   User,
//   UserPlus,
//   QrCode,
//   Shield,
//   PackageCheck,
//   AlertTriangle,
// } from "lucide-react";
// import { useBridge } from "@/app/context/bridgeContext";
// import { useI18n } from "@/i18n";

// // ABS topics use hardcoded payloads as per docs; publish via bridge like BLE page..
// // PLAN_ID is now dynamically set from subscription_code in scanned QR code
// const ATTENDANT_ID = "attendant-001";
// const STATION = "STATION_001";

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

// declare global {
//   interface Window {
//     WebViewJavascriptBridge?: WebViewJavascriptBridge;
//   }
// }

// interface SwapProps {
//   customer: {
//     id?: number;
//     name?: string;
//     email?: string;
//     partner_id?: number;
//     company_id?: number;
//   } | null;
// }

// const Swap: React.FC<SwapProps> = ({ customer }) => {
//   const { t } = useI18n();
//   const { bridge } = useBridge();
//   const [currentPhase, setCurrentPhase] = useState<"A1" | "A2" | "A3" | "A4">(
//     "A1"
//   );
//   const [customerType, setCustomerType] = useState<
//     "first-time" | "returning" | null
//   >(null);
//   const [customerData, setCustomerData] = useState<any>(null);
//   const [equipmentData, setEquipmentData] = useState<any>(null);
//   const [isScanningCustomer, setIsScanningCustomer] = useState<boolean>(false);
//   const [isScanningEquipment, setIsScanningEquipment] =
//     useState<boolean>(false);
//   const [isScanningCheckin, setIsScanningCheckin] = useState<boolean>(false);
//   const [isScanningCheckout, setIsScanningCheckout] = useState<boolean>(false);
//   const [customerIdentified, setCustomerIdentified] = useState<boolean>(false);
//   const [customerIdentificationResponse, setCustomerIdentificationResponse] =
//     useState<{
//       received: boolean;
//       status?: "success" | "error";
//       data?: any;
//     }>({ received: false });
//   const [equipmentIdentified, setEquipmentIdentified] =
//     useState<boolean>(false);
//   const [equipmentIdentificationResponse, setEquipmentIdentificationResponse] =
//     useState<{
//       received: boolean;
//       status?: "success" | "error";
//       data?: any;
//     }>({ received: false });
//   const [checkinEquipmentId, setCheckinEquipmentId] = useState<string | null>(
//     null
//   );
//   const [checkoutEquipmentId, setCheckoutEquipmentId] = useState<string | null>(
//     null
//   );
//   const [checkoutEnergyTransferred, setCheckoutEnergyTransferred] = useState<string>("");
//   const [dynamicPlanId, setDynamicPlanId] = useState<string>(""); // Will be set from subscription_code in QR code
  
//   // Phase A2 validation states
//   const [validationStatus, setValidationStatus] = useState<{
//     customer?: "pending" | "success" | "error";
//     payment?: "pending" | "success" | "error";
//     equipment?: "pending" | "success" | "error";
//     quota?: "pending" | "success" | "error";
//   }>({});
//   const [isRunningValidations, setIsRunningValidations] =
//     useState<boolean>(false);
//   const [validationResults, setValidationResults] = useState<any>({});
//   // Phase A3 states (Transaction Execution)
//   const [isRunningPhase3, setIsRunningPhase3] = useState<boolean>(false);
//   const [phase3Status, setPhase3Status] = useState<{
//     checkin?: "pending" | "success" | "error";
//     checkout?: "pending" | "success" | "error";
//   }>({});
//   // Phase A4 states (Reporting)
//   const [isRunningPhase4, setIsRunningPhase4] = useState<boolean>(false);
//   const [phase4Status, setPhase4Status] = useState<{
//     activity?: "pending" | "success" | "error";
//     usage?: "pending" | "success" | "error";
//   }>({});
  
//   const bridgeInitRef = useRef(false);
//   const scanTypeRef = useRef<
//     "customer" | "equipment" | "checkin" | "checkout" | null
//   >(null);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

//   const formatDisplayValue = (value?: string | number, fallback?: string) => {
//     if (value === undefined || value === null || value === "") {
//       return fallback ?? t("N/A");
//     }
//     const strValue = String(value);
//     return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
//   };

//   const mqttPublish = useCallback(
//     (topic: string, content: any) => {
//       if (!window.WebViewJavascriptBridge) {
//         // toast.error(t("MQTT disconnected"));
//         return;
//       }
//       try {
//         const dataToPublish = { topic, qos: 0, content };
//         // toast(t("Publishing to") + ` ${topic}`);
//         window.WebViewJavascriptBridge.callHandler(
//           "mqttPublishMsg",
//           JSON.stringify(dataToPublish),
//           (resp: any) => {
//             try {
//               const r = typeof resp === "string" ? JSON.parse(resp) : resp;
//               // Expecting respCode/respDesc shape from native layer
//               if (r?.respCode === "200" || r?.respData === true) {
//                 // toast.success(t("Published to") + ` ${topic}`);
//               } else {
//                 // toast.error((r?.respDesc as string) || t("Publish failed"));
//               }
//             } catch {
//               // Unknown response, still consider it attempted
//               // toast.success(t("Published to") + ` ${topic}`);
//             }
//           }
//         );
//       } catch (err) {
//         // toast.error(t("Publish failed"));
//       }
//     },
//     [t]
//   );

//   type ValidationStepKey = "customer" | "payment" | "equipment" | "quota";

//   interface ValidationStepConfig {
//     key: ValidationStepKey;
//     requestTopic: string;
//     correlationPrefix: string;
//     buildPayload: (correlationId: string) => any;
//     requiredSignals?: string[];
//     responseTopic?: string;
//     timeoutMs?: number;
//   }

//   const runValidationStep = useCallback(
//     (config: ValidationStepConfig) => {
//       if (!bridge) {
//         return Promise.reject({
//           message: "Bridge not available for MQTT operations",
//         });
//       }

//       const correlationId = `${config.correlationPrefix}-${Date.now()}-${Math.random()
//         .toString(36)
//         .slice(2, 9)}`;

//       const responseTopic = config.responseTopic ?? "echo/#";
//       const payload = config.buildPayload(correlationId);
//       const dataToPublish = {
//         topic: config.requestTopic,
//         qos: 0,
//         content: payload,
//       };

//       console.info("=== Validation MQTT ===");
//       console.info("Step:", config.key);
//       console.info("Request Topic:", config.requestTopic);
//       console.info("Correlation ID:", correlationId);
//       console.info("Payload:", JSON.stringify(payload, null, 2));

//       return new Promise<any>((resolve, reject) => {
//         const correlationKey = `__validationCorrelation_${config.key}`;
//         (window as any)[correlationKey] = correlationId;

//         let settled = false;

//         const cleanup = () => {
//           if (settled) return;
//           settled = true;
//           clearTimeout(timeoutId);
//           (window as any)[correlationKey] = null;
//           deregister();
//           try {
//             bridge.callHandler(
//               "mqttUnSubTopic",
//               { topic: responseTopic, qos: 0 },
//               () => {}
//             );
//           } catch (err) {
//             console.warn("Validation unsubscribe error", err);
//           }
//         };

//         const reg = (name: string, handler: any) => {
//           bridge.registerHandler(name, handler);
//           return () => bridge.registerHandler(name, () => {});
//         };

//         const handleIncomingMessage = (
//           data: string,
//           responseCallback: (response: any) => void
//         ) => {
//           try {
//             const parsedData = JSON.parse(data);
//             const topic = parsedData.topic;
//             const rawMessage = parsedData.message;

//             // Check if this is a response topic
//             // If responseTopic is a wildcard (contains #), check prefix match
//             // Otherwise, check for exact match
//             const isWildcard = responseTopic.includes("#");
//             const isResponseTopic = topic && (
//               isWildcard
//                 ? (topic.startsWith(responseTopic.replace("#", "").replace("+", "")) || 
//                    (responseTopic.includes("echo/") && topic.startsWith("echo/")) ||
//                    (responseTopic.includes("rtrn/") && topic.startsWith("rtrn/")))
//                 : topic === responseTopic
//             );
            
//             console.info(`[${config.key}] Received message on topic: ${topic}, isResponseTopic: ${isResponseTopic}, expected: ${responseTopic}`);
            
//             if (isResponseTopic) {
//               let responseData: any;
//               try {
//                 responseData =
//                   typeof rawMessage === "string"
//                     ? JSON.parse(rawMessage)
//                     : rawMessage;
//               } catch (err) {
//                 responseData = rawMessage;
//               }

//               console.info("=== Validation MQTT Response ===");
//               console.info("Step:", config.key);
//               console.info("Response Topic:", topic);
//               console.info("Expected Response Topic Pattern:", responseTopic);
//               console.info("Response Payload:", JSON.stringify(responseData, null, 2));

//               const storedCorrelationId = (window as any)[correlationKey];
//               const responseCorrelationId =
//                 responseData?.correlation_id ||
//                 responseData?.metadata?.correlation_id;

//               console.info(`[${config.key}] Stored Correlation ID:`, storedCorrelationId);
//               console.info(`[${config.key}] Response Correlation ID:`, responseCorrelationId);
//               console.info(`[${config.key}] Settled status:`, settled);

//               // Don't process if already settled
//               if (settled) {
//                 console.warn(`[${config.key}] Handler already settled, ignoring response`);
//                 responseCallback({ success: true });
//                 return;
//               }

//               const correlationMatches =
//                 Boolean(storedCorrelationId) &&
//                 Boolean(responseCorrelationId) &&
//                 (responseCorrelationId === storedCorrelationId ||
//                   responseCorrelationId.startsWith(storedCorrelationId) ||
//                   storedCorrelationId.startsWith(responseCorrelationId));

//               console.info(`[${config.key}] Correlation matches:`, correlationMatches);

//               if (correlationMatches && !settled) {
//                 const successFlag =
//                   responseData?.success === true ||
//                   responseData?.data?.success === true ||
//                   responseData?.metadata?.success === true;

//                 const collectedSignals = new Set<string>();
//                 const pushSignals = (signals?: any) => {
//                   if (Array.isArray(signals)) {
//                     signals.forEach((signal) => {
//                       if (typeof signal === "string") {
//                         collectedSignals.add(signal);
//                       }
//                     });
//                   }
//                 };
//                 pushSignals(responseData?.signals);
//                 pushSignals(responseData?.data?.signals);
//                 pushSignals(responseData?.metadata?.signals);

//                 const hasRequiredSignal =
//                   !config.requiredSignals ||
//                   config.requiredSignals.some((signal) =>
//                     collectedSignals.has(signal)
//                   );

//                 if (successFlag && hasRequiredSignal) {
//                   cleanup();
//                   resolve(responseData);
//                 } else {
//                   const bestError =
//                     responseData?.data?.error ||
//                     responseData?.error ||
//                     responseData?.data?.message ||
//                     responseData?.message ||
//                     (!successFlag
//                       ? "Validation failed: success flag false"
//                       : "Validation failed: required signals missing");

//                   cleanup();
//                   reject({
//                     message: bestError,
//                     response: responseData,
//                   });
//                 }
//               }

//               responseCallback({ success: true });
//             }
//           } catch (err: any) {
//             console.error("Validation response parse error", err);
//             responseCallback({ success: false, error: err?.message });
//           }
//         };

//         const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);

//         const timeoutId = window.setTimeout(() => {
//           if (!settled) {
//             console.warn(`Validation timeout for step: ${config.key}`);
//             cleanup();
//             reject({
//               message: "Validation timed out",
//             });
//           }
//         }, config.timeoutMs ?? 30000);

//         const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
//           bridge.callHandler(
//             "mqttSubTopic",
//             { topic: responseTopic, qos: 0 },
//             (subscribeResponse: any) => {
//               try {
//                 const subResp =
//                   typeof subscribeResponse === "string"
//                     ? JSON.parse(subscribeResponse)
//                     : subscribeResponse;
//                 const errorMessage =
//                   (subResp?.respDesc || subResp?.error || "").toString();
//                 const isConnectionError = errorMessage
//                   .toLowerCase()
//                   .includes("not connected") ||
//                   errorMessage.toLowerCase().includes("disconnected");

//                 if (subResp?.respCode === "200") {
//                   console.info(`[${config.key}] Successfully subscribed to ${responseTopic}`);
//                   setTimeout(() => {
//                     try {
//                       console.info(`[${config.key}] Publishing to ${config.requestTopic}`);
//                       bridge.callHandler(
//           "mqttPublishMsg",
//           JSON.stringify(dataToPublish),
//                         (publishResponse: any) => {
//                           try {
//                             const pubResp =
//                               typeof publishResponse === "string"
//                                 ? JSON.parse(publishResponse)
//                                 : publishResponse;
//                             const pubMessage =
//                               (pubResp?.respDesc || pubResp?.error || "").toString();
//                             const pubConnectionError = pubMessage
//                               .toLowerCase()
//                               .includes("not connected") ||
//                               pubMessage.toLowerCase().includes("disconnected");

//                             if (pubResp?.error || pubResp?.respCode !== "200") {
//                               if (pubConnectionError && retryCount < maxRetries) {
//                                 setTimeout(() => {
//                                   attemptMqttOperations(retryCount + 1, maxRetries);
//                                 }, 1000);
//                               } else {
//                                 cleanup();
//                                 reject({
//                                   message: pubMessage || "Publish failed",
//                                 });
//                               }
//                             }
//                           } catch (err) {
//                             console.error(
//                               "Validation publish response parse error",
//                               err
//                             );
//                           }
//           }
//         );
//       } catch (err) {
//                       console.error("Validation publish error", err);
//                       if (retryCount < maxRetries) {
//                         setTimeout(() => {
//                           attemptMqttOperations(retryCount + 1, maxRetries);
//                         }, 1000);
//                       } else {
//                         cleanup();
//                         reject({
//                           message: "Error calling mqttPublishMsg",
//                         });
//                       }
//                     }
//                   }, 300);
//                 } else if (isConnectionError && retryCount < maxRetries) {
//                   setTimeout(() => {
//                     attemptMqttOperations(retryCount + 1, maxRetries);
//                   }, 1000);
//                 } else {
//                   cleanup();
//                   reject({
//                     message: errorMessage || "Subscribe failed",
//                   });
//                 }
//               } catch (err) {
//                 console.error("Validation subscribe response parse error", err);
//                 if (retryCount < maxRetries) {
//                   setTimeout(() => {
//                     attemptMqttOperations(retryCount + 1, maxRetries);
//                   }, 1000);
//                 } else {
//                   cleanup();
//                   reject({
//                     message: "Error parsing subscribe response",
//                   });
//                 }
//               }
//             }
//           );
//         };

//         attemptMqttOperations();
//       });
//     },
//     [bridge]
//   );

//   const handleCustomerIdentification = useCallback(
//     (qrCodeData: string) => {
//       if (!bridge) {
//         console.error("Bridge not available for MQTT operations");
//         setCustomerIdentificationResponse({
//           received: true,
//           status: "error",
//           data: { error: "Bridge not available" },
//         });
//         return;
//       }

//       setIsScanningCustomer(false);
//       setCustomerIdentificationResponse({ received: false });

//       let parsedData: any = qrCodeData;
//       try {
//         const maybeParsed = JSON.parse(qrCodeData);
//         if (maybeParsed && typeof maybeParsed === "object") {
//           parsedData = maybeParsed;
//         }
//       } catch (err) {
//         parsedData = qrCodeData;
//       }

//       const normalizedData: any = {
//         customer_id:
//           typeof parsedData === "object"
//             ? parsedData.customer_id ||
//               parsedData.customerId ||
//               parsedData.customer?.id ||
//               qrCodeData
//             : qrCodeData,
//         subscription_code:
//           typeof parsedData === "object"
//             ? parsedData.subscription_code ||
//               parsedData.subscriptionCode ||
//               parsedData.subscription?.code
//             : undefined,
//         product_name:
//           typeof parsedData === "object"
//             ? parsedData.product_name ||
//               parsedData.productName ||
//               parsedData.product?.name
//             : undefined,
//         name:
//           typeof parsedData === "object"
//             ? parsedData.name || parsedData.customer_name
//             : undefined,
//         raw: qrCodeData,
//       };

//       setCustomerData(normalizedData);

//       // Extract subscription_code and use it as plan_id
//       const subscriptionCode = normalizedData.subscription_code;
//       if (!subscriptionCode) {
//         console.error("No subscription_code found in QR code");
//         setCustomerIdentificationResponse({
//           received: true,
//           status: "error",
//           data: { error: "QR code missing subscription_code. Please scan a valid QR code." },
//         });
//         return;
//       }

//       // Set subscription_code as plan_id for all MQTT operations
//       setDynamicPlanId(subscriptionCode);
//       console.info("Using subscription_code as plan_id:", subscriptionCode);

//       // Use subscription_code as plan_id
//       const currentPlanId = subscriptionCode;

//       // Extract customer_id for qr_code_data
//       const customerId = normalizedData.customer_id;
//       // Format qr_code_data as "QR_CUSTOMER_TEST_" followed by customer_id
//       const formattedQrCodeData = `QR_CUSTOMER_TEST_${customerId}`;

//       // Generate unique correlation ID for this request
//       const correlationId = `att-customer-id-${Date.now()}-${Math.random()
//         .toString(36)
//         .substr(2, 9)}`;

//       // Publish to MQTT with logging
//       const requestTopic = `emit/uxi/attendant/plan/${currentPlanId}/identify_customer`;
//       const responseTopic = `echo/abs/service/plan/${currentPlanId}/identify_customer`;

//       const payload = {
//         timestamp: new Date().toISOString(),
//         plan_id: currentPlanId,
//         correlation_id: correlationId,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "IDENTIFY_CUSTOMER",
//           qr_code_data: formattedQrCodeData,
//           attendant_station: STATION,
//         },
//       };

//       const dataToPublish = {
//         topic: requestTopic,
//         qos: 0,
//         content: payload,
//       };

//       console.info("=== Customer Identification MQTT ===");
//       console.info("Request Topic:", requestTopic);
//       console.info("Response Topic:", responseTopic);
//       console.info("Payload:", JSON.stringify(payload, null, 2));
//       console.info("Correlation ID:", correlationId);

//       const reg = (name: string, handler: any) => {
//         bridge.registerHandler(name, handler);
//         return () => bridge.registerHandler(name, () => {});
//       };

//       const offResponseHandler = reg(
//         "mqttMsgArrivedCallBack",
//         (data: string, responseCallback: (response: any) => void) => {
//           try {
//             const parsedData = JSON.parse(data);
//             console.info("Received MQTT arrived callback data:", parsedData);

//             const message = parsedData;
//             const topic = message.topic;
//             const rawMessageContent = message.message;

//             // Check if this is the specific customer identification response topic
//             // Use currentPlanId from closure (subscriptionCode || dynamicPlanId)
//             const expectedResponseTopic = `echo/abs/service/plan/${currentPlanId}/identify_customer`;
//             if (topic && topic === expectedResponseTopic) {
//               console.info(
//                 "Response received from customer identification topic:",
//                 JSON.stringify(message, null, 2)
//               );

//               let responseData;
//               try {
//                 responseData =
//                   typeof rawMessageContent === "string"
//                     ? JSON.parse(rawMessageContent)
//                     : rawMessageContent;
//               } catch (parseErr) {
//                 responseData = rawMessageContent;
//               }

//               console.info("=== Customer Identification MQTT Response ===");
//               console.info(
//                 "Full Response Data:",
//                 JSON.stringify(responseData, null, 2)
//               );
//               console.info("Response Topic:", topic);

//               // Check if this response matches our customer identification request
//               const storedCorrelationId = (window as any)
//                 .__customerIdentificationCorrelationId;
//               const responseCorrelationId =
//                 responseData?.correlation_id ||
//                 responseData?.metadata?.correlation_id;

//               console.info("Stored Correlation ID:", storedCorrelationId);
//               console.info("Response Correlation ID:", responseCorrelationId);

//               const correlationMatches =
//                 Boolean(storedCorrelationId) &&
//                 Boolean(responseCorrelationId) &&
//                 (responseCorrelationId === storedCorrelationId ||
//                   responseCorrelationId.startsWith(storedCorrelationId) ||
//                   storedCorrelationId.startsWith(responseCorrelationId));

//               if (correlationMatches) {
//                 console.info(
//                   "Correlation ID matches! Processing customer identification response"
//                 );

//                 // Check for success and required signals in response
//                 const success = responseData?.success ?? responseData?.data?.success ?? false;
//                 const signals =
//                   responseData?.signals ||
//                   responseData?.data?.signals ||
//                   responseData?.metadata?.signals ||
//                   [];
//                 console.info("Response success:", success);
//                 console.info("Response signals:", signals);

//                 // Check if response contains success: true and required signal
//                 const hasRequiredSignal =
//                   success === true &&
//                   Array.isArray(signals) &&
//                   signals.includes("CUSTOMER_IDENTIFIED_SUCCESS");

//                 console.info(
//                   "Response has required signal:",
//                   hasRequiredSignal
//                 );
//                 console.info("Signals found:", signals);

//                 if (hasRequiredSignal) {
//                   console.info(
//                     "Customer identification successful! Required signal found in response."
//                   );
//                   setCustomerIdentificationResponse({
//                     received: true,
//                     status: "success",
//                     data: responseData,
//                   });
//                   setCustomerIdentified(true);
//                   // Clear the stored correlation ID
//                   (window as any).__customerIdentificationCorrelationId = null;
//                   // Cleanup handler after successful response
//                   setTimeout(() => {
//                     offResponseHandler();
//                   }, 1000);
//                 } else {
//                   console.warn(
//                     "Customer identification response does not contain required signals"
//                   );

//                   const errorMessage = "Customer identification failed.";

//                   console.error("Error details:", errorMessage);

//                   setCustomerIdentificationResponse({
//                     received: true,
//                     status: "error",
//                     data: { ...responseData, error: errorMessage },
//                   });

//                   // Clear the stored correlation ID
//                   (window as any).__customerIdentificationCorrelationId = null;
//                 }
//               } else {
//                 console.info(
//                   "Correlation ID does not match, ignoring this message"
//                 );
//               }
//               responseCallback({ success: true });
//             }
//           } catch (err) {
//             console.error("Error parsing MQTT arrived callback:", err);
//             responseCallback({ success: false, error: err });
//           }
//         }
//       );

//       // Store correlation ID for response matching
//       (window as any).__customerIdentificationCorrelationId = correlationId;

//       // Attempt MQTT operations with retry on connection errors
//       const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
//         console.info(
//           `=== Attempting MQTT Operations (Attempt ${retryCount + 1}/${
//             maxRetries + 1
//           }) ===`
//         );

//         let subscribeSuccess = false;
//         let publishSuccess = false;

//         // Subscribe to response topic first (like rider code)
//         bridge.callHandler(
//           "mqttSubTopic",
//           { topic: responseTopic, qos: 0 },
//           (subscribeResponse) => {
//             console.info("MQTT subscribe response:", subscribeResponse);
//             try {
//               const subResp =
//                 typeof subscribeResponse === "string"
//                   ? JSON.parse(subscribeResponse)
//                   : subscribeResponse;
//               const errorMessage = subResp.respDesc || subResp.error || "";
//               const isConnectionError =
//                 errorMessage.toLowerCase().includes("not connected") ||
//                 errorMessage.toLowerCase().includes("disconnected");

//               if (subResp.respCode === "200") {
//                 console.info("Subscribed to response topic successfully");
//                 subscribeSuccess = true;

//                 // Wait a moment after subscribe before publishing
//                 setTimeout(() => {
//                   // Then publish
//                   try {
//                     bridge.callHandler(
//                       "mqttPublishMsg",
//                       JSON.stringify(dataToPublish),
//                       (response) => {
//                         console.info("MQTT publish response:", response);
//                         try {
//                           const responseData =
//                             typeof response === "string"
//                               ? JSON.parse(response)
//                               : response;
//                           const pubErrorMessage =
//                             responseData.respDesc || responseData.error || "";
//                           const isPubConnectionError =
//                             pubErrorMessage
//                               .toLowerCase()
//                               .includes("not connected") ||
//                             pubErrorMessage
//                               .toLowerCase()
//                               .includes("disconnected");

//                           if (
//                             responseData.error ||
//                             responseData.respCode !== "200"
//                           ) {
//                             if (
//                               isPubConnectionError &&
//                               retryCount < maxRetries
//                             ) {
//                               console.warn(
//                                 `MQTT publish connection error. Retrying in 1 second... (${
//                                   retryCount + 1
//                                 }/${maxRetries})`
//                               );
//                               setTimeout(() => {
//                                 attemptMqttOperations(
//                                   retryCount + 1,
//                                   maxRetries
//                                 );
//                               }, 1000);
//                             } else {
//                               console.error(
//                                 "MQTT publish error:",
//                                 pubErrorMessage || "Unknown error"
//                               );
//                               setCustomerIdentificationResponse({
//                                 received: true,
//                                 status: "error",
//                                 data: {
//                                   error: pubErrorMessage || "Publish failed",
//                                 },
//                               });
//                             }
//                           } else {
//                             console.info("MQTT request published successfully");
//                             publishSuccess = true;
//                           }
//                         } catch (err) {
//                           console.error(
//                             "Error parsing MQTT publish response:",
//                             err
//                           );
//                         }
//                       }
//                     );
//                   } catch (err) {
//                     console.error("Error calling mqttPublishMsg:", err);
//                     if (retryCount < maxRetries) {
//                       setTimeout(() => {
//                         attemptMqttOperations(retryCount + 1, maxRetries);
//                       }, 1000);
//                     } else {
//                       setCustomerIdentificationResponse({
//                         received: true,
//                         status: "error",
//                         data: { error: "Error calling mqttPublishMsg" },
//                       });
//                     }
//                   }
//                 }, 300);
//               } else if (isConnectionError && retryCount < maxRetries) {
//                 console.warn(
//                   `MQTT subscribe connection error. Retrying in 1 second... (${
//                     retryCount + 1
//                   }/${maxRetries})`
//                 );
//                 setTimeout(() => {
//                   attemptMqttOperations(retryCount + 1, maxRetries);
//                 }, 1000);
//               } else {
//                 console.error(
//                   "Subscribe failed:",
//                   errorMessage || "Unknown error"
//                 );
//                 setCustomerIdentificationResponse({
//                   received: true,
//                   status: "error",
//                   data: { error: errorMessage || "Subscribe failed" },
//                 });
//               }
//             } catch (err) {
//               console.error("Error parsing subscribe response:", err);
//               if (retryCount < maxRetries) {
//                 setTimeout(() => {
//                   attemptMqttOperations(retryCount + 1, maxRetries);
//                 }, 1000);
//               } else {
//                 setCustomerIdentificationResponse({
//                   received: true,
//                   status: "error",
//                   data: { error: "Error parsing subscribe response" },
//                 });
//               }
//             }
//           }
//         );
//       };

//       // Start attempting operations - will retry on connection errors
//       setTimeout(() => {
//         attemptMqttOperations();
//       }, 500);

//       // Note: No automatic cleanup timeout here - handler cleans up when response is received
//       // or when validation steps complete. This prevents interference with validation handlers
//       // that also subscribe to echo/#.
//     },
//     [bridge, t, dynamicPlanId]
//   );

//   const handleEquipmentIdentification = useCallback(
//     (equipmentBarcode: string) => {
//       if (!bridge) {
//         console.error("Bridge not available for MQTT operations");
//         setEquipmentIdentificationResponse({ received: true, status: "error", data: { error: "Bridge not available" } });
//         return;
//       }

//       if (!dynamicPlanId) {
//         console.error("Plan ID not set. Customer identification must be completed first.");
//         setEquipmentIdentificationResponse({ received: true, status: "error", data: { error: "Customer identification required first" } });
//         return;
//       }

//       setIsScanningEquipment(false);
//       setEquipmentIdentificationResponse({ received: false });

//       // Normalize equipment data - extract ID if JSON, otherwise use raw string
//       let parsedData: any = equipmentBarcode;
//       try {
//         const maybeParsed = JSON.parse(equipmentBarcode);
//         if (maybeParsed && typeof maybeParsed === "object") {
//           parsedData = maybeParsed;
//         }
//       } catch (err) {
//         parsedData = equipmentBarcode;
//       }

//       // Extract equipment ID from various possible formats
//       let normalizedEquipmentId: string;
//       if (typeof parsedData === "object") {
//         normalizedEquipmentId =
//           parsedData.equipment_id ||
//           parsedData.equipmentId ||
//           parsedData.id ||
//           parsedData.barcode ||
//           equipmentBarcode;
//       } else {
//         normalizedEquipmentId = equipmentBarcode;
//       }

//       // Ensure it's always a string
//       const equipmentIdString = String(normalizedEquipmentId || "");
      
//       // Remove any existing prefix if present (e.g., "BAT_NEW_ATT_" or "BAT_RETURN_ATT_")
//       // const cleanEquipmentId = equipmentIdString.replace(/^BAT_(NEW|RETURN)_ATT_/i, '');
      
//       // Format equipment ID with BAT_NEW_ATT_ prefix for equipment identification
//       const formattedEquipmentId = `BAT_NEW_ATT_${equipmentIdString}`;
      
//       setEquipmentData(equipmentIdString); // Store original for display
      
//       // Generate unique correlation ID for this request
//       const correlationId = `att-equipment-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
//       // Publish to MQTT with logging
//       const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/identify_equipment`;
//       const responseTopic = `echo/abs/service/plan/${dynamicPlanId}/identify_equipment`;
      
//       const payload = {
//         timestamp: new Date().toISOString(),
//         plan_id: dynamicPlanId,
//         correlation_id: correlationId,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "IDENTIFY_RETURNED_EQUIPMENT",
//           equipment_id: formattedEquipmentId,
//           attendant_station: STATION,
//         },
//       };

//       const dataToPublish = {
//         topic: requestTopic,
//         qos: 0,
//         content: payload,
//       };

//       console.info("=== Equipment Identification MQTT ===");
//       console.info("Request Topic:", requestTopic);
//       console.info("Response Topic:", responseTopic);
//       console.info("Payload:", JSON.stringify(payload, null, 2));
//       console.info("Correlation ID:", correlationId);

//       const reg = (name: string, handler: any) => {
//         bridge.registerHandler(name, handler);
//         return () => bridge.registerHandler(name, () => {});
//       };

//       const offResponseHandler = reg(
//         "mqttMsgArrivedCallBack",
//         (data: string, responseCallback: (response: any) => void) => {
//           try {
//             const parsedData = JSON.parse(data);
//             console.info("Received MQTT arrived callback data:", parsedData);

//             const message = parsedData;
//             const topic = message.topic;
//             const rawMessageContent = message.message;

//             // Check if this is the specific equipment identification response topic
//             const expectedResponseTopic = `echo/abs/service/plan/${dynamicPlanId}/identify_equipment`;
//             if (topic && topic === expectedResponseTopic) {
//               console.info("Response received from equipment identification topic:", JSON.stringify(message, null, 2));
              
//               let responseData;
//               try {
//                 responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
//               } catch (parseErr) {
//                 responseData = rawMessageContent;
//               }

//               console.info("=== Equipment Identification MQTT Response ===");
//               console.info("Full Response Data:", JSON.stringify(responseData, null, 2));
//               console.info("Response Topic:", topic);

//               // Check if this response matches our equipment identification request
//               const storedCorrelationId = (window as any).__equipmentIdentificationCorrelationId;
//               const responseCorrelationId = responseData?.correlation_id || responseData?.metadata?.correlation_id;

//               console.info("Stored Correlation ID:", storedCorrelationId);
//               console.info("Response Correlation ID:", responseCorrelationId);

//               const correlationMatches =
//                 Boolean(storedCorrelationId) &&
//                 Boolean(responseCorrelationId) &&
//                 (responseCorrelationId === storedCorrelationId ||
//                   responseCorrelationId.startsWith(storedCorrelationId) ||
//                   storedCorrelationId.startsWith(responseCorrelationId));

//               if (correlationMatches) {
//                 console.info("Correlation ID matches! Processing equipment identification response");

//                 // Check for success and required signals in response
//                 const success = responseData?.success ?? responseData?.data?.success ?? false;
//                 const signals =
//                   responseData?.signals ||
//                   responseData?.data?.signals ||
//                   responseData?.metadata?.signals ||
//                   [];
//                 console.info("Response success:", success);
//                 console.info("Response signals:", signals);

//                 // Check if response contains success: true and required signal
//                 const hasRequiredSignal =
//                   success === true &&
//                   Array.isArray(signals) &&
//                   signals.includes("EQUIPMENT_BELONGS_TO_USER");

//                 console.info("Response has required signal:", hasRequiredSignal);
//                 console.info("Signals found:", signals);

//                 if (hasRequiredSignal) {
//                   console.info("Equipment identification successful!");
//                   setEquipmentIdentificationResponse({
//                     received: true,
//                     status: "success",
//                     data: responseData,
//                   });
//                   setEquipmentIdentified(true);
//                   // Clear the stored correlation ID
//                   (window as any).__equipmentIdentificationCorrelationId = null;
//                   // Cleanup handler after successful response
//                   setTimeout(() => {
//                     offResponseHandler();
//                   }, 1000);
//                 } else {
//                   console.warn("Equipment identification response indicates failure");
//                   const errorMessage = 
//                     responseData?.data?.error ||
//                     responseData?.data?.message ||
//                     responseData?.error ||
//                     responseData?.message ||
//                     "Equipment identification failed";

//                   console.error("Error details:", errorMessage);
//                   setEquipmentIdentificationResponse({
//                     received: true,
//                     status: "error",
//                     data: { ...responseData, error: errorMessage },
//                   });
//                   // Clear the stored correlation ID
//                   (window as any).__equipmentIdentificationCorrelationId = null;
//                 }
//               } else {
//                 console.info("Correlation ID does not match, ignoring this message");
//               }
//               responseCallback({ success: true });
//             }
//         } catch (err) {
//             console.error("Error parsing MQTT arrived callback:", err);
//             responseCallback({ success: false, error: err });
//           }
//         }
//       );

//       // Store correlation ID for response matching
//       (window as any).__equipmentIdentificationCorrelationId = correlationId;

//       // Attempt MQTT operations with retry on connection errors
//       const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
//         console.info(`=== Attempting MQTT Operations (Attempt ${retryCount + 1}/${maxRetries + 1}) ===`);
        
//         // Subscribe to response topic first (like rider code)
//         bridge.callHandler(
//           "mqttSubTopic",
//           { topic: responseTopic, qos: 0 },
//           (subscribeResponse) => {
//             console.info("MQTT subscribe response:", subscribeResponse);
//             try {
//               const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
//               const errorMessage = subResp.respDesc || subResp.error || "";
//               const isConnectionError = errorMessage.toLowerCase().includes("not connected") || 
//                                        errorMessage.toLowerCase().includes("disconnected");
              
//               if (subResp.respCode === "200") {
//                 console.info("Subscribed to response topic successfully");
                
//                 // Wait a moment after subscribe before publishing
//                 setTimeout(() => {
//                   // Then publish
//                   try {
//                     bridge.callHandler(
//                       "mqttPublishMsg",
//                       JSON.stringify(dataToPublish),
//                       (response) => {
//                         console.info("MQTT publish response:", response);
//                         try {
//                           const responseData = typeof response === 'string' ? JSON.parse(response) : response;
//                           const pubErrorMessage = responseData.respDesc || responseData.error || "";
//                           const isPubConnectionError = pubErrorMessage.toLowerCase().includes("not connected") || 
//                                                        pubErrorMessage.toLowerCase().includes("disconnected");
                          
//                           if (responseData.error || responseData.respCode !== "200") {
//                             if (isPubConnectionError && retryCount < maxRetries) {
//                               console.warn(`MQTT publish connection error. Retrying in 1 second... (${retryCount + 1}/${maxRetries})`);
//                               setTimeout(() => {
//                                 attemptMqttOperations(retryCount + 1, maxRetries);
//                               }, 1000);
//             } else {
//                               console.error("MQTT publish error:", pubErrorMessage || "Unknown error");
//                               setEquipmentIdentificationResponse({ 
//                                 received: true, 
//                                 status: "error", 
//                                 data: { error: pubErrorMessage || "Publish failed" } 
//                               });
//                             }
//             } else {
//                             console.info("MQTT request published successfully");
//                           }
//                         } catch (err) {
//                           console.error("Error parsing MQTT publish response:", err);
//                         }
//                       }
//                     );
//                   } catch (err) {
//                     console.error("Error calling mqttPublishMsg:", err);
//                     if (retryCount < maxRetries) {
//                       setTimeout(() => {
//                         attemptMqttOperations(retryCount + 1, maxRetries);
//                       }, 1000);
//             } else {
//                       setEquipmentIdentificationResponse({ 
//                         received: true, 
//                         status: "error", 
//                         data: { error: "Error calling mqttPublishMsg" } 
//                       });
//                     }
//                   }
//                 }, 300);
//               } else if (isConnectionError && retryCount < maxRetries) {
//                 console.warn(`MQTT subscribe connection error. Retrying in 1 second... (${retryCount + 1}/${maxRetries})`);
//                 setTimeout(() => {
//                   attemptMqttOperations(retryCount + 1, maxRetries);
//                 }, 1000);
//             } else {
//                 console.error("Subscribe failed:", errorMessage || "Unknown error");
//                 setEquipmentIdentificationResponse({ 
//                   received: true, 
//                   status: "error", 
//                   data: { error: errorMessage || "Subscribe failed" } 
//                 });
//               }
//             } catch (err) {
//               console.error("Error parsing subscribe response:", err);
//               if (retryCount < maxRetries) {
//                 setTimeout(() => {
//                   attemptMqttOperations(retryCount + 1, maxRetries);
//                 }, 1000);
//             } else {
//                 setEquipmentIdentificationResponse({ 
//                   received: true, 
//                   status: "error", 
//                   data: { error: "Error parsing subscribe response" } 
//                 });
//               }
//             }
//           }
//         );
//       };

//       // Start attempting operations - will retry on connection errors
//       setTimeout(() => {
//         attemptMqttOperations();
//       }, 500);

//       // Note: No automatic cleanup timeout here - handler cleans up when response is received
//       // or when validation steps complete. This prevents interference with validation handlers
//       // that also subscribe to echo/#.
//     },
//     [bridge, t, dynamicPlanId]
//   );

//   const setupBridge = useCallback(
//     (b: WebViewJavascriptBridge) => {
//       const noop = () => {};
//       const reg = (name: string, handler: any) => {
//         b.registerHandler(name, handler);
//         return () => b.registerHandler(name, noop);
//       };

//       if (!bridgeInitRef.current) {
//         bridgeInitRef.current = true;
//         try {
//           b.init((_m, r) => r("js success!"));
//         } catch (err) {
//           console.error("Bridge init error", err);
//         }
//       }

//       // MQTT message callback for echo/# responses
//       const offMqttRecv = reg(
//         "mqttMsgArrivedCallBack",
//         (data: string, resp: any) => {
//           try {
//             const parsedData = JSON.parse(data);
//             const topic = parsedData.topic;
//             const rawMessageContent = parsedData.message;

//             console.info("=== MQTT Message Received ===");
//             console.info("Topic:", topic);
//             console.info("Raw Message:", rawMessageContent);

//             // Check if this is an echo/# response for customer identification
//             if (topic && topic.startsWith("echo/")) {
//               console.info(
//                 "Processing echo/# response for customer identification"
//               );

//               let responseData: any;
//               try {
//                 responseData =
//                   typeof rawMessageContent === "string"
//                     ? JSON.parse(rawMessageContent)
//                     : rawMessageContent;
//               } catch (err) {
//                 console.warn(
//                   "Could not parse message as JSON, using raw:",
//                   err
//                 );
//                 responseData = rawMessageContent;
//               }

//               console.info("=== Customer Identification MQTT Response ===");
//               console.info(
//                 "Full Response Data:",
//                 JSON.stringify(responseData, null, 2)
//               );
//               console.info("Response Topic:", topic);

//               // Check if this response matches our customer identification request
//               const storedCorrelationId = (window as any)
//                 .__customerIdentificationCorrelationId;
//               const responseCorrelationId =
//                 responseData?.correlation_id ||
//                 responseData?.metadata?.correlation_id;

//               console.info("Stored Correlation ID:", storedCorrelationId);
//               console.info("Response Correlation ID:", responseCorrelationId);

//               const correlationMatches =
//                 Boolean(storedCorrelationId) &&
//                 Boolean(responseCorrelationId) &&
//                 (responseCorrelationId === storedCorrelationId ||
//                   responseCorrelationId.startsWith(storedCorrelationId) ||
//                   storedCorrelationId.startsWith(responseCorrelationId));

//               if (correlationMatches) {
//                 console.info(
//                   "Correlation ID matches! Processing customer identification response"
//                 );

//                 // Check for required signals in response
//                 const signals =
//                   responseData?.signals ||
//                   responseData?.data?.signals ||
//                   responseData?.metadata?.signals ||
//                   [];
//                 console.info("Response signals:", signals);

//                 // Check if response contains required signals
//                 const hasRequiredSignal =
//                   Array.isArray(signals) &&
//                   (signals.includes("CUSTOMER_IDENTIFICATION_REQUESTED") ||
//                     signals.includes("CUSTOMER_IDENTIFIED_SUCCESS"));

//                 console.info(
//                   "Response has required signal:",
//                   hasRequiredSignal
//                 );
//                 console.info("Signals found:", signals);

//                 if (hasRequiredSignal) {
//                   console.info(
//                     "Customer identification successful! Required signal found in response."
//                   );
//                   setCustomerIdentificationResponse({
//                     received: true,
//                     status: "success",
//                     data: responseData,
//                   });
//                   setCustomerIdentified(true);
//                   // Clear the stored correlation ID
//                   (window as any).__customerIdentificationCorrelationId = null;
//                 } else {
//                   console.warn(
//                     "Customer identification response does not contain required signals"
//                   );

//                   const errorMessage =
//                     "Customer identification failed. Please check the details.";

//                   console.error("Error details:", errorMessage);

//                   setCustomerIdentificationResponse({
//                     received: true,
//                     status: "error",
//                     data: { ...responseData, error: errorMessage },
//                   });

//                   // Clear the stored correlation ID
//                   (window as any).__customerIdentificationCorrelationId = null;
//                 }
//               } else {
//                 console.info(
//                   "Correlation ID does not match, ignoring this message"
//                 );
//                 console.info(
//                   "This might be a response for a different request"
//                 );
//               }
//             }

//             resp({ success: true });
//           } catch (err) {
//             console.error("Error processing MQTT message:", err);
//             resp({ success: false, error: String(err) });
//           }
//         }
//       );

//       // QR code scan callback
//       const offQr = reg(
//         "scanQrcodeResultCallBack",
//         (data: string, resp: any) => {
//         try {
//           const p = JSON.parse(data);
//           const qrVal = p.respData?.value || "";
//           console.info("QR code scanned:", qrVal);
          
//           if (!qrVal) {
//             throw new Error("No QR code value provided");
//           }

//           // Use ref to determine which scan type is active
//           if (scanTypeRef.current === "customer") {
//             console.info("Processing customer QR code:", qrVal);
//             handleCustomerIdentification(qrVal);
//           } else if (scanTypeRef.current === "equipment") {
//             console.info("Processing equipment barcode:", qrVal);
//             handleEquipmentIdentification(qrVal);
//             } else if (scanTypeRef.current === "checkin") {
//               console.info("Processing check-in equipment barcode:", qrVal);
//               // Normalize equipment ID from scanned barcode
//               let parsedData: any = qrVal;
//               try {
//                 const maybeParsed = JSON.parse(qrVal);
//                 if (maybeParsed && typeof maybeParsed === "object") {
//                   parsedData = maybeParsed;
//                 }
//               } catch (err) {
//                 parsedData = qrVal;
//               }

//               let normalizedEquipmentId: string;
//               if (typeof parsedData === "object") {
//                 normalizedEquipmentId =
//                   parsedData.equipment_id ||
//                   parsedData.equipmentId ||
//                   parsedData.id ||
//                   parsedData.barcode ||
//                   qrVal;
//           } else {
//                 normalizedEquipmentId = qrVal;
//               }

//               setCheckinEquipmentId(normalizedEquipmentId);
//               setIsScanningCheckin(false);
//               scanTypeRef.current = null;
//               // toast.success(t("Equipment scanned for check-in"));
//             } else if (scanTypeRef.current === "checkout") {
//               console.info("Processing checkout equipment barcode:", qrVal);
//               // Normalize equipment ID from scanned barcode
//               let parsedData: any = qrVal;
//               try {
//                 const maybeParsed = JSON.parse(qrVal);
//                 if (maybeParsed && typeof maybeParsed === "object") {
//                   parsedData = maybeParsed;
//                 }
//               } catch (err) {
//                 parsedData = qrVal;
//               }

//               let normalizedEquipmentId: string;
//               if (typeof parsedData === "object") {
//                 normalizedEquipmentId =
//                   parsedData.equipment_id ||
//                   parsedData.equipmentId ||
//                   parsedData.id ||
//                   parsedData.barcode ||
//                   qrVal;
//               } else {
//                 normalizedEquipmentId = qrVal;
//               }

//               setCheckoutEquipmentId(normalizedEquipmentId);
//               setIsScanningCheckout(false);
//               scanTypeRef.current = null;
//               // toast.success(t("Equipment scanned for checkout"));
//             } else {
//               console.warn(
//                 "QR code scanned but no active scan type:",
//                 scanTypeRef.current
//               );
//               // toast.error(t("No active scan session"));
//           }

//           resp({ success: true });
//         } catch (err) {
//           console.error("Error processing QR code data:", err);
//             // toast.error(t("Error processing QR code"));
//           setIsScanningCustomer(false);
//           setIsScanningEquipment(false);
//             setIsScanningCheckin(false);
//             setIsScanningCheckout(false);
//           scanTypeRef.current = null;
//           resp({ success: false, error: String(err) });
//         }
//         }
//       );

//       const offConnectMqtt = reg(
//         "connectMqttCallBack",
//         (data: string, resp: any) => {
//           try {
//             const parsedData =
//               typeof data === "string" ? JSON.parse(data) : data;
//             console.info("=== MQTT Connection Callback ===");
//             console.info(
//               "Connection Callback Data:",
//               JSON.stringify(parsedData, null, 2)
//             );

//             // Check if connection was successful
//             const isConnected =
//               parsedData?.connected === true ||
//               parsedData?.status === "connected" ||
//               parsedData?.respCode === "200" ||
//               (parsedData && !parsedData.error);

//             if (isConnected) {
//               console.info("MQTT connection confirmed as connected");
//               setIsMqttConnected(true);
//             } else {
//               console.warn(
//                 "MQTT connection callback indicates not connected:",
//                 parsedData
//               );
//               setIsMqttConnected(false);
//             }
//             resp("Received MQTT Connection Callback");
//           } catch (err) {
//             console.error("Error parsing MQTT connection callback:", err);
//             // If we can parse it, assume connection might be OK but log the error
//             console.warn("Assuming MQTT connection is OK despite parse error");
//             setIsMqttConnected(true);
//             resp("Received MQTT Connection Callback");
//           }
//         }
//       );

//       const mqttConfig: MqttConfig = {
//         username: "Admin",
//         password: "7xzUV@MT",
//         clientId: "123",
//         hostname: "mqtt.omnivoltaic.com",
//         port: 1883,
//       };

//       console.info("=== Initiating MQTT Connection ===");
//       console.info("MQTT Config:", { ...mqttConfig, password: "***" });

//       b.callHandler("connectMqtt", mqttConfig, (resp: string) => {
//         try {
//           const p = typeof resp === "string" ? JSON.parse(resp) : resp;
//           console.info("=== MQTT Connect Response ===");
//           console.info("Connect Response:", JSON.stringify(p, null, 2));

//           if (p.error) {
//             console.error("MQTT connection error:", p.error.message || p.error);
//             setIsMqttConnected(false);
//           } else if (p.respCode === "200" || p.success === true) {
//             console.info("MQTT connection initiated successfully");
//             // Connection state will be confirmed by connectMqttCallBack
//           } else {
//             console.warn(
//               "MQTT connection response indicates potential issue:",
//               p
//             );
//           }
//         } catch (err) {
//           console.error("Error parsing MQTT response:", err);
//           // Don't set connection to false on parse error, wait for callback
//         }
//       });

//       return () => {
//         offMqttRecv();
//         offQr();
//         offConnectMqtt();
//       };
//     },
//     [handleCustomerIdentification, handleEquipmentIdentification, t]
//   );

//   useEffect(() => {
//     if (bridge) {
//       const cleanup = setupBridge(bridge as unknown as WebViewJavascriptBridge);
//       return cleanup;
//     }
//   }, [bridge, setupBridge]);

//   const startQrCodeScan = () => {
//     if (!window.WebViewJavascriptBridge) {
//       // toast.error(t("Bridge not initialized"));
//       return;
//     }

//     window.WebViewJavascriptBridge.callHandler(
//       "startQrCodeScan",
//       999,
//       (responseData: string) => {
//         console.info("QR Code Scan Response:", responseData);
//       }
//     );
//   };

//   const handleStartCustomerScan = () => {
//     setCustomerData(null);
//     setCustomerIdentified(false);
//     scanTypeRef.current = "customer";
//     setIsScanningCustomer(true);
//     startQrCodeScan();
//   };

//   const handleStartEquipmentScan = () => {
//     setEquipmentData(null);
//     setEquipmentIdentified(false);
//     scanTypeRef.current = "equipment";
//     setIsScanningEquipment(true);
//     startQrCodeScan();
//   };

//   const handleStartCheckinScan = () => {
//     setCheckinEquipmentId(null);
//     scanTypeRef.current = "checkin";
//     setIsScanningCheckin(true);
//     startQrCodeScan();
//   };

//   const handleStartCheckoutScan = () => {
//     setCheckoutEquipmentId(null);
//     scanTypeRef.current = "checkout";
//     setIsScanningCheckout(true);
//     startQrCodeScan();
//   };

//   const resetFlow = useCallback(() => {
//     setCustomerData(null);
//     setEquipmentData(null);
//     setCustomerIdentified(false);
//     setCustomerIdentificationResponse({ received: false });
//     setEquipmentIdentified(false);
//     setEquipmentIdentificationResponse({ received: false });
//     setIsScanningCustomer(false);
//     setIsScanningEquipment(false);
//     setIsScanningCheckin(false);
//     setIsScanningCheckout(false);
//     setCheckinEquipmentId(null);
//     setCheckoutEquipmentId(null);
//     setCheckoutEnergyTransferred("");
//     setDynamicPlanId(""); // Reset plan_id
//     scanTypeRef.current = null;
//     setCurrentPhase("A1");
//     setCustomerType(null);
//     setValidationStatus({});
//     setValidationResults({});
//     setIsRunningValidations(false);
//     setIsRunningPhase3(false);
//     setPhase3Status({});
//     (window as any).__customerIdentificationCorrelationId = null;
//     (window as any).__equipmentIdentificationCorrelationId = null;
//   }, []);

//   const handleProceedToA2 = () => {
//     setCurrentPhase("A2");
//     setValidationStatus({});
//     setValidationResults({});
//     // toast.success(t("Proceeding to phase 2..."));
//   };

//   const handleStartValidations = useCallback(() => {
//     if (!bridge) {
//       setValidationStatus({
//         customer: "error",
//       });
//       setValidationResults({
//         customer: { error: "Bridge not available" },
//       });
//       return;
//     }

//     if (!dynamicPlanId) {
//       setValidationStatus({
//         customer: "error",
//       });
//       setValidationResults({
//         customer: { error: "Plan ID not set. Customer identification required." },
//       });
//       setIsRunningValidations(false);
//       return;
//     }

//     const hasEquipmentValidation = equipmentIdentified && Boolean(equipmentData);

//     setIsRunningValidations(true);
//     setValidationResults({});
//     setValidationStatus({
//       customer: "pending",
//       payment: "pending",
//       equipment: hasEquipmentValidation ? "pending" : undefined,
//       quota: "pending",
//     });

//     const run = async () => {
//       const scannedCustomerId = customerData?.customer_id;

//       if (!scannedCustomerId) {
//         setValidationStatus((prev) => ({
//           ...prev,
//           customer: "error",
//           equipment: undefined,
//           quota: undefined,
//         }));
//         setValidationResults({
//           customer: {
//             error: "Missing customer ID from scan",
//           },
//         });
//         setIsRunningValidations(false);
//         return;
//       }

//       try {
//         const customerResponse = await runValidationStep({
//           key: "customer",
//           requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_customer`,
//           responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_customer_status`,
//           correlationPrefix: "att-customer-val",
//           requiredSignals: ["CUSTOMER_STATUS_ACTIVE"],
//           buildPayload: (correlationId) => ({
//             timestamp: new Date().toISOString(),
//             plan_id: dynamicPlanId,
//             correlation_id: correlationId,
//             actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "VALIDATE_CUSTOMER_STATUS",
//               customer_id: `customer-test-rider-${scannedCustomerId}`,
//             },
//           }),
//         });

//         setValidationStatus((prev) => ({ ...prev, customer: "success" }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           customer: {
//             message: "Customer status active",
//             response: customerResponse,
//           },
//         }));
//       } catch (err: any) {
//         setValidationStatus((prev) => ({
//           ...prev,
//           customer: "error",
//           payment: undefined,
//           equipment: undefined,
//           quota: undefined,
//         }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           customer: {
//             error: err?.message || "Customer validation failed",
//             response: err?.response,
//           },
//         }));
//         setIsRunningValidations(false);
//         return;
//       }

//       // Payment validation for all customers
//       try {
//         const paymentResponse = await runValidationStep({
//           key: "payment",
//           requestTopic: `emit/uxi/attendant/plan/${dynamicPlanId}/validate_payment`,
//           responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_payment_status`,
//           correlationPrefix: "att-payment-val",
//           requiredSignals: ["PAYMENT_STATUS_GOOD"],
//           buildPayload: (correlationId) => ({
//             timestamp: new Date().toISOString(),
//             plan_id: dynamicPlanId,
//             correlation_id: correlationId,
//             actor: {
//               type: "attendant",
//               id: "attendant-001",
//             },
//             data: {
//               action: "VALIDATE_PAYMENT_STATUS",
//               emergency_wait_approved: false,
//               asset_ready_to_deploy: true,
//             },
//           }),
//         });

//         setValidationStatus((prev) => ({ ...prev, payment: "success" }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           payment: {
//             message: "Payment status validated",
//             response: paymentResponse,
//           },
//         }));
//       } catch (err: any) {
//         setValidationStatus((prev) => ({
//           ...prev,
//           payment: "error",
//           equipment: undefined,
//           quota: undefined,
//         }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           payment: {
//             error: err?.message || "Payment validation failed",
//             response: err?.response,
//           },
//         }));
//         setIsRunningValidations(false);
//         return;
//       }

//       if (hasEquipmentValidation) {
//         try {
//           const equipmentResponse = await runValidationStep({
//             key: "equipment",
//             requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_equipment_condition`,
//             responseTopic: "rtrn/#",
//             correlationPrefix: "att-condition-val",
//             requiredSignals: ["EQUIPMENT_CONDITION_VALIDATION_REQUESTED"],
//             timeoutMs: 45000, // 45 seconds for equipment validation
//             buildPayload: (correlationId) => ({
//           timestamp: new Date().toISOString(),
//               plan_id: dynamicPlanId,
//               correlation_id: correlationId,
//               actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "VALIDATE_EQUIPMENT_CONDITION",
//                 equipment_id: "BAT_RETURN_ATT_001",
//                 damage_assessment_required: false,
//               },
//             }),
//           });

//           setValidationStatus((prev) => ({ ...prev, equipment: "success" }));
//           setValidationResults((prev: any) => ({
//             ...prev,
//             equipment: {
//               message: "Equipment condition validated",
//               response: equipmentResponse,
//             },
//           }));
//         } catch (err: any) {
//           setValidationStatus((prev) => ({
//             ...prev,
//             equipment: "error",
//             quota: undefined,
//           }));
//           setValidationResults((prev: any) => ({
//             ...prev,
//             equipment: {
//               error: err?.message || "Equipment validation failed",
//               response: err?.response,
//             },
//           }));
//           setIsRunningValidations(false);
//           return;
//         }
//       }

//       try {
//         const quotaResponse = await runValidationStep({
//           key: "quota",
//           requestTopic: `call/uxi/attendant/plan/${dynamicPlanId}/validate_quota`,
//           responseTopic: `echo/abs/service/plan/${dynamicPlanId}/validate_service_quota`,
//           correlationPrefix: "att-quota-val",
//           requiredSignals: ["QUOTA_AVAILABLE"],
//           buildPayload: (correlationId) => ({
//         timestamp: new Date().toISOString(),
//             plan_id: dynamicPlanId,
//             correlation_id: correlationId,
//             actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "VALIDATE_SERVICE_QUOTA",
//         },
//           }),
//         });

//         setValidationStatus((prev) => ({ ...prev, quota: "success" }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           quota: {
//             message: "Service quota validated",
//             response: quotaResponse,
//           },
//         }));
//       } catch (err: any) {
//         setValidationStatus((prev) => ({
//           ...prev,
//           quota: "error",
//         }));
//         setValidationResults((prev: any) => ({
//           ...prev,
//           quota: {
//             error: err?.message || "Service quota validation failed",
//             response: err?.response,
//           },
//         }));
//         setIsRunningValidations(false);
//         return;
//       }

//       setIsRunningValidations(false);
//     };

//     run().catch((err) => {
//       console.error("Unexpected validation error", err);
//       setIsRunningValidations(false);
//     });
//   }, [bridge, customerData, equipmentData, equipmentIdentified, runValidationStep, dynamicPlanId]);

//   const ValidationItem = ({
//     label,
//     status,
//     isLoading,
//     details,
//   }: {
//     label: string;
//     status?: "pending" | "success" | "error";
//     isLoading: boolean;
//     details?: any;
//   }) => (
//     <div className="bg-gray-600 rounded-lg p-4">
//       <div className="flex items-center justify-between mb-2">
//         <span className="font-medium text-white">{t(label)}</span>
//         {(status === "pending" || (isLoading && !status)) && (
//           <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
//         )}
//         {status === "success" && (
//           <CheckCircle className="w-5 h-5 text-green-500" />
//         )}
//         {status === "error" && <XCircle className="w-5 h-5 text-red-500" />}
//         {!isLoading && !status && (
//           <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />
//         )}
//       </div>
//       {status === "success" && (
//         <div className="mt-2 text-xs text-gray-400">
//           {details?.message || details?.status || t("Validation passed")}
//         </div>
//       )}
//       {status === "error" && (
//         <div className="mt-2 text-xs text-red-300">
//           {details?.error || details?.message || t("Validation failed")}
//         </div>
//       )}
//     </div>
//   );

//   const allValidationsComplete = () => {
//     const required: string[] = ["customer", "payment"];
    
//     if (equipmentIdentified) {
//       required.push("equipment");
//     }
    
//     required.push("quota");
    
//     return required.every(
//       (key) =>
//         validationStatus[key as keyof typeof validationStatus] === "success"
//     );
//   };

//   // Show proceed button instead of auto-advancing from Phase 2

//   // Handlers for Phase A3 operations
//   const handleEquipmentCheckin = useCallback(() => {
//     if (!checkinEquipmentId || !bridge) {
//       console.error("Check-in equipment ID or bridge not available");
//       setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//       setIsRunningPhase3(false);
//       return;
//     }

//     if (!dynamicPlanId) {
//       console.error("Plan ID not set. Customer identification required.");
//       setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//       setIsRunningPhase3(false);
//       return;
//     }

//     setIsRunningPhase3(true);
//     setPhase3Status({
//       checkin: "pending",
//       checkout: undefined,
//     });

//     // Format equipment ID: BAT_RETURN_ATT_{scanned_id}
//     const formattedEquipmentId = `BAT_RETURN_ATT_${checkinEquipmentId}`;
//     const correlationId = `att-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
//     const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/equipment_checkin`;
//     const responseTopic = "rtrn/#";

//     // Build payload
//     const payload = {
//       timestamp: new Date().toISOString(),
//       plan_id: dynamicPlanId,
//       correlation_id: correlationId,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "EQUIPMENT_CHECKIN",
//         equipment_id: formattedEquipmentId,
//         condition_accepted: true,
//       },
//     };

//     const dataToPublish = {
//       topic: requestTopic,
//       qos: 0,
//       content: payload,
//     };

//     console.info("=== Equipment Check-In MQTT ===");
//     console.info("Request Topic:", requestTopic);
//     console.info("Response Topic:", responseTopic);
//     console.info("Payload:", JSON.stringify(payload, null, 2));
//     console.info("Correlation ID:", correlationId);

//     const correlationKey = "__equipmentCheckinCorrelationId";
//     (window as any)[correlationKey] = correlationId;

//     let settled = false;

//     const cleanup = () => {
//       if (settled) return;
//       settled = true;
//       (window as any)[correlationKey] = null;
//       deregister();
//       try {
//         bridge.callHandler(
//           "mqttUnSubTopic",
//           { topic: responseTopic, qos: 0 },
//           () => {}
//         );
//       } catch (err) {
//         console.warn("Check-in unsubscribe error", err);
//       }
//     };

//     const reg = (name: string, handler: any) => {
//       bridge.registerHandler(name, handler);
//       return () => bridge.registerHandler(name, () => {});
//     };

//     const handleIncomingMessage = (
//       data: string,
//       responseCallback: (response: any) => void
//     ) => {
//       try {
//         const parsedData = JSON.parse(data);
//         const topic = parsedData.topic;
//         const rawMessage = parsedData.message;

//         if (topic && (topic.startsWith("rtrn/") || topic.startsWith("echo/"))) {
//           let responseData: any;
//           try {
//             responseData =
//               typeof rawMessage === "string"
//                 ? JSON.parse(rawMessage)
//                 : rawMessage;
//           } catch (err) {
//             responseData = rawMessage;
//           }

//           console.info("=== Equipment Check-In MQTT Response ===");
//           console.info("Response Topic:", topic);
//           console.info("Response Payload:", JSON.stringify(responseData, null, 2));

//           const storedCorrelationId = (window as any)[correlationKey];
//           const responseCorrelationId =
//             responseData?.correlation_id ||
//             responseData?.metadata?.correlation_id;

//           console.info("Stored Correlation ID:", storedCorrelationId);
//           console.info("Response Correlation ID:", responseCorrelationId);

//           if (settled) {
//             console.warn("Handler already settled, ignoring response");
//             responseCallback({ success: true });
//             return;
//           }

//           const correlationMatches =
//             Boolean(storedCorrelationId) &&
//             Boolean(responseCorrelationId) &&
//             (responseCorrelationId === storedCorrelationId ||
//               responseCorrelationId.startsWith(storedCorrelationId) ||
//               storedCorrelationId.startsWith(responseCorrelationId));

//           console.info("Correlation matches:", correlationMatches);

//           if (correlationMatches && !settled) {
//             const successFlag =
//               responseData?.success === true ||
//               responseData?.data?.success === true ||
//               responseData?.metadata?.success === true;

//             const signals = responseData?.signals || responseData?.data?.signals || responseData?.metadata?.signals || [];
//             const hasRequiredSignal = Array.isArray(signals) && signals.includes("EQUIPMENT_CHECKIN_REQUESTED");

//             console.info("Success flag:", successFlag);
//             console.info("Signals:", signals);
//             console.info("Has required signal:", hasRequiredSignal);

//             if (successFlag && hasRequiredSignal) {
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkin: "success" }));
//               setIsRunningPhase3(false);
//             } else {
//               const errorMessage =
//                 responseData?.data?.error ||
//                 responseData?.error ||
//                 responseData?.data?.message ||
//                 responseData?.message ||
//                 (!successFlag
//                   ? "Equipment check-in failed: success flag false"
//                   : "Equipment check-in failed: required signal not found");

//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//               setIsRunningPhase3(false);
//               console.error("Check-in error:", errorMessage);
//             }
//           }

//           responseCallback({ success: true });
//         }
//       } catch (err: any) {
//         console.error("Error parsing check-in response:", err);
//         responseCallback({ success: false, error: err?.message });
//       }
//     };

//     const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);

//     const timeoutId = window.setTimeout(() => {
//       if (!settled) {
//         console.warn("Equipment check-in timed out");
//         cleanup();
//         setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//         setIsRunningPhase3(false);
//       }
//     }, 45000);

//     const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
//       bridge.callHandler(
//         "mqttSubTopic",
//         { topic: responseTopic, qos: 0 },
//         (subscribeResponse: any) => {
//           try {
//             const subResp =
//               typeof subscribeResponse === "string"
//                 ? JSON.parse(subscribeResponse)
//                 : subscribeResponse;
//             const errorMessage =
//               (subResp?.respDesc || subResp?.error || "").toString();
//             const isConnectionError = errorMessage
//               .toLowerCase()
//               .includes("not connected") ||
//               errorMessage.toLowerCase().includes("disconnected");

//             if (subResp?.respCode === "200") {
//               console.info("Successfully subscribed to", responseTopic);
//               setTimeout(() => {
//                 try {
//                   console.info("Publishing check-in request to", requestTopic);
//                   bridge.callHandler(
//                     "mqttPublishMsg",
//                     JSON.stringify(dataToPublish),
//                     (publishResponse: any) => {
//                       try {
//                         const pubResp =
//                           typeof publishResponse === "string"
//                             ? JSON.parse(publishResponse)
//                             : publishResponse;
//                         const pubMessage =
//                           (pubResp?.respDesc || pubResp?.error || "").toString();
//                         const pubConnectionError = pubMessage
//                           .toLowerCase()
//                           .includes("not connected") ||
//                           pubMessage.toLowerCase().includes("disconnected");

//                         if (pubResp?.error || pubResp?.respCode !== "200") {
//                           if (pubConnectionError && retryCount < maxRetries) {
//                             setTimeout(() => {
//                               attemptMqttOperations(retryCount + 1, maxRetries);
//                             }, 1000);
//                           } else {
//                             clearTimeout(timeoutId);
//                             cleanup();
//                             setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//                             setIsRunningPhase3(false);
//                             console.error("Check-in publish error:", pubMessage);
//                           }
//                         } else {
//                           console.info("Check-in request published successfully");
//                         }
//                       } catch (err) {
//                         console.error("Error parsing publish response:", err);
//                       }
//                     }
//                   );
//                 } catch (err) {
//                   console.error("Error calling mqttPublishMsg:", err);
//                   if (retryCount < maxRetries) {
//                     setTimeout(() => {
//                       attemptMqttOperations(retryCount + 1, maxRetries);
//                     }, 1000);
//                   } else {
//                     clearTimeout(timeoutId);
//                     cleanup();
//                     setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//                     setIsRunningPhase3(false);
//                   }
//                 }
//               }, 300);
//             } else if (isConnectionError && retryCount < maxRetries) {
//               setTimeout(() => {
//                 attemptMqttOperations(retryCount + 1, maxRetries);
//               }, 1000);
//             } else {
//               clearTimeout(timeoutId);
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//               setIsRunningPhase3(false);
//               console.error("Subscribe failed:", errorMessage);
//             }
//           } catch (err) {
//             console.error("Error parsing subscribe response:", err);
//             if (retryCount < maxRetries) {
//               setTimeout(() => {
//                 attemptMqttOperations(retryCount + 1, maxRetries);
//               }, 1000);
//             } else {
//               clearTimeout(timeoutId);
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkin: "error" }));
//               setIsRunningPhase3(false);
//             }
//           }
//         }
//       );
//     };

//     setTimeout(() => {
//       attemptMqttOperations();
//     }, 500);
//   }, [bridge, checkinEquipmentId, dynamicPlanId]);

//   // Function to run Phase 4 operations (activity_report, workflow_update, usage_report)
//   const runPhase4Operations = useCallback(() => {
//     if (!dynamicPlanId) {
//       console.error("Plan ID not set. Cannot proceed with Phase 4 reporting.");
//       return;
//     }

//     console.info("=== Starting Phase 4 Operations ===");

//     // Activity Report
//     mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/activity_report`, {
//       timestamp: new Date().toISOString(),
//       plan_id: dynamicPlanId,
//       correlation_id: `att-activity-${Date.now()}`,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "REPORT_ATTENDANT_ACTIVITY",
//         activity_type: "battery_swap_completed",
//         activity_data: JSON.stringify({
//           duration: 180,
//           customer_satisfaction: "high",
//         }),
//         attendant_station: STATION,
//       },
//     });

//     // Workflow Update
//     mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/workflow_update`, {
//       timestamp: new Date().toISOString(),
//       plan_id: dynamicPlanId,
//       correlation_id: `att-workflow-${Date.now()}`,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "UPDATE_WORKFLOW_STATE",
//         workflow_stage: "A3",
//         stage_transition: "A3_to_A4",
//         process_status: "completed",
//         performance_metrics: JSON.stringify({
//           duration: 300,
//           efficiency: 0.95,
//         }),
//       },
//     });

//     // Usage Report
//     const formattedCheckoutId = checkoutEquipmentId
//       ? `BAT_NEW_ATT_${checkoutEquipmentId}`
//       : "BAT_NEW_ATT_001";
//     const formattedCheckinId = checkinEquipmentId
//       ? `BAT_RETURN_ATT_${checkinEquipmentId}`
//       : null;

//     // Parse energy transferred from manual input (allow integer or float)
//     const energyTransferred = checkoutEnergyTransferred.trim()
//       ? parseFloat(checkoutEnergyTransferred)
//       : 0;

//     const serviceCompletionDetails: Record<string, any> = {
//       new_battery_id: formattedCheckoutId,
//       energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
//       service_duration: 240,
//       attendant_station: STATION,
//     };

//     if (customerType === "returning" && formattedCheckinId) {
//       serviceCompletionDetails.old_battery_id = formattedCheckinId;
//     }

//     mqttPublish(`emit/uxi/billing/plan/${dynamicPlanId}/usage_report`, {
//       timestamp: new Date().toISOString(),
//       plan_id: dynamicPlanId,
//       correlation_id: `att-usage-report-${Date.now()}`,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "REPORT_SERVICE_USAGE_TO_ODOO",
//         usage_type: "battery_swap_completed",
//         service_completion_details: serviceCompletionDetails,
//       },
//     });

//     console.info("=== Phase 4 Operations Completed ===");
    
//     // Wait a moment for MQTT publishes to complete, then reset flow
//     setTimeout(() => {
//       resetFlow();
//     }, 500);
//   }, [dynamicPlanId, checkoutEquipmentId, checkinEquipmentId, customerType, checkoutEnergyTransferred, mqttPublish, resetFlow]);

//   const handleEquipmentCheckout = useCallback(() => {
//     if (!checkoutEquipmentId || !bridge) {
//       console.error("Checkout equipment ID or bridge not available");
//       setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//       setIsRunningPhase3(false);
//       return;
//     }

//     if (!dynamicPlanId) {
//       console.error("Plan ID not set. Customer identification required.");
//       setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//       setIsRunningPhase3(false);
//       return;
//     }

//     setIsRunningPhase3(true);
//     setPhase3Status((prev: any) => ({ ...prev, checkout: "pending" }));

//     // Format equipment ID: BAT_NEW_ATT_{scanned_id}
//     const formattedEquipmentId = `BAT_NEW_ATT_${checkoutEquipmentId}`;
//     const correlationId = `att-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
//     const requestTopic = `call/uxi/attendant/plan/${dynamicPlanId}/equipment_checkout`;
//     const responseTopic = "rtrn/#";

//     // Parse energy transferred (allow integer or float)
//     const energyTransferred = checkoutEnergyTransferred.trim()
//       ? parseFloat(checkoutEnergyTransferred)
//       : 0;

//     // Build payload - same for both first-time and returning customers
//     const payload = {
//       timestamp: new Date().toISOString(),
//       plan_id: dynamicPlanId,
//       correlation_id: correlationId,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//       data: {
//         action: "EQUIPMENT_CHECKOUT",
//         replacement_equipment_id: formattedEquipmentId,
//         energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
//         service_duration: 240,
//       },
//     };

//     const dataToPublish = {
//       topic: requestTopic,
//       qos: 0,
//       content: payload,
//     };

//     console.info("=== Equipment Checkout MQTT ===");
//     console.info("Request Topic:", requestTopic);
//     console.info("Response Topic:", responseTopic);
//     console.info("Payload:", JSON.stringify(payload, null, 2));
//     console.info("Correlation ID:", correlationId);

//     const correlationKey = "__equipmentCheckoutCorrelationId";
//     (window as any)[correlationKey] = correlationId;

//     let settled = false;

//     const cleanup = () => {
//       if (settled) return;
//       settled = true;
//       (window as any)[correlationKey] = null;
//       deregister();
//       try {
//         bridge.callHandler(
//           "mqttUnSubTopic",
//           { topic: responseTopic, qos: 0 },
//           () => {}
//         );
//       } catch (err) {
//         console.warn("Checkout unsubscribe error", err);
//       }
//     };

//     const reg = (name: string, handler: any) => {
//       bridge.registerHandler(name, handler);
//       return () => bridge.registerHandler(name, () => {});
//     };

//     const handleIncomingMessage = (
//       data: string,
//       responseCallback: (response: any) => void
//     ) => {
//       try {
//         const parsedData = JSON.parse(data);
//         const topic = parsedData.topic;
//         const rawMessage = parsedData.message;

//         if (topic && (topic.startsWith("rtrn/") || topic.startsWith("echo/"))) {
//           let responseData: any;
//           try {
//             responseData =
//               typeof rawMessage === "string"
//                 ? JSON.parse(rawMessage)
//                 : rawMessage;
//           } catch (err) {
//             responseData = rawMessage;
//           }

//           console.info("=== Equipment Checkout MQTT Response ===");
//           console.info("Response Topic:", topic);
//           console.info("Response Payload:", JSON.stringify(responseData, null, 2));

//           const storedCorrelationId = (window as any)[correlationKey];
//           const responseCorrelationId =
//             responseData?.correlation_id ||
//             responseData?.metadata?.correlation_id;

//           console.info("Stored Correlation ID:", storedCorrelationId);
//           console.info("Response Correlation ID:", responseCorrelationId);

//           if (settled) {
//             console.warn("Handler already settled, ignoring response");
//             responseCallback({ success: true });
//             return;
//           }

//           const correlationMatches =
//             Boolean(storedCorrelationId) &&
//             Boolean(responseCorrelationId) &&
//             (responseCorrelationId === storedCorrelationId ||
//               responseCorrelationId.startsWith(storedCorrelationId) ||
//               storedCorrelationId.startsWith(responseCorrelationId));

//           console.info("Correlation matches:", correlationMatches);

//           if (correlationMatches && !settled) {
//             const successFlag =
//               responseData?.success === true ||
//               responseData?.data?.success === true ||
//               responseData?.metadata?.success === true;

//             const signals = responseData?.signals || responseData?.data?.signals || responseData?.metadata?.signals || [];
//             const hasRequiredSignal = Array.isArray(signals) && signals.includes("EQUIPMENT_CHECKOUT_REQUESTED");

//             console.info("Success flag:", successFlag);
//             console.info("Signals:", signals);
//             console.info("Has required signal:", hasRequiredSignal);

//             if (successFlag && hasRequiredSignal) {
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkout: "success" }));
//               setIsRunningPhase3(false);
              
//               // Automatically run Phase 4 operations after successful checkout
//               runPhase4Operations();
//             } else {
//               const errorMessage =
//                 responseData?.data?.error ||
//                 responseData?.error ||
//                 responseData?.data?.message ||
//                 responseData?.message ||
//                 (!successFlag
//                   ? "Equipment checkout failed: success flag false"
//                   : "Equipment checkout failed: required signal not found");

//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//               setIsRunningPhase3(false);
//               console.error("Checkout error:", errorMessage);
//             }
//           }

//           responseCallback({ success: true });
//         }
//       } catch (err: any) {
//         console.error("Error parsing checkout response:", err);
//         responseCallback({ success: false, error: err?.message });
//       }
//     };

//     const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);

//     const timeoutId = window.setTimeout(() => {
//       if (!settled) {
//         console.warn("Equipment checkout timed out");
//         cleanup();
//         setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//         setIsRunningPhase3(false);
//       }
//     }, 45000);

//     const attemptMqttOperations = (retryCount = 0, maxRetries = 5) => {
//       bridge.callHandler(
//         "mqttSubTopic",
//         { topic: responseTopic, qos: 0 },
//         (subscribeResponse: any) => {
//           try {
//             const subResp =
//               typeof subscribeResponse === "string"
//                 ? JSON.parse(subscribeResponse)
//                 : subscribeResponse;
//             const errorMessage =
//               (subResp?.respDesc || subResp?.error || "").toString();
//             const isConnectionError = errorMessage
//               .toLowerCase()
//               .includes("not connected") ||
//               errorMessage.toLowerCase().includes("disconnected");

//             if (subResp?.respCode === "200") {
//               console.info("Successfully subscribed to", responseTopic);
//               setTimeout(() => {
//                 try {
//                   console.info("Publishing checkout request to", requestTopic);
//                   bridge.callHandler(
//                     "mqttPublishMsg",
//                     JSON.stringify(dataToPublish),
//                     (publishResponse: any) => {
//                       try {
//                         const pubResp =
//                           typeof publishResponse === "string"
//                             ? JSON.parse(publishResponse)
//                             : publishResponse;
//                         const pubMessage =
//                           (pubResp?.respDesc || pubResp?.error || "").toString();
//                         const pubConnectionError = pubMessage
//                           .toLowerCase()
//                           .includes("not connected") ||
//                           pubMessage.toLowerCase().includes("disconnected");

//                         if (pubResp?.error || pubResp?.respCode !== "200") {
//                           if (pubConnectionError && retryCount < maxRetries) {
//                             setTimeout(() => {
//                               attemptMqttOperations(retryCount + 1, maxRetries);
//                             }, 1000);
//                           } else {
//                             clearTimeout(timeoutId);
//                             cleanup();
//                             setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//                             setIsRunningPhase3(false);
//                             console.error("Checkout publish error:", pubMessage);
//                           }
//                         } else {
//                           console.info("Checkout request published successfully");
//                         }
//                       } catch (err) {
//                         console.error("Error parsing publish response:", err);
//                       }
//                     }
//                   );
//                 } catch (err) {
//                   console.error("Error calling mqttPublishMsg:", err);
//                   if (retryCount < maxRetries) {
//                     setTimeout(() => {
//                       attemptMqttOperations(retryCount + 1, maxRetries);
//                     }, 1000);
//                   } else {
//                     clearTimeout(timeoutId);
//                     cleanup();
//                     setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//                     setIsRunningPhase3(false);
//                   }
//                 }
//               }, 300);
//             } else if (isConnectionError && retryCount < maxRetries) {
//               setTimeout(() => {
//                 attemptMqttOperations(retryCount + 1, maxRetries);
//               }, 1000);
//             } else {
//               clearTimeout(timeoutId);
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//               setIsRunningPhase3(false);
//               console.error("Subscribe failed:", errorMessage);
//             }
//           } catch (err) {
//             console.error("Error parsing subscribe response:", err);
//             if (retryCount < maxRetries) {
//               setTimeout(() => {
//                 attemptMqttOperations(retryCount + 1, maxRetries);
//               }, 1000);
//             } else {
//               clearTimeout(timeoutId);
//               cleanup();
//               setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
//               setIsRunningPhase3(false);
//             }
//           }
//         }
//       );
//     };

//     setTimeout(() => {
//       attemptMqttOperations();
//     }, 500);
//   }, [bridge, checkoutEquipmentId, checkoutEnergyTransferred, dynamicPlanId, runPhase4Operations]);

//   if (currentPhase === "A2") {
//     return (
//       <div className="space-y-6 p-4">
//         {/* Header */}
//         <div className="text-center mb-6">
//           {/* <h2 className="text-2xl font-bold text-white mb-2">
//             {t("Attendant")}
//           </h2> */}
//           <p className="text-gray-400">{t("Validation")}</p>
//         </div>

//         {/* Validation Steps */}
//         <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//           <div className="flex items-center gap-3 mb-4">
//             <Shield className="w-6 h-6 text-yellow-400" />
//             <h3 className="text-lg font-semibold text-white">
//               {t("Running Validations...")}
//             </h3>
//           </div>

//           <div className="space-y-3">
//             <ValidationItem
//               label={t("Customer Status")}
//               status={validationStatus.customer}
//               isLoading={isRunningValidations}
//               details={validationResults.customer}
//             />
//             <ValidationItem
//               label={t("Payment Status")}
//               status={validationStatus.payment}
//               isLoading={isRunningValidations}
//               details={validationResults.payment}
//             />
//             {equipmentIdentified && (
//               <ValidationItem
//                 label={t("Equipment Condition")}
//                 status={validationStatus.equipment}
//                 isLoading={isRunningValidations}
//                 details={validationResults.equipment}
//               />
//             )}
//             <ValidationItem
//               label={t("Service Quota")}
//               status={validationStatus.quota}
//               isLoading={isRunningValidations}
//               details={validationResults.quota}
//             />
//           </div>

//           {!isRunningValidations &&
//             Object.keys(validationStatus).length === 0 && (
//             <button
//               onClick={handleStartValidations}
//               className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
//             >
//               <Shield className="w-5 h-5" />
//               {t("Start Validation")}
//             </button>
//           )}

//           {allValidationsComplete() && (
//             <>
//             <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//               <div className="flex items-center gap-2 text-green-400 mb-2">
//                 <CheckCircle className="w-5 h-5" />
//                 <span className="font-medium">{t("All Checks Passed!")}</span>
//               </div>
//             </div>
//               <button
//                 onClick={() => setCurrentPhase("A3")}
//                 className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 {t("Checkout")}
//               </button>
//             </>
//           )}
//         </div>

//         {/* Action Buttons */}
//         <div className="flex gap-3">
//           <button
//             onClick={() => setCurrentPhase("A1")}
//             className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//           >
//             {t("Back to Identification")}
//           </button>
//           <button
//             onClick={resetFlow}
//             className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//           >
//             {t("Reset")}
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (currentPhase === "A3") {
//   return (
//     <div className="space-y-6 p-4">
//       {/* Header */}
//       <div className="text-center mb-6">
//           {/* <h2 className="text-2xl font-bold text-white mb-2">
//             {t("Attendant")}
//           </h2> */}
//           <p className="text-gray-400">{t("Transaction Execution")}</p>
//       </div>

//         <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
//           {customerType === "returning" && (
//             <>
//               <div className="flex items-center gap-3 mb-2">
//                 <Battery className="w-6 h-6 text-orange-300" />
//                 <h3 className="text-lg font-semibold text-white">
//                   {t("Equipment Check-In")}
//                 </h3>
//               </div>
//               <div className="bg-gray-600 rounded-lg p-4 space-y-3">
//         <div className="flex items-center justify-between">
//                   <span className="text-white text-sm">
//                     {t("Receive and process returned equipment")}
//             </span>
//                   {isRunningPhase3 && phase3Status.checkin === "pending" && (
//                     <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//                   )}
//                   {phase3Status.checkin === "success" && (
//                     <CheckCircle className="w-5 h-5 text-green-500" />
//                   )}
//           </div>
//                 {checkinEquipmentId && (
//                   <div className="mt-2 p-2 bg-gray-700 rounded text-xs text-gray-300 overflow-hidden">
//                     <span className="font-medium">{t("Equipment ID")}:</span>{" "}
//                     <span className="break-all inline-block max-w-full">
//                       {formatDisplayValue(checkinEquipmentId)}
//                     </span>
//         </div>
//                 )}
//                 <div className="flex gap-2 flex-wrap">
//                   <button
//                     onClick={handleStartCheckinScan}
//                     disabled={
//                       isScanningCheckin || phase3Status.checkin === "success"
//                     }
//                     className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                   >
//                     {isScanningCheckin ? (
//                       <>
//                         <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
//                         <span className="whitespace-nowrap">{t("Scanning...")}</span>
//                       </>
//                     ) : (
//                       <>
//                         <QrCode className="w-4 h-4 flex-shrink-0" />
//                         <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
//                       </>
//                     )}
//                   </button>
//                   {checkinEquipmentId && phase3Status.checkin !== "success" && (
//                     <button
//                       onClick={handleEquipmentCheckin}
//                       disabled={isRunningPhase3}
//                       className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                     >
//                       <span className="whitespace-nowrap">{t("Process Check-In")}</span>
//                     </button>
//                   )}
//                 </div>
//               </div>
//             </>
//           )}

//           <div className="flex items-center gap-3 mt-4 mb-2">
//             <PackageCheck className="w-6 h-6 text-blue-300" />
//             <h3 className="text-lg font-semibold text-white">
//               {t("Equipment Checkout")}
//             </h3>
//           </div>
//           <div className="bg-gray-600 rounded-lg p-4 space-y-3">
//             <div className="flex items-center justify-between">
//               <span className="text-white text-sm">
//                 {t("Prepare and hand over replacement equipment")}
//               </span>
//               {isRunningPhase3 && phase3Status.checkout === "pending" && (
//                 <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//               )}
//               {phase3Status.checkout === "success" && (
//                 <CheckCircle className="w-5 h-5 text-green-500" />
//               )}
//             </div>
//             {checkoutEquipmentId && (
//               <div className="mt-2 p-2 bg-gray-700 rounded text-xs text-gray-300 overflow-hidden">
//                 <span className="font-medium">{t("Equipment ID")}:</span>{" "}
//                 <span className="break-all inline-block max-w-full">
//                   {formatDisplayValue(checkoutEquipmentId)}
//                 </span>
//               </div>
//             )}
//             {checkoutEquipmentId && (
//               <div className="mt-2">
//                 <label className="block text-sm text-gray-300 mb-1">
//                   {t("Energy Transferred (kWh)")}
//                 </label>
//                 <input
//                   type="number"
//                   step="0.1"
//                   value={checkoutEnergyTransferred}
//                   onChange={(e) => setCheckoutEnergyTransferred(e.target.value)}
//                   placeholder="e.g., 80.0"
//                   className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 />
//               </div>
//             )}
//             <div className="flex gap-2 flex-wrap">
//               <button
//                 onClick={handleStartCheckoutScan}
//                 disabled={
//                   isScanningCheckout || phase3Status.checkout === "success"
//                 }
//                 className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//               >
//                 {isScanningCheckout ? (
//                   <>
//                     <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
//                     <span className="whitespace-nowrap">{t("Scanning...")}</span>
//                   </>
//                 ) : (
//                   <>
//                     <QrCode className="w-4 h-4 flex-shrink-0" />
//                     <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
//                   </>
//                 )}
//               </button>
//               {checkoutEquipmentId && phase3Status.checkout !== "success" && (
//                 <button
//                   onClick={handleEquipmentCheckout}
//                   disabled={isRunningPhase3}
//                   className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                 >
//                   <span className="whitespace-nowrap">{t("Process Checkout")}</span>
//                 </button>
//               )}
//             </div>
//           </div>

//           {((customerType === "returning" &&
//             phase3Status.checkin === "success" &&
//             phase3Status.checkout === "success") ||
//             (customerType === "first-time" &&
//               phase3Status.checkout === "success")) && (
//             <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//               <div className="flex items-center gap-2 text-green-400 mb-2">
//                 <Loader2 className="w-5 h-5 animate-spin" />
//                 <span className="font-medium">{t("Processing and completing swap...")}</span>
//               </div>
//               <p className="text-sm text-gray-400 mt-2">
//                 {t("Please wait while we finalize the transaction.")}
//               </p>
//             </div>
//           )}

//           <div className="flex gap-3 mt-4">
//             <button
//               onClick={() => setCurrentPhase("A2")}
//               className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//             >
//               {t("Back to Validation")}
//             </button>
//             <button
//               onClick={resetFlow}
//               className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//             >
//               {t("Reset")}
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Customer Type Selection Screen
//   if (!customerType) {
//     return (
//       <div className="space-y-6 p-4">
//         <div className="text-center mb-6">
//           {/* <h2 className="text-2xl font-bold text-white mb-2">
//             {t("Battery Swap")}
//           </h2> */}
//           <p className="text-gray-400">{t("Select Customer Type")}</p>
//         </div>

//         <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-4">
//           <p className="text-gray-300 text-sm mb-4">
//             {t(
//               "Please select the type of customer to proceed with the battery swap workflow."
//             )}
//           </p>

//           <button
//             onClick={() => setCustomerType("first-time")}
//             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             <UserPlus className="w-6 h-6" />
//             <div className="text-left">
//               <div className="font-bold">{t("First-Time Customer")}</div>
//               <div className="text-sm font-normal opacity-90">
//                 {t("New customer - No equipment check-in required")}
//               </div>
//             </div>
//           </button>

//           <button
//             onClick={() => setCustomerType("returning")}
//             className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02]"
//           >
//             <User className="w-6 h-6" />
//             <div className="text-left">
//               <div className="font-bold">{t("Returning Customer")}</div>
//               <div className="text-sm font-normal opacity-90">
//                 {t("Returning customer - Equipment check-in required")}
//               </div>
//             </div>
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6 p-4">
//       {/* Header */}
//       <div className="text-center mb-6">
//         {/* <h2 className="text-2xl font-bold text-white mb-2">
//           {t("Battery Swap")}
//         </h2> */}
//         <p className="text-gray-400">
//           {customerType === "first-time"
//             ? t("First-Time Customer - Customer Identification")
//             : t("Returning Customer - Customer & Equipment Identification")}
//         </p>
//       </div>

//       {/* Phase A1 - Customer Identification */}
//       <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//         <div className="flex items-center gap-3 mb-4">
//           <User className="w-6 h-6 text-blue-400" />
//           <h3 className="text-lg font-semibold text-white">
//             {t("Customer Identification")}
//           </h3>
//         </div>

//         {!customerIdentified ? (
//           <div className="space-y-4">
//             {!customerData ? (
//               <>
//             <p className="text-gray-400 text-sm">
//               {t("Scan customer QR code to identify")}
//             </p>
//             <button
//               onClick={handleStartCustomerScan}
//               disabled={isScanningCustomer}
//               className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
//             >
//               {isScanningCustomer ? (
//                 <>
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   {t("Scanning...")}
//                 </>
//               ) : (
//                 <>
//                   <QrCode className="w-5 h-5" />
//                   {t("Scan Customer QR Code")}
//                 </>
//               )}
//             </button>
//               </>
//             ) : (
//               <div className="space-y-3">
//                 {!customerIdentificationResponse.received ? (
//                   <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
//                     <div className="flex items-center gap-2 text-yellow-400 mb-2">
//                       <Loader2 className="w-5 h-5 animate-spin" />
//                       <span className="font-medium">{t("Processing...")}</span>
//                     </div>
//                     <p className="text-xs text-gray-400">
//                       {t("Identification in progress.")}
//                     </p>
//                     {customerData && (
//                       <div className="mt-3 bg-gray-600 rounded-lg p-3 space-y-1">
//                         <p className="text-xs text-gray-300">
//                           <span className="font-medium text-white">
//                             {t("Scanned ID")}:
//                           </span>{" "}
//                           {formatDisplayValue(customerData.customer_id)}
//                         </p>
//                       </div>
//                     )}
//                   </div>
//                 ) : customerIdentificationResponse.status === "error" ? (
//                   <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
//                     <div className="flex items-center gap-2 text-red-400 mb-2">
//                       <XCircle className="w-5 h-5" />
//                       <span className="font-medium">
//                         {t("Identification Failed")}
//                       </span>
//                     </div>
//                     <p className="text-xs text-gray-400">
//                       {customerIdentificationResponse.data?.error ||
//                         t("Customer identification failed. Please try again.")}
//                     </p>
//                     <button
//                       onClick={() => {
//                         setCustomerData(null);
//                         setCustomerIdentificationResponse({ received: false });
//                         handleStartCustomerScan();
//                       }}
//                       className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
//                     >
//                       {t("Retry Scan")}
//                     </button>
//                   </div>
//                 ) : null}
//               </div>
//             )}
//           </div>
//         ) : (
//           <div className="space-y-3">
//             <div className="flex items-center gap-2 text-green-400">
//               <CheckCircle className="w-5 h-5" />
//               <span className="font-medium">{t("Customer Identified")}</span>
//             </div>
//             {customerData && (
//               <div className="bg-gray-600 rounded-lg p-4 space-y-2">
//                 <p className="text-sm text-gray-300">
//                   <span className="font-medium text-white">
//                     {t("Customer ID")}:
//                   </span>{" "}
//                   {formatDisplayValue(customerData.customer_id)}
//                 </p>
//                 <p className="text-sm text-gray-300">
//                   <span className="font-medium text-white">{t("Name")}:</span>{" "}
//                   {formatDisplayValue(
//                     customerData.name || customerData.product_name
//                   )}
//                 </p>
//                 {customerData.subscription_code && (
//                 <p className="text-sm text-gray-300">
//                     <span className="font-medium text-white">
//                       {t("Subscription")}:
//                     </span>{" "}
//                     {formatDisplayValue(customerData.subscription_code)}
//                   </p>
//                 )}
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Phase A1 - Equipment Identification (Returning Customers Only) */}
//       {customerType === "returning" && (
//       <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//         <div className="flex items-center gap-3 mb-4">
//           <Battery className="w-6 h-6 text-green-400" />
//           <h3 className="text-lg font-semibold text-white">
//               {t("Equipment Identification")}
//           </h3>
//         </div>

//         {!equipmentIdentified ? (
//           <div className="space-y-4">
//             <p className="text-gray-400 text-sm">
//               {t("Scan battery barcode to identify")}
//             </p>
//             <button
//               onClick={handleStartEquipmentScan}
//                 disabled={isScanningEquipment || !customerIdentified}
//               className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
//             >
//               {isScanningEquipment ? (
//                 <>
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   {t("Scanning...")}
//                 </>
//               ) : (
//                 <>
//                   <QrCode className="w-5 h-5" />
//                   {t("Scan Equipment Barcode")}
//                 </>
//               )}
//             </button>
//               {!customerIdentified && (
//                 <p className="text-xs text-gray-400">
//                   {customerData && !customerIdentificationResponse.received
//                     ? t("Waiting for customer identification response...")
//                     : customerIdentificationResponse.status === "error"
//                     ? t("Customer identification failed. Please retry.")
//                     : t("Scan customer first to enable equipment scan")}
//                 </p>
//               )}
//               {equipmentData && !equipmentIdentificationResponse.received && (
//                 <div className="flex items-center gap-2 text-yellow-400">
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                   <p className="text-xs">{t("Waiting for equipment identification response...")}</p>
//                 </div>
//               )}
//               {equipmentIdentificationResponse.received && equipmentIdentificationResponse.status === "error" && (
//                 <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
//                   <div className="flex items-center gap-2 text-red-400 mb-2">
//                     <XCircle className="w-4 h-4" />
//                     <span className="font-medium text-sm">{t("Equipment identification failed")}</span>
//                   </div>
//                   <p className="text-xs text-gray-300">
//                     {equipmentIdentificationResponse.data?.error || t("Please retry scanning the equipment.")}
//                   </p>
//                   <button
//                     onClick={handleStartEquipmentScan}
//                     className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-200"
//                   >
//                     {t("Retry Scan")}
//                   </button>
//                 </div>
//               )}
//           </div>
//         ) : (
//           <div className="space-y-3">
//             <div className="flex items-center gap-2 text-green-400">
//               <CheckCircle className="w-5 h-5" />
//               <span className="font-medium">{t("Equipment Identified")}</span>
//             </div>
//             {equipmentData && (
//                 <div className="bg-gray-600 rounded-lg p-4 overflow-hidden">
//                   <p className="text-sm text-gray-300 break-words max-w-full">
//                     <span className="font-medium text-white">
//                       {t("Equipment ID")}:
//                     </span>{" "}
//                     <span className="break-all inline-block max-w-full">
//                       {formatDisplayValue(equipmentData)}
//                     </span>
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//       )}

//       {/* Action Buttons */}
//       {customerIdentified && (customerType === "first-time" || equipmentIdentified) && (
//         <div className="flex gap-3">
//           <button
//             onClick={resetFlow}
//             className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//           >
//             {t("Reset")}
//           </button>
//           <button
//             onClick={handleProceedToA2}
//             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//           >
//             {t("Validation")}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Swap;
