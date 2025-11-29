'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
import { getAttendantUser } from '@/lib/attendant-auth';

// Import components
import {
  Timeline,
  CustomerStatePanel,
  ActionBar,
  Step1CustomerScan,
  Step2OldBattery,
  Step3NewBattery,
  Step4Review,
  Step5Payment,
  Step6Success,
  // Types
  CustomerData,
  BatteryData,
  SwapData,
  AttendantStep,
  FlowError,
} from './components';

// Define WebViewJavascriptBridge type for window
interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

// Constants
const PAYMENT_CONFIRMATION_ENDPOINT = "https://crm-omnivoltaic.odoo.com/api/lipay/manual-confirm";

interface AttendantFlowProps {
  onBack?: () => void;
}

export default function AttendantFlow({ onBack }: AttendantFlowProps) {
  const router = useRouter();
  const { bridge, isMqttConnected, isBridgeReady } = useBridge();
  
  // Attendant info from login
  const [attendantInfo, setAttendantInfo] = useState<{ id: string; station: string }>({
    id: 'attendant-001',
    station: 'STATION_001',
  });

  // Load attendant info on mount
  useEffect(() => {
    const user = getAttendantUser();
    if (user) {
      setAttendantInfo({
        id: `attendant-${user.id}`,
        station: `STATION_${user.id}`,
      });
    }
  }, []);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<AttendantStep>(1);
  
  // Input mode for step 1
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [manualSubscriptionId, setManualSubscriptionId] = useState('');
  
  // Plan ID from QR code (subscription_code)
  const [dynamicPlanId, setDynamicPlanId] = useState<string>('');
  
  // Data states
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [swapData, setSwapData] = useState<SwapData>({
    oldBattery: null,
    newBattery: null,
    energyDiff: 0,
    cost: 0,
    rate: 120, // Will be updated from service response
  });
  
  // Service states from MQTT response
  const [serviceStates, setServiceStates] = useState<Array<{
    service_id: string;
    used: number;
    quota: number;
    current_asset: string | null;
    name?: string;
    usageUnitPrice?: number;
  }>>([]);
  
  // Customer type (first-time or returning)
  const [customerType, setCustomerType] = useState<'first-time' | 'returning' | null>(null);
  
  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment states
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  
  // Phase states
  const [paymentAndServiceStatus, setPaymentAndServiceStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  
  // Flow error state - tracks failures that end the process
  const [flowError, setFlowError] = useState<FlowError | null>(null);
  
  // Stats (fetched from API in a real implementation)
  const [stats] = useState({ today: 0, thisWeek: 0, successRate: 0 });

  // Transaction ID
  const [transactionId, setTransactionId] = useState<string>('');
  
  // Ref for correlation ID
  const correlationIdRef = useRef<string>('');
  
  // Ref for tracking current scan type
  const scanTypeRef = useRef<'customer' | 'old_battery' | 'new_battery' | 'payment' | null>(null);
  
  // Bridge initialization ref
  const bridgeHandlersRegisteredRef = useRef<boolean>(false);
  const bridgeInitRef = useRef<boolean>(false);
  
  // Timeout ref for scan operations (customer identification, battery scans)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for processing functions to avoid stale closures in bridge handlers
  // These refs are updated whenever the callbacks change, and the bridge handler
  // calls ref.current to always get the latest version
  const processCustomerQRDataRef = useRef<(data: string) => void>(() => {});
  const processOldBatteryQRDataRef = useRef<(data: string) => void>(() => {});
  const processNewBatteryQRDataRef = useRef<(data: string) => void>(() => {});
  const processPaymentQRDataRef = useRef<(data: string) => void>(() => {});
  
  // Helper to clear scan timeout safely
  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);
  
  // Helper to cancel any ongoing scan and reset state
  const cancelOngoingScan = useCallback(() => {
    clearScanTimeout();
    setIsScanning(false);
    scanTypeRef.current = null;
  }, [clearScanTimeout]);

  // Get electricity service from service states
  const electricityService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-electricity')
  );

  // Get battery fleet service (to check current_asset for customer type)
  const batteryFleetService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-battery-fleet')
  );

  // Start QR code scan using native bridge (follows existing pattern from swap.tsx)
  const startQrCodeScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Unable to access camera');
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      'startQrCodeScan',
      999,
      (responseData: string) => {
        console.info('QR Code Scan initiated:', responseData);
      }
    );
  }, []);

  // Process customer QR code data and send MQTT identify_customer
  const processCustomerQRData = useCallback((qrCodeData: string) => {
    let parsedData: any;
    try {
      parsedData = JSON.parse(qrCodeData);
    } catch {
      parsedData = qrCodeData;
    }

    const normalizedData: any = {
      customer_id: typeof parsedData === 'object'
        ? parsedData.customer_id || parsedData.customerId || parsedData.customer?.id || qrCodeData
        : qrCodeData,
      subscription_code: typeof parsedData === 'object'
        ? parsedData.subscription_code || parsedData.subscriptionCode || parsedData.subscription?.code
        : undefined,
      name: typeof parsedData === 'object'
        ? parsedData.name || parsedData.customer_name
        : undefined,
      raw: qrCodeData,
    };

    // Extract subscription_code as plan_id
    const subscriptionCode = normalizedData.subscription_code;
    if (!subscriptionCode) {
      console.error("No subscription_code found in QR code");
      toast.error("QR code missing subscription_code");
      setIsScanning(false);
      scanTypeRef.current = null;
      return;
    }

    setDynamicPlanId(subscriptionCode);
    console.info("Using subscription_code as plan_id:", subscriptionCode);

    const currentPlanId = subscriptionCode;
    const customerId = normalizedData.customer_id;
    const formattedQrCodeData = `QR_CUSTOMER_TEST_${customerId}`;

    // Generate correlation ID
    const correlationId = `att-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    correlationIdRef.current = correlationId;
    (window as any).__customerIdentificationCorrelationId = correlationId;

    // Build MQTT payload
    const requestTopic = `emit/uxi/attendant/plan/${currentPlanId}/identify_customer`;
    const responseTopic = `echo/abs/attendant/plan/${currentPlanId}/identify_customer`;

    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: currentPlanId,
      correlation_id: correlationId,
      actor: { type: "attendant", id: attendantInfo.id },
      data: {
        action: "IDENTIFY_CUSTOMER",
        qr_code_data: formattedQrCodeData,
        attendant_station: attendantInfo.station,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    console.info("=== Customer Identification MQTT (QR Scan) ===");
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Correlation ID:", correlationId);
    console.info("Payload:", JSON.stringify(payload, null, 2));

    // Set timeout for the operation
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = setTimeout(() => {
      console.error("Customer identification timed out after 30 seconds");
      toast.error("Request timed out. Please try again.");
      setIsScanning(false);
      scanTypeRef.current = null;
    }, 30000);

    // Register response handler
    bridge?.registerHandler(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedMqttData = JSON.parse(data);
          const topic = parsedMqttData.topic;
          const rawMessageContent = parsedMqttData.message;

          if (topic === responseTopic) {
            console.info("✅ Topic MATCHED! Processing identify_customer response");

            let responseData: any;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch {
              responseData = rawMessageContent;
            }

            const storedCorrelationId = (window as any).__customerIdentificationCorrelationId;
            const responseCorrelationId = responseData?.correlation_id;

            const correlationMatches =
              Boolean(storedCorrelationId) &&
              Boolean(responseCorrelationId) &&
              (responseCorrelationId === storedCorrelationId ||
                responseCorrelationId.startsWith(storedCorrelationId) ||
                storedCorrelationId.startsWith(responseCorrelationId));

            if (correlationMatches) {
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
              }
              
              const success = responseData?.data?.success ?? false;
              const signals = responseData?.data?.signals || [];

              const hasSuccessSignal = success === true && 
                Array.isArray(signals) && 
                (signals.includes("CUSTOMER_IDENTIFIED_SUCCESS") || signals.includes("IDEMPOTENT_OPERATION_DETECTED"));

              if (hasSuccessSignal) {
                const metadata = responseData?.data?.metadata;
                const isIdempotent = signals.includes("IDEMPOTENT_OPERATION_DETECTED");
                const sourceData = isIdempotent ? metadata?.cached_result : metadata;
                const servicePlanData = sourceData?.service_plan_data || sourceData?.servicePlanData;
                const serviceBundle = sourceData?.service_bundle;
                const identifiedCustomerId = sourceData?.customer_id || metadata?.customer_id;
                
                if (servicePlanData) {
                  const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
                    (service: any) => typeof service?.service_id === 'string'
                  );
                  
                  const enrichedServiceStates = extractedServiceStates.map((serviceState: any) => {
                    const matchingService = serviceBundle?.services?.find(
                      (svc: any) => svc.serviceId === serviceState.service_id
                    );
                    return {
                      ...serviceState,
                      name: matchingService?.name,
                      usageUnitPrice: matchingService?.usageUnitPrice,
                    };
                  });
                  
                  setServiceStates(enrichedServiceStates);
                  
                  const batteryFleet = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-battery-fleet')
                  );
                  setCustomerType(batteryFleet?.current_asset ? 'returning' : 'first-time');
                  
                  const elecService = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-electricity')
                  );
                  const swapCountService = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-swap-count')
                  );
                  
                  if (elecService?.usageUnitPrice) {
                    setSwapData(prev => ({ ...prev, rate: elecService.usageUnitPrice }));
                  }
                  
                  setCustomerData({
                    id: identifiedCustomerId || servicePlanData.customerId || customerId,
                    name: normalizedData.name || identifiedCustomerId || 'Customer',
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode,
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    swapCount: swapCountService?.used || 0,
                    lastSwap: 'N/A',
                    energyRemaining: elecService ? (elecService.quota - elecService.used) : 0,
                    energyTotal: elecService?.quota || 0,
                    swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
                    swapsTotal: swapCountService?.quota || 21,
                    paymentState: servicePlanData.paymentState || 'INITIAL',
                    serviceState: servicePlanData.serviceState || 'INITIAL',
                    currentBatteryId: batteryFleet?.current_asset || undefined,
                  });
                  
                  setCurrentStep(2);
                  toast.success(isIdempotent ? 'Customer identified (cached)' : 'Customer identified');
                } else {
                  toast.error("Invalid customer data received");
                }
              } else {
                const errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message || "Customer identification failed";
                toast.error(errorMsg);
              }
              setIsScanning(false);
              scanTypeRef.current = null;
            }
          }
          responseCallback({});
        } catch (err) {
          console.error("Error processing MQTT response:", err);
        }
      }
    );

    // Subscribe to response topic first, then publish
    bridge?.callHandler(
      "mqttSubTopic",
      { topic: responseTopic, qos: 0 },
      (subscribeResponse: string) => {
        try {
          const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
          
          if (subResp?.respCode === "200") {
            setTimeout(() => {
              bridge?.callHandler(
                "mqttPublishMsg",
                JSON.stringify(dataToPublish),
                (publishResponse: string) => {
                  try {
                    const pubResp = typeof publishResponse === 'string' ? JSON.parse(publishResponse) : publishResponse;
                    if (pubResp?.error || pubResp?.respCode !== "200") {
                      toast.error("Failed to identify customer");
                      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                      setIsScanning(false);
                      scanTypeRef.current = null;
                    }
                  } catch (err) {
                    toast.error("Error identifying customer");
                    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                    setIsScanning(false);
                    scanTypeRef.current = null;
                  }
                }
              );
            }, 300);
          } else {
            toast.error("Failed to connect. Please try again.");
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            setIsScanning(false);
            scanTypeRef.current = null;
          }
        } catch (err) {
          toast.error("Error connecting. Please try again.");
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          setIsScanning(false);
          scanTypeRef.current = null;
        }
      }
    );
  }, [bridge, attendantInfo]);

  // Process old battery QR code data - validates against customer's current battery
  const processOldBatteryQRData = useCallback((qrCodeData: string) => {
    // Clear any pending timeout
    clearScanTimeout();
    
    let batteryData: any;
    try {
      batteryData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      batteryData = { id: qrCodeData };
    }
    
    const scannedBatteryId = batteryData.battery_id || batteryData.id || qrCodeData;
    
    // For returning customers, validate the scanned battery matches their assigned battery
    if (customerType === 'returning' && customerData?.currentBatteryId) {
      const expectedBatteryId = customerData.currentBatteryId;
      
      // Normalize IDs for comparison (remove prefixes, compare last 6 chars, case insensitive)
      const normalizeId = (id: string) => {
        // Remove common prefixes like "BAT_NEW_", "BAT_RETURN_ATT_", etc.
        const cleaned = id.replace(/^(BAT_NEW_|BAT_RETURN_ATT_|BAT_)/i, '');
        return cleaned.toLowerCase();
      };
      
      const scannedNormalized = normalizeId(String(scannedBatteryId));
      const expectedNormalized = normalizeId(String(expectedBatteryId));
      
      // Check if IDs match (exact match or one contains the other)
      const isMatch = scannedNormalized === expectedNormalized ||
        scannedNormalized.includes(expectedNormalized) ||
        expectedNormalized.includes(scannedNormalized) ||
        scannedNormalized.slice(-6) === expectedNormalized.slice(-6);
      
      if (!isMatch) {
        // Battery doesn't match - show error and stop process
        console.error(`Battery mismatch: scanned ${scannedBatteryId}, expected ${expectedBatteryId}`);
        
        setFlowError({
          step: 2,
          message: 'Battery does not belong to this customer',
          details: `Scanned: ...${String(scannedBatteryId).slice(-6)} | Expected: ...${String(expectedBatteryId).slice(-6)}`,
        });
        
        toast.error('Wrong battery! This battery does not belong to the customer.');
        setIsScanning(false);
        scanTypeRef.current = null;
        return; // Don't proceed to next step
      }
    }
    
    // Battery validated (or first-time customer) - proceed
    const oldBattery: BatteryData = {
      id: scannedBatteryId,
      shortId: String(scannedBatteryId).slice(-6),
      chargeLevel: batteryData.charge_level || batteryData.soc || batteryData.chargeLevel || 0,
      energy: batteryData.energy || batteryData.kwh || 0,
    };
    
    setSwapData(prev => ({ ...prev, oldBattery }));
    setCurrentStep(3);
    toast.success('Old battery scanned');
    setIsScanning(false);
    scanTypeRef.current = null;
  }, [customerType, customerData?.currentBatteryId, clearScanTimeout]);

  // Process new battery QR code data
  const processNewBatteryQRData = useCallback((qrCodeData: string) => {
    // Clear any pending timeout
    clearScanTimeout();
    
    let batteryData: any;
    try {
      batteryData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      batteryData = { id: qrCodeData };
    }
    
    const newBattery: BatteryData = {
      id: batteryData.battery_id || batteryData.id || qrCodeData,
      shortId: (batteryData.battery_id || batteryData.id || qrCodeData).toString().slice(-6),
      chargeLevel: batteryData.charge_level || batteryData.soc || batteryData.chargeLevel || 100,
      energy: batteryData.energy || batteryData.kwh || 0,
    };
    
    // Calculate energy difference and cost
    const oldEnergy = swapData.oldBattery?.energy || 0;
    const newEnergy = newBattery.energy || 0;
    const energyDiff = newEnergy - oldEnergy;
    const rate = electricityService?.usageUnitPrice || swapData.rate;
    const cost = Math.round(energyDiff * rate * 100) / 100;
    
    setSwapData(prev => ({ 
      ...prev, 
      newBattery,
      energyDiff: Math.round(energyDiff * 100) / 100,
      cost: cost > 0 ? cost : 0,
    }));
    setCurrentStep(4);
    toast.success('New battery scanned');
    setIsScanning(false);
    scanTypeRef.current = null;
  }, [swapData.oldBattery, swapData.rate, electricityService?.usageUnitPrice, clearScanTimeout]);

  // Process payment QR code data
  const processPaymentQRData = useCallback((qrCodeData: string) => {
    let qrData: any;
    try {
      qrData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      qrData = { transaction_id: qrCodeData };
    }
    const txnId = qrData.transaction_id || qrData.txn_id || qrData.id || qrCodeData;
    
    // Call HTTP endpoint for payment confirmation
    const confirmPayment = async () => {
      try {
        const response = await fetch(PAYMENT_CONFIRMATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: txnId,
            plan_id: dynamicPlanId,
            amount: swapData.cost,
          }),
        });
        
        if (response.ok) {
          setPaymentConfirmed(true);
          setPaymentReceipt(txnId);
          setTransactionId(txnId);
          toast.success('Payment confirmed');
          publishPaymentAndService(txnId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          toast.error(errorData.message || 'Payment confirmation failed');
          setIsScanning(false);
          scanTypeRef.current = null;
        }
      } catch (err) {
        console.error('Payment confirmation error:', err);
        toast.error('Payment confirmation failed. Check network connection.');
        setIsScanning(false);
        scanTypeRef.current = null;
      }
    };
    
    confirmPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPlanId, swapData.cost]);

  // Keep processing function refs up to date to avoid stale closures in bridge handlers
  // This ensures the bridge callback always calls the latest version of each processing function
  useEffect(() => {
    processCustomerQRDataRef.current = processCustomerQRData;
  }, [processCustomerQRData]);

  useEffect(() => {
    processOldBatteryQRDataRef.current = processOldBatteryQRData;
  }, [processOldBatteryQRData]);

  useEffect(() => {
    processNewBatteryQRDataRef.current = processNewBatteryQRData;
  }, [processNewBatteryQRData]);

  useEffect(() => {
    processPaymentQRDataRef.current = processPaymentQRData;
  }, [processPaymentQRData]);

  // Setup bridge handlers for QR code scanning (follows pattern from swap.tsx)
  const setupBridge = useCallback((b: WebViewJavascriptBridge) => {
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

    // QR code scan callback - follows existing pattern from swap.tsx
    const offQr = reg(
      "scanQrcodeResultCallBack",
      (data: string, resp: any) => {
        try {
          const p = JSON.parse(data);
          const qrVal = p.respData?.value || "";
          console.info("QR code scanned:", qrVal);
          
          if (!qrVal) {
            // User cancelled scan (no QR value) - just reset state silently
            console.info("QR scan cancelled or empty - resetting state");
            clearScanTimeout();
            setIsScanning(false);
            scanTypeRef.current = null;
            resp({ success: false, cancelled: true });
            return;
          }

          // Use ref to determine which scan type is active
          // IMPORTANT: We call ref.current instead of the function directly to avoid stale closures
          // The refs are kept up to date via useEffect hooks, ensuring we always call the latest version
          if (scanTypeRef.current === "customer") {
            console.info("Processing customer QR code:", qrVal);
            processCustomerQRDataRef.current(qrVal);
          } else if (scanTypeRef.current === "old_battery") {
            console.info("Processing old battery QR code:", qrVal);
            processOldBatteryQRDataRef.current(qrVal);
          } else if (scanTypeRef.current === "new_battery") {
            console.info("Processing new battery QR code:", qrVal);
            processNewBatteryQRDataRef.current(qrVal);
          } else if (scanTypeRef.current === "payment") {
            console.info("Processing payment QR code:", qrVal);
            processPaymentQRDataRef.current(qrVal);
          } else {
            console.warn("QR code scanned but no active scan type:", scanTypeRef.current);
            // No active scan type - reset state
            clearScanTimeout();
            setIsScanning(false);
          }

          resp({ success: true });
        } catch (err) {
          console.error("Error processing QR code data:", err);
          clearScanTimeout();
          setIsScanning(false);
          scanTypeRef.current = null;
          resp({ success: false, error: String(err) });
        }
      }
    );

    return () => {
      offQr();
    };
  // Note: We removed the processing callback functions from dependencies since we now use refs
  // The refs are always up-to-date via useEffect hooks, so the bridge handler always calls the latest version
  }, [clearScanTimeout]);

  // Setup bridge when ready
  useEffect(() => {
    if (bridge && isBridgeReady && !bridgeHandlersRegisteredRef.current) {
      console.info('=== AttendantFlow: Setting up bridge handlers ===');
      bridgeHandlersRegisteredRef.current = true;
      const cleanup = setupBridge(bridge as unknown as WebViewJavascriptBridge);
      return cleanup;
    }
  }, [bridge, isBridgeReady, setupBridge]);

  // Step 1: Scan Customer QR - with MQTT identify_customer
  const handleScanCustomer = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please wait for initialization...');
      console.error('Attempted to scan customer but bridge is not ready');
      return;
    }

    if (!isMqttConnected) {
      toast.error('MQTT not connected. Please wait a moment and try again.');
      console.error('Attempted to scan customer but MQTT is not connected');
      return;
    }

    setIsScanning(true);
    scanTypeRef.current = 'customer';
    startQrCodeScan();
  }, [isMqttConnected, startQrCodeScan]);

  // Step 1: Manual lookup - also uses MQTT
  const handleManualLookup = useCallback(async () => {
    if (!manualSubscriptionId.trim()) {
      toast.error('Please enter a Subscription ID');
      return;
    }

    if (!bridge || !isBridgeReady) {
      toast.error('Bridge not available. Please wait for initialization...');
      console.error('Attempted manual lookup but bridge is not ready. bridge:', !!bridge, 'isBridgeReady:', isBridgeReady);
      return;
    }

    if (!isMqttConnected) {
      toast.error('MQTT not connected. Please wait a moment and try again.');
      console.error('Attempted manual lookup but MQTT is not connected');
      return;
    }
    
    setIsProcessing(true);
    
    // Set a timeout to prevent infinite loading (30 seconds)
    const timeoutId = setTimeout(() => {
      console.error("Manual lookup timed out after 30 seconds");
      toast.error("Request timed out. Please try again.");
      setIsProcessing(false);
    }, 30000);
    
    // Use the subscription ID as the plan_id
    const subscriptionCode = manualSubscriptionId.trim();
    setDynamicPlanId(subscriptionCode);
    
    // Generate correlation ID
    const correlationId = `att-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    correlationIdRef.current = correlationId;
    (window as any).__customerIdentificationCorrelationId = correlationId;

    // Build MQTT payload for manual lookup
    const requestTopic = `emit/uxi/attendant/plan/${subscriptionCode}/identify_customer`;
    // IMPORTANT: Response topic must match what the backend publishes to (attendant, not service)
    const responseTopic = `echo/abs/attendant/plan/${subscriptionCode}/identify_customer`;

    const payload = {
      timestamp: new Date().toISOString(),
      plan_id: subscriptionCode,
      correlation_id: correlationId,
      actor: { type: "attendant", id: attendantInfo.id },
      data: {
        action: "IDENTIFY_CUSTOMER",
        qr_code_data: `MANUAL_${subscriptionCode}`,
        attendant_station: attendantInfo.station,
      },
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: payload,
    };

    console.info("=== Manual Customer Identification MQTT ===");
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Correlation ID:", correlationId);
    console.info("Payload:", JSON.stringify(payload, null, 2));

    // Register response handler (same as QR scan)
    bridge.registerHandler(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedMqttData = JSON.parse(data);
          const topic = parsedMqttData.topic;
          const rawMessageContent = parsedMqttData.message;

          console.info("=== MQTT Message Arrived (Manual Lookup Flow) ===");
          console.info("Received topic:", topic);
          console.info("Expected topic:", responseTopic);
          console.info("Topic match:", topic === responseTopic);

          if (topic === responseTopic) {
            console.info("✅ Topic MATCHED! Processing identify_customer response (manual)");
            console.info("Response data:", JSON.stringify(parsedMqttData, null, 2));
            
            let responseData: any;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch {
              responseData = rawMessageContent;
            }

            const storedCorrelationId = (window as any).__customerIdentificationCorrelationId;
            const responseCorrelationId = responseData?.correlation_id;

            const correlationMatches =
              Boolean(storedCorrelationId) &&
              Boolean(responseCorrelationId) &&
              (responseCorrelationId === storedCorrelationId ||
                responseCorrelationId.startsWith(storedCorrelationId) ||
                storedCorrelationId.startsWith(responseCorrelationId));

            if (correlationMatches) {
              // Clear the timeout since we got a response
              clearTimeout(timeoutId);
              
              const success = responseData?.data?.success ?? false;
              const signals = responseData?.data?.signals || [];

              console.info("Response success:", success, "signals:", signals);

              // Check for both CUSTOMER_IDENTIFIED_SUCCESS and IDEMPOTENT_OPERATION_DETECTED
              const hasSuccessSignal = success === true && 
                Array.isArray(signals) && 
                (signals.includes("CUSTOMER_IDENTIFIED_SUCCESS") || signals.includes("IDEMPOTENT_OPERATION_DETECTED"));

              if (hasSuccessSignal) {
                console.info("Customer identification successful (manual)!");
                
                // Handle both fresh and idempotent (cached) responses
                const metadata = responseData?.data?.metadata;
                const isIdempotent = signals.includes("IDEMPOTENT_OPERATION_DETECTED");
                
                // For idempotent responses, data is in cached_result
                const sourceData = isIdempotent ? metadata?.cached_result : metadata;
                const servicePlanData = sourceData?.service_plan_data || sourceData?.servicePlanData;
                const serviceBundle = sourceData?.service_bundle;
                const identifiedCustomerId = sourceData?.customer_id || metadata?.customer_id;
                
                if (servicePlanData) {
                  const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
                    (service: any) => typeof service?.service_id === 'string'
                  );
                  
                  const enrichedServiceStates = extractedServiceStates.map((serviceState: any) => {
                    const matchingService = serviceBundle?.services?.find(
                      (svc: any) => svc.serviceId === serviceState.service_id
                    );
                    return {
                      ...serviceState,
                      name: matchingService?.name,
                      usageUnitPrice: matchingService?.usageUnitPrice,
                    };
                  });
                  
                  setServiceStates(enrichedServiceStates);
                  
                  const batteryFleet = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-battery-fleet')
                  );
                  setCustomerType(batteryFleet?.current_asset ? 'returning' : 'first-time');
                  
                  const elecService = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-electricity')
                  );
                  const swapCountService = enrichedServiceStates.find(
                    (s: any) => s.service_id?.includes('service-swap-count')
                  );
                  
                  if (elecService?.usageUnitPrice) {
                    setSwapData(prev => ({ ...prev, rate: elecService.usageUnitPrice }));
                  }
                  
                  setCustomerData({
                    id: identifiedCustomerId || servicePlanData.customerId,
                    name: identifiedCustomerId || 'Customer',
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode,
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    swapCount: swapCountService?.used || 0,
                    lastSwap: 'N/A',
                    energyRemaining: elecService ? (elecService.quota - elecService.used) : 0,
                    energyTotal: elecService?.quota || 0,
                    swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
                    swapsTotal: swapCountService?.quota || 21,
                    // FSM states from response
                    paymentState: servicePlanData.paymentState || 'INITIAL',
                    serviceState: servicePlanData.serviceState || 'INITIAL',
                    currentBatteryId: batteryFleet?.current_asset || undefined,
                  });
                  
                  setCurrentStep(2);
                  toast.success(isIdempotent ? 'Customer found (cached)' : 'Customer found');
                  setIsProcessing(false);
                } else {
                  console.error("No service_plan_data in response:", responseData);
                  toast.error("Invalid customer data received");
                  setIsProcessing(false);
                }
              } else {
                console.error("Customer identification failed - success:", success, "signals:", signals);
                const errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message || "Customer not found";
                toast.error(errorMsg);
                setIsProcessing(false);
              }
            }
          }
          responseCallback({});
        } catch (err) {
          console.error("Error processing MQTT response:", err);
          clearTimeout(timeoutId);
          setIsProcessing(false);
        }
      }
    );

    // Subscribe to response topic first, then publish
    console.info("=== Subscribing to response topic (manual lookup) ===");
    console.info("Subscribing to topic:", responseTopic);
    
    bridge.callHandler(
      "mqttSubTopic",
      { topic: responseTopic, qos: 0 },
      (subscribeResponse: string) => {
        console.info("mqttSubTopic callback received:", subscribeResponse);
        try {
          const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
          
          if (subResp?.respCode === "200") {
            console.info("✅ Successfully subscribed to:", responseTopic);
            console.info("Now publishing identify_customer request (manual)...");
            
            // Wait a moment after subscribe before publishing
            setTimeout(() => {
              try {
                bridge.callHandler(
                  "mqttPublishMsg",
                  JSON.stringify(dataToPublish),
                  (publishResponse: string) => {
                    console.info("mqttPublishMsg callback received:", publishResponse);
                    try {
                      const pubResp = typeof publishResponse === 'string' ? JSON.parse(publishResponse) : publishResponse;
                      if (pubResp?.error || pubResp?.respCode !== "200") {
                        console.error("Failed to publish identify_customer:", pubResp?.respDesc || pubResp?.error);
                        toast.error("Failed to lookup customer");
                        clearTimeout(timeoutId);
                        setIsProcessing(false);
                      } else {
                        console.info("identify_customer published successfully (manual), waiting for response...");
                      }
                    } catch (err) {
                      console.error("Error parsing publish response:", err);
                      toast.error("Error looking up customer");
                      clearTimeout(timeoutId);
                      setIsProcessing(false);
                    }
                  }
                );
                console.info("bridge.callHandler('mqttPublishMsg') called successfully");
              } catch (err) {
                console.error("Exception calling bridge.callHandler for publish:", err);
                toast.error("Error sending request. Please try again.");
                clearTimeout(timeoutId);
                setIsProcessing(false);
              }
            }, 300);
          } else {
            console.error("Failed to subscribe to response topic:", subResp?.respDesc || subResp?.error);
            toast.error("Failed to connect. Please try again.");
            clearTimeout(timeoutId);
            setIsProcessing(false);
          }
        } catch (err) {
          console.error("Error parsing subscribe response:", err);
          toast.error("Error connecting. Please try again.");
          clearTimeout(timeoutId);
          setIsProcessing(false);
        }
      }
    );
  }, [bridge, manualSubscriptionId, attendantInfo, isMqttConnected, isBridgeReady]);

  // Step 2: Scan Old Battery
  const handleScanOldBattery = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Clear any existing flow error when retrying
    setFlowError(null);
    
    setIsScanning(true);
    scanTypeRef.current = 'old_battery';
    
    // Set timeout for battery scan (15 seconds - shorter than customer identification)
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      console.warn("Old battery scan timed out after 15 seconds");
      toast.error("Scan timed out. Please try again.");
      cancelOngoingScan();
    }, 15000);
    
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, cancelOngoingScan]);

  // Step 3: Scan New Battery
  const handleScanNewBattery = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    scanTypeRef.current = 'new_battery';
    
    // Set timeout for battery scan (15 seconds - shorter than customer identification)
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      console.warn("New battery scan timed out after 15 seconds");
      toast.error("Scan timed out. Please try again.");
      cancelOngoingScan();
    }, 15000);
    
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, cancelOngoingScan]);

  // Step 4: Proceed to payment
  const handleProceedToPayment = useCallback(() => {
    setCurrentStep(5);
  }, []);

  // Step 5: Confirm Payment via HTTP
  const handleConfirmPayment = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    scanTypeRef.current = 'payment';
    startQrCodeScan();
  }, [startQrCodeScan]);

  // Step 5: Manual payment confirmation
  const handleManualPayment = useCallback((paymentId: string) => {
    setIsProcessing(true);
    
    // Call HTTP endpoint for manual payment confirmation
    const confirmManualPayment = async () => {
      try {
        const response = await fetch(PAYMENT_CONFIRMATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: paymentId,
            plan_id: dynamicPlanId,
            amount: swapData.cost,
          }),
        });
        
        if (response.ok) {
          setPaymentConfirmed(true);
          setPaymentReceipt(paymentId);
          setTransactionId(paymentId);
          toast.success('Payment confirmed');
          
          // Now publish payment_and_service
          publishPaymentAndService(paymentId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          toast.error(errorData.message || 'Payment confirmation failed');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Manual payment error:', err);
        toast.error('Payment confirmation failed. Check network connection.');
        setIsProcessing(false);
      }
    };
    
    confirmManualPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPlanId, swapData.cost]);

  // Publish payment_and_service via MQTT
  const publishPaymentAndService = useCallback((paymentReference: string) => {
    if (!bridge) {
      console.error("Bridge not available for payment_and_service");
      toast.error('Bridge not available. Please restart the app.');
      setIsScanning(false);
      setIsProcessing(false);
      return;
    }

    setPaymentAndServiceStatus('pending');
    
    // Set a timeout to prevent infinite loading (30 seconds)
    const timeoutId = setTimeout(() => {
      console.error("payment_and_service timed out after 30 seconds");
      toast.error("Request timed out. Please try again.");
      setPaymentAndServiceStatus('error');
      setIsScanning(false);
      setIsProcessing(false);
    }, 30000);

    const formattedCheckoutId = swapData.newBattery?.id 
      ? `BAT_NEW_${swapData.newBattery.id}` 
      : null;
    
    const formattedCheckinId = swapData.oldBattery?.id
      ? `BAT_RETURN_ATT_${swapData.oldBattery.id}`
      : null;

    const checkoutEnergy = swapData.newBattery?.energy || 0;
    const checkinEnergy = swapData.oldBattery?.energy || 0;
    let energyTransferred = customerType === 'returning' 
      ? checkoutEnergy - checkinEnergy 
      : checkoutEnergy;
    if (energyTransferred < 0) energyTransferred = 0;

    const serviceId = electricityService?.service_id || "service-electricity-default";
    const paymentAmount = swapData.cost;
    const paymentCorrelationId = `att-checkout-payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    let paymentAndServicePayload: any = null;

    if (customerType === 'returning' && formattedCheckinId) {
      // Returning customer payload
      const oldBatteryId = swapData.oldBattery?.id 
        ? `BAT_NEW_${swapData.oldBattery.id}` 
        : formattedCheckinId;

      paymentAndServicePayload = {
        timestamp: new Date().toISOString(),
        plan_id: dynamicPlanId,
        correlation_id: paymentCorrelationId,
        actor: { type: "attendant", id: attendantInfo.id },
        data: {
          action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
          attendant_station: attendantInfo.station,
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
    } else if (customerType === 'first-time' && formattedCheckoutId) {
      // First-time customer payload
      paymentAndServicePayload = {
        timestamp: new Date().toISOString(),
        plan_id: dynamicPlanId,
        correlation_id: paymentCorrelationId,
        actor: { type: "attendant", id: attendantInfo.id },
        data: {
          action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
          attendant_station: attendantInfo.station,
          payment_data: {
            service_id: serviceId,
            payment_amount: paymentAmount,
            payment_reference: paymentReference,
            payment_method: "MPESA",
            payment_type: "DEPOSIT",
          },
          service_data: {
            new_battery_id: formattedCheckoutId,
            energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
            service_duration: 240,
          },
        },
      };
    }

    if (!paymentAndServicePayload) {
      console.error("Unable to build payment_and_service payload - missing battery data");
      toast.error("Unable to complete swap - missing battery data");
      setPaymentAndServiceStatus('error');
      clearTimeout(timeoutId);
      setIsScanning(false);
      setIsProcessing(false);
      return;
    }

    const requestTopic = `emit/uxi/attendant/plan/${dynamicPlanId}/payment_and_service`;
    // IMPORTANT: Response topic must match what the backend publishes to (attendant, not service)
    const responseTopic = `echo/abs/attendant/plan/${dynamicPlanId}/payment_and_service`;
    
    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: paymentAndServicePayload,
    };

    console.info("=== Publishing payment_and_service ===");
    console.info("Request Topic:", requestTopic);
    console.info("Response Topic:", responseTopic);
    console.info("Correlation ID:", paymentCorrelationId);
    console.info("Payload:", JSON.stringify(paymentAndServicePayload, null, 2));

    // Store correlation ID for response matching
    (window as any).__paymentAndServiceCorrelationId = paymentCorrelationId;

    // Register response handler to handle idempotent responses gracefully
    bridge.registerHandler(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedMqttData = JSON.parse(data);
          const topic = parsedMqttData.topic;
          const rawMessageContent = parsedMqttData.message;

          console.info("=== MQTT Message Arrived (Payment & Service Flow) ===");
          console.info("Received topic:", topic);
          console.info("Expected topic:", responseTopic);
          console.info("Topic match:", topic === responseTopic);

          // Check if this is our response topic
          if (topic === responseTopic) {
            console.info("✅ Topic MATCHED! Processing payment_and_service response");
            console.info("Response data:", JSON.stringify(parsedMqttData, null, 2));

            let responseData: any;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch {
              responseData = rawMessageContent;
            }

            // Check correlation ID
            const storedCorrelationId = (window as any).__paymentAndServiceCorrelationId;
            const responseCorrelationId = responseData?.correlation_id;

            const correlationMatches =
              Boolean(storedCorrelationId) &&
              Boolean(responseCorrelationId) &&
              (responseCorrelationId === storedCorrelationId ||
                responseCorrelationId.startsWith(storedCorrelationId) ||
                storedCorrelationId.startsWith(responseCorrelationId));

            if (correlationMatches) {
              clearTimeout(timeoutId);
              
              const success = responseData?.data?.success ?? false;
              const signals = responseData?.data?.signals || [];

              console.info("payment_and_service response - success:", success, "signals:", signals);

              // Handle both fresh success and idempotent (cached) responses
              // Fresh success signals: ASSET_RETURNED, ASSET_ALLOCATED, SERVICE_COMPLETED
              // Idempotent signal: IDEMPOTENT_OPERATION_DETECTED
              const isIdempotent = signals.includes("IDEMPOTENT_OPERATION_DETECTED");
              const hasServiceCompletedSignal = signals.includes("SERVICE_COMPLETED");
              const hasAssetSignals = signals.includes("ASSET_RETURNED") || signals.includes("ASSET_ALLOCATED");
              
              const hasSuccessSignal = success === true && 
                Array.isArray(signals) && 
                (isIdempotent || hasServiceCompletedSignal || hasAssetSignals);

              if (hasSuccessSignal) {
                console.info("payment_and_service completed successfully!", isIdempotent ? "(idempotent)" : "");
                
                // Clear the correlation ID to prevent fire-and-forget fallback
                (window as any).__paymentAndServiceCorrelationId = null;
                
                setPaymentAndServiceStatus('success');
                setCurrentStep(6);
                toast.success(isIdempotent ? 'Swap completed! (already recorded)' : 'Swap completed!');
              } else if (success) {
                // Success without specific signal - still treat as success
                console.info("payment_and_service completed (generic success)");
                
                // Clear the correlation ID to prevent fire-and-forget fallback
                (window as any).__paymentAndServiceCorrelationId = null;
                
                setPaymentAndServiceStatus('success');
                setCurrentStep(6);
                toast.success('Swap completed!');
              } else {
                // Response received but not successful
                console.error("payment_and_service failed - success:", success, "signals:", signals);
                const errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message || "Failed to record swap";
                toast.error(errorMsg);
                setPaymentAndServiceStatus('error');
              }
              
              setIsScanning(false);
              setIsProcessing(false);
            }
          }
          responseCallback({});
        } catch (err) {
          console.error("Error processing payment_and_service MQTT response:", err);
        }
      }
    );

    // Publish the request
    console.info("=== Calling bridge.callHandler('mqttPublishMsg') for payment_and_service ===");
    
    try {
      bridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        (publishResponse: any) => {
          console.info("payment_and_service mqttPublishMsg callback received:", publishResponse);
          try {
            const pubResp = typeof publishResponse === 'string' 
              ? JSON.parse(publishResponse) 
              : publishResponse;
            
            if (pubResp?.error || pubResp?.respCode !== "200") {
              console.error("Failed to publish payment_and_service:", pubResp?.respDesc || pubResp?.error);
              toast.error("Failed to complete swap");
              setPaymentAndServiceStatus('error');
              clearTimeout(timeoutId);
              setIsScanning(false);
              setIsProcessing(false);
            } else {
              console.info("payment_and_service published successfully, waiting for response...");
              // Don't complete yet - wait for response handler or timeout
              // If backend doesn't send response, timeout will handle it
              // For backward compatibility, also set success after a short delay
              // in case no response comes (fire-and-forget fallback)
              setTimeout(() => {
                // Only complete if still pending (no response received yet)
                if ((window as any).__paymentAndServiceCorrelationId === paymentCorrelationId) {
                  console.info("No response received for payment_and_service, assuming success (fire-and-forget)");
                  clearTimeout(timeoutId);
                  setPaymentAndServiceStatus('success');
                  setCurrentStep(6);
                  toast.success('Swap completed!');
                  setIsScanning(false);
                  setIsProcessing(false);
                  // Clear the correlation ID
                  (window as any).__paymentAndServiceCorrelationId = null;
                }
              }, 5000); // 5 second grace period for response
            }
          } catch (err) {
            console.error("Error parsing payment_and_service publish response:", err);
            toast.error("Error completing swap");
            setPaymentAndServiceStatus('error');
            clearTimeout(timeoutId);
            setIsScanning(false);
            setIsProcessing(false);
          }
        }
      );
      console.info("bridge.callHandler('mqttPublishMsg') called successfully for payment_and_service");
    } catch (err) {
      console.error("Exception calling bridge.callHandler for payment_and_service:", err);
      toast.error("Error sending request. Please try again.");
      setPaymentAndServiceStatus('error');
      clearTimeout(timeoutId);
      setIsScanning(false);
      setIsProcessing(false);
    }
  }, [bridge, dynamicPlanId, swapData, customerType, electricityService?.service_id, attendantInfo]);

  // Step 6: Start new swap
  const handleNewSwap = useCallback(() => {
    setCurrentStep(1);
    setCustomerData(null);
    setSwapData({
      oldBattery: null,
      newBattery: null,
      energyDiff: 0,
      cost: 0,
      rate: 120,
    });
    setManualSubscriptionId('');
    setTransactionId('');
    setInputMode('scan');
    setDynamicPlanId('');
    setServiceStates([]);
    setCustomerType(null);
    setPaymentConfirmed(false);
    setPaymentReceipt(null);
    setPaymentAndServiceStatus('idle');
    setFlowError(null); // Clear any flow errors
    cancelOngoingScan(); // Clear any pending timeouts
  }, [cancelOngoingScan]);

  // Go back one step
  const handleBack = useCallback(() => {
    // If currently scanning, cancel the scan first
    if (isScanning) {
      console.info("Cancelling ongoing scan due to back navigation");
      cancelOngoingScan();
      // Don't change step - just cancel scan and stay on current step
      return;
    }
    
    // If there's a flow error, clear it and allow retry
    if (flowError) {
      setFlowError(null);
      // Stay on current step to allow retry
      return;
    }
    
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as AttendantStep);
    }
  }, [currentStep, isScanning, flowError, cancelOngoingScan]);

  // Handle back to roles (don't logout - shared between Attendant & Sales)
  const handleBackToRoles = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  }, [onBack, router]);

  // Handle timeline step click (go back to previous steps)
  const handleTimelineClick = useCallback((step: AttendantStep) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  }, [currentStep]);

  // Get main action based on current step
  const handleMainAction = useCallback(() => {
    switch (currentStep) {
      case 1:
        if (inputMode === 'scan') {
          handleScanCustomer();
        } else {
          handleManualLookup();
        }
        break;
      case 2:
        handleScanOldBattery();
        break;
      case 3:
        handleScanNewBattery();
        break;
      case 4:
        handleProceedToPayment();
        break;
      case 5:
        handleConfirmPayment();
        break;
      case 6:
        handleNewSwap();
        break;
    }
  }, [currentStep, inputMode, handleScanCustomer, handleManualLookup, handleScanOldBattery, handleScanNewBattery, handleProceedToPayment, handleConfirmPayment, handleNewSwap]);

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1CustomerScan
            inputMode={inputMode}
            setInputMode={setInputMode}
            manualSubscriptionId={manualSubscriptionId}
            setManualSubscriptionId={setManualSubscriptionId}
            onScanCustomer={handleScanCustomer}
            onManualLookup={handleManualLookup}
            isProcessing={isProcessing}
            stats={stats}
          />
        );
      case 2:
        return (
          <Step2OldBattery 
            onScanOldBattery={handleScanOldBattery}
            expectedBatteryId={customerData?.currentBatteryId}
            isFirstTimeCustomer={customerType === 'first-time'}
          />
        );
      case 3:
        return (
          <Step3NewBattery 
            oldBattery={swapData.oldBattery} 
            onScanNewBattery={handleScanNewBattery} 
          />
        );
      case 4:
        return (
          <Step4Review 
            swapData={swapData} 
            customerData={customerData} 
          />
        );
      case 5:
        return (
          <Step5Payment 
            swapData={swapData} 
            onConfirmPayment={handleConfirmPayment}
            onManualPayment={handleManualPayment}
            isProcessing={isProcessing || paymentAndServiceStatus === 'pending'}
          />
        );
      case 6:
        return (
          <Step6Success 
            swapData={swapData} 
            customerData={customerData} 
            transactionId={transactionId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="attendant-container">
      <div className="attendant-bg-gradient" />
      
      {/* Back to Roles */}
      <div style={{ padding: '8px 16px 0' }}>
        <button className="back-to-roles" onClick={handleBackToRoles}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Change Role
        </button>
      </div>

      {/* Interactive Timeline */}
      <Timeline 
        currentStep={currentStep} 
        onStepClick={handleTimelineClick}
        flowError={flowError}
      />

      {/* Customer State Panel - Shows after customer identified */}
      <CustomerStatePanel 
        customer={customerData} 
        visible={currentStep > 1}
      />

      {/* Main Content */}
      <main className="attendant-main">
        {renderStepContent()}
      </main>

      {/* Action Bar */}
      <ActionBar
        currentStep={currentStep}
        onBack={handleBack}
        onMainAction={handleMainAction}
        isLoading={isScanning || isProcessing || paymentAndServiceStatus === 'pending'}
        inputMode={inputMode}
      />

      {/* Loading Overlay */}
      {(isScanning || isProcessing || paymentAndServiceStatus === 'pending') && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {paymentAndServiceStatus === 'pending' ? 'Completing swap...' : isScanning ? 'Scanning...' : 'Processing...'}
          </div>
        </div>
      )}
    </div>
  );
}
