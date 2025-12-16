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
  Step6ScanVehicle,
  Step7AssignBattery,
  Step8Success,
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
import { useSalesCustomerIdentification, type IdentificationStatus } from '@/lib/hooks/useSalesCustomerIdentification';
import type { ServiceState } from '@/lib/hooks/useCustomerIdentification';
import { usePaymentAndService, useVehicleAssignment, type PublishPaymentAndServiceParams } from '@/lib/services/hooks';
import { BleProgressModal, MqttReconnectBanner, NetworkStatusBanner, SessionResumePrompt } from '@/components/shared';
import { PAYMENT } from '@/lib/constants';
import { calculateSwapPayment } from '@/lib/swap-payment';

// Import workflow session management
import {
  useWorkflowSession,
  buildSalesSessionData,
  extractSalesStateFromSession,
  type SalesWorkflowState,
} from '@/lib/hooks/useWorkflowSession';
import type { WorkflowSessionData } from '@/lib/odoo-api';

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
// Note: Attendant and Sales are now separate roles with separate sessions
import { getSalesRoleToken, clearSalesRoleLogin, getSalesRoleUser } from '@/lib/attendant-auth';

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

  // Vehicle data - scanned vehicle ID from QR code
  const [scannedVehicleId, setScannedVehicleId] = useState<string | null>(null);
  
  // Battery data
  const [assignedBattery, setAssignedBattery] = useState<BatteryData | null>(null);
  
  // NEW: Scanned battery pending service completion (battery scanned but service not yet reported)
  const [scannedBatteryPending, setScannedBatteryPending] = useState<BatteryData | null>(null);
  
  // Customer identification state is now managed by useSalesCustomerIdentification hook
  // (removed local state - see hook initialization below)
  
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

  // Customer identification hook with automatic retry - gets unit price (rate) from backend
  // Uses silent retries with exponential backoff; manual retry shows feedback like Attendant flow
  const {
    identifyCustomer,
    cancelIdentification,
    manualRetry: manualIdentifyCustomer,
    reset: resetCustomerIdentification,
    // State
    status: identificationStatus,
    isIdentifying,
    isIdentified: customerIdentified,
    hasFailed: identificationFailed,
    retryCount: identificationRetryCount,
    lastError: identificationError,
    // Extracted values
    rate: customerRate,
    currencySymbol: customerCurrencySymbol,
    serviceStates: customerServiceStates,
  } = useSalesCustomerIdentification({
    bridge: bridge as any,
    isBridgeReady,
    isMqttConnected,
    attendantInfo: {
      id: `salesperson-${getSalesRoleUser()?.id || '001'}`,
      station: SALESPERSON_STATION,
    },
    maxRetries: 3,  // Retry up to 3 times with exponential backoff
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
      
      advanceToStep(8);
      toast.success(isIdempotent ? 'Service completed! (already recorded)' : 'Service completed! Battery assigned successfully.');
    },
    onError: (errorMsg) => {
      console.error('[SALES] Payment and service failed:', errorMsg);
      toast.error(errorMsg);
    },
  });
  
  // Track if service completion is in progress
  const isCompletingService = paymentAndServiceStatus === 'pending';
  
  // Vehicle assignment hook - assigns scanned vehicle to customer subscription
  const {
    assignVehicle,
    status: vehicleAssignmentStatus,
    reset: resetVehicleAssignment,
    isLoading: isAssigningVehicle,
  } = useVehicleAssignment({
    onSuccess: (isIdempotent) => {
      console.info('[SALES] Vehicle assigned successfully!', isIdempotent ? '(idempotent)' : '');
      toast.success(isIdempotent 
        ? (t('sales.vehicleAlreadyAssigned') || 'Vehicle already assigned!') 
        : (t('sales.vehicleAssigned') || 'Vehicle assigned successfully!'));
    },
    onError: (errorMsg) => {
      console.error('[SALES] Vehicle assignment failed:', errorMsg);
      toast.error(errorMsg || t('sales.vehicleAssignFailed') || 'Failed to assign vehicle. Please try again.');
      // Clear the scanned vehicle ID so user can try again
      setScannedVehicleId(null);
    },
  });

  // Scan type tracking (payment and vehicle still need manual tracking)
  const scanTypeRef = useRef<'battery' | 'payment' | 'vehicle' | null>(null);

  // Bridge initialization ref
  const bridgeInitRef = useRef<boolean>(false);

  // ============================================
  // WORKFLOW SESSION MANAGEMENT HOOK (Backend Persistence)
  // ============================================
  
  const {
    status: sessionStatus,
    orderId: sessionOrderId,
    pendingSession,
    createSalesSession,
    updateSession,
    updateSessionWithProducts,
    restoreSession: restoreBackendSession,
    discardPendingSession,
    clearSession,
    setOrderId: setSessionOrderId,
    checkForPendingSession,
    isLoading: isSessionLoading,
  } = useWorkflowSession({
    workflowType: 'salesperson',
    onSessionRestored: (sessionData, orderId) => {
      console.info('[SalesFlow] Session restored from backend:', { orderId, step: sessionData.currentStep });
      
      // Extract state from session data and restore
      const restoredState = extractSalesStateFromSession(sessionData);
      
      // Restore all state from the session
      setCurrentStep(restoredState.currentStep as SalesStep);
      setMaxStepReached(restoredState.maxStepReached as SalesStep);
      setFormData(restoredState.formData);
      setSelectedPackageId(restoredState.selectedPackageId);
      setSelectedPlanId(restoredState.selectedPlanId);
      setCreatedCustomerId(restoredState.createdCustomerId);
      setCreatedPartnerId(restoredState.createdPartnerId);
      setCustomerSessionToken(restoredState.customerSessionToken);
      setSubscriptionData(restoredState.subscriptionData);
      setPaymentConfirmed(restoredState.paymentState.confirmed);
      setPaymentReference(restoredState.paymentState.reference);
      setPaymentInitiated(restoredState.paymentState.initiated);
      setPaymentAmountPaid(restoredState.paymentState.amountPaid);
      setPaymentAmountExpected(restoredState.paymentState.amountExpected);
      setPaymentAmountRemaining(restoredState.paymentState.amountRemaining);
      setPaymentIncomplete(restoredState.paymentState.incomplete);
      setPaymentRequestOrderId(restoredState.paymentState.requestOrderId);
      setConfirmedSubscriptionCode(restoredState.confirmedSubscriptionCode);
      setScannedVehicleId(restoredState.scannedVehicleId);
      setScannedBatteryPending(restoredState.scannedBatteryPending);
      setAssignedBattery(restoredState.assignedBattery);
      setRegistrationId(restoredState.registrationId);
      
      // Also clear localStorage session since we're now using backend
      clearSalesSession();
      
      toast.success(`${t('session.sessionRestored') || 'Session restored - continuing from step'} ${restoredState.currentStep}`);
    },
    onError: (error) => {
      console.error('[SalesFlow] Session error:', error);
      // Don't show error toast for session errors - they're non-blocking
    },
  });

  // Session restoration UI state
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
  
  // Legacy localStorage session state (for fallback/migration)
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
  
  // Refs for vehicle assignment (to avoid stale closures in QR callback)
  const assignVehicleRef = useRef<typeof assignVehicle | null>(null);
  const confirmedSubscriptionCodeRef = useRef<string | null>(null);
  const subscriptionDataRef = useRef<typeof subscriptionData>(null);

  // Advance to a new step
  const advanceToStep = useCallback((step: SalesStep) => {
    setCurrentStep(step);
    setMaxStepReached(prev => Math.max(prev, step) as SalesStep);
  }, []);

  // Check for pending session from backend on mount
  useEffect(() => {
    const checkSession = async () => {
      // First check backend for pending session
      const hasPending = await checkForPendingSession();
      if (hasPending) {
        setShowSessionPrompt(true);
      } else {
        // Fallback: check localStorage for legacy session (migration path)
        const summary = getSessionSummary();
        if (summary && !sessionRestored) {
          setSavedSessionSummary(summary);
          setShowResumePrompt(true);
        }
      }
      setSessionCheckComplete(true);
    };
    
    checkSession();
  }, [checkForPendingSession, sessionRestored]);

  // Handle session resume from backend
  const handleResumeSession = useCallback(async () => {
    const sessionData = await restoreBackendSession();
    if (sessionData) {
      setShowSessionPrompt(false);
      setSessionRestored(true);
    }
  }, [restoreBackendSession]);
  
  // Handle discard session from backend
  const handleDiscardSession = useCallback(() => {
    discardPendingSession();
    setShowSessionPrompt(false);
    setSessionRestored(true);
    toast(t('session.startNew') || 'Starting a new registration');
  }, [discardPendingSession, t]);

  // Restore session from localStorage (legacy fallback)
  const restoreLocalSession = useCallback(() => {
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
      // Restore vehicle scan if present
      if (savedSession.scannedVehicleId) {
        setScannedVehicleId(savedSession.scannedVehicleId);
      }
      setAssignedBattery(savedSession.assignedBattery);
      setRegistrationId(savedSession.registrationId);

      setSessionRestored(true);
      // Clear localStorage since we're migrating to backend sessions
      clearSalesSession();
      toast.success(`Resuming from Step ${savedSession.currentStep}`);
    }
    
    setShowResumePrompt(false);
  }, []);

  // Discard saved session and start fresh (legacy localStorage)
  const discardLocalSession = useCallback(() => {
    clearSalesSession();
    setShowResumePrompt(false);
    setSessionRestored(true); // Prevent prompt from appearing again
    toast('Starting a new registration');
  }, []);

  // Helper to build current session state
  const buildCurrentSessionState = useCallback((): SalesWorkflowState => {
    return {
      currentStep,
      maxStepReached,
      actor: {
        id: `salesperson-${getSalesRoleUser()?.id || '001'}`,
        station: SALESPERSON_STATION,
      },
      formData,
      selectedPackageId,
      selectedPlanId,
      createdCustomerId,
      createdPartnerId,
      customerSessionToken,
      subscriptionData,
      paymentState: {
        initiated: paymentInitiated,
        confirmed: paymentConfirmed,
        reference: paymentReference,
        amountPaid: paymentAmountPaid,
        amountExpected: paymentAmountExpected,
        amountRemaining: paymentAmountRemaining,
        incomplete: paymentIncomplete,
        inputMode: paymentInputMode,
        manualPaymentId,
        requestOrderId: paymentRequestOrderId,
      },
      confirmedSubscriptionCode,
      scannedBatteryPending,
      assignedBattery,
      customerIdentification: {
        identified: customerIdentified,
        rate: customerRate,
        currencySymbol: customerCurrencySymbol,
      },
      scannedVehicleId,
      registrationId,
    };
  }, [
    currentStep,
    maxStepReached,
    formData,
    selectedPackageId,
    selectedPlanId,
    createdCustomerId,
    createdPartnerId,
    customerSessionToken,
    subscriptionData,
    paymentInitiated,
    paymentConfirmed,
    paymentReference,
    paymentAmountPaid,
    paymentAmountExpected,
    paymentAmountRemaining,
    paymentIncomplete,
    paymentInputMode,
    manualPaymentId,
    paymentRequestOrderId,
    confirmedSubscriptionCode,
    scannedBatteryPending,
    assignedBattery,
    customerIdentified,
    customerRate,
    customerCurrencySymbol,
    scannedVehicleId,
    registrationId,
  ]);

  // Helper to save session to backend
  const saveSessionToBackend = useCallback(async () => {
    if (!sessionOrderId) {
      console.info('[SalesFlow] No session orderId - skipping backend session save');
      return;
    }
    
    const sessionData = buildSalesSessionData(buildCurrentSessionState());
    await updateSession(sessionData);
  }, [sessionOrderId, buildCurrentSessionState, updateSession]);

  // Auto-save session on step transitions (after state has updated)
  // This ensures the backend has the latest data for session recovery
  const prevStepRef = useRef<number>(currentStep);
  useEffect(() => {
    // Skip if no session, step hasn't changed, or still on step 1 without customer
    if (!sessionOrderId || currentStep === prevStepRef.current || currentStep < 2) {
      prevStepRef.current = currentStep;
      return;
    }
    
    // When reaching step 8 (success), save the completed state then clear local tracking
    if (currentStep === 8) {
      console.info('[SalesFlow] Workflow completed (step 8) - saving final state and clearing session');
      prevStepRef.current = currentStep;
      
      // Save step 8 to backend with status: 'completed'
      saveSessionToBackend().then(() => {
        clearSession();
      }).catch((err) => {
        console.error('[SalesFlow] Failed to save final session state:', err);
        clearSession();
      });
      return;
    }
    
    console.info(`[SalesFlow] Step changed from ${prevStepRef.current} to ${currentStep} - saving session`);
    prevStepRef.current = currentStep;
    
    // Save session with current state
    saveSessionToBackend();
  }, [currentStep, sessionOrderId, saveSessionToBackend, clearSession]);

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
            } else if (scanTypeRef.current === 'vehicle') {
              console.info('[SALES QR] Step 2: Detected as vehicle scan');
              // Vehicle QR scanned - extract vehicle ID
              let vehicleId = qrVal;
              try {
                // Try to parse as JSON first (structured vehicle data)
                const vehicleData = JSON.parse(qrVal);
                vehicleId = vehicleData.vehicle_id || vehicleData.id || vehicleData.vin || qrVal;
                console.info('[SALES QR] Step 2a: Parsed vehicle QR as JSON, extracted ID:', vehicleId);
              } catch {
                // If not JSON, treat the entire string as vehicle ID
                console.info('[SALES QR] Step 2a: Vehicle QR is plain text:', vehicleId);
              }
              // Store the vehicle ID and call backend to assign
              if (vehicleId) {
                console.info('[SALES QR] Step 2b: Setting scanned vehicle ID:', vehicleId);
                setScannedVehicleId(vehicleId);
                toast.success(`Vehicle ${vehicleId} scanned!`);
                
                // Get the subscription code for vehicle assignment
                const subCode = confirmedSubscriptionCodeRef.current || subscriptionDataRef.current?.subscriptionCode;
                if (subCode) {
                  console.info('[SALES QR] Step 2c: Assigning vehicle to subscription:', subCode);
                  // Call the backend to assign vehicle - uses ref to avoid stale closure
                  assignVehicleRef.current?.({
                    planId: subCode,
                    vehicleId,
                  });
                } else {
                  console.warn('[SALES QR] Step 2c: No subscription code available for vehicle assignment');
                }
              }
              scanTypeRef.current = null;
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

  // Start BLE scanning when on step 7 (battery assignment)
  useEffect(() => {
    if (currentStep === 7 && bleIsReady) {
      startBleScan();
    } else if (currentStep !== 7) {
      stopBleScan();
    }
    
    return () => {
      stopBleScan();
    };
  }, [currentStep, bleIsReady, startBleScan, stopBleScan]);

  // Auto-navigate to step 7 (battery assignment) when vehicle is scanned on step 6
  // This removes the need for user to click "Continue" after scanning vehicle QR
  useEffect(() => {
    if (currentStep === 6 && scannedVehicleId) {
      console.info('[SALES VEHICLE] Vehicle scanned, auto-advancing to battery assignment step');
      // Small delay to allow toast to show before navigation
      const timer = setTimeout(() => {
        advanceToStep(7);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, scannedVehicleId, advanceToStep]);

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
      const employeeToken = getSalesRoleToken();
      
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
        
        // Create backend session after customer registration
        // This creates an order/session linked to the customer
        try {
          const initialSessionData = buildSalesSessionData({
            currentStep: 2, // Moving to step 2
            maxStepReached: 2,
            actor: {
              id: `salesperson-${getSalesRoleUser()?.id || '001'}`,
              station: SALESPERSON_STATION,
            },
            formData,
            selectedPackageId,
            selectedPlanId,
            createdCustomerId: session.user.id,
            createdPartnerId: session.user.partner_id,
            customerSessionToken: session.token,
            subscriptionData: null,
            paymentState: {
              initiated: false,
              confirmed: false,
              reference: '',
              amountPaid: 0,
              amountExpected: 0,
              amountRemaining: 0,
              incomplete: false,
              inputMode: 'scan',
              manualPaymentId: '',
              requestOrderId: null,
            },
            confirmedSubscriptionCode: null,
            scannedBatteryPending: null,
            assignedBattery: null,
            customerIdentification: {
              identified: false,
              rate: null,
              currencySymbol: null,
            },
            scannedVehicleId: null,
            registrationId: '',
          });
          
          const orderId = await createSalesSession(
            session.user.partner_id, // Use partner_id as customer_id for backend
            DEFAULT_COMPANY_ID,
            initialSessionData
          );
          
          if (orderId) {
            console.info('[SalesFlow] Backend session created with orderId:', orderId);
          }
        } catch (err) {
          console.error('[SalesFlow] Failed to create backend session (non-blocking):', err);
          // Don't block the workflow if session creation fails
        }
        
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
  }, [formData, selectedPackageId, selectedPlanId, createSalesSession]);

  // Purchase subscription after customer is registered
  // Returns object with subscription_code and order_id on success, null on failure
  // 
  // NEW: If we have a backend session (sessionOrderId), we use updateSessionWithProducts
  // to add products to the existing order. Otherwise, we fall back to purchaseMultiProducts.
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
      const employeeToken = getSalesRoleToken();
      
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

      // NEW: If we have a backend session, use updateSessionWithProducts
      // This adds products to the existing order created in Step 1
      if (sessionOrderId) {
        console.log('Using session-based product update for orderId:', sessionOrderId);
        
        // Build session data for the update
        const sessionData = buildSalesSessionData({
          currentStep: 5, // Moving to payment step
          maxStepReached: 5,
          actor: {
            id: `salesperson-${getSalesRoleUser()?.id || '001'}`,
            station: SALESPERSON_STATION,
          },
          formData,
          selectedPackageId,
          selectedPlanId,
          createdCustomerId,
          createdPartnerId,
          customerSessionToken,
          subscriptionData: {
            id: 0, // Will be updated from response
            subscriptionCode: '', // Will be updated from response
            status: 'pending',
            productName: currentSelectedPlan.name,
            priceAtSignup: currentSelectedPlan.price + currentSelectedPackage.price,
            currency: currentSelectedPlan.currency,
            currencySymbol: currentSelectedPlan.currencySymbol,
          },
          paymentState: {
            initiated: false,
            confirmed: false,
            reference: '',
            amountPaid: 0,
            amountExpected: currentSelectedPlan.price + currentSelectedPackage.price,
            amountRemaining: currentSelectedPlan.price + currentSelectedPackage.price,
            incomplete: false,
            inputMode: paymentInputMode,
            manualPaymentId: '',
            requestOrderId: sessionOrderId,
          },
          confirmedSubscriptionCode: null,
          scannedBatteryPending: null,
          assignedBattery: null,
          customerIdentification: {
            identified: customerIdentified,
            rate: customerRate,
            currencySymbol: customerCurrencySymbol,
          },
          scannedVehicleId: null,
          registrationId: '',
        });
        
        // Update session with products
        const success = await updateSessionWithProducts(sessionData, products);
        
        if (success) {
          // Update local state
          const totalPrice = currentSelectedPlan.price + currentSelectedPackage.price;
          
          setSubscriptionData({
            id: 0, // Updated from backend later
            subscriptionCode: '', // Updated from backend later
            status: 'pending',
            productName: currentSelectedPlan.name,
            priceAtSignup: totalPrice,
            currency: currentSelectedPlan.currency,
            currencySymbol: currentSelectedPlan.currencySymbol,
          });
          
          setPaymentRequestOrderId(sessionOrderId);
          setPaymentAmountExpected(totalPrice);
          setPaymentAmountRemaining(totalPrice);
          
          console.log('Products added to order via session update');
          
          return {
            subscriptionCode: '', // Will be populated after payment
            orderId: sessionOrderId,
          };
        } else {
          throw new Error('Failed to add products to order');
        }
      }
      
      // FALLBACK: No session - use the old purchaseMultiProducts flow
      // This creates both the subscription AND the order automatically
      console.log('Using legacy purchaseMultiProducts flow (no session)');
      
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
        
        // Also set the session orderId for future updates
        setSessionOrderId(order.id);
        
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
  }, [
    createdPartnerId, 
    selectedPackageId, 
    availablePackages, 
    selectedPlanId, 
    availablePlans,
    sessionOrderId,
    updateSessionWithProducts,
    setSessionOrderId,
    formData,
    createdCustomerId,
    customerSessionToken,
    paymentInputMode,
    customerIdentified,
    customerRate,
    customerCurrencySymbol,
  ]);

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
    const employeeToken = getSalesRoleToken();
    
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
      const employeeToken = getSalesRoleToken();

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
  
  // Keep vehicle assignment refs in sync
  useEffect(() => {
    assignVehicleRef.current = assignVehicle;
  }, [assignVehicle]);
  
  useEffect(() => {
    confirmedSubscriptionCodeRef.current = confirmedSubscriptionCode;
  }, [confirmedSubscriptionCode]);
  
  useEffect(() => {
    subscriptionDataRef.current = subscriptionData;
  }, [subscriptionData]);

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

  // Handle vehicle scan (QR mode)
  const handleScanVehicle = useCallback(() => {
    console.info('[SALES VEHICLE] handleScanVehicle called - user clicked scan button');
    scanTypeRef.current = 'vehicle';
    startQrCodeScan();
  }, [startQrCodeScan]);

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

    // CRITICAL: Pricing info MUST be fetched before completing service
    // We need the accurate rate from the backend - NEVER use default for Sales workflow
    // Using incorrect pricing leads to wrong billing and customer disputes
    if (!customerIdentified) {
      // Check if identification is in progress
      if (isIdentifying) {
        toast.error(t('sales.waitingForPricing') || 'Please wait, fetching pricing...');
        return;
      }
      
      // If identification failed, prompt for manual retry
      if (identificationFailed) {
        toast.error(t('sales.pricingRequired') || 'Pricing info required. Tap "Fetch Pricing" to retry.');
        return;
      }
      
      // Edge case: not identified and not in progress/failed - trigger identification
      console.warn('[SALES SERVICE] Pricing not yet fetched - triggering fetch...');
      identifyCustomer({
        subscriptionCode: subscriptionId,
        source: 'manual',
      });
      toast.error(t('sales.waitingForPricing') || 'Please wait, fetching pricing...');
      return;
    }

    // CRITICAL: Validate that we have a valid rate from the backend
    // We NEVER use default values for pricing in Sales workflow
    if (!customerRate || customerRate <= 0) {
      console.error('[SALES SERVICE] Invalid rate from customer identification:', customerRate);
      toast.error(t('sales.invalidPricing') || 'Invalid pricing data. Please tap "Fetch Pricing" to retry.');
      return;
    }

    // CRITICAL: Validate that we have an energy service from customer identification
    // We need the energy service ID to report the transaction correctly
    const energyService = customerServiceStates.find(
      (service) => typeof service?.service_id === 'string' && 
        (service.service_id.includes('service-energy') || service.service_id.includes('service-electricity'))
    );
    
    if (!energyService || !energyService.service_id) {
      console.error('[SALES SERVICE] Energy service not found in customer service states:', 
        customerServiceStates.map(s => s.service_id).join(', '));
      toast.error(t('sales.energyServiceNotFound') || 'Energy service not found. Please tap "Fetch Pricing" to retry.');
      return;
    }

    // Calculate cost using centralized calculateSwapPayment function
    // This ensures consistent rounding behavior with the Attendant flow
    // Note: We use customerRate directly - NO fallback to DEFAULT_RATE
    const rate = customerRate;
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
      // Use the pre-validated energy service ID (validated above - never empty at this point)
      serviceId: energyService.service_id,
      actor: {
        type: 'attendant', // Backend expects 'attendant' type
        id: `salesperson-${getSalesRoleUser()?.id || '001'}`,
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
    isIdentifying,
    identificationFailed,
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
        // Vehicle scan step - if already scanned, proceed to battery; otherwise scan
        if (scannedVehicleId) {
          advanceToStep(7);
        } else {
          handleScanVehicle();
        }
        break;
      case 7:
        // If battery already scanned, complete service; otherwise trigger scan
        if (scannedBatteryPending) {
          handleCompleteService();
        } else {
          handleScanBattery();
        }
        break;
      case 8:
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
        setScannedVehicleId(null);
        setAssignedBattery(null);
        setScannedBatteryPending(null);
        // Reset customer identification state (via hook)
        resetCustomerIdentification();
        setComputedEnergyCost(0);
        // Reset payment and service hook
        resetPaymentAndService();
        // Reset vehicle assignment hook
        resetVehicleAssignment();
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
    handleScanVehicle,
    handleScanBattery,
    handleCompleteService,
    scannedVehicleId,
    scannedBatteryPending,
    paymentInputMode,
    manualPaymentId,
    availablePackages,
    availableProducts,
    availablePlans,
    selectedPackageId,
    selectedPlanId,
    resetCustomerIdentification,
    resetPaymentAndService,
    resetVehicleAssignment,
  ]);

  // Handle step click in timeline
  const handleStepClick = useCallback((step: SalesStep) => {
    if (step <= maxStepReached && step < 8) {
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
    clearSalesRoleLogin();
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
        // Vehicle scan - scan QR code on vehicle being assigned to customer
        return (
          <Step6ScanVehicle
            formData={formData}
            onScanVehicle={handleScanVehicle}
            isScannerOpening={isScannerOpening}
            scannedVehicleId={scannedVehicleId}
            subscriptionCode={confirmedSubscriptionCode || subscriptionData?.subscriptionCode || ''}
          />
        );
      case 7:
        // Battery assignment - Uses shared BatteryScanBind component
        // Note: BLE progress/errors are handled by BleProgressModal below
        return (
          <Step7AssignBattery 
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
            isIdentifying={isIdentifying}
            identificationFailed={identificationFailed}
            onManualIdentify={manualIdentifyCustomer}
          />
        );
      case 8:
        // Success - Show receipt with all purchases
        return (
          <Step8Success 
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

      {/* Network Status Banners - show when connection is lost */}
      <div className="px-4 pt-2 flex flex-col gap-2">
        <NetworkStatusBanner />
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
      <SalesActionBar
        currentStep={currentStep}
        onBack={handleBack}
        onMainAction={handleMainAction}
        isLoading={isProcessing || isCreatingCustomer || isCompletingService || isAssigningVehicle}
        paymentInputMode={paymentInputMode}
        isDisabled={false}
        hasVehicleScanned={!!scannedVehicleId}
        hasBatteryScanned={!!scannedBatteryPending}
        customerIdentified={customerIdentified}
        isIdentifying={isIdentifying}
        identificationFailed={identificationFailed}
      />

      {/* Loading Overlay - Simple overlay for non-BLE operations (customer registration, processing, vehicle assignment) */}
      {(isCreatingCustomer || isProcessing || isAssigningVehicle) && 
       !bleScanState.isConnecting && 
       !bleScanState.isReadingEnergy && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {isCreatingCustomer 
              ? t('sales.registeringCustomer') || 'Registering customer...'
              : isAssigningVehicle
              ? t('sales.assigningVehicle') || 'Assigning vehicle...'
              : t('common.processing') || 'Processing...'}
          </div>
        </div>
      )}

      {/* Backend Session Resume Prompt - Uses shared SessionResumePrompt component */}
      <SessionResumePrompt
        isVisible={showSessionPrompt && !!pendingSession}
        session={pendingSession}
        onResume={handleResumeSession}
        onDiscard={handleDiscardSession}
        isLoading={isSessionLoading}
      />

      {/* Legacy Resume Session Prompt - Shows when there's a saved localStorage session (migration) */}
      {showResumePrompt && savedSessionSummary && !showSessionPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="resume-session-modal">
            <div className="resume-session-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h3 className="resume-session-title">{t('session.resumePreviousSession') || 'Resume Previous Session?'}</h3>
            <p className="resume-session-description">
              {t('session.incompleteRegistration') || 'You have an incomplete registration for:'}
            </p>
            <div className="resume-session-details">
              <div className="resume-session-customer">
                {savedSessionSummary.customerName}
              </div>
              <div className="resume-session-meta">
                {t('session.stepProgress', { current: savedSessionSummary.step, total: 8 }) || `Step ${savedSessionSummary.step} of 8`} • {t('session.saved') || 'Saved'} {savedSessionSummary.savedAt}
              </div>
            </div>
            <div className="resume-session-actions">
              <button 
                className="resume-session-btn resume-session-btn-primary"
                onClick={restoreLocalSession}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('session.resume') || 'Resume'}
              </button>
              <button 
                className="resume-session-btn resume-session-btn-secondary"
                onClick={discardLocalSession}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {t('session.startNew') || 'Start New'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* BLE Connection Progress Modal - Reusable component for connection/reading progress */}
      <BleProgressModal
        bleScanState={bleScanState}
        pendingBatteryId={pendingBatteryId}
        onCancel={cancelBleOperation}
      />
    </div>
  );
}
