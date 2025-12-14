'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { useI18n } from '@/i18n';

// Import components
import {
  SalesTimeline,
  SalesActionBar,
  Step1CustomerForm,
  Step2SelectPackage,
  Step3SelectSubscription,
  Step4Preview,
  Step5Payment,
  Step6AssignBattery,
  Step7Success,
  // Types
  CustomerFormData,
  BatteryData,
  SalesStep,
  PlanData,
  ProductData,
  PackageData,
  PackageComponent,
  SubscriptionData,
  generateRegistrationId,
} from './components';
// ProgressiveLoading removed - using simple loading overlay like Attendant flow

// Import modular BLE hook for battery scanning
import { useFlowBatteryScan } from '@/lib/hooks/ble';
import { useProductCatalog } from '@/lib/hooks/useProductCatalog';
import { useCustomerIdentification, type CustomerIdentificationResult, type ServiceState, type CustomerIdentificationStatus } from '@/lib/hooks/useCustomerIdentification';
import { usePaymentAndService, type PublishPaymentAndServiceParams } from '@/lib/services/hooks';
import { BleProgressModal, MqttReconnectBanner } from '@/components/shared';
import { PAYMENT } from '@/lib/constants';
import { calculateSwapPayment } from '@/lib/swap-payment';

// Import Odoo API functions
import {
  registerCustomer,
  purchaseMultiProducts,
  initiatePayment,
  confirmPaymentManual,
  getCycleUnitFromPeriod,
  DEFAULT_COMPANY_ID,
  type ProductOrderItem,
  type RegisterCustomerPayload,
} from '@/lib/odoo-api';

// Import employee auth to get salesperson token and logout
import { getEmployeeToken, clearEmployeeLogin, getEmployeeUser } from '@/lib/attendant-auth';

// Import session persistence utilities
import {
  saveSalesSession,
  loadSalesSession,
  clearSalesSession,
  getSessionSummary,
  type SalesSessionData,
} from '@/lib/sales-session';

// Define WebViewJavascriptBridge type
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

// NOTE: MQTT connection is handled globally by bridgeContext.tsx
// No need for local MqttConfig - uses global connection with auto-reconnection

// Salesperson station info (similar to attendant)
const SALESPERSON_STATION = "STATION_001";

interface SalesFlowProps {
  onBack?: () => void;
  onLogout?: () => void;
}

export default function SalesFlow({ onBack, onLogout }: SalesFlowProps) {
  const router = useRouter();
  // Use global MQTT connection from bridgeContext (connects at splash screen)
  // This leverages the auto-reconnection mechanism for unstable networks
  const { bridge, isBridgeReady, isMqttConnected, mqttReconnectionState, reconnectMqtt } = useBridge();
  const { locale, setLocale, t } = useI18n();
  
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
  
  // Step management
  const [currentStep, setCurrentStep] = useState<SalesStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<SalesStep>(1);

  // Form data - fields for Odoo /api/auth/register (company_id from salesperson token)
  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    zip: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});

  // Product catalog hook - fetches products, packages, and plans from Odoo
  const {
    products: availableProducts,
    packages: availablePackages,
    plans: availablePlans,
    isLoading: catalogLoading,
    errors: catalogErrors,
    selectedProductId,
    selectedPackageId,
    selectedPlanId,
    selectedPackage,
    selectedPlan,
    setSelectedProductId,
    setSelectedPackageId,
    setSelectedPlanId,
    refetch: fetchProductsAndPlans,
    restoreSelections: restoreCatalogSelections,
  } = useProductCatalog({ autoFetch: true });

  // Alias loading/error states for backward compatibility
  const isLoadingProducts = catalogLoading.products;
  const isLoadingPackages = catalogLoading.packages;
  const isLoadingPlans = catalogLoading.plans;
  const productsLoadError = catalogErrors.products;
  const packagesLoadError = catalogErrors.packages;
  const plansLoadError = catalogErrors.plans;

  // Created customer data from Odoo registration
  const [createdCustomerId, setCreatedCustomerId] = useState<number | null>(null);
  const [createdPartnerId, setCreatedPartnerId] = useState<number | null>(null);
  const [customerSessionToken, setCustomerSessionToken] = useState<string | null>(null);
  
  // Subscription data from purchase
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);

  // Payment states
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [paymentInputMode, setPaymentInputMode] = useState<'scan' | 'manual'>('scan');
  // Manual payment ID input (like Attendant flow)
  const [manualPaymentId, setManualPaymentId] = useState<string>('');
  // Order ID - REQUIRED for confirm payment (from purchaseMultiProducts response)
  const [paymentRequestOrderId, setPaymentRequestOrderId] = useState<number | null>(null);
  
  // Payment amount tracking for incomplete payments
  const [paymentAmountPaid, setPaymentAmountPaid] = useState<number>(0);
  const [paymentAmountExpected, setPaymentAmountExpected] = useState<number>(0);
  const [paymentAmountRemaining, setPaymentAmountRemaining] = useState<number>(0);
  const [paymentIncomplete, setPaymentIncomplete] = useState(false);
  
  // Confirmed subscription code from payment - used for battery allocation
  const [confirmedSubscriptionCode, setConfirmedSubscriptionCode] = useState<string | null>(null);

  // Battery data
  const [assignedBattery, setAssignedBattery] = useState<BatteryData | null>(null);
  
  // NEW: Scanned battery pending service completion (battery scanned but service not yet reported)
  const [scannedBatteryPending, setScannedBatteryPending] = useState<BatteryData | null>(null);
  
  // Default rate fallback (used when backend doesn't provide one)
  const DEFAULT_RATE = 120;
  
  // Customer identification data from MQTT (for getting unit price / rate)
  const [customerServiceStates, setCustomerServiceStates] = useState<ServiceState[]>([]);
  const [customerIdentified, setCustomerIdentified] = useState(false);
  const [customerRate, setCustomerRate] = useState<number>(DEFAULT_RATE);
  const [customerCurrencySymbol, setCustomerCurrencySymbol] = useState<string>(PAYMENT.defaultCurrency);
  
  // Computed cost for first-time customer (energy × rate, offered as discount)
  const [computedEnergyCost, setComputedEnergyCost] = useState<number>(0);
  
  // Registration ID
  const [registrationId, setRegistrationId] = useState<string>('');

  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  // Scanner opening state - prevents multiple scanner opens
  const [isScannerOpening, setIsScannerOpening] = useState(false);

  // ============================================
  // BLE SCAN-TO-BIND HOOK (Modular BLE handling)
  // ============================================
  
  // BLE scan-to-bind hook - handles all BLE operations for battery assignment
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
      // In SalesFlow, battery is first stored as pending, not directly assigned
      // User must click "Complete Service" to finalize the assignment
      console.info('Battery read via hook (for assignment):', battery);
      setScannedBatteryPending(battery);
      // Use actualBatteryId from ATT service (OPID/PPID), fallback to shortId or id
      toast.success(`Battery ${battery.actualBatteryId || battery.shortId || battery.id} scanned! Click "Complete Service" to finalize.`);
      setIsScannerOpening(false);
      scanTypeRef.current = null;
    },
    onNewBatteryRead: (battery) => {
      // Not used in SalesFlow - battery assignment uses old_battery type
      console.info('New battery read (unused in SalesFlow):', battery);
    },
    onError: (error, requiresReset) => {
      console.error('BLE error via hook:', error, { requiresReset });
      setIsScannerOpening(false);
      scanTypeRef.current = null;
    },
    debug: true,
  });

  // BLE handlers ready flag - synced with hook's isReady
  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);
  
  useEffect(() => {
    if (bleIsReady && !bleHandlersReady) {
      setBleHandlersReady(true);
    }
  }, [bleIsReady, bleHandlersReady]);

  // Customer identification hook - gets service unit price (rate) from backend
  // This is a background operation in Sales flow (user doesn't know it's happening)
  // Enable auto-retry for network failures (up to 3 attempts with exponential backoff)
  // Enable silent mode to suppress toast notifications (UI shows status instead)
  const { 
    identifyCustomer, 
    retryIdentification,
    cancelIdentification,
    resetIdentificationState,
    status: identificationStatus,
    retryCount: identificationRetryCount,
    lastError: identificationError,
    isLoading: isIdentifying,
  } = useCustomerIdentification({
    bridge: bridge as any,
    isBridgeReady,
    isMqttConnected,
    attendantInfo: {
      id: `salesperson-${getEmployeeUser()?.id || '001'}`,
      station: SALESPERSON_STATION,
    },
    defaultRate: DEFAULT_RATE,
    // Enable auto-retry for Sales flow - service info is required for pricing
    enableAutoRetry: true,
    maxAutoRetries: 3,
    // Silent mode - no toast notifications for background operations
    // UI components show status via identificationStatus/identificationError
    silent: true,
    onSuccess: (result: CustomerIdentificationResult) => {
      console.info('[SALES] Service info fetched successfully:', result);
      setCustomerServiceStates(result.serviceStates);
      setCustomerRate(result.rate);
      setCustomerCurrencySymbol(result.currencySymbol);
      setCustomerIdentified(true);
    },
    onError: (error: string) => {
      console.error('[SALES] Failed to fetch service info after all retries:', error);
      // Don't auto-set customerIdentified to true - let user decide to retry or not
      // This prevents proceeding with wrong pricing
    },
    onRetry: (attempt: number, delay: number) => {
      console.info(`[SALES] Service info fetch retry scheduled: attempt ${attempt}, delay ${delay}ms`);
    },
    onComplete: () => {
      // Fetch complete (success or error)
    },
  });
  
  // Payment and service completion hook - reports both payment and service via MQTT
  const {
    publishPaymentAndService,
    status: paymentAndServiceStatus,
    reset: resetPaymentAndService,
    isReady: isPaymentServiceReady,
  } = usePaymentAndService({
    onSuccess: (isIdempotent) => {
      console.info('[SALES] Payment and service completed successfully!', isIdempotent ? '(idempotent)' : '');
      // Move battery from pending to assigned
      setAssignedBattery(scannedBatteryPending);
      setScannedBatteryPending(null);
      setRegistrationId(generateRegistrationId());
      
      // Clear session since registration is complete
      clearSalesSession();
      
      advanceToStep(7);
      toast.success(isIdempotent ? 'Service completed! (already recorded)' : 'Service completed! Battery assigned successfully.');
    },
    onError: (errorMsg) => {
      console.error('[SALES] Payment and service failed:', errorMsg);
      toast.error(errorMsg);
    },
  });
  
  // Track if service completion is in progress
  const isCompletingService = paymentAndServiceStatus === 'pending';

  // Scan type tracking (payment still needs manual tracking)
  const scanTypeRef = useRef<'battery' | 'payment' | null>(null);

  // Bridge initialization ref
  const bridgeInitRef = useRef<boolean>(false);

  // Session restoration state
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSessionSummary, setSavedSessionSummary] = useState<{
    customerName: string;
    step: number;
    savedAt: string;
  } | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const isRestoringSession = useRef(false);
  
  // Process payment QR data ref
  const processPaymentQRDataRef = useRef<(paymentId: string) => void>(() => {});

  // Advance to a new step
  const advanceToStep = useCallback((step: SalesStep) => {
    setCurrentStep(step);
    setMaxStepReached(prev => Math.max(prev, step) as SalesStep);
  }, []);

  // Check for saved session on component mount
  useEffect(() => {
    const summary = getSessionSummary();
    if (summary && !sessionRestored) {
      setSavedSessionSummary(summary);
      setShowResumePrompt(true);
    }
  }, [sessionRestored]);

  // Restore session from localStorage
  const restoreSession = useCallback(() => {
    if (isRestoringSession.current) return;
    isRestoringSession.current = true;

    const savedSession = loadSalesSession();
    if (savedSession) {
      // Restore all state from saved session
      setCurrentStep(savedSession.currentStep);
      setMaxStepReached(savedSession.maxStepReached);
      setFormData(savedSession.formData);
      // Only restore package/plan IDs if they exist (backwards compatibility)
      if (savedSession.selectedPackageId) {
        setSelectedPackageId(savedSession.selectedPackageId);
      }
      if (savedSession.selectedPlanId) {
        setSelectedPlanId(savedSession.selectedPlanId);
      }
      setCreatedCustomerId(savedSession.createdCustomerId);
      setCreatedPartnerId(savedSession.createdPartnerId);
      setCustomerSessionToken(savedSession.customerSessionToken);
      setSubscriptionData(savedSession.subscriptionData);
      setPaymentConfirmed(savedSession.paymentConfirmed);
      setPaymentReference(savedSession.paymentReference);
      setPaymentInitiated(savedSession.paymentInitiated);
      setPaymentAmountPaid(savedSession.paymentAmountPaid);
      setPaymentAmountExpected(savedSession.paymentAmountExpected);
      setPaymentAmountRemaining(savedSession.paymentAmountRemaining);
      setPaymentIncomplete(savedSession.paymentIncomplete);
      setConfirmedSubscriptionCode(savedSession.confirmedSubscriptionCode);
      setAssignedBattery(savedSession.assignedBattery);
      setRegistrationId(savedSession.registrationId);

      setSessionRestored(true);
      toast.success(`Resuming from Step ${savedSession.currentStep}`);
    }
    
    setShowResumePrompt(false);
  }, []);

  // Discard saved session and start fresh
  const discardSession = useCallback(() => {
    clearSalesSession();
    setShowResumePrompt(false);
    setSessionRestored(true); // Prevent prompt from appearing again
    toast('Starting a new registration');
  }, []);

  // Auto-save session whenever important state changes
  // Skip saving on step 6 (success) since the flow is complete
  useEffect(() => {
    // Don't save during initial session restoration
    if (!sessionRestored && showResumePrompt) return;
    // Don't save if on step 7 (completed)
    if (currentStep === 7) return;
    // Don't save if no progress has been made
    if (currentStep === 1 && !formData.firstName && !formData.lastName && !formData.email && !formData.phone) return;

    // Save session after a short delay to batch rapid changes
    const saveTimeout = setTimeout(() => {
      saveSalesSession({
        currentStep,
        maxStepReached,
        formData,
        selectedPackageId,
        selectedPlanId,
        createdCustomerId,
        createdPartnerId,
        customerSessionToken,
        subscriptionData,
        paymentConfirmed,
        paymentReference,
        paymentInitiated,
        paymentAmountPaid,
        paymentAmountExpected,
        paymentAmountRemaining,
        paymentIncomplete,
        confirmedSubscriptionCode,
        assignedBattery,
        registrationId,
      });
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [
    sessionRestored,
    showResumePrompt,
    currentStep,
    maxStepReached,
    formData,
    selectedPackageId,
    selectedPlanId,
    createdCustomerId,
    createdPartnerId,
    customerSessionToken,
    subscriptionData,
    paymentConfirmed,
    paymentReference,
    paymentInitiated,
    paymentAmountPaid,
    paymentAmountExpected,
    paymentAmountRemaining,
    paymentIncomplete,
    confirmedSubscriptionCode,
    assignedBattery,
    registrationId,
  ]);

  // NOTE: BLE timeout management is now handled by useFlowBatteryScan hook

  // MQTT publish function for service completion reporting
  const mqttPublish = useCallback(
    (topic: string, content: any) => {
      if (!window.WebViewJavascriptBridge) {
        console.error('MQTT: Bridge not available');
        return;
      }
      try {
        const dataToPublish = { topic, qos: 0, content };
        
        window.WebViewJavascriptBridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (resp: any) => {
            try {
              const r = typeof resp === "string" ? JSON.parse(resp) : resp;
              if (r?.respCode === "200" || r?.respData === true) {
                // MQTT published successfully
              } else {
                console.warn('MQTT: Publish response:', r);
              }
            } catch {
              // MQTT publish response received
            }
          }
        );
      } catch (err) {
        console.error('MQTT: Publish error:', err);
      }
    },
    []
  );

  // Scanner timeout ref - resets isScannerOpening if no result received
  const scannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear scanner timeout
  const clearScannerTimeout = useCallback(() => {
    if (scannerTimeoutRef.current) {
      clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = null;
    }
  }, []);
  
  // Start QR code scan
  const startQrCodeScan = useCallback(() => {
    // Prevent multiple scanner opens
    if (isScannerOpening) {
      return;
    }
    
    if (!window.WebViewJavascriptBridge) {
      toast.error('Unable to access camera');
      return;
    }

    setIsScannerOpening(true);
    
    // Safety timeout - reset isScannerOpening if no result after 60 seconds
    // This handles cases where user cancels the scanner or there's an error
    clearScannerTimeout();
    scannerTimeoutRef.current = setTimeout(() => {
      setIsScannerOpening(false);
    }, 60000);
    
    window.WebViewJavascriptBridge.callHandler(
      'startQrCodeScan',
      999,
      (responseData: string) => {
        // QR scan initiated
      }
    );
  }, [isScannerOpening, clearScannerTimeout]);

  // ============================================
  // BLE WRAPPER FUNCTIONS (delegate to hook)
  // ============================================

  // Start BLE scanning - delegates to hook
  const startBleScan = useCallback(() => {
    hookStartScanning();
  }, [hookStartScanning]);

  // Stop BLE scanning - delegates to hook
  const stopBleScan = useCallback(() => {
    hookStopScanning();
  }, [hookStopScanning]);

  // Cancel BLE operation - delegates to hook
  // @param force - If true, forces cancellation even during active reading (used by timeout)
  const cancelBleOperation = useCallback((force?: boolean) => {
    hookCancelOperation(force);
    setIsScannerOpening(false);
    scanTypeRef.current = null;
  }, [hookCancelOperation]);

  // Process battery QR and connect via hook - delegates all BLE operations to the hook
  const processBatteryQRData = useCallback((qrData: string) => {
    console.info('[SALES BATTERY] Processing QR via hook:', qrData);
    // Use "old_battery" type in SalesFlow since we're assigning a battery (not swapping)
    hookHandleQrScanned(qrData, 'old_battery');
  }, [hookHandleQrScanned]);

  // Reference for QR callback (used by bridge handler)
  const processBatteryQRDataRef = useRef<(data: string) => void>(() => {});
  
  // Update the ref when the callback changes
  useEffect(() => {
    processBatteryQRDataRef.current = processBatteryQRData;
  }, [processBatteryQRData]);

  // Initialize WebViewJavascriptBridge handlers
  useEffect(() => {
    const setupBridgeHandlers = () => {
      if (!window.WebViewJavascriptBridge) {
        console.error('WebViewJavascriptBridge not available');
        return;
      }

      if (bridgeInitRef.current) {
        return;
      }
      bridgeInitRef.current = true;

      // NOTE: bridge.init() is already called in bridgeContext.tsx
      // Do NOT call init() again here as it causes the app to hang

      // QR Code result handler - MUST match Attendant flow handler name
      // The scanner returns JSON with respData.value containing the actual QR code text
      window.WebViewJavascriptBridge.registerHandler(
        'scanQrcodeResultCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SALES QR] Step 1: QR Code Result Received from scanner');
          console.info('[SALES QR] Step 1a: Raw callback data:', data);
          console.info('[SALES QR] Step 1b: Current scanType:', scanTypeRef.current);
          
          // Reset scanner opening state and clear timeout when result is received
          clearScannerTimeout();
          setIsScannerOpening(false);
          
          try {
            // Parse the scanner response - matches Attendant flow implementation
            // The scanner returns JSON like: { respCode: "200", success: true, respData: { value: "actual_qr_text" } }
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            // Extract the actual QR code value from respData.value (this is the TEXT stored in the QR code)
            const qrVal = parsed.respData?.value || "";
            
            console.info('[SALES QR] Step 1c: Parsed response - respCode:', parsed.respCode, 'success:', parsed.success);
            console.info('[SALES QR] Step 1d: Extracted QR value (respData.value):', qrVal);
            
            if (!qrVal) {
              // User cancelled scan (no QR value) - just reset state silently
              console.info('[SALES QR] Step 1e: QR scan cancelled or empty - no value found');
              responseCallback({ success: false, cancelled: true });
              return;
            }
          
            if (scanTypeRef.current === 'battery') {
              console.info('[SALES QR] Step 2: Detected as battery scan, calling processBatteryQRData with:', qrVal);
              processBatteryQRDataRef.current(qrVal);
            } else if (scanTypeRef.current === 'payment') {
              console.info('[SALES QR] Step 2: Detected as payment scan');
              // Payment QR scanned - extract payment reference and confirm
              let paymentId = qrVal;
              try {
                // Try to parse as JSON first (structured payment data)
                const paymentData = JSON.parse(qrVal);
                paymentId = paymentData.transaction_id || paymentData.receipt || paymentData.id || qrVal;
                console.info('[SALES QR] Step 2a: Parsed payment QR as JSON, extracted ID:', paymentId);
              } catch {
                // If not JSON, treat the entire string as payment reference
                console.info('[SALES QR] Step 2a: Payment QR is plain text:', paymentId);
              }
              // Trigger payment confirmation via ref
              if (paymentId && processPaymentQRDataRef.current) {
                console.info('[SALES QR] Step 2b: Calling processPaymentQRData with:', paymentId);
                processPaymentQRDataRef.current(paymentId);
              }
            } else {
              console.info('[SALES QR] Step 2: Unknown scan type:', scanTypeRef.current, '- ignoring QR value');
            }
            
            responseCallback({ success: true });
          } catch (err) {
            console.error('[SALES QR] Error parsing QR callback data:', err);
            console.error('[SALES QR] Raw data that failed to parse:', data);
            responseCallback({ success: false, error: String(err) });
          }
        }
      );

      // NOTE: BLE handlers (findBleDeviceCallBack, bleConnectSuccessCallBack, etc.)
      // are now registered by the useFlowBatteryScan hook

      console.info('[SALES BATTERY] BLE handlers managed by useFlowBatteryScan hook');

      // NOTE: MQTT connection is handled globally by bridgeContext.tsx (connects at splash screen)
      // This provides auto-reconnection for unstable networks (e.g., VPN issues in China)
      // We only need to register the message handler here for service completion responses

      // MQTT message arrival callback (for response handling)
      window.WebViewJavascriptBridge.registerHandler(
        'mqttMsgArrivedCallBack',
        (data: string, resp: (response: any) => void) => {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            
            // Check for service completion response
            const topic = parsed.topic;
            if (topic && topic.includes('payment_and_service')) {
              const message = typeof parsed.message === 'string' 
                ? JSON.parse(parsed.message) 
                : parsed.message;
              
              const success = message?.data?.success ?? false;
              const signals = message?.data?.signals || [];
              
              // Check for success signals
              const hasServiceCompletedSignal = signals.includes('SERVICE_COMPLETED');
              const hasAssetSignals = signals.includes('ASSET_ALLOCATED');
              const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
              
              if (success && (hasServiceCompletedSignal || hasAssetSignals || isIdempotent)) {
                // Service completion will be handled by the completeService function
              }
            }
          } catch (e) {
            console.error('Error parsing MQTT message:', e);
          }
          resp({ received: true });
        }
      );
    };

    // Wait for bridge to be ready
    if (typeof window !== 'undefined') {
      if (window.WebViewJavascriptBridge) {
        setupBridgeHandlers();
      } else {
        document.addEventListener('WebViewJavascriptBridgeReady', setupBridgeHandlers);
        return () => {
          document.removeEventListener('WebViewJavascriptBridgeReady', setupBridgeHandlers);
        };
      }
    }
  }, [advanceToStep, clearScannerTimeout]);

  // Start BLE scanning when on step 6 (battery assignment)
  useEffect(() => {
    if (currentStep === 6 && bleIsReady) {
      startBleScan();
    } else if (currentStep !== 6) {
      stopBleScan();
    }
    
    return () => {
      stopBleScan();
    };
  }, [currentStep, bleIsReady, startBleScan, stopBleScan]);

  // NOTE: Product/package/plan fetching is now handled by useProductCatalog hook
  // The hook auto-fetches on mount and provides refetch via fetchProductsAndPlans

  // Validate form data - fields required by Odoo /api/auth/register
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CustomerFormData, string>> = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    // Email or Phone validation - at least one is required
    const hasEmail = formData.email.trim().length > 0;
    const hasPhone = formData.phone.trim().length > 0;
    
    if (!hasEmail && !hasPhone) {
      // Show error on both fields so it displays in the combined field
      errors.email = 'Email or phone number is required';
      errors.phone = 'Email or phone number is required';
    } else {
      // Validate email format if provided
      if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
      // Validate phone format if provided
      if (hasPhone && !/^[\+]?[\s\d\-\(\)]{10,}$/.test(formData.phone.trim())) {
        errors.phone = 'Please enter a valid phone number';
      }
    }
    
    // Address validation
    if (!formData.street.trim()) {
      errors.street = 'Street address is required';
    }
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }
    if (!formData.zip.trim()) {
      errors.zip = 'ZIP/Postal code is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Register customer in Odoo using /api/auth/register
  // Sends name, email, phone, street, city, zip (company_id is derived from salesperson token)
  const createCustomerInOdoo = useCallback(async (): Promise<boolean> => {
    setIsCreatingCustomer(true);
    
    try {
      // Get the salesperson's employee token for company association
      const employeeToken = getEmployeeToken();
      
      if (!employeeToken) {
        console.warn('No employee token found - customer may not be associated with correct company');
      }
      
      // Format phone number - ensure it starts with country code (only if provided)
      let phoneNumber = '';
      if (formData.phone.trim()) {
        phoneNumber = formData.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '254' + phoneNumber.slice(1);
        } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('254')) {
          phoneNumber = '254' + phoneNumber;
        }
        phoneNumber = phoneNumber.replace('+', '');
      }

      const registrationPayload: RegisterCustomerPayload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
      };

      // Only include email if provided
      if (formData.email.trim()) {
        registrationPayload.email = formData.email.trim();
      }

      // Only include phone if provided
      if (phoneNumber) {
        registrationPayload.phone = phoneNumber;
      }

      console.log('Registering customer in Odoo:', registrationPayload);

      // Pass the employee token so Odoo can derive the company_id
      const response = await registerCustomer(registrationPayload, employeeToken || undefined);
      
      // Log full response for debugging
      console.log('Odoo registration response:', JSON.stringify(response, null, 2));

      if (response.success && response.session) {
        const { session } = response;
        
        console.log('Customer registered successfully:', session.user);
        
        // Store customer data
        setCreatedCustomerId(session.user.id);
        setCreatedPartnerId(session.user.partner_id);
        setCustomerSessionToken(session.token);
        
        toast.success('Customer registered successfully!');
        return true;
      } else {
        console.error('Unexpected response structure:', response);
        throw new Error('Registration failed - no session returned');
      }
    } catch (error: any) {
      console.error('Failed to register customer:', error);
      toast.error(error.message || 'Failed to register customer. Please try again.');
      return false;
    } finally {
      setIsCreatingCustomer(false);
    }
  }, [formData]);

  // Purchase subscription after customer is registered
  // Returns object with subscription_code and order_id on success, null on failure
  // The order is created automatically by /api/subscription/purchase endpoint
  const purchaseCustomerSubscription = useCallback(async (): Promise<{ subscriptionCode: string; orderId: number } | null> => {
    if (!createdPartnerId) {
      toast.error('Customer not registered yet');
      return null;
    }

    // Get the selected package and subscription plan
    const currentSelectedPackage = availablePackages.find(p => p.id === selectedPackageId);
    const currentSelectedPlan = availablePlans.find(p => p.id === selectedPlanId);
    
    if (!currentSelectedPackage) {
      toast.error('No package selected');
      return null;
    }
    
    if (!currentSelectedPlan) {
      toast.error('No subscription plan selected');
      return null;
    }

    try {
      // Get the salesperson's employee token for authorization
      const employeeToken = getEmployeeToken();
      
      const { interval, unit } = getCycleUnitFromPeriod(currentSelectedPlan.name);
      
      // Build the products array with all items:
      // 1. Subscription plan
      // 2. Package components (main product, privilege, etc.)
      const products: ProductOrderItem[] = [];
      
      // Add subscription plan
      products.push({
        product_id: currentSelectedPlan.odooProductId,
        quantity: 1,
        price_unit: currentSelectedPlan.price,
      });
      
      // Add package components (main product, privilege, etc.)
      if (currentSelectedPackage.components && currentSelectedPackage.components.length > 0) {
        for (const component of currentSelectedPackage.components) {
          products.push({
            product_id: component.id,
            quantity: component.quantity || 1,
            price_unit: component.price_unit,
          });
        }
      }
      
      // Determine notes based on subscription type
      const periodLower = currentSelectedPlan.name.toLowerCase();
      let subscriptionType = 'monthly';
      if (periodLower.includes('daily') || periodLower.includes('day')) subscriptionType = 'daily';
      else if (periodLower.includes('weekly') || periodLower.includes('week')) subscriptionType = 'weekly';
      else if (periodLower.includes('yearly') || periodLower.includes('annual') || periodLower.includes('year')) subscriptionType = 'yearly';
      
      const purchasePayload = {
        customer_id: createdPartnerId,
        company_id: DEFAULT_COMPANY_ID,
        products,
        cycle_interval: interval,
        cycle_unit: unit,
        notes: `Purchased via customer portal - ${subscriptionType} (Package: ${currentSelectedPackage.name})`,
      };

      console.log('Purchasing package + subscription:', purchasePayload);

      // Use the multi-product purchase endpoint
      // This endpoint creates both the subscription AND the order automatically
      const response = await purchaseMultiProducts(purchasePayload, employeeToken || undefined);

      if (response.success && response.data && response.data.subscription) {
        const { subscription, order } = response.data;
        
        // Validate order exists - this is required for payment confirmation
        if (!order || !order.id) {
          console.error('No order returned from purchase endpoint');
          throw new Error('Order creation failed - no order ID returned');
        }
        
        setSubscriptionData({
          id: subscription.id,
          subscriptionCode: subscription.subscription_code,
          status: subscription.status,
          productName: subscription.product_name,
          priceAtSignup: subscription.price_at_signup,
          currency: subscription.currency,
          currencySymbol: subscription.currency_symbol,
        });
        
        // Store the order_id from purchase response - this is used for payment confirmation
        setPaymentRequestOrderId(order.id);
        
        console.log('Subscription purchased:', subscription);
        
        // Return both subscription code and order_id
        return {
          subscriptionCode: subscription.subscription_code,
          orderId: order.id,
        };
      } else {
        throw new Error('Order creation failed - invalid response');
      }
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast.error(error.message || 'Failed to create order');
      return null;
    }
  }, [createdPartnerId, selectedPackageId, availablePackages, selectedPlanId, availablePlans]);

  // Initiate payment with Odoo - send STK push to customer's phone
  // NOTE: For Sales flow, the order is already created by /api/subscription/purchase
  // We just need to send the STK push and mark payment as initiated
  // Accepts subscriptionCode and orderId parameters to avoid React state timing issues
  const initiateOdooPayment = useCallback(async (subscriptionCode?: string, orderId?: number): Promise<boolean> => {
    // Use the passed subscription code, or fall back to state
    const subCode = subscriptionCode || subscriptionData?.subscriptionCode;
    
    if (!subCode) {
      toast.error('No subscription created. Please try again.');
      return false;
    }

    // Use passed orderId or fall back to state
    // orderId is passed directly to avoid React state timing issues
    const orderIdToUse = orderId || paymentRequestOrderId;
    
    // Verify we have an order_id from the purchase response
    if (!orderIdToUse) {
      console.error('No order_id from purchase response - cannot proceed with payment');
      toast.error('Order not created properly. Please try again.');
      return false;
    }

    // Get the salesperson's employee token for authorization
    const employeeToken = getEmployeeToken();
    
    // Calculate total amount: package + subscription
    const currentSelectedPackage = availablePackages.find(p => p.id === selectedPackageId);
    const currentSelectedPlan = availablePlans.find(p => p.id === selectedPlanId);
    const packagePrice = currentSelectedPackage?.price || 0;
    const subscriptionPrice = currentSelectedPlan?.price || 0;
    const totalAmount = packagePrice + subscriptionPrice;
    
    // Format phone number - ensure it starts with country code
    let phoneNumber = formData.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.slice(1);
    } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber;
    }
    phoneNumber = phoneNumber.replace('+', '');

    try {
      // Order is already created by /api/subscription/purchase endpoint
      // No need to call createPaymentRequest - just send STK push
      toast.success('Order ready. Collect payment from customer.');

      // Optionally try to send STK push (don't block if it fails)
      if (phoneNumber) {
        try {
          console.log('Sending STK push to customer phone:', phoneNumber);
          const stkResponse = await initiatePayment({
            subscription_code: subCode,
            phone_number: phoneNumber,
            amount: totalAmount,
          }, employeeToken || undefined);

          if (stkResponse.success && stkResponse.data) {
            console.log('STK push sent:', stkResponse.data);
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
      console.error('Failed to initiate payment:', error);
      toast.error(error.message || 'Failed to initiate payment. Please try again.');
      return false;
    }
  }, [subscriptionData, selectedPackageId, availablePackages, selectedPlanId, availablePlans, formData.phone, paymentRequestOrderId]);

  // Handle payment confirmation via QR scan
  const handlePaymentQrScan = useCallback(async () => {
    // First initiate payment if not already done
    if (!paymentInitiated) {
      await initiateOdooPayment();
    }
    
    scanTypeRef.current = 'payment';
    startQrCodeScan();
  }, [startQrCodeScan, paymentInitiated, initiateOdooPayment]);

  // Handle manual payment entry - confirm with Odoo using order_id ONLY
  const handleManualPayment = useCallback(async (receipt: string) => {
    setIsProcessing(true);
    
    try {
      // First initiate payment if not already done
      if (!paymentInitiated) {
        const initiated = await initiateOdooPayment();
        if (!initiated) {
          setIsProcessing(false);
          return;
        }
      }

      // order_id is REQUIRED - obtained from purchaseMultiProducts response
      if (!paymentRequestOrderId) {
        toast.error('Order not created. Please go back and try again.');
        setIsProcessing(false);
        return;
      }

      // Get the salesperson's employee token for authorization
      const employeeToken = getEmployeeToken();

      // Use Odoo manual confirmation endpoint with order_id ONLY
      console.log('Confirming payment with order_id:', {
        order_id: paymentRequestOrderId,
        receipt,
      });

      // Pass the employee token for authorization
      const response = await confirmPaymentManual({
        order_id: paymentRequestOrderId,
        receipt,
      }, employeeToken || undefined);
      
      if (response.success) {
        // Extract payment amounts from response
        // Handle both wrapped (response.data.X) and unwrapped (response.X) response formats
        // (Odoo API sometimes returns fields at root level, sometimes wrapped in data)
        const paymentData = response.data || (response as any);
        
        // Store subscription code for battery allocation (from response or from subscriptionData state)
        setConfirmedSubscriptionCode(paymentData.subscription_code || subscriptionData?.subscriptionCode || '');
        setPaymentReference(paymentData.receipt || receipt);
        
        // Use total_paid (new format) or amount_paid (legacy format)
        const paidAmount = paymentData.total_paid ?? paymentData.amount_paid ?? 0;
        const remainingAmount = paymentData.remaining_to_pay ?? paymentData.amount_remaining ?? 0;
        const expectedAmount = paymentData.expected_to_pay ?? paymentData.amount_expected ?? 0;
        
        console.log('Payment validation response:', {
          total_paid: paidAmount,
          remaining_to_pay: remainingAmount,
          expected_to_pay: expectedAmount,
          order_id: paymentData.order_id,
        });
        
        // Track payment amounts
        setPaymentAmountPaid(paidAmount);
        setPaymentAmountExpected(expectedAmount);
        setPaymentAmountRemaining(remainingAmount);
        
        // Check if payment is complete (remaining_to_pay = 0 means fully paid)
        const isFullyPaid = remainingAmount === 0;
        
        if (isFullyPaid) {
          // Payment complete - proceed to battery assignment
          setPaymentConfirmed(true);
          setPaymentIncomplete(false);
          toast.success('Payment confirmed! Proceed to battery assignment.');
          
          // OPTIMIZATION: Identify customer in background immediately after payment
          // This gets the unit price (rate) so by the time we scan battery, we have pricing info
          const subCode = paymentData.subscription_code || subscriptionData?.subscriptionCode;
          if (subCode && !customerIdentified) {
            console.info('[SALES] Starting background customer identification after payment...');
            identifyCustomer({
              subscriptionCode: subCode,
              source: 'manual',
            });
          }
          
          advanceToStep(6);
        } else {
          // Payment incomplete - show amounts and stay on payment step
          setPaymentIncomplete(true);
          setPaymentConfirmed(false);
          const currencySymbol = availablePlans.find(p => p.id === selectedPlanId)?.currencySymbol || 'KES';
          toast.error(
            `Incomplete payment: ${currencySymbol} ${paidAmount.toLocaleString()} paid of ${currencySymbol} ${expectedAmount.toLocaleString()}. Remaining: ${currencySymbol} ${remainingAmount.toLocaleString()}`
          );
        }
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      toast.error(err.message || 'Payment confirmation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [
    subscriptionData, 
    advanceToStep, 
    paymentInitiated, 
    initiateOdooPayment,
    availablePlans,
    selectedPlanId,
    paymentRequestOrderId,
    customerIdentified,
    identifyCustomer,
  ]);

  // Update payment QR ref when handler changes
  useEffect(() => {
    processPaymentQRDataRef.current = handleManualPayment;
  }, [handleManualPayment]);

  // Handle form field change
  const handleFormChange = useCallback((field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

  // Handle product selection (physical products like bikes) - kept for backward compatibility
  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProductId(productId);
  }, []);

  // Handle package selection (product + privilege bundled)
  const handlePackageSelect = useCallback((packageId: string) => {
    setSelectedPackageId(packageId);
  }, []);

  // Handle plan selection
  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
  }, []);

  // Handle battery scan (QR mode)
  const handleScanBattery = useCallback(() => {
    console.info('[SALES BATTERY] Step 0: handleScanBattery called - user clicked scan button');
    console.info('[SALES BATTERY] Step 0a: Setting scanType to "battery"');
    scanTypeRef.current = 'battery';
    console.info('[SALES BATTERY] Step 0b: Calling startQrCodeScan...');
    startQrCodeScan();
  }, [startQrCodeScan]);

  // Handle battery device selection (manual mode)
  const handleBatteryDeviceSelect = useCallback((device: { macAddress: string; name: string }) => {
    console.info('[SALES BATTERY] Manual device selected:', device);
    scanTypeRef.current = 'battery';
    
    // Use the device name as QR data (hook will match by last 6 chars)
    hookHandleQrScanned(device.name, 'old_battery');
  }, [hookHandleQrScanned]);

  // Handle re-scanning a different battery - clears current scanned battery and allows scanning again
  const handleRescanBattery = useCallback(() => {
    console.info('[SALES BATTERY] Rescan requested - clearing current battery');
    
    // Clear the scanned battery state
    setScannedBatteryPending(null);
    
    // Reset BLE state for a fresh scan
    hookResetState();
    
    // Clear scanner state
    setIsScannerOpening(false);
    scanTypeRef.current = null;
    
    // Restart BLE scanning for device detection
    if (bleIsReady) {
      startBleScan();
    }
    
    toast('Ready to scan a new battery');
  }, [hookResetState, bleIsReady, startBleScan]);

  // Handle service completion - uses customer identification + payment and service hooks
  // This is for first-time customer purchase (new subscription)
  // 
  // Flow:
  // 1. Customer identification already happened after payment confirmation (in background)
  // 2. Compute cost = energy × rate 
  // 3. Report both payment AND service via MQTT (payment_and_service action)
  //
  // IMPORTANT: For Sales flow, isQuotaBased MUST be false so payment_data is sent.
  // Unlike the Attendant swap flow where existing customers may have quota credit,
  // Sales flow customers have already paid via Odoo (M-Pesa/manual) for their subscription,
  // so we need to report this payment to BSS for accurate tracking.
  const handleCompleteService = useCallback(async () => {
    // Guard: Check MQTT connection before proceeding
    if (!isMqttConnected) {
      toast.error(t('MQTT not connected. Please wait a moment and try again.'));
      console.error('[SALES SERVICE] Cannot complete service - MQTT not connected');
      return;
    }

    if (!scannedBatteryPending) {
      toast.error('No battery scanned');
      return;
    }

    // Get the subscription ID (subscription_code)
    const subscriptionId = confirmedSubscriptionCode || subscriptionData?.subscriptionCode;
    if (!subscriptionId) {
      toast.error('No subscription found. Please complete payment first.');
      return;
    }

    // Customer identification should have already happened after payment confirmation
    // If not identified yet (edge case), try one more time but don't block
    if (!customerIdentified) {
      console.warn('[SALES SERVICE] Customer not yet identified - using default rate. Triggering identification...');
      identifyCustomer({
        subscriptionCode: subscriptionId,
        source: 'manual',
      });
      // Don't wait - continue with default rate, identification will complete for future reference
    }

    // Calculate cost using centralized calculateSwapPayment function
    // This ensures consistent rounding behavior with the Attendant flow
    const rate = customerRate || DEFAULT_RATE;
    const paymentCalc = calculateSwapPayment({
      newBatteryEnergyWh: scannedBatteryPending.energy,
      oldBatteryEnergyWh: 0, // First-time customer - no old battery
      ratePerKwh: rate,
      quotaTotal: 0, // First-time customer - no quota
      quotaUsed: 0,
    });
    
    const energyKwh = paymentCalc.energyDiff;
    const calculatedCost = paymentCalc.cost;
    
    console.info('[SALES SERVICE] Cost calculation (via calculateSwapPayment):', {
      energyWh: scannedBatteryPending.energy,
      energyKwh,
      rate,
      calculatedCost,
      currencySymbol: customerCurrencySymbol,
    });
    
    setComputedEnergyCost(calculatedCost);

    // Build and publish payment_and_service
    // For Sales flow:
    // - Customer has already paid via Odoo (M-Pesa/manual) for their subscription package
    // - We MUST report this payment to BSS (isQuotaBased: false)
    // - The payment is the first-time electricity cost included in the subscription
    // - paymentReference links to the Odoo payment receipt/confirmation
    const paymentRef = paymentReference || `FIRST_SALE_${subscriptionId}_${Date.now()}`;
    
    const params: PublishPaymentAndServiceParams = {
      paymentReference: paymentRef,
      planId: subscriptionId,
      swapData: {
        // First-time customer - no old battery
        oldBattery: null,
        newBattery: {
          id: scannedBatteryPending.id,
          actualBatteryId: scannedBatteryPending.actualBatteryId || null,
          energy: scannedBatteryPending.energy,
        },
        energyDiff: energyKwh, // Energy transferred in kWh
        cost: calculatedCost, // Computed cost (energy × rate)
        rate: rate,
        currencySymbol: customerCurrencySymbol,
      },
      customerType: 'first-time', // First-time customer - only new battery
      // Dynamically extract electricity service ID from customerServiceStates (same pattern as AttendantFlow)
      serviceId: (() => {
        const electricityService = customerServiceStates.find(
          (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-electricity')
        );
        return electricityService?.service_id || 'service-electricity-default';
      })(), // Electricity service
      actor: {
        type: 'attendant', // Backend expects 'attendant' type
        id: `salesperson-${getEmployeeUser()?.id || '001'}`,
        station: SALESPERSON_STATION,
      },
      // CRITICAL: For Sales flow, we MUST report the payment to BSS
      // isQuotaBased: false ensures payment_data is included in the MQTT message
      // This differs from Attendant swap flow where quota credit may skip payment
      isQuotaBased: false,
      isZeroCostRounding: false,
    };

    console.info('[SALES SERVICE] Publishing payment_and_service:', params);
    console.info('[SALES SERVICE] isQuotaBased: false - payment WILL be reported to BSS');
    
    // Publish via the hook - callbacks handle success/error
    await publishPaymentAndService(params);
  }, [
    scannedBatteryPending, 
    confirmedSubscriptionCode, 
    subscriptionData, 
    isMqttConnected,
    t,
    customerIdentified,
    customerRate,
    customerCurrencySymbol,
    customerServiceStates,
    identifyCustomer,
    publishPaymentAndService,
    paymentReference,
  ]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as SalesStep);
    }
  }, [currentStep]);

  // Handle main action button
  const handleMainAction = useCallback(async () => {
    switch (currentStep) {
      case 1:
        // Validate and create customer in Odoo
        if (validateForm()) {
          const customerCreated = await createCustomerInOdoo();
          if (customerCreated) {
            advanceToStep(2);
          }
        }
        break;
      case 2:
        // Move to subscription selection step (package already selected)
        if (!selectedPackageId) {
          toast.error('Please select a package');
          return;
        }
        advanceToStep(3);
        break;
      case 3:
        // Move to preview step (subscription already selected)
        if (!selectedPlanId) {
          toast.error('Please select a subscription plan');
          return;
        }
        advanceToStep(4);
        break;
      case 4:
        // Preview step - Purchase subscription (order is created automatically) and move to payment step
        setIsProcessing(true);
        try {
          // purchaseCustomerSubscription creates the order via /api/subscription/purchase
          // It returns both subscriptionCode and orderId
          const purchaseResult = await purchaseCustomerSubscription();
          if (purchaseResult && purchaseResult.orderId) {
            // Initiate payment to send M-Pesa prompt
            // Pass both subscriptionCode and orderId directly to avoid React state timing issues
            const paymentInitiatedSuccess = await initiateOdooPayment(
              purchaseResult.subscriptionCode, 
              purchaseResult.orderId
            );
            
            // Only advance to payment step if payment initiation was successful
            if (paymentInitiatedSuccess) {
              advanceToStep(5);
            } else {
              // Payment initiation failed - don't proceed
              // Error toast already shown by initiateOdooPayment
              console.error('Payment initiation failed - not advancing to payment step');
            }
          } else if (purchaseResult) {
            // Purchase returned but without orderId - this shouldn't happen
            console.error('Purchase returned without orderId');
            toast.error('Order creation failed - no order ID returned');
          }
          // If purchaseResult is null, error toast was already shown by purchaseCustomerSubscription
        } finally {
          setIsProcessing(false);
        }
        break;
      case 5:
        // Handle payment based on input mode (like Attendant flow)
        if (paymentInputMode === 'scan') {
          handlePaymentQrScan();
        } else {
          // Manual mode - call backend with manual payment ID
          if (manualPaymentId.trim()) {
            handleManualPayment(manualPaymentId.trim());
          }
        }
        break;
      case 6:
        // If battery already scanned, complete service; otherwise trigger scan
        if (scannedBatteryPending) {
          handleCompleteService();
        } else {
          handleScanBattery();
        }
        break;
      case 7:
        // Reset everything for new registration
        // Clear the saved session since we're starting fresh
        clearSalesSession();
        
        setCurrentStep(1);
        setMaxStepReached(1);
        setFormData({
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
          street: '',
          city: '',
          zip: '',
        });
        setFormErrors({});
        // Reset to first available package if any
        if (availablePackages.length > 0) {
          setSelectedPackageId(availablePackages[0].id);
        } else {
          setSelectedPackageId('');
        }
        // Reset to first available product if any
        if (availableProducts.length > 0) {
          setSelectedProductId(availableProducts[0].id);
        } else {
          setSelectedProductId('');
        }
        // Reset to first available plan if any
        if (availablePlans.length > 0) {
          setSelectedPlanId(availablePlans[0].id);
        } else {
          setSelectedPlanId('');
        }
        setCreatedCustomerId(null);
        setCreatedPartnerId(null);
        setCustomerSessionToken(null);
        setSubscriptionData(null);
        setPaymentConfirmed(false);
        setPaymentReference('');
        setPaymentInitiated(false);
        setPaymentInputMode('scan');
        setManualPaymentId('');
        setPaymentRequestOrderId(null);
        setPaymentAmountPaid(0);
        setPaymentAmountExpected(0);
        setPaymentAmountRemaining(0);
        setPaymentIncomplete(false);
        setConfirmedSubscriptionCode(null);
        setAssignedBattery(null);
        setScannedBatteryPending(null);
        // Reset customer identification state
        setCustomerServiceStates([]);
        setCustomerIdentified(false);
        setCustomerRate(DEFAULT_RATE);
        setCustomerCurrencySymbol(PAYMENT.defaultCurrency);
        setComputedEnergyCost(0);
        // Reset identification hook state
        resetIdentificationState();
        // Reset payment and service hook
        resetPaymentAndService();
        setRegistrationId('');
        // Reset session restored flag to allow new session tracking
        setSessionRestored(true);
        break;
    }
  }, [
    currentStep, 
    validateForm, 
    createCustomerInOdoo, 
    purchaseCustomerSubscription,
    initiateOdooPayment,
    advanceToStep, 
    handlePaymentQrScan, 
    handleManualPayment,
    handleScanBattery,
    handleCompleteService,
    scannedBatteryPending,
    paymentInputMode,
    manualPaymentId,
    availablePackages,
    availableProducts,
    availablePlans,
    selectedPackageId,
    selectedPlanId
  ]);

  // Handle step click in timeline
  const handleStepClick = useCallback((step: SalesStep) => {
    if (step <= maxStepReached && step < 7) {
      setCurrentStep(step);
    }
  }, [maxStepReached]);

  // Handle back to roles
  const handleBackToRoles = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  }, [onBack, router]);

  // Handle logout - clear authentication and sales session, then notify parent
  const handleLogout = useCallback(() => {
    // Clear the sales session first
    clearSalesSession();
    // Clear employee authentication
    clearEmployeeLogin();
    toast.success(t('Signed out successfully'));
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router, t]);

  // Render step content
  // NOTE: selectedPackage and selectedPlan are provided by useProductCatalog hook

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1CustomerForm 
            formData={formData}
            onFormChange={handleFormChange}
            errors={formErrors}
          />
        );
      case 2:
        // Package selection (product + privilege bundled)
        return (
          <Step2SelectPackage
            selectedPackage={selectedPackageId}
            onPackageSelect={handlePackageSelect}
            packages={availablePackages}
            isLoadingPackages={isLoadingPackages}
            loadError={packagesLoadError}
            onRetryLoad={fetchProductsAndPlans}
          />
        );
      case 3:
        // Subscription selection
        return (
          <Step3SelectSubscription 
            selectedPlan={selectedPlanId}
            onPlanSelect={handlePlanSelect}
            plans={availablePlans}
            isLoadingPlans={isLoadingPlans}
            loadError={plansLoadError}
            onRetryLoad={fetchProductsAndPlans}
          />
        );
      case 4:
        // Preview - show order summary before payment
        return (
          <Step4Preview 
            formData={formData}
            selectedPackage={selectedPackage}
            selectedPlan={selectedPlan}
          />
        );
      case 5:
        // Payment collection
        return (
          <Step5Payment 
            formData={formData}
            selectedPlanId={selectedPlanId}
            plans={availablePlans}
            selectedPackage={selectedPackage}
            onConfirmPayment={handlePaymentQrScan}
            isProcessing={isProcessing}
            isScannerOpening={isScannerOpening}
            paymentIncomplete={paymentIncomplete}
            amountPaid={paymentAmountPaid}
            amountExpected={paymentAmountExpected}
            amountRemaining={paymentAmountRemaining}
            inputMode={paymentInputMode}
            setInputMode={setPaymentInputMode}
            paymentId={manualPaymentId}
            setPaymentId={setManualPaymentId}
          />
        );
      case 6:
        // Battery assignment - Uses shared BatteryScanBind component
        // Note: BLE progress/errors are handled by BleProgressModal below
        return (
          <Step6AssignBattery 
            formData={formData}
            selectedPlanId={selectedPlanId}
            onScanBattery={handleScanBattery}
            onDeviceSelect={handleBatteryDeviceSelect}
            detectedDevices={bleScanState.detectedDevices}
            isBleScanning={bleScanState.isScanning}
            onStartScan={hookStartScanning}
            onStopScan={hookStopScanning}
            isScannerOpening={isScannerOpening}
            plans={availablePlans}
            subscriptionCode={confirmedSubscriptionCode || subscriptionData?.subscriptionCode || ''}
            scannedBattery={scannedBatteryPending}
            onCompleteService={handleCompleteService}
            isCompletingService={isCompletingService}
            onRescanBattery={handleRescanBattery}
            rate={customerRate}
            currencySymbol={customerCurrencySymbol}
            customerIdentified={customerIdentified}
            identificationStatus={identificationStatus}
            identificationRetryCount={identificationRetryCount}
            identificationError={identificationError}
            onRetryIdentification={retryIdentification}
          />
        );
      case 7:
        // Success - Show receipt with all purchases
        return (
          <Step7Success 
            formData={formData}
            selectedPlanId={selectedPlanId}
            battery={assignedBattery}
            registrationId={registrationId}
            paymentReference={paymentReference}
            plans={availablePlans}
            selectedPackage={selectedPackage}
            subscriptionCode={confirmedSubscriptionCode || subscriptionData?.subscriptionCode}
            amountPaid={paymentAmountPaid}
          />
        );
      default:
        return null;
    }
  };

  // NOTE: cancelBleOperation is defined above (delegates to hookCancelOperation)

  return (
    <div className="sales-flow-container">
      <div className="sales-bg-gradient" />
      
      {/* Header with Back + Logo on left, Language Toggle on right */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToRoles}
              aria-label={t('sales.changeRole')}
              title={t('sales.changeRole')}
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

      {/* MQTT Reconnection Banner - shows when connection is lost */}
      <div className="px-4 pt-2">
        <MqttReconnectBanner />
      </div>

      {/* Timeline */}
      <SalesTimeline 
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        onStepClick={handleStepClick}
      />

      {/* Main Content */}
      <main className="sales-main">
        {renderStepContent()}
      </main>

      {/* Action Bar - disabled in manual payment mode since user should use the CTA in content area */}
      {/* Complete Service button is disabled on step 6 if customer is not identified (required for pricing) */}
      <SalesActionBar
        currentStep={currentStep}
        onBack={handleBack}
        onMainAction={handleMainAction}
        isLoading={isProcessing || isCreatingCustomer || isCompletingService}
        paymentInputMode={paymentInputMode}
        isDisabled={currentStep === 6 && !!scannedBatteryPending && !customerIdentified}
        hasBatteryScanned={!!scannedBatteryPending}
        customerIdentified={customerIdentified}
        isIdentifying={isIdentifying}
      />

      {/* Loading Overlay - Simple overlay for non-BLE operations (customer registration, processing) */}
      {(isCreatingCustomer || isProcessing) && 
       !bleScanState.isConnecting && 
       !bleScanState.isReadingEnergy && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {isCreatingCustomer 
              ? 'Registering customer...' 
              : 'Processing...'}
          </div>
        </div>
      )}

      {/* Resume Session Prompt - Shows when there's a saved session from a previous attempt */}
      {showResumePrompt && savedSessionSummary && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="resume-session-modal">
            <div className="resume-session-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h3 className="resume-session-title">Resume Previous Session?</h3>
            <p className="resume-session-description">
              You have an incomplete registration for:
            </p>
            <div className="resume-session-details">
              <div className="resume-session-customer">
                {savedSessionSummary.customerName}
              </div>
              <div className="resume-session-meta">
                Step {savedSessionSummary.step} of 5 • Saved {savedSessionSummary.savedAt}
              </div>
            </div>
            <div className="resume-session-actions">
              <button 
                className="resume-session-btn resume-session-btn-primary"
                onClick={restoreSession}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Resume
              </button>
              <button 
                className="resume-session-btn resume-session-btn-secondary"
                onClick={discardSession}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Start New
              </button>
            </div>
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
