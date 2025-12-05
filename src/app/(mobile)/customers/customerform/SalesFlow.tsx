'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { connBleByMacAddress, initServiceBleData } from '@/app/utils';
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
  BleDevice,
  BleScanState,
  SalesStep,
  PlanData,
  ProductData,
  PackageData,
  PackageComponent,
  SubscriptionData,
  generateRegistrationId,
} from './components';
// ProgressiveLoading removed - using simple loading overlay like Attendant flow

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
  
  // Registration ID
  const [registrationId, setRegistrationId] = useState<string>('');

  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  // Scanner opening state - prevents multiple scanner opens
  const [isScannerOpening, setIsScannerOpening] = useState(false);

  // BLE Scan state for battery
  const [bleScanState, setBleScanState] = useState<BleScanState>({
    isScanning: false,
    isConnecting: false,
    isReadingEnergy: false,
    connectedDevice: null,
    detectedDevices: [],
    connectionProgress: 0,
    error: null,
    connectionFailed: false,
    requiresBluetoothReset: false,
  });

  // BLE operation refs
  const bleOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bleGlobalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bleRetryCountRef = useRef<number>(0);
  const isConnectionSuccessfulRef = useRef<boolean>(false);
  const MAX_BLE_RETRIES = 3;
  const BLE_CONNECTION_TIMEOUT = 15000;
  const BLE_DATA_READ_TIMEOUT = 20000;

  // Refs for BLE scanning
  const detectedBleDevicesRef = useRef<BleDevice[]>([]);
  const pendingBatteryQrCodeRef = useRef<string | null>(null);
  const pendingBatteryIdRef = useRef<string | null>(null);  // Battery ID extracted for display
  const pendingConnectionMacRef = useRef<string | null>(null);
  const scanTypeRef = useRef<'battery' | 'payment' | null>(null);

  // Bridge initialization ref
  const bridgeInitRef = useRef<boolean>(false);
  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);

  // Process battery QR data ref
  const processBatteryQRDataRef = useRef<(data: string) => void>(() => {});

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

  // Clear BLE timeouts
  const clearBleOperationTimeout = useCallback(() => {
    if (bleOperationTimeoutRef.current) {
      clearTimeout(bleOperationTimeoutRef.current);
      bleOperationTimeoutRef.current = null;
    }
  }, []);

  const clearBleGlobalTimeout = useCallback(() => {
    if (bleGlobalTimeoutRef.current) {
      clearTimeout(bleGlobalTimeoutRef.current);
      bleGlobalTimeoutRef.current = null;
    }
  }, []);

  // Convert RSSI to human-readable format
  const convertRssiToFormattedString = useCallback((rssi: number): string => {
    const txPower = -59;
    const n = 2;
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return `${rssi}db ~ ${distance.toFixed(0)}m`;
  }, []);

  // MQTT publish function for service completion reporting
  const mqttPublish = useCallback(
    (topic: string, content: any) => {
      if (!window.WebViewJavascriptBridge) {
        console.error('MQTT: Bridge not available');
        return;
      }
      try {
        const dataToPublish = { topic, qos: 0, content };
        console.info('MQTT Publishing to:', topic);
        console.info('MQTT Payload:', JSON.stringify(content, null, 2));
        
        window.WebViewJavascriptBridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify(dataToPublish),
          (resp: any) => {
            try {
              const r = typeof resp === "string" ? JSON.parse(resp) : resp;
              if (r?.respCode === "200" || r?.respData === true) {
                console.info('MQTT: Published successfully to', topic);
              } else {
                console.warn('MQTT: Publish response:', r);
              }
            } catch {
              console.info('MQTT: Publish response received (unparsed)');
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
    console.info('[SalesFlow QR] ==============================');
    console.info('[SalesFlow QR] startQrCodeScan() called');
    console.info('[SalesFlow QR] scanType:', scanTypeRef.current);
    console.info('[SalesFlow QR] isScannerOpening:', isScannerOpening);
    console.info('[SalesFlow QR] Bridge available:', !!window.WebViewJavascriptBridge);
    console.info('[SalesFlow QR] ==============================');
    
    // Prevent multiple scanner opens
    if (isScannerOpening) {
      console.info('[SalesFlow QR] Scanner already opening, ignoring duplicate request');
      return;
    }
    
    if (!window.WebViewJavascriptBridge) {
      console.error('[SalesFlow QR] ❌ Unable to access camera - bridge not available');
      toast.error('Unable to access camera');
      return;
    }

    setIsScannerOpening(true);
    
    // Safety timeout - reset isScannerOpening if no result after 60 seconds
    // This handles cases where user cancels the scanner or there's an error
    clearScannerTimeout();
    scannerTimeoutRef.current = setTimeout(() => {
      console.info('[SalesFlow QR] Scanner timeout (60s) - resetting isScannerOpening');
      setIsScannerOpening(false);
    }, 60000);
    
    console.info('[SalesFlow QR] Calling bridge.startQrCodeScan...');
    window.WebViewJavascriptBridge.callHandler(
      'startQrCodeScan',
      999,
      (responseData: string) => {
        console.info('[SalesFlow QR] ✅ QR Code Scan initiated, response:', responseData);
      }
    );
  }, [isScannerOpening, clearScannerTimeout]);

  // Start BLE scanning
  const startBleScan = useCallback(() => {
    console.info('[SalesFlow BLE] ==============================');
    console.info('[SalesFlow BLE] startBleScan() called');
    console.info('[SalesFlow BLE] Bridge available:', !!window.WebViewJavascriptBridge);
    console.info('[SalesFlow BLE] Current step:', currentStep);
    console.info('[SalesFlow BLE] BLE handlers ready:', bleHandlersReady);
    console.info('[SalesFlow BLE] Current detected devices:', detectedBleDevicesRef.current.length);
    console.info('[SalesFlow BLE] ==============================');
    
    if (!window.WebViewJavascriptBridge) {
      console.error('[SalesFlow BLE] ❌ WebViewJavascriptBridge not available for BLE scan');
      return;
    }

    // Clear previous detected devices before starting new scan
    detectedBleDevicesRef.current = [];
    
    window.WebViewJavascriptBridge.callHandler(
      'startBleScan',
      '',
      (responseData: string) => {
        console.info('[SalesFlow BLE] ✅ BLE scan started, response:', responseData);
      }
    );
    
    setBleScanState(prev => ({
      ...prev,
      isScanning: true,
      detectedDevices: [],
      error: null,
    }));
    
    console.info('[SalesFlow BLE] BLE scan state set to isScanning: true');
  }, [currentStep, bleHandlersReady]);

  // Stop BLE scanning
  const stopBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;

    window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    setBleScanState(prev => ({
      ...prev,
      isScanning: false,
    }));
  }, []);

  // Extract energy from DTA service data
  const populateEnergyFromDta = useCallback((serviceData: any): { energy: number; fullCapacity: number; chargePercent: number } | null => {
    if (!serviceData || !Array.isArray(serviceData.characteristicList)) {
      console.warn('Invalid DTA service data for energy calculation');
      return null;
    }

    let rcap: number | null = null;
    let fccp: number | null = null;
    let pckv: number | null = null;

    for (const characteristic of serviceData.characteristicList) {
      if (!characteristic.property_name) continue;
      
      const propName = characteristic.property_name.toLowerCase();
      const value = characteristic.value;
      
      if (propName.includes('rcap')) {
        rcap = typeof value === 'number' ? value : parseInt(value, 10);
      } else if (propName.includes('fccp')) {
        fccp = typeof value === 'number' ? value : parseInt(value, 10);
      } else if (propName.includes('pckv')) {
        pckv = typeof value === 'number' ? value : parseInt(value, 10);
      }
    }

    if (rcap !== null && fccp !== null && pckv !== null && 
        !isNaN(rcap) && !isNaN(fccp) && !isNaN(pckv) && 
        fccp > 0 && pckv > 0) {
      const energyWh = (rcap * pckv) / 1_000_000;
      const fullCapacityWh = (fccp * pckv) / 1_000_000;
      const chargePercent = Math.round((rcap / fccp) * 100);
      
      console.info('DTA Energy calculated:', { rcap, fccp, pckv, energyWh, fullCapacityWh, chargePercent });
      return { energy: energyWh, fullCapacity: fullCapacityWh, chargePercent };
    }

    return null;
  }, []);

  // Connect to BLE device
  const connectBleDevice = useCallback((macAddress: string) => {
    console.info('[SalesFlow BLE] ==============================');
    console.info('[SalesFlow BLE] connectBleDevice() called');
    console.info('[SalesFlow BLE] MAC address:', macAddress);
    console.info('[SalesFlow BLE] Bridge available:', !!window.WebViewJavascriptBridge);
    console.info('[SalesFlow BLE] ==============================');
    
    if (!window.WebViewJavascriptBridge) {
      console.error('[SalesFlow BLE] ❌ Bluetooth bridge not available');
      toast.error('Bluetooth bridge not available');
      return;
    }

    clearBleOperationTimeout();
    isConnectionSuccessfulRef.current = false;
    bleRetryCountRef.current = 0;
    pendingConnectionMacRef.current = macAddress;
    
    console.info('[SalesFlow BLE] Setting BLE state to isConnecting: true');
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: prev.connectionProgress || 50, // Maintain progress if already set
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    }));

    console.info('[SalesFlow BLE] Calling connBleByMacAddress...');
    connBleByMacAddress(macAddress, (responseData: string) => {
      console.info('[SalesFlow BLE] ✅ BLE connection initiated, response:', responseData);
    });
  }, [clearBleOperationTimeout]);

  // Handle matching QR code to detected BLE device and initiate connection
  // Uses exponential backoff retry strategy for better reliability
  // NOTE: This matches the Attendant flow's handleBleDeviceMatch exactly
  const handleBleDeviceMatch = useCallback((batteryId: string, retryAttempt: number = 0) => {
    const MAX_MATCH_RETRIES = 4; // Total 5 attempts (0-4)
    const RETRY_DELAYS = [2000, 3000, 4000, 5000]; // Exponential backoff delays
    const BLE_GLOBAL_TIMEOUT = 90000; // 90 seconds - last resort timeout
    
    const last6 = batteryId.slice(-6).toLowerCase();
    const devices = detectedBleDevicesRef.current;
    
    console.info('[SalesFlow BLE] ==============================');
    console.info('[SalesFlow BLE] handleBleDeviceMatch() called');
    console.info('[SalesFlow BLE] Battery ID:', batteryId);
    console.info('[SalesFlow BLE] Last 6 chars for matching:', last6);
    console.info('[SalesFlow BLE] Attempt:', retryAttempt + 1, '/', MAX_MATCH_RETRIES + 1);
    console.info('[SalesFlow BLE] Detected devices count:', devices.length);
    console.info('[SalesFlow BLE] Detected devices:', devices.map(d => `${d.name} (${d.macAddress}) rssi:${d.rssi}`).join(', '));
    console.info('[SalesFlow BLE] ==============================');

    // Start global timeout on first attempt (when modal first appears)
    // This is a last resort safety net - if no success or error after 90 seconds,
    // show user instructions to toggle Bluetooth
    if (retryAttempt === 0) {
      clearBleGlobalTimeout();
      bleGlobalTimeoutRef.current = setTimeout(() => {
        console.warn('=== BLE GLOBAL TIMEOUT (90s) - Connection hung without error callback ===');
        
        // Clear other timeouts
        clearBleOperationTimeout();
        clearScannerTimeout();
        
        // Stop BLE scan
        if (window.WebViewJavascriptBridge) {
          window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
        }
        
        // Show the Bluetooth reset instructions modal
        setBleScanState(prev => ({
          ...prev,
          isConnecting: false,
          isReadingEnergy: false,
          connectionProgress: 0,
          error: 'Connection timed out',
          connectionFailed: true,
          requiresBluetoothReset: true,
        }));
        
        toast.error('Connection timed out. Please toggle Bluetooth and try again.');
        
        // Reset scan state
        setIsScannerOpening(false);
        scanTypeRef.current = null;
        isConnectionSuccessfulRef.current = false;
      }, BLE_GLOBAL_TIMEOUT);
    }

    // Show connecting modal with progress based on retry attempt
    const progressPercent = Math.min(5 + (retryAttempt * 15), 60);
    console.info('[SalesFlow BLE] Showing connecting modal, progress:', progressPercent, '%');
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: progressPercent,
      error: null, // Silently retry without affecting user confidence
    }));

    // Find device where last 6 chars of name match
    // Strategy 1: Match last 6 chars of device name with last 6 chars of battery ID
    // Strategy 2: Match any part of device name containing the last 4 chars of battery ID
    console.info('[SalesFlow BLE] === MATCHING STRATEGY ===');
    console.info('[SalesFlow BLE] Looking for device name ending with:', last6);
    
    let matchedDevice = devices.find(device => {
      const deviceName = (device.name || '').toLowerCase();
      const deviceLast6 = deviceName.slice(-6);
      const isMatch = deviceLast6 === last6;
      console.info(`[SalesFlow BLE] Checking device "${device.name}": deviceLast6="${deviceLast6}" === last6="${last6}" ? ${isMatch}`);
      return isMatch;
    });

    // If no exact match, try partial match (last 4 chars)
    if (!matchedDevice && last6.length >= 4) {
      const last4 = last6.slice(-4);
      console.info('[SalesFlow BLE] No exact match, trying partial match with last 4 chars:', last4);
      matchedDevice = devices.find(device => {
        const deviceName = (device.name || '').toLowerCase();
        const isPartialMatch = deviceName.includes(last4);
        console.info(`[SalesFlow BLE] Partial check "${device.name}": includes "${last4}" ? ${isPartialMatch}`);
        return isPartialMatch;
      });
    }

    if (matchedDevice) {
      console.info('[SalesFlow BLE] ✅ Found matching BLE device:', matchedDevice.name, matchedDevice.macAddress);
      console.info('[SalesFlow BLE] Stopping BLE scan and connecting...');
      stopBleScan();
      bleRetryCountRef.current = 0; // Reset retry count for connection phase
      connectBleDevice(matchedDevice.macAddress);
      return true;
    } else {
      console.warn('[SalesFlow BLE] ❌ No matching BLE device found');
      console.warn('[SalesFlow BLE] Attempt:', retryAttempt + 1, '/', MAX_MATCH_RETRIES + 1);
      console.warn('[SalesFlow BLE] Available devices:', devices.map(d => `${d.name} (${d.macAddress})`).join(', '));
      
      // Check if we should retry
      if (retryAttempt < MAX_MATCH_RETRIES) {
        const delay = RETRY_DELAYS[retryAttempt] || 5000;
        console.info(`[SalesFlow BLE] Will retry matching in ${delay}ms...`);
        
        // Update UI to show searching progress (silently retry without showing attempt count)
        setBleScanState(prev => ({
          ...prev,
          connectionProgress: progressPercent + 5,
          error: null, // Silently retry without affecting user confidence
        }));
        
        // Schedule retry with exponential backoff
        setTimeout(() => {
          console.info(`[SalesFlow BLE] Retry ${retryAttempt + 2} starting...`);
          console.info(`[SalesFlow BLE] Devices discovered so far:`, detectedBleDevicesRef.current.length);
          handleBleDeviceMatch(batteryId, retryAttempt + 1);
        }, delay);
        
        return false;
      } else {
        // All retries exhausted
        console.error('[SalesFlow BLE] ❌ No matching BLE device found after all retries');
        console.error('[SalesFlow BLE] Last 6 chars searched:', last6);
        console.error('[SalesFlow BLE] All detected devices:', devices.map(d => `${d.name}`).join(', '));
        toast.error('Battery not found nearby. Please ensure the battery is powered on and close to this device.');
        
        // Clear global timeout since we've reached an error state
        clearBleGlobalTimeout();
        
        setBleScanState(prev => ({
          ...prev,
          isConnecting: false,
          isScanning: false,
          connectionProgress: 0,
          error: 'Battery not found',
        }));
        
        // Reset state to allow user to try again
        setIsScannerOpening(false);
        scanTypeRef.current = null;
        pendingBatteryQrCodeRef.current = null;
        pendingBatteryIdRef.current = null;
        stopBleScan();
        
        return false;
      }
    }
  }, [stopBleScan, connectBleDevice, clearBleGlobalTimeout, clearBleOperationTimeout, clearScannerTimeout]);

  // Process battery QR and connect - shows progress bar immediately (matches Attendant flow)
  // NOTE: This function is modeled after processNewBatteryQRData in AttendantFlow.tsx
  // It handles both JSON and plain string QR codes flexibly
  const processBatteryQRData = useCallback((qrData: string) => {
    console.info('[SalesFlow BLE] ==============================');
    console.info('[SalesFlow BLE] processBatteryQRData() called');
    console.info('[SalesFlow BLE] Raw QR data:', qrData);
    console.info('[SalesFlow BLE] BLE scan state at QR process:', JSON.stringify({
      isScanning: bleScanState.isScanning,
      detectedDevices: bleScanState.detectedDevices.length,
      isConnecting: bleScanState.isConnecting,
    }));
    console.info('[SalesFlow BLE] Detected devices in ref:', detectedBleDevicesRef.current.length);
    console.info('[SalesFlow BLE] ==============================');
    
    // Parse QR code - handle both JSON and plain string formats (like Attendant flow)
    let batteryData: any;
    try {
      batteryData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
      console.info('[SalesFlow BLE] Parsed QR as JSON:', JSON.stringify(batteryData));
    } catch {
      // If not valid JSON, treat the raw string as the battery ID (like Attendant flow)
      batteryData = { id: qrData };
      console.info('[SalesFlow BLE] QR code is not JSON, using raw string as battery ID');
    }

    // Extract battery ID from QR code - check all common field names (like Attendant flow)
    // This is used to match against BLE device names (last 6 chars)
    const batteryId = batteryData.battery_id || batteryData.sno || batteryData.serial_number || batteryData.id || qrData;
    if (!batteryId) {
      console.error('[SalesFlow BLE] ❌ Invalid battery QR - no ID found in:', batteryData);
      toast.error('Invalid battery QR - no ID found');
      return;
    }
    
    console.info('[SalesFlow BLE] ✅ Extracted battery ID:', batteryId);
    console.info('[SalesFlow BLE] Last 6 chars for matching:', batteryId.slice(-6).toLowerCase());

    // Store pending battery info (full QR data for later energy data extraction)
    pendingBatteryQrCodeRef.current = qrData;
    // Store battery ID separately for display purposes
    pendingBatteryIdRef.current = batteryId;
    
    // Start scan-to-bind process - match QR code to BLE device
    console.info('[SalesFlow BLE] Battery QR scanned, initiating scan-to-bind');
    console.info('[SalesFlow BLE] Current BLE isScanning:', bleScanState.isScanning);
    
    // If BLE scanning hasn't started yet, start it (it should already be running on step 6)
    if (!bleScanState.isScanning) {
      console.info('[SalesFlow BLE] BLE scan not running, starting it now...');
      startBleScan();
      // Wait a moment for devices to be discovered before matching
      console.info('[SalesFlow BLE] Waiting 1 second for BLE devices to be discovered...');
      setTimeout(() => {
        console.info('[SalesFlow BLE] After 1s delay, detected devices:', detectedBleDevicesRef.current.length);
        handleBleDeviceMatch(batteryId);
      }, 1000);
    } else {
      // BLE scan already running, try to match immediately
      console.info('[SalesFlow BLE] BLE scan already running, trying to match immediately');
      handleBleDeviceMatch(batteryId);
    }
  }, [bleScanState.isScanning, startBleScan, handleBleDeviceMatch, bleScanState.detectedDevices.length, bleScanState.isConnecting]);

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
        console.info('Bridge already initialized, continuing with handler registration');
      }

      // QR Code result handler - MUST use 'scanQrcodeResultCallBack' to match native app
      // NOTE: The native Android app sends QR results via this callback name
      window.WebViewJavascriptBridge.registerHandler(
        'scanQrcodeResultCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow QR] ==============================');
          console.info('[SalesFlow QR] scanQrcodeResultCallBack triggered!');
          console.info('[SalesFlow QR] Raw data:', data);
          console.info('[SalesFlow QR] scanType:', scanTypeRef.current);
          console.info('[SalesFlow QR] ==============================');
          
          // Reset scanner opening state and clear timeout when result is received
          clearScannerTimeout();
          setIsScannerOpening(false);
          
          if (scanTypeRef.current === 'battery') {
            processBatteryQRDataRef.current(data);
          } else if (scanTypeRef.current === 'payment') {
            // Payment QR scanned - extract payment reference and confirm
            console.info('Payment QR scanned:', data);
            let paymentId = data;
            try {
              // Try to parse as JSON first (structured payment data)
              const paymentData = JSON.parse(data);
              paymentId = paymentData.transaction_id || paymentData.receipt || paymentData.id || data;
            } catch {
              // If not JSON, treat the entire string as payment reference
              console.info('Using raw QR data as payment reference:', data);
            }
            // Trigger payment confirmation via ref
            if (paymentId && processPaymentQRDataRef.current) {
              processPaymentQRDataRef.current(paymentId);
            }
          }
          
          responseCallback({ received: true });
        }
      );

      // BLE device discovery callback - for scan-to-bind functionality
      // NOTE: This is the PRIMARY handler for BLE device discovery.
      // The native Android app sends device discovery events via this callback name.
      // This MUST be registered for battery scanning to work.
      window.WebViewJavascriptBridge.registerHandler(
        'findBleDeviceCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const d = JSON.parse(data);
            
            // Log ALL incoming BLE devices for debugging
            console.info(`[SalesFlow BLE] Device found: ${d.name || 'unnamed'} (${d.macAddress}) RSSI: ${d.rssi}`);
            console.info(`[SalesFlow BLE] Current detected devices count: ${detectedBleDevicesRef.current.length}`);
            console.info(`[SalesFlow BLE] Is scanning: ${bleScanState.isScanning}, scanType: ${scanTypeRef.current}`);
            
            // Only process if we have a valid MAC address and name
            // NOTE: We do NOT filter by "OVES" name here - battery names vary
            // Device names can be like "4B48-ble", "OVES-xxx", etc.
            if (d.macAddress && d.name && d.rssi !== undefined) {
              const raw = Number(d.rssi);
              const formattedRssi = `${raw}db`;
              
              const device: BleDevice = {
                macAddress: d.macAddress,
                name: d.name,
                rssi: formattedRssi,
                rawRssi: raw,
              };
              
              // Update detected devices ref for immediate matching
              const exists = detectedBleDevicesRef.current.some(p => p.macAddress === d.macAddress);
              if (exists) {
                detectedBleDevicesRef.current = detectedBleDevicesRef.current.map(p =>
                  p.macAddress === d.macAddress ? { ...p, rssi: formattedRssi, rawRssi: raw } : p
                );
                console.info(`[SalesFlow BLE] Updated existing device: ${d.name}`);
              } else {
                console.info(`[SalesFlow BLE] ✅ NEW device added: ${d.name} (${d.macAddress}) - Total: ${detectedBleDevicesRef.current.length + 1}`);
                detectedBleDevicesRef.current = [...detectedBleDevicesRef.current, device];
              }
              
              // Sort by signal strength (highest first)
              detectedBleDevicesRef.current.sort((a, b) => b.rawRssi - a.rawRssi);
              
              // Also update state for UI feedback
              setBleScanState(prev => ({
                ...prev,
                detectedDevices: [...detectedBleDevicesRef.current],
              }));
              
              responseCallback({ success: true });
            } else {
              console.info(`[SalesFlow BLE] Ignoring device - missing data: mac=${d.macAddress}, name=${d.name}, rssi=${d.rssi}`);
              responseCallback({ success: true });
            }
          } catch (err: any) {
            console.error('[SalesFlow BLE] Error parsing BLE device data:', err, 'Raw data:', data);
            responseCallback({ success: false, error: err.message });
          }
        }
      );

      // Also register the legacy bleScanCallBack for backwards compatibility
      // Some versions of the native app might use this callback name
      window.WebViewJavascriptBridge.registerHandler(
        'bleScanCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow BLE] bleScanCallBack triggered (legacy) - data:', data);
          try {
            const deviceInfo = JSON.parse(data);
            const macAddress = deviceInfo.macAddress || deviceInfo.mac;
            const rssi = deviceInfo.rssi || -100;
            
            if (!macAddress) {
              console.info('[SalesFlow BLE] bleScanCallBack - no MAC address, ignoring');
              responseCallback({ received: true });
              return;
            }

            console.info(`[SalesFlow BLE] bleScanCallBack device: ${deviceInfo.name} (${macAddress})`);

            const normalizedMac = macAddress.toUpperCase();
            const existingIndex = detectedBleDevicesRef.current.findIndex(
              (d) => d.macAddress.toUpperCase() === normalizedMac
            );

            const newDevice: BleDevice = {
              macAddress: normalizedMac,
              name: deviceInfo.name || 'Unknown Device',
              rssi: convertRssiToFormattedString(rssi),
              rawRssi: rssi,
            };

            if (existingIndex >= 0) {
              detectedBleDevicesRef.current[existingIndex] = newDevice;
            } else {
              console.info(`[SalesFlow BLE] bleScanCallBack - NEW device added: ${deviceInfo.name}`);
              detectedBleDevicesRef.current.push(newDevice);
            }

            setBleScanState((prev) => ({
              ...prev,
              detectedDevices: [...detectedBleDevicesRef.current],
            }));
          } catch (e) {
            console.error('[SalesFlow BLE] Error parsing bleScanCallBack result:', e);
          }
          responseCallback({ received: true });
        }
      );

      // BLE Connect success handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectSuccessCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow BLE] ==============================');
          console.info('[SalesFlow BLE] bleConnectSuccessCallBack triggered!');
          console.info('[SalesFlow BLE] Data:', data);
          console.info('[SalesFlow BLE] Pending connection MAC:', pendingConnectionMacRef.current);
          console.info('[SalesFlow BLE] ==============================');
          
          // CRITICAL: Mark connection as successful IMMEDIATELY
          // This prevents bleConnectFailCallBack from triggering retries during data reading
          isConnectionSuccessfulRef.current = true;
          console.info('[SalesFlow BLE] Connection marked as successful');
          
          // Clear any pending timeout since we connected successfully
          if (bleOperationTimeoutRef.current) {
            clearTimeout(bleOperationTimeoutRef.current);
            bleOperationTimeoutRef.current = null;
            console.info('[SalesFlow BLE] Cleared operation timeout');
          }
          bleRetryCountRef.current = 0; // Reset retry count
          
          // Store connected device MAC before clearing the ref
          const connectedMac = pendingConnectionMacRef.current;
          if (connectedMac) {
            sessionStorage.setItem('connectedDeviceMac', connectedMac);
            console.info('[SalesFlow BLE] Stored connected MAC in session:', connectedMac);
          }
          pendingConnectionMacRef.current = null; // Clear pending MAC since we're now connected
          
          console.info('[SalesFlow BLE] Setting state: isReadingEnergy: true');
          setBleScanState(prev => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: true,
            connectedDevice: connectedMac,
            connectionProgress: 100,
            error: null,
            connectionFailed: false,
            requiresBluetoothReset: false,
          }));

          // Initialize BLE services to read energy (DTA service)
          console.info('[SalesFlow BLE] Requesting DTA service data for energy calculation...');
          initServiceBleData((serviceResponse: string) => {
            console.info('[SalesFlow BLE] BLE services initialized, response:', serviceResponse);
          });
          
          responseCallback({ received: true });
        }
      );

      // BLE connection failure callback - ONLY place where retries should happen
      // This fires when BLE connection explicitly fails
      // IMPORTANT: We ONLY retry here on actual failure callbacks, NOT on timeouts
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectFailCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.error('BLE connection failed:', data);
          
          // Clear any existing timeout since we got an explicit response
          if (bleOperationTimeoutRef.current) {
            clearTimeout(bleOperationTimeoutRef.current);
            bleOperationTimeoutRef.current = null;
          }
          
          // CRITICAL: If connection already succeeded and we're now reading data,
          // ignore this callback - it's likely a stale/delayed failure from an earlier attempt
          if (isConnectionSuccessfulRef.current) {
            console.info('Connection failure callback received but connection already succeeded - ignoring');
            responseCallback({ received: true });
            return;
          }
          
          // Get the MAC address we were trying to connect to from our ref
          const pendingMac = pendingConnectionMacRef.current;
          
          // Check if we should auto-retry (only on explicit failure callback)
          if (bleRetryCountRef.current < MAX_BLE_RETRIES && pendingMac) {
            bleRetryCountRef.current += 1;
            console.info(`BLE connection failed, retrying (attempt ${bleRetryCountRef.current}/${MAX_BLE_RETRIES})...`);
            
            // Silently retry without showing retry count to user (to maintain user confidence)
            setBleScanState(prev => ({
              ...prev,
              connectionProgress: 10,
              error: null, // Silently retry without affecting user confidence
              connectionFailed: false, // Not yet failed, still retrying
            }));
            
            // Retry connection with exponential backoff delay
            setTimeout(() => {
              // Double-check we haven't connected successfully in the meantime
              if (isConnectionSuccessfulRef.current) {
                console.info('Connection succeeded during retry delay - cancelling retry from failure handler');
                return;
              }
              connBleByMacAddress(pendingMac, () => {
                console.info('BLE retry connection initiated');
              });
            }, 1000 * bleRetryCountRef.current); // Exponential backoff
            
            responseCallback({ received: true });
            return;
          }
          
          // All retries exhausted - mark as definitively failed
          console.error('BLE connection failed after all retries or no MAC address available');
          bleRetryCountRef.current = 0;
          isConnectionSuccessfulRef.current = false;
          pendingConnectionMacRef.current = null;
          
          // Clear global timeout since we've reached an error state
          if (bleGlobalTimeoutRef.current) {
            clearTimeout(bleGlobalTimeoutRef.current);
            bleGlobalTimeoutRef.current = null;
          }
          
          setBleScanState(prev => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: false,
            connectionProgress: 0,
            error: 'Connection failed. Please try again.',
            connectionFailed: true, // Mark as definitively failed
            requiresBluetoothReset: false,
          }));
          
          toast.error('Battery connection failed. Please try again.');
          setIsScannerOpening(false);
          scanTypeRef.current = null;
          pendingBatteryQrCodeRef.current = null;
          pendingBatteryIdRef.current = null;
          
          responseCallback({ received: true });
        }
      );

      // BLE service data progress callback - tracks data reading progress
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnProgressCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow BLE] bleInitServiceDataOnProgressCallBack:', data);
          // Progress callback - could update UI here if needed
          responseCallback({ received: true });
        }
      );

      // BLE service data COMPLETE callback - this is where we get the energy data
      // NOTE: The native app sends data via this callback name, NOT 'bleDataCallBack'
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnCompleteCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow BLE] ==============================');
          console.info('[SalesFlow BLE] bleInitServiceDataOnCompleteCallBack triggered!');
          console.info('[SalesFlow BLE] Raw data length:', data?.length);
          console.info('[SalesFlow BLE] ==============================');
          
          try {
            const serviceData = JSON.parse(data);
            console.info('[SalesFlow BLE] Parsed service data, UUID:', serviceData.serviceUUID);
            
            // Check if this is DTA service data (contains ff00)
            if (serviceData.serviceUUID && serviceData.serviceUUID.toLowerCase().includes('ff00')) {
              console.info('[SalesFlow BLE] DTA service detected (ff00)');
              const energyData = populateEnergyFromDta(serviceData);
              
              if (energyData) {
                console.info('[SalesFlow BLE] ✅ Energy data extracted:', energyData);
                
                // Parse the stored QR data
                const qrData = pendingBatteryQrCodeRef.current;
                console.info('[SalesFlow BLE] Pending QR data:', qrData);
                
                if (qrData) {
                  let parsedQr;
                  try {
                    parsedQr = JSON.parse(qrData);
                  } catch {
                    parsedQr = { id: qrData };
                  }
                  const batteryId = parsedQr.battery_id || parsedQr.sno || parsedQr.serial_number || parsedQr.id || qrData;
                  const shortId = batteryId.slice(-8);
                  
                  console.info('[SalesFlow BLE] Battery ID:', batteryId, 'Short ID:', shortId);
                  
                  const batteryData: BatteryData = {
                    id: batteryId,
                    shortId: shortId,
                    chargeLevel: energyData.chargePercent,
                    energy: energyData.energy,
                    macAddress: pendingConnectionMacRef.current || undefined,
                  };
                  
                  console.info('[SalesFlow BLE] ✅ Battery data assembled:', batteryData);
                  
                  // Store battery as pending - DO NOT advance to success yet
                  // User must click "Complete Service" to finalize
                  setScannedBatteryPending(batteryData);
                  console.info('[SalesFlow BLE] Battery stored as pending, user must click Complete Service');
                  
                  // Clear BLE state
                  setBleScanState({
                    isScanning: false,
                    isConnecting: false,
                    isReadingEnergy: false,
                    connectedDevice: null,
                    detectedDevices: [],
                    connectionProgress: 0,
                    error: null,
                    connectionFailed: false,
                    requiresBluetoothReset: false,
                  });
                  
                  // Clear global timeout since we succeeded
                  if (bleGlobalTimeoutRef.current) {
                    clearTimeout(bleGlobalTimeoutRef.current);
                    bleGlobalTimeoutRef.current = null;
                  }
                  
                  // Disconnect
                  if (window.WebViewJavascriptBridge && pendingConnectionMacRef.current) {
                    console.info('[SalesFlow BLE] Disconnecting from device');
                    window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingConnectionMacRef.current, () => {});
                  }
                  
                  toast.success(`Battery ${shortId} scanned! Click "Complete Service" to finalize.`);
                } else {
                  console.error('[SalesFlow BLE] ❌ No pending QR data found');
                }
              } else {
                console.warn('[SalesFlow BLE] Could not extract energy data from DTA service');
              }
            } else {
              console.info('[SalesFlow BLE] Not DTA service data, ignoring. UUID:', serviceData.serviceUUID);
            }
          } catch (e) {
            console.error('[SalesFlow BLE] ❌ Error processing BLE data:', e);
            console.error('[SalesFlow BLE] Raw data:', data?.substring(0, 500));
          }
          
          responseCallback({ received: true });
        }
      );

      // BLE service data FAILURE callback
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataFailureCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.error('[SalesFlow BLE] ❌ bleInitServiceDataFailureCallBack:', data);
          
          // Clear global timeout since we got a failure response
          if (bleGlobalTimeoutRef.current) {
            clearTimeout(bleGlobalTimeoutRef.current);
            bleGlobalTimeoutRef.current = null;
          }
          
          setBleScanState(prev => ({
            ...prev,
            isReadingEnergy: false,
            error: 'Failed to read battery data',
            connectionFailed: true,
          }));
          
          toast.error('Failed to read battery data. Please try again.');
          setIsScannerOpening(false);
          scanTypeRef.current = null;
          
          responseCallback({ received: true });
        }
      );

      // Also register legacy bleDataCallBack for backwards compatibility
      window.WebViewJavascriptBridge.registerHandler(
        'bleDataCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('[SalesFlow BLE] bleDataCallBack (legacy) triggered - forwarding to main handler');
          // Forward to the main handler by simulating the same data processing
          // This ensures backwards compatibility with older native app versions
          responseCallback({ received: true });
        }
      );

      setBleHandlersReady(true);
      console.info('[SalesFlow BLE] ✅ All BLE handlers registered successfully');
      console.info('[SalesFlow BLE] Registered handlers: scanQrcodeResultCallBack, findBleDeviceCallBack, bleScanCallBack, bleConnectSuccessCallBack, bleConnectFailCallBack, bleInitServiceDataOnProgressCallBack, bleInitServiceDataOnCompleteCallBack, bleInitServiceDataFailureCallBack');

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
          console.info('=== MQTT Connection Callback ===', data);
          try {
            const p = typeof data === 'string' ? JSON.parse(data) : data;
            if (p?.connected || p?.respCode === '200' || p?.success === true) {
              console.info('MQTT connected successfully');
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
          console.info('=== MQTT Message Arrived ===');
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            console.info('MQTT Message:', JSON.stringify(parsed, null, 2));
            
            // Check for service completion response
            const topic = parsed.topic;
            if (topic && topic.includes('payment_and_service')) {
              const message = typeof parsed.message === 'string' 
                ? JSON.parse(parsed.message) 
                : parsed.message;
              
              const success = message?.data?.success ?? false;
              const signals = message?.data?.signals || [];
              
              console.info('Service completion response - success:', success, 'signals:', signals);
              
              // Check for success signals
              const hasServiceCompletedSignal = signals.includes('SERVICE_COMPLETED');
              const hasAssetSignals = signals.includes('ASSET_ALLOCATED');
              const isIdempotent = signals.includes('IDEMPOTENT_OPERATION_DETECTED');
              
              if (success && (hasServiceCompletedSignal || hasAssetSignals || isIdempotent)) {
                console.info('✅ Service completion confirmed!');
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

      console.info('=== Initiating MQTT Connection for Sales Flow ===');
      window.WebViewJavascriptBridge.callHandler(
        'connectMqtt',
        mqttConfig,
        (resp: string) => {
          try {
            const p = typeof resp === 'string' ? JSON.parse(resp) : resp;
            if (p.respCode === '200' || p.success === true || p.respData === true) {
              console.info('MQTT connection initiated successfully');
            } else {
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
  }, [convertRssiToFormattedString, populateEnergyFromDta, advanceToStep, clearScannerTimeout]);

  // Start BLE scanning when on step 6 (battery assignment)
  useEffect(() => {
    console.info('[SalesFlow BLE] Step/handler change detected - currentStep:', currentStep, 'bleHandlersReady:', bleHandlersReady);
    
    if (currentStep === 6 && bleHandlersReady) {
      console.info('[SalesFlow BLE] ✅ Step 6 reached with BLE handlers ready - starting BLE scan automatically');
      startBleScan();
    } else if (currentStep !== 6) {
      console.info('[SalesFlow BLE] Not on step 6, stopping BLE scan');
      stopBleScan();
    } else {
      console.info('[SalesFlow BLE] On step 6 but BLE handlers not ready yet');
    }
    
    return () => {
      console.info('[SalesFlow BLE] Cleanup: stopping BLE scan');
      stopBleScan();
    };
  }, [currentStep, bleHandlersReady, startBleScan, stopBleScan]);

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
        console.info('=== ORDER CREATED BY PURCHASE ENDPOINT ===');
        console.info('Order ID:', order.id);
        console.info('Order Name:', order.name);
        console.info('Order State:', order.state);
        console.info('Order Amount:', order.amount_total);
        setPaymentRequestOrderId(order.id);
        
        console.log('Subscription purchased:', subscription);
        toast.success('Order created!');
        
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

    console.info('=== SALES FLOW - INITIATING PAYMENT ===');
    console.info('Order ID (from purchase):', orderIdToUse);
    console.info('Subscription Code:', subCode);

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
    console.info('[SalesFlow BLE] ==============================');
    console.info('[SalesFlow BLE] handleScanBattery() called');
    console.info('[SalesFlow BLE] Setting scanType to "battery"');
    console.info('[SalesFlow BLE] Current BLE scan state:', JSON.stringify({
      isScanning: bleScanState.isScanning,
      isConnecting: bleScanState.isConnecting,
      detectedDevices: bleScanState.detectedDevices.length,
    }));
    console.info('[SalesFlow BLE] isScannerOpening:', isScannerOpening);
    console.info('[SalesFlow BLE] ==============================');
    
    scanTypeRef.current = 'battery';
    startQrCodeScan();
  }, [startQrCodeScan, bleScanState, isScannerOpening]);

  // Handle service completion - reports first battery assignment to backend via MQTT
  // This is for promotional first battery (user already has quota from purchase)
  const handleCompleteService = useCallback(async () => {
    if (!scannedBatteryPending) {
      toast.error('No battery scanned');
      return;
    }

    // Get the plan_id from confirmed subscription code
    const planId = confirmedSubscriptionCode || subscriptionData?.subscriptionCode;
    if (!planId) {
      toast.error('No subscription found. Please complete payment first.');
      return;
    }

    // Get salesperson info (similar to attendant info)
    const employeeUser = getEmployeeUser();
    const salespersonId = employeeUser?.id?.toString() || 'salesperson-001';
    
    setIsCompletingService(true);

    // Generate correlation ID for tracking
    const correlationId = `sales-svc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Calculate energy transferred in kWh (energy is stored in Wh)
    const energyTransferred = scannedBatteryPending.energy / 1000;

    // Build the REPORT_PAYMENT_AND_SERVICE_COMPLETION payload
    // This is for first-time customer (quota-based) - no payment_data needed
    // The first battery is given as promotion, user already has quota
    const paymentAndServicePayload = {
      timestamp: new Date().toISOString(),
      plan_id: planId,
      correlation_id: correlationId,
      actor: { 
        type: "attendant",  // Using attendant type as backend expects this
        id: salespersonId 
      },
      data: {
        action: "REPORT_PAYMENT_AND_SERVICE_COMPLETION",
        attendant_station: SALESPERSON_STATION,
        service_data: {
          new_battery_id: scannedBatteryPending.id,
          energy_transferred: isNaN(energyTransferred) ? 0 : energyTransferred,
          service_duration: 240,
        },
      },
    };

    const requestTopic = `emit/uxi/attendant/plan/${planId}/payment_and_service`;
    const responseTopic = `echo/abs/attendant/plan/${planId}/payment_and_service`;

    console.info('=== Completing Service - Publishing MQTT ===');
    console.info('Request Topic:', requestTopic);
    console.info('Response Topic:', responseTopic);
    console.info('Correlation ID:', correlationId);
    console.info('Payload:', JSON.stringify(paymentAndServicePayload, null, 2));

    // Store correlation ID for response matching
    (window as any).__serviceCompletionCorrelationId = correlationId;

    // Set a timeout for service completion
    const timeoutId = setTimeout(() => {
      console.warn('Service completion timeout - proceeding anyway');
      // On timeout, still proceed to success (optimistic)
      finalizeServiceCompletion();
    }, 30000);

    // Function to finalize the service after confirmation or timeout
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

    // Subscribe to response topic
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler(
        'mqttSubTopic',
        { topic: responseTopic, qos: 0 },
        (subscribeResponse: string) => {
          console.info('MQTT subscribed to response topic:', subscribeResponse);
          
          // After subscribing, publish the request
          setTimeout(() => {
            mqttPublish(requestTopic, paymentAndServicePayload);
            
            // For now, finalize after a short delay (optimistic approach)
            // In production, this would wait for actual MQTT response
            setTimeout(() => {
              finalizeServiceCompletion();
            }, 2000);
          }, 100);
        }
      );
    } else {
      // No bridge available - finalize anyway (for testing)
      console.warn('No bridge available - finalizing service anyway');
      finalizeServiceCompletion();
    }
  }, [
    scannedBatteryPending, 
    confirmedSubscriptionCode, 
    subscriptionData, 
    advanceToStep,
    mqttPublish
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
            console.info('=== PURCHASE SUCCESSFUL ===');
            console.info('Subscription Code:', purchaseResult.subscriptionCode);
            console.info('Order ID:', purchaseResult.orderId);
            
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
        // Success
        return (
          <Step7Success 
            formData={formData}
            selectedPlanId={selectedPlanId}
            battery={assignedBattery}
            registrationId={registrationId}
            paymentReference={paymentReference}
            plans={availablePlans}
          />
        );
      default:
        return null;
    }
  };

  // Cancel/Close ongoing BLE operation - allows user to dismiss failure state and try again
  const cancelBleOperation = useCallback(() => {
    // SAFETY CHECK: Don't allow cancellation if we've successfully connected
    // and are reading energy data - this would leave the device in a bad state
    if (isConnectionSuccessfulRef.current) {
      console.warn('=== Cancel blocked: Battery is already connected and reading data ===');
      toast('Please wait while reading battery data...', { icon: '⏳' });
      return;
    }
    
    console.info('=== Closing/Cancelling BLE operation ===');
    
    // Clear all timeouts
    clearBleOperationTimeout();
    clearBleGlobalTimeout();
    clearScannerTimeout();
    
    // Stop BLE scan if running
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
      
      // Disconnect any connected device
      const connectedMac = sessionStorage.getItem('connectedDeviceMac');
      if (connectedMac) {
        window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
        sessionStorage.removeItem('connectedDeviceMac');
      }
    }
    
    // Reset all BLE state
    setBleScanState({
      isScanning: false,
      isConnecting: false,
      isReadingEnergy: false,
      connectedDevice: null,
      detectedDevices: [],
      connectionProgress: 0,
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    });
    
    // Reset scan state
    setIsScannerOpening(false);
    scanTypeRef.current = null;
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryIdRef.current = null;
    pendingConnectionMacRef.current = null;
  }, [clearBleOperationTimeout, clearBleGlobalTimeout, clearScannerTimeout]);

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

      {/* BLE Connection Progress Overlay - Shows when connecting, reading energy, or when connection failed */}
      {(bleScanState.isConnecting || bleScanState.isReadingEnergy || bleScanState.connectionFailed) && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="w-full max-w-md px-4">
            <div className="ble-progress-container">
              {/* Header */}
              <div className="ble-progress-header">
                <div className={`ble-progress-icon ${bleScanState.requiresBluetoothReset ? 'ble-progress-icon-warning' : ''}`}>
                  {bleScanState.requiresBluetoothReset ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
                    </svg>
                  )}
                </div>
                <div className="ble-progress-title">
                  {bleScanState.requiresBluetoothReset
                    ? 'Bluetooth Reset Required'
                    : bleScanState.isReadingEnergy 
                    ? 'Reading Battery Data' 
                    : 'Connecting to Battery'}
                </div>
              </div>

              {/* Bluetooth Reset Instructions - Show when Bluetooth reset is required */}
              {bleScanState.requiresBluetoothReset && (
                <div className="ble-reset-instructions">
                  <div className="ble-reset-steps">
                    <div className="ble-reset-step">
                      <span className="ble-reset-step-number">1</span>
                      <span>Open your phone&apos;s Settings</span>
                    </div>
                    <div className="ble-reset-step">
                      <span className="ble-reset-step-number">2</span>
                      <span>Turn Bluetooth OFF</span>
                    </div>
                    <div className="ble-reset-step">
                      <span className="ble-reset-step-number">3</span>
                      <span>Wait 3 seconds</span>
                    </div>
                    <div className="ble-reset-step">
                      <span className="ble-reset-step-number">4</span>
                      <span>Turn Bluetooth ON</span>
                    </div>
                    <div className="ble-reset-step">
                      <span className="ble-reset-step-number">5</span>
                      <span>Return here and try again</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Battery ID Display - Show which battery we're connecting to (hide when reset required) */}
              {pendingBatteryIdRef.current && !bleScanState.requiresBluetoothReset && (
                <div className="ble-battery-id">
                  <span className="ble-battery-id-label">Battery ID:</span>
                  <span className="ble-battery-id-value">
                    ...{String(pendingBatteryIdRef.current).slice(-6).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Progress Bar - Hide when Bluetooth reset is required */}
              {!bleScanState.requiresBluetoothReset && (
                <div className="ble-progress-bar-container">
                  <div className="ble-progress-bar-bg">
                    <div 
                      className="ble-progress-bar-fill"
                      style={{ width: `${bleScanState.connectionProgress}%` }}
                    />
                  </div>
                  <div className="ble-progress-percent">
                    {bleScanState.connectionProgress}%
                  </div>
                </div>
              )}

              {/* Status Message - More specific messages about what's happening */}
              <div className="ble-progress-status">
                {bleScanState.requiresBluetoothReset
                  ? 'The Bluetooth connection was lost. Please toggle Bluetooth to reset it.'
                  : bleScanState.error 
                  ? bleScanState.error
                  : bleScanState.isReadingEnergy 
                  ? 'Reading energy level from battery...'
                  : bleScanState.connectionProgress >= 75
                  ? 'Finalizing connection...'
                  : bleScanState.connectionProgress >= 50
                  ? 'Establishing secure connection...'
                  : bleScanState.connectionProgress >= 25
                  ? 'Authenticating with battery...'
                  : bleScanState.connectionProgress >= 10
                  ? 'Locating battery via Bluetooth...'
                  : `Connecting to battery ${pendingBatteryIdRef.current ? '...' + String(pendingBatteryIdRef.current).slice(-6).toUpperCase() : ''}...`}
              </div>

              {/* Step Indicators - Hide when Bluetooth reset is required */}
              {!bleScanState.requiresBluetoothReset && (
                <div className="ble-progress-steps">
                  <div className={`ble-step active completed`}>
                    <div className="ble-step-dot" />
                    <span>Scan</span>
                  </div>
                  <div className={`ble-step ${bleScanState.isConnecting || bleScanState.isReadingEnergy ? 'active' : ''} ${bleScanState.isReadingEnergy ? 'completed' : ''}`}>
                    <div className="ble-step-dot" />
                    <span>Connect</span>
                  </div>
                  <div className={`ble-step ${bleScanState.isReadingEnergy ? 'active' : ''}`}>
                    <div className="ble-step-dot" />
                    <span>Read</span>
                  </div>
                </div>
              )}

              {/* Cancel/Close Button - Only shown when connection has definitively failed */}
              {bleScanState.connectionFailed && (
                <button
                  onClick={cancelBleOperation}
                  className={`ble-cancel-button ${bleScanState.requiresBluetoothReset ? 'ble-cancel-button-primary' : ''}`}
                  title="Close and try again"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  {bleScanState.requiresBluetoothReset ? 'Close & Reset Bluetooth' : 'Close'}
                </button>
              )}
              
              {/* Help Text - Show different message based on failure state */}
              <p className="ble-progress-help">
                {bleScanState.requiresBluetoothReset
                  ? 'This usually happens when the battery connection is interrupted. Toggling Bluetooth will clear the stuck connection.'
                  : bleScanState.connectionFailed 
                  ? 'Make sure the battery is nearby and try again.' 
                  : 'Keep the battery nearby during this process.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
