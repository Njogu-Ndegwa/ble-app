'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { getAttendantRoleUser, clearAttendantRoleLogin } from '@/lib/attendant-auth';
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
import { BleProgressModal, SessionResumePrompt } from '@/components/shared';

// Import workflow session management
import { 
  useWorkflowSession, 
  buildAttendantSessionData, 
  extractAttendantStateFromSession,
} from '@/lib/hooks/useWorkflowSession';
import type { WorkflowSessionData } from '@/lib/odoo-api';

// Import modular BLE hook for battery scanning (available for future migration)
import { useFlowBatteryScan, type FlowBleScanState } from '@/lib/hooks/ble';

// Import customer identification hook
import { useCustomerIdentification, type CustomerIdentificationResult } from '@/lib/hooks/useCustomerIdentification';

// Import payment collection hook (encapsulates Odoo payment + service completion)
import { usePaymentCollection } from '@/lib/hooks/usePaymentCollection';
import { PAYMENT } from '@/lib/constants';
import { round } from '@/lib/utils';
import { calculateSwapPayment } from '@/lib/swap-payment';

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
    const user = getAttendantRoleUser();
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
    // Energy values (all in kWh, floored to 2dp)
    energyDiff: 0,
    quotaDeduction: 0,
    chargeableEnergy: 0,
    // Monetary values (single source of truth - calculated once, used everywhere)
    grossEnergyCost: 0,     // energyDiff × rate, rounded UP
    quotaCreditValue: 0,    // quotaDeduction × rate, rounded DOWN
    cost: 0,                // Final cost after quota
    rate: 120,              // Will be updated from service response
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
  
  
  // Flow error state - tracks failures that end the process
  const [flowError, setFlowError] = useState<FlowError | null>(null);
  
  // Session restoration UI state
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
  
  // Pending payment state restoration (stored temporarily until restorePaymentState is available)
  const [pendingPaymentRestore, setPendingPaymentRestore] = useState<{
    inputMode: 'scan' | 'manual';
    manualPaymentId: string;
    requestCreated: boolean;
    requestOrderId: number | null;
    expectedAmount: number;
    amountRemaining: number;
    amountPaid: number;
  } | null>(null);
  
  // ============================================
  // WORKFLOW SESSION MANAGEMENT HOOK (Backend Persistence)
  // ============================================
  
  const {
    status: sessionStatus,
    orderId: sessionOrderId,
    pendingSession,
    createSession,
    updateSession,
    updateSessionWithPayment,
    restoreSession,
    discardPendingSession,
    clearSession,
    checkForPendingSession,
    isLoading: isSessionLoading,
  } = useWorkflowSession({
    workflowType: 'attendant',
    onSessionRestored: (sessionData, orderId) => {
      console.info('[AttendantFlow] Session restored from backend:', { orderId, step: sessionData.currentStep });
      
      // Extract state from session data and restore
      const restoredState = extractAttendantStateFromSession(sessionData);
      
      // Restore all state from the session
      setCurrentStep(restoredState.currentStep as AttendantStep);
      setMaxStepReached(restoredState.maxStepReached as AttendantStep);
      setInputMode(restoredState.inputMode);
      setManualSubscriptionId(restoredState.manualSubscriptionId);
      setDynamicPlanId(restoredState.dynamicPlanId);
      setCustomerData(restoredState.customerData);
      setCustomerType(restoredState.customerType);
      setServiceStates(restoredState.serviceStates);
      setSwapData(restoredState.swapData);
      setFlowError(restoredState.flowError);
      
      // Store payment state for restoration (will be applied in useEffect after hook is ready)
      // This ensures partial payment info is correctly shown when resuming at Step 5
      if (restoredState.paymentState && (restoredState.paymentState.amountPaid > 0 || restoredState.paymentState.amountRemaining > 0 || restoredState.paymentState.requestCreated)) {
        setPendingPaymentRestore({
          inputMode: restoredState.paymentState.inputMode,
          manualPaymentId: restoredState.paymentState.manualPaymentId,
          requestCreated: restoredState.paymentState.requestCreated,
          requestOrderId: restoredState.paymentState.requestOrderId,
          expectedAmount: restoredState.paymentState.expectedAmount,
          amountRemaining: restoredState.paymentState.amountRemaining,
          amountPaid: restoredState.paymentState.amountPaid,
        });
      }
      
      toast.success(`${t('session.sessionRestored') || 'Session restored - continuing from step'} ${restoredState.currentStep}`);
    },
    onError: (error) => {
      console.error('[AttendantFlow] Session error:', error);
      // Don't show error toast for session errors - they're non-blocking
    },
  });
  
  // Check for pending session on mount
  // Note: We always call checkSession() immediately - the hook handles auth verification
  // internally via getEmployeeToken(). This avoids race conditions with attendantInfo state.
  useEffect(() => {
    const checkSession = async () => {
      const hasPending = await checkForPendingSession();
      if (hasPending) {
        setShowSessionPrompt(true);
      }
      setSessionCheckComplete(true);
    };
    
    checkSession();
  }, [checkForPendingSession]);
  
  // Handle session resume
  const handleResumeSession = useCallback(async () => {
    const sessionData = await restoreSession();
    if (sessionData) {
      setShowSessionPrompt(false);
    }
  }, [restoreSession]);
  
  // Handle discard session
  const handleDiscardSession = useCallback(() => {
    discardPendingSession();
    setShowSessionPrompt(false);
    toast(t('session.startNew') || 'Starting a new swap');
  }, [discardPendingSession, t]);
  
  // NOTE: saveSessionData helper is defined after usePaymentCollection hook 
  // because it needs access to paymentInputMode, manualPaymentId, etc.
  
  // ============================================
  // CUSTOMER IDENTIFICATION HOOK
  // ============================================
  
  // Ref to track the scan type for identification (to clear it on complete)
  const identificationScanTypeRef = useRef<'customer' | null>(null);
  
  const { identifyCustomer, cancelIdentification } = useCustomerIdentification({
    bridge: bridge as any,
    isBridgeReady,
    isMqttConnected,
    attendantInfo,
    defaultRate: swapData.rate,
    onSuccess: async (result: CustomerIdentificationResult) => {
      console.info('Customer identification successful:', result);
      
      // Validate energy service and rate from identification result
      const energyService = result.serviceStates.find(
        (s) => s.service_id?.includes('service-energy') || s.service_id?.includes('service-electricity')
      );
      
      if (!energyService) {
        console.warn('[Attendant] WARNING: Energy service not found in customer service states:', 
          result.serviceStates.map(s => s.service_id).join(', '));
      }
      
      if (!result.rate || result.rate <= 0) {
        console.warn('[Attendant] WARNING: Invalid rate from customer identification:', result.rate,
          '- energy service usageUnitPrice:', energyService?.usageUnitPrice);
      }
      
      // Update all state from the result
      setCustomerData(result.customer as CustomerData);
      setServiceStates(result.serviceStates);
      setCustomerType(result.customerType);
      setSwapData(prev => ({
        ...prev,
        rate: result.rate,
        currencySymbol: result.currencySymbol,
      }));
      
      // Create backend session after customer identification
      const subscriptionCode = result.customer.subscriptionId || dynamicPlanId;
      if (subscriptionCode) {
        try {
          const initialSessionData = buildAttendantSessionData({
            currentStep: 2, // We're moving to step 2
            maxStepReached: 2,
            actor: attendantInfo,
            inputMode,
            manualSubscriptionId,
            dynamicPlanId: subscriptionCode,
            customerData: result.customer as CustomerData,
            customerType: result.customerType,
            serviceStates: result.serviceStates,
            swapData: {
              ...swapData,
              rate: result.rate,
              currencySymbol: result.currencySymbol,
            },
            flowError: null,
          });
          
          const orderId = await createSession(subscriptionCode, initialSessionData);
          if (orderId) {
            console.info('[AttendantFlow] Session created with orderId:', orderId);
          }
        } catch (err) {
          console.error('[AttendantFlow] Failed to create session (non-blocking):', err);
          // Don't block the workflow if session creation fails
        }
      }
      
      // Advance to next step
      advanceToStep(2);
    },
    onError: (error: string) => {
      console.error('Customer identification failed:', error);
    },
    onStart: () => {
      // Loading state is managed by the caller (scan vs manual)
    },
    onComplete: () => {
      // Clear loading states
      setIsScanning(false);
      setIsProcessing(false);
      identificationScanTypeRef.current = null;
      scanTypeRef.current = null;
    },
  });
  
  // ============================================
  // PAYMENT COLLECTION HOOK
  // ============================================
  
  
  // ============================================
  // BLE SCAN-TO-BIND HOOK (Modular BLE handling)
  // ============================================
  
  // Ref for electricity service to use in callbacks without recreation
  const electricityServiceRef = useRef<typeof electricityService>(undefined);
  
  // Refs for customerType and customerData to use in BLE callbacks without recreation
  // These refs are kept in sync with state via useEffect below
  const customerTypeRef = useRef<'first-time' | 'returning' | null>(null);
  const customerDataRef = useRef<CustomerData | null>(null);

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
      
      // === LAST LINE OF DEFENSE: Validate actualBatteryId (OPID/PPID from ATT) matches customer's battery ===
      // This validation happens AFTER reading the battery via BLE, ensuring the actual device ID matches
      // what the backend has assigned to the customer. The earlier validation only checks QR/device name.
      //
      // IMPORTANT: This is a STRICT equality check. The actual battery ID (OPID/PPID) read from the
      // device must EXACTLY match the current_asset stored in the backend. No fuzzy matching here.
      // If current_asset = "OVES Batt 070000" and OPID = "BO724525070000", they don't match → reject.
      if (customerTypeRef.current === 'returning' && customerDataRef.current?.currentBatteryId && battery.actualBatteryId) {
        const expectedBatteryId = customerDataRef.current.currentBatteryId;
        const actualBatteryId = battery.actualBatteryId;
        
        // Simple case-insensitive comparison with trimming
        const actualNormalized = String(actualBatteryId).trim().toLowerCase();
        const expectedNormalized = String(expectedBatteryId).trim().toLowerCase();
        
        // Strict equality check - they must be exactly the same
        const isMatch = actualNormalized === expectedNormalized;
        
        if (!isMatch) {
          // Battery doesn't match - show error and stop process
          console.error(`OPID/PPID mismatch (last line of defense): actual "${actualBatteryId}" !== expected "${expectedBatteryId}"`);
          
          setFlowError({
            step: 2,
            message: t('attendant.batteryIdMismatch') || 'Battery ID does not match customer record',
            details: `Device ID: ${actualBatteryId} | Expected: ${expectedBatteryId}`,
          });
          
          toast.error(t('attendant.wrongBatteryOpid') || 'Wrong battery! The battery ID read from the device does not match the customer\'s assigned battery.');
          setIsScanning(false);
          scanTypeRef.current = null;
          return; // Don't proceed to next step
        }
        
        console.info('OPID/PPID validation passed:', { actual: actualBatteryId, expected: expectedBatteryId });
      }
      
      setSwapData(prev => ({ ...prev, oldBattery: battery }));
      advanceToStep(3);
      toast.success(`Old battery: ${(battery.energy / 1000).toFixed(3)} kWh (${battery.chargeLevel}%)`);
      setIsScanning(false);
      scanTypeRef.current = null;
    },
    onNewBatteryRead: (battery) => {
      console.info('New battery read via hook:', battery);
      // Calculate energy difference and cost using the swap payment utility
      setSwapData(prev => {
        const oldEnergy = prev.oldBattery?.energy || 0;
        const rate = electricityServiceRef.current?.usageUnitPrice || prev.rate;
        const elecQuota = Number(electricityServiceRef.current?.quota ?? 0);
        const elecUsed = Number(electricityServiceRef.current?.used ?? 0);
        
        // Warn if rate is invalid - this could lead to incorrect cost calculations
        if (!rate || rate <= 0) {
          console.warn('[Attendant] WARNING: Rate is 0 or invalid during cost calculation. This may cause incorrect pricing.',
            { rate, serviceUsageUnitPrice: electricityServiceRef.current?.usageUnitPrice, prevRate: prev.rate });
        }
        
        // Use the centralized swap payment calculation
        const paymentCalc = calculateSwapPayment({
          newBatteryEnergyWh: battery.energy,
          oldBatteryEnergyWh: oldEnergy,
          ratePerKwh: rate,
          quotaTotal: elecQuota,
          quotaUsed: elecUsed,
        });
        
        console.info('Energy & cost calculated (via calculateSwapPayment):', {
          oldEnergyWh: oldEnergy,
          newEnergyWh: battery.energy,
          ratePerKwh: rate,
          quotaTotal: elecQuota,
          quotaUsed: elecUsed,
          ...paymentCalc,
        });
        
        return {
          ...prev,
          newBattery: battery,
          // Energy values from calculation
          energyDiff: paymentCalc.energyDiff,
          quotaDeduction: paymentCalc.quotaDeduction,
          chargeableEnergy: paymentCalc.chargeableEnergy,
          // Monetary values from calculation
          grossEnergyCost: paymentCalc.grossEnergyCost,
          quotaCreditValue: paymentCalc.quotaCreditValue,
          cost: paymentCalc.cost,
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
  // @param force - If true, forces cancellation even during active reading (used by timeout)
  const cancelBleOperation = useCallback((force?: boolean) => {
    console.info('=== Cancelling BLE operation via hook ===', force ? '(forced)' : '');
    clearScanTimeout();
    hookCancelOperation(force);
    setIsScanning(false);
    scanTypeRef.current = null;
  }, [clearScanTimeout, hookCancelOperation]);
  
  // Retry BLE connection - delegates to hook
  const retryBleConnection = useCallback(() => {
    console.info('=== Retrying BLE connection via hook ===');
    hookRetryConnection();
  }, [hookRetryConnection]);

  // Get energy service from service states
  // Check for both "service-energy" and "service-electricity" patterns for compatibility
  const electricityService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && 
      (service.service_id.includes('service-energy') || service.service_id.includes('service-electricity'))
  );
  
  // Keep electricityServiceRef in sync for use in BLE hook callbacks
  useEffect(() => {
    electricityServiceRef.current = electricityService;
  }, [electricityService]);
  
  // Keep customerTypeRef and customerDataRef in sync for use in BLE hook callbacks
  // These refs allow the battery read callback to access current values without recreation
  useEffect(() => {
    customerTypeRef.current = customerType;
  }, [customerType]);
  
  useEffect(() => {
    customerDataRef.current = customerData;
  }, [customerData]);

  // NOTE: Auto-save effect is defined after saveSessionData callback (below usePaymentCollection)

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
      // Round to 2 decimal places to avoid floating-point precision issues (e.g., 3.47 - 3.46 = 0.01, not 0.010000000000000231)
      const remainingElecQuota = round(elecQuota - elecUsed, 2);
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

  // ============================================
  // PAYMENT COLLECTION HOOK
  // ============================================
  
  const {
    paymentState,
    setPaymentInputMode,
    setManualPaymentId,
    initiatePayment: initiateOdooPayment,
    confirmPayment,
    skipPayment,
    resetPayment,
    restorePaymentState,
    isProcessing: isPaymentProcessing,
    publishStatus: paymentAndServiceStatus,
  } = usePaymentCollection({
    customerData,
    swapData,
    dynamicPlanId,
    customerType,
    attendantInfo,
    electricityServiceId: electricityService?.service_id,
    // Pass session order ID - when provided, payment uses session update flow
    // instead of creating a separate payment request
    sessionOrderId,
    onSuccess: (isIdempotent) => {
      advanceToStep(6);
      toast.success(isIdempotent ? 'Swap completed! (already recorded)' : 'Swap completed!');
      setIsScanning(false);
      setIsProcessing(false);
    },
    onError: (errorMsg) => {
      toast.error(errorMsg);
      setIsScanning(false);
      setIsProcessing(false);
    },
    onPartialPayment: async (amountPaid, amountRemaining, shortfall, paymentInputState) => {
      // Save session with partial payment info so it can be recovered
      console.info('[AttendantFlow] Partial payment received, saving session:', {
        amountPaid,
        amountRemaining,
        shortfall,
      });
      
      // Save session immediately to persist partial payment state
      // This ensures if the app crashes, user returns to Step 5 with correct amounts
      if (sessionOrderId) {
        try {
          const sessionData = buildAttendantSessionData({
            currentStep: 5,
            maxStepReached: Math.max(5, maxStepReached),
            actor: attendantInfo,
            inputMode,
            manualSubscriptionId,
            dynamicPlanId,
            customerData,
            customerType,
            serviceStates,
            swapData,
            paymentState: {
              inputMode: paymentInputState.inputMode,
              manualPaymentId: paymentInputState.manualPaymentId,
              requestCreated: true, // Payment was attempted
              requestOrderId: sessionOrderId,
              expectedAmount: Math.floor(swapData.cost),
              amountRemaining,
              amountPaid,
              transactionId: null, // Not fully confirmed yet
              skipped: false,
              skipReason: null,
            },
            flowError: null,
          });
          
          await updateSession(sessionData);
          console.info('[AttendantFlow] Session saved with partial payment state');
        } catch (err) {
          console.error('[AttendantFlow] Failed to save partial payment state:', err);
        }
      }
    },
  });
  
  // Destructure payment state for convenience
  const {
    paymentInputMode,
    manualPaymentId,
    transactionId,
    paymentAmountRemaining,
    actualAmountPaid,
    paymentRequestCreated,
  } = paymentState;

  // Apply pending payment state restoration (from session resume)
  // This runs after restorePaymentState is available from the hook
  useEffect(() => {
    if (pendingPaymentRestore && restorePaymentState) {
      console.info('[AttendantFlow] Applying pending payment state restoration:', pendingPaymentRestore);
      restorePaymentState(pendingPaymentRestore);
      setPendingPaymentRestore(null);
    }
  }, [pendingPaymentRestore, restorePaymentState]);

  // Helper to build and save session data (defined here because it needs paymentState variables)
  const saveSessionData = useCallback(async (
    step: number,
    maxStep: number,
    options?: { 
      withPayment?: boolean; 
      paymentDescription?: string; 
      paymentAmount?: number;
    }
  ) => {
    if (!sessionOrderId) {
      console.info('[AttendantFlow] No session orderId - skipping session save');
      return;
    }
    
    const sessionData = buildAttendantSessionData({
      currentStep: step,
      maxStepReached: maxStep,
      actor: attendantInfo,
      inputMode,
      manualSubscriptionId,
      dynamicPlanId,
      customerData,
      customerType,
      serviceStates,
      swapData,
      paymentState: {
        inputMode: paymentInputMode,
        manualPaymentId,
        requestCreated: paymentRequestCreated,
        requestOrderId: null, // Not stored in this hook
        expectedAmount: Math.floor(swapData.cost),
        amountRemaining: paymentAmountRemaining,
        amountPaid: actualAmountPaid,
        transactionId,
        skipped: false,
        skipReason: null,
      },
      flowError,
    });
    
    if (options?.withPayment && options.paymentDescription && options.paymentAmount !== undefined) {
      await updateSessionWithPayment(sessionData, options.paymentDescription, options.paymentAmount);
    } else {
      await updateSession(sessionData);
    }
  }, [
    sessionOrderId,
    attendantInfo,
    inputMode,
    manualSubscriptionId,
    dynamicPlanId,
    customerData,
    customerType,
    serviceStates,
    swapData,
    paymentInputMode,
    manualPaymentId,
    paymentRequestCreated,
    paymentAmountRemaining,
    actualAmountPaid,
    transactionId,
    flowError,
    updateSession,
    updateSessionWithPayment,
  ]);

  // Auto-save session on step transitions (after state has updated)
  // This ensures the backend has the latest data for session recovery
  const prevStepRef = useRef<number>(currentStep);
  useEffect(() => {
    // Skip if no session, step hasn't changed, or still on step 1
    if (!sessionOrderId || currentStep === prevStepRef.current || currentStep <= 1) {
      prevStepRef.current = currentStep;
      return;
    }
    
    // When reaching step 6 (success), save the completed state then clear local tracking
    // This ensures the backend knows the session is complete (step 6)
    if (currentStep === 6) {
      console.info('[AttendantFlow] Workflow completed (step 6) - saving final state and clearing local session');
      prevStepRef.current = currentStep;
      
      // Save step 6 to backend with status: 'completed'
      // buildAttendantSessionData sets status to 'completed' when currentStep >= 6
      saveSessionData(6, 6).then(() => {
        // Clear local state after saving - session data remains on backend
        clearSession();
      }).catch((err) => {
        console.error('[AttendantFlow] Failed to save final session state:', err);
        // Still clear local state even if save fails
        clearSession();
      });
      return;
    }
    
    console.info(`[AttendantFlow] Step changed from ${prevStepRef.current} to ${currentStep} - saving session`);
    prevStepRef.current = currentStep;
    
    // Save session with current state
    saveSessionData(currentStep, maxStepReached);
  }, [currentStep, maxStepReached, sessionOrderId, saveSessionData, clearSession]);

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


  // Process customer QR code data - parses QR and delegates to identification hook
  const processCustomerQRData = useCallback((qrCodeData: string) => {
    // Parse QR code data
    let parsedData: any;
    try {
      parsedData = JSON.parse(qrCodeData);
    } catch {
      parsedData = qrCodeData;
    }

    // Normalize data - handle both JSON objects and plain strings
    const subscriptionCode = typeof parsedData === 'object'
      ? parsedData.subscription_code || parsedData.subscriptionCode || parsedData.subscription?.code
      : qrCodeData;

    if (!subscriptionCode) {
      console.error("No subscription_code found in QR code");
      toast.error("QR code missing subscription_code");
      setIsScanning(false);
      scanTypeRef.current = null;
      return;
    }

    // Store the plan ID for later use
    setDynamicPlanId(subscriptionCode);

    // Extract optional fields from QR
    const name = typeof parsedData === 'object'
      ? parsedData.name || parsedData.customer_name
      : undefined;
    const phone = typeof parsedData === 'object'
      ? parsedData.phone || parsedData.customer_phone
      : undefined;
    const customerId = typeof parsedData === 'object'
      ? parsedData.customer_id || parsedData.customerId || parsedData.customer?.id
      : qrCodeData;

    // Delegate to identification hook
    identifyCustomer({
      subscriptionCode,
      source: 'qr',
      name,
      phone,
      customerId,
    });
  }, [identifyCustomer]);

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


  // Process payment QR code data - extract receipt and delegate to hook
  const processPaymentQRData = useCallback((qrCodeData: string) => {
    let qrData: any;
    try {
      qrData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch {
      qrData = { transaction_id: qrCodeData };
    }
    const receipt = qrData.transaction_id || qrData.receipt || qrData.txn_id || qrData.id || qrCodeData;
    
    // Reset scanning state before calling confirm (hook will manage its own processing state)
    setIsScanning(false);
    scanTypeRef.current = null;
    
    // Delegate to payment hook
    confirmPayment(receipt);
  }, [confirmPayment]);

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

  // Step 1: Manual lookup - delegates to identification hook
  const handleManualLookup = useCallback(async () => {
    const subscriptionCode = manualSubscriptionId.trim();
    
    if (!subscriptionCode) {
      toast.error('Please enter a Subscription ID');
      return;
    }

    // Store the plan ID for later use
    setDynamicPlanId(subscriptionCode);
    
    // Set processing state (hook's onComplete will clear it)
    setIsProcessing(true);

    // Delegate to identification hook
    identifyCustomer({
      subscriptionCode,
      source: 'manual',
    });
  }, [manualSubscriptionId, identifyCustomer]);

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

  // Step 4: Proceed to payment - report payment via session update, then initiate local payment state
  // OR skip payment if customer has sufficient quota OR rounded cost is zero
  const handleProceedToPayment = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Calculate rounded cost - customers can't pay decimals so we round down
      const roundedCost = Math.floor(swapData.cost);
      
      // Check if we should skip payment collection
      const shouldSkipPayment = hasSufficientQuota || roundedCost <= 0;
      
      if (shouldSkipPayment) {
        const isZeroCostRounding = !hasSufficientQuota && roundedCost <= 0;
        // Delegate to hook's skipPayment function
        skipPayment(hasSufficientQuota, isZeroCostRounding);
        return;
      }
      
      // NEW FLOW: Report payment amount via session update FIRST
      // This uses the /api/sessions/by-order/{orderId} endpoint with amount_required
      // The backend will create/update the payment ticket based on the session
      if (sessionOrderId) {
        const paymentDescription = `Battery swap - ${customerData?.name || 'Customer'} - ${swapData.energyDiff.toFixed(2)} kWh`;
        console.log('Reporting payment via session update:', {
          orderId: sessionOrderId,
          description: paymentDescription,
          amount_required: roundedCost,
        });
        
        try {
          await saveSessionData(5, 5, {
            withPayment: true,
            paymentDescription,
            paymentAmount: roundedCost,
          });
        } catch (err) {
          console.error('Failed to report payment via session update:', err);
          toast.error('Failed to create payment request. Please try again.');
          return;
        }
      }
      
      // Initialize local payment state (and optionally send STK push)
      // When sessionOrderId is provided, this will NOT create a new payment request
      // It just sets local state for the payment collection UI
      const success = await initiateOdooPayment();
      if (!success) {
        console.error('Payment initialization failed, staying on review step');
        return;
      }
      
      advanceToStep(5);
    } finally {
      setIsProcessing(false);
    }
  }, [advanceToStep, initiateOdooPayment, hasSufficientQuota, swapData.cost, swapData.energyDiff, skipPayment, sessionOrderId, customerData?.name, saveSessionData]);

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

  // Step 5: Manual payment confirmation - delegate to hook
  const handleManualPayment = useCallback((receipt: string) => {
    confirmPayment(receipt);
  }, [confirmPayment]);

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
      grossEnergyCost: 0,
      quotaCreditValue: 0,
      cost: 0,
      rate: 120,
      currencySymbol: PAYMENT.defaultCurrency,
    });
    setManualSubscriptionId('');
    setInputMode('scan');
    setDynamicPlanId('');
    setServiceStates([]);
    setCustomerType(null);
    setFlowError(null);
    cancelOngoingScan();
    
    // Reset all payment state via hook
    resetPayment();
    
    // Clear BLE state via hook - devices will be rediscovered when reaching Step 2
    hookResetState();
    
    // Clear backend session - workflow completed or starting fresh
    clearSession();
  }, [cancelOngoingScan, hookResetState, resetPayment, clearSession]);

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

  // Handle back to roles (navigate to role selection without logging out)
  const handleBackToRoles = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  }, [onBack, router]);

  // Handle logout - clear attendant authentication and notify parent
  // Note: Attendant and Sales are now separate roles with separate sessions
  const handleLogout = useCallback(() => {
    clearAttendantRoleLogin();
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
            isProcessing={isProcessing || isPaymentProcessing || paymentAndServiceStatus === 'pending'}
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

      {/* Action Bar - Only show after session check is complete */}
      {sessionCheckComplete && (
        <ActionBar
          currentStep={currentStep}
          onBack={handleBack}
          onMainAction={handleMainAction}
          isLoading={isScanning || isProcessing || isPaymentProcessing || paymentAndServiceStatus === 'pending'}
          inputMode={inputMode}
          paymentInputMode={paymentInputMode}
          hasSufficientQuota={hasSufficientQuota}
          swapCost={swapData.cost}
        />
      )}

      {/* Loading Overlay - Simple overlay for non-BLE operations */}
      {(isScanning || isProcessing || isPaymentProcessing || paymentAndServiceStatus === 'pending') && 
       !bleScanState.isConnecting && 
       !bleScanState.isReadingEnergy && 
       !(bleScanState.isScanning && (scanTypeRef.current === 'old_battery' || scanTypeRef.current === 'new_battery')) && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {paymentAndServiceStatus === 'pending' 
              ? 'Completing swap...' 
              : isPaymentProcessing
              ? 'Confirming payment...'
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

      {/* Session Resume Prompt - Shows when there's a pending session from backend */}
      <SessionResumePrompt
        isVisible={showSessionPrompt && !!pendingSession}
        session={pendingSession}
        onResume={handleResumeSession}
        onDiscard={handleDiscardSession}
        isLoading={isSessionLoading}
      />

      {/* Session Check Loading Overlay - Shows while checking for pending sessions */}
      {!sessionCheckComplete && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="loading-spinner"></div>
            <div className="text-white text-sm opacity-80">
              {t('session.checkingForSession') || 'Checking for pending session...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
