"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
// import { toast } from "react-hot-toast";
import { Camera, Loader2, CheckCircle, XCircle, Battery, User, UserPlus, QrCode, Shield, CreditCard, PackageCheck, AlertTriangle } from "lucide-react";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from '@/i18n';

// ABS topics use hardcoded payloads as per docs; publish via bridge like BLE page
const PLAN_ID = "bss-plan-weekly-freedom-nairobi-v2-plan5";
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
    phone?: string;
    partner_id?: number;
    company_id?: number;
  } | null;
}

const Swap: React.FC<SwapProps> = ({ customer }) => {
  const { t } = useI18n();
  const { bridge } = useBridge();
  const [currentPhase, setCurrentPhase] = useState<"A1" | "A2" | "A3" | "A4">("A1");
  const [customerType, setCustomerType] = useState<"first-time" | "returning" | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [equipmentData, setEquipmentData] = useState<any>(null);
  const [isScanningCustomer, setIsScanningCustomer] = useState<boolean>(false);
  const [isScanningEquipment, setIsScanningEquipment] = useState<boolean>(false);
  const [customerIdentified, setCustomerIdentified] = useState<boolean>(false);
  const [equipmentIdentified, setEquipmentIdentified] = useState<boolean>(false);
  
  // Phase A2 validation states
  const [validationStatus, setValidationStatus] = useState<{
    customer?: "pending" | "success" | "error";
    payment?: "pending" | "success" | "error";
    equipment?: "pending" | "success" | "error";
    quota?: "pending" | "success" | "error";
  }>({});
  const [isRunningValidations, setIsRunningValidations] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<any>({});
  // Phase A3 states (Transaction Execution)
  const [isRunningPhase3, setIsRunningPhase3] = useState<boolean>(false);
  const [phase3Status, setPhase3Status] = useState<{
    checkin?: "pending" | "success" | "error";
    checkout?: "pending" | "success" | "error";
    payment?: "pending" | "success" | "error";
  }>({});
  // Phase A4 states (Reporting)
  const [isRunningPhase4, setIsRunningPhase4] = useState<boolean>(false);
  const [phase4Status, setPhase4Status] = useState<{
    activity?: "pending" | "success" | "error";
    usage?: "pending" | "success" | "error";
  }>({});
  
  const bridgeInitRef = useRef(false);
  const scanTypeRef = useRef<"customer" | "equipment" | null>(null);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

  const formatDisplayValue = (value?: string | number, fallback?: string) => {
    if (value === undefined || value === null || value === "") {
      return fallback ?? t("N/A");
    }
    const strValue = String(value);
    return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
  };

  const mqttPublish = useCallback((topic: string, content: any) => {
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
  }, [t]);

  const handleCustomerIdentification = useCallback(
    (qrCodeData: string) => {
      // Simplified: treat the scanned QR as successful identification
      setCustomerIdentified(true);
      setIsScanningCustomer(false);
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
            ? parsedData.customer_id || parsedData.customerId || parsedData.customer?.id || qrCodeData
            : qrCodeData,
        subscription_code:
          typeof parsedData === "object"
            ? parsedData.subscription_code || parsedData.subscriptionCode || parsedData.subscription?.code
            : undefined,
        product_name:
          typeof parsedData === "object"
            ? parsedData.product_name || parsedData.productName || parsedData.product?.name
            : undefined,
        name: typeof parsedData === "object" ? parsedData.name || parsedData.customer_name : undefined,
        phone: typeof parsedData === "object" ? parsedData.phone || parsedData.phone_number : undefined,
        raw: qrCodeData,
      };

      setCustomerData(normalizedData);
      // toast.success(t("Customer identified successfully"));

      // Publish hardcoded payload to ABS topic (emit/identify_customer)
      const topic = `emit/uxi/attendant/plan/${PLAN_ID}/identify_customer`;
      const payload = {
        timestamp: new Date().toISOString(),
        plan_id: PLAN_ID,
        correlation_id: `att-customer-id-${Date.now()}`,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "IDENTIFY_CUSTOMER",
          qr_code_data: qrCodeData,
          customer_id: normalizedData.customer_id,
          subscription_code: normalizedData.subscription_code,
          product_name: normalizedData.product_name,
          attendant_station: STATION,
        },
      };
      mqttPublish(topic, payload);
    },
    [t, mqttPublish]
  );

  const handleEquipmentIdentification = useCallback(
    (equipmentBarcode: string) => {
      // Simplified: treat the scanned code as successful identification
      setEquipmentIdentified(true);
      setIsScanningEquipment(false);
      
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
        normalizedEquipmentId = parsedData.equipment_id || 
                                parsedData.equipmentId || 
                                parsedData.id || 
                                parsedData.barcode || 
                                equipmentBarcode;
      } else {
        normalizedEquipmentId = equipmentBarcode;
      }

      // Ensure it's always a string (keep full value for MQTT, truncate only for display)
      const equipmentIdString = String(normalizedEquipmentId || "");
      setEquipmentData(equipmentIdString);
      // toast.success(t("Equipment identified successfully"));

      // Publish hardcoded payload to ABS topic (call/identify_equipment)
      const topic = `call/uxi/attendant/plan/${PLAN_ID}/identify_equipment`;
      const payload = {
        timestamp: new Date().toISOString(),
        plan_id: PLAN_ID,
        correlation_id: `att-equip-id-${Date.now()}`,
        actor: { type: "attendant", id: ATTENDANT_ID },
        data: {
          action: "IDENTIFY_EQUIPMENT",
          equipment_barcode: normalizedEquipmentId,
          attendant_station: STATION,
        },
      };
      mqttPublish(topic, payload);
    },
    [t, mqttPublish]
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

      // MQTT message callback (optional consume)
      const offMqttRecv = reg(
        "mqttMessageReceived",
        (data: string, resp: any) => {
          try {
            JSON.parse(data);
            resp("ok");
          } catch (err) {
            resp({ error: String(err) });
          }
        }
      );

      // QR code scan callback
      const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
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
          } else {
            console.warn("QR code scanned but no active scan type:", scanTypeRef.current);
            // toast.error(t("No active scan session"));
          }

          resp({ success: true });
        } catch (err) {
          console.error("Error processing QR code data:", err);
          // toast.error(t("Error processing QR code"));
          setIsScanningCustomer(false);
          setIsScanningEquipment(false);
          scanTypeRef.current = null;
          resp({ success: false, error: String(err) });
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
          if (p.error) console.error("MQTT connection error:", p.error.message);
        } catch (err) {
          console.error("Error parsing MQTT response:", err);
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

  const resetFlow = () => {
    setCustomerData(null);
    setEquipmentData(null);
    setCustomerIdentified(false);
    setEquipmentIdentified(false);
    setIsScanningCustomer(false);
    setIsScanningEquipment(false);
    scanTypeRef.current = null;
    setCurrentPhase("A1");
    setCustomerType(null);
    setValidationStatus({});
    setValidationResults({});
    setIsRunningValidations(false);
  };

  const handleProceedToA2 = () => {
    setCurrentPhase("A2");
    setValidationStatus({});
    setValidationResults({});
    // toast.success(t("Proceeding to phase 2..."));
  };

  const handleStartValidations = () => {
    setIsRunningValidations(true);
    setValidationStatus({
      customer: "pending",
      payment: "pending",
      equipment: equipmentIdentified ? "pending" : undefined,
      quota: "pending",
    });
    // Also publish hardcoded ABS validation requests; UI still simulates success
    const base = {
      timestamp: new Date().toISOString(),
      plan_id: PLAN_ID,
      actor: { type: "attendant", id: ATTENDANT_ID },
    } as const;

    mqttPublish(
      `call/uxi/attendant/plan/${PLAN_ID}/validate_customer`,
      {
        ...base,
        correlation_id: `att-validate-customer-${Date.now()}`,
        data: { action: "VALIDATE_CUSTOMER_STATUS" },
      }
    );

    setTimeout(() => {
      mqttPublish(
        `call/uxi/attendant/plan/${PLAN_ID}/validate_payment`,
        {
          ...base,
          correlation_id: `att-validate-payment-${Date.now()}`,
          data: { action: "VALIDATE_PAYMENT_STATUS" },
        }
      );
    }, 300);

    if (equipmentIdentified && equipmentData) {
      setTimeout(() => {
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/validate_equipment`,
          {
            ...base,
            correlation_id: `att-validate-equipment-${Date.now()}`,
            data: {
              action: "VALIDATE_EQUIPMENT_CONDITION",
              equipment_id: equipmentData,
            },
          }
        );
      }, 600);
    }

    setTimeout(() => {
      mqttPublish(
        `call/uxi/attendant/plan/${PLAN_ID}/validate_quota`,
        {
          ...base,
          correlation_id: `att-validate-quota-${Date.now()}`,
          data: { action: "VALIDATE_SERVICE_QUOTA" },
        }
      );
    }, 900);

    // Simplified flow: simulate validations locally without waiting for responses
    setTimeout(() => {
      setValidationStatus((prev) => ({ ...prev, customer: "success" }));
      setValidationResults((prev: any) => ({ ...prev, customer: { status: "ok" } }));
    }, 400);
    setTimeout(() => {
      setValidationStatus((prev) => ({ ...prev, payment: "success" }));
      setValidationResults((prev: any) => ({ ...prev, payment: { status: "ok" } }));
    }, 800);
    if (equipmentIdentified && equipmentData) {
      setTimeout(() => {
        setValidationStatus((prev) => ({ ...prev, equipment: "success" }));
        setValidationResults((prev: any) => ({ ...prev, equipment: { status: "ok" } }));
      }, 1200);
    }
    setTimeout(() => {
      setValidationStatus((prev) => ({ ...prev, quota: "success" }));
      setValidationResults((prev: any) => ({ ...prev, quota: { status: "ok" } }));
      setIsRunningValidations(false);
    }, 1600);
  };

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
        {isLoading && !status && (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        )}
        {status === "success" && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        {status === "error" && (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
        {!isLoading && !status && (
          <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />
        )}
      </div>
      {details && status === "success" && (
        <div className="mt-2 text-xs text-gray-400">
          {details.status || details.message || "Valid"}
        </div>
      )}
      {status === "error" && (
        <div className="mt-2 text-xs text-red-400">
          {details?.error || details?.message || "Validation failed"}
        </div>
      )}
    </div>
  );

  const allValidationsComplete = () => {
    const required = equipmentIdentified
      ? ["customer", "payment", "equipment", "quota"]
      : ["customer", "payment", "quota"];
    return required.every(
      (key) =>
        validationStatus[key as keyof typeof validationStatus] === "success"
    );
  };

  // Show proceed button instead of auto-advancing from Phase 2

  // Start Phase 3 flow automatically when entering A3 (no auto-advance to A4)
  useEffect(() => {
    if (currentPhase !== "A3" || !customerType) return;
    
    setIsRunningPhase3(true);
    
    // For returning customers: Check-In first, then Checkout, then Payment
    // For first-time customers: Checkout only, then Payment
    if (customerType === "returning") {
      // Step 1: Equipment Check-In (returning customer only)
      setPhase3Status({ checkin: "pending", checkout: undefined, payment: undefined });
      setTimeout(() => {
        setPhase3Status((prev: any) => ({ ...prev, checkin: "success", checkout: "pending" }));
        // Publish Equipment Check-In (hardcoded as per docs)
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/equipment_checkin`,
          {
            timestamp: new Date().toISOString(),
            plan_id: PLAN_ID,
            correlation_id: `att-checkin-${Date.now()}`,
            actor: { type: "attendant", id: ATTENDANT_ID },
            data: {
              action: "EQUIPMENT_CHECKIN",
              returned_equipment_id: equipmentData || "BAT_RETURN_001",
              energy_remaining: 20.5,
              service_duration: 60,
            },
          }
        );
      }, 700);
      
      // Step 2: Equipment Checkout
      setTimeout(() => {
        setPhase3Status((prev: any) => ({ ...prev, checkout: "success", payment: "pending" }));
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/equipment_checkout`,
          {
            timestamp: new Date().toISOString(),
            plan_id: PLAN_ID,
            correlation_id: `att-checkout-${Date.now()}`,
            actor: { type: "attendant", id: ATTENDANT_ID },
            data: {
              action: "EQUIPMENT_CHECKOUT",
              replacement_equipment_id: equipmentData || "BAT_NEW_001",
              energy_transferred: 45.5,
              service_duration: 180,
            },
          }
        );
      }, 1400);
      
      // Step 3: Payment Collection
      setTimeout(() => {
        setPhase3Status((prev: any) => ({ ...prev, payment: "success" }));
        setIsRunningPhase3(false);
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/collect_payment`,
          {
            timestamp: new Date().toISOString(),
            plan_id: PLAN_ID,
            correlation_id: `att-payment-collect-${Date.now()}`,
            actor: { type: "attendant", id: ATTENDANT_ID },
            data: {
              action: "COLLECT_PAYMENT",
              payment_method: "mobile_money",
              offline_mode: false,
              cached_data_available: true,
              mqtt_connectivity_available: true,
            },
          }
        );
      }, 2100);
    } else {
      // First-time customer: Checkout only, then Payment
      setPhase3Status({ checkout: "pending", payment: undefined });
      setTimeout(() => {
        setPhase3Status((prev: any) => ({ ...prev, checkout: "success", payment: "pending" }));
        // Publish Equipment Checkout (hardcoded as per docs)
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/equipment_checkout`,
          {
            timestamp: new Date().toISOString(),
            plan_id: PLAN_ID,
            correlation_id: `att-checkout-${Date.now()}`,
            actor: { type: "attendant", id: ATTENDANT_ID },
            data: {
              action: "EQUIPMENT_CHECKOUT",
              replacement_equipment_id: equipmentData || "BAT_NEW_001",
              energy_transferred: 45.5,
              service_duration: 180,
            },
          }
        );
      }, 700);
      setTimeout(() => {
        setPhase3Status((prev: any) => ({ ...prev, payment: "success" }));
        setIsRunningPhase3(false);
        // Publish Collect Payment (hardcoded as per docs)
        mqttPublish(
          `call/uxi/attendant/plan/${PLAN_ID}/collect_payment`,
          {
            timestamp: new Date().toISOString(),
            plan_id: PLAN_ID,
            correlation_id: `att-payment-collect-${Date.now()}`,
            actor: { type: "attendant", id: ATTENDANT_ID },
            data: {
              action: "COLLECT_PAYMENT",
              payment_method: "mobile_money",
              offline_mode: false,
              cached_data_available: true,
              mqtt_connectivity_available: true,
            },
          }
        );
      }, 1500);
    }
  }, [currentPhase, customerType, t, mqttPublish, equipmentData]);

  // Start Phase 4 flow automatically when entering A4
  useEffect(() => {
    if (currentPhase !== "A4") return;
    setIsRunningPhase4(true);
    setPhase4Status({ activity: "pending", usage: undefined });
    setTimeout(() => {
      setPhase4Status((prev: any) => ({ ...prev, activity: "success", usage: "pending" }));
      // Publish Activity Report and Workflow Update
      mqttPublish(
        `emit/uxi/attendant/plan/${PLAN_ID}/activity_report`,
        {
          timestamp: new Date().toISOString(),
          plan_id: PLAN_ID,
          correlation_id: `att-activity-${Date.now()}`,
          actor: { type: "attendant", id: ATTENDANT_ID },
          data: {
            action: "REPORT_ATTENDANT_ACTIVITY",
            activity_type: "battery_swap_completed",
            activity_data: JSON.stringify({ duration: 180, customer_satisfaction: "high" }),
            attendant_station: STATION,
          },
        }
      );
      mqttPublish(
        `emit/uxi/attendant/plan/${PLAN_ID}/workflow_update`,
        {
          timestamp: new Date().toISOString(),
          plan_id: PLAN_ID,
          correlation_id: `att-workflow-${Date.now()}`,
          actor: { type: "attendant", id: ATTENDANT_ID },
          data: {
            action: "UPDATE_WORKFLOW_STATE",
            workflow_stage: "A3",
            stage_transition: "A3_to_A4",
            process_status: "completed",
            performance_metrics: JSON.stringify({ duration: 300, efficiency: 0.95 }),
          },
        }
      );
    }, 600);
    setTimeout(() => {
      setPhase4Status((prev: any) => ({ ...prev, usage: "success" }));
      setIsRunningPhase4(false);
      // toast.success(t("Workflow completed"));
      // Publish Usage Report to billing
      mqttPublish(
        `emit/uxi/billing/plan/${PLAN_ID}/usage_report`,
        {
          timestamp: new Date().toISOString(),
          plan_id: PLAN_ID,
          correlation_id: `att-usage-report-${Date.now()}`,
          actor: { type: "attendant", id: ATTENDANT_ID },
          data: {
            action: "REPORT_SERVICE_USAGE_TO_ODOO",
            usage_type: "battery_swap_completed",
            service_completion_details: {
              old_battery_id: equipmentData || "BAT_RETURN_ATT_001",
              new_battery_id: equipmentData || "BAT_NEW_ATT_001",
              energy_transferred: 48.5,
              service_duration: 240,
              attendant_station: STATION,
            },
          },
        }
      );
    }, 1300);
  }, [currentPhase, t, mqttPublish, equipmentData]);

  if (currentPhase === "A2") {
    return (
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
          <p className="text-gray-400">{t("Validation")}</p>
        </div>

        {/* MQTT Status */}
        <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isMqttConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-300">
                {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
              </span>
            </div>
          </div>
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

          {!isRunningValidations && Object.keys(validationStatus).length === 0 && (
            <button
              onClick={handleStartValidations}
              className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
            >
              <Shield className="w-5 h-5" />
              {t("Start Validation")}
            </button>
          )}

          {allValidationsComplete() && (
            <>
              <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("All Checks Passed!")}</span>
                </div>
                <p className="text-sm text-gray-400">
                  {t("You can proceed to phase 3 (Transaction)")}
                </p>
              </div>
              <button
                onClick={() => setCurrentPhase("A3")}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
              >
                {t("Checkout")}
              </button>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentPhase("A1")}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            {t("Back to Identification")}
          </button>
          <button
            onClick={resetFlow}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            {t("Reset")}
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === "A3") {
    return (
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
          <p className="text-gray-400">{t("Transaction Execution")}</p>
        </div>

        {/* MQTT Status */}
        <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isMqttConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-300">
                {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
          {customerType === "returning" && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Battery className="w-6 h-6 text-orange-300" />
                <h3 className="text-lg font-semibold text-white">{t("Equipment Check-In")}</h3>
              </div>
              <div className="bg-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{t("Receive and process returned equipment")}</span>
                  {isRunningPhase3 && phase3Status.checkin === "pending" && (
                    <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                  )}
                  {phase3Status.checkin === "success" && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 mt-4 mb-2">
            <PackageCheck className="w-6 h-6 text-blue-300" />
            <h3 className="text-lg font-semibold text-white">{t("Equipment Checkout")}</h3>
          </div>
          <div className="bg-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">{t("Prepare and hand over replacement equipment")}</span>
              {isRunningPhase3 && phase3Status.checkout === "pending" && (
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              )}
              {phase3Status.checkout === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 mb-2">
            <CreditCard className="w-6 h-6 text-green-300" />
            <h3 className="text-lg font-semibold text-white">{t("Payment Collection")}</h3>
          </div>
          <div className="bg-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">{t("Collect any required payment from customer")}</span>
              {isRunningPhase3 && phase3Status.payment === "pending" && (
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              )}
              {phase3Status.payment === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          {((customerType === "returning" && phase3Status.checkin === "success" && phase3Status.checkout === "success" && phase3Status.payment === "success") ||
            (customerType === "first-time" && phase3Status.checkout === "success" && phase3Status.payment === "success")) && (
            <>
              <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("Phase 3 complete")}</span>
                </div>
                <p className="text-sm text-gray-400">{t("You can proceed to phase 4 (Reporting)")}</p>
              </div>
              <button
                onClick={() => setCurrentPhase("A4")}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
              >
                {t("Reporting")}
              </button>
            </>
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

  if (currentPhase === "A4") {
    return (
      <div className="space-y-6 p-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
          <p className="text-gray-400">{t("Reporting & Completion")}</p>
        </div>

        {/* MQTT Status */}
        <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isMqttConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-300">
                {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-yellow-300" />
            <h3 className="text-lg font-semibold text-white">{t("Activity Reporting")}</h3>
          </div>
          <div className="bg-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">{t("Record and finalize activity")}</span>
              {isRunningPhase4 && phase4Status.activity === "pending" && (
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              )}
              {phase4Status.activity === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 mb-2">
            <AlertTriangle className="w-6 h-6 text-purple-300" />
            <h3 className="text-lg font-semibold text-white">{t("Usage Reporting")}</h3>
          </div>
          <div className="bg-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">{t("Send usage details for billing/integration")}</span>
              {isRunningPhase4 && phase4Status.usage === "pending" && (
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              )}
              {phase4Status.usage === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          {phase4Status.activity === "success" && phase4Status.usage === "success" && (
            <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{t("All done!")}</span>
              </div>
              <p className="text-sm text-gray-400">{t("The attendant workflow is complete.")}</p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setCurrentPhase("A3")}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {t("Back to Checkout")}
            </button>
            <button
              onClick={resetFlow}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {t("Start new swap")}
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
          <h2 className="text-2xl font-bold text-white mb-2">{t("Battery Swap")}</h2>
          <p className="text-gray-400">{t("Select Customer Type")}</p>
        </div>

        {/* MQTT Status */}
        <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isMqttConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-300">
                {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-4">
          <p className="text-gray-300 text-sm mb-4">
            {t("Please select the type of customer to proceed with the battery swap workflow.")}
          </p>

          <button
            onClick={() => setCustomerType("first-time")}
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
            onClick={() => setCustomerType("returning")}
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
        <h2 className="text-2xl font-bold text-white mb-2">{t("Battery Swap")}</h2>
        <p className="text-gray-400">
          {customerType === "first-time" 
            ? t("First-Time Customer - Customer & Equipment Identification")
            : t("Returning Customer - Customer & Equipment Identification")}
        </p>
      </div>

      {/* MQTT Status */}
      <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isMqttConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-300">
              {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
            </span>
          </div>
        </div>
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
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{t("Customer Identified")}</span>
            </div>
            {customerData && (
              <div className="bg-gray-600 rounded-lg p-4 space-y-2">
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">{t("Customer ID")}:</span>{" "}
                  {formatDisplayValue(customerData.customer_id)}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">{t("Name")}:</span>{" "}
                  {formatDisplayValue(customerData.name || customerData.product_name)}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">{t("Phone")}:</span>{" "}
                  {formatDisplayValue(customerData.phone)}
                </p>
                {customerData.subscription_code && (
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">{t("Subscription")}:</span>{" "}
                    {formatDisplayValue(customerData.subscription_code)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase A1 - Equipment Identification (enabled after customer is identified) */}
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
              <p className="text-xs text-gray-400">{t("Scan customer first to enable equipment scan")}</p>
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
                  <span className="font-medium text-white">{t("Equipment ID")}:</span>{" "}
                  <span className="break-all inline-block max-w-full">{formatDisplayValue(equipmentData)}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {customerIdentified && equipmentIdentified && (
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
// import { Camera, Loader2, CheckCircle, XCircle, Battery, User, QrCode, Shield, CreditCard, PackageCheck, AlertTriangle } from "lucide-react";
// import { useBridge } from "@/app/context/bridgeContext";
// import { useI18n } from '@/i18n';

// // ABS topics use hardcoded payloads as per docs; publish via bridge like BLE page
// const PLAN_ID = "bss-plan-weekly-freedom-nairobi-v2-plan5";
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
//     phone?: string;
//     partner_id?: number;
//     company_id?: number;
//   } | null;
// }

// const Swap: React.FC<SwapProps> = ({ customer }) => {
//   const { t } = useI18n();
//   const { bridge } = useBridge();
//   const [currentPhase, setCurrentPhase] = useState<"A1" | "A2" | "A3" | "A4">("A1");
//   const [customerData, setCustomerData] = useState<any>(null);
//   const [equipmentData, setEquipmentData] = useState<any>(null);
//   const [isScanningCustomer, setIsScanningCustomer] = useState<boolean>(false);
//   const [isScanningEquipment, setIsScanningEquipment] = useState<boolean>(false);
//   const [customerIdentified, setCustomerIdentified] = useState<boolean>(false);
//   const [equipmentIdentified, setEquipmentIdentified] = useState<boolean>(false);
  
//   // Phase A2 validation states
//   const [validationStatus, setValidationStatus] = useState<{
//     customer?: "pending" | "success" | "error";
//     payment?: "pending" | "success" | "error";
//     equipment?: "pending" | "success" | "error";
//     quota?: "pending" | "success" | "error";
//   }>({});
//   const [isRunningValidations, setIsRunningValidations] = useState<boolean>(false);
//   const [validationResults, setValidationResults] = useState<any>({});
//   // Phase A3 states (Transaction Execution)
//   const [isRunningPhase3, setIsRunningPhase3] = useState<boolean>(false);
//   const [phase3Status, setPhase3Status] = useState<{
//     checkout?: "pending" | "success" | "error";
//     payment?: "pending" | "success" | "error";
//   }>({});
//   // Phase A4 states (Reporting)
//   const [isRunningPhase4, setIsRunningPhase4] = useState<boolean>(false);
//   const [phase4Status, setPhase4Status] = useState<{
//     activity?: "pending" | "success" | "error";
//     usage?: "pending" | "success" | "error";
//   }>({});
  
//   const bridgeInitRef = useRef(false);
//   const scanTypeRef = useRef<"customer" | "equipment" | null>(null);
//   const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);

//   const formatDisplayValue = (value?: string | number, fallback?: string) => {
//     if (value === undefined || value === null || value === "") {
//       return fallback ?? t("N/A");
//     }
//     const strValue = String(value);
//     return strValue.length > 48 ? `${strValue.slice(0, 45)}…` : strValue;
//   };

//   const mqttPublish = useCallback((topic: string, content: any) => {
//     if (!window.WebViewJavascriptBridge) {
//       // toast.error(t("MQTT disconnected"));
//       return;
//     }
//     try {
//       const dataToPublish = { topic, qos: 0, content };
//       // toast(t("Publishing to") + ` ${topic}`);
//       window.WebViewJavascriptBridge.callHandler(
//         "mqttPublishMsg",
//         JSON.stringify(dataToPublish),
//         (resp: any) => {
//           try {
//             const r = typeof resp === "string" ? JSON.parse(resp) : resp;
//             // Expecting respCode/respDesc shape from native layer
//             if (r?.respCode === "200" || r?.respData === true) {
//               // toast.success(t("Published to") + ` ${topic}`);
//             } else {
//               // toast.error((r?.respDesc as string) || t("Publish failed"));
//             }
//           } catch {
//             // Unknown response, still consider it attempted
//             // toast.success(t("Published to") + ` ${topic}`);
//           }
//         }
//       );
//     } catch (err) {
//       // toast.error(t("Publish failed"));
//     }
//   }, [t]);

//   const handleCustomerIdentification = useCallback(
//     (qrCodeData: string) => {
//       // Simplified: treat the scanned QR as successful identification
//       setCustomerIdentified(true);
//       setIsScanningCustomer(false);
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
//             ? parsedData.customer_id || parsedData.customerId || parsedData.customer?.id || qrCodeData
//             : qrCodeData,
//         subscription_code:
//           typeof parsedData === "object"
//             ? parsedData.subscription_code || parsedData.subscriptionCode || parsedData.subscription?.code
//             : undefined,
//         product_name:
//           typeof parsedData === "object"
//             ? parsedData.product_name || parsedData.productName || parsedData.product?.name
//             : undefined,
//         name: typeof parsedData === "object" ? parsedData.name || parsedData.customer_name : undefined,
//         phone: typeof parsedData === "object" ? parsedData.phone || parsedData.phone_number : undefined,
//         raw: qrCodeData,
//       };

//       setCustomerData(normalizedData);
//       // toast.success(t("Customer identified successfully"));

//       // Publish hardcoded payload to ABS topic (emit/identify_customer)
//       const topic = `emit/uxi/attendant/plan/${PLAN_ID}/identify_customer`;
//       const payload = {
//         timestamp: new Date().toISOString(),
//         plan_id: PLAN_ID,
//         correlation_id: `att-customer-id-${Date.now()}`,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "IDENTIFY_CUSTOMER",
//           qr_code_data: qrCodeData,
//           customer_id: normalizedData.customer_id,
//           subscription_code: normalizedData.subscription_code,
//           product_name: normalizedData.product_name,
//           attendant_station: STATION,
//         },
//       };
//       mqttPublish(topic, payload);
//     },
//     [t, mqttPublish]
//   );

//   const handleEquipmentIdentification = useCallback(
//     (equipmentBarcode: string) => {
//       // Simplified: treat the scanned code as successful identification
//       setEquipmentIdentified(true);
//       setIsScanningEquipment(false);
//       setEquipmentData(equipmentBarcode);
//       // toast.success(t("Equipment identified successfully"));

//       // Publish hardcoded payload to ABS topic (call/identify_equipment)
//       const topic = `call/uxi/attendant/plan/${PLAN_ID}/identify_equipment`;
//       const payload = {
//         timestamp: new Date().toISOString(),
//         plan_id: PLAN_ID,
//         correlation_id: `att-equip-id-${Date.now()}`,
//         actor: { type: "attendant", id: ATTENDANT_ID },
//         data: {
//           action: "IDENTIFY_EQUIPMENT",
//           equipment_barcode: equipmentBarcode,
//           attendant_station: STATION,
//         },
//       };
//       mqttPublish(topic, payload);
//     },
//     [t, mqttPublish]
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

//       // MQTT message callback (optional consume)
//       const offMqttRecv = reg(
//         "mqttMessageReceived",
//         (data: string, resp: any) => {
//           try {
//             JSON.parse(data);
//             resp("ok");
//           } catch (err) {
//             resp({ error: String(err) });
//           }
//         }
//       );

//       // QR code scan callback
//       const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
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
//           } else {
//             console.warn("QR code scanned but no active scan type:", scanTypeRef.current);
//             // toast.error(t("No active scan session"));
//           }

//           resp({ success: true });
//         } catch (err) {
//           console.error("Error processing QR code data:", err);
//           // toast.error(t("Error processing QR code"));
//           setIsScanningCustomer(false);
//           setIsScanningEquipment(false);
//           scanTypeRef.current = null;
//           resp({ success: false, error: String(err) });
//         }
//       });

//       const offConnectMqtt = reg(
//         "connectMqttCallBack",
//         (data: string, resp: any) => {
//           try {
//             JSON.parse(data);
//             setIsMqttConnected(true);
//             resp("Received MQTT Connection Callback");
//           } catch (err) {
//             setIsMqttConnected(false);
//             console.error("Error parsing MQTT connection callback:", err);
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

//       b.callHandler("connectMqtt", mqttConfig, (resp: string) => {
//         try {
//           const p = JSON.parse(resp);
//           if (p.error) console.error("MQTT connection error:", p.error.message);
//         } catch (err) {
//           console.error("Error parsing MQTT response:", err);
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

//   const resetFlow = () => {
//     setCustomerData(null);
//     setEquipmentData(null);
//     setCustomerIdentified(false);
//     setEquipmentIdentified(false);
//     setIsScanningCustomer(false);
//     setIsScanningEquipment(false);
//     scanTypeRef.current = null;
//     setCurrentPhase("A1");
//     setValidationStatus({});
//     setValidationResults({});
//     setIsRunningValidations(false);
//   };

//   const handleProceedToA2 = () => {
//     setCurrentPhase("A2");
//     setValidationStatus({});
//     setValidationResults({});
//     // toast.success(t("Proceeding to phase 2..."));
//   };

//   const handleStartValidations = () => {
//     setIsRunningValidations(true);
//     setValidationStatus({
//       customer: "pending",
//       payment: "pending",
//       equipment: equipmentIdentified ? "pending" : undefined,
//       quota: "pending",
//     });
//     // Also publish hardcoded ABS validation requests; UI still simulates success
//     const base = {
//       timestamp: new Date().toISOString(),
//       plan_id: PLAN_ID,
//       actor: { type: "attendant", id: ATTENDANT_ID },
//     } as const;

//     mqttPublish(
//       `call/uxi/attendant/plan/${PLAN_ID}/validate_customer`,
//       {
//         ...base,
//         correlation_id: `att-validate-customer-${Date.now()}`,
//         data: { action: "VALIDATE_CUSTOMER_STATUS" },
//       }
//     );

//     setTimeout(() => {
//       mqttPublish(
//         `call/uxi/attendant/plan/${PLAN_ID}/validate_payment`,
//         {
//           ...base,
//           correlation_id: `att-validate-payment-${Date.now()}`,
//           data: { action: "VALIDATE_PAYMENT_STATUS" },
//         }
//       );
//     }, 300);

//     if (equipmentIdentified && equipmentData) {
//       setTimeout(() => {
//         mqttPublish(
//           `call/uxi/attendant/plan/${PLAN_ID}/validate_equipment`,
//           {
//             ...base,
//             correlation_id: `att-validate-equipment-${Date.now()}`,
//             data: {
//               action: "VALIDATE_EQUIPMENT_CONDITION",
//               equipment_id: equipmentData,
//             },
//           }
//         );
//       }, 600);
//     }

//     setTimeout(() => {
//       mqttPublish(
//         `call/uxi/attendant/plan/${PLAN_ID}/validate_quota`,
//         {
//           ...base,
//           correlation_id: `att-validate-quota-${Date.now()}`,
//           data: { action: "VALIDATE_SERVICE_QUOTA" },
//         }
//       );
//     }, 900);

//     // Simplified flow: simulate validations locally without waiting for responses
//     setTimeout(() => {
//       setValidationStatus((prev) => ({ ...prev, customer: "success" }));
//       setValidationResults((prev: any) => ({ ...prev, customer: { status: "ok" } }));
//     }, 400);
//     setTimeout(() => {
//       setValidationStatus((prev) => ({ ...prev, payment: "success" }));
//       setValidationResults((prev: any) => ({ ...prev, payment: { status: "ok" } }));
//     }, 800);
//     if (equipmentIdentified && equipmentData) {
//       setTimeout(() => {
//         setValidationStatus((prev) => ({ ...prev, equipment: "success" }));
//         setValidationResults((prev: any) => ({ ...prev, equipment: { status: "ok" } }));
//       }, 1200);
//     }
//     setTimeout(() => {
//       setValidationStatus((prev) => ({ ...prev, quota: "success" }));
//       setValidationResults((prev: any) => ({ ...prev, quota: { status: "ok" } }));
//       setIsRunningValidations(false);
//     }, 1600);
//   };

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
//         {isLoading && !status && (
//           <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
//         )}
//         {status === "success" && (
//           <CheckCircle className="w-5 h-5 text-green-500" />
//         )}
//         {status === "error" && (
//           <XCircle className="w-5 h-5 text-red-500" />
//         )}
//         {!isLoading && !status && (
//           <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />
//         )}
//       </div>
//       {details && status === "success" && (
//         <div className="mt-2 text-xs text-gray-400">
//           {details.status || details.message || "Valid"}
//         </div>
//       )}
//       {status === "error" && (
//         <div className="mt-2 text-xs text-red-400">
//           {details?.error || details?.message || "Validation failed"}
//         </div>
//       )}
//     </div>
//   );

//   const allValidationsComplete = () => {
//     const required = equipmentIdentified
//       ? ["customer", "payment", "equipment", "quota"]
//       : ["customer", "payment", "quota"];
//     return required.every(
//       (key) =>
//         validationStatus[key as keyof typeof validationStatus] === "success"
//     );
//   };

//   // Show proceed button instead of auto-advancing from Phase 2

//   // Start Phase 3 flow automatically when entering A3 (no auto-advance to A4)
//   useEffect(() => {
//     if (currentPhase !== "A3") return;
//     // simulate: run checkout then payment, then proceed
//     setIsRunningPhase3(true);
//     setPhase3Status({ checkout: "pending", payment: undefined });
//     setTimeout(() => {
//       setPhase3Status((prev: any) => ({ ...prev, checkout: "success", payment: "pending" }));
//       // Publish Equipment Checkout (hardcoded as per docs)
//       mqttPublish(
//         `call/uxi/attendant/plan/${PLAN_ID}/equipment_checkout`,
//         {
//           timestamp: new Date().toISOString(),
//           plan_id: PLAN_ID,
//           correlation_id: `att-checkout-${Date.now()}`,
//           actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "EQUIPMENT_CHECKOUT",
//             replacement_equipment_id: equipmentData || "BAT_NEW_001",
//             energy_transferred: 45.5,
//             service_duration: 180,
//           },
//         }
//       );
//     }, 700);
//     setTimeout(() => {
//       setPhase3Status((prev: any) => ({ ...prev, payment: "success" }));
//       setIsRunningPhase3(false);
//       // toast.success(t("Phase 3 complete"));
//       // Publish Collect Payment (hardcoded as per docs)
//       mqttPublish(
//         `call/uxi/attendant/plan/${PLAN_ID}/collect_payment`,
//         {
//           timestamp: new Date().toISOString(),
//           plan_id: PLAN_ID,
//           correlation_id: `att-payment-collect-${Date.now()}`,
//           actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "COLLECT_PAYMENT",
//             payment_method: "mobile_money",
//             offline_mode: false,
//             cached_data_available: true,
//             mqtt_connectivity_available: true,
//           },
//         }
//       );
//     }, 1500);
//   }, [currentPhase, t, mqttPublish, equipmentData]);

//   // Start Phase 4 flow automatically when entering A4
//   useEffect(() => {
//     if (currentPhase !== "A4") return;
//     setIsRunningPhase4(true);
//     setPhase4Status({ activity: "pending", usage: undefined });
//     setTimeout(() => {
//       setPhase4Status((prev: any) => ({ ...prev, activity: "success", usage: "pending" }));
//       // Publish Activity Report and Workflow Update
//       mqttPublish(
//         `emit/uxi/attendant/plan/${PLAN_ID}/activity_report`,
//         {
//           timestamp: new Date().toISOString(),
//           plan_id: PLAN_ID,
//           correlation_id: `att-activity-${Date.now()}`,
//           actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "REPORT_ATTENDANT_ACTIVITY",
//             activity_type: "battery_swap_completed",
//             activity_data: JSON.stringify({ duration: 180, customer_satisfaction: "high" }),
//             attendant_station: STATION,
//           },
//         }
//       );
//       mqttPublish(
//         `emit/uxi/attendant/plan/${PLAN_ID}/workflow_update`,
//         {
//           timestamp: new Date().toISOString(),
//           plan_id: PLAN_ID,
//           correlation_id: `att-workflow-${Date.now()}`,
//           actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "UPDATE_WORKFLOW_STATE",
//             workflow_stage: "A3",
//             stage_transition: "A3_to_A4",
//             process_status: "completed",
//             performance_metrics: JSON.stringify({ duration: 300, efficiency: 0.95 }),
//           },
//         }
//       );
//     }, 600);
//     setTimeout(() => {
//       setPhase4Status((prev: any) => ({ ...prev, usage: "success" }));
//       setIsRunningPhase4(false);
//       // toast.success(t("Workflow completed"));
//       // Publish Usage Report to billing
//       mqttPublish(
//         `emit/uxi/billing/plan/${PLAN_ID}/usage_report`,
//         {
//           timestamp: new Date().toISOString(),
//           plan_id: PLAN_ID,
//           correlation_id: `att-usage-report-${Date.now()}`,
//           actor: { type: "attendant", id: ATTENDANT_ID },
//           data: {
//             action: "REPORT_SERVICE_USAGE_TO_ODOO",
//             usage_type: "battery_swap_completed",
//             service_completion_details: {
//               old_battery_id: equipmentData || "BAT_RETURN_ATT_001",
//               new_battery_id: equipmentData || "BAT_NEW_ATT_001",
//               energy_transferred: 48.5,
//               service_duration: 240,
//               attendant_station: STATION,
//             },
//           },
//         }
//       );
//     }, 1300);
//   }, [currentPhase, t, mqttPublish, equipmentData]);

//   if (currentPhase === "A2") {
//     return (
//       <div className="space-y-6 p-4">
//         {/* Header */}
//         <div className="text-center mb-6">
//           <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
//           <p className="text-gray-400">{t("Validation")}</p>
//         </div>

//         {/* MQTT Status */}
//         <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <div
//                 className={`w-3 h-3 rounded-full ${
//                   isMqttConnected ? "bg-green-500" : "bg-red-500"
//                 }`}
//               />
//               <span className="text-sm text-gray-300">
//                 {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
//               </span>
//             </div>
//           </div>
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

//           {!isRunningValidations && Object.keys(validationStatus).length === 0 && (
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
//               <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//                 <div className="flex items-center gap-2 text-green-400 mb-2">
//                   <CheckCircle className="w-5 h-5" />
//                   <span className="font-medium">{t("All Checks Passed!")}</span>
//                 </div>
//                 <p className="text-sm text-gray-400">
//                   {t("You can proceed to phase 3 (Transaction)")}
//                 </p>
//               </div>
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
//     return (
//       <div className="space-y-6 p-4">
//         {/* Header */}
//         <div className="text-center mb-6">
//           <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
//           <p className="text-gray-400">{t("Transaction Execution")}</p>
//         </div>

//         {/* MQTT Status */}
//         <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <div
//                 className={`w-3 h-3 rounded-full ${
//                   isMqttConnected ? "bg-green-500" : "bg-red-500"
//                 }`}
//               />
//               <span className="text-sm text-gray-300">
//                 {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
//               </span>
//             </div>
//           </div>
//         </div>

//         <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
//           <div className="flex items-center gap-3 mb-2">
//             <PackageCheck className="w-6 h-6 text-blue-300" />
//             <h3 className="text-lg font-semibold text-white">{t("Equipment Checkout")}</h3>
//           </div>
//           <div className="bg-gray-600 rounded-lg p-4">
//             <div className="flex items-center justify-between">
//               <span className="text-white text-sm">{t("Prepare and hand over replacement equipment")}</span>
//               {isRunningPhase3 && phase3Status.checkout === "pending" && (
//                 <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//               )}
//               {phase3Status.checkout === "success" && (
//                 <CheckCircle className="w-5 h-5 text-green-500" />
//               )}
//             </div>
//           </div>

//           <div className="flex items-center gap-3 mt-4 mb-2">
//             <CreditCard className="w-6 h-6 text-green-300" />
//             <h3 className="text-lg font-semibold text-white">{t("Payment Collection")}</h3>
//           </div>
//           <div className="bg-gray-600 rounded-lg p-4">
//             <div className="flex items-center justify-between">
//               <span className="text-white text-sm">{t("Collect any required payment from customer")}</span>
//               {isRunningPhase3 && phase3Status.payment === "pending" && (
//                 <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//               )}
//               {phase3Status.payment === "success" && (
//                 <CheckCircle className="w-5 h-5 text-green-500" />
//               )}
//             </div>
//           </div>

//           {phase3Status.checkout === "success" && phase3Status.payment === "success" && (
//             <>
//               <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//                 <div className="flex items-center gap-2 text-green-400 mb-2">
//                   <CheckCircle className="w-5 h-5" />
//                   <span className="font-medium">{t("Phase 3 complete")}</span>
//                 </div>
//                 <p className="text-sm text-gray-400">{t("You can proceed to phase 4 (Reporting)")}</p>
//               </div>
//               <button
//                 onClick={() => setCurrentPhase("A4")}
//                 className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
//               >
//                 {t("Reporting")}
//               </button>
//             </>
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

//   if (currentPhase === "A4") {
//     return (
//       <div className="space-y-6 p-4">
//         <div className="text-center mb-6">
//           <h2 className="text-2xl font-bold text-white mb-2">{t("Attendant")}</h2>
//           <p className="text-gray-400">{t("Reporting & Completion")}</p>
//         </div>

//         {/* MQTT Status */}
//         <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <div
//                 className={`w-3 h-3 rounded-full ${
//                   isMqttConnected ? "bg-green-500" : "bg-red-500"
//                 }`}
//               />
//               <span className="text-sm text-gray-300">
//                 {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
//               </span>
//             </div>
//           </div>
//         </div>

//         <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 space-y-3">
//           <div className="flex items-center gap-3 mb-2">
//             <Shield className="w-6 h-6 text-yellow-300" />
//             <h3 className="text-lg font-semibold text-white">{t("Activity Reporting")}</h3>
//           </div>
//           <div className="bg-gray-600 rounded-lg p-4">
//             <div className="flex items-center justify-between">
//               <span className="text-white text-sm">{t("Record and finalize activity")}</span>
//               {isRunningPhase4 && phase4Status.activity === "pending" && (
//                 <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//               )}
//               {phase4Status.activity === "success" && (
//                 <CheckCircle className="w-5 h-5 text-green-500" />
//               )}
//             </div>
//           </div>

//           <div className="flex items-center gap-3 mt-4 mb-2">
//             <AlertTriangle className="w-6 h-6 text-purple-300" />
//             <h3 className="text-lg font-semibold text-white">{t("Usage Reporting")}</h3>
//           </div>
//           <div className="bg-gray-600 rounded-lg p-4">
//             <div className="flex items-center justify-between">
//               <span className="text-white text-sm">{t("Send usage details for billing/integration")}</span>
//               {isRunningPhase4 && phase4Status.usage === "pending" && (
//                 <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
//               )}
//               {phase4Status.usage === "success" && (
//                 <CheckCircle className="w-5 h-5 text-green-500" />
//               )}
//             </div>
//           </div>

//           {phase4Status.activity === "success" && phase4Status.usage === "success" && (
//             <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
//               <div className="flex items-center gap-2 text-green-400 mb-2">
//                 <CheckCircle className="w-5 h-5" />
//                 <span className="font-medium">{t("All done!")}</span>
//               </div>
//               <p className="text-sm text-gray-400">{t("The attendant workflow is complete.")}</p>
//             </div>
//           )}

//           <div className="flex gap-3 mt-4">
//             <button
//               onClick={() => setCurrentPhase("A3")}
//               className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//             >
//               {t("Back to Checkout")}
//             </button>
//             <button
//               onClick={resetFlow}
//               className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
//             >
//               {t("Start new swap")}
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6 p-4">
//       {/* Header */}
//       <div className="text-center mb-6">
//         <h2 className="text-2xl font-bold text-white mb-2">{t("Battery Swap")}</h2>
//         <p className="text-gray-400">{t("Customer & Equipment Identification")}</p>
//       </div>

//       {/* MQTT Status */}
//       <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div
//               className={`w-3 h-3 rounded-full ${
//                 isMqttConnected ? "bg-green-500" : "bg-red-500"
//               }`}
//             />
//             <span className="text-sm text-gray-300">
//               {isMqttConnected ? t("MQTT connected") : t("MQTT disconnected")}
//             </span>
//           </div>
//         </div>
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
//                   <span className="font-medium text-white">{t("Customer ID")}:</span>{" "}
//                   {formatDisplayValue(customerData.customer_id)}
//                 </p>
//                 <p className="text-sm text-gray-300">
//                   <span className="font-medium text-white">{t("Name")}:</span>{" "}
//                   {formatDisplayValue(customerData.name || customerData.product_name)}
//                 </p>
//                 <p className="text-sm text-gray-300">
//                   <span className="font-medium text-white">{t("Phone")}:</span>{" "}
//                   {formatDisplayValue(customerData.phone)}
//                 </p>
//                 {customerData.subscription_code && (
//                   <p className="text-sm text-gray-300">
//                     <span className="font-medium text-white">{t("Subscription")}:</span>{" "}
//                     {formatDisplayValue(customerData.subscription_code)}
//                   </p>
//                 )}
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Phase A1 - Equipment Identification (enabled after customer is identified) */}
//       <div className="bg-gray-700 rounded-xl p-6 border border-gray-600">
//         <div className="flex items-center gap-3 mb-4">
//           <Battery className="w-6 h-6 text-green-400" />
//           <h3 className="text-lg font-semibold text-white">
//             {t("Equipment Identification")}
//           </h3>
//         </div>

//         {!equipmentIdentified ? (
//           <div className="space-y-4">
//             <p className="text-gray-400 text-sm">
//               {t("Scan battery barcode to identify")}
//             </p>
//             <button
//               onClick={handleStartEquipmentScan}
//               disabled={isScanningEquipment || !customerIdentified}
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
//             {!customerIdentified && (
//               <p className="text-xs text-gray-400">{t("Scan customer first to enable equipment scan")}</p>
//             )}
//           </div>
//         ) : (
//           <div className="space-y-3">
//             <div className="flex items-center gap-2 text-green-400">
//               <CheckCircle className="w-5 h-5" />
//               <span className="font-medium">{t("Equipment Identified")}</span>
//             </div>
//             {equipmentData && (
//               <div className="bg-gray-600 rounded-lg p-4">
//                 <p className="text-sm text-gray-300">
//                   <span className="font-medium text-white">{t("Equipment ID")}:</span>{" "}
//                   {equipmentData || t('N/A')}
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Action Buttons */}
//       {customerIdentified && equipmentIdentified && (
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