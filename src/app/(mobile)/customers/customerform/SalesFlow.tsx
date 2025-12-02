'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import { useBridge } from '@/app/context/bridgeContext';
import { connBleByMacAddress, initServiceBleData } from '@/app/utils';
import { useI18n } from '@/i18n';

// Import components
import {
  SalesTimeline,
  SalesActionBar,
  Step1CustomerForm,
  Step2SelectPlan,
  Step3Payment,
  Step4AssignBattery,
  Step5Success,
  // Types
  CustomerFormData,
  BatteryData,
  BleDevice,
  BleScanState,
  SalesStep,
  PlanData,
  SubscriptionData,
  generateRegistrationId,
} from './components';
import ProgressiveLoading from '@/components/loader/progressiveLoading';

// Import Odoo API functions
import {
  registerCustomer,
  getSubscriptionProducts,
  purchaseSubscription,
  initiatePayment,
  confirmPaymentManual,
  getCycleUnitFromPeriod,
  DEFAULT_COMPANY_ID,
  type SubscriptionProduct,
} from '@/lib/odoo-api';

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

interface SalesFlowProps {
  onBack?: () => void;
}

export default function SalesFlow({ onBack }: SalesFlowProps) {
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
    setLocale(locale === 'en' ? 'fr' : 'en');
  }, [locale, setLocale]);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<SalesStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<SalesStep>(1);

  // Form data - only fields accepted by Odoo /api/auth/register
  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});

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

  // Battery data
  const [assignedBattery, setAssignedBattery] = useState<BatteryData | null>(null);
  
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
  const pendingConnectionMacRef = useRef<string | null>(null);
  const scanTypeRef = useRef<'battery' | 'payment' | null>(null);

  // Bridge initialization ref
  const bridgeInitRef = useRef<boolean>(false);
  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);

  // Process battery QR data ref
  const processBatteryQRDataRef = useRef<(data: string) => void>(() => {});
  
  // Process payment QR data ref
  const processPaymentQRDataRef = useRef<(paymentId: string) => void>(() => {});

  // Advance to a new step
  const advanceToStep = useCallback((step: SalesStep) => {
    setCurrentStep(step);
    setMaxStepReached(prev => Math.max(prev, step) as SalesStep);
  }, []);

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
      console.info('Scanner already opening, ignoring duplicate request');
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
      console.info('Scanner timeout - resetting isScannerOpening');
      setIsScannerOpening(false);
    }, 60000);
    
    window.WebViewJavascriptBridge.callHandler(
      'startQrCodeScan',
      999,
      (responseData: string) => {
        console.info('QR Code Scan initiated:', responseData);
      }
    );
  }, [isScannerOpening, clearScannerTimeout]);

  // Start BLE scanning
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
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth bridge not available');
      return;
    }

    clearBleOperationTimeout();
    isConnectionSuccessfulRef.current = false;
    bleRetryCountRef.current = 0;
    pendingConnectionMacRef.current = macAddress;
    
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: 0,
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    }));

    connBleByMacAddress(macAddress, (responseData: string) => {
      console.info('BLE connection initiated:', responseData);
    });
  }, [clearBleOperationTimeout]);

  // Process battery QR and connect
  const processBatteryQRData = useCallback((qrData: string) => {
    console.info('=== Processing Battery QR for Assignment ===', qrData);
    
    let parsedData: any;
    try {
      parsedData = JSON.parse(qrData);
    } catch {
      toast.error('Invalid QR code format');
      return;
    }

    const batteryId = parsedData.sno || parsedData.serial_number || parsedData.id;
    if (!batteryId) {
      toast.error('Invalid battery QR - no ID found');
      return;
    }

    const macAddress = parsedData.mac_address || parsedData.mac;
    if (!macAddress) {
      toast.error('No Bluetooth MAC address in QR');
      return;
    }

    // Store pending battery info
    pendingBatteryQrCodeRef.current = qrData;
    
    // Find matching device from detected devices
    const normalizedMac = macAddress.toUpperCase();
    const matchingDevice = detectedBleDevicesRef.current.find(
      (device) => device.macAddress.toUpperCase() === normalizedMac
    );

    if (matchingDevice) {
      console.info('Found matching BLE device:', matchingDevice);
      connectBleDevice(matchingDevice.macAddress);
    } else {
      console.info('No matching device found, attempting direct connection');
      connectBleDevice(macAddress);
    }
  }, [connectBleDevice]);

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

      // QR Code result handler
      window.WebViewJavascriptBridge.registerHandler(
        'qrCodeResultCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('=== QR Code Result Received ===', data);
          
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

      // BLE Scan result handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleScanCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const deviceInfo = JSON.parse(data);
            const macAddress = deviceInfo.macAddress || deviceInfo.mac;
            const rssi = deviceInfo.rssi || -100;
            
            if (!macAddress) {
              responseCallback({ received: true });
              return;
            }

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
              detectedBleDevicesRef.current.push(newDevice);
            }

            setBleScanState((prev) => ({
              ...prev,
              detectedDevices: [...detectedBleDevicesRef.current],
            }));
          } catch (e) {
            console.error('Error parsing BLE scan result:', e);
          }
          responseCallback({ received: true });
        }
      );

      // BLE Connect success handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectSuccessCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('=== BLE Connect Success ===', data);
          isConnectionSuccessfulRef.current = true;
          
          setBleScanState((prev) => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: true,
            connectionProgress: 50,
            connectedDevice: pendingConnectionMacRef.current,
          }));

          // Store connected device MAC
          if (pendingConnectionMacRef.current) {
            sessionStorage.setItem('connectedDeviceMac', pendingConnectionMacRef.current);
          }

          // Initialize BLE services to read energy
          initServiceBleData((serviceResponse: string) => {
            console.info('BLE services initialized:', serviceResponse);
          });
          
          responseCallback({ received: true });
        }
      );

      // BLE Connect fail handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectFailCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.warn('=== BLE Connect Failed ===', data);
          
          // Retry logic
          if (bleRetryCountRef.current < MAX_BLE_RETRIES && pendingConnectionMacRef.current) {
            bleRetryCountRef.current++;
            console.info(`Retrying BLE connection (attempt ${bleRetryCountRef.current}/${MAX_BLE_RETRIES})`);
            
            setTimeout(() => {
              if (pendingConnectionMacRef.current) {
                connBleByMacAddress(pendingConnectionMacRef.current, () => {});
              }
            }, 1000);
          } else {
            setBleScanState((prev) => ({
              ...prev,
              isConnecting: false,
              connectionFailed: true,
              error: 'Connection failed. Please try again.',
            }));
            toast.error('Failed to connect to battery');
          }
          
          responseCallback({ received: true });
        }
      );

      // BLE Data callback handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleDataCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          console.info('=== BLE Data Received ===');
          
          try {
            const serviceData = JSON.parse(data);
            
            // Check if this is DTA service data
            if (serviceData.serviceUUID && serviceData.serviceUUID.includes('ff00')) {
              const energyData = populateEnergyFromDta(serviceData);
              
              if (energyData) {
                // Parse the stored QR data
                const qrData = pendingBatteryQrCodeRef.current;
                if (qrData) {
                  const parsedQr = JSON.parse(qrData);
                  const batteryId = parsedQr.sno || parsedQr.serial_number || parsedQr.id;
                  const shortId = batteryId.slice(-8);
                  
                  const batteryData: BatteryData = {
                    id: batteryId,
                    shortId: shortId,
                    chargeLevel: energyData.chargePercent,
                    energy: energyData.energy,
                    macAddress: pendingConnectionMacRef.current || undefined,
                  };
                  
                  setAssignedBattery(batteryData);
                  setRegistrationId(generateRegistrationId());
                  
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
                  
                  // Disconnect
                  if (window.WebViewJavascriptBridge && pendingConnectionMacRef.current) {
                    window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingConnectionMacRef.current, () => {});
                  }
                  
                  // Advance to success step
                  toast.success(`Battery ${shortId} assigned successfully!`);
                  advanceToStep(5);
                }
              }
            }
          } catch (e) {
            console.error('Error processing BLE data:', e);
          }
          
          responseCallback({ received: true });
        }
      );

      setBleHandlersReady(true);
      console.info('BLE handlers registered for Sales flow');
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

  // Start BLE scanning when on step 4 (battery assignment)
  useEffect(() => {
    if (currentStep === 4 && bleHandlersReady) {
      startBleScan();
    } else if (currentStep !== 4) {
      stopBleScan();
    }
    
    return () => {
      stopBleScan();
    };
  }, [currentStep, bleHandlersReady, startBleScan, stopBleScan]);

  // Fetch subscription plans from Odoo API - no fallback, Odoo is source of truth
  const fetchPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    setPlansLoadError(null);
    
    try {
      const response = await getSubscriptionProducts(1, 20);
      
      if (response.success && response.data.products.length > 0) {
        // Convert Odoo products to PlanData format
        const plans: PlanData[] = response.data.products.map((product: SubscriptionProduct) => ({
          id: product.id.toString(),
          odooProductId: product.id,
          name: product.name,
          description: product.description || '',
          price: product.list_price,
          period: '', // Will be determined from name
          currency: product.currency,
          currencySymbol: product.currency_symbol,
        }));
        
        setAvailablePlans(plans);
        setPlansLoadError(null);
        
        // Set default selected plan to first plan
        if (plans.length > 0) {
          setSelectedPlanId(plans[0].id);
        }
        
        console.log('Fetched subscription plans from Odoo:', plans);
      } else {
        setPlansLoadError('No subscription plans available');
        setAvailablePlans([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch subscription plans:', error);
      setPlansLoadError(error.message || 'Failed to load subscription plans');
      setAvailablePlans([]);
      toast.error('Could not load subscription plans from server');
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Validate form data - only fields required by Odoo /api/auth/register
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
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Register customer in Odoo using /api/auth/register
  // Only sends name, email, phone, company_id as per API specification
  const createCustomerInOdoo = useCallback(async (): Promise<boolean> => {
    setIsCreatingCustomer(true);
    
    try {
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
        company_id: DEFAULT_COMPANY_ID,
      };

      console.log('Registering customer in Odoo:', registrationPayload);

      const response = await registerCustomer(registrationPayload);

      if (response.success && response.data.session) {
        const { session } = response.data;
        
        console.log('Customer registered successfully:', session.user);
        
        // Store customer data
        setCreatedCustomerId(session.user.id);
        setCreatedPartnerId(session.user.partner_id);
        setCustomerSessionToken(session.token);
        
        toast.success('Customer registered successfully!');
        return true;
      } else {
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
  const purchaseCustomerSubscription = useCallback(async (): Promise<boolean> => {
    if (!createdPartnerId) {
      toast.error('Customer not registered yet');
      return false;
    }

    const selectedPlan = availablePlans.find(p => p.id === selectedPlanId);
    if (!selectedPlan) {
      toast.error('No plan selected');
      return false;
    }

    try {
      const { interval, unit } = getCycleUnitFromPeriod(selectedPlan.name);
      
      const purchasePayload = {
        customer_id: createdPartnerId,
        product_id: selectedPlan.odooProductId,
        company_id: DEFAULT_COMPANY_ID,
        quantity: 1,
        cycle_interval: interval,
        cycle_unit: unit,
        price_unit: selectedPlan.price,
        notes: 'Purchased via customer portal - sales rep flow',
      };

      console.log('Purchasing subscription:', purchasePayload);

      const response = await purchaseSubscription(purchasePayload);

      if (response.success && response.data.subscription) {
        const { subscription } = response.data;
        
        setSubscriptionData({
          id: subscription.id,
          subscriptionCode: subscription.subscription_code,
          status: subscription.status,
          productName: subscription.product_name,
          priceAtSignup: subscription.price_at_signup,
          currency: subscription.currency,
          currencySymbol: subscription.currency_symbol,
        });
        
        console.log('Subscription purchased:', subscription);
        toast.success('Subscription created!');
        return true;
      } else {
        throw new Error('Subscription purchase failed');
      }
    } catch (error: any) {
      console.error('Failed to purchase subscription:', error);
      toast.error(error.message || 'Failed to create subscription');
      return false;
    }
  }, [createdPartnerId, selectedPlanId, availablePlans]);

  // Initiate payment with Odoo before collecting M-Pesa
  const initiateOdooPayment = useCallback(async (): Promise<boolean> => {
    if (!subscriptionData?.subscriptionCode) {
      toast.error('No subscription created. Please try again.');
      return false;
    }

    const selectedPlan = availablePlans.find(p => p.id === selectedPlanId);
    const amount = selectedPlan?.price || 0;
    
    // Format phone number - ensure it starts with country code
    let phoneNumber = formData.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.slice(1);
    } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber;
    }
    phoneNumber = phoneNumber.replace('+', '');

    try {
      console.log('Initiating payment with Odoo:', {
        subscription_code: subscriptionData.subscriptionCode,
        phone_number: phoneNumber,
        amount,
      });

      const response = await initiatePayment({
        subscription_code: subscriptionData.subscriptionCode,
        phone_number: phoneNumber,
        amount,
      });

      if (response.success && response.data) {
        console.log('Payment initiated:', response.data);
        setPaymentInitiated(true);
        toast.success(response.data.instructions || 'Check your phone for M-Pesa prompt');
        return true;
      } else {
        throw new Error('Payment initiation failed');
      }
    } catch (error: any) {
      console.error('Failed to initiate payment:', error);
      // Don't block the flow - user can still enter receipt manually
      setPaymentInitiated(true);
      toast.error('Could not send M-Pesa prompt. Enter receipt manually.');
      return true; // Allow to continue
    }
  }, [subscriptionData, selectedPlanId, availablePlans, formData.phone]);

  // Handle payment confirmation via QR scan
  const handlePaymentQrScan = useCallback(async () => {
    // First initiate payment if not already done
    if (!paymentInitiated) {
      await initiateOdooPayment();
    }
    
    scanTypeRef.current = 'payment';
    startQrCodeScan();
  }, [startQrCodeScan, paymentInitiated, initiateOdooPayment]);

  // Handle manual payment entry - confirm with Odoo
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

      const subscriptionCode = subscriptionData?.subscriptionCode;

      if (!subscriptionCode) {
        toast.error('No subscription created. Please restart the registration.');
        setIsProcessing(false);
        return;
      }

      // Use Odoo manual confirmation endpoint
      console.log('Confirming payment with Odoo:', {
        subscription_code: subscriptionCode,
        receipt,
        customer_id: createdPartnerId?.toString(),
      });

      const response = await confirmPaymentManual({
        subscription_code: subscriptionCode,
        receipt,
        customer_id: createdPartnerId?.toString(),
      });
      
      if (response.success) {
        setPaymentConfirmed(true);
        setPaymentReference(receipt);
        toast.success('Payment submitted for validation!');
        advanceToStep(4); // Move to battery assignment
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
    createdPartnerId, 
    advanceToStep, 
    paymentInitiated, 
    initiateOdooPayment
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

  // Handle plan selection
  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
  }, []);

  // Handle battery scan
  const handleScanBattery = useCallback(() => {
    scanTypeRef.current = 'battery';
    startQrCodeScan();
  }, [startQrCodeScan]);

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
        // Purchase subscription and move to payment step
        setIsProcessing(true);
        try {
          const subscriptionCreated = await purchaseCustomerSubscription();
          if (subscriptionCreated) {
            // Initiate payment to send M-Pesa prompt
            await initiateOdooPayment();
            advanceToStep(3);
          }
        } finally {
          setIsProcessing(false);
        }
        break;
      case 3:
        // Trigger payment QR scan
        handlePaymentQrScan();
        break;
      case 4:
        // Trigger battery scan
        handleScanBattery();
        break;
      case 5:
        // Reset everything for new registration
        setCurrentStep(1);
        setMaxStepReached(1);
        setFormData({
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
        });
        setFormErrors({});
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
        setAssignedBattery(null);
        setRegistrationId('');
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
    handleScanBattery,
    availablePlans
  ]);

  // Handle step click in timeline
  const handleStepClick = useCallback((step: SalesStep) => {
    if (step <= maxStepReached && step < 5) {
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

  // Render step content
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
        return (
          <Step2SelectPlan 
            selectedPlan={selectedPlanId}
            onPlanSelect={handlePlanSelect}
            plans={availablePlans}
            isLoadingPlans={isLoadingPlans}
            loadError={plansLoadError}
            onRetryLoad={fetchPlans}
          />
        );
      case 3:
        return (
          <Step3Payment 
            formData={formData}
            selectedPlanId={selectedPlanId}
            plans={availablePlans}
            onConfirmPayment={handlePaymentQrScan}
            onManualPayment={handleManualPayment}
            isProcessing={isProcessing}
            isScannerOpening={isScannerOpening}
          />
        );
      case 4:
        return (
          <Step4AssignBattery 
            formData={formData}
            selectedPlanId={selectedPlanId}
            onScanBattery={handleScanBattery}
            isBleScanning={bleScanState.isScanning}
            detectedDevicesCount={bleScanState.detectedDevices.length}
            isScannerOpening={isScannerOpening}
            plans={availablePlans}
          />
        );
      case 5:
        return (
          <Step5Success 
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

  // Show loading overlay during customer creation or BLE operations
  if (isCreatingCustomer) {
    return (
      <ProgressiveLoading
        initialMessage="Creating customer..."
        progress={50}
        autoProgress={true}
        loadingSteps={[
          { percentComplete: 20, message: 'Validating data...' },
          { percentComplete: 50, message: 'Creating customer in Odoo...' },
          { percentComplete: 90, message: 'Finalizing...' },
        ]}
      />
    );
  }

  if (bleScanState.isConnecting || bleScanState.isReadingEnergy) {
    return (
      <ProgressiveLoading
        initialMessage={bleScanState.isConnecting ? 'Connecting to battery...' : 'Reading battery energy...'}
        progress={bleScanState.connectionProgress}
        autoProgress={false}
        loadingSteps={[
          { percentComplete: 10, message: 'Connecting to battery...' },
          { percentComplete: 50, message: 'Reading battery data...' },
          { percentComplete: 90, message: 'Finalizing...' },
        ]}
      />
    );
  }

  return (
    <div className="sales-flow-container">
      <div className="sales-bg-gradient" />
      
      {/* Header with Back and Language Toggle */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <button className="flow-header-back" onClick={handleBackToRoles}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>{t('sales.changeRole')}</span>
          </button>
          <button
            className="flow-header-lang"
            onClick={toggleLocale}
            aria-label={t('role.switchLanguage')}
          >
            <Globe size={16} />
            <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
          </button>
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

      {/* Action Bar */}
      <SalesActionBar
        currentStep={currentStep}
        onBack={handleBack}
        onMainAction={handleMainAction}
        isLoading={isProcessing}
      />
    </div>
  );
}
