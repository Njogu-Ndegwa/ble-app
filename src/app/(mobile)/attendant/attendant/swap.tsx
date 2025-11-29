"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Battery,
  User,
  QrCode,
  PackageCheck,
  X,
} from "lucide-react";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from "@/i18n";
import { initServiceBleData } from "@/app/utils";

// ABS topics use hardcoded payloads as per docs; publish via bridge like BLE page..
// PLAN_ID is now dynamically set from subscription_code in scanned QR code
const ATTENDANT_ID = "attendant-001";
const STATION = "STATION_001";
const PAYMENT_CONFIRMATION_ENDPOINT =
  "https://crm-omnivoltaic.odoo.com/api/lipay/manual-confirm";

interface MqttConfig {
  username: string;
  password: string;
  clientId: string;
  hostname: string;
  port: number;
  protocol?: string;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
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
  const { bridge, isBridgeReady, isMqttConnected: globalMqttConnected } = useBridge();
  const [currentPhase, setCurrentPhase] = useState<"A1" | "A3">("A1");
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
  const [equipmentErrorMessage, setEquipmentErrorMessage] = useState<string | null>(null);
  const [checkinEquipmentId, setCheckinEquipmentId] = useState<string | null>(
    null
  );
  const [checkinEquipmentIdFull, setCheckinEquipmentIdFull] = useState<string | null>(
    null
  );
  const [checkoutEquipmentId, setCheckoutEquipmentId] = useState<string | null>(
    null
  );
  const [checkoutEnergyTransferred, setCheckoutEnergyTransferred] = useState<string>("");
  const [checkinEnergyTransferred, setCheckinEnergyTransferred] = useState<string>("");
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState<string | null>(null);
  const [isComputingEnergy, setIsComputingEnergy] = useState<boolean>(false);
  const [dynamicPlanId, setDynamicPlanId] = useState<string>(""); // Will be set from subscription_code in QR code
  const [isScanningPayment, setIsScanningPayment] = useState<boolean>(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState<boolean>(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false);
  const [calculatedPaymentAmount, setCalculatedPaymentAmount] = useState<number | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);

  // BLE scanning states for check-in
  interface BleDevice {
    macAddress: string;
    name: string;
    rssi: string;
    rawRssi: number;
    imageUrl?: string;
  }
  const [detectedBleDevices, setDetectedBleDevices] = useState<BleDevice[]>([]);
  const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
  const [isConnectingBle, setIsConnectingBle] = useState<boolean>(false);
  const [connectedBleDevice, setConnectedBleDevice] = useState<string | null>(null);
  const [bleConnectionProgress, setBleConnectionProgress] = useState<number>(0);
  const [dtaServiceData, setDtaServiceData] = useState<any | null>(null);
  const detectedBleDevicesRef = useRef<BleDevice[]>([]);
  const autoFilledCheckinEnergyRef = useRef(false);
  const [paymentState, setPaymentState] = useState<string | null>(null);
  const [serviceState, setServiceState] = useState<string | null>(null);
  const [servicePlanStatus, setServicePlanStatus] = useState<string | null>(null);
  const [servicePlanIdentifier, setServicePlanIdentifier] = useState<string | null>(null);
  const [serviceStates, setServiceStates] = useState<Array<{
    service_id: string;
    used: number;
    quota: number;
    current_asset: string | null;
    name?: string;
    usageUnitPrice?: number;
  }>>([]);
  
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
    payment_and_service?: "pending" | "success" | "error";
  }>({});
  
  const electricityService = useMemo(
    () =>
      serviceStates.find(
        (service) =>
          typeof service?.service_id === "string" &&
          service.service_id.includes("service-electricity-togo")
      ),
    [serviceStates]
  );

  const isElectricityQuotaExhausted = useMemo(() => {
    // If payment was confirmed, allow checkout even if quota is 0
    if (paymentConfirmed) {
      return false;
    }
    if (!electricityService) {
      return false;
    }
    const quotaValue = Number(electricityService.quota ?? 0);
    return Number.isFinite(quotaValue) ? quotaValue === 0 : false;
  }, [electricityService, paymentConfirmed]);

  // Calculate payment amount: usageUnitPrice × energy transferred
  // For returning customers: energy transferred = checkout - checkin (requires both)
  // For first-time customers: energy transferred = checkout
  const calculatePaymentAmount = useMemo(() => {
    if (!electricityService?.usageUnitPrice || !checkoutEnergyTransferred) {
      return null;
    }
    
    const checkoutEnergy = parseFloat(checkoutEnergyTransferred);
    if (isNaN(checkoutEnergy) || checkoutEnergy <= 0) {
      return null;
    }
    
    let energyTransferred = checkoutEnergy;
    
    // For returning customers, require checkin energy and calculate difference
    if (customerType === "returning") {
      if (!checkinEnergyTransferred) {
        // Checkin energy not entered yet, don't calculate
        return null;
      }
      const checkinEnergy = parseFloat(checkinEnergyTransferred);
      if (isNaN(checkinEnergy) || checkinEnergy < 0) {
        return null;
      }
      energyTransferred = checkoutEnergy - checkinEnergy;
      // Ensure non-negative energy transferred
      if (energyTransferred < 0) {
        energyTransferred = 0;
      }
    }
    
    // Only calculate if energy transferred is positive
    if (energyTransferred <= 0) {
      return null;
    }
    
    const unitPrice = Number(electricityService.usageUnitPrice) || 0;
    return energyTransferred * unitPrice;
  }, [electricityService?.usageUnitPrice, checkoutEnergyTransferred, checkinEnergyTransferred, customerType]);

  // Update calculated amount when calculation changes
  useEffect(() => {
    setCalculatedPaymentAmount(calculatePaymentAmount);
  }, [calculatePaymentAmount]);

  
  const bridgeInitRef = useRef(false);
  const scanTypeRef = useRef<
    "customer" | "equipment" | "checkin" | "checkout" | "payment" | null
  >(null);
  const modalScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const equipmentSectionRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToEquipmentRef = useRef<boolean>(false);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

  const formatDisplayValue = (
    value?: string | number | null,
    fallback?: string
  ) => {
    if (value === undefined || value === null || value === "") {
      return fallback ?? t("N/A");
    }
    const strValue = String(value);
    return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
  };

const deriveCustomerTypeFromPayload = (payload?: any) => {
  if (!payload) {
    return null;
  }

  const servicePlanData =
    payload?.data?.metadata?.service_plan_data ||
    payload?.metadata?.service_plan_data ||
    payload?.service_plan_data;

  const extractState = (key: string) =>
    servicePlanData?.[key] ||
    payload?.data?.metadata?.[key] ||
    payload?.metadata?.[key] ||
    payload?.data?.[key] ||
    payload?.[key];

  const serviceState = extractState("serviceState") || extractState("service_state");
  const paymentState = extractState("paymentState") || extractState("payment_state");
  const normalizedServiceState = serviceState
    ? String(serviceState).toUpperCase()
    : undefined;
  const normalizedPaymentState = paymentState
    ? String(paymentState).toUpperCase()
    : undefined;

  if (
    normalizedServiceState === "BATTERY_RETURNED" ||
    (normalizedPaymentState === "CURRENT" &&
      Array.isArray(servicePlanData?.serviceStates) &&
      servicePlanData.serviceStates.some(
        (svc: any) => svc?.current_asset || svc?.currentAsset
      ))
  ) {
    return "returning";
  }

  if (normalizedServiceState === "INITIAL") {
    return "first-time";
  }

  return null;
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
      const responseTopic = `echo/abs/attendant/plan/${currentPlanId}/identify_customer`;

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
                  const serviceBundle = responseData?.data?.metadata?.service_bundle;
                  
                  if (servicePlanData) {
                    const derivedPlanIdentifier =
                      servicePlanData?.servicePlanId ||
                      servicePlanData?.plan_id ||
                      servicePlanData?.planId ||
                      servicePlanData?.planID;
                    if (derivedPlanIdentifier) {
                      setServicePlanIdentifier(String(derivedPlanIdentifier));
                    }
                    const extractedPaymentState = servicePlanData.paymentState;
                    const extractedServiceState = servicePlanData.serviceState;
                    const extractedStatus = servicePlanData.status;
                    // Show all service states, not just electricity service
                    const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
                      (service: any) =>
                        typeof service?.service_id === "string"
                    );
                    const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
                    // Merge service bundle information with service states
                    const enrichedServiceStates = extractedServiceStates.map((serviceState: any) => {
                      // Find matching service in service bundle by service_id
                      const matchingService = serviceBundle?.services?.find(
                        (svc: any) => svc.serviceId === serviceState.service_id
                      );
                      
                      return {
                        ...serviceState,
                        name: matchingService?.name,
                        usageUnitPrice: matchingService?.usageUnitPrice,
                      };
                    });
                    
                    console.info("Extracted paymentState:", extractedPaymentState);
                    console.info("Extracted serviceState:", extractedServiceState);
                    console.info("Extracted status:", extractedStatus);
                    console.info("Extracted serviceStates:", extractedServiceStates);
                    console.info("Enriched serviceStates with bundle info:", enrichedServiceStates);
                    
                    setPaymentState(extractedPaymentState);
                    setServiceState(extractedServiceState);
                    setServicePlanStatus(extractedStatus);
                    setServiceStates(enrichedServiceStates);
                    setCustomerType(inferredType ?? "first-time");
                  } else {
                    // Try alternative paths in case structure is different
                    const altPaymentState = responseData?.data?.metadata?.paymentState || 
                                           responseData?.metadata?.paymentState;
                    const altServiceState = responseData?.data?.metadata?.serviceState ||
                                           responseData?.metadata?.serviceState;
                    const altStatus = responseData?.data?.metadata?.status ||
                                     responseData?.metadata?.status;
                    const altServiceStates = (responseData?.data?.metadata?.serviceStates ||
                                            responseData?.metadata?.serviceStates ||
                                            []).filter(
                                              (service: any) =>
                                                typeof service?.service_id === "string" &&
                                                service.service_id.includes("service-electricity-togo")
                                            );
                    const altServiceBundle = responseData?.data?.metadata?.service_bundle ||
                                           responseData?.metadata?.service_bundle;
                    const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
                    // Merge service bundle information with service states
                    const enrichedAltServiceStates = Array.isArray(altServiceStates) 
                      ? altServiceStates.map((serviceState: any) => {
                          const matchingService = altServiceBundle?.services?.find(
                            (svc: any) => svc.serviceId === serviceState.service_id
                          );
                          return {
                            ...serviceState,
                            name: matchingService?.name,
                            usageUnitPrice: matchingService?.usageUnitPrice,
                          };
                        })
                      : [];
                    
                    if (altPaymentState) {
                      setPaymentState(altPaymentState);
                    }
                    if (altServiceState) {
                      setServiceState(altServiceState);
                    }
                    if (altStatus) {
                      setServicePlanStatus(altStatus);
                    }
                    if (enrichedAltServiceStates.length > 0) {
                      setServiceStates(enrichedAltServiceStates);
                    }
                    setCustomerType(inferredType ?? "first-time");
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

      // Note: No automatic cleanup timeout here - handler cleans up when response is received.
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
      const formattedEquipmentId = `BAT_NEW_${equipmentIdString}`;
      
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
                const hasEquipmentNotFoundSignal =
                  Array.isArray(signals) &&
                  signals.includes("EQUIPMENT_NOT_FOUND");

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
                  setEquipmentErrorMessage(null);
                  // Clear the stored correlation ID
                  (window as any).__equipmentIdentificationCorrelationId = null;
                  
                } else {
                  console.warn("Equipment identification response indicates failure");
                  let errorMessage = 
                    responseData?.data?.error ||
                    responseData?.data?.message ||
                    responseData?.error ||
                    responseData?.message ||
                    "Equipment identification failed";

                  if (hasEquipmentNotFoundSignal) {
                    errorMessage = "EQUIPMENT NOT FOUND";
                  }

                  setEquipmentErrorMessage(errorMessage);
                  toast.error(errorMessage);

                  console.error("Error details:", errorMessage);
                  setEquipmentIdentificationResponse({
                    received: true,
                    status: "error",
                    data: { ...responseData, error: errorMessage },
                  });
                  setEquipmentIdentified(false);
                  // Clear the stored correlation ID
                  (window as any).__equipmentIdentificationCorrelationId = null;
                }
              } else {
                console.info("Correlation ID does not match, ignoring this message");
              }
              responseCallback({ success: true });
            } else {
              // Not an equipment identification topic - skip and let other handlers process it
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

      // Note: No automatic cleanup timeout here - handler cleans up when response is received.
    },
    [bridge, t, dynamicPlanId]
  );

  // BLE scanning functions for check-in (defined before setupBridge so handlers can access them)
  const convertRssiToFormattedString = useCallback((rssi: number, txPower: number = -59, n: number = 2): string => {
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }, []);

  const startBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error(t("Bluetooth bridge not available"));
      return;
    }
    window.WebViewJavascriptBridge.callHandler(
      "startBleScan",
      "",
      (responseData: string) => {
        try {
          const jsonData = JSON.parse(responseData);
          console.log("BLE Scan started:", jsonData);
        } catch (error) {
          console.error("Error parsing BLE scan response:", error);
        }
      }
    );
    setIsScanningBle(true);
  }, [t]);

  const stopBleScan = useCallback(() => {
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
      setIsScanningBle(false);
    }
  }, []);

  const connectBleDevice = useCallback((macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      console.error("WebViewJavascriptBridge is not initialized.");
      toast.error(t("Bluetooth bridge not available"));
      return;
    }
    setIsConnectingBle(true);
    setBleConnectionProgress(0);
    window.WebViewJavascriptBridge.callHandler(
      "connBleByMacAddress",
      macAddress,
      (responseData: string) => {
        console.info("BLE Connection initiated:", responseData);
      }
    );
  }, [t]);

  const populateEnergyFromDta = useCallback(
    (serviceData: any) => {
      if (
        !serviceData ||
        !Array.isArray(serviceData.characteristicList)
      ) {
        setIsComputingEnergy(false); // Energy computation failed - invalid data
        return;
      }

      const getCharValue = (name: string) => {
        const char = serviceData.characteristicList.find(
          (c: any) => c.name?.toLowerCase() === name.toLowerCase()
        );
        return char?.realVal ?? null;
      };

      const rcapRaw = getCharValue("rcap");
      const pckvRaw = getCharValue("pckv");

      const rcap = rcapRaw !== null ? parseFloat(rcapRaw) : NaN;
      const pckv = pckvRaw !== null ? parseFloat(pckvRaw) : NaN;

      if (!Number.isFinite(rcap) || !Number.isFinite(pckv)) {
        console.warn("Unable to parse rcap/pckv values from DTA service", {
          rcapRaw,
          pckvRaw,
        });
        setIsComputingEnergy(false); // Energy computation failed
        return;
      }

      const computedEnergy = (rcap * pckv) / 100;

      if (!Number.isFinite(computedEnergy)) {
        console.warn("Computed energy is not a finite number", {
          rcap,
          pckv,
          computedEnergy,
        });
        setIsComputingEnergy(false); // Energy computation failed
        return;
      }

      // Always populate energy from computedEnergy, overwriting any manual input
      const formattedEnergy = computedEnergy.toFixed(2);
      setCheckinEnergyTransferred(formattedEnergy);
      autoFilledCheckinEnergyRef.current = true;
      setIsComputingEnergy(false); // Energy computation complete
      toast.success(t("Energy auto-filled from BLE device data"), {
        id: "checkin-energy-autofill",
      });
    },
    [t]
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
      const offMqttRecv = reg(
        "mqttMsgArrivedCallBack",
        (data: string, resp: any) => {
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

            if (topic && topic.startsWith("echo/")) {
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
                  const serviceBundle = responseData?.data?.metadata?.service_bundle;
                  
                  if (servicePlanData) {
                    const derivedPlanIdentifier =
                      servicePlanData?.servicePlanId ||
                      servicePlanData?.plan_id ||
                      servicePlanData?.planId ||
                      servicePlanData?.planID;
                    if (derivedPlanIdentifier) {
                      setServicePlanIdentifier(String(derivedPlanIdentifier));
                    }
                    const extractedPaymentState = servicePlanData.paymentState;
                    const extractedServiceState = servicePlanData.serviceState;
                    const extractedStatus = servicePlanData.status;
                    // Show all service states, not just electricity service
                    const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
                      (service: any) =>
                        typeof service?.service_id === "string"
                    );
                    const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
                    // Merge service bundle information with service states
                    const enrichedServiceStates = extractedServiceStates.map((serviceState: any) => {
                      // Find matching service in service bundle by service_id
                      const matchingService = serviceBundle?.services?.find(
                        (svc: any) => svc.serviceId === serviceState.service_id
                      );
                      
                      return {
                        ...serviceState,
                        name: matchingService?.name,
                        usageUnitPrice: matchingService?.usageUnitPrice,
                      };
                    });
                    
                    console.info("Extracted paymentState:", extractedPaymentState);
                    console.info("Extracted serviceState:", extractedServiceState);
                    console.info("Extracted status:", extractedStatus);
                    console.info("Extracted serviceStates:", extractedServiceStates);
                    console.info("Enriched serviceStates with bundle info:", enrichedServiceStates);
                    
                    setPaymentState(extractedPaymentState);
                    setServiceState(extractedServiceState);
                    setServicePlanStatus(extractedStatus);
                    setServiceStates(enrichedServiceStates);
                    setCustomerType(inferredType ?? "first-time");
                  } else {
                    // Try alternative paths in case structure is different
                    const altPaymentState = responseData?.data?.metadata?.paymentState || 
                                           responseData?.metadata?.paymentState;
                    const altServiceState = responseData?.data?.metadata?.serviceState ||
                                           responseData?.metadata?.serviceState;
                    const altStatus = responseData?.data?.metadata?.status ||
                                     responseData?.metadata?.status;
                    const altServiceStates = (responseData?.data?.metadata?.serviceStates ||
                                            responseData?.metadata?.serviceStates ||
                                            []).filter(
                                              (service: any) =>
                                                typeof service?.service_id === "string" &&
                                                service.service_id.includes("service-electricity-togo")
                                            );
                    const altServiceBundle = responseData?.data?.metadata?.service_bundle ||
                                           responseData?.metadata?.service_bundle;
                    const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
                    // Merge service bundle information with service states
                    const enrichedAltServiceStates = Array.isArray(altServiceStates) 
                      ? altServiceStates.map((serviceState: any) => {
                          const matchingService = altServiceBundle?.services?.find(
                            (svc: any) => svc.serviceId === serviceState.service_id
                          );
                          return {
                            ...serviceState,
                            name: matchingService?.name,
                            usageUnitPrice: matchingService?.usageUnitPrice,
                          };
                        })
                      : [];
                    
                    if (altPaymentState) {
                      setPaymentState(altPaymentState);
                    }
                    if (altServiceState) {
                      setServiceState(altServiceState);
                    }
                    if (altStatus) {
                      setServicePlanStatus(altStatus);
                    }
                    if (enrichedAltServiceStates.length > 0) {
                      setServiceStates(enrichedAltServiceStates);
                    }
                    setCustomerType(inferredType ?? "first-time");
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
              
              // Store the full original QR code for MQTT payload
              setCheckinEquipmentIdFull(qrVal);
              
              // Extract last 6 characters from QR code (matching keypad logic) for BLE connection
              const qrCode = qrVal.slice(-6).toLowerCase();
              console.info("Full QR code:", qrVal);
              console.info("Extracted QR code (last 6 chars for BLE):", qrCode);
              
              // Get current detected BLE devices
              const currentDevices = detectedBleDevicesRef.current;
              console.info("Current detected BLE devices:", currentDevices);
              
              // Match QR code to BLE device name (last 6 characters)
              const matches = currentDevices.filter((device) => {
                const name = (device.name || "").toLowerCase();
                const last6FromName = name.slice(-6);
                console.info(`Comparing QR "${qrCode}" with device "${name}" (last 6: "${last6FromName}")`);
                return last6FromName === qrCode;
              });
              
              if (matches.length === 1) {
                console.info("BLE device matched! Connecting to:", matches[0].macAddress);
                // Stop BLE scanning
                stopBleScan();
                // Connect to the matched BLE device
                connectBleDevice(matches[0].macAddress);
                // Store the last 6 characters for BLE reference (kept for compatibility)
                setCheckinEquipmentId(qrCode);
                // Keep scanning state active until connection is established
                // setIsScanningCheckin will be set to false in BLE connection success handler
              } else if (matches.length === 0) {
                console.error("No BLE device found matching QR code:", qrCode);
                toast.error(t("No BLE device found matching the QR code. Please ensure the device is nearby and try again."));
              setIsScanningCheckin(false);
              scanTypeRef.current = null;
                stopBleScan();
              } else {
                console.error("Multiple BLE devices found matching QR code:", qrCode);
                toast.error(t("Multiple devices found. Please try scanning again."));
                setIsScanningCheckin(false);
                scanTypeRef.current = null;
                stopBleScan();
              }
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
            } else if (scanTypeRef.current === "payment") {
              console.info("Processing payment QR code:", qrVal);
              setIsScanningPayment(false);
              scanTypeRef.current = null;

              let parsedPayment: any = qrVal;
              try {
                const maybeParsed = JSON.parse(qrVal);
                if (maybeParsed && typeof maybeParsed === "object") {
                  parsedPayment = maybeParsed;
                }
              } catch (err) {
                parsedPayment = qrVal;
              }

              const transactionId =
                parsedPayment.transaction_id || parsedPayment.transactionId;
              const subscriptionCode =
                parsedPayment.subscription_code || parsedPayment.subscriptionCode;
              // QR code contains authToken_rider (not authToken)
              const authToken = parsedPayment.authToken_rider;

              if (
                !transactionId ||
                !subscriptionCode ||
                !authToken
              ) {
                const message = t(
                  "Invalid payment QR code. Please ensure it includes transaction_id, subscription_code, and auth token."
                );
                setPaymentError(message);
                toast.error(message);
              } else {
                confirmManualPayment({
                  transactionId,
                  subscriptionCode,
                  authToken,
                });
              }
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

      // BLE device discovery handler for check-in
      const offFindBle = reg(
        "findBleDeviceCallBack",
        (
          data: string,
          resp: (r: { success: boolean; error?: string }) => void
        ) => {
          try {
            // Only process BLE devices during check-in scan
            if (scanTypeRef.current !== "checkin") {
              resp({ success: true });
              return;
            }
            
            const d: any = JSON.parse(data);
            // Filter: Only process devices with "OVES" in the name (same as keypad)
            if (d.macAddress && d.name && d.rssi && d.name.includes("OVES")) {
              const raw = Number(d.rssi);
              const formattedRssi = convertRssiToFormattedString(raw);
              
              const device: BleDevice = {
                macAddress: d.macAddress,
                name: d.name,
                rssi: formattedRssi,
                rawRssi: raw,
              };
              
              setDetectedBleDevices((prev) => {
                const exists = prev.some((p) => p.macAddress === d.macAddress);
                const next = exists
                  ? prev.map((p) =>
                      p.macAddress === d.macAddress
                        ? { ...p, rssi: formattedRssi, rawRssi: raw } // Update existing
                        : p
                    )
                  : [...prev, device]; // Add new device
                return [...next].sort((a, b) => b.rawRssi - a.rawRssi); // Sort by signal strength
              });
              
              resp({ success: true });
            } else {
              console.warn("Invalid BLE device data format or not OVES device:", d);
            }
          } catch (err: any) {
            console.error("Error parsing BLE device data:", err);
            resp({ success: false, error: err.message });
          }
        }
      );

      // BLE connection success handler
      const offBleConnectSuccess = reg(
        "bleConnectSuccessCallBack",
        (macAddress: string, resp: any) => {
          console.info("BLE connection successful for check-in:", macAddress);
          sessionStorage.setItem("connectedDeviceMac", macAddress);
          setConnectedBleDevice(macAddress);
          setIsConnectingBle(false);
          setBleConnectionProgress(100);
          setIsScanningCheckin(false);
          stopBleScan();
          scanTypeRef.current = null;
          toast.success(t("BLE device connected successfully"));
          setDtaServiceData(null);
          autoFilledCheckinEnergyRef.current = false;
          setIsComputingEnergy(true); // Start computing energy from BLE device
          initServiceBleData(
            {
              serviceName: "DTA",
              macAddress,
            },
            () => {
              console.info("Requested DTA service data for mac:", macAddress);
            }
          );
          resp(macAddress);
        }
      );

      // BLE connection failure handler
      const offBleConnectFail = reg(
        "bleConnectFailCallBack",
        (data: string, resp: any) => {
          console.error("BLE connection failed:", data);
          setIsConnectingBle(false);
          setBleConnectionProgress(0);
          setIsScanningCheckin(false);
          setIsComputingEnergy(false); // Energy computation failed
          stopBleScan();
          scanTypeRef.current = null;
          toast.error(t("BLE connection failed. Please try again."));
          resp(data);
        }
      );

      // BLE connection progress handler (optional, for UI feedback)
      const offBleConnectProgress = reg(
        "bleInitDataOnProgressCallBack",
        (data: string) => {
          try {
            const p = JSON.parse(data);
            const progress = Math.round((p.progress / p.total) * 100);
            setBleConnectionProgress(progress);
          } catch (err) {
            console.error("Progress callback error:", err);
          }
        }
      );

      const offBleInitServiceComplete = reg(
        "bleInitServiceDataOnCompleteCallBack",
        (data: string, resp: any) => {
          try {
            const parsedData = typeof data === "string" ? JSON.parse(data) : data;
            if (parsedData?.serviceNameEnum === "DTA_SERVICE") {
              setDtaServiceData(parsedData);
              populateEnergyFromDta(parsedData);
            }
            resp(parsedData);
          } catch (err) {
            console.error("Error parsing BLE service data:", err);
            setIsComputingEnergy(false); // Energy computation failed
            resp({ success: false, error: String(err) });
          }
        }
      );

      const offBleInitServiceFail = reg(
        "bleInitServiceDataFailureCallBack",
        (data: string) => {
          console.error("Failed to initialize DTA service:", data);
          setIsComputingEnergy(false); // Energy computation failed
          toast.error(t("Unable to read device energy data. Please try again."));
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

            // Handle nested data structure - the actual response may be inside a 'data' field as a string
            let actualData = parsedData;
            if (parsedData?.data && typeof parsedData.data === "string") {
              try {
                actualData = JSON.parse(parsedData.data);
                console.info("Parsed nested data:", JSON.stringify(actualData, null, 2));
              } catch {
                // If nested data parsing fails, use the original
                actualData = parsedData;
              }
            }

            // Check if connection was successful - check both outer and inner data
            const isConnected =
              parsedData?.connected === true ||
              parsedData?.status === "connected" ||
              parsedData?.respCode === "200" ||
              actualData?.connected === true ||
              actualData?.status === "connected" ||
              actualData?.respCode === "200" ||
              actualData?.respData === true ||
              (actualData && !actualData.error && !parsedData.error);

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
        protocol: "mqtt",
        clean: true,
        connectTimeout: 40000,
        reconnectPeriod: 1000,
      };

      console.info("=== Initiating MQTT Connection ===");
      console.info("MQTT Config:", { ...mqttConfig, password: "***" });

      b.callHandler("connectMqtt", mqttConfig, (resp: string) => {
        try {
          const p = typeof resp === "string" ? JSON.parse(resp) : resp;
          console.info("=== MQTT Connect Response ===");
          console.info("Connect Response:", JSON.stringify(p, null, 2));

          // Handle nested data structure
          let actualResp = p;
          if (p?.responseData && typeof p.responseData === "string") {
            try {
              actualResp = JSON.parse(p.responseData);
              console.info("Parsed nested responseData:", JSON.stringify(actualResp, null, 2));
            } catch {
              actualResp = p;
            }
          }

          if (p.error || actualResp.error) {
            const errorMsg = p.error?.message || p.error || actualResp.error?.message || actualResp.error;
            console.error("MQTT connection error:", errorMsg);
            setIsMqttConnected(false);
          } else if (p.respCode === "200" || actualResp.respCode === "200" || p.success === true || actualResp.respData === true) {
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
        offFindBle();
        offBleConnectSuccess();
        offBleConnectFail();
        offBleConnectProgress();
        offBleInitServiceComplete();
        offBleInitServiceFail();
        // Stop BLE scanning on cleanup
        if (window.WebViewJavascriptBridge) {
          window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
        }
      };
    },
    [handleCustomerIdentification, handleEquipmentIdentification, convertRssiToFormattedString, stopBleScan, connectBleDevice, populateEnergyFromDta, t]
  );

  useEffect(() => {
    // CRITICAL: Only setup bridge handlers AFTER bridge is fully initialized
    if (bridge && isBridgeReady) {
      console.info('=== Swap: Bridge is ready, setting up handlers ===');
      return setupBridge(bridge as unknown as WebViewJavascriptBridge);
    } else {
      console.info('=== Swap: Waiting for bridge to be ready ===', { bridge: !!bridge, isBridgeReady });
    }
  }, [bridge, isBridgeReady, setupBridge]);

  const startQrCodeScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      // toast.error(t("Bridge not initialized"));
      toast.error(t("Unable to access camera"));
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      "startQrCodeScan",
      999,
      (responseData: string) => {
        console.info("QR Code Scan Response:", responseData);
      }
    );
  }, [t]);

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
    setEquipmentErrorMessage(null);
    scanTypeRef.current = "equipment";
    setIsScanningEquipment(true);
    startQrCodeScan();
  };

  // Update ref when detectedBleDevices changes
  useEffect(() => {
    detectedBleDevicesRef.current = detectedBleDevices;
  }, [detectedBleDevices]);

  const handleStartCheckinScan = () => {
    setCheckinEquipmentId(null);
    setCheckinEquipmentIdFull(null);
    setDetectedBleDevices([]);
    setConnectedBleDevice(null);
    setIsConnectingBle(false);
    setBleConnectionProgress(0);
    setCheckinEnergyTransferred("");
    setDtaServiceData(null);
    setIsComputingEnergy(false); // Reset energy computation state
    autoFilledCheckinEnergyRef.current = false;
    scanTypeRef.current = "checkin";
    setIsScanningCheckin(true);
    // Start BLE scanning first
    startBleScan();
    // Then start QR scan after a short delay to allow BLE devices to be discovered
    setTimeout(() => {
    startQrCodeScan();
    }, 500);
  };

  const handleStartCheckoutScan = () => {
    setCheckoutEquipmentId(null);
    scanTypeRef.current = "checkout";
    setIsScanningCheckout(true);
    startQrCodeScan();
  };

  const handleStartSwap = () => {
    setCustomerType(null);
    setIsSwapModalOpen(true);
    setCurrentPhase("A1");
    handleStartCustomerScan();
  };

  const handleProceedToPayment = useCallback(() => {
    if (isScanningPayment || isConfirmingPayment) {
      return;
    }

    if (!window.WebViewJavascriptBridge) {
      toast.error(t("Unable to access camera"));
      return;
    }

    setPaymentError(null);
    setPaymentStatusMessage(t("Please scan the rider payment QR code."));
    scanTypeRef.current = "payment";
    setIsScanningPayment(true);
    startQrCodeScan();
  }, [isConfirmingPayment, isScanningPayment, startQrCodeScan, t]);



  const resetFlow = useCallback(() => {
    setCustomerData(null);
    setEquipmentData(null);
    setCustomerIdentified(false);
    setCustomerIdentificationResponse({ received: false });
    setEquipmentIdentified(false);
    setEquipmentIdentificationResponse({ received: false });
    setEquipmentErrorMessage(null);
    setCheckoutErrorMessage(null);
    setPaymentState(null);
    setServiceState(null);
    setServicePlanStatus(null);
    setServicePlanIdentifier(null);
    setServiceStates([]);
    setIsScanningCustomer(false);
    setIsScanningEquipment(false);
    setIsScanningCheckin(false);
    setIsScanningCheckout(false);
    setCheckinEquipmentId(null);
    setCheckinEquipmentIdFull(null);
    setCheckoutEquipmentId(null);
    setCheckoutEnergyTransferred("");
    setCheckinEnergyTransferred("");
    setIsComputingEnergy(false); // Reset energy computation state
    setDetectedBleDevices([]);
    setIsScanningBle(false);
    setIsConnectingBle(false);
    setConnectedBleDevice(null);
    setBleConnectionProgress(0);
    setDtaServiceData(null);
    autoFilledCheckinEnergyRef.current = false;
    setDynamicPlanId(""); // Reset plan_id
    scanTypeRef.current = null;
    setCurrentPhase("A1");
    setCustomerType(null);
    setIsRunningPhase3(false);
    setPhase3Status({});
    setIsSwapModalOpen(false);
    hasScrolledToEquipmentRef.current = false;
    (window as any).__customerIdentificationCorrelationId = null;
    (window as any).__equipmentIdentificationCorrelationId = null;
    setPaymentError(null);
    setPaymentStatusMessage(null);
    setIsScanningPayment(false);
    setIsConfirmingPayment(false);
    setPaymentConfirmed(false);
    setCalculatedPaymentAmount(null);
    setPaymentReceipt(null);
  }, []);

  useEffect(() => {
    if (!customerIdentified) {
      hasScrolledToEquipmentRef.current = false;
    }

    if (
      isSwapModalOpen &&
      customerType === "returning" &&
      customerIdentified &&
      equipmentSectionRef.current &&
      !hasScrolledToEquipmentRef.current
    ) {
      hasScrolledToEquipmentRef.current = true;
      equipmentSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isSwapModalOpen, customerType, customerIdentified]);

  useEffect(() => {
    if (customerType && !isSwapModalOpen) {
      setIsSwapModalOpen(true);
    }
  }, [customerType, isSwapModalOpen]);
  // Handlers for Phase A3 operations
  const handleEquipmentCheckin = useCallback(() => {
    // Use the full equipment ID for MQTT payload, fallback to checkinEquipmentId if not available
    const equipmentIdForPayload = checkinEquipmentIdFull || checkinEquipmentId;
    
    if (!equipmentIdForPayload || !bridge) {
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

    // Format equipment ID: BAT_RETURN_ATT_{full_scanned_id}
    // Use the full original code (e.g., VCUA2404000016) not just the last 6 characters
    const formattedEquipmentId = `BAT_RETURN_ATT_${equipmentIdForPayload}`;
    console.info("Using full equipment ID for check-in:", equipmentIdForPayload);
    console.info("Formatted equipment ID:", formattedEquipmentId);
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
  }, [bridge, checkinEquipmentId, checkinEquipmentIdFull, dynamicPlanId]);

  // Function to run Phase 4 operations (activity_report, workflow_update, usage_report)
  const runPhase4Operations = useCallback(() => {
    if (!dynamicPlanId) {
      console.error("Plan ID not set. Cannot proceed with Phase 4 reporting.");
      return;
    }

    if (isRunningPhase4) {
      console.info("Phase 4 already running. Skipping duplicate trigger.");
      return;
    }

    setIsRunningPhase4(true);
    setPhase4Status((prev) => ({ ...prev, activity: "pending", usage: "pending" }));

    try {
    console.info("=== Starting Phase 4 Operations ===");

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

      setPhase4Status((prev) => ({ ...prev, activity: "success" }));

    const formattedCheckoutId = checkoutEquipmentId
      ? `BAT_NEW_ATT_${checkoutEquipmentId}`
      : "BAT_NEW_ATT_001";
      // Use full equipment ID for check-in (e.g., VCUA2404000016) not just last 6 characters
      const equipmentIdForCheckin = checkinEquipmentIdFull || checkinEquipmentId;
      const formattedCheckinId = equipmentIdForCheckin
        ? `BAT_RETURN_ATT_${equipmentIdForCheckin}`
      : null;

    const checkoutEnergy = checkoutEnergyTransferred.trim()
      ? parseFloat(checkoutEnergyTransferred)
      : 0;
    const checkinEnergy = checkinEnergyTransferred.trim()
      ? parseFloat(checkinEnergyTransferred)
      : 0;
    
    let energyTransferred = 0;
    if (customerType === "returning") {
      energyTransferred = checkoutEnergy - checkinEnergy;
    } else {
      energyTransferred = checkoutEnergy;
    }
    if (energyTransferred < 0) {
      energyTransferred = 0;
    }

    const serviceCompletionDetails: Record<string, any> = {
      new_battery_id: formattedCheckoutId,
      energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
      service_duration: 240,
      attendant_station: STATION,
        customer_id: customerData?.customer_id,
        checkin_equipment_id: checkinEquipmentId,
        checkout_equipment_id: checkoutEquipmentId,
        timestamp: new Date().toISOString(),
    };

    if (customerType === "returning" && formattedCheckinId) {
      // Format old_battery_id as BAT_NEW_<equipmentId>
      const equipmentIdForCheckin = checkinEquipmentIdFull || checkinEquipmentId;
      serviceCompletionDetails.old_battery_id = equipmentIdForCheckin 
        ? `BAT_NEW_${equipmentIdForCheckin}` 
        : formattedCheckinId;
    }

    mqttPublish(`emit/uxi/billing/plan/${dynamicPlanId}/usage_report`, {
      timestamp: new Date().toISOString(),
      plan_id: dynamicPlanId,
      correlation_id: `att-usage-report-${Date.now()}`,
      actor: { type: "attendant", id: ATTENDANT_ID },
      data: {
        action: "REPORT_SERVICE_USAGE_TO_ODOO",
        usage_type: "battery_swap_completed",
          service_completion_details: JSON.stringify(serviceCompletionDetails),
      },
    });

      setPhase4Status((prev) => ({ ...prev, usage: "success" }));

    console.info("=== Phase 4 Operations Published ===");
    setIsRunningPhase4(false);
    } catch (error) {
      console.error("Phase 4 operations failed:", error);
      setIsRunningPhase4(false);
      setPhase4Status({
        activity: "error",
        usage: "error",
      });
    }
  }, [
    dynamicPlanId,
    checkoutEquipmentId,
    checkinEquipmentId,
    checkinEquipmentIdFull,
    customerType,
    checkoutEnergyTransferred,
    checkinEnergyTransferred,
    mqttPublish,
    isRunningPhase4,
    customerData?.customer_id,
  ]);

  const handleSwapComplete = useCallback(() => {
    resetFlow();
    setPhase4Status({});
    setIsRunningPhase4(false);
  }, [resetFlow]);

  const confirmManualPayment = useCallback(
    async ({
      transactionId,
      subscriptionCode,
      authToken,
    }: {
      transactionId: string;
      subscriptionCode: string;
      authToken: string;
    }) => {
      try {
        setIsConfirmingPayment(true);
        setPaymentError(null);
        setPaymentStatusMessage(t("Confirming payment..."));

        const response = await fetch(PAYMENT_CONFIRMATION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            subscription_code: subscriptionCode,
            receipt: transactionId,
          }),
        });

        if (!(response.status === 200 || response.status === 201)) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        // Payment confirmed successfully
        setPaymentConfirmed(true);
        setPaymentReceipt(transactionId); // Store receipt for payment_and_service
        setPaymentStatusMessage(t("Payment confirmed successfully. You can now proceed to checkout."));
        toast.success(t("Payment confirmed successfully"));
        setIsScanningPayment(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("Payment confirmation failed");
        setPaymentError(message);
        setPaymentStatusMessage(null);
        toast.error(message);
      } finally {
        setIsConfirmingPayment(false);
      }
    },
    [t]
  );

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

    if (!paymentConfirmed) {
      toast.error(t("Payment confirmation is required before checkout"));
      return;
    }

    setCheckoutErrorMessage(null);
    setIsRunningPhase3(true);
    setPhase3Status((prev: any) => ({ ...prev, checkout: "pending" }));
    setPhase4Status((prev) => ({ ...prev, payment_and_service: "pending" }));

    const formattedCheckoutId = checkoutEquipmentId
      ? `BAT_NEW_${checkoutEquipmentId}`
      : null;
    const equipmentIdForCheckin = checkinEquipmentIdFull || checkinEquipmentId;
    const formattedCheckinId = equipmentIdForCheckin
      ? `BAT_RETURN_ATT_${equipmentIdForCheckin}`
      : null;

    const paymentServiceBatteryId = (() => {
      if (!formattedCheckoutId) return null;
      const marker = "ATT_";
      const markerIndex = formattedCheckoutId.indexOf(marker);
      if (markerIndex === -1) {
        return checkoutEquipmentId ? `BAT_NEW_${checkoutEquipmentId}` : null;
      }
      const suffix = formattedCheckoutId.slice(markerIndex + marker.length);
      if (!suffix) {
        return checkoutEquipmentId ? `BAT_NEW_${checkoutEquipmentId}` : null;
      }
      return `BAT_NEW_${suffix}`;
    })();

    const checkoutEnergy = checkoutEnergyTransferred.trim()
      ? parseFloat(checkoutEnergyTransferred)
      : 0;
    const checkinEnergy = checkinEnergyTransferred.trim()
      ? parseFloat(checkinEnergyTransferred)
      : 0;

    let energyTransferred = 0;
    if (customerType === "returning") {
      energyTransferred = checkoutEnergy - checkinEnergy;
    } else {
      energyTransferred = checkoutEnergy;
    }
    if (energyTransferred < 0) {
      energyTransferred = 0;
    }

    const serviceId = electricityService?.service_id || "service-electricity-togo-1";
    const paymentAmount =
      calculatedPaymentAmount !== null ? calculatedPaymentAmount : 0;
    const paymentReference = paymentReceipt || `MPESA-TXN-${Date.now()}`;
    const paymentCorrelationId = `att-checkout-payment-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    let paymentAndServicePayload: any = null;

    if (customerType === "returning" && formattedCheckinId) {
      const oldBatteryId = equipmentIdForCheckin
        ? `BAT_NEW_${equipmentIdForCheckin}`
        : formattedCheckinId;

      paymentAndServicePayload = {
        timestamp: new Date().toISOString(),
        plan_id: dynamicPlanId,
        correlation_id: paymentCorrelationId,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
          attendant_station: STATION,
          payment_data: {
            service_id: serviceId,
            payment_amount: paymentAmount,
            payment_reference: paymentReference,
            payment_method: "MPESA",
            payment_type: "TOP_UP",
          },
          service_data: {
            old_battery_id: oldBatteryId,
            new_battery_id: formattedCheckoutId,
            energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
            service_duration: 240,
          },
        },
      };
    } else if (customerType === "first-time" && paymentServiceBatteryId) {
      paymentAndServicePayload = {
        timestamp: new Date().toISOString(),
        plan_id: dynamicPlanId,
        correlation_id: paymentCorrelationId,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
          attendant_station: STATION,
          payment_data: {
            service_id: serviceId,
            payment_amount: paymentAmount,
            payment_reference: paymentReference,
            payment_method: "MPESA",
            payment_type: "DEPOSIT",
          },
          service_data: {
            new_battery_id: paymentServiceBatteryId,
            energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
            service_duration: 240,
          },
        },
      };
    }

    if (!paymentAndServicePayload) {
      const errorMessage = t("Unable to build checkout payload. Please retry.");
      setCheckoutErrorMessage(errorMessage);
      toast.error(errorMessage);
      setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
      setIsRunningPhase3(false);
      setPhase4Status((prev) => ({ ...prev, payment_and_service: "error" }));
      return;
    }

    const requestTopic = `emit/uxi/attendant/plan/${dynamicPlanId}/payment_and_service`;
    
    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: paymentAndServicePayload,
    };

    // Publish payment_and_service and immediately proceed with reporting
    console.info("Publishing payment_and_service payload to", requestTopic);
    console.info("Payload:", JSON.stringify(paymentAndServicePayload, null, 2));
    
    bridge.callHandler(
      "mqttPublishMsg",
      JSON.stringify(dataToPublish),
      (publishResponse: any) => {
        try {
          const pubResp =
            typeof publishResponse === "string"
              ? JSON.parse(publishResponse)
              : publishResponse;
          
          if (pubResp?.error || pubResp?.respCode !== "200") {
            console.error("Failed to publish payment_and_service:", pubResp?.respDesc || pubResp?.error);
            setCheckoutErrorMessage(t("Failed to publish payment and service"));
            setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
            setIsRunningPhase3(false);
            setPhase4Status((prev) => ({ ...prev, payment_and_service: "error" }));
            toast.error(t("Failed to publish payment and service"));
          } else {
            console.info("Payment and service published successfully");
            // Immediately mark as success and run Phase 4 operations
            setCheckoutErrorMessage(null);
            setPhase3Status((prev: any) => ({ ...prev, checkout: "success" }));
            setIsRunningPhase3(false);
            setPhase4Status((prev) => ({
              ...prev,
              payment_and_service: "success",
            }));
            toast.success(t("Checkout completed"));
            
            // Immediately call Phase 4 operations
            runPhase4Operations();
          }
        } catch (err) {
          console.error("Error parsing publish response:", err);
          setCheckoutErrorMessage(t("Error processing publish response"));
          setPhase3Status((prev: any) => ({ ...prev, checkout: "error" }));
          setIsRunningPhase3(false);
          setPhase4Status((prev) => ({ ...prev, payment_and_service: "error" }));
          toast.error(t("Error processing publish response"));
        }
      }
    );
  }, [
    bridge,
    calculatedPaymentAmount,
    checkoutEquipmentId,
    checkoutEnergyTransferred,
    checkinEnergyTransferred,
    customerType,
    dynamicPlanId,
    paymentReceipt,
    paymentConfirmed,
    checkinEquipmentId,
    checkinEquipmentIdFull,
    electricityService?.service_id,
    runPhase4Operations,
    t,
  ]);

  // Auto-progression: identification complete → move to transaction phase
  useEffect(() => {
    if (
      isSwapModalOpen &&
      currentPhase === "A1" &&
      customerIdentified &&
      customerIdentificationResponse.status === "success"
    ) {
      const returningNeedsEquipment =
        customerType === "returning" ? equipmentIdentified : true;

      if (returningNeedsEquipment) {
        console.info(
          "Auto-progressing: Identification complete, moving directly to transactions..."
        );
        setCurrentPhase("A3");
      }
    }
  }, [
    isSwapModalOpen,
    currentPhase,
    customerIdentified,
    customerIdentificationResponse.status,
    customerType,
    equipmentIdentified,
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

  const renderCustomerAndEquipmentSection = () => {
      return (
      <div className="space-y-6">
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
                    
                    {/* Service Plan Status and Service State */}
                    {(servicePlanStatus || serviceState) && (
                      <div className="pt-2 border-t border-gray-500">
                        {servicePlanStatus && (
                          <p className="text-sm text-gray-300 mb-1">
                            <span className="font-medium text-white">{t("Status")}:</span>{" "}
                            <span className={`font-semibold ${
                              servicePlanStatus === "ACTIVE" ? "text-green-400" :
                              servicePlanStatus === "INACTIVE" ? "text-red-400" :
                              "text-yellow-400"
                            }`}>
                              {servicePlanStatus}
                            </span>
                          </p>
                        )}
                        {serviceState && (
                          <p className="text-sm text-gray-300">
                            <span className="font-medium text-white">{t("Service State")}:</span>{" "}
                            <span className="font-semibold text-blue-400">
                              {serviceState}
                            </span>
                          </p>
                        )}
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
                              {service.name && (
                                <p className="text-xs text-gray-300">
                                  <span className="font-medium text-white">{t("Name")}:</span>{" "}
                                  {formatDisplayValue(service.name)}
                                </p>
                              )}
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-300">
                                  <span className="font-medium text-white">{t("Used")}:</span> {service.used}
                                </span>
                                <span className="text-gray-300">
                                  <span className="font-medium text-white">{t("Quota")}:</span> {service.quota.toLocaleString()}
                                </span>
                              </div>
                              {service.usageUnitPrice !== undefined && (
                                <p className="text-xs text-gray-300">
                                  <span className="font-medium text-white">{t("Usage Unit Price")}:</span>{" "}
                                  {service.usageUnitPrice.toLocaleString()}
                                </p>
                              )}
                              <p className="text-xs text-gray-300">
                                <span className="font-medium text-white">{t("Current Asset")}:</span>{" "}
                                {formatDisplayValue(service.current_asset, t("None"))}
                              </p>
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
            <div
              className="bg-gray-700 rounded-xl p-6 border border-gray-600"
              ref={equipmentSectionRef}
            >
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
  };

  const renderTransactionSection = () => {
      return (
      <div className="space-y-6">
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

                {(checkinEquipmentIdFull || checkinEquipmentId) && (
                  <div className="bg-gray-600 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {t("Equipment ID")}:
                      </span>{" "}
                      {formatDisplayValue(checkinEquipmentIdFull || checkinEquipmentId)}
                    </p>
                  </div>
                )}

                {checkinEquipmentId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("Energy at Check-In (kWh)")}
                    </label>
                    {isComputingEnergy ? (
                      <div className="w-full bg-gray-700 border border-gray-500 rounded-lg p-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-sm text-gray-300">{t("Computing energy from battery...")}</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={checkinEnergyTransferred}
                        readOnly
                        disabled
                        className="w-full bg-gray-700 border border-gray-500 rounded-lg p-2 text-gray-400 cursor-not-allowed"
                        placeholder="0.00"
                      />
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {isComputingEnergy 
                        ? t("Please wait while energy is being calculated...")
                        : t("Energy is automatically calculated from BLE device data")
                      }
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
                    (phase3Status.checkin === "pending" ||
                      phase3Status.checkin === "error" ||
                      phase3Status.checkin === undefined) && (
                      <button
                        onClick={handleEquipmentCheckin}
                        disabled={isRunningPhase3 || isComputingEnergy || !checkinEnergyTransferred}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        {isComputingEnergy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            <span className="whitespace-nowrap">{t("Computing energy...")}</span>
                          </>
                        ) : (
                          <span className="whitespace-nowrap">{t("Process Check-In")}</span>
                        )}
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
                      ? t(
                          "Enter the energy level of the new battery. Energy transferred will be calculated as: Checkout - Check-in"
                        )
                        : t("Enter the energy level of the new battery")}
                    </p>
                  </div>
                )}

                {/* Show calculated payment amount when equipment is scanned and energy is entered */}
                {checkoutEquipmentId && calculatedPaymentAmount !== null && calculatedPaymentAmount > 0 && (
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 space-y-2 mb-4">
                    <p className="text-sm font-semibold text-blue-300">
                      {t("Amount to be Paid")}
                    </p>
                    <p className="text-lg font-bold text-white">
                      ${calculatedPaymentAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-300">
                      {customerType === "returning" && checkinEnergyTransferred ? (
                        <>
                          {t("Energy Transferred")}: {checkoutEnergyTransferred} kWh - {checkinEnergyTransferred} kWh = {(() => {
                            const checkout = parseFloat(checkoutEnergyTransferred) || 0;
                            const checkin = parseFloat(checkinEnergyTransferred) || 0;
                            const transferred = Math.max(0, checkout - checkin);
                            return transferred.toFixed(2);
                          })()} kWh × {electricityService?.usageUnitPrice || 0} {t("per kWh")}
                        </>
                      ) : (
                        <>
                          {t("Energy")}: {checkoutEnergyTransferred} kWh × {electricityService?.usageUnitPrice || 0} {t("per kWh")}
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* Show "Proceed to Payment" button when amount is calculated */}
                {checkoutEquipmentId && calculatedPaymentAmount !== null && calculatedPaymentAmount > 0 && !paymentConfirmed && (
                  <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-3 space-y-2 mb-4">
                    {isScanningPayment && (
                      <p className="text-xs text-yellow-200">
                        {t("Awaiting payment QR scan...")}
                      </p>
                    )}
                    {isConfirmingPayment && (
                      <div className="flex items-center gap-2 text-xs text-yellow-200">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t("Confirming payment...")}</span>
                      </div>
                    )}
                    {paymentStatusMessage && (
                      <p className="text-xs text-green-300">{paymentStatusMessage}</p>
                    )}
                    {paymentError && (
                      <p className="text-xs text-red-300">{paymentError}</p>
                    )}
                    <button
                      onClick={handleProceedToPayment}
                      disabled={isScanningPayment || isConfirmingPayment}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-200"
                    >
                      {isScanningPayment
                        ? t("Scanning...")
                        : isConfirmingPayment
                        ? t("Processing...")
                        : t("Confirm Payment")}
                    </button>
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
                    checkoutEnergyTransferred &&
                    (phase3Status.checkout === "pending" ||
                      phase3Status.checkout === "error" ||
                      phase3Status.checkout === undefined) && (
                      <button
                        onClick={handleEquipmentCheckout}
                        disabled={isRunningPhase3 || !paymentConfirmed}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <span className="whitespace-nowrap">{t("Process Checkout")}</span>
                      </button>
                    )}
                    {checkoutErrorMessage && (
                      <p className="text-xs text-red-300">{checkoutErrorMessage}</p>
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
            <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{t("Swap ready to finalize")}</span>
                </div>
              <button
                onClick={handleSwapComplete}
                disabled={phase4Status.payment_and_service !== "success"}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
              >
                {phase4Status.payment_and_service === "success" ? (
                  <span>{t("Swap Complete")}</span>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("Awaiting confirmation...")}
                  </>
                )}
              </button>
              {(phase4Status.activity === "error" ||
                phase4Status.usage === "error" ||
                phase4Status.payment_and_service === "error") && (
                <p className="text-xs text-red-300">
                  {t("Reporting failed. Please try again.")}
                </p>
              )}
              </div>
            )}
          </div>
        </div>
      );
  };

  // Render modal content for unified swap workflow
  const renderModalContent = () => {
    const shouldShowTransactions = currentPhase === "A3";

    return (
      <div className="space-y-6 p-4">
        {renderCustomerAndEquipmentSection()}
        {shouldShowTransactions && renderTransactionSection()}
      </div>
    );
  };

  // Render modal if swap modal is open
  if (isSwapModalOpen) {
    const isReturning = customerType === "returning";
    const isFirstTime = customerType === "first-time";
    const isSwapComplete = isReturning
      ? phase3Status.checkin === "success" && phase3Status.checkout === "success"
      : isFirstTime
      ? phase3Status.checkout === "success"
      : false;

    const modalTitle = t("Battery Swap");

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
          <div className="overflow-y-auto flex-1" ref={modalScrollContainerRef}>
            {renderModalContent()}
          </div>
        </div>
      </div>
    );
  }


  if (!isSwapModalOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex">
        <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-none md:rounded-r-2xl shadow-2xl space-y-6 p-8 md:p-10 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {t("Start Swap")}
          </h1>
          <button
            onClick={handleStartSwap}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-200"
          >
            <QrCode className="w-5 h-5" />
            {t("Start Swap")}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Swap;
// "use client";

// import React, { useState, useEffect, useCallback, useRef } from "react";
// import { toast } from "react-hot-toast";
// import {
//   Camera,
//   Loader2,
//   CheckCircle,
//   XCircle,
//   Battery,
//   User,
//   QrCode,
//   Shield,
//   PackageCheck,
//   AlertTriangle,
//   X,
// } from "lucide-react";
// import { useBridge } from "@/app/context/bridgeContext";
// import { useI18n } from "@/i18n";
// import { initServiceBleData } from "@/app/utils";

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
//   const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
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
//   const [equipmentErrorMessage, setEquipmentErrorMessage] = useState<string | null>(null);
//   const [checkinEquipmentId, setCheckinEquipmentId] = useState<string | null>(
//     null
//   );
//   const [checkoutEquipmentId, setCheckoutEquipmentId] = useState<string | null>(
//     null
//   );
//   const [checkoutEnergyTransferred, setCheckoutEnergyTransferred] = useState<string>("");
//   const [checkinEnergyTransferred, setCheckinEnergyTransferred] = useState<string>("");
//   const [dynamicPlanId, setDynamicPlanId] = useState<string>(""); // Will be set from subscription_code in QR code
  
//   // BLE scanning states for check-in
//   interface BleDevice {
//     macAddress: string;
//     name: string;
//     rssi: string;
//     rawRssi: number;
//     imageUrl?: string;
//   }
//   const [detectedBleDevices, setDetectedBleDevices] = useState<BleDevice[]>([]);
//   const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
//   const [isConnectingBle, setIsConnectingBle] = useState<boolean>(false);
//   const [connectedBleDevice, setConnectedBleDevice] = useState<string | null>(null);
//   const [bleConnectionProgress, setBleConnectionProgress] = useState<number>(0);
//   const [dtaServiceData, setDtaServiceData] = useState<any | null>(null);
//   const detectedBleDevicesRef = useRef<BleDevice[]>([]);
//   const autoFilledCheckinEnergyRef = useRef(false);
//   const [paymentState, setPaymentState] = useState<string | null>(null);
//   const [serviceStates, setServiceStates] = useState<Array<{
//     service_id: string;
//     used: number;
//     quota: number;
//     current_asset: string | null;
//   }>>([]);
  
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
//   const modalScrollContainerRef = useRef<HTMLDivElement | null>(null);
//   const equipmentSectionRef = useRef<HTMLDivElement | null>(null);
//   const hasScrolledToEquipmentRef = useRef<boolean>(false);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

//   const formatDisplayValue = (
//     value?: string | number | null,
//     fallback?: string
//   ) => {
//     if (value === undefined || value === null || value === "") {
//       return fallback ?? t("N/A");
//     }
//     const strValue = String(value);
//     return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
//   };

// const deriveCustomerTypeFromPayload = (payload?: any) => {
//   if (!payload) {
//     return null;
//   }

//   const servicePlanData =
//     payload?.data?.metadata?.service_plan_data ||
//     payload?.metadata?.service_plan_data ||
//     payload?.service_plan_data;

//   const extractState = (key: string) =>
//     servicePlanData?.[key] ||
//     payload?.data?.metadata?.[key] ||
//     payload?.metadata?.[key] ||
//     payload?.data?.[key] ||
//     payload?.[key];

//   const serviceState = extractState("serviceState") || extractState("service_state");
//   const paymentState = extractState("paymentState") || extractState("payment_state");
//   const normalizedServiceState = serviceState
//     ? String(serviceState).toUpperCase()
//     : undefined;
//   const normalizedPaymentState = paymentState
//     ? String(paymentState).toUpperCase()
//     : undefined;

//   if (
//     normalizedServiceState === "BATTERY_RETURNED" ||
//     (normalizedPaymentState === "CURRENT" &&
//       Array.isArray(servicePlanData?.serviceStates) &&
//       servicePlanData.serviceStates.some(
//         (svc: any) => svc?.current_asset || svc?.currentAsset
//       ))
//   ) {
//     return "returning";
//   }

//   if (normalizedServiceState === "INITIAL") {
//     return "first-time";
//   }

//   return null;
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
//         // Store correlation ID immediately
//         (window as any)[correlationKey] = correlationId;
//         console.info(`[${config.key}] Stored correlation ID in promise: ${correlationKey} = ${correlationId}`);

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
//             console.info(`[${config.key}] ===== VALIDATION HANDLER CALLED =====`);
//             console.info(`[${config.key}] Raw message received (type: ${typeof data}):`, data);
            
//             // Parse the incoming data - it might be a string or already an object
//             let parsedData: any;
//             try {
//               parsedData = typeof data === "string" ? JSON.parse(data) : data;
//             } catch (e) {
//               console.error(`[${config.key}] Failed to parse data:`, e);
//               responseCallback({ success: false, error: "Failed to parse message" });
//               return;
//             }
            
//             // Handle different message formats
//             // Format 1: Direct format with topic and message
//             // Format 2: Wrapped format with callbackId, data, handlerName (from native bridge)
//             let topic: string | undefined;
//             let rawMessage: any;
            
//             if (parsedData.topic && parsedData.message) {
//               // Direct format
//               topic = parsedData.topic;
//               rawMessage = parsedData.message;
//             } else if (parsedData.data) {
//               // Wrapped format - parse the data field (could be string or object)
//               let innerData: any;
//               try {
//                 innerData = typeof parsedData.data === "string" 
//                 ? JSON.parse(parsedData.data) 
//                 : parsedData.data;
//               } catch (parseErr) {
//                 console.error(`[${config.key}] Failed to parse inner data field:`, parseErr);
//                 // Try to extract topic and message directly if parsing fails
//                 innerData = parsedData.data;
//               }
              
//               if (innerData && typeof innerData === "object") {
//               topic = innerData.topic;
//               rawMessage = innerData.message;
//               } else {
//                 // If innerData is not an object, try to parse it as a string
//                 try {
//                   const parsedInner = typeof innerData === "string" ? JSON.parse(innerData) : innerData;
//                   topic = parsedInner?.topic;
//                   rawMessage = parsedInner?.message;
//                 } catch (e) {
//                   console.error(`[${config.key}] Could not extract topic/message from data field`);
//                 }
//               }
//             } else {
//               console.error(`[${config.key}] Unknown message format:`, parsedData);
//               responseCallback({ success: false, error: "Unknown message format" });
//               return;
//             }
            
//             console.info(`[${config.key}] Parsed topic:`, topic);
//             console.info(`[${config.key}] Expected topic:`, responseTopic);
            
//             if (!topic) {
//               console.warn(`[${config.key}] No topic found in message, ignoring`);
//               responseCallback({ success: true });
//               return;
//             }

//             // Check if this is a response topic
//             // If responseTopic is a wildcard (contains #), check prefix match
//             // Otherwise, check for exact match or prefix match for echo/rtrn topics
//             const isWildcard = responseTopic.includes("#");
//             let isResponseTopic = false;
            
//             if (topic) {
//               if (isWildcard) {
//                 // For wildcard topics, check prefix match
//                 const baseTopic = responseTopic.replace("#", "").replace("+", "");
//                 isResponseTopic = topic.startsWith(baseTopic) || 
//                   (responseTopic.includes("echo/") && topic.startsWith("echo/")) ||
//                   (responseTopic.includes("rtrn/") && topic.startsWith("rtrn/"));
//               } else {
//                 // For exact topics, use exact match
//                 // This ensures we match the exact topic like: echo/abs/service/plan/231214/validate_customer_status
//                 const exactMatch = topic === responseTopic;
                
//                 isResponseTopic = exactMatch;
                
//                 console.info(`[${config.key}] Topic matching details:`, {
//                   exactMatch,
//                   topic,
//                   responseTopic,
//                   match: isResponseTopic
//                 });
//               }
//             }
            
//             console.info(`[${config.key}] Received message on topic: ${topic}`);
//             console.info(`[${config.key}] Expected response topic: ${responseTopic}`);
//             console.info(`[${config.key}] Is wildcard: ${isWildcard}`);
//             console.info(`[${config.key}] Is response topic: ${isResponseTopic}`);
            
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
//                 responseData?.data?.correlation_id ||
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

//               // Enhanced correlation matching: handle cases where response correlation ID has suffixes
//               // e.g., stored: "att-customer-val-123-abc", response: "att-customer-val-123-abc_abs_customer_status"
//               const correlationMatches =
//                 Boolean(storedCorrelationId) &&
//                 Boolean(responseCorrelationId) &&
//                 (responseCorrelationId === storedCorrelationId ||
//                   responseCorrelationId.startsWith(storedCorrelationId + "_") ||
//                   responseCorrelationId.startsWith(storedCorrelationId) ||
//                   storedCorrelationId.startsWith(responseCorrelationId) ||
//                   // Also check if response correlation ID contains the stored one (for cases with suffixes)
//                   responseCorrelationId.includes(storedCorrelationId));

//               console.info(`[${config.key}] Correlation matches:`, correlationMatches);
//               if (!correlationMatches) {
//                 console.warn(`[${config.key}] Correlation mismatch - stored: "${storedCorrelationId}", response: "${responseCorrelationId}"`);
//               }

//               if (correlationMatches && !settled) {
//                 const successFlag =
//                   responseData?.success === true ||
//                   responseData?.data?.success === true ||
//                   responseData?.metadata?.success === true;

//                 console.info(`[${config.key}] Success flag check:`, {
//                   topLevel: responseData?.success,
//                   dataLevel: responseData?.data?.success,
//                   metadataLevel: responseData?.metadata?.success,
//                   final: successFlag
//                 });

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

//                 console.info(`[${config.key}] Collected signals:`, Array.from(collectedSignals));
//                 console.info(`[${config.key}] Required signals:`, config.requiredSignals);

//                 const hasRequiredSignal =
//                   !config.requiredSignals ||
//                   config.requiredSignals.some((signal) =>
//                     collectedSignals.has(signal)
//                   );

//                 console.info(`[${config.key}] Has required signal:`, hasRequiredSignal);

//                 if (successFlag && hasRequiredSignal) {
//                   console.info(`[${config.key}] Validation successful! Resolving...`);
//                   cleanup();
//                   resolve(responseData);
//                 } else {
//                   const signalSummary = Array.from(collectedSignals);
//                   const bestError =
//                     responseData?.data?.error ||
//                     responseData?.error ||
//                     responseData?.data?.message ||
//                     responseData?.message ||
//                     (signalSummary.length
//                       ? signalSummary.join(", ")
//                       : !successFlag
//                       ? "Validation failed: success flag false"
//                       : "Validation failed");

//                   console.warn(`[${config.key}] Validation failed:`, bestError);
//                   cleanup();
//                   reject({
//                     message: bestError,
//                     response: responseData,
//                   });
//                 }
//               } else if (!correlationMatches) {
//                 console.warn(`[${config.key}] Correlation did not match - stored: "${storedCorrelationId}", response: "${responseCorrelationId}"`);
//               } else if (settled) {
//                 console.warn(`[${config.key}] Handler already settled, ignoring response`);
//               }

//               // Always call responseCallback to acknowledge message receipt
//               responseCallback({ success: true });
//             } else {
//               // Message received but not for this validation step
//               console.info(`[${config.key}] Message received on topic "${topic}" but not matching expected topic "${responseTopic}"`);
//               responseCallback({ success: true });
//             }
//           } catch (err: any) {
//             console.error("Validation response parse error", err);
//             responseCallback({ success: false, error: err?.message });
//           }
//         };

//         // Register the handler FIRST, before subscribing
//         // This ensures we catch the response even if it arrives quickly
//         // NOTE: This REPLACES any existing handler (like setupBridge's handler)
//         console.info(`[${config.key}] About to register validation handler for topic: ${responseTopic}`);
//         console.info(`[${config.key}] Correlation ID that will be stored: ${correlationId}`);
        
//         // Store correlation ID BEFORE registering handler to ensure it's available
//         (window as any)[correlationKey] = correlationId;
        
//         // IMPORTANT: Register handler BEFORE subscribing to ensure it's ready to receive messages
//         // This handler will replace any existing handler (like setupBridge's handler)
//         const deregister = reg("mqttMsgArrivedCallBack", handleIncomingMessage);
//         console.info(`[${config.key}] Validation handler registered successfully for topic: ${responseTopic}`);
//         console.info(`[${config.key}] Stored correlation ID in window: ${correlationKey} = ${correlationId}`);
//         console.info(`[${config.key}] Verification - correlation ID in window:`, (window as any)[correlationKey]);
//         console.info(`[${config.key}] Handler registration complete. Ready to receive messages.`);
//         console.info(`[${config.key}] Handler function will log when called: "[${config.key}] ===== VALIDATION HANDLER CALLED ====="`);

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
//       const responseTopic = `echo/abs/attendant/plan/${currentPlanId}/identify_customer`;

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
                  
//                   // Extract paymentState and serviceStates from response
//                   const servicePlanData = responseData?.data?.metadata?.service_plan_data;
//                   if (servicePlanData) {
//                     const extractedPaymentState = servicePlanData.paymentState;
//                     const extractedServiceStates = servicePlanData.serviceStates || [];
//                     const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
//                     console.info("Extracted paymentState:", extractedPaymentState);
//                     console.info("Extracted serviceStates:", extractedServiceStates);
                    
//                     setPaymentState(extractedPaymentState);
//                     setServiceStates(extractedServiceStates);
//                     setCustomerType(inferredType ?? "first-time");
//                   } else {
//                     // Try alternative paths in case structure is different
//                     const altPaymentState = responseData?.data?.metadata?.paymentState || 
//                                            responseData?.metadata?.paymentState;
//                     const altServiceStates = responseData?.data?.metadata?.serviceStates ||
//                                             responseData?.metadata?.serviceStates ||
//                                             [];
//                     const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
//                     if (altPaymentState) {
//                       setPaymentState(altPaymentState);
//                     }
//                     if (Array.isArray(altServiceStates) && altServiceStates.length > 0) {
//                       setServiceStates(altServiceStates);
//                     }
//                     setCustomerType(inferredType ?? "first-time");
//                   }
                  
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
//             // Handle wrapped message format from native bridge
//             let parsedData: any;
//             try {
//               parsedData = typeof data === "string" ? JSON.parse(data) : data;
//             } catch (e) {
//               console.error("Equipment identification: Failed to parse data:", e);
//               responseCallback({ success: false, error: "Failed to parse message" });
//               return;
//             }

//             // Extract topic and message from different formats
//             let topic: string | undefined;
//             let rawMessageContent: any;
            
//             if (parsedData.topic && parsedData.message) {
//               // Direct format
//               topic = parsedData.topic;
//               rawMessageContent = parsedData.message;
//             } else if (parsedData.data) {
//               // Wrapped format - parse the data field
//               const innerData = typeof parsedData.data === "string" 
//                 ? JSON.parse(parsedData.data) 
//                 : parsedData.data;
//               topic = innerData?.topic;
//               rawMessageContent = innerData?.message;
//             } else {
//               // Unknown format, skip
//               responseCallback({ success: true });
//               return;
//             }

//             console.info("Equipment identification: Received message on topic:", topic);

//             // If validation is starting or in progress, skip processing - let validation handler handle it
//             if ((window as any).__validationInProgress || (window as any).__validationWillStartSoon) {
//               // Check if this is a validation topic - if so, definitely skip
//               const isValidationTopic = topic && (
//                 topic.includes("validate_customer_status") ||
//                 topic.includes("validate_payment_status") ||
//                 topic.includes("validate_equipment_condition") ||
//                 topic.includes("validate_service_quota") ||
//                 topic.includes("/validate")
//               );
              
//               if (isValidationTopic) {
//                 console.info("Equipment identification: Validation active, skipping validation message");
//                 responseCallback({ success: true });
//                 return;
//               }
//             }

//             // Check if this is the specific equipment identification response topic
//             const expectedResponseTopic = `echo/abs/service/plan/${dynamicPlanId}/identify_equipment`;
//             if (topic && topic === expectedResponseTopic) {
//               console.info("Response received from equipment identification topic:", { topic, rawMessageContent });
              
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
//                 const hasEquipmentNotFoundSignal =
//                   Array.isArray(signals) &&
//                   signals.includes("EQUIPMENT_NOT_FOUND");

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
//                   setEquipmentErrorMessage(null);
//                   // Clear the stored correlation ID
//                   (window as any).__equipmentIdentificationCorrelationId = null;
                  
//                   // Mark that validation will start soon - this prevents handler cleanup from interfering
//                   // Validation will start automatically via useEffect when equipmentIdentified becomes true
//                   (window as any).__validationWillStartSoon = true;
                  
//                   // Don't cleanup handler - let validation handler replace it when it registers
//                   // This prevents race conditions where cleanup happens after validation handler registers
//                   console.info("Equipment identification: Validation will start soon, skipping handler cleanup to avoid conflicts");
//                 } else {
//                   console.warn("Equipment identification response indicates failure");
//                   let errorMessage = 
//                     responseData?.data?.error ||
//                     responseData?.data?.message ||
//                     responseData?.error ||
//                     responseData?.message ||
//                     "Equipment identification failed";

//                   if (hasEquipmentNotFoundSignal) {
//                     errorMessage = "EQUIPMENT NOT FOUND";
//                   }

//                   setEquipmentErrorMessage(errorMessage);
//                   toast.error(errorMessage);

//                   console.error("Error details:", errorMessage);
//                   setEquipmentIdentificationResponse({
//                     received: true,
//                     status: "error",
//                     data: { ...responseData, error: errorMessage },
//                   });
//                   setEquipmentIdentified(false);
//                   // Clear the stored correlation ID
//                   (window as any).__equipmentIdentificationCorrelationId = null;
//                 }
//               } else {
//                 console.info("Correlation ID does not match, ignoring this message");
//               }
//               responseCallback({ success: true });
//             } else {
//               // Not an equipment identification topic - skip and let other handlers process it
//               // This is important for validation handlers that might be active
//               console.info("Equipment identification: Message not for equipment identification, skipping");
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

//   // BLE scanning functions for check-in (defined before setupBridge so handlers can access them)
//   const convertRssiToFormattedString = useCallback((rssi: number, txPower: number = -59, n: number = 2): string => {
//     const distance = Math.pow(10, (txPower - rssi) / (10 * n));
//     return `${rssi}db ~ ${distance.toFixed(0)}m`;
//   }, []);

//   const startBleScan = useCallback(() => {
//     if (!window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error(t("Bluetooth bridge not available"));
//       return;
//     }
//     window.WebViewJavascriptBridge.callHandler(
//       "startBleScan",
//       "",
//       (responseData: string) => {
//         try {
//           const jsonData = JSON.parse(responseData);
//           console.log("BLE Scan started:", jsonData);
//         } catch (error) {
//           console.error("Error parsing BLE scan response:", error);
//         }
//       }
//     );
//     setIsScanningBle(true);
//   }, [t]);

//   const stopBleScan = useCallback(() => {
//     if (window.WebViewJavascriptBridge) {
//       window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
//       setIsScanningBle(false);
//     }
//   }, []);

//   const connectBleDevice = useCallback((macAddress: string) => {
//     if (!window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error(t("Bluetooth bridge not available"));
//       return;
//     }
//     setIsConnectingBle(true);
//     setBleConnectionProgress(0);
//     window.WebViewJavascriptBridge.callHandler(
//       "connBleByMacAddress",
//       macAddress,
//       (responseData: string) => {
//         console.info("BLE Connection initiated:", responseData);
//       }
//     );
//   }, [t]);

//   const populateEnergyFromDta = useCallback(
//     (serviceData: any) => {
//       if (
//         !serviceData ||
//         !Array.isArray(serviceData.characteristicList) ||
//         autoFilledCheckinEnergyRef.current ||
//         (checkinEnergyTransferred && checkinEnergyTransferred.trim().length > 0)
//       ) {
//         return;
//       }

//       const getCharValue = (name: string) => {
//         const char = serviceData.characteristicList.find(
//           (c: any) => c.name?.toLowerCase() === name.toLowerCase()
//         );
//         return char?.realVal ?? null;
//       };

//       const rcapRaw = getCharValue("rcap");
//       const pckvRaw = getCharValue("pckv");

//       const rcap = rcapRaw !== null ? parseFloat(rcapRaw) : NaN;
//       const pckv = pckvRaw !== null ? parseFloat(pckvRaw) : NaN;

//       if (!Number.isFinite(rcap) || !Number.isFinite(pckv)) {
//         console.warn("Unable to parse rcap/pckv values from DTA service", {
//           rcapRaw,
//           pckvRaw,
//         });
//         return;
//       }

//       const computedEnergy = (rcap * pckv) / 100;

//       if (!Number.isFinite(computedEnergy)) {
//         console.warn("Computed energy is not a finite number", {
//           rcap,
//           pckv,
//           computedEnergy,
//         });
//         return;
//       }

//       const formattedEnergy = computedEnergy.toFixed(2);
//       setCheckinEnergyTransferred(formattedEnergy);
//       autoFilledCheckinEnergyRef.current = true;
//       toast.success(t("Energy auto-filled from BLE device data"), {
//         id: "checkin-energy-autofill",
//       });
//     },
//     [checkinEnergyTransferred, t]
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
//       // NOTE: This handler may be replaced by validation handlers temporarily
//       // When validation handlers register, they replace this handler
//       // When they unregister, this handler should be restored
//       // IMPORTANT: Check for active validation handlers before processing
//       const offMqttRecv = reg(
//         "mqttMsgArrivedCallBack",
//         (data: string, resp: any) => {
//           // FIRST check if there's an active validation handler
//           // If so, don't process - let the validation handler process it
//           // Validation handlers register themselves and should handle their own messages
//           const hasActiveValidationHandler = 
//             (window as any).__validationCorrelation_customer ||
//             (window as any).__validationCorrelation_payment ||
//             (window as any).__validationCorrelation_equipment ||
//             (window as any).__validationCorrelation_quota;
          
//           // Also check if this is a validation topic - if so, skip processing entirely
//           // Validation handlers will have registered themselves to handle these
//           let isValidationTopic = false;
//           try {
//             const parsedData = typeof data === "string" ? JSON.parse(data) : data;
//             let topic: string | undefined;
            
//             if (parsedData.topic) {
//               topic = parsedData.topic;
//             } else if (parsedData.data) {
//               const innerData = typeof parsedData.data === "string" 
//                 ? JSON.parse(parsedData.data) 
//                 : parsedData.data;
//               topic = innerData?.topic;
//             }
            
//             isValidationTopic = Boolean(topic && (
//               topic.includes("validate_customer_status") ||
//               topic.includes("validate_payment_status") ||
//               topic.includes("validate_equipment_condition") ||
//               topic.includes("validate_service_quota") ||
//               topic.includes("/validate")
//             ));
//           } catch (e) {
//             // If we can't parse, continue with other checks
//           }
          
//           if (hasActiveValidationHandler || isValidationTopic) {
//             console.info("=== setupBridge: Skipping message - validation handler should process ===");
//             console.info("Active validation handlers:", {
//               customer: !!(window as any).__validationCorrelation_customer,
//               payment: !!(window as any).__validationCorrelation_payment,
//               equipment: !!(window as any).__validationCorrelation_equipment,
//               quota: !!(window as any).__validationCorrelation_quota
//             });
//             console.info("Is validation topic:", isValidationTopic);
//             // Still acknowledge the message but don't process it
//             // The validation handler should have registered itself and will process it
//             resp({ success: true });
//             return;
//           }
          
//           console.info("=== setupBridge handler CALLED ===");
//           console.info("Raw data received:", data);
//           try {
//             // Handle different message formats
//             let parsedData: any;
//             try {
//               parsedData = typeof data === "string" ? JSON.parse(data) : data;
//             } catch (e) {
//               console.error("setupBridge: Failed to parse data:", e);
//               resp({ success: false, error: "Failed to parse message" });
//               return;
//             }
            
//             // Extract topic and message from different formats
//             let topic: string | undefined;
//             let rawMessageContent: any;
            
//             if (parsedData.topic && parsedData.message) {
//               // Direct format
//               topic = parsedData.topic;
//               rawMessageContent = parsedData.message;
//             } else if (parsedData.data) {
//               // Wrapped format - parse the data field
//               const innerData = typeof parsedData.data === "string" 
//                 ? JSON.parse(parsedData.data) 
//                 : parsedData.data;
//               topic = innerData.topic;
//               rawMessageContent = innerData.message;
//             } else {
//               console.error("setupBridge: Unknown message format:", parsedData);
//               resp({ success: false, error: "Unknown message format" });
//               return;
//             }

//             console.info("=== MQTT Message Received (setupBridge handler) ===");
//             console.info("Topic:", topic);
//             console.info("Raw Message:", rawMessageContent);

//             // Check if this is a validation topic - if so, don't process it here
//             // Validation topics are handled by runValidationStep handlers
//             const isValidationTopic = topic && (
//               topic.includes("validate_customer_status") ||
//               topic.includes("validate_payment_status") ||
//               topic.includes("validate_equipment_condition") ||
//               topic.includes("validate_service_quota") ||
//               topic.includes("/validate")
//             );
            
//             // Check if there's an active validation handler by checking for correlation IDs
//             const hasActiveValidationHandler = 
//               (window as any).__validationCorrelation_customer ||
//               (window as any).__validationCorrelation_payment ||
//               (window as any).__validationCorrelation_equipment ||
//               (window as any).__validationCorrelation_quota;
            
//             // If it's a validation topic OR there's an active validation handler, skip processing
//             // The validation handler should be registered and will handle it
//             if (isValidationTopic || hasActiveValidationHandler) {
//               if (isValidationTopic) {
//                 console.info("=== setupBridge: Skipping validation topic, validation handler should process it ===");
//                 console.info("=== setupBridge: Active validation handlers detected:", {
//                   customer: !!(window as any).__validationCorrelation_customer,
//                   payment: !!(window as any).__validationCorrelation_payment,
//                   equipment: !!(window as any).__validationCorrelation_equipment,
//                   quota: !!(window as any).__validationCorrelation_quota
//                 });
//               }
//               resp({ success: true });
//               return;
//             }
            
//             // Only process non-validation echo topics for customer identification
//             if (topic && topic.startsWith("echo/") && !isValidationTopic) {
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
                  
//                   // Extract paymentState and serviceStates from response
//                   const servicePlanData = responseData?.data?.metadata?.service_plan_data;
//                   if (servicePlanData) {
//                     const extractedPaymentState = servicePlanData.paymentState;
//                     const extractedServiceStates = servicePlanData.serviceStates || [];
//                     const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
//                     console.info("Extracted paymentState:", extractedPaymentState);
//                     console.info("Extracted serviceStates:", extractedServiceStates);
                    
//                     setPaymentState(extractedPaymentState);
//                     setServiceStates(extractedServiceStates);
//                     setCustomerType(inferredType ?? "first-time");
//                   } else {
//                     // Try alternative paths in case structure is different
//                     const altPaymentState = responseData?.data?.metadata?.paymentState || 
//                                            responseData?.metadata?.paymentState;
//                     const altServiceStates = responseData?.data?.metadata?.serviceStates ||
//                                             responseData?.metadata?.serviceStates ||
//                                             [];
//                     const inferredType = deriveCustomerTypeFromPayload(responseData);
                    
//                     if (altPaymentState) {
//                       setPaymentState(altPaymentState);
//                     }
//                     if (Array.isArray(altServiceStates) && altServiceStates.length > 0) {
//                       setServiceStates(altServiceStates);
//                     }
//                     setCustomerType(inferredType ?? "first-time");
//                   }
                  
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
              
//               // Extract last 6 characters from QR code (matching keypad logic)
//               const qrCode = qrVal.slice(-6).toLowerCase();
//               console.info("Extracted QR code (last 6 chars):", qrCode);
              
//               // Get current detected BLE devices
//               const currentDevices = detectedBleDevicesRef.current;
//               console.info("Current detected BLE devices:", currentDevices);
              
//               // Match QR code to BLE device name (last 6 characters)
//               const matches = currentDevices.filter((device) => {
//                 const name = (device.name || "").toLowerCase();
//                 const last6FromName = name.slice(-6);
//                 console.info(`Comparing QR "${qrCode}" with device "${name}" (last 6: "${last6FromName}")`);
//                 return last6FromName === qrCode;
//               });
              
//               if (matches.length === 1) {
//                 console.info("BLE device matched! Connecting to:", matches[0].macAddress);
//                 // Stop BLE scanning
//                 stopBleScan();
//                 // Connect to the matched BLE device
//                 connectBleDevice(matches[0].macAddress);
//                 // Store the equipment ID for check-in
//                 setCheckinEquipmentId(qrCode);
//                 // Keep scanning state active until connection is established
//                 // setIsScanningCheckin will be set to false in BLE connection success handler
//               } else if (matches.length === 0) {
//                 console.error("No BLE device found matching QR code:", qrCode);
//                 toast.error(t("No BLE device found matching the QR code. Please ensure the device is nearby and try again."));
//                 setIsScanningCheckin(false);
//                 scanTypeRef.current = null;
//                 stopBleScan();
//               } else {
//                 console.error("Multiple BLE devices found matching QR code:", qrCode);
//                 toast.error(t("Multiple devices found. Please try scanning again."));
//                 setIsScanningCheckin(false);
//                 scanTypeRef.current = null;
//                 stopBleScan();
//               }
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

//       // BLE device discovery handler for check-in
//       const offFindBle = reg(
//         "findBleDeviceCallBack",
//         (
//           data: string,
//           resp: (r: { success: boolean; error?: string }) => void
//         ) => {
//           try {
//             // Only process BLE devices during check-in scan
//             if (scanTypeRef.current !== "checkin") {
//               resp({ success: true });
//               return;
//             }
            
//             const d: any = JSON.parse(data);
//             // Filter: Only process devices with "OVES" in the name (same as keypad)
//             if (d.macAddress && d.name && d.rssi && d.name.includes("OVES")) {
//               const raw = Number(d.rssi);
//               const formattedRssi = convertRssiToFormattedString(raw);
              
//               const device: BleDevice = {
//                 macAddress: d.macAddress,
//                 name: d.name,
//                 rssi: formattedRssi,
//                 rawRssi: raw,
//               };
              
//               setDetectedBleDevices((prev) => {
//                 const exists = prev.some((p) => p.macAddress === d.macAddress);
//                 const next = exists
//                   ? prev.map((p) =>
//                       p.macAddress === d.macAddress
//                         ? { ...p, rssi: formattedRssi, rawRssi: raw } // Update existing
//                         : p
//                     )
//                   : [...prev, device]; // Add new device
//                 return [...next].sort((a, b) => b.rawRssi - a.rawRssi); // Sort by signal strength
//               });
              
//               resp({ success: true });
//             } else {
//               console.warn("Invalid BLE device data format or not OVES device:", d);
//             }
//           } catch (err: any) {
//             console.error("Error parsing BLE device data:", err);
//             resp({ success: false, error: err.message });
//           }
//         }
//       );

//       // BLE connection success handler
//       const offBleConnectSuccess = reg(
//         "bleConnectSuccessCallBack",
//         (macAddress: string, resp: any) => {
//           console.info("BLE connection successful for check-in:", macAddress);
//           sessionStorage.setItem("connectedDeviceMac", macAddress);
//           setConnectedBleDevice(macAddress);
//           setIsConnectingBle(false);
//           setBleConnectionProgress(100);
//           setIsScanningCheckin(false);
//           stopBleScan();
//           scanTypeRef.current = null;
//           toast.success(t("BLE device connected successfully"));
//           setDtaServiceData(null);
//           autoFilledCheckinEnergyRef.current = false;
//           initServiceBleData(
//             {
//               serviceName: "DTA",
//               macAddress,
//             },
//             () => {
//               console.info("Requested DTA service data for mac:", macAddress);
//             }
//           );
//           resp(macAddress);
//         }
//       );

//       // BLE connection failure handler
//       const offBleConnectFail = reg(
//         "bleConnectFailCallBack",
//         (data: string, resp: any) => {
//           console.error("BLE connection failed:", data);
//           setIsConnectingBle(false);
//           setBleConnectionProgress(0);
//           setIsScanningCheckin(false);
//           stopBleScan();
//           scanTypeRef.current = null;
//           toast.error(t("BLE connection failed. Please try again."));
//           resp(data);
//         }
//       );

//       // BLE connection progress handler (optional, for UI feedback)
//       const offBleConnectProgress = reg(
//         "bleInitDataOnProgressCallBack",
//         (data: string) => {
//           try {
//             const p = JSON.parse(data);
//             const progress = Math.round((p.progress / p.total) * 100);
//             setBleConnectionProgress(progress);
//           } catch (err) {
//             console.error("Progress callback error:", err);
//           }
//         }
//       );

//       const offBleInitServiceComplete = reg(
//         "bleInitServiceDataOnCompleteCallBack",
//         (data: string, resp: any) => {
//           try {
//             const parsedData = typeof data === "string" ? JSON.parse(data) : data;
//             if (parsedData?.serviceNameEnum === "DTA_SERVICE") {
//               setDtaServiceData(parsedData);
//               populateEnergyFromDta(parsedData);
//             }
//             resp(parsedData);
//           } catch (err) {
//             console.error("Error parsing BLE service data:", err);
//             resp({ success: false, error: String(err) });
//           }
//         }
//       );

//       const offBleInitServiceFail = reg(
//         "bleInitServiceDataFailureCallBack",
//         (data: string) => {
//           console.error("Failed to initialize DTA service:", data);
//           toast.error(t("Unable to read device energy data. Please try again."));
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

//       // Generate unique client ID to avoid conflicts when multiple devices connect
//       // Format: attendant-{timestamp}-{random}
//       const generateClientId = () => {
//         const timestamp = Date.now();
//         const random = Math.random().toString(36).substring(2, 9);
//         return `attendant-${ATTENDANT_ID}-${timestamp}-${random}`;
//       };

//       const mqttConfig: MqttConfig = {
//         username: "Admin",
//         password: "7xzUV@MT",
//         clientId: generateClientId(),
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
//         offFindBle();
//         offBleConnectSuccess();
//         offBleConnectFail();
//         offBleConnectProgress();
//         offBleInitServiceComplete();
//         offBleInitServiceFail();
//         // Stop BLE scanning on cleanup
//         if (window.WebViewJavascriptBridge) {
//           window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
//         }
//       };
//     },
//     [handleCustomerIdentification, handleEquipmentIdentification, convertRssiToFormattedString, stopBleScan, connectBleDevice, populateEnergyFromDta, t]
//   );

//   useEffect(() => {
//     if (bridge) {
//       // Check if there's an active validation handler or validation in progress
//       // This prevents setupBridge from replacing validation handlers
//       const hasActiveValidationHandler = 
//         (window as any).__validationCorrelation_customer ||
//         (window as any).__validationCorrelation_payment ||
//         (window as any).__validationCorrelation_equipment ||
//         (window as any).__validationCorrelation_quota;
      
//       const validationInProgress = (window as any).__validationInProgress === true;
      
//       if (hasActiveValidationHandler || validationInProgress) {
//         console.info("setupBridge useEffect: Validation active, skipping handler registration to avoid conflicts", {
//           hasActiveValidationHandler,
//           validationInProgress,
//           customer: !!(window as any).__validationCorrelation_customer,
//           payment: !!(window as any).__validationCorrelation_payment,
//           equipment: !!(window as any).__validationCorrelation_equipment,
//           quota: !!(window as any).__validationCorrelation_quota
//         });
//         return;
//       }
      
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
//     setPaymentState(null);
//     setServiceStates([]);
//     scanTypeRef.current = "customer";
//     setIsScanningCustomer(true);
//     startQrCodeScan();
//   };

//   const handleStartEquipmentScan = () => {
//     setEquipmentData(null);
//     setEquipmentIdentified(false);
//     setEquipmentErrorMessage(null);
//     scanTypeRef.current = "equipment";
//     setIsScanningEquipment(true);
//     startQrCodeScan();
//   };

//   // Update ref when detectedBleDevices changes
//   useEffect(() => {
//     detectedBleDevicesRef.current = detectedBleDevices;
//   }, [detectedBleDevices]);

//   const handleStartCheckinScan = () => {
//     setCheckinEquipmentId(null);
//     setDetectedBleDevices([]);
//     setConnectedBleDevice(null);
//     setIsConnectingBle(false);
//     setBleConnectionProgress(0);
//     setCheckinEnergyTransferred("");
//     setDtaServiceData(null);
//     autoFilledCheckinEnergyRef.current = false;
//     scanTypeRef.current = "checkin";
//     setIsScanningCheckin(true);
//     // Start BLE scanning first
//     startBleScan();
//     // Then start QR scan after a short delay to allow BLE devices to be discovered
//     setTimeout(() => {
//       startQrCodeScan();
//     }, 500);
//   };

//   const handleStartCheckoutScan = () => {
//     setCheckoutEquipmentId(null);
//     scanTypeRef.current = "checkout";
//     setIsScanningCheckout(true);
//     startQrCodeScan();
//   };

//   const handleStartSwap = () => {
//     setCustomerType(null);
//     setIsSwapModalOpen(true);
//     setCurrentPhase("A1");
//     handleStartCustomerScan();
//   };

//   const resetFlow = useCallback(() => {
//     setCustomerData(null);
//     setEquipmentData(null);
//     setCustomerIdentified(false);
//     setCustomerIdentificationResponse({ received: false });
//     setEquipmentIdentified(false);
//     setEquipmentIdentificationResponse({ received: false });
//     setEquipmentErrorMessage(null);
//     setPaymentState(null);
//     setServiceStates([]);
//     setIsScanningCustomer(false);
//     setIsScanningEquipment(false);
//     setIsScanningCheckin(false);
//     setIsScanningCheckout(false);
//     setCheckinEquipmentId(null);
//     setCheckoutEquipmentId(null);
//     setCheckoutEnergyTransferred("");
//     setCheckinEnergyTransferred("");
//     setDetectedBleDevices([]);
//     setIsScanningBle(false);
//     setIsConnectingBle(false);
//     setConnectedBleDevice(null);
//     setBleConnectionProgress(0);
//     setDtaServiceData(null);
//     autoFilledCheckinEnergyRef.current = false;
//     setDynamicPlanId(""); // Reset plan_id
//     scanTypeRef.current = null;
//     setCurrentPhase("A1");
//     setCustomerType(null);
//     setValidationStatus({});
//     setValidationResults({});
//     setIsRunningValidations(false);
//     setIsRunningPhase3(false);
//     setPhase3Status({});
//     setIsSwapModalOpen(false);
//     hasScrolledToEquipmentRef.current = false;
//     (window as any).__customerIdentificationCorrelationId = null;
//     (window as any).__equipmentIdentificationCorrelationId = null;
//   }, []);

//   useEffect(() => {
//     if (!customerIdentified) {
//       hasScrolledToEquipmentRef.current = false;
//     }

//     if (
//       isSwapModalOpen &&
//       customerType === "returning" &&
//       customerIdentified &&
//       equipmentSectionRef.current &&
//       !hasScrolledToEquipmentRef.current
//     ) {
//       hasScrolledToEquipmentRef.current = true;
//       equipmentSectionRef.current.scrollIntoView({
//         behavior: "smooth",
//         block: "start",
//       });
//     }
//   }, [isSwapModalOpen, customerType, customerIdentified]);

//   useEffect(() => {
//     if (customerType && !isSwapModalOpen) {
//       setIsSwapModalOpen(true);
//     }
//   }, [customerType, isSwapModalOpen]);

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
//       (window as any).__validationInProgress = false;
//       return;
//     }

//     // Clean up any lingering equipment identification handlers before starting validation
//     // This ensures validation handlers can properly register and receive messages
//     console.info("=== Cleaning up equipment identification handlers before validation ===");
//     (window as any).__equipmentIdentificationCorrelationId = null;
//     (window as any).__customerIdentificationCorrelationId = null;
    
//     // Mark that validation is starting - this prevents setupBridge from replacing handlers
//     // We'll set the correlation ID immediately so setupBridge knows validation is active
//     // The actual correlation ID will be set when each validation step runs
//     (window as any).__validationInProgress = true;
//     (window as any).__validationWillStartSoon = false; // Clear the "will start soon" flag

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
//       // Add a small delay to ensure any previous handlers are fully cleaned up
//       // This is especially important for returning customers where equipment identification
//       // handlers might still be active
//       await new Promise(resolve => setTimeout(resolve, 200));
      
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
//         const signalError = summarizeSignals(err?.response);
//         setValidationResults((prev: any) => ({
//           ...prev,
//           customer: {
//             error: signalError || err?.message || "Customer validation failed",
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
//         timestamp: new Date().toISOString(),
//             plan_id: dynamicPlanId,
//             correlation_id: correlationId,
//         actor: {
//           type: "attendant",
//               id: "attendant-001",
//         },
//         data: {
//           action: "VALIDATE_PAYMENT_STATUS",
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
//         const signalError = summarizeSignals(err?.response);
//         setValidationResults((prev: any) => ({
//           ...prev,
//           payment: {
//             error: signalError || err?.message || "Payment validation failed",
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
//           const signalError = summarizeSignals(err?.response);
//           setValidationResults((prev: any) => ({
//             ...prev,
//             equipment: {
//               error: signalError || err?.message || "Equipment validation failed",
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
//         const signalError = summarizeSignals(err?.response);
//         setValidationResults((prev: any) => ({
//           ...prev,
//           quota: {
//             error: signalError || err?.message || "Service quota validation failed",
//             response: err?.response,
//           },
//         }));
//         setIsRunningValidations(false);
//         return;
//       }

//       setIsRunningValidations(false);
//       // Clear validation in progress flag when all validations complete
//       (window as any).__validationInProgress = false;
//     };

//     run().catch((err) => {
//       console.error("Unexpected validation error", err);
//       setIsRunningValidations(false);
//       // Clear validation in progress flag on error
//       (window as any).__validationInProgress = false;
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
//           {details?.error ||
//             details?.message ||
//             summarizeSignals(details?.response) ||
//             t("Validation failed")}
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

//     if (isRunningPhase4) {
//       console.info("Phase 4 already running. Skipping duplicate trigger.");
//       return;
//     }

//     setIsRunningPhase4(true);
//     setPhase4Status({ activity: "pending", usage: "pending" });

//     try {
//       console.info("=== Starting Phase 4 Operations ===");

//       mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/activity_report`, {
//         timestamp: new Date().toISOString(),
//         plan_id: dynamicPlanId,
//         correlation_id: `att-activity-${Date.now()}`,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "REPORT_ATTENDANT_ACTIVITY",
//           activity_type: "battery_swap_completed",
//           activity_data: JSON.stringify({
//             duration: 180,
//             customer_satisfaction: "high",
//           }),
//           attendant_station: STATION,
//         },
//       });

//       mqttPublish(`emit/uxi/attendant/plan/${dynamicPlanId}/workflow_update`, {
//         timestamp: new Date().toISOString(),
//         plan_id: dynamicPlanId,
//         correlation_id: `att-workflow-${Date.now()}`,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "UPDATE_WORKFLOW_STATE",
//           workflow_stage: "A3",
//           stage_transition: "A3_to_A4",
//           process_status: "completed",
//           performance_metrics: JSON.stringify({
//             duration: 300,
//             efficiency: 0.95,
//           }),
//         },
//       });

//       setPhase4Status((prev) => ({ ...prev, activity: "success" }));

//       const formattedCheckoutId = checkoutEquipmentId
//         ? `BAT_NEW_ATT_${checkoutEquipmentId}`
//         : "BAT_NEW_ATT_001";
//       const formattedCheckinId = checkinEquipmentId
//         ? `BAT_RETURN_ATT_${checkinEquipmentId}`
//         : null;

//       const checkoutEnergy = checkoutEnergyTransferred.trim()
//         ? parseFloat(checkoutEnergyTransferred)
//         : 0;
//       const checkinEnergy = checkinEnergyTransferred.trim()
//         ? parseFloat(checkinEnergyTransferred)
//         : 0;

//       let energyTransferred = 0;
//       if (customerType === "returning") {
//         energyTransferred = checkoutEnergy - checkinEnergy;
//       } else {
//         energyTransferred = checkoutEnergy;
//       }
//       if (energyTransferred < 0) {
//         energyTransferred = 0;
//       }

//       const serviceCompletionDetails: Record<string, any> = {
//         new_battery_id: formattedCheckoutId,
//         energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
//         service_duration: 240,
//         attendant_station: STATION,
//         customer_id: customerData?.customer_id,
//         checkin_equipment_id: checkinEquipmentId,
//         checkout_equipment_id: checkoutEquipmentId,
//         timestamp: new Date().toISOString(),
//       };

//       if (customerType === "returning" && formattedCheckinId) {
//         serviceCompletionDetails.old_battery_id = formattedCheckinId;
//       }

//       mqttPublish(`emit/uxi/billing/plan/${dynamicPlanId}/usage_report`, {
//         timestamp: new Date().toISOString(),
//         plan_id: dynamicPlanId,
//         correlation_id: `att-usage-report-${Date.now()}`,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "REPORT_SERVICE_USAGE_TO_ODOO",
//           usage_type: "battery_swap_completed",
//           service_completion_details: JSON.stringify(serviceCompletionDetails),
//         },
//       });

//       setPhase4Status((prev) => ({ ...prev, usage: "success" }));

//       console.info("=== Phase 4 Operations Completed ===");

//       setTimeout(() => {
//         resetFlow();
//         setIsRunningPhase4(false);
//         setPhase4Status({});
//       }, 600);
//     } catch (error) {
//       console.error("Phase 4 operations failed:", error);
//       setIsRunningPhase4(false);
//       setPhase4Status({
//         activity: "error",
//         usage: "error",
//       });
//     }
//   }, [
//     dynamicPlanId,
//     checkoutEquipmentId,
//     checkinEquipmentId,
//     customerType,
//     checkoutEnergyTransferred,
//     checkinEnergyTransferred,
//     mqttPublish,
//     resetFlow,
//     isRunningPhase4,
//     customerData?.customer_id,
//   ]);

//   const handleSwapComplete = useCallback(() => {
//     runPhase4Operations();
//   }, [runPhase4Operations]);

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

//     // Calculate energy transferred based on customer type
//     // For returning customers: energy_transferred = checkout_energy - checkin_energy
//     // For first-time customers: energy_transferred = checkout_energy
//     const checkoutEnergy = checkoutEnergyTransferred.trim()
//       ? parseFloat(checkoutEnergyTransferred)
//       : 0;
//     const checkinEnergy = checkinEnergyTransferred.trim()
//       ? parseFloat(checkinEnergyTransferred)
//       : 0;
    
//     let energyTransferred = 0;
//     if (customerType === "returning") {
//       // For returning customers, calculate the difference
//       energyTransferred = checkoutEnergy - checkinEnergy;
//       console.info(`[Checkout] Returning customer - Energy calculation: ${checkoutEnergy} (checkout) - ${checkinEnergy} (checkin) = ${energyTransferred} kWh`);
//     } else {
//       // For first-time customers, use checkout energy directly
//       energyTransferred = checkoutEnergy;
//       console.info(`[Checkout] First-time customer - Energy transferred: ${energyTransferred} kWh`);
//     }
    
//     // Ensure energy is not negative
//     if (energyTransferred < 0) {
//       console.warn(`[Checkout] Calculated energy is negative (${energyTransferred}), setting to 0`);
//       energyTransferred = 0;
//     }

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
//   }, [bridge, checkoutEquipmentId, checkoutEnergyTransferred, checkinEnergyTransferred, customerType, dynamicPlanId, runPhase4Operations]);

//   // Auto-progression: Customer identification success → start validation
//   useEffect(() => {
//     if (
//       isSwapModalOpen &&
//       customerIdentified &&
//       customerIdentificationResponse.status === "success" &&
//       currentPhase === "A1" &&
//       !isRunningValidations &&
//       Object.keys(validationStatus).length === 0
//     ) {
//       // For returning customers, also wait for equipment identification
//       if (customerType === "returning" && !equipmentIdentified) {
//         return;
//       }
      
//       console.info("Auto-progressing: Customer identified, starting validation...");
//       setCurrentPhase("A2");
//       handleStartValidations();
//     }
//   }, [
//     isSwapModalOpen,
//     customerIdentified,
//     customerIdentificationResponse.status,
//     currentPhase,
//     isRunningValidations,
//     validationStatus,
//     handleStartValidations,
//     customerType,
//     equipmentIdentified,
//   ]);

//   // Auto-progression: Validation success → show checkin (returning) or checkout (first-time)
//   useEffect(() => {
//     if (
//       isSwapModalOpen &&
//       allValidationsComplete() &&
//       currentPhase === "A2" &&
//       !isRunningValidations
//     ) {
//       console.info("Auto-progressing: Validations complete, moving to transaction execution...");
//       setCurrentPhase("A3");
//       // For returning customers, checkin will be shown first
//       // For first-time customers, checkout will be shown directly
//     }
//   }, [
//     isSwapModalOpen,
//     currentPhase,
//     isRunningValidations,
//     validationStatus,
//     equipmentIdentified,
//     equipmentData,
//   ]);

//   // Auto-progression: Checkin success → show checkout (for returning customers)
//   useEffect(() => {
//     if (
//       isSwapModalOpen &&
//       customerType === "returning" &&
//       currentPhase === "A3" &&
//       phase3Status.checkin === "success" &&
//       phase3Status.checkout !== "success"
//     ) {
//       console.info("Auto-progressing: Checkin complete, ready for checkout...");
//       // Checkout UI will be shown automatically since checkin is successful
//     }
//   }, [
//     isSwapModalOpen,
//     customerType,
//     currentPhase,
//     phase3Status.checkin,
//     phase3Status.checkout,
//   ]);

//   const renderCustomerAndEquipmentSection = () => {
//     const stepTitle =
//       customerType === "returning"
//         ? t("Returning Customer Swap")
//         : customerType === "first-time"
//         ? t("First-Time Customer Swap")
//         : t("Battery Swap");
      
//       return (
//       <div className="space-y-6">
//           {/* Customer Identification */}
//           <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//             <div className="flex items-center gap-3 mb-4">
//               <User className="w-6 h-6 text-blue-400" />
//               <h3 className="text-lg font-semibold text-white">
//                 {t("Customer Identification")}
//               </h3>
//             </div>

//             {!customerIdentified ? (
//               <div className="space-y-4">
//                 {!customerData ? (
//                   <>
//                     <p className="text-gray-400 text-sm">
//                       {t("Scan customer QR code to identify")}
//                     </p>
//                     <button
//                       onClick={handleStartCustomerScan}
//                       disabled={isScanningCustomer}
//                       className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
//                     >
//                       {isScanningCustomer ? (
//                         <>
//                           <Loader2 className="w-5 h-5 animate-spin" />
//                           {t("Scanning...")}
//                         </>
//                       ) : (
//                         <>
//                           <QrCode className="w-5 h-5" />
//                           {t("Scan Customer QR Code")}
//                         </>
//                       )}
//                     </button>
//                   </>
//                 ) : (
//                   <div className="space-y-3">
//                     {!customerIdentificationResponse.received ? (
//                       <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
//                         <div className="flex items-center gap-2 text-yellow-400 mb-2">
//                           <Loader2 className="w-5 h-5 animate-spin" />
//                           <span className="font-medium">{t("Processing...")}</span>
//                         </div>
//                         <p className="text-xs text-gray-400">
//                           {t("Identification in progress.")}
//                         </p>
//                       </div>
//                     ) : customerIdentificationResponse.status === "error" ? (
//                       <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
//                         <div className="flex items-center gap-2 text-red-400 mb-2">
//                           <XCircle className="w-5 h-5" />
//                           <span className="font-medium">
//                             {t("Identification Failed")}
//                           </span>
//                         </div>
//                         <p className="text-xs text-gray-400">
//                           {customerIdentificationResponse.data?.error ||
//                             t("Customer identification failed. Please try again.")}
//                         </p>
//                         <button
//                           onClick={() => {
//                             setCustomerData(null);
//                             setCustomerIdentificationResponse({ received: false });
//                             handleStartCustomerScan();
//                           }}
//                           className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
//                         >
//                           {t("Retry Scan")}
//                         </button>
//                       </div>
//                     ) : null}
//                   </div>
//                 )}
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 <div className="flex items-center gap-2 text-green-400">
//                   <CheckCircle className="w-5 h-5" />
//                   <span className="font-medium">{t("Customer Identified")}</span>
//                 </div>
//                 {customerData && (
//                   <div className="bg-gray-600 rounded-lg p-4 space-y-3">
//                     <p className="text-sm text-gray-300">
//                       <span className="font-medium text-white">
//                         {t("Customer ID")}:
//                       </span>{" "}
//                       {formatDisplayValue(customerData.customer_id)}
//                     </p>
//                     <p className="text-sm text-gray-300">
//                       <span className="font-medium text-white">{t("Name")}:</span>{" "}
//                       {formatDisplayValue(
//                         customerData.name || customerData.product_name
//                       )}
//                     </p>
                    
//                     {/* Payment State */}
//                     {paymentState && (
//                       <div className="pt-2 border-t border-gray-500">
//                         <p className="text-sm text-gray-300">
//                           <span className="font-medium text-white">{t("Payment State")}:</span>{" "}
//                           <span className={`font-semibold ${
//                             paymentState === "CURRENT" ? "text-green-400" :
//                             paymentState === "OVERDUE" ? "text-red-400" :
//                             "text-yellow-400"
//                           }`}>
//                             {paymentState}
//                           </span>
//                         </p>
//                       </div>
//                     )}
                    
//                     {/* Service States */}
//                     {serviceStates && serviceStates.length > 0 && (
//                       <div className="pt-2 border-t border-gray-500">
//                         <p className="text-sm font-medium text-white mb-2">{t("Service States")}:</p>
//                         <div className="space-y-2">
//                           {serviceStates.map((service, index) => (
//                             <div key={index} className="bg-gray-700 rounded-lg p-3 space-y-1">
//                               <p className="text-xs text-gray-300">
//                                 <span className="font-medium text-white">{t("Service ID")}:</span>{" "}
//                                 {formatDisplayValue(service.service_id)}
//                               </p>
//                               <div className="flex items-center justify-between text-xs">
//                                 <span className="text-gray-300">
//                                   <span className="font-medium text-white">{t("Used")}:</span> {service.used}
//                                 </span>
//                                 <span className="text-gray-300">
//                                   <span className="font-medium text-white">{t("Quota")}:</span> {service.quota.toLocaleString()}
//                                 </span>
//                               </div>
//                               <p className="text-xs text-gray-300">
//                                 <span className="font-medium text-white">{t("Current Asset")}:</span>{" "}
//                                 {formatDisplayValue(service.current_asset, t("None"))}
//                               </p>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Equipment Identification (Returning Customers Only) */}
//           {customerIdentified && customerType === "returning" && (
//             <div
//               className="bg-gray-700 rounded-xl p-6 border border-gray-600"
//               ref={equipmentSectionRef}
//             >
//               <div className="flex items-center gap-3 mb-4">
//                 <Battery className="w-6 h-6 text-green-400" />
//                 <h3 className="text-lg font-semibold text-white">
//                   {t("Equipment Identification")}
//                 </h3>
//               </div>

//               {!equipmentIdentified ? (
//                 <div className="space-y-4">
//                   <p className="text-gray-400 text-sm">
//                     {t("Scan battery barcode to identify")}
//                   </p>
//                   <button
//                     onClick={handleStartEquipmentScan}
//                     disabled={isScanningEquipment}
//                     className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed"
//                   >
//                     {isScanningEquipment ? (
//                       <>
//                         <Loader2 className="w-5 h-5 animate-spin" />
//                         {t("Scanning...")}
//                       </>
//                     ) : (
//                       <>
//                         <QrCode className="w-5 h-5" />
//                         {t("Scan Equipment Barcode")}
//                       </>
//                     )}
//                   </button>
//                 </div>
//               ) : (
//                 <div className="space-y-3">
//                   <div className="flex items-center gap-2 text-green-400">
//                     <CheckCircle className="w-5 h-5" />
//                     <span className="font-medium">{t("Equipment Identified")}</span>
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>
//       );
//   };

//   const renderValidationSection = () => {
//       return (
//       <div className="space-y-6">
//           <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//             <div className="flex items-center gap-3 mb-4">
//               <Shield className="w-6 h-6 text-yellow-400" />
//               <h3 className="text-lg font-semibold text-white">
//                 {t("Running Validations...")}
//               </h3>
//             </div>

//             <div className="space-y-3">
//               <ValidationItem
//                 label={t("Customer Status")}
//                 status={validationStatus.customer}
//                 isLoading={isRunningValidations}
//               details={
//                 validationResults.customer?.signals &&
//                 Array.isArray(validationResults.customer.signals)
//                   ? {
//                       ...validationResults.customer,
//                       error:
//                         validationResults.customer.error ||
//                         validationResults.customer.signals.join(", "),
//                     }
//                   : validationResults.customer
//               }
//               />
//               <ValidationItem
//                 label={t("Payment Status")}
//                 status={validationStatus.payment}
//                 isLoading={isRunningValidations}
//                 details={validationResults.payment}
//               />
//               {equipmentIdentified && (
//                 <ValidationItem
//                   label={t("Equipment Condition")}
//                   status={validationStatus.equipment}
//                   isLoading={isRunningValidations}
//                   details={validationResults.equipment}
//                 />
//               )}
//               <ValidationItem
//                 label={t("Service Quota")}
//                 status={validationStatus.quota}
//                 isLoading={isRunningValidations}
//                 details={validationResults.quota}
//               />
//             </div>

//             {!isRunningValidations &&
//               Object.keys(validationStatus).length === 0 && (
//               <button
//                 onClick={handleStartValidations}
//                 className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 <Shield className="w-5 h-5" />
//                 {t("Start Validation")}
//               </button>
//             )}

//             {allValidationsComplete() && (
//               <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//                 <div className="flex items-center gap-2 text-green-400 mb-2">
//                   <CheckCircle className="w-5 h-5" />
//                   <span className="font-medium">{t("All Checks Passed!")}</span>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       );
//   };

//   const renderTransactionSection = () => {
//       return (
//       <div className="space-y-6">
//           <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
//             {/* Equipment Check-In */}
//             {customerType === "returning" && (
//               <>
//                 <div className="flex items-center gap-3 mb-2">
//                   <Battery className="w-6 h-6 text-orange-300" />
//                   <h3 className="text-lg font-semibold text-white">
//                     {t("Equipment Check-In")}
//                   </h3>
//                 </div>

//                 {isRunningPhase3 && phase3Status.checkin === "pending" && (
//                   <div className="flex items-center gap-2 text-yellow-400 mb-4">
//                     <Loader2 className="w-5 h-5 animate-spin" />
//                     <span>{t("Processing check-in...")}</span>
//                   </div>
//                 )}

//                 {phase3Status.checkin === "success" && (
//                   <div className="flex items-center gap-2 text-green-400 mb-4">
//                     <CheckCircle className="w-5 h-5" />
//                     <span>{t("Check-in successful")}</span>
//                   </div>
//                 )}

//                 {checkinEquipmentId && (
//                   <div className="bg-gray-600 rounded-lg p-3 mb-4">
//                     <p className="text-sm text-gray-300">
//                       <span className="font-medium text-white">
//                         {t("Equipment ID")}:
//                       </span>{" "}
//                       {formatDisplayValue(checkinEquipmentId)}
//                     </p>
//                   </div>
//                 )}

//                 {checkinEquipmentId && (
//                   <div className="mb-4">
//                     <label className="block text-sm font-medium text-gray-300 mb-2">
//                       {t("Energy at Check-In (kWh)")}
//                     </label>
//                     <input
//                       type="number"
//                       step="0.01"
//                       value={checkinEnergyTransferred}
//                       onChange={(e) => setCheckinEnergyTransferred(e.target.value)}
//                       className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white"
//                       placeholder="0.00"
//                     />
//                     <p className="text-xs text-gray-400 mt-1">
//                       {t("Enter the energy level of the returned battery")}
//                     </p>
//                   </div>
//                 )}

//                 {phase3Status.checkin !== "success" && (
//                   <div className="space-y-3">
//                     <button
//                       onClick={handleStartCheckinScan}
//                       disabled={isScanningCheckin}
//                       className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                     >
//                       {isScanningCheckin ? (
//                         <>
//                           <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
//                           <span className="whitespace-nowrap">{t("Scanning...")}</span>
//                         </>
//                       ) : (
//                         <>
//                           <QrCode className="w-4 h-4 flex-shrink-0" />
//                           <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
//                         </>
//                       )}
//                     </button>
//                     {checkinEquipmentId && 
//                     (phase3Status.checkin === "pending" ||
//                       phase3Status.checkin === "error" ||
//                       phase3Status.checkin === undefined) && (
//                       <button
//                         onClick={handleEquipmentCheckin}
//                         disabled={isRunningPhase3}
//                         className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                       >
//                         <span className="whitespace-nowrap">{t("Process Check-In")}</span>
//                       </button>
//                     )}
//                   </div>
//                 )}
//               </>
//             )}

//             {/* Equipment Checkout */}
//             {((customerType === "returning" && phase3Status.checkin === "success") ||
//               customerType === "first-time") && (
//               <>
//                 <div className="flex items-center gap-3 mb-2 mt-4">
//                   <PackageCheck className="w-6 h-6 text-blue-400" />
//                   <h3 className="text-lg font-semibold text-white">
//                     {t("Equipment Checkout")}
//                   </h3>
//                 </div>

//                 {isRunningPhase3 && phase3Status.checkout === "pending" && (
//                   <div className="flex items-center gap-2 text-yellow-400 mb-4">
//                     <Loader2 className="w-5 h-5 animate-spin" />
//                     <span>{t("Processing checkout...")}</span>
//                   </div>
//                 )}

//                 {phase3Status.checkout === "success" && (
//                   <div className="flex items-center gap-2 text-green-400 mb-4">
//                     <CheckCircle className="w-5 h-5" />
//                     <span>{t("Checkout successful")}</span>
//                   </div>
//                 )}

//                 {checkoutEquipmentId && (
//                   <div className="bg-gray-600 rounded-lg p-3 mb-4">
//                     <p className="text-sm text-gray-300">
//                       <span className="font-medium text-white">
//                         {t("Equipment ID")}:
//                       </span>{" "}
//                       {formatDisplayValue(checkoutEquipmentId)}
//                     </p>
//                   </div>
//                 )}

//                 {checkoutEquipmentId && (
//                   <div className="mb-4">
//                     <label className="block text-sm font-medium text-gray-300 mb-2">
//                       {customerType === "returning" 
//                         ? t("Energy at Checkout (kWh)")
//                         : t("Energy Transferred (kWh)")}
//                     </label>
//                     <input
//                       type="number"
//                       step="0.01"
//                       value={checkoutEnergyTransferred}
//                       onChange={(e) => setCheckoutEnergyTransferred(e.target.value)}
//                       className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white"
//                       placeholder="0.00"
//                     />
//                     <p className="text-xs text-gray-400 mt-1">
//                       {customerType === "returning"
//                       ? t(
//                           "Enter the energy level of the new battery. Energy transferred will be calculated as: Checkout - Check-in"
//                         )
//                         : t("Enter the energy level of the new battery")}
//                     </p>
//                   </div>
//                 )}

//                 {phase3Status.checkout !== "success" && (
//                   <div className="space-y-3">
//                     <button
//                       onClick={handleStartCheckoutScan}
//                       disabled={isScanningCheckout}
//                       className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                     >
//                       {isScanningCheckout ? (
//                         <>
//                           <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
//                           <span className="whitespace-nowrap">{t("Scanning...")}</span>
//                         </>
//                       ) : (
//                         <>
//                           <QrCode className="w-4 h-4 flex-shrink-0" />
//                           <span className="whitespace-nowrap">{t("Scan Equipment")}</span>
//                         </>
//                       )}
//                     </button>
//                     {checkoutEquipmentId && 
//                     (phase3Status.checkout === "pending" ||
//                       phase3Status.checkout === "error" ||
//                       phase3Status.checkout === undefined) && (
//                       <button
//                         onClick={handleEquipmentCheckout}
//                         disabled={isRunningPhase3}
//                         className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//                       >
//                         <span className="whitespace-nowrap">{t("Process Checkout")}</span>
//                       </button>
//                     )}
//                   </div>
//                 )}
//               </>
//             )}

//           {((customerType === "returning" &&
//             phase3Status.checkin === "success" &&
//             phase3Status.checkout === "success") ||
//             (customerType === "first-time" &&
//               phase3Status.checkout === "success")) && (
//             <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-3">
//               <div className="flex items-center gap-2 text-green-400">
//                 <CheckCircle className="w-5 h-5" />
//                 <span className="font-medium">{t("Swap ready to finalize")}</span>
//               </div>
//               <button
//                 onClick={handleSwapComplete}
//                 disabled={isRunningPhase4}
//                 className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
//               >
//                 {isRunningPhase4 ? (
//                   <>
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                     {t("Completing...")}
//                   </>
//                 ) : (
//                   <span>{t("Swap Complete")}</span>
//                 )}
//               </button>
//               {(phase4Status.activity === "error" || phase4Status.usage === "error") && (
//                 <p className="text-xs text-red-300">
//                   {t("Reporting failed. Please try again.")}
//                 </p>
//               )}
//             </div>
//           )}
//           </div>
//         </div>
//       );
//   };

//   // Render modal content for unified swap workflow
//   const renderModalContent = () => {
//     const shouldShowValidation =
//       currentPhase === "A2" || currentPhase === "A3";
//     const shouldShowTransactions = currentPhase === "A3";

//     return (
//       <div className="space-y-6 p-4">
//         {renderCustomerAndEquipmentSection()}
//         {shouldShowValidation && renderValidationSection()}
//         {shouldShowTransactions && renderTransactionSection()}
//       </div>
//     );
//   };

//   // Render modal if swap modal is open
//   if (isSwapModalOpen) {
//     const isReturning = customerType === "returning";
//     const isFirstTime = customerType === "first-time";
//     const isSwapComplete = isReturning
//       ? phase3Status.checkin === "success" && phase3Status.checkout === "success"
//       : isFirstTime
//       ? phase3Status.checkout === "success"
//       : false;

//     const modalTitle = t("Battery Swap");

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//         <div className="bg-[#1A1D22] border border-gray-700 rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
//           <div className="flex justify-between items-center p-4 border-b border-gray-700">
//             <h2 className="text-xl font-bold text-white">
//               {modalTitle}
//             </h2>
//             {!isSwapComplete && (
//               <button
//                 onClick={resetFlow}
//                 className="text-gray-400 hover:text-white bg-gray-800 rounded-full p-1 transition-colors"
//                 title={t("Cancel")}
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             )}
//           </div>
//           <div className="overflow-y-auto flex-1" ref={modalScrollContainerRef}>
//             {renderModalContent()}
//           </div>
//         </div>
//       </div>
//     );
//   }


//   if (!isSwapModalOpen) {
//     return (
//       <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex">
//         <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-none md:rounded-r-2xl shadow-2xl space-y-6 p-8 md:p-10 text-center">
//           <h1 className="text-2xl font-bold text-white mb-4">
//             {t("Start Swap")}
//           </h1>
//           <button
//             onClick={handleStartSwap}
//             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-200"
//           >
//             <QrCode className="w-5 h-5" />
//             {t("Start Swap")}
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return null;
// };

// const summarizeSignals = (payload?: any) => {
//   if (!payload) {
//     return undefined;
//   }
//   const collected = new Set<string>();
//   const pushSignals = (signals?: any) => {
//     if (Array.isArray(signals)) {
//       signals.forEach((signal) => {
//         if (typeof signal === "string") {
//           collected.add(signal);
//         }
//       });
//     }
//   };
//   pushSignals(payload?.signals);
//   pushSignals(payload?.data?.signals);
//   pushSignals(payload?.metadata?.signals);
//   if (collected.size === 0) {
//     return undefined;
//   }
//   return Array.from(collected).join(", ");
// };

// export default Swap;