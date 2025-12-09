'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { getAttendantUser, clearEmployeeLogin } from '@/lib/attendant-auth';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/i18n';

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
  PaymentInitiation,
} from './components';
import ProgressiveLoading from '@/components/loader/progressiveLoading';
import { BleProgressModal } from '@/components/shared';

// Import modular BLE hook for battery scanning (available for future migration)
import { useFlowBatteryScan, type FlowBleScanState } from '@/lib/hooks/ble';

// Import Odoo API functions for payment
import {
  initiatePayment,
  confirmPaymentManual,
  createPaymentRequest,
  type CreatePaymentRequestResponse,
  type PaymentRequestData,
} from '@/lib/odoo-api';
import { PAYMENT } from '@/lib/constants';

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

interface AttendantFlowProps {
  onBack?: () => void;
  onLogout?: () => void;
}

export default function AttendantFlow({ onBack, onLogout }: AttendantFlowProps) {
  const router = useRouter();
  const { bridge, isMqttConnected, isBridgeReady } = useBridge();
  const { locale, setLocale, t } = useI18n();
  
  // Attendant info from login
  const [attendantInfo, setAttendantInfo] = useState<{ id: string; station: string }>({
    id: 'attendant-001',
    station: 'STATION_001',
  });

  // Lock body overflow for fixed container
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  // Toggle locale function
  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

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
  // Track the furthest step reached to allow navigation back and forth without losing state
  const [maxStepReached, setMaxStepReached] = useState<AttendantStep>(1);

  // Helper to advance to a new step - updates maxStepReached if moving forward
  const advanceToStep = useCallback((step: AttendantStep) => {
    setCurrentStep(step);
    setMaxStepReached(prev => Math.max(prev, step) as AttendantStep);
  }, []);
  
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
    quotaDeduction: 0,  // Amount of remaining quota to apply (in kWh)
    chargeableEnergy: 0,  // Energy to charge for after quota deduction (in kWh)
    cost: 0,
    rate: 120, // Will be updated from service response
    currencySymbol: PAYMENT.defaultCurrency, // Will be updated from service/subscription response
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
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [paymentInitiationData, setPaymentInitiationData] = useState<PaymentInitiation | null>(null);
  
  // Payment request states (ticket created before collecting payment)
  const [paymentRequestCreated, setPaymentRequestCreated] = useState(false);
  const [paymentRequestData, setPaymentRequestData] = useState<PaymentRequestData | null>(null);
  const [paymentRequestOrderId, setPaymentRequestOrderId] = useState<number | null>(null);
  // Expected amount the customer needs to pay for this swap (swapData.cost at time of request creation)
  const [expectedPaymentAmount, setExpectedPaymentAmount] = useState<number>(0);
  
  // Phase states
  const [paymentAndServiceStatus, setPaymentAndServiceStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  
  // Flow error state - tracks failures that end the process
  const [flowError, setFlowError] = useState<FlowError | null>(null);
  
  // ============================================
  // BLE SCAN-TO-BIND HOOK (Modular BLE handling)
  // ============================================
  
  // Ref for electricity service to use in callbacks without recreation
  const electricityServiceRef = useRef<typeof electricityService>(undefined);
  
  // BLE scan-to-bind hook - handles all BLE operations for battery scanning
  const {
    bleScanState,
    pendingBatteryId,
    isReady: bleIsReady,
    startScanning: hookStartScanning,
    stopScanning: hookStopScanning,
    handleQrScanned: hookHandleQrScanned,
    cancelOperation: hookCancelOperation,
    resetState: hookResetState,
    retryConnection: hookRetryConnection,
  } = useFlowBatteryScan({
    onOldBatteryRead: (battery) => {
      console.info('Old battery read via hook:', battery);
      setSwapData(prev => ({ ...prev, oldBattery: battery }));
      advanceToStep(3);
      toast.success(`Old battery: ${(battery.energy / 1000).toFixed(3)} kWh (${battery.chargeLevel}%)`);
      setIsScanning(false);
      scanTypeRef.current = null;
    },
    onNewBatteryRead: (battery) => {
      console.info('New battery read via hook:', battery);
      // Calculate energy difference and cost
      setSwapData(prev => {
        const oldEnergy = prev.oldBattery?.energy || 0;
        const energyDiffWh = battery.energy - oldEnergy;
        // IMPORTANT: Round energy to 2 decimal places BEFORE using for calculations
        // This ensures consistent pricing (e.g., 2.54530003 kWh becomes 2.54 kWh)
        const energyDiffKwh = Math.floor((energyDiffWh / 1000) * 100) / 100;
        
        // Get rate from electricity service
        const rate = electricityServiceRef.current?.usageUnitPrice || prev.rate;
        
        // Get remaining electricity quota
        const elecQuota = Number(electricityServiceRef.current?.quota ?? 0);
        const elecUsed = Number(electricityServiceRef.current?.used ?? 0);
        const remainingQuotaKwh = Math.max(0, elecQuota - elecUsed);
        
        // Calculate quota deduction
        const quotaDeduction = energyDiffKwh > 0 
          ? Math.min(remainingQuotaKwh, energyDiffKwh) 
          : 0;
        
        // Chargeable energy after quota - floor to 2 decimal places for consistency
        const chargeableEnergyRaw = Math.max(0, energyDiffKwh - quotaDeduction);
        const chargeableEnergyFloored = Math.floor(chargeableEnergyRaw * 100) / 100;
        
        // Cost based on floored chargeable energy
        // IMPORTANT: Use Math.floor to round DOWN - ensures payment is never more than service value
        // This guarantees the recorded payment amount matches the displayed/charged amount
        const cost = Math.floor(chargeableEnergyFloored * rate * 100) / 100;
        
        console.info('Energy differential calculated:', {
          oldEnergyWh: oldEnergy,
          newEnergyWh: battery.energy,
          energyDiffKwh,
          remainingQuotaKwh,
          quotaDeduction,
          chargeableEnergy: chargeableEnergyFloored,
          ratePerKwh: rate,
          cost,
        });
        
        return {
          ...prev,
          newBattery: battery,
          // Energy values floored to 2 decimal places for consistency with pricing
          energyDiff: Math.floor(energyDiffKwh * 100) / 100,
          quotaDeduction: Math.floor(quotaDeduction * 100) / 100,
          chargeableEnergy: chargeableEnergyFloored,
          cost: cost > 0 ? cost : 0,
        };
      });
      advanceToStep(4);
      toast.success(`New battery: ${(battery.energy / 1000).toFixed(3)} kWh (${battery.chargeLevel}%)`);
      setIsScanning(false);
      scanTypeRef.current = null;
    },
    onError: (error, requiresReset) => {
      console.error('BLE error via hook:', error, { requiresReset });
      setIsScanning(false);
      scanTypeRef.current = null;
    },
    debug: true,
  });
  
  // BLE handlers ready flag - hook is ready when bleIsReady is true
  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);
  
  // Sync bleHandlersReady with hook's isReady
  useEffect(() => {
    if (bleIsReady && !bleHandlersReady) {
      setBleHandlersReady(true);
    }
  }, [bleIsReady, bleHandlersReady]);
  
  // NOTE: All BLE refs (pendingBatteryQrCodeRef, detectedBleDevicesRef, etc.) 
  // are now managed internally by the useFlowBatteryScan hook
  
  // Stats (fetched from API in a real implementation)
  const [stats] = useState({ today: 0, thisWeek: 0, successRate: 0 });

  // Transaction ID
  const [transactionId, setTransactionId] = useState<string>('');
  
  // Payment step input mode (scan QR or manual entry)
  const [paymentInputMode, setPaymentInputMode] = useState<'scan' | 'manual'>('scan');
  // Manual payment ID input
  const [manualPaymentId, setManualPaymentId] = useState<string>('');
  // Payment amount tracking - amount_remaining from Odoo response (0 means fully paid)
  const [paymentAmountRemaining, setPaymentAmountRemaining] = useState<number>(0);
  // Actual amount paid by customer (from Odoo response)
  const [actualAmountPaid, setActualAmountPaid] = useState<number>(0);
  
  // Ref for correlation ID
  const correlationIdRef = useRef<string>('');
  
  // Ref for tracking current scan type
  const scanTypeRef = useRef<'customer' | 'old_battery' | 'new_battery' | 'payment' | null>(null);
  
  // Track if QR scan was initiated to detect when user returns without scanning
  const qrScanInitiatedRef = useRef<boolean>(false);
  
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

  // Cancel/Close ongoing BLE operation - delegates to hook
  const cancelBleOperation = useCallback(() => {
    console.info('=== Cancelling BLE operation via hook ===');
    clearScanTimeout();
    hookCancelOperation();
    setIsScanning(false);
    scanTypeRef.current = null;
  }, [clearScanTimeout, hookCancelOperation]);
  
  // Retry BLE connection - delegates to hook
  const retryBleConnection = useCallback(() => {
    console.info('=== Retrying BLE connection via hook ===');
    hookRetryConnection();
  }, [hookRetryConnection]);

  // Get electricity service from service states
  const electricityService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-electricity')
  );
  
  // Keep electricityServiceRef in sync for use in BLE hook callbacks
  useEffect(() => {
    electricityServiceRef.current = electricityService;
  }, [electricityService]);

  // Get swap-count service from service states
  const swapCountService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-swap-count')
  );

  // Get battery fleet service (to check current_asset for customer type)
  const batteryFleetService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-battery-fleet')
  );

  // Check if we can skip payment collection
  // Returns true if BOTH conditions are met:
  // 1. Electricity quota: remaining kWh >= energy being transferred (or rounded cost <= 0)
  // 2. Swap count quota: remaining swaps >= 1
  // NOTE: We use Math.floor(cost) for this decision since customers can't pay decimals
  const hasSufficientQuota = useMemo(() => {
    // Only check quota/cost once we have battery data (Step 4 - Review)
    // Without new battery data, we can't determine if payment is needed
    if (!swapData.newBattery) {
      return false;
    }
    
    // Calculate rounded cost - customers can't pay decimals so we round down
    // Example: 20.54 becomes 20, 0.54 becomes 0
    const roundedCost = Math.floor(swapData.cost);
    
    // === Check 1: Electricity Quota ===
    let hasEnoughElectricity = false;
    
    // If ACTUAL cost is 0 or negative, no electricity payment is needed
    // This handles cases where customer returns equal or more energy than they receive
    // NOTE: We use swapData.cost (not roundedCost) to distinguish between:
    //   - True zero/negative cost (customer returning energy) → quota-based, no payment_data
    //   - Zero-cost rounding (e.g., 0.54 → 0) → NOT quota-based, include payment_data with ZERO_COST_ROUNDING
    if (swapData.cost <= 0) {
      console.info('Electricity check: actual cost is 0 or negative (not zero-cost rounding)', { 
        cost: swapData.cost, 
        roundedCost 
      });
      hasEnoughElectricity = true;
    } else if (electricityService) {
      const elecQuota = Number(electricityService.quota ?? 0);
      const elecUsed = Number(electricityService.used ?? 0);
      const remainingElecQuota = elecQuota - elecUsed;
      const energyNeeded = swapData.energyDiff;
      
      hasEnoughElectricity = Number.isFinite(remainingElecQuota) && 
                             Number.isFinite(energyNeeded) && 
                             remainingElecQuota >= energyNeeded &&
                             energyNeeded > 0;
      
      console.info('Electricity quota check:', {
        quota: elecQuota,
        used: elecUsed,
        remainingQuota: remainingElecQuota,
        energyNeeded,
        hasEnough: hasEnoughElectricity,
      });
    } else {
      console.info('Electricity check: no electricity service found');
      hasEnoughElectricity = false;
    }
    
    // === Check 2: Swap Count Quota ===
    let hasEnoughSwaps = false;
    
    if (swapCountService) {
      const swapQuota = Number(swapCountService.quota ?? 0);
      const swapUsed = Number(swapCountService.used ?? 0);
      const remainingSwaps = swapQuota - swapUsed;
      
      // Need at least 1 swap remaining
      hasEnoughSwaps = Number.isFinite(remainingSwaps) && remainingSwaps >= 1;
      
      console.info('Swap count quota check:', {
        quota: swapQuota,
        used: swapUsed,
        remainingSwaps,
        hasEnough: hasEnoughSwaps,
      });
    } else {
      console.info('Swap count check: no swap-count service found');
      hasEnoughSwaps = false;
    }
    
    // BOTH checks must pass to skip payment
    const canSkipPayment = hasEnoughElectricity && hasEnoughSwaps;
    
    console.info('Final quota check result:', {
      hasEnoughElectricity,
      hasEnoughSwaps,
      canSkipPayment,
    });
    
    return canSkipPayment;
  }, [electricityService, swapCountService, swapData.energyDiff, swapData.cost, swapData.newBattery]);

  // Start QR code scan using native bridge (follows existing pattern from swap.tsx)
  const startQrCodeScan = useCallback(() => {
    // Prevent multiple scanner opens - if already scanning, ignore duplicate requests
    if (isScanning) {
      console.info('Scanner already open, ignoring duplicate request');
      return;
    }
    
    if (!window.WebViewJavascriptBridge) {
      toast.error('Unable to access camera');
      return;
    }

    // Mark that we initiated a QR scan - used to detect when user returns without scanning
    qrScanInitiatedRef.current = true;

    window.WebViewJavascriptBridge.callHandler(
      'startQrCodeScan',
      999,
      (responseData: string) => {
        console.info('QR Code Scan initiated:', responseData);
      }
    );
  }, [isScanning]);

  // Convert RSSI to human-readable format (same as swap.tsx)
  const convertRssiToFormattedString = useCallback((rssi: number): string => {
    const txPower = -59;
    const n = 2;
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }, []);

  // Start BLE scanning - delegates to hook
  const startBleScan = useCallback(() => {
    console.info('Starting BLE scan via hook');
    hookStartScanning();
  }, [hookStartScanning]);

  // Stop BLE scanning - delegates to hook
  const stopBleScan = useCallback(() => {
    console.info('Stopping BLE scan via hook');
    hookStopScanning();
  }, [hookStopScanning]);


  // Process customer QR code data and send MQTT identify_customer
  const processCustomerQRData = useCallback((qrCodeData: string) => {
    let parsedData: any;
    try {
      parsedData = JSON.parse(qrCodeData);
    } catch {
      parsedData = qrCodeData;
    }

    // If the QR code is a plain string (not JSON object), treat it as the subscription code directly
    // This allows scanning a QR code that IS the subscription code (e.g., "SUB-8847-KE")
    const normalizedData: any = {
      customer_id: typeof parsedData === 'object'
        ? parsedData.customer_id || parsedData.customerId || parsedData.customer?.id || qrCodeData
        : qrCodeData,
      subscription_code: typeof parsedData === 'object'
        ? parsedData.subscription_code || parsedData.subscriptionCode || parsedData.subscription?.code
        : qrCodeData, // Plain string QR code IS the subscription code
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
                const commonTerms = sourceData?.common_terms;
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
                  
                  // Extract billing currency from common_terms (source of truth), fallback to service plan currency
                  const billingCurrency = commonTerms?.billingCurrency || servicePlanData?.currency || PAYMENT.defaultCurrency;
                  
                  // Update swap data with rate and currency from customer's service plan
                  setSwapData(prev => ({ 
                    ...prev, 
                    rate: elecService?.usageUnitPrice || prev.rate,
                    currencySymbol: billingCurrency 
                  }));
                  
                  // Check for infinite quota services (quota > 100,000 indicates management services)
                  const INFINITE_QUOTA_THRESHOLD = 100000;
                  const hasInfiniteEnergyQuota = (elecService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
                  const hasInfiniteSwapQuota = (swapCountService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
                  
                  // Calculate remaining quota values
                  const energyRemaining = elecService ? (elecService.quota - elecService.used) : 0;
                  const energyUnitPrice = elecService?.usageUnitPrice || 0;
                  // Calculate monetary value of remaining energy quota (remaining kWh × unit price)
                  const energyValue = energyRemaining * energyUnitPrice;
                  
                  setCustomerData({
                    id: identifiedCustomerId || servicePlanData.customerId || customerId,
                    name: normalizedData.name || identifiedCustomerId || 'Customer',
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode, // Same ID used by ABS and Odoo
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    phone: normalizedData.phone || '', // For M-Pesa payment
                    swapCount: swapCountService?.used || 0,
                    lastSwap: 'N/A',
                    energyRemaining: energyRemaining,
                    energyTotal: elecService?.quota || 0,
                    energyValue: energyValue,
                    energyUnitPrice: energyUnitPrice,
                    swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
                    swapsTotal: swapCountService?.quota || 21,
                    hasInfiniteEnergyQuota: hasInfiniteEnergyQuota,
                    hasInfiniteSwapQuota: hasInfiniteSwapQuota,
                    paymentState: servicePlanData.paymentState || 'INITIAL',
                    serviceState: servicePlanData.serviceState || 'INITIAL',
                    currentBatteryId: batteryFleet?.current_asset || undefined,
                  });
                  
                  advanceToStep(2);
                  toast.success(isIdempotent ? 'Customer identified (cached)' : 'Customer identified');
                } else {
                  toast.error("Invalid customer data received");
                }
              } else {
                // Provide specific error messages based on failure signals
                let errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message;
                if (!errorMsg) {
                  // Check for specific failure signals to provide better error messages
                  if (signals.includes("SERVICE_PLAN_NOT_FOUND") || signals.includes("CUSTOMER_NOT_FOUND")) {
                    errorMsg = "Customer not found. Please check the subscription ID.";
                  } else if (signals.includes("INVALID_QR_CODE")) {
                    errorMsg = "Invalid QR code. Please scan a valid customer QR code.";
                  } else {
                    errorMsg = "Customer not found";
                  }
                }
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

  // Process old battery QR code data - validates against customer's current battery and initiates BLE connection
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
        stopBleScan();
        return; // Don't proceed to next step
      }
    }
    
    // Initiate scan-to-bind via hook
    console.info('Old battery QR scanned, initiating scan-to-bind via hook:', scannedBatteryId);
    hookHandleQrScanned(qrCodeData, 'old_battery');
  }, [customerType, customerData?.currentBatteryId, clearScanTimeout, stopBleScan, hookHandleQrScanned]);

  // Process new battery QR code data - initiates BLE connection to read energy
  const processNewBatteryQRData = useCallback((qrCodeData: string) => {
    // Clear any pending timeout
    clearScanTimeout();
    
    let batteryData: any;
    try {
      batteryData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      batteryData = { id: qrCodeData };
    }
    
    const scannedBatteryId = batteryData.battery_id || batteryData.id || qrCodeData;
    
    // Prevent scanning the old battery again as the new battery
    if (swapData.oldBattery?.id) {
      // Normalize IDs for comparison (remove prefixes, case insensitive)
      const normalizeId = (id: string) => {
        const cleaned = id.replace(/^(BAT_NEW_|BAT_RETURN_ATT_|BAT_)/i, '');
        return cleaned.toLowerCase();
      };
      
      const scannedNormalized = normalizeId(String(scannedBatteryId));
      const oldBatteryNormalized = normalizeId(String(swapData.oldBattery.id));
      
      // Check if IDs match (exact match, one contains the other, or last 6 chars match)
      const isSameBattery = scannedNormalized === oldBatteryNormalized ||
        scannedNormalized.includes(oldBatteryNormalized) ||
        oldBatteryNormalized.includes(scannedNormalized) ||
        scannedNormalized.slice(-6) === oldBatteryNormalized.slice(-6);
      
      if (isSameBattery) {
        console.error(`Same battery scanned twice: scanned ${scannedBatteryId}, old battery was ${swapData.oldBattery.id}`);
        
        setFlowError({
          step: 3,
          message: 'Cannot use the same battery',
          details: `You scanned the old battery again. Please scan a different battery.`,
        });
        
        toast.error('This is the old battery! Please scan a different battery.');
        setIsScanning(false);
        scanTypeRef.current = null;
        stopBleScan();
        return; // Don't proceed
      }
    }
    
    // Valid new battery detected - clear any previous flow error
    setFlowError(null);
    
    // Initiate scan-to-bind via hook
    console.info('New battery QR scanned, initiating scan-to-bind via hook:', scannedBatteryId);
    hookHandleQrScanned(qrCodeData, 'new_battery');
  }, [clearScanTimeout, swapData.oldBattery?.id, stopBleScan, hookHandleQrScanned]);

  // Create payment request/ticket with Odoo FIRST, then optionally send STK push
  // This MUST be done before collecting payment from the customer.
  // Uses subscriptionId which is the same as servicePlanId - shared between ABS and Odoo
  const initiateOdooPayment = useCallback(async (): Promise<boolean> => {
    // subscriptionId is the servicePlanId - same ID used by both ABS and Odoo
    const subscriptionCode = customerData?.subscriptionId || dynamicPlanId;
    
    if (!subscriptionCode) {
      console.log('No subscription ID, skipping payment request creation');
      setPaymentInitiated(true);
      setPaymentRequestCreated(true);
      return true;
    }

    // Get customer phone - try from customerData first
    const phoneNumber = customerData?.phone || '';
    
    try {
      // Step 1: Create payment request/ticket FIRST
      // We send the ROUNDED DOWN amount to Odoo - this is what we ask the customer to pay
      // (customers can't pay decimals, e.g., 20.54 becomes 20)
      // BUT we store the original amount for backend quota reporting later
      const amountCalculated = swapData.cost; // Original calculated amount (e.g., 20.54)
      const amountRequired = Math.floor(swapData.cost); // Rounded down for payment (e.g., 20)
      
      // Store the ROUNDED amount as expected - this is what customer will actually pay
      setExpectedPaymentAmount(amountRequired);
      
      console.log('Creating payment request with Odoo:', {
        subscription_code: subscriptionCode,
        amount_calculated: amountCalculated,
        amount_required: amountRequired, // Rounded down
        description: `Battery swap service - Energy: ${swapData.energyDiff} Wh`,
      });

      const paymentRequestResponse = await createPaymentRequest({
        subscription_code: subscriptionCode,
        amount_required: amountRequired, // Send rounded amount to Odoo
        description: `Battery swap service - Energy: ${swapData.energyDiff} Wh`,
      });

      if (paymentRequestResponse.success && paymentRequestResponse.payment_request) {
        // Payment request created successfully
        console.log('Payment request created:', paymentRequestResponse.payment_request);
        setPaymentRequestCreated(true);
        setPaymentRequestData(paymentRequestResponse.payment_request);
        setPaymentRequestOrderId(paymentRequestResponse.payment_request.sale_order.id);
        toast.success('Payment ticket created. Collect payment from customer.');
      } else {
        // Payment request creation failed - show error to user
        // This includes the case when there's an existing active payment request
        console.error('Payment request creation failed:', paymentRequestResponse.error);
        
        // Build a detailed error message
        let errorMessage = paymentRequestResponse.error || 'Failed to create payment request';
        
        // If there's an existing request, include details about it
        if (paymentRequestResponse.existing_request) {
          const existingReq = paymentRequestResponse.existing_request;
          errorMessage = `${paymentRequestResponse.message || errorMessage}\n\nExisting request: ${swapData.currencySymbol} ${existingReq.amount_remaining} remaining (${existingReq.status})`;
          
          // Log the available actions for debugging
          console.log('Existing request actions:', existingReq.actions);
        }
        
        // Show instructions if available
        if (paymentRequestResponse.instructions && paymentRequestResponse.instructions.length > 0) {
          console.log('Instructions:', paymentRequestResponse.instructions);
        }
        
        toast.error(errorMessage);
        return false;
      }

      // Step 2: Optionally try to send STK push (don't block if it fails)
      if (phoneNumber) {
        try {
          console.log('Sending STK push to customer phone:', phoneNumber);
          const stkResponse = await initiatePayment({
            subscription_code: subscriptionCode,
            phone_number: phoneNumber,
            amount: amountRequired,
          });

          if (stkResponse.success && stkResponse.data) {
            console.log('STK push sent:', stkResponse.data);
            setPaymentInitiated(true);
            setPaymentInitiationData({
              transactionId: stkResponse.data.transaction_id,
              checkoutRequestId: stkResponse.data.checkout_request_id,
              merchantRequestId: stkResponse.data.merchant_request_id,
              instructions: stkResponse.data.instructions,
            });
            toast.success(stkResponse.data.instructions || 'Check customer phone for M-Pesa prompt');
          }
        } catch (stkError) {
          console.warn('STK push failed (non-blocking):', stkError);
          // Don't show error toast - customer can still pay manually
        }
      }
      
      setPaymentInitiated(true);
      return true;
    } catch (error: any) {
      console.error('Failed to create payment request:', error);
      toast.error(error.message || 'Failed to create payment request. Please try again.');
      return false;
    }
  }, [customerData, dynamicPlanId, swapData.cost, swapData.energyDiff]);

  // Process payment QR code data - verify with Odoo
  // Uses order_id (preferred) or subscription_code to confirm payment
  // IMPORTANT: Only proceeds if total_paid >= expectedPaymentAmount (the swap cost)
  const processPaymentQRData = useCallback((qrCodeData: string) => {
    let qrData: any;
    try {
      qrData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      qrData = { transaction_id: qrCodeData };
    }
    const receipt = qrData.transaction_id || qrData.receipt || qrData.txn_id || qrData.id || qrCodeData;
    
    // Confirm payment with Odoo
    const confirmPayment = async () => {
      // order_id is REQUIRED - must be obtained from createPaymentRequest response
      const orderId = paymentRequestOrderId;
      
      try {
        // order_id is REQUIRED - payment request must be created first
        if (!orderId) {
          toast.error('Payment request not created. Please go back and try again.');
          setIsScanning(false);
          scanTypeRef.current = null;
          return;
        }

        // Use Odoo manual confirmation endpoint with order_id ONLY
        console.log('Confirming payment with order_id:', { order_id: orderId, receipt });
        const response = await confirmPaymentManual({ order_id: orderId, receipt });
        
        if (response.success) {
          // Extract payment amounts from response
          // Handle both wrapped (response.data.X) and unwrapped (response.X) response formats
          const responseData = response.data || (response as any);
          // Use total_paid (new format) or amount_paid (legacy format)
          const totalPaid = responseData.total_paid ?? responseData.amount_paid ?? 0;
          const remainingToPay = responseData.remaining_to_pay ?? responseData.amount_remaining ?? 0;
          
          console.log('Payment validation response:', {
            total_paid: totalPaid,
            remaining_to_pay: remainingToPay,
            expected_to_pay: responseData.expected_to_pay ?? responseData.amount_expected,
            order_id: responseData.order_id,
            expectedPaymentAmount,
          });
          
          // Update state with payment amounts
          setActualAmountPaid(totalPaid);
          setPaymentAmountRemaining(remainingToPay);
          
          // CRITICAL: Check if total_paid >= expected amount for THIS swap
          // This is the amount we calculated (energy * unit price) and displayed to the attendant
          const requiredAmount = expectedPaymentAmount || swapData.cost;
          if (totalPaid < requiredAmount) {
            // Payment insufficient for this swap
            const shortfall = requiredAmount - totalPaid;
            toast.error(`Payment insufficient. Customer paid ${swapData.currencySymbol} ${totalPaid}, but needs to pay ${swapData.currencySymbol} ${requiredAmount}. Short by ${swapData.currencySymbol} ${shortfall}`);
            setIsScanning(false);
            scanTypeRef.current = null;
            // Don't proceed - customer needs to pay more
            return;
          }
          
          // Payment sufficient - proceed with service completion
          setPaymentConfirmed(true);
          setPaymentReceipt(receipt);
          setTransactionId(receipt);
          toast.success('Payment confirmed successfully');
          // Report payment - uses original calculated cost for accurate quota tracking
          publishPaymentAndService(receipt, false);
        } else {
          throw new Error('Payment confirmation failed');
        }
      } catch (err: any) {
        console.error('Payment confirmation error:', err);
        toast.error(err.message || 'Payment confirmation failed. Check network connection.');
        setIsScanning(false);
        scanTypeRef.current = null;
      }
    };
    
    confirmPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPlanId, swapData.cost, customerData, paymentRequestOrderId, expectedPaymentAmount]);

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

  // NOTE: populateEnergyFromDta is now handled internally by useFlowBatteryScan hook
  // which uses extractEnergyFromDta from energyUtils.ts
  useEffect(() => {
    electricityServiceRef.current = electricityService;
  }, [electricityService]);

  // Ref for publishPaymentAndService to avoid circular dependency with handleProceedToPayment
  // isQuotaBased: true when customer has sufficient quota credit (no payment_data sent)
  // isZeroCostRounding: true when cost rounds to 0 but NOT quota-based (payment_data sent with original amount)
  const publishPaymentAndServiceRef = useRef<(paymentReference: string, isQuotaBased?: boolean, isZeroCostRounding?: boolean) => void>(() => {});

  // Reset scanning state when user returns to page without scanning (e.g., pressed back on QR scanner)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && qrScanInitiatedRef.current) {
        // User returned to page - give a small delay to allow QR callback to fire first if scan was successful
        const timeoutId = setTimeout(() => {
          // If scanning state is still true after returning, reset it
          // This happens when user pressed back on QR scanner without scanning
          if (isScanning) {
            console.info('Resetting scanning state - user returned without scanning');
            setIsScanning(false);
            scanTypeRef.current = null;
            clearScanTimeout();
            stopBleScan();
          }
          qrScanInitiatedRef.current = false;
        }, 500); // 500ms delay to allow QR callback to fire first
        
        return () => clearTimeout(timeoutId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isScanning, clearScanTimeout, stopBleScan]);

  // Setup bridge handlers for QR code scanning and BLE (follows pattern from swap.tsx)
  const setupBridge = useCallback((b: WebViewJavascriptBridge) => {
    const noop = () => {};
    const reg = (name: string, handler: any) => {
      b.registerHandler(name, handler);
      return () => b.registerHandler(name, noop);
    };

    // NOTE: bridge.init() is already called in bridgeContext.tsx
    // Do NOT call init() again here as it causes the app to hang

    // QR code scan callback - follows existing pattern from swap.tsx
    const offQr = reg(
      "scanQrcodeResultCallBack",
      (data: string, resp: any) => {
        // QR callback received - reset the initiated flag since scanner is now closed
        qrScanInitiatedRef.current = false;
        
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

    // NOTE: BLE handlers (findBleDeviceCallBack, bleConnectSuccessCallBack, etc.) 
    // are now handled by the useFlowBatteryScan hook internally.
    // This keeps the bridge setup cleaner and consolidates BLE logic.

    return () => {
      offQr();
      // BLE handlers are now managed by useFlowBatteryScan hook
    };
  }, [clearScanTimeout]);

  // Setup bridge when ready
  // NOTE: We intentionally DON'T use a ref to track registration because:
  // 1. The setupBridge callback may change when dependencies change
  // 2. When it changes, the cleanup runs (unregistering handlers)
  // 3. We need to re-register handlers with the new callback
  // React's useEffect cleanup mechanism handles this correctly
  useEffect(() => {
    if (!bridge || !isBridgeReady) {
      console.info('AttendantFlow: Waiting for bridge...', { bridge: !!bridge, isBridgeReady });
      return;
    }
    
    console.info('=== AttendantFlow: Setting up bridge handlers ===');
    const cleanup = setupBridge(bridge as unknown as WebViewJavascriptBridge);
    
    return () => {
      console.info('=== AttendantFlow: Cleaning up bridge handlers ===');
      cleanup();
    };
  }, [bridge, isBridgeReady, setupBridge]);

  // Start BLE scanning when user reaches battery scanning steps (Step 2 or 3)
  // This mirrors the keypad behavior where BLE scan runs continuously
  // Gives devices time to be discovered BEFORE user scans QR code
  // CRITICAL: Must wait for bleHandlersReady (not just isBridgeReady) to ensure
  // findBleDeviceCallBack handler is registered before we start scanning
  useEffect(() => {
    // Only start BLE scanning on battery scan steps and when BLE handlers are ready
    // bleHandlersReady is set AFTER handlers are registered in setupBridge
    if (!bleHandlersReady || !window.WebViewJavascriptBridge) {
      if (!bleHandlersReady) {
        console.info('BLE scan waiting for handlers to be registered...');
      }
      return;
    }
    
    const isBatteryScanStep = currentStep === 2 || currentStep === 3;
    
    if (isBatteryScanStep) {
      console.info(`=== Starting BLE scan cycle for Step ${currentStep} (battery scanning) ===`);
      console.info(`Detected devices before scan: ${bleScanState.detectedDevices.length}`);
      
      // IMPORTANT: Stop-before-start pattern (matches keypad behavior)
      // The native BLE layer needs a clean stop before starting a fresh scan cycle
      stopBleScan();
      
      // Small delay after stop to ensure native layer is ready, then start
      const timeoutId = setTimeout(() => {
        console.info('=== BLE scan starting after 300ms delay ===');
        startBleScan();
      }, 300);
      
      return () => {
        clearTimeout(timeoutId);
        // Stop BLE scan when leaving battery scan steps
        stopBleScan();
      };
    }
  }, [currentStep, bleHandlersReady, startBleScan, stopBleScan]);

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
                const commonTerms = sourceData?.common_terms;
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
                  
                  // Extract billing currency from common_terms (source of truth), fallback to service plan currency
                  const billingCurrency = commonTerms?.billingCurrency || servicePlanData?.currency || PAYMENT.defaultCurrency;
                  
                  // Update swap data with rate and currency from customer's service plan
                  setSwapData(prev => ({ 
                    ...prev, 
                    rate: elecService?.usageUnitPrice || prev.rate,
                    currencySymbol: billingCurrency 
                  }));
                  
                  // Check for infinite quota services (quota > 100,000 indicates management services)
                  const INFINITE_QUOTA_THRESHOLD = 100000;
                  const hasInfiniteEnergyQuota = (elecService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
                  const hasInfiniteSwapQuota = (swapCountService?.quota || 0) > INFINITE_QUOTA_THRESHOLD;
                  
                  // Calculate remaining quota values
                  const energyRemaining = elecService ? (elecService.quota - elecService.used) : 0;
                  const energyUnitPrice = elecService?.usageUnitPrice || 0;
                  // Calculate monetary value of remaining energy quota (remaining kWh × unit price)
                  const energyValue = energyRemaining * energyUnitPrice;
                  
                  setCustomerData({
                    id: identifiedCustomerId || servicePlanData.customerId,
                    name: identifiedCustomerId || 'Customer',
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode, // Same ID used by ABS and Odoo
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    phone: '', // Will be entered separately if needed
                    swapCount: swapCountService?.used || 0,
                    lastSwap: 'N/A',
                    energyRemaining: energyRemaining,
                    energyTotal: elecService?.quota || 0,
                    energyValue: energyValue,
                    energyUnitPrice: energyUnitPrice,
                    swapsRemaining: swapCountService ? (swapCountService.quota - swapCountService.used) : 0,
                    swapsTotal: swapCountService?.quota || 21,
                    hasInfiniteEnergyQuota: hasInfiniteEnergyQuota,
                    hasInfiniteSwapQuota: hasInfiniteSwapQuota,
                    // FSM states from response
                    paymentState: servicePlanData.paymentState || 'INITIAL',
                    serviceState: servicePlanData.serviceState || 'INITIAL',
                    currentBatteryId: batteryFleet?.current_asset || undefined,
                  });
                  
                  advanceToStep(2);
                  toast.success(isIdempotent ? 'Customer found (cached)' : 'Customer found');
                  setIsProcessing(false);
                } else {
                  console.error("No service_plan_data in response:", responseData);
                  toast.error("Invalid customer data received");
                  setIsProcessing(false);
                }
              } else {
                console.error("Customer identification failed - success:", success, "signals:", signals);
                // Provide specific error messages based on failure signals
                let errorMsg = responseData?.data?.error || responseData?.data?.metadata?.message;
                if (!errorMsg) {
                  // Check for specific failure signals to provide better error messages
                  if (signals.includes("SERVICE_PLAN_NOT_FOUND") || signals.includes("CUSTOMER_NOT_FOUND")) {
                    errorMsg = "Customer not found. Please check the subscription ID.";
                  } else if (signals.includes("INVALID_SUBSCRIPTION_ID")) {
                    errorMsg = "Invalid subscription ID format.";
                  } else {
                    errorMsg = "Customer not found";
                  }
                }
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

  // Step 2: Scan Old Battery with Scan-to-Bind
  const handleScanOldBattery = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Clear any existing flow error when retrying
    setFlowError(null);
    
    // Reset BLE state via hook (keeps detected devices for matching)
    hookResetState();
    
    setIsScanning(true);
    scanTypeRef.current = 'old_battery';
    
    // BLE scanning is already running from useEffect when we reached Step 2
    // Log current discovered devices for debugging
    console.info(`=== Scanning Old Battery ===`);
    console.info(`BLE Handlers Ready: ${bleHandlersReady}`);
    console.info(`BLE Scanning Active: ${bleScanState.isScanning}`);
    console.info(`Detected devices count: ${bleScanState.detectedDevices.length}`);
    console.info('Detected devices:', bleScanState.detectedDevices.map(d => `${d.name} (${d.rssi})`));
    
    // If no devices detected yet, warn the user
    if (bleScanState.detectedDevices.length === 0) {
      console.warn('No BLE devices detected yet - scan may have just started or Bluetooth may be off');
    }
    
    // NOTE: No external timeout needed for QR scanning
    // - User cancels QR scan → bridge returns empty qrCode → state is reset in qrCodeCallBack handler
    // - App goes to background → visibilitychange handler resets state
    // - QR scanned successfully → processOldBatteryQRData handles it
    // - BLE connection after QR scan → handled by BleProgressModal (60s) + BLE hooks
    clearScanTimeout();
    
    // Start QR code scan - BLE devices should already be discovered
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, bleHandlersReady, bleScanState.isScanning]);

  // Step 2: Handle device selection for old battery (manual mode)
  const handleOldBatteryDeviceSelect = useCallback((device: { macAddress: string; name: string }) => {
    console.info('Manual device selected for old battery:', device);
    
    // Clear any existing flow error when retrying
    setFlowError(null);
    
    // For returning customers, validate the selected device matches their assigned battery
    // This is the same validation done in processOldBatteryQRData for QR scans
    if (customerType === 'returning' && customerData?.currentBatteryId) {
      const expectedBatteryId = customerData.currentBatteryId;
      const selectedDeviceName = device.name;
      
      // Normalize IDs for comparison (remove prefixes, compare last 6 chars, case insensitive)
      const normalizeId = (id: string) => {
        // Remove common prefixes like "BAT_NEW_", "BAT_RETURN_ATT_", "OVES BATT", etc.
        const cleaned = id.replace(/^(BAT_NEW_|BAT_RETURN_ATT_|BAT_|OVES\s+BATT\s+)/i, '');
        return cleaned.toLowerCase();
      };
      
      const selectedNormalized = normalizeId(String(selectedDeviceName));
      const expectedNormalized = normalizeId(String(expectedBatteryId));
      
      // Check if IDs match (exact match, one contains the other, or last 6 chars match)
      const isMatch = selectedNormalized === expectedNormalized ||
        selectedNormalized.includes(expectedNormalized) ||
        expectedNormalized.includes(selectedNormalized) ||
        selectedNormalized.slice(-6) === expectedNormalized.slice(-6);
      
      if (!isMatch) {
        // Battery doesn't match - show error and stop process
        console.error(`Battery mismatch: selected ${selectedDeviceName}, expected ${expectedBatteryId}`);
        
        setFlowError({
          step: 2,
          message: t('attendant.batteryMismatch') || 'Battery does not belong to this customer',
          details: `Selected: ...${String(selectedDeviceName).slice(-6)} | Expected: ...${String(expectedBatteryId).slice(-6)}`,
        });
        
        toast.error(t('attendant.wrongBattery') || 'Wrong battery! This battery does not belong to the customer.');
        return; // Don't proceed to connection
      }
    }
    
    // Reset BLE state via hook (keeps detected devices for matching)
    hookResetState();
    
    setIsScanning(true);
    scanTypeRef.current = 'old_battery';
    
    // NOTE: No external timeout needed for manual device selection
    // Timeout management is handled by:
    // 1. BleProgressModal (60s countdown, calls cancelBleOperation on timeout)
    // 2. useBleDeviceConnection hook (60s BLE_GLOBAL_TIMEOUT)
    // 3. useFlowBatteryScan hook (25s device matching timeout)
    clearScanTimeout();
    
    // Use the device name as QR data (hook will match by last 6 chars)
    hookHandleQrScanned(device.name, 'old_battery');
  }, [hookResetState, hookHandleQrScanned, clearScanTimeout, customerType, customerData?.currentBatteryId, t]);

  // Step 3: Scan New Battery with Scan-to-Bind
  const handleScanNewBattery = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Clear any existing flow error when retrying (e.g., after scanning old battery as new by mistake)
    setFlowError(null);

    // Reset BLE state via hook (keeps detected devices for matching)
    hookResetState();
    
    setIsScanning(true);
    scanTypeRef.current = 'new_battery';
    
    // BLE scanning is already running from useEffect when we reached Step 3
    // Log current discovered devices for debugging
    console.info(`=== Scanning New Battery ===`);
    console.info(`BLE Handlers Ready: ${bleHandlersReady}`);
    console.info(`BLE Scanning Active: ${bleScanState.isScanning}`);
    console.info(`Detected devices count: ${bleScanState.detectedDevices.length}`);
    console.info('Detected devices:', bleScanState.detectedDevices.map(d => `${d.name} (${d.rssi})`));
    
    // If no devices detected yet, warn the user
    if (bleScanState.detectedDevices.length === 0) {
      console.warn('No BLE devices detected yet - scan may have just started or Bluetooth may be off');
    }
    
    // NOTE: No external timeout needed for QR scanning
    // - User cancels QR scan → bridge returns empty qrCode → state is reset in qrCodeCallBack handler
    // - App goes to background → visibilitychange handler resets state
    // - QR scanned successfully → processNewBatteryQRData handles it
    // - BLE connection after QR scan → handled by BleProgressModal (60s) + BLE hooks
    clearScanTimeout();
    
    // Start QR code scan - BLE devices should already be discovered
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, bleHandlersReady, bleScanState.isScanning]);

  // Step 3: Handle device selection for new battery (manual mode)
  const handleNewBatteryDeviceSelect = useCallback((device: { macAddress: string; name: string }) => {
    console.info('Manual device selected for new battery:', device);
    
    // Clear any existing flow error when retrying
    setFlowError(null);
    
    // Reset BLE state via hook (keeps detected devices for matching)
    hookResetState();
    
    setIsScanning(true);
    scanTypeRef.current = 'new_battery';
    
    // NOTE: No external timeout needed for manual device selection
    // Timeout management is handled by:
    // 1. BleProgressModal (60s countdown, calls cancelBleOperation on timeout)
    // 2. useBleDeviceConnection hook (60s BLE_GLOBAL_TIMEOUT)
    // 3. useFlowBatteryScan hook (25s device matching timeout)
    clearScanTimeout();
    
    // Use the device name as QR data (hook will match by last 6 chars)
    hookHandleQrScanned(device.name, 'new_battery');
  }, [hookResetState, hookHandleQrScanned, clearScanTimeout]);

  // Step 4: Proceed to payment - initiate payment with Odoo first
  // OR skip payment if customer has sufficient quota OR rounded cost is zero
  const handleProceedToPayment = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Calculate rounded cost - customers can't pay decimals so we round down
      // Example: 20.54 becomes 20, 0.54 becomes 0
      const roundedCost = Math.floor(swapData.cost);
      
      // Check if we should skip payment collection:
      // 1. Customer has sufficient quota (both electricity and swap count)
      // 2. OR rounded cost is 0 or negative (nothing to collect since we round down)
      const shouldSkipPayment = hasSufficientQuota || roundedCost <= 0;
      
      if (shouldSkipPayment) {
        const isZeroCostRounding = !hasSufficientQuota && roundedCost <= 0;
        const reason = hasSufficientQuota 
          ? 'sufficient quota' 
          : 'zero cost (rounded)';
        console.info(`Skipping payment step - ${reason}`, { 
          hasSufficientQuota, 
          isZeroCostRounding,
          cost: swapData.cost,
          roundedCost
        });
        toast.success(hasSufficientQuota 
          ? 'Using quota credit - no payment required' 
          : 'No payment required - zero cost');
        
        // Skip payment step and directly record the service
        // Use a quota-based or zero-cost payment reference
        const skipReference = isZeroCostRounding 
          ? `ZERO_COST_${Date.now()}` 
          : `QUOTA_${Date.now()}`;
        setPaymentConfirmed(true);
        setPaymentReceipt(skipReference);
        setTransactionId(skipReference);
        
        // Call publishPaymentAndService via ref to avoid circular dependency
        // Pass isQuotaBased=true for quota-based, isZeroCostRounding=true for rounded-down-to-zero
        // When isZeroCostRounding=true, we still include payment_data with original amount so backend
        // knows the actual service value even though customer didn't pay
        publishPaymentAndServiceRef.current(skipReference, hasSufficientQuota, isZeroCostRounding);
        return;
      }
      
      // Normal flow: Create payment request with Odoo FIRST before collecting payment
      // This is REQUIRED - we must have a ticket/order before collecting payment
      const success = await initiateOdooPayment();
      if (!success) {
        // Payment request creation failed - don't proceed
        console.error('Payment request creation failed, staying on review step');
        return;
      }
      advanceToStep(5);
    } finally {
      setIsProcessing(false);
    }
  }, [advanceToStep, initiateOdooPayment, hasSufficientQuota, swapData.cost]);

  // Step 5: Confirm Payment via QR scan
  const handleConfirmPayment = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Ensure payment request was created first
    if (!paymentRequestCreated) {
      const success = await initiateOdooPayment();
      if (!success) {
        toast.error('Failed to create payment request. Please try again.');
        return;
      }
    }

    setIsScanning(true);
    scanTypeRef.current = 'payment';
    startQrCodeScan();
  }, [startQrCodeScan, paymentRequestCreated, initiateOdooPayment]);

  // Step 5: Manual payment confirmation with Odoo
  // Uses order_id ONLY to confirm payment (from createPaymentRequest response)
  // IMPORTANT: Only proceeds if total_paid >= expectedPaymentAmount (the swap cost)
  const handleManualPayment = useCallback((receipt: string) => {
    setIsProcessing(true);
    
    // Confirm payment with Odoo using manual confirmation endpoint
    const confirmManualPayment = async () => {
      // order_id is REQUIRED - must be obtained from createPaymentRequest response
      const orderId = paymentRequestOrderId;
      
      try {
        // Ensure payment request was created first
        if (!paymentRequestCreated) {
          const success = await initiateOdooPayment();
          if (!success) {
            setIsProcessing(false);
            return;
          }
        }

        // order_id is REQUIRED - payment request must be created first
        if (!orderId) {
          toast.error('Payment request not created. Please go back and try again.');
          setIsProcessing(false);
          return;
        }

        // Use Odoo manual confirmation endpoint with order_id ONLY
        console.log('Confirming manual payment with order_id:', { order_id: orderId, receipt });
        const response = await confirmPaymentManual({ order_id: orderId, receipt });
        
        if (response.success) {
          // Extract payment amounts from response
          // Handle both wrapped (response.data.X) and unwrapped (response.X) response formats
          const responseData = response.data || (response as any);
          // Use total_paid (new format) or amount_paid (legacy format)
          const totalPaid = responseData.total_paid ?? responseData.amount_paid ?? 0;
          const remainingToPay = responseData.remaining_to_pay ?? responseData.amount_remaining ?? 0;
          
          console.log('Manual payment validation response:', {
            total_paid: totalPaid,
            remaining_to_pay: remainingToPay,
            expected_to_pay: responseData.expected_to_pay ?? responseData.amount_expected,
            order_id: responseData.order_id,
            expectedPaymentAmount,
          });
          
          // Update state with payment amounts
          setActualAmountPaid(totalPaid);
          setPaymentAmountRemaining(remainingToPay);
          
          // CRITICAL: Check if total_paid >= expected amount for THIS swap
          // We use the ROUNDED amount (what we asked customer to pay, not the calculated amount)
          // Example: if cost is 20.54, we ask for 20, so customer needs to pay at least 20
          const requiredAmount = expectedPaymentAmount || Math.floor(swapData.cost);
          if (totalPaid < requiredAmount) {
            // Payment insufficient for this swap
            const shortfall = requiredAmount - totalPaid;
            toast.error(`Payment insufficient. Customer paid ${swapData.currencySymbol} ${totalPaid}, but needs to pay ${swapData.currencySymbol} ${requiredAmount}. Short by ${swapData.currencySymbol} ${shortfall}`);
            setIsProcessing(false);
            // Don't proceed - customer needs to pay more
            return;
          }
          
          // Payment sufficient - proceed with service completion
          setPaymentConfirmed(true);
          setPaymentReceipt(receipt);
          setTransactionId(receipt);
          toast.success('Payment confirmed successfully');
          
          // Report payment - uses original calculated cost for accurate quota tracking
          publishPaymentAndService(receipt, false);
        } else {
          throw new Error('Payment confirmation failed');
        }
      } catch (err: any) {
        console.error('Manual payment error:', err);
        toast.error(err.message || 'Payment confirmation failed. Check network connection.');
        setIsProcessing(false);
      }
    };
    
    confirmManualPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPlanId, swapData.cost, customerData, paymentRequestCreated, paymentRequestOrderId, expectedPaymentAmount, initiateOdooPayment]);

  // Publish payment_and_service via MQTT
  // isQuotaBased: When true, customer is using their existing quota credit (no payment_data sent)
  // isZeroCostRounding: When true, cost rounded to 0 but NOT quota-based - include payment_data
  //                     with original amount so backend knows the service value for tracking
  // NOTE: We always report the ORIGINAL calculated amount (swapData.cost) for quota calculations,
  // even though customer pays the rounded-down amount. This ensures accurate quota tracking.
  const publishPaymentAndService = useCallback((paymentReference: string, isQuotaBased: boolean = false, isZeroCostRounding: boolean = false) => {
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

    // Use raw battery IDs without prefix - backend expects IDs like "B0723025100049"
    const newBatteryId = swapData.newBattery?.id || null;
    const oldBatteryId = swapData.oldBattery?.id || null;

    // Use the pre-calculated energyDiff which is already floored to 2 decimal places
    // This ensures consistency between what's displayed and what's reported to backend
    let energyTransferred = swapData.energyDiff;
    if (energyTransferred < 0) energyTransferred = 0;
    // Floor to 2 decimal places to ensure consistent reporting
    energyTransferred = Math.floor(energyTransferred * 100) / 100;

    const serviceId = electricityService?.service_id || "service-electricity-default";
    // IMPORTANT: Use the calculated cost which is already floored to 2 decimal places
    // This ensures payment amount matches what was displayed to the attendant/customer
    // and is consistent with the floored energy values
    const paymentAmount = Math.floor(swapData.cost * 100) / 100; // Ensure 2 decimal places (floored)
    const paymentCorrelationId = `att-checkout-payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Determine if we should include payment_data:
    // - isQuotaBased && !isZeroCostRounding: No payment_data (true quota credit)
    // - isZeroCostRounding: Include payment_data with original amount (customer received service worth X but paid 0)
    // - Normal payment: Include payment_data
    const shouldIncludePaymentData = !isQuotaBased || isZeroCostRounding;

    console.info('Publishing payment_and_service:', {
      isQuotaBased,
      isZeroCostRounding,
      shouldIncludePaymentData,
      ...(shouldIncludePaymentData ? { 
        paymentAmount, // Full precision amount (what customer should have paid / service value)
        paymentAmountRoundedForCustomer: Math.floor(swapData.cost), // What customer actually paid (0 for zero-cost rounding)
        paymentReference 
      } : {}),
      energyTransferred,
      oldBatteryId,
      newBatteryId,
    });

    let paymentAndServicePayload: any = null;

    if (customerType === 'returning' && oldBatteryId) {
      // Returning customer payload
      if (isQuotaBased && !isZeroCostRounding) {
        // True quota-based: No payment_data needed - customer is using existing quota credit
        paymentAndServicePayload = {
          timestamp: new Date().toISOString(),
          plan_id: dynamicPlanId,
          correlation_id: paymentCorrelationId,
          actor: { type: "attendant", id: attendantInfo.id },
          data: {
            action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
            attendant_station: attendantInfo.station,
            service_data: {
              old_battery_id: oldBatteryId,
              new_battery_id: newBatteryId,
              energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
              service_duration: 240,
            },
          },
        };
      } else {
        // Regular payment flow OR zero-cost rounding: Include payment_data
        // For zero-cost rounding, payment_amount is the original calculated amount (service value)
        // even though customer paid 0 - this allows backend to track actual service value
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
              payment_method: isZeroCostRounding ? "ZERO_COST_ROUNDING" : "MPESA",
              payment_type: "TOP_UP",
            },
            service_data: {
              old_battery_id: oldBatteryId,
              new_battery_id: newBatteryId,
              energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
              service_duration: 240,
            },
          },
        };
      }
    } else if (customerType === 'first-time' && newBatteryId) {
      // First-time customer payload
      if (isQuotaBased && !isZeroCostRounding) {
        // True quota-based: No payment_data needed - customer is using existing quota credit
        paymentAndServicePayload = {
          timestamp: new Date().toISOString(),
          plan_id: dynamicPlanId,
          correlation_id: paymentCorrelationId,
          actor: { type: "attendant", id: attendantInfo.id },
          data: {
            action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
            attendant_station: attendantInfo.station,
            service_data: {
              new_battery_id: newBatteryId,
              energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
              service_duration: 240,
            },
          },
        };
      } else {
        // Regular payment flow OR zero-cost rounding: Include payment_data
        // For zero-cost rounding, payment_amount is the original calculated amount (service value)
        // even though customer paid 0 - this allows backend to track actual service value
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
              payment_method: isZeroCostRounding ? "ZERO_COST_ROUNDING" : "MPESA",
              payment_type: "DEPOSIT",
            },
            service_data: {
              new_battery_id: newBatteryId,
              energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
              service_duration: 240,
            },
          },
        };
      }
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
              const metadata = responseData?.data?.metadata || {};

              console.info("payment_and_service response - success:", success, "signals:", signals, "metadata:", metadata);

              // Check for error signals - these indicate failure even if success is true
              // Backend may return success:true with error signals for validation failures
              const errorSignals = [
                "BATTERY_MISMATCH", 
                "ASSET_VALIDATION_FAILED", 
                "SECURITY_ALERT", 
                "VALIDATION_FAILED", 
                "PAYMENT_FAILED",
                "SERVICE_COMPLETION_FAILED",
                "RATE_LIMIT_EXCEEDED",
                "SERVICE_REJECTED"
              ];
              const hasErrorSignal = signals.some((signal: string) => errorSignals.includes(signal));

              // Handle both fresh success and idempotent (cached) responses
              // Fresh success signals: ASSET_RETURNED, ASSET_ALLOCATED, SERVICE_COMPLETED
              // Idempotent signal: IDEMPOTENT_OPERATION_DETECTED
              const isIdempotent = signals.includes("IDEMPOTENT_OPERATION_DETECTED");
              const hasServiceCompletedSignal = signals.includes("SERVICE_COMPLETED");
              const hasAssetSignals = signals.includes("ASSET_RETURNED") || signals.includes("ASSET_ALLOCATED");
              
              const hasSuccessSignal = success === true && 
                !hasErrorSignal &&
                Array.isArray(signals) && 
                (isIdempotent || hasServiceCompletedSignal || hasAssetSignals);

              if (hasErrorSignal) {
                // Error signals present - treat as failure regardless of success flag
                console.error("payment_and_service failed with error signals:", signals);
                const errorMsg = metadata?.reason || metadata?.message || responseData?.data?.error || "Failed to record swap";
                const actionRequired = metadata?.action_required;
                toast.error(actionRequired ? `${errorMsg}. ${actionRequired}` : errorMsg);
                setPaymentAndServiceStatus('error');
              } else if (hasSuccessSignal) {
                console.info("payment_and_service completed successfully!", isIdempotent ? "(idempotent)" : "");
                
                // Clear the correlation ID
                (window as any).__paymentAndServiceCorrelationId = null;
                
                setPaymentAndServiceStatus('success');
                advanceToStep(6);
                toast.success(isIdempotent ? 'Swap completed! (already recorded)' : 'Swap completed!');
              } else if (success && signals.length === 0) {
                // Success without any signals - treat as generic success
                console.info("payment_and_service completed (generic success, no signals)");
                
                // Clear the correlation ID
                (window as any).__paymentAndServiceCorrelationId = null;
                
                setPaymentAndServiceStatus('success');
                advanceToStep(6);
                toast.success('Swap completed!');
              } else {
                // Response received but not successful or has unknown signals
                console.error("payment_and_service failed - success:", success, "signals:", signals);
                const errorMsg = metadata?.reason || metadata?.message || responseData?.data?.error || "Failed to record swap";
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

    // Subscribe to response topic first, then publish
    console.info("=== Subscribing to response topic for payment_and_service ===");
    
    bridge.callHandler(
      "mqttSubTopic",
      { topic: responseTopic, qos: 1 },
      (subscribeResponse: string) => {
        try {
          const subResp = typeof subscribeResponse === 'string' 
            ? JSON.parse(subscribeResponse) 
            : subscribeResponse;
          
          if (subResp?.respCode === "200") {
            console.info("✅ Successfully subscribed to payment_and_service response topic:", responseTopic);
            
            // Wait a moment after subscribe before publishing
            setTimeout(() => {
              try {
                console.info("=== Calling bridge.callHandler('mqttPublishMsg') for payment_and_service ===");
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
                        console.info("payment_and_service published successfully, waiting for backend response...");
                        // Wait for the actual backend response via MQTT handler
                        // The 30-second timeout will handle cases where no response is received
                        // Do NOT assume success - we must wait for confirmation that quota was updated
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
            }, 300);
          } else {
            console.error("Failed to subscribe to payment_and_service response topic:", subResp?.respDesc || subResp?.error);
            toast.error("Failed to connect. Please try again.");
            setPaymentAndServiceStatus('error');
            clearTimeout(timeoutId);
            setIsScanning(false);
            setIsProcessing(false);
          }
        } catch (err) {
          console.error("Error parsing payment_and_service subscribe response:", err);
          toast.error("Error connecting. Please try again.");
          setPaymentAndServiceStatus('error');
          clearTimeout(timeoutId);
          setIsScanning(false);
          setIsProcessing(false);
        }
      }
    );
  }, [bridge, dynamicPlanId, swapData, customerType, electricityService?.service_id, attendantInfo]);

  // Keep publishPaymentAndService ref up to date to avoid circular dependency with handleProceedToPayment
  useEffect(() => {
    publishPaymentAndServiceRef.current = publishPaymentAndService;
  }, [publishPaymentAndService]);

  // Step 6: Start new swap
  const handleNewSwap = useCallback(() => {
    setCurrentStep(1);
    setMaxStepReached(1); // Reset max step when starting fresh
    setCustomerData(null);
    setSwapData({
      oldBattery: null,
      newBattery: null,
      energyDiff: 0,
      quotaDeduction: 0,
      chargeableEnergy: 0,
      cost: 0,
      rate: 120,
      currencySymbol: PAYMENT.defaultCurrency,
    });
    setManualSubscriptionId('');
    setTransactionId('');
    setInputMode('scan');
    setDynamicPlanId('');
    setServiceStates([]);
    setCustomerType(null);
    setPaymentConfirmed(false);
    setPaymentReceipt(null);
    setPaymentInitiated(false);  // Reset STK push state
    setPaymentInitiationData(null);
    setPaymentRequestCreated(false);  // Reset payment request state
    setPaymentRequestData(null);
    setPaymentRequestOrderId(null);
    setExpectedPaymentAmount(0);  // Reset expected payment amount
    setPaymentAndServiceStatus('idle');
    setPaymentAmountRemaining(0);  // Reset partial payment tracking
    setActualAmountPaid(0);  // Reset actual amount paid tracking
    setPaymentInputMode('scan');  // Reset payment input mode
    setManualPaymentId('');  // Clear manual payment ID
    setFlowError(null); // Clear any flow errors
    cancelOngoingScan(); // Clear any pending timeouts
    
    // Clear BLE state via hook - devices will be rediscovered when reaching Step 2
    hookResetState();
  }, [cancelOngoingScan, hookResetState]);

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

  // Handle logout - clear authentication and notify parent
  const handleLogout = useCallback(() => {
    clearEmployeeLogin();
    toast.success(t('Signed out successfully'));
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router, t]);

  // Handle timeline step click - allow navigation to any step up to maxStepReached
  // This lets users go back to check something and return without losing progress
  const handleTimelineClick = useCallback((step: AttendantStep) => {
    if (step <= maxStepReached && step !== currentStep) {
      setCurrentStep(step);
    }
  }, [currentStep, maxStepReached]);

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
        // Handle payment based on input mode
        if (paymentInputMode === 'scan') {
          handleConfirmPayment();
        } else {
          // Manual mode - call backend with manual payment ID
          if (manualPaymentId.trim()) {
            handleManualPayment(manualPaymentId.trim());
          } else {
            toast.error(t('sales.enterTransactionId'));
          }
        }
        break;
      case 6:
        handleNewSwap();
        break;
    }
  }, [currentStep, inputMode, paymentInputMode, manualPaymentId, handleScanCustomer, handleManualLookup, handleScanOldBattery, handleScanNewBattery, handleProceedToPayment, handleConfirmPayment, handleManualPayment, handleNewSwap, t]);

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
            isScannerOpening={isScanning}
            stats={stats}
          />
        );
      case 2:
        return (
          <Step2OldBattery 
            onScanOldBattery={handleScanOldBattery}
            onDeviceSelect={handleOldBatteryDeviceSelect}
            detectedDevices={bleScanState.detectedDevices}
            isScanning={bleScanState.isScanning}
            onStartScan={hookStartScanning}
            onStopScan={hookStopScanning}
            isFirstTimeCustomer={customerType === 'first-time'}
            isScannerOpening={isScanning}
          />
        );
      case 3:
        return (
          <Step3NewBattery 
            oldBattery={swapData.oldBattery} 
            onScanNewBattery={handleScanNewBattery}
            onDeviceSelect={handleNewBatteryDeviceSelect}
            detectedDevices={bleScanState.detectedDevices}
            isScanning={bleScanState.isScanning}
            onStartScan={hookStartScanning}
            onStopScan={hookStopScanning}
            isScannerOpening={isScanning}
          />
        );
      case 4:
        return (
          <Step4Review 
            swapData={swapData} 
            customerData={customerData}
            hasSufficientQuota={hasSufficientQuota}
          />
        );
      case 5:
        return (
          <Step5Payment 
            swapData={swapData}
            customerData={customerData}
            isProcessing={isProcessing || paymentAndServiceStatus === 'pending'}
            inputMode={paymentInputMode}
            setInputMode={setPaymentInputMode}
            paymentId={manualPaymentId}
            setPaymentId={setManualPaymentId}
            onScanPayment={handleConfirmPayment}
            isScannerOpening={isScanning}
            amountRemaining={paymentAmountRemaining}
            amountPaid={actualAmountPaid}
          />
        );
      case 6:
        // Display rounded amounts on receipt (what customer actually paid/owed)
        // Example: if cost was 20.54, we show 20 as amount due
        return (
          <Step6Success 
            swapData={swapData} 
            customerData={customerData} 
            transactionId={transactionId}
            amountDue={Math.floor(swapData.cost)}
            amountPaid={Math.floor(actualAmountPaid)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="attendant-container">
      <div className="attendant-bg-gradient" />
      
      {/* Header with Back + Logo on left, Language Toggle on right */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToRoles}
              aria-label={t('attendant.changeRole')}
              title={t('attendant.changeRole')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right">
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage')}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
            <button
              className="flow-header-logout"
              onClick={handleLogout}
              aria-label={t('common.logout')}
              title={t('common.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Interactive Timeline */}
      <Timeline 
        currentStep={currentStep} 
        maxStepReached={maxStepReached}
        onStepClick={handleTimelineClick}
        flowError={flowError}
      />

      {/* Customer State Panel - Shows after customer identified, hidden on payment/success steps */}
      <CustomerStatePanel 
        customer={customerData} 
        visible={currentStep > 1 && currentStep < 5}
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
        paymentInputMode={paymentInputMode}
        hasSufficientQuota={hasSufficientQuota}
        swapCost={swapData.cost}
      />

      {/* Loading Overlay - Simple overlay for non-BLE operations */}
      {(isScanning || isProcessing || paymentAndServiceStatus === 'pending') && 
       !bleScanState.isConnecting && 
       !bleScanState.isReadingEnergy && 
       !(bleScanState.isScanning && (scanTypeRef.current === 'old_battery' || scanTypeRef.current === 'new_battery')) && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {paymentAndServiceStatus === 'pending' 
              ? 'Completing swap...' 
              : isScanning 
              ? 'Scanning...' 
              : 'Processing...'}
          </div>
        </div>
      )}

      {/* BLE Connection Progress Modal - Reusable component for connection/reading progress */}
      <BleProgressModal
        bleScanState={bleScanState}
        pendingBatteryId={pendingBatteryId}
        onCancel={cancelBleOperation}
      />
    </div>
  );
}
