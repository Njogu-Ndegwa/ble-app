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
import { BleProgressModal } from '@/components/shared';

// Import Odoo API functions
import {
  registerCustomer,
  getSubscriptionProducts,
  purchaseMultiProducts,
  initiatePayment,
  confirmPaymentManual,
  getCycleUnitFromPeriod,
  DEFAULT_COMPANY_ID,
  type SubscriptionProduct,
  type ProductOrderItem,
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

// MQTT Configuration for service completion reporting
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

// Salesperson station info (similar to attendant)
const SALESPERSON_STATION = "STATION_001";

interface SalesFlowProps {
  onBack?: () => void;
  onLogout?: () => void;
}

export default function SalesFlow({ onBack, onLogout }: SalesFlowProps) {
  const router = useRouter();
  const { bridge, isBridgeReady } = useBridge();
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

  // Physical products from Odoo API (main_service category - bikes, tuks, etc.) - kept for reference
  const [availableProducts, setAvailableProducts] = useState<ProductData[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);
  
  // Product selection (physical product like bikes) - kept for backward compatibility
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Packages from Odoo API (product + privilege bundled) - NEW main selection
  const [availablePackages, setAvailablePackages] = useState<PackageData[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [packagesLoadError, setPackagesLoadError] = useState<string | null>(null);
  
  // Package selection (product + privilege bundled)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  
  // Subscription plans from Odoo API - no fallback, Odoo is source of truth
  const [availablePlans, setAvailablePlans] = useState<PlanData[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansLoadError, setPlansLoadError] = useState<string | null>(null);
  
  // Plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

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
  
  // Service completion states
  const [isCompletingService, setIsCompletingService] = useState(false);
  const [isMqttConnected, setIsMqttConnected] = useState(false);
  const [serviceCompletionError, setServiceCompletionError] = useState<string | null>(null);
  
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
      toast.success(`Battery ${battery.shortId || battery.id} scanned! Click "Complete Service" to finalize.`);
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
  const cancelBleOperation = useCallback(() => {
    hookCancelOperation();
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

      // Wrap init in try-catch to handle case where BridgeContext already called init()
      try {
        window.WebViewJavascriptBridge.init((message: any, responseCallback: (response: any) => void) => {
          responseCallback({ success: true });
        });
      } catch (err) {
        // Bridge was already initialized by BridgeContext - this is expected
      }

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

      // Setup MQTT connection for service completion reporting
      // Generate unique client ID
      const generateClientId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `salesperson-${timestamp}-${random}`;
      };

      // Register MQTT connection callback
      window.WebViewJavascriptBridge.registerHandler(
        'connectMqttCallBack',
        (data: string, resp: (response: any) => void) => {
          try {
            const p = typeof data === 'string' ? JSON.parse(data) : data;
            if (p?.connected || p?.respCode === '200' || p?.success === true) {
              setIsMqttConnected(true);
            } else {
              console.warn('MQTT connection callback received, status unclear:', p);
              // Assume connected if we got a callback
              setIsMqttConnected(true);
            }
          } catch (e) {
            console.warn('MQTT callback parse error, assuming connected');
            setIsMqttConnected(true);
          }
          resp({ received: true });
        }
      );

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

      // Connect to MQTT broker
      const mqttConfig: MqttConfig = {
        username: 'Admin',
        password: '7xzUV@MT',
        clientId: generateClientId(),
        hostname: 'mqtt.omnivoltaic.com',
        port: 1883,
        protocol: 'mqtt',
        clean: true,
        connectTimeout: 40000,
        reconnectPeriod: 1000,
      };

      window.WebViewJavascriptBridge.callHandler(
        'connectMqtt',
        mqttConfig,
        (resp: string) => {
            try {
              const p = typeof resp === 'string' ? JSON.parse(resp) : resp;
              if (p.respCode !== '200' && p.success !== true && p.respData !== true) {
                console.warn('MQTT connection response:', p);
              }
            } catch (err) {
              console.error('Error parsing MQTT connect response:', err);
            }
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

  // Fetch products and subscription plans from Odoo API - no fallback, Odoo is source of truth
  // Uses the salesperson's employee token to filter by their company
  const fetchProductsAndPlans = useCallback(async () => {
    setIsLoadingProducts(true);
    setIsLoadingPlans(true);
    setIsLoadingPackages(true);
    setProductsLoadError(null);
    setPlansLoadError(null);
    setPackagesLoadError(null);
    
    try {
      // Get the salesperson's employee token to filter by company
      const employeeToken = getEmployeeToken();
      
      if (!employeeToken) {
        console.warn('No employee token found - products/plans may not be filtered by company');
      }
      
      // Pass the token to filter products by company
      const response = await getSubscriptionProducts(1, 50, employeeToken || undefined);
      
      if (response.success && response.data) {
        // Extract physical products (main_service category - bikes, tuks, etc.)
        if (response.data.mainServiceProducts && response.data.mainServiceProducts.length > 0) {
          const products: ProductData[] = response.data.mainServiceProducts.map((product: SubscriptionProduct) => ({
            id: product.id.toString(),
            odooProductId: product.id,
            name: product.name,
            description: product.description || '',
            price: product.list_price,
            currency: product.currency_name,
            currencySymbol: product.currencySymbol,
            imageUrl: product.image_url || null,  // Cloudinary URL
            categoryName: product.category_name || '',
            defaultCode: product.default_code || '',
          }));
          
          setAvailableProducts(products);
          setProductsLoadError(null);
          
          // Set default selected product to first product only if not already set
          if (products.length > 0) {
            setSelectedProductId(prev => prev || products[0].id);
          }
          
          console.log('Fetched physical products from Odoo:', products);
        } else {
          setProductsLoadError('No physical products available');
          setAvailableProducts([]);
        }
        
        // Extract packages (product + privilege bundled)
        if (response.data.packageProducts && response.data.packageProducts.length > 0) {
          const packages: PackageData[] = response.data.packageProducts
            .filter((pkg: any) => pkg.is_package && pkg.components && pkg.components.length > 0)
            .map((pkg: any) => {
              // Find main product and battery swap privilege from components
              const mainProduct = pkg.components?.find((c: any) => c.is_main_service);
              const batterySwapPrivilege = pkg.components?.find((c: any) => c.is_battery_swap);
              
              return {
                id: pkg.id.toString(),
                odooPackageId: pkg.id,
                name: pkg.name,
                description: pkg.description || '',
                price: pkg.list_price,
                currency: pkg.currency_name,
                currencySymbol: pkg.currencySymbol,
                imageUrl: pkg.image_url || mainProduct?.image_url || null,
                defaultCode: pkg.default_code || '',
                isPackage: true,
                componentCount: pkg.component_count || pkg.components?.length || 0,
                components: (pkg.components || []).map((c: any): PackageComponent => ({
                  id: c.id,
                  name: c.name,
                  default_code: c.default_code || '',
                  description: c.description || '',
                  list_price: c.list_price,
                  price_unit: c.price_unit,
                  quantity: c.quantity,
                  currency_id: c.currency_id,
                  currency_name: c.currency_name,
                  currencySymbol: c.currencySymbol,
                  category_id: c.category_id,
                  category_name: c.category_name,
                  image_url: c.image_url,
                  is_main_service: c.is_main_service || false,
                  is_battery_swap: c.is_battery_swap || false,
                })),
                mainProduct: mainProduct ? {
                  id: mainProduct.id,
                  name: mainProduct.name,
                  default_code: mainProduct.default_code || '',
                  description: mainProduct.description || '',
                  list_price: mainProduct.list_price,
                  price_unit: mainProduct.price_unit,
                  quantity: mainProduct.quantity,
                  currency_id: mainProduct.currency_id,
                  currency_name: mainProduct.currency_name,
                  currencySymbol: mainProduct.currencySymbol,
                  category_id: mainProduct.category_id,
                  category_name: mainProduct.category_name,
                  image_url: mainProduct.image_url,
                  is_main_service: true,
                  is_battery_swap: false,
                } : undefined,
                batterySwapPrivilege: batterySwapPrivilege ? {
                  id: batterySwapPrivilege.id,
                  name: batterySwapPrivilege.name,
                  default_code: batterySwapPrivilege.default_code || '',
                  description: batterySwapPrivilege.description || '',
                  list_price: batterySwapPrivilege.list_price,
                  price_unit: batterySwapPrivilege.price_unit,
                  quantity: batterySwapPrivilege.quantity,
                  currency_id: batterySwapPrivilege.currency_id,
                  currency_name: batterySwapPrivilege.currency_name,
                  currencySymbol: batterySwapPrivilege.currencySymbol,
                  category_id: batterySwapPrivilege.category_id,
                  category_name: batterySwapPrivilege.category_name,
                  image_url: batterySwapPrivilege.image_url,
                  is_main_service: false,
                  is_battery_swap: true,
                } : undefined,
              };
            });
          
          setAvailablePackages(packages);
          setPackagesLoadError(null);
          
          // Set default selected package to first package only if not already set (e.g., from session restore)
          if (packages.length > 0) {
            setSelectedPackageId(prev => prev || packages[0].id);
          }
          
          console.log('Fetched packages from Odoo:', packages);
        } else {
          setPackagesLoadError('No packages available');
          setAvailablePackages([]);
        }
        
        // Extract subscription plans
        if (response.data.products && response.data.products.length > 0) {
          const plans: PlanData[] = response.data.products.map((product: SubscriptionProduct) => ({
            id: product.id.toString(),
            odooProductId: product.id,
            name: product.name,
            description: product.description || '',
            price: product.list_price,
            period: '', // Will be determined from name
            currency: product.currency_name,
            currencySymbol: product.currencySymbol,
          }));
          
          setAvailablePlans(plans);
          setPlansLoadError(null);
          
          // Set default selected plan to first plan only if not already set (e.g., from session restore)
          if (plans.length > 0) {
            setSelectedPlanId(prev => prev || plans[0].id);
          }
          
          console.log('Fetched subscription plans from Odoo:', plans);
        } else {
          setPlansLoadError('No subscription plans available');
          setAvailablePlans([]);
        }
      } else {
        setProductsLoadError('Failed to load products');
        setPlansLoadError('Failed to load subscription plans');
        setPackagesLoadError('Failed to load packages');
        setAvailableProducts([]);
        setAvailablePlans([]);
        setAvailablePackages([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch products/plans:', error);
      const errorMessage = error.message || 'Failed to load data from server';
      setProductsLoadError(errorMessage);
      setPlansLoadError(errorMessage);
      setPackagesLoadError(errorMessage);
      setAvailableProducts([]);
      setAvailablePlans([]);
      setAvailablePackages([]);
      toast.error('Could not load products from server');
    } finally {
      setIsLoadingProducts(false);
      setIsLoadingPlans(false);
      setIsLoadingPackages(false);
    }
  }, []);

  // Fetch products and plans on mount
  useEffect(() => {
    fetchProductsAndPlans();
  }, [fetchProductsAndPlans]);

  // Validate form data - fields required by Odoo /api/auth/register
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CustomerFormData, string>> = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^[\+]?[\s\d\-\(\)]{10,}$/.test(formData.phone)) {
      errors.phone = 'Invalid phone number';
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
      
      // Format phone number - ensure it starts with country code
      let phoneNumber = formData.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '254' + phoneNumber.slice(1);
      } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('254')) {
        phoneNumber = '254' + phoneNumber;
      }
      phoneNumber = phoneNumber.replace('+', '');

      const registrationPayload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: phoneNumber,
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
      };

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
    paymentRequestOrderId
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

  // Handle battery scan
  const handleScanBattery = useCallback(() => {
    console.info('[SALES BATTERY] Step 0: handleScanBattery called - user clicked scan button');
    console.info('[SALES BATTERY] Step 0a: Setting scanType to "battery"');
    scanTypeRef.current = 'battery';
    console.info('[SALES BATTERY] Step 0b: Calling startQrCodeScan...');
    startQrCodeScan();
  }, [startQrCodeScan]);

  // Handle service completion - reports first battery assignment to backend via MQTT
  // This is for first-time customer with quota (promotional first battery)
  // Following the Attendant workflow pattern for customers with available quota
  const handleCompleteService = useCallback(async () => {
    if (!scannedBatteryPending) {
      toast.error('No battery scanned');
      return;
    }

    // Get the subscription ID (subscription_code) - this is used as plan_id in the topic and payload
    // This matches the Attendant workflow where dynamicPlanId is the subscription_code from QR scan
    const subscriptionId = confirmedSubscriptionCode || subscriptionData?.subscriptionCode;
    if (!subscriptionId) {
      toast.error('No subscription found. Please complete payment first.');
      return;
    }

    // Get salesperson info (similar to attendant info)
    const employeeUser = getEmployeeUser();
    const salespersonId = employeeUser?.id?.toString() || 'salesperson-001';
    
    setIsCompletingService(true);
    setServiceCompletionError(null); // Clear any previous error

    // Generate correlation ID for tracking
    const correlationId = `sales-svc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Calculate energy transferred in kWh (energy is stored in Wh)
    const energyTransferred = scannedBatteryPending.energy / 1000;

    // Use the FULL battery ID from QR scan - not truncated
    const fullBatteryId = scannedBatteryPending.id;

    console.info('[SALES SERVICE] Building payment_and_service payload:');
    console.info('[SALES SERVICE] - Subscription ID:', subscriptionId);
    console.info('[SALES SERVICE] - Full Battery ID:', fullBatteryId);
    console.info('[SALES SERVICE] - Energy (kWh):', energyTransferred);

    // Build the REPORT_PAYMENT_AND_SERVICE_COMPLETION payload
    // This follows the Attendant workflow quota-based pattern:
    // - No payment_data needed (customer has available quota from purchase)
    // - Only service_data with the new battery assignment
    const paymentAndServicePayload = {
      timestamp: new Date().toISOString(),
      plan_id: subscriptionId,  // Using subscription ID as plan_id (matches Attendant flow)
      correlation_id: correlationId,
      actor: { 
        type: "attendant",  // Using attendant type as backend expects this
        id: salespersonId 
      },
      data: {
        action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
        attendant_station: SALESPERSON_STATION,
        service_data: {
          new_battery_id: fullBatteryId,  // Full battery ID from QR scan
          energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
          service_duration: 240,
        },
      },
    };

    // Topic uses subscription ID (same pattern as Attendant workflow)
    const requestTopic = `emit/uxi/attendant/plan/${subscriptionId}/payment_and_service`;
    const responseTopic = `echo/abs/attendant/plan/${subscriptionId}/payment_and_service`;
    
    console.info('[SALES SERVICE] Request topic:', requestTopic);
    console.info('[SALES SERVICE] Response topic:', responseTopic);
    console.info('[SALES SERVICE] Correlation ID:', correlationId);
    console.info('[SALES SERVICE] Payload:', JSON.stringify(paymentAndServicePayload, null, 2));

    // Store correlation ID for response matching
    (window as any).__serviceCompletionCorrelationId = correlationId;

    // Track if we've already processed the response
    let responseProcessed = false;

    // Set a timeout for service completion (30 seconds)
    const timeoutId = setTimeout(() => {
      if (responseProcessed) return;
      responseProcessed = true;
      console.error('[SALES SERVICE] Service completion timed out after 30 seconds');
      toast.error('Request timed out. Please try again.');
      setServiceCompletionError('Service completion timed out');
      setIsCompletingService(false);
    }, 30000);

    // Function to finalize the service after successful confirmation
    const finalizeServiceCompletion = () => {
      clearTimeout(timeoutId);
      
      // Move battery from pending to assigned
      setAssignedBattery(scannedBatteryPending);
      setScannedBatteryPending(null);
      setRegistrationId(generateRegistrationId());
      
      // Clear session since registration is complete
      clearSalesSession();
      
      toast.success('Service completed! Battery assigned successfully.');
      setIsCompletingService(false);
      advanceToStep(7);
    };

    // Function to handle service completion failure
    const handleServiceError = (errorMsg: string, actionRequired?: string) => {
      clearTimeout(timeoutId);
      const fullErrorMsg = actionRequired ? `${errorMsg}. ${actionRequired}` : errorMsg;
      console.error('[SALES SERVICE] Service completion failed:', fullErrorMsg);
      toast.error(fullErrorMsg);
      setServiceCompletionError(fullErrorMsg);
      setIsCompletingService(false);
      // Don't advance to step 7 - stay on battery assignment step
    };

    // Subscribe to response topic and register handler
    if (window.WebViewJavascriptBridge) {
      // Register handler for MQTT response BEFORE subscribing
      window.WebViewJavascriptBridge.registerHandler(
        'mqttMsgArrivedCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const parsedMqttData = JSON.parse(data);
            const topic = parsedMqttData.topic;
            const rawMessageContent = parsedMqttData.message;

            console.info('[SALES SERVICE] MQTT Message Arrived');
            console.info('[SALES SERVICE] Received topic:', topic);
            console.info('[SALES SERVICE] Expected topic:', responseTopic);

            // Check if this is our response topic
            if (topic === responseTopic) {
              console.info('[SALES SERVICE] ✅ Topic MATCHED! Processing service completion response');
              console.info('[SALES SERVICE] Response data:', JSON.stringify(parsedMqttData, null, 2));

              let responseData: any;
              try {
                responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
              } catch {
                responseData = rawMessageContent;
              }

              // Check correlation ID
              const storedCorrelationId = (window as any).__serviceCompletionCorrelationId;
              const responseCorrelationId = responseData?.correlation_id;

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches && !responseProcessed) {
                responseProcessed = true;
                
                const success = responseData?.data?.success ?? false;
                const signals = responseData?.data?.signals || [];
                const metadata = responseData?.data?.metadata || {};

                console.info('[SALES SERVICE] Response - success:', success, 'signals:', signals);

                // Check for error signals - these indicate failure even if success is true
                // Backend may return success:true with error signals for validation failures
                const errorSignals = [
                  'SERVICE_COMPLETION_FAILED',
                  'QUOTA_EXHAUSTED',
                  'SERVICE_REJECTED',
                  'TOPUP_REQUIRED',
                  'BATTERY_MISMATCH',
                  'ASSET_VALIDATION_FAILED',
                  'SECURITY_ALERT',
                  'VALIDATION_FAILED',
                  'PAYMENT_FAILED',
                  'RATE_LIMIT_EXCEEDED'
                ];
                const hasErrorSignal = signals.some((signal: string) => errorSignals.includes(signal));

                // Check for success signals
                const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
                const hasServiceCompletedSignal = signals.includes('SERVICE_COMPLETED');
                const hasAssetSignals = signals.includes('ASSET_RETURNED') || signals.includes('ASSET_ALLOCATED');

                const hasSuccessSignal = success === true &&
                  !hasErrorSignal &&
                  Array.isArray(signals) &&
                  (isIdempotent || hasServiceCompletedSignal || hasAssetSignals);

                if (hasErrorSignal) {
                  // Error signals present - treat as failure regardless of success flag
                  console.error('[SALES SERVICE] Failed with error signals:', signals);
                  const errorMsg = metadata?.reason || metadata?.message || metadata?.service_result?.reason || responseData?.data?.error || 'Service completion failed';
                  const actionRequired = metadata?.action_required || metadata?.service_result?.action_required;
                  
                  // Provide specific error messages for common error types
                  let userFriendlyError = errorMsg;
                  if (signals.includes('QUOTA_EXHAUSTED') || signals.includes('TOPUP_REQUIRED')) {
                    userFriendlyError = 'Customer quota exhausted. Payment required before service can proceed.';
                  } else if (signals.includes('SERVICE_REJECTED')) {
                    userFriendlyError = metadata?.service_result?.reason || 'Service was rejected. Please check customer quota.';
                  }
                  
                  handleServiceError(userFriendlyError, actionRequired);
                  
                  // Clear the correlation ID
                  (window as any).__serviceCompletionCorrelationId = null;
                } else if (hasSuccessSignal) {
                  console.info('[SALES SERVICE] Completed successfully!', isIdempotent ? '(idempotent)' : '');
                  
                  // Clear the correlation ID
                  (window as any).__serviceCompletionCorrelationId = null;
                  
                  finalizeServiceCompletion();
                } else if (success && signals.length === 0) {
                  // Success without any signals - treat as generic success
                  console.info('[SALES SERVICE] Completed (generic success, no signals)');
                  
                  // Clear the correlation ID
                  (window as any).__serviceCompletionCorrelationId = null;
                  
                  finalizeServiceCompletion();
                } else {
                  // Response received but not successful or has unknown signals
                  console.error('[SALES SERVICE] Failed - success:', success, 'signals:', signals);
                  const errorMsg = metadata?.reason || metadata?.message || responseData?.data?.error || 'Failed to complete service';
                  handleServiceError(errorMsg);
                  
                  // Clear the correlation ID
                  (window as any).__serviceCompletionCorrelationId = null;
                }
              }
            }
            responseCallback({});
          } catch (err) {
            console.error('[SALES SERVICE] Error processing MQTT response:', err);
          }
        }
      );

      // Subscribe to response topic
      window.WebViewJavascriptBridge.callHandler(
        'mqttSubTopic',
        { topic: responseTopic, qos: 1 },
        (subscribeResponse: string) => {
          try {
            const subResp = typeof subscribeResponse === 'string'
              ? JSON.parse(subscribeResponse)
              : subscribeResponse;

            if (subResp?.respCode === '200') {
              console.info('[SALES SERVICE] ✅ Successfully subscribed to response topic:', responseTopic);

              // Wait a moment after subscribe before publishing
              setTimeout(() => {
                try {
                  console.info('[SALES SERVICE] Publishing service completion request...');
                  window.WebViewJavascriptBridge?.callHandler(
                    'mqttPublishMsg',
                    JSON.stringify({
                      topic: requestTopic,
                      qos: 0,
                      content: paymentAndServicePayload,
                    }),
                    (publishResponse: any) => {
                      console.info('[SALES SERVICE] Publish callback received:', publishResponse);
                      try {
                        const pubResp = typeof publishResponse === 'string'
                          ? JSON.parse(publishResponse)
                          : publishResponse;

                        if (pubResp?.error || pubResp?.respCode !== '200') {
                          console.error('[SALES SERVICE] Failed to publish:', pubResp?.respDesc || pubResp?.error);
                          if (!responseProcessed) {
                            responseProcessed = true;
                            handleServiceError('Failed to send request. Please try again.');
                          }
                        } else {
                          console.info('[SALES SERVICE] Request published, waiting for backend response...');
                          // Do NOT assume success - we must wait for the actual response
                        }
                      } catch (err) {
                        console.error('[SALES SERVICE] Error parsing publish response:', err);
                        if (!responseProcessed) {
                          responseProcessed = true;
                          handleServiceError('Error sending request. Please try again.');
                        }
                      }
                    }
                  );
                } catch (err) {
                  console.error('[SALES SERVICE] Exception calling publish:', err);
                  if (!responseProcessed) {
                    responseProcessed = true;
                    handleServiceError('Error sending request. Please try again.');
                  }
                }
              }, 300);
            } else {
              console.error('[SALES SERVICE] Failed to subscribe:', subResp?.respDesc || subResp?.error);
              if (!responseProcessed) {
                responseProcessed = true;
                handleServiceError('Failed to connect. Please try again.');
              }
            }
          } catch (err) {
            console.error('[SALES SERVICE] Error parsing subscribe response:', err);
            if (!responseProcessed) {
              responseProcessed = true;
              handleServiceError('Error connecting. Please try again.');
            }
          }
        }
      );
    } else {
      // No bridge available - show error (can't complete service without MQTT)
      console.error('[SALES SERVICE] No bridge available - cannot complete service');
      handleServiceError('Connection not available. Please restart the app.');
    }
  }, [
    scannedBatteryPending, 
    confirmedSubscriptionCode, 
    subscriptionData, 
    advanceToStep
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
        setIsCompletingService(false);
        setServiceCompletionError(null);
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
  // Get selected package object for preview
  const selectedPackage = availablePackages.find(p => p.id === selectedPackageId) || null;
  // Get selected plan object for preview
  const selectedPlan = availablePlans.find(p => p.id === selectedPlanId) || null;

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
        // Battery assignment
        return (
          <Step6AssignBattery 
            formData={formData}
            selectedPlanId={selectedPlanId}
            onScanBattery={handleScanBattery}
            isBleScanning={bleScanState.isScanning}
            detectedDevicesCount={bleScanState.detectedDevices.length}
            isScannerOpening={isScannerOpening}
            plans={availablePlans}
            subscriptionCode={confirmedSubscriptionCode || subscriptionData?.subscriptionCode || ''}
            scannedBattery={scannedBatteryPending}
            onCompleteService={handleCompleteService}
            isCompletingService={isCompletingService}
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
      <SalesActionBar
        currentStep={currentStep}
        onBack={handleBack}
        onMainAction={handleMainAction}
        isLoading={isProcessing || isCreatingCustomer}
        paymentInputMode={paymentInputMode}
        isDisabled={false}
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
