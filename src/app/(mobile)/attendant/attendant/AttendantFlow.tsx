'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { getAttendantUser, clearEmployeeLogin } from '@/lib/attendant-auth';
import { connBleByMacAddress, initServiceBleData } from '@/app/utils';
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
  BleDevice,
  BleScanState,
  PaymentInitiation,
} from './components';
import ProgressiveLoading from '@/components/loader/progressiveLoading';

// Import Odoo API functions for payment
import {
  initiatePayment,
  confirmPaymentManual,
} from '@/lib/odoo-api';

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
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [paymentInitiationData, setPaymentInitiationData] = useState<PaymentInitiation | null>(null);
  
  // Phase states
  const [paymentAndServiceStatus, setPaymentAndServiceStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  
  // Flow error state - tracks failures that end the process
  const [flowError, setFlowError] = useState<FlowError | null>(null);
  
  // BLE Scan-to-Bind state for battery energy reading
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
  
  // BLE operation timeout ref - for cancelling stuck operations
  const bleOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Global BLE timeout ref - last resort when connection hangs without error callbacks
  const bleGlobalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // BLE retry state
  const bleRetryCountRef = useRef<number>(0);
  // Track whether connection was successful - prevents retrying when already connected but initializing services
  const isConnectionSuccessfulRef = useRef<boolean>(false);
  const MAX_BLE_RETRIES = 3;
  const BLE_CONNECTION_TIMEOUT = 15000; // 15 seconds for connection
  const BLE_DATA_READ_TIMEOUT = 20000; // 20 seconds for data reading
  const BLE_GLOBAL_TIMEOUT = 90000; // 90 seconds (1m 30s) - last resort timeout when no error callbacks received
  
  // Refs for BLE scanning
  const detectedBleDevicesRef = useRef<BleDevice[]>([]);
  const pendingBatteryQrCodeRef = useRef<string | null>(null);
  const pendingBatteryScanTypeRef = useRef<'old_battery' | 'new_battery' | null>(null);
  const pendingConnectionMacRef = useRef<string | null>(null); // MAC address we're attempting to connect to
  
  // DTA refresh retry state - for retrying when DTA values are missing/invalid
  const dtaRefreshRetryCountRef = useRef<number>(0);
  const MAX_DTA_REFRESH_RETRIES = 2; // Retry up to 2 times (total 3 attempts)
  const DTA_REFRESH_DELAY = 1500; // 1.5 seconds delay between DTA refresh retries
  
  // Stats (fetched from API in a real implementation)
  const [stats] = useState({ today: 0, thisWeek: 0, successRate: 0 });

  // Transaction ID
  const [transactionId, setTransactionId] = useState<string>('');
  
  // Ref for correlation ID
  const correlationIdRef = useRef<string>('');
  
  // Ref for tracking current scan type
  const scanTypeRef = useRef<'customer' | 'old_battery' | 'new_battery' | 'payment' | null>(null);
  
  // Bridge initialization ref (for preventing double init() calls)
  const bridgeInitRef = useRef<boolean>(false);
  
  // Track if QR scan was initiated to detect when user returns without scanning
  const qrScanInitiatedRef = useRef<boolean>(false);
  
  // BLE handlers ready flag - ensures we don't start scanning before handlers are registered
  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);
  
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

  // Helper to clear BLE operation timeout
  const clearBleOperationTimeout = useCallback(() => {
    if (bleOperationTimeoutRef.current) {
      clearTimeout(bleOperationTimeoutRef.current);
      bleOperationTimeoutRef.current = null;
    }
  }, []);

  // Helper to clear global BLE timeout (90s last resort)
  const clearBleGlobalTimeout = useCallback(() => {
    if (bleGlobalTimeoutRef.current) {
      clearTimeout(bleGlobalTimeoutRef.current);
      bleGlobalTimeoutRef.current = null;
    }
  }, []);

  // Cancel/Close ongoing BLE operation - allows user to dismiss failure state and try again
  // NOTE: Cancellation is blocked when already connected and reading data to prevent orphaned connections
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
    clearScanTimeout();
    
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
    setIsScanning(false);
    scanTypeRef.current = null;
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryScanTypeRef.current = null;
    pendingConnectionMacRef.current = null;
    bleRetryCountRef.current = 0;
    isConnectionSuccessfulRef.current = false;
  }, [clearBleOperationTimeout, clearBleGlobalTimeout, clearScanTimeout]);

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

  // Start BLE scanning for nearby devices
  // NOTE: This does NOT clear detected devices - devices accumulate over time
  // This mirrors keypad behavior where BLE scan runs continuously and devices build up
  const startBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      console.error('WebViewJavascriptBridge not available for BLE scan');
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      'startBleScan',
      '',
      (responseData: string) => {
        console.info('BLE scan started:', responseData);
      }
    );
    
    // Just set isScanning flag - DON'T clear detected devices
    // Devices accumulate over time for better matching
    setBleScanState(prev => ({
      ...prev,
      isScanning: true,
      error: null,
    }));
  }, []);

  // Stop BLE scanning
  const stopBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;

    window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    setBleScanState(prev => ({
      ...prev,
      isScanning: false,
    }));
  }, []);

  // Connect to a BLE device by MAC address with timeout handling
  const connectBleDevice = useCallback((macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth bridge not available');
      return;
    }

    // Clear any existing timeout
    clearBleOperationTimeout();
    
    // Reset connection success flag - this will be set to true in bleConnectSuccessCallBack
    isConnectionSuccessfulRef.current = false;
    
    // Reset retry count when starting a fresh connection
    bleRetryCountRef.current = 0;
    
    // Store the MAC address we're trying to connect to (for retry logic in failure callback)
    pendingConnectionMacRef.current = macAddress;
    
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: 0,
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    }));

    // NOTE: We intentionally do NOT set a timeout for retries here.
    // Retries should ONLY happen when we receive an actual failure callback
    // from bleConnectFailCallBack. This prevents retrying during normal
    // connection + initialization time which can take longer than expected.
    // The bleConnectFailCallBack and bleConnectSuccessCallBack will handle
    // all connection state updates.

    connBleByMacAddress(macAddress, (responseData: string) => {
      console.info('BLE connection initiated:', responseData);
    });
  }, [clearBleOperationTimeout]);

  // Extract energy from DTA service data
  // rcap = Remaining Capacity in mAh (milliamp-hours)
  // fccp = Full Charge Capacity in mAh
  // pckv = Pack Voltage in mV (millivolts)
  // Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
  // Returns { energy: Wh, fullCapacity: Wh, chargePercent: % } or null on failure
  const populateEnergyFromDta = useCallback((serviceData: any): { energy: number; fullCapacity: number; chargePercent: number } | null => {
    if (!serviceData || !Array.isArray(serviceData.characteristicList)) {
      console.warn('Invalid DTA service data for energy calculation');
      return null;
    }

    const getCharValue = (name: string) => {
      const char = serviceData.characteristicList.find(
        (c: any) => c.name?.toLowerCase() === name.toLowerCase()
      );
      return char?.realVal ?? null;
    };

    const rcapRaw = getCharValue('rcap');  // Remaining Capacity in mAh
    const fccpRaw = getCharValue('fccp');  // Full Charge Capacity in mAh
    const pckvRaw = getCharValue('pckv');  // Pack Voltage in mV
    const rsocRaw = getCharValue('rsoc');  // Relative State of Charge (%)

    const rcap = rcapRaw !== null ? parseFloat(rcapRaw) : NaN;
    const fccp = fccpRaw !== null ? parseFloat(fccpRaw) : NaN;
    const pckv = pckvRaw !== null ? parseFloat(pckvRaw) : NaN;
    const rsoc = rsocRaw !== null ? parseFloat(rsocRaw) : NaN;

    if (!Number.isFinite(rcap) || !Number.isFinite(pckv)) {
      console.warn('Unable to parse rcap/pckv from DTA service', {
        rcapRaw,
        pckvRaw,
      });
      return null;
    }

    // Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
    // Example: 15290 mAh × 75470 mV / 1,000,000 = 1,154 Wh = 1.15 kWh
    const energy = (rcap * pckv) / 1_000_000;
    const fullCapacity = Number.isFinite(fccp) ? (fccp * pckv) / 1_000_000 : 0;

    if (!Number.isFinite(energy)) {
      console.warn('Computed energy is not a finite number', {
        rcap,
        pckv,
        energy,
      });
      return null;
    }

    // Calculate charge percentage from rcap/fccp, fallback to rsoc if fccp unavailable
    let chargePercent: number;
    if (Number.isFinite(fccp) && fccp > 0) {
      chargePercent = Math.round((rcap / fccp) * 100);
    } else if (Number.isFinite(rsoc)) {
      chargePercent = Math.round(rsoc);
    } else {
      chargePercent = 0;
    }

    // Clamp charge percent to 0-100
    chargePercent = Math.max(0, Math.min(100, chargePercent));

    console.info('Energy calculated from DTA service:', {
      rcap_mAh: rcap,
      fccp_mAh: fccp,
      pckv_mV: pckv,
      pckv_V: pckv / 1000,
      rsoc_percent: rsoc,
      computed_energy_Wh: energy,
      computed_energy_kWh: energy / 1000,
      computed_fullCapacity_Wh: fullCapacity,
      computed_fullCapacity_kWh: fullCapacity / 1000,
      computed_chargePercent: chargePercent,
    });

    return {
      energy: Math.round(energy * 100) / 100, // Round to 2 decimal places (Wh)
      fullCapacity: Math.round(fullCapacity * 100) / 100,
      chargePercent,
    };
  }, []);

  // Handle matching QR code to detected BLE device and initiate connection
  // Uses exponential backoff retry strategy for better reliability
  const handleBleDeviceMatch = useCallback((qrCode: string, retryAttempt: number = 0) => {
    const MAX_MATCH_RETRIES = 4; // Total 5 attempts (0-4)
    const RETRY_DELAYS = [2000, 3000, 4000, 5000]; // Exponential backoff delays
    
    const last6 = qrCode.slice(-6).toLowerCase();
    const devices = detectedBleDevicesRef.current;
    
    console.info('Attempting to match QR code to BLE device:', {
      qrCode,
      last6,
      detectedDevices: devices.length,
      attempt: retryAttempt + 1,
      maxAttempts: MAX_MATCH_RETRIES + 1,
    });

    // Start global timeout on first attempt (when modal first appears)
    // This is a last resort safety net - if no success or error after 90 seconds,
    // show user instructions to toggle Bluetooth
    if (retryAttempt === 0) {
      clearBleGlobalTimeout();
      bleGlobalTimeoutRef.current = setTimeout(() => {
        console.warn('=== BLE GLOBAL TIMEOUT (90s) - Connection hung without error callback ===');
        
        // Clear other timeouts
        clearBleOperationTimeout();
        clearScanTimeout();
        
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
        setIsScanning(false);
        scanTypeRef.current = null;
        isConnectionSuccessfulRef.current = false;
      }, BLE_GLOBAL_TIMEOUT);
    }

    // Show connecting modal with progress based on retry attempt
    const progressPercent = Math.min(5 + (retryAttempt * 15), 60);
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: progressPercent,
      error: null, // Silently retry without affecting user confidence
    }));

    // Find device where last 6 chars of name match
    const matchedDevice = devices.find(device => {
      const deviceLast6 = (device.name || '').toLowerCase().slice(-6);
      return deviceLast6 === last6;
    });

    if (matchedDevice) {
      console.info('Found matching BLE device:', matchedDevice);
      stopBleScan();
      bleRetryCountRef.current = 0; // Reset retry count for connection phase
      connectBleDevice(matchedDevice.macAddress);
      return true;
    } else {
      console.warn(`No matching BLE device found (attempt ${retryAttempt + 1}). Available devices:`, 
        devices.map(d => `${d.name} (${d.rssi})`));
      
      // Check if we should retry
      if (retryAttempt < MAX_MATCH_RETRIES) {
        const delay = RETRY_DELAYS[retryAttempt] || 5000;
        console.info(`Will retry in ${delay}ms...`);
        
        // Update UI to show searching progress (silently retry without showing attempt count)
        setBleScanState(prev => ({
          ...prev,
          connectionProgress: progressPercent + 5,
          error: null, // Silently retry without affecting user confidence
        }));
        
        // Schedule retry with exponential backoff
        setTimeout(() => {
          handleBleDeviceMatch(qrCode, retryAttempt + 1);
        }, delay);
        
        return false;
      } else {
        // All retries exhausted
        console.error('No matching BLE device found after all retries');
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
        setIsScanning(false);
        scanTypeRef.current = null;
        pendingBatteryQrCodeRef.current = null;
        pendingBatteryScanTypeRef.current = null;
        stopBleScan();
        
        return false;
      }
    }
  }, [stopBleScan, connectBleDevice, clearBleGlobalTimeout, clearBleOperationTimeout, clearScanTimeout]);

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
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode, // Same ID used by ABS and Odoo
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    phone: normalizedData.phone || '', // For M-Pesa payment
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
    
    // Store the scanned battery ID for later use after BLE connection
    pendingBatteryQrCodeRef.current = scannedBatteryId;
    pendingBatteryScanTypeRef.current = 'old_battery';
    
    // Start scan-to-bind process - match QR code to BLE device
    console.info('Old battery QR scanned, initiating scan-to-bind:', scannedBatteryId);
    
    // If BLE scanning hasn't started yet, start it (it should already be running)
    if (!bleScanState.isScanning) {
      startBleScan();
      // Wait a moment for devices to be discovered before matching
      setTimeout(() => {
        handleBleDeviceMatch(scannedBatteryId);
      }, 1000);
    } else {
      // BLE scan already running, try to match immediately
      handleBleDeviceMatch(scannedBatteryId);
    }
  }, [customerType, customerData?.currentBatteryId, clearScanTimeout, stopBleScan, startBleScan, bleScanState.isScanning, handleBleDeviceMatch]);

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
    
    // Store the scanned battery ID for later use after BLE connection
    pendingBatteryQrCodeRef.current = scannedBatteryId;
    pendingBatteryScanTypeRef.current = 'new_battery';
    
    // Start scan-to-bind process - match QR code to BLE device
    console.info('New battery QR scanned, initiating scan-to-bind:', scannedBatteryId);
    
    // If BLE scanning hasn't started yet, start it (it should already be running)
    if (!bleScanState.isScanning) {
      startBleScan();
      // Wait a moment for devices to be discovered before matching
      setTimeout(() => {
        handleBleDeviceMatch(scannedBatteryId);
      }, 1000);
    } else {
      // BLE scan already running, try to match immediately
      handleBleDeviceMatch(scannedBatteryId);
    }
  }, [clearScanTimeout, startBleScan, bleScanState.isScanning, handleBleDeviceMatch, swapData.oldBattery?.id, stopBleScan]);

  // Initiate payment with Odoo (tell Odoo we're about to collect payment)
  // Uses subscriptionId which is the same as servicePlanId - shared between ABS and Odoo
  const initiateOdooPayment = useCallback(async (): Promise<boolean> => {
    // subscriptionId is the servicePlanId - same ID used by both ABS and Odoo
    const subscriptionCode = customerData?.subscriptionId || dynamicPlanId;
    
    if (!subscriptionCode) {
      console.log('No subscription ID, skipping payment initiation');
      setPaymentInitiated(true);
      return true;
    }

    // Get customer phone - try from customerData first
    const phoneNumber = customerData?.phone || '';
    
    try {
      console.log('Initiating payment with Odoo:', {
        subscription_code: subscriptionCode,
        phone_number: phoneNumber,
        amount: swapData.cost,
      });

      const response = await initiatePayment({
        subscription_code: subscriptionCode,
        phone_number: phoneNumber,
        amount: swapData.cost,
      });

      if (response.success && response.data) {
        console.log('Payment initiated:', response.data);
        setPaymentInitiated(true);
        setPaymentInitiationData({
          transactionId: response.data.transaction_id,
          checkoutRequestId: response.data.checkout_request_id,
          merchantRequestId: response.data.merchant_request_id,
          instructions: response.data.instructions,
        });
        
        if (phoneNumber) {
          toast.success(response.data.instructions || 'Check customer phone for M-Pesa prompt');
        }
        return true;
      } else {
        throw new Error('Payment initiation failed');
      }
    } catch (error: any) {
      console.error('Failed to initiate payment:', error);
      // Don't block the flow - user can still enter receipt manually
      setPaymentInitiated(true);
      toast.error('Could not send M-Pesa prompt. Customer must enter receipt manually.');
      return true; // Allow to continue
    }
  }, [customerData, dynamicPlanId, swapData.cost]);

  // Process payment QR code data - verify with Odoo
  // Uses subscriptionId which is the same as servicePlanId - shared between ABS and Odoo
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
      // subscriptionId is the servicePlanId - same ID used by both ABS and Odoo
      const subscriptionCode = customerData?.subscriptionId || dynamicPlanId;
      
      try {
        if (subscriptionCode) {
          // Use Odoo manual confirmation endpoint
          console.log('Confirming payment with Odoo:', {
            subscription_code: subscriptionCode,
            receipt,
            customer_id: customerData?.id,
          });

          const response = await confirmPaymentManual({
            subscription_code: subscriptionCode,
            receipt,
            customer_id: customerData?.id,
          });
          
          if (response.success) {
            setPaymentConfirmed(true);
            setPaymentReceipt(receipt);
            setTransactionId(receipt);
            toast.success('Payment submitted for validation');
            publishPaymentAndService(receipt);
          } else {
            throw new Error('Payment confirmation failed');
          }
        } else {
          // No subscription ID - just proceed with MQTT flow
          setPaymentConfirmed(true);
          setPaymentReceipt(receipt);
          setTransactionId(receipt);
          toast.success('Payment confirmed');
          publishPaymentAndService(receipt);
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
  }, [dynamicPlanId, swapData.cost, customerData]);

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

  // Ref for populateEnergyFromDta to use in callbacks
  const populateEnergyFromDtaRef = useRef(populateEnergyFromDta);
  useEffect(() => {
    populateEnergyFromDtaRef.current = populateEnergyFromDta;
  }, [populateEnergyFromDta]);

  // Ref for electricityService to avoid re-registering handlers when service data changes
  const electricityServiceRef = useRef(electricityService);
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

    // BLE device discovery callback - for scan-to-bind functionality
    const offFindBle = reg(
      "findBleDeviceCallBack",
      (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
        try {
          const d: any = JSON.parse(data);
          
          // Log ALL incoming BLE devices for debugging (even non-OVES)
          console.info(`[BLE] Device found: ${d.name || 'unnamed'} (${d.macAddress}) RSSI: ${d.rssi}`);
          
          // Only process OVES devices (same filter as swap.tsx)
          if (d.macAddress && d.name && d.rssi && d.name.includes("OVES")) {
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
            } else {
              console.info(`[BLE] New OVES device added: ${d.name} - Total: ${detectedBleDevicesRef.current.length + 1}`);
              detectedBleDevicesRef.current = [...detectedBleDevicesRef.current, device];
            }
            
            // Sort by signal strength (highest first)
            detectedBleDevicesRef.current.sort((a, b) => b.rawRssi - a.rawRssi);
            
            // Also update state for UI feedback
            setBleScanState(prev => ({
              ...prev,
              detectedDevices: [...detectedBleDevicesRef.current],
            }));
            
            resp({ success: true });
          } else {
            // Silently ignore non-OVES devices
            resp({ success: true });
          }
        } catch (err: any) {
          console.error("Error parsing BLE device data:", err);
          resp({ success: false, error: err.message });
        }
      }
    );

    // BLE connection success callback - This fires when step 2 (BLE connection) succeeds
    // FLOW: Scan → Connect (step 2) → Init/Read DTA data (step 3)
    // Step 3 takes longer, so we must NOT allow retries during it
    const offBleConnectSuccess = reg(
      "bleConnectSuccessCallBack",
      (macAddress: string, resp: any) => {
        console.info("BLE connection successful (step 2 complete):", macAddress);
        sessionStorage.setItem("connectedDeviceMac", macAddress);
        
        // CRITICAL: Mark connection as successful IMMEDIATELY before starting step 3
        // This prevents bleConnectFailCallBack from triggering retries during step 3 (init/read)
        // which can take a long time. Any failure callback after this point is ignored.
        isConnectionSuccessfulRef.current = true;
        
        // Clear any pending timeout since we connected successfully
        if (bleOperationTimeoutRef.current) {
          clearTimeout(bleOperationTimeoutRef.current);
          bleOperationTimeoutRef.current = null;
        }
        bleRetryCountRef.current = 0; // Reset retry count
        pendingConnectionMacRef.current = null; // Clear pending MAC since we're now connected
        
        setBleScanState(prev => ({
          ...prev,
          isConnecting: false,
          isReadingEnergy: true,
          connectedDevice: macAddress,
          connectionProgress: 100,
          error: null,
          connectionFailed: false, // Explicitly mark as not failed
          requiresBluetoothReset: false,
        }));
        
        // Set timeout for data reading phase
        bleOperationTimeoutRef.current = setTimeout(() => {
          console.warn('BLE data reading timed out after', BLE_DATA_READ_TIMEOUT, 'ms');
          
          setBleScanState(prev => ({
            ...prev,
            isReadingEnergy: false,
            error: 'Data reading timed out',
          }));
          
          // Disconnect from device
          if (window.WebViewJavascriptBridge) {
            window.WebViewJavascriptBridge.callHandler("disconnectBle", macAddress, () => {});
          }
          
          toast.error('Could not read battery data. Please try scanning again.');
          setIsScanning(false);
          scanTypeRef.current = null;
          pendingBatteryQrCodeRef.current = null;
          pendingBatteryScanTypeRef.current = null;
          isConnectionSuccessfulRef.current = false;
        }, BLE_DATA_READ_TIMEOUT);
        
        // Request DTA service to read energy data
        console.info("Requesting DTA service data for energy calculation...");
        initServiceBleData(
          { serviceName: "DTA", macAddress },
          () => {
            console.info("DTA service data requested for:", macAddress);
          }
        );
        
        resp(macAddress);
      }
    );

    // BLE connection failure callback - ONLY place where retries should happen
    // This fires when step 2 (BLE connection) explicitly fails
    // IMPORTANT: We ONLY retry here on actual failure callbacks, NOT on timeouts
    // FLOW: Scan → Connect (step 2) → Init/Read DTA data (step 3)
    const offBleConnectFail = reg(
      "bleConnectFailCallBack",
      (data: string, resp: any) => {
        console.error("BLE connection failed (step 2):", data);
        
        // Clear any existing timeout since we got an explicit response
        if (bleOperationTimeoutRef.current) {
          clearTimeout(bleOperationTimeoutRef.current);
          bleOperationTimeoutRef.current = null;
        }
        
        // CRITICAL: If step 2 already succeeded and we're now in step 3 (init/read),
        // ignore this callback - it's likely a stale/delayed failure from an earlier attempt
        if (isConnectionSuccessfulRef.current) {
          console.info("Connection failure callback received but step 2 already succeeded (now in step 3) - ignoring");
          resp(data);
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
              console.info("Connection succeeded during retry delay - cancelling retry from failure handler");
              return;
            }
            connBleByMacAddress(pendingMac, () => {
              console.info("BLE retry connection initiated");
            });
          }, 1000 * bleRetryCountRef.current); // Exponential backoff
          
          resp(data);
          return;
        }
        
        // All retries exhausted - mark as definitively failed
        console.error("BLE connection failed after all retries or no MAC address available");
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
        setIsScanning(false);
        scanTypeRef.current = null;
        pendingBatteryQrCodeRef.current = null;
        pendingBatteryScanTypeRef.current = null;
        
        resp(data);
      }
    );

    // BLE service data progress callback - used when reading service data (DTA for energy)
    // IMPORTANT: This is bleInitServiceDataOnProgressCallBack, NOT bleInitDataOnProgressCallBack
    // The former is for initServiceBleData (specific service), the latter is for initBleData (all data)
    const offBleServiceProgress = reg(
      "bleInitServiceDataOnProgressCallBack",
      (data: string) => {
        try {
          const p = JSON.parse(data);
          const progress = Math.round((p.progress / p.total) * 100);
          console.info("BLE service data progress:", progress, "%");
          setBleScanState(prev => ({
            ...prev,
            connectionProgress: progress,
          }));
        } catch (err) {
          console.error("Service progress callback error:", err);
        }
      }
    );

    // BLE service data complete callback - this is where we get the energy data
    const offBleInitServiceComplete = reg(
      "bleInitServiceDataOnCompleteCallBack",
      (data: string, resp: any) => {
        try {
          const parsedData = typeof data === "string" ? JSON.parse(data) : data;
          
          // Check if this response indicates an error (e.g., "Bluetooth device not connected")
          // This can happen when the DTA refresh is called but the device becomes unreachable
          const respCode = parsedData?.respCode || parsedData?.responseData?.respCode;
          const respDesc = parsedData?.respDesc || parsedData?.responseData?.respDesc || '';
          
          if (respCode && respCode !== "200" && respCode !== 200) {
            console.error("DTA service returned error:", { respCode, respDesc, parsedData });
            
            // Check if this is a "Bluetooth device not connected" error
            const isBluetoothDisconnected = 
              typeof respDesc === 'string' && (
                respDesc.toLowerCase().includes('bluetooth device not connected') ||
                respDesc.toLowerCase().includes('device not connected') ||
                respDesc.toLowerCase().includes('not connected')
              );
            
            if (isBluetoothDisconnected) {
              console.warn("Detected 'Bluetooth device not connected' in DTA response - requiring Bluetooth reset");
              
              // Clear global timeout since we've reached an error state
              if (bleGlobalTimeoutRef.current) {
                clearTimeout(bleGlobalTimeoutRef.current);
                bleGlobalTimeoutRef.current = null;
              }
              
              setBleScanState(prev => ({
                ...prev,
                isReadingEnergy: false,
                error: 'Bluetooth connection lost',
                connectionFailed: true,
                requiresBluetoothReset: true,
              }));
              
              // Reset state
              dtaRefreshRetryCountRef.current = 0;
              toast.dismiss('dta-refresh');
              setIsScanning(false);
              scanTypeRef.current = null;
              pendingBatteryQrCodeRef.current = null;
              pendingBatteryScanTypeRef.current = null;
              isConnectionSuccessfulRef.current = false;
              
              toast.error('Please turn Bluetooth OFF then ON and try again.');
              resp({ success: false, error: respDesc });
              return;
            }
          }
          
          // Only process DTA_SERVICE responses
          if (parsedData?.serviceNameEnum === "DTA_SERVICE") {
            console.info("DTA service data received:", parsedData);
            
            // Clear data reading timeout since we got data
            if (bleOperationTimeoutRef.current) {
              clearTimeout(bleOperationTimeoutRef.current);
              bleOperationTimeoutRef.current = null;
            }
            
            // Extract energy data from DTA service
            // Returns { energy: Wh, fullCapacity: Wh, chargePercent: % } or null
            const energyData = populateEnergyFromDtaRef.current(parsedData);
            const scannedBatteryId = pendingBatteryQrCodeRef.current;
            const scanType = pendingBatteryScanTypeRef.current;
            const connectedMac = sessionStorage.getItem("connectedDeviceMac");
            
            // Helper function to disconnect and reset BLE state
            const disconnectAndResetBleState = () => {
              if (window.WebViewJavascriptBridge && connectedMac) {
                window.WebViewJavascriptBridge.callHandler("disconnectBle", connectedMac, () => {});
              }
              setBleScanState(prev => ({
                ...prev,
                isReadingEnergy: false,
                connectedDevice: null,
              }));
            };
            
            if (energyData !== null && scannedBatteryId) {
              // Success - disconnect now
              disconnectAndResetBleState();
              const { energy, chargePercent } = energyData;
              console.info(`Battery energy read: ${energy} Wh (${(energy / 1000).toFixed(3)} kWh) at ${chargePercent}% for ${scanType}`);
              
              if (scanType === 'old_battery') {
                // Create old battery data with actual energy from rcap (in Wh)
                const oldBattery: BatteryData = {
                  id: scannedBatteryId,
                  shortId: String(scannedBatteryId).slice(-6),
                  chargeLevel: chargePercent,
                  energy: energy, // rcap in Wh
                  macAddress: sessionStorage.getItem("connectedDeviceMac") || undefined,
                };
                
                setSwapData(prev => ({ ...prev, oldBattery }));
                advanceToStep(3);
                toast.success(`Old battery scanned: ${(energy / 1000).toFixed(3)} kWh (${chargePercent}%)`);
              } else if (scanType === 'new_battery') {
                // Create new battery data and calculate differential
                const newBattery: BatteryData = {
                  id: scannedBatteryId,
                  shortId: String(scannedBatteryId).slice(-6),
                  chargeLevel: chargePercent,
                  energy: energy, // rcap in Wh
                  macAddress: sessionStorage.getItem("connectedDeviceMac") || undefined,
                };
                
                // Calculate energy difference and cost using actual energy values
                // Energy from BLE (rcap) is in Wh, rate is per kWh - convert Wh to kWh
                setSwapData(prev => {
                  const oldEnergy = prev.oldBattery?.energy || 0;
                  const energyDiffWh = energy - oldEnergy; // Energy diff in Wh
                  const energyDiffKwh = energyDiffWh / 1000; // Convert to kWh for billing
                  // Use ref to get latest electricityService value without causing callback recreation
                  const rate = electricityServiceRef.current?.usageUnitPrice || prev.rate;
                  const cost = Math.round(energyDiffKwh * rate * 100) / 100; // Cost based on kWh
                  
                  console.info('Energy differential calculated:', {
                    oldEnergyWh: oldEnergy,
                    oldEnergyKwh: oldEnergy / 1000,
                    newEnergyWh: energy,
                    newEnergyKwh: energy / 1000,
                    energyDiffWh,
                    energyDiffKwh,
                    ratePerKwh: rate,
                    cost,
                  });
                  
                  return {
                    ...prev,
                    newBattery,
                    energyDiff: Math.round(energyDiffKwh * 1000) / 1000, // Store in kWh with 3 decimal places
                    cost: cost > 0 ? cost : 0,
                  };
                });
                
                advanceToStep(4);
                toast.success(`New battery scanned: ${(energy / 1000).toFixed(3)} kWh (${chargePercent}%)`);
              }
            } else {
              // DTA data received but energy values are missing/invalid
              // Implement refresh mechanism similar to BLE Details Page
              
              if (!scannedBatteryId) {
                // No battery ID - this is a different error, don't retry
                console.warn("Missing battery ID - cannot proceed");
                toast.error('Could not identify battery. Please try again.');
                
                // Disconnect and reset
                disconnectAndResetBleState();
                dtaRefreshRetryCountRef.current = 0;
                setIsScanning(false);
                scanTypeRef.current = null;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryScanTypeRef.current = null;
                isConnectionSuccessfulRef.current = false;
              } else if (dtaRefreshRetryCountRef.current < MAX_DTA_REFRESH_RETRIES && connectedMac) {
                // Energy values missing but we have battery ID and connection
                // Retry by refreshing DTA service (like the refresh button in BLE Details Page)
                dtaRefreshRetryCountRef.current += 1;
                console.info(
                  `DTA data incomplete, refreshing DTA service (attempt ${dtaRefreshRetryCountRef.current}/${MAX_DTA_REFRESH_RETRIES})...`,
                  { scannedBatteryId, connectedMac }
                );
                
                // Show user feedback that we're retrying
                toast.loading('Reading battery energy...', { id: 'dta-refresh' });
                
                // Keep reading state active - DON'T disconnect, we need to stay connected
                setBleScanState(prev => ({
                  ...prev,
                  isReadingEnergy: true,
                  connectionProgress: 50 + (dtaRefreshRetryCountRef.current * 15), // Progress feedback
                }));
                
                // Delay before retry to allow device to stabilize
                setTimeout(() => {
                  console.info("Refreshing DTA service data...");
                  initServiceBleData(
                    { serviceName: "DTA", macAddress: connectedMac },
                    () => {
                      console.info("DTA service refresh requested for:", connectedMac);
                    }
                  );
                }, DTA_REFRESH_DELAY);
                
                // Don't clear state - we're retrying
                // Return early to prevent state cleanup below
                resp(parsedData);
                return;
              } else {
                // Exceeded retry limit or no connection - fail gracefully
                console.warn(
                  "Could not extract energy from DTA data after all retries",
                  { retryCount: dtaRefreshRetryCountRef.current, maxRetries: MAX_DTA_REFRESH_RETRIES }
                );
                toast.dismiss('dta-refresh'); // Dismiss loading toast
                toast.error('Could not read battery energy values. Please try again.');
                
                // Disconnect and reset
                disconnectAndResetBleState();
                dtaRefreshRetryCountRef.current = 0;
                setBleScanState(prev => ({
                  ...prev,
                  error: 'Could not read energy values',
                }));
                setIsScanning(false);
                scanTypeRef.current = null;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryScanTypeRef.current = null;
                isConnectionSuccessfulRef.current = false;
              }
            }
            
            // Success path - reset DTA retry count and clear pending state
            if (energyData !== null && scannedBatteryId) {
              dtaRefreshRetryCountRef.current = 0;
              toast.dismiss('dta-refresh'); // Dismiss loading toast if any
              
              // Clear global timeout since operation completed successfully
              if (bleGlobalTimeoutRef.current) {
                clearTimeout(bleGlobalTimeoutRef.current);
                bleGlobalTimeoutRef.current = null;
              }
              
              // Clear pending state - reset connection flag for next operation
              setIsScanning(false);
              scanTypeRef.current = null;
              pendingBatteryQrCodeRef.current = null;
              pendingBatteryScanTypeRef.current = null;
              isConnectionSuccessfulRef.current = false;
            }
          }
          
          resp(parsedData);
        } catch (err) {
          console.error("Error parsing BLE service data:", err);
          setBleScanState(prev => ({
            ...prev,
            isReadingEnergy: false,
            error: 'Failed to read energy data',
          }));
          // Reset DTA retry count on error
          dtaRefreshRetryCountRef.current = 0;
          toast.dismiss('dta-refresh');
          setIsScanning(false);
          scanTypeRef.current = null;
          pendingBatteryQrCodeRef.current = null;
          pendingBatteryScanTypeRef.current = null;
          isConnectionSuccessfulRef.current = false;
          toast.error('Failed to read battery energy data.');
          resp({ success: false, error: String(err) });
        }
      }
    );

    // BLE service data failure callback
    const offBleInitServiceFail = reg(
      "bleInitServiceDataFailureCallBack",
      (data: string) => {
        console.error("Failed to read DTA service:", data);
        
        // Check if this is a "Bluetooth device not connected" error
        // This typically happens when the connection was established but the device becomes unreachable
        // The solution is for the user to toggle Bluetooth off and on
        let errorMessage = 'Failed to read energy data';
        let requiresReset = false;
        
        try {
          const parsedError = JSON.parse(data);
          const respDesc = parsedError?.responseData?.respDesc || parsedError?.respDesc || '';
          const errorStr = typeof respDesc === 'string' ? respDesc : '';
          
          if (errorStr.toLowerCase().includes('bluetooth device not connected') ||
              errorStr.toLowerCase().includes('device not connected') ||
              errorStr.toLowerCase().includes('not connected')) {
            errorMessage = 'Bluetooth connection lost';
            requiresReset = true;
            console.warn("Detected 'Bluetooth device not connected' error - requiring Bluetooth reset");
          }
        } catch {
          // If parsing fails, check the raw string
          if (data.toLowerCase().includes('bluetooth device not connected') ||
              data.toLowerCase().includes('device not connected') ||
              data.toLowerCase().includes('not connected')) {
            errorMessage = 'Bluetooth connection lost';
            requiresReset = true;
            console.warn("Detected 'Bluetooth device not connected' error (raw) - requiring Bluetooth reset");
          }
        }
        
        setBleScanState(prev => ({
          ...prev,
          isReadingEnergy: false,
          error: errorMessage,
          connectionFailed: true,
          requiresBluetoothReset: requiresReset,
        }));
        
        // Reset DTA retry count on failure
        dtaRefreshRetryCountRef.current = 0;
        toast.dismiss('dta-refresh');
        setIsScanning(false);
        scanTypeRef.current = null;
        pendingBatteryQrCodeRef.current = null;
        pendingBatteryScanTypeRef.current = null;
        isConnectionSuccessfulRef.current = false;
        
        if (requiresReset) {
          toast.error('Please turn Bluetooth OFF then ON and try again.');
        } else {
          toast.error('Unable to read battery energy. Please try again.');
        }
      }
    );

    // Signal that BLE handlers are now registered and ready
    // This is crucial - the scan effect should not start BLE scanning until this is set
    console.info('=== BLE handlers registered, setting bleHandlersReady = true ===');
    setBleHandlersReady(true);

    return () => {
      offQr();
      offFindBle();
      offBleConnectSuccess();
      offBleConnectFail();
      offBleServiceProgress();
      offBleInitServiceComplete();
      offBleInitServiceFail();
      // Clear any pending BLE operation timeouts
      if (bleOperationTimeoutRef.current) {
        clearTimeout(bleOperationTimeoutRef.current);
        bleOperationTimeoutRef.current = null;
      }
      // Clear global timeout
      if (bleGlobalTimeoutRef.current) {
        clearTimeout(bleGlobalTimeoutRef.current);
        bleGlobalTimeoutRef.current = null;
      }
      // Stop BLE scan on cleanup
      if (window.WebViewJavascriptBridge) {
        window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
        // Disconnect any connected device
        const connectedMac = sessionStorage.getItem("connectedDeviceMac");
        if (connectedMac) {
          window.WebViewJavascriptBridge.callHandler("disconnectBle", connectedMac, () => {});
        }
      }
      // Reset the flag on cleanup
      setBleHandlersReady(false);
    };
  // Note: We removed the processing callback functions from dependencies since we now use refs
  // The refs are always up-to-date via useEffect hooks, so the bridge handler always calls the latest version
  // electricityService is also accessed via ref to prevent handler re-registration when service data loads
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
      console.info(`Detected devices before scan: ${detectedBleDevicesRef.current.length}`);
      
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
                    subscriptionId: servicePlanData.servicePlanId || subscriptionCode, // Same ID used by ABS and Odoo
                    subscriptionType: serviceBundle?.name || 'Pay-Per-Swap',
                    phone: '', // Will be entered separately if needed
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
    
    // Reset BLE connection state but KEEP detected devices (BLE scan is already running from useEffect)
    // This preserves devices that were discovered while user was viewing Step 2
    setBleScanState(prev => ({
      ...prev,
      isConnecting: false,
      isReadingEnergy: false,
      connectedDevice: null,
      connectionProgress: 0,
      error: null,
    }));
    // DON'T clear detectedBleDevicesRef - we need the devices already discovered!
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryScanTypeRef.current = null;
    
    setIsScanning(true);
    scanTypeRef.current = 'old_battery';
    
    // BLE scanning is already running from useEffect when we reached Step 2
    // Log current discovered devices for debugging
    console.info(`=== Scanning Old Battery ===`);
    console.info(`BLE Handlers Ready: ${bleHandlersReady}`);
    console.info(`BLE Scanning Active: ${bleScanState.isScanning}`);
    console.info(`Detected devices count: ${detectedBleDevicesRef.current.length}`);
    console.info('Detected devices:', detectedBleDevicesRef.current.map(d => `${d.name} (${d.rssi})`));
    
    // If no devices detected yet, warn the user
    if (detectedBleDevicesRef.current.length === 0) {
      console.warn('No BLE devices detected yet - scan may have just started or Bluetooth may be off');
    }
    
    // Set timeout for battery scan-to-bind (30 seconds - longer due to BLE operations)
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      console.warn("Old battery scan-to-bind timed out after 30 seconds");
      toast.error("Scan timed out. Please try again.");
      cancelOngoingScan();
    }, 30000);
    
    // Start QR code scan - BLE devices should already be discovered
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, cancelOngoingScan, bleHandlersReady, bleScanState.isScanning]);

  // Step 3: Scan New Battery with Scan-to-Bind
  const handleScanNewBattery = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Clear any existing flow error when retrying (e.g., after scanning old battery as new by mistake)
    setFlowError(null);

    // Reset BLE connection state but KEEP detected devices (BLE scan is already running from useEffect)
    // This preserves devices that were discovered while user was viewing Step 3
    setBleScanState(prev => ({
      ...prev,
      isConnecting: false,
      isReadingEnergy: false,
      connectedDevice: null,
      connectionProgress: 0,
      error: null,
    }));
    // DON'T clear detectedBleDevicesRef - we need the devices already discovered!
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryScanTypeRef.current = null;
    
    setIsScanning(true);
    scanTypeRef.current = 'new_battery';
    
    // BLE scanning is already running from useEffect when we reached Step 3
    // Log current discovered devices for debugging
    console.info(`=== Scanning New Battery ===`);
    console.info(`BLE Handlers Ready: ${bleHandlersReady}`);
    console.info(`BLE Scanning Active: ${bleScanState.isScanning}`);
    console.info(`Detected devices count: ${detectedBleDevicesRef.current.length}`);
    console.info('Detected devices:', detectedBleDevicesRef.current.map(d => `${d.name} (${d.rssi})`));
    
    // If no devices detected yet, warn the user
    if (detectedBleDevicesRef.current.length === 0) {
      console.warn('No BLE devices detected yet - scan may have just started or Bluetooth may be off');
    }
    
    // Set timeout for battery scan-to-bind (30 seconds - longer due to BLE operations)
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      console.warn("New battery scan-to-bind timed out after 30 seconds");
      toast.error("Scan timed out. Please try again.");
      cancelOngoingScan();
    }, 30000);
    
    // Start QR code scan - BLE devices should already be discovered
    startQrCodeScan();
  }, [startQrCodeScan, clearScanTimeout, cancelOngoingScan, bleHandlersReady, bleScanState.isScanning]);

  // Step 4: Proceed to payment - initiate payment with Odoo first
  const handleProceedToPayment = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Initiate payment with Odoo to tell them we're collecting this amount
      await initiateOdooPayment();
      advanceToStep(5);
    } finally {
      setIsProcessing(false);
    }
  }, [advanceToStep, initiateOdooPayment]);

  // Step 5: Confirm Payment via QR scan
  const handleConfirmPayment = useCallback(async () => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    // Ensure payment was initiated
    if (!paymentInitiated) {
      await initiateOdooPayment();
    }

    setIsScanning(true);
    scanTypeRef.current = 'payment';
    startQrCodeScan();
  }, [startQrCodeScan, paymentInitiated, initiateOdooPayment]);

  // Step 5: Manual payment confirmation with Odoo
  // Uses subscriptionId which is the same as servicePlanId - shared between ABS and Odoo
  const handleManualPayment = useCallback((receipt: string) => {
    setIsProcessing(true);
    
    // Confirm payment with Odoo using manual confirmation endpoint
    const confirmManualPayment = async () => {
      // subscriptionId is the servicePlanId - same ID used by both ABS and Odoo
      const subscriptionCode = customerData?.subscriptionId || dynamicPlanId;
      
      try {
        // Ensure payment was initiated first
        if (!paymentInitiated) {
          await initiateOdooPayment();
        }

        if (subscriptionCode) {
          // Use Odoo manual confirmation endpoint
          console.log('Confirming manual payment with Odoo:', {
            subscription_code: subscriptionCode,
            receipt,
            customer_id: customerData?.id,
          });

          const response = await confirmPaymentManual({
            subscription_code: subscriptionCode,
            receipt,
            customer_id: customerData?.id,
          });
          
          if (response.success) {
            setPaymentConfirmed(true);
            setPaymentReceipt(receipt);
            setTransactionId(receipt);
            toast.success('Payment submitted for validation');
            
            // Now publish payment_and_service
            publishPaymentAndService(receipt);
          } else {
            throw new Error('Payment confirmation failed');
          }
        } else {
          // No subscription ID - just proceed with MQTT flow
          setPaymentConfirmed(true);
          setPaymentReceipt(receipt);
          setTransactionId(receipt);
          toast.success('Payment confirmed');
          
          // Now publish payment_and_service
          publishPaymentAndService(receipt);
        }
      } catch (err: any) {
        console.error('Manual payment error:', err);
        toast.error(err.message || 'Payment confirmation failed. Check network connection.');
        setIsProcessing(false);
      }
    };
    
    confirmManualPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPlanId, swapData.cost, customerData, paymentInitiated, initiateOdooPayment]);

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
                advanceToStep(6);
                toast.success(isIdempotent ? 'Swap completed! (already recorded)' : 'Swap completed!');
              } else if (success) {
                // Success without specific signal - still treat as success
                console.info("payment_and_service completed (generic success)");
                
                // Clear the correlation ID to prevent fire-and-forget fallback
                (window as any).__paymentAndServiceCorrelationId = null;
                
                setPaymentAndServiceStatus('success');
                advanceToStep(6);
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
                  advanceToStep(6);
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
    setMaxStepReached(1); // Reset max step when starting fresh
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
    
    // Clear BLE state for fresh start - devices will be rediscovered when reaching Step 2
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
    detectedBleDevicesRef.current = [];
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryScanTypeRef.current = null;
    pendingConnectionMacRef.current = null;
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
            isScannerOpening={isScanning}
            stats={stats}
          />
        );
      case 2:
        return (
          <Step2OldBattery 
            onScanOldBattery={handleScanOldBattery}
            isFirstTimeCustomer={customerType === 'first-time'}
            isBleScanning={bleScanState.isScanning}
            detectedDevicesCount={bleScanState.detectedDevices.length}
            isScannerOpening={isScanning}
          />
        );
      case 3:
        return (
          <Step3NewBattery 
            oldBattery={swapData.oldBattery} 
            onScanNewBattery={handleScanNewBattery}
            isBleScanning={bleScanState.isScanning}
            detectedDevicesCount={bleScanState.detectedDevices.length}
            isScannerOpening={isScanning}
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
            customerData={customerData}
            onConfirmPayment={handleConfirmPayment}
            onManualPayment={handleManualPayment}
            isProcessing={isProcessing || paymentAndServiceStatus === 'pending'}
            isScannerOpening={isScanning}
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
              {pendingBatteryQrCodeRef.current && !bleScanState.requiresBluetoothReset && (
                <div className="ble-battery-id">
                  <span className="ble-battery-id-label">Battery ID:</span>
                  <span className="ble-battery-id-value">
                    ...{String(pendingBatteryQrCodeRef.current).slice(-6).toUpperCase()}
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
                  : `Connecting to battery ${pendingBatteryQrCodeRef.current ? '...' + String(pendingBatteryQrCodeRef.current).slice(-6).toUpperCase() : ''}...`}
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
              {/* This prevents users from cancelling during normal connection/initialization which can take time */}
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
                  ? 'Connection failed. Please ensure the battery is powered on and nearby, then try again.'
                  : 'Please wait while connecting. Make sure the battery is powered on and within 2 meters.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
