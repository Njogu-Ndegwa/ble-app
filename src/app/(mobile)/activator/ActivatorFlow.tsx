'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Globe, LogOut, Eye, X } from 'lucide-react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

import {
  Step1CustomerForm,
  Step2SelectPackage,
  Step3SelectSubscription,
  Step6ScanVehicle,
  Step7AssignBattery,
  Step8Success,
} from '../customers/customerform/components';

import type { CustomerFormData, BatteryData, PlanData } from './components/types';
import type { ActivatorStep } from './components/types';
import { generateRegistrationId } from './components/types';
import ActivatorTimeline from './components/ActivatorTimeline';
import ActivatorActionBar from './components/ActivatorActionBar';

import type { ExistingCustomer } from '@/lib/services/customer-service';
import { useFlowBatteryScan } from '@/lib/hooks/ble';
import { useProductCatalog } from '@/lib/hooks/useProductCatalog';
import { useSalesCustomerIdentification } from '@/lib/hooks/useSalesCustomerIdentification';
import type { ServiceState } from '@/lib/hooks/useCustomerIdentification';
import { usePaymentAndService, useVehicleAssignment, type PublishPaymentAndServiceParams } from '@/lib/services/hooks';
import { BleProgressModal, MqttReconnectBanner, SessionsHistory } from '@/components/shared';
import type { OrderListItem } from '@/lib/odoo-api';
import { calculateSwapPayment } from '@/lib/swap-payment';

import {
  useWorkflowSession,
  buildActivatorSessionData,
  extractActivatorStateFromSession,
  type ActivatorWorkflowState,
} from '@/lib/hooks/useWorkflowSession';
import type { WorkflowSessionData } from '@/lib/odoo-api';

import { DEFAULT_COMPANY_ID } from '@/lib/odoo-api';
import { getSalesRoleToken, clearSalesRoleLogin, getSalesRoleUser } from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';

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

const ACTIVATOR_STATION = "STATION_001";

interface ActivatorFlowProps {
  onBack?: () => void;
  onLogout?: () => void;
  renderBottomNav?: () => React.ReactNode;
  initialSession?: OrderListItem | null;
  initialSessionReadOnly?: boolean;
  onInitialSessionConsumed?: () => void;
}

export default function ActivatorFlow({
  onBack,
  onLogout,
  renderBottomNav,
  initialSession,
  initialSessionReadOnly,
  onInitialSessionConsumed,
}: ActivatorFlowProps) {
  const router = useRouter();
  const { bridge, isBridgeReady, isMqttConnected, mqttReconnectionState, reconnectMqtt } = useBridge();
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  // Step management (6 steps)
  const [currentStep, setCurrentStep] = useState<ActivatorStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<ActivatorStep>(1);

  // Customer form (existing customer only)
  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: '', lastName: '', phone: '', email: '', street: '', city: '', zip: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState<ExistingCustomer | null>(null);

  // Package and plan selection
  const {
    packages: availablePackages,
    plans: availablePlans,
    filteredPlans,
    isLoading: catalogLoading,
    errors: catalogErrors,
    selectedPackageId,
    selectedPlanId,
    selectedPlan,
    setSelectedPackageId,
    setSelectedPlanId,
    refetch: fetchProductsAndPlans,
    restoreSelections: restoreCatalogSelections,
  } = useProductCatalog({ autoFetch: true, workflowType: 'sales', autoSelectFirstPlan: false });

  const isLoadingPackages = catalogLoading.packages;
  const packagesLoadError = catalogErrors.packages;
  const isLoadingPlans = catalogLoading.plans;
  const plansLoadError = catalogErrors.plans;

  // Customer data
  const [createdCustomerId, setCreatedCustomerId] = useState<number | null>(null);
  const [createdPartnerId, setCreatedPartnerId] = useState<number | null>(null);

  // Subscription code from plan assignment
  const [confirmedSubscriptionCode, setConfirmedSubscriptionCode] = useState<string | null>(null);

  // Vehicle data
  const [scannedVehicleId, setScannedVehicleId] = useState<string | null>(null);

  // Battery data
  const [assignedBattery, setAssignedBattery] = useState<BatteryData | null>(null);
  const [scannedBatteryPending, setScannedBatteryPending] = useState<BatteryData | null>(null);

  // Computed cost
  const [computedEnergyCost, setComputedEnergyCost] = useState<number>(0);

  // Registration ID
  const [registrationId, setRegistrationId] = useState<string>('');

  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpening, setIsScannerOpening] = useState(false);

  // BLE scan-to-bind hook
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
      setScannedBatteryPending(battery);
      setIsScannerOpening(false);
      scanTypeRef.current = null;
    },
    onNewBatteryRead: () => {},
    onError: (error, requiresReset) => {
      console.error('BLE error via hook:', error, { requiresReset });
      setIsScannerOpening(false);
      scanTypeRef.current = null;
    },
    debug: true,
  });

  const [bleHandlersReady, setBleHandlersReady] = useState<boolean>(false);
  useEffect(() => {
    if (bleIsReady && !bleHandlersReady) {
      setBleHandlersReady(true);
    }
  }, [bleIsReady, bleHandlersReady]);

  // Customer identification hook
  const {
    identifyCustomer,
    cancelIdentification,
    manualRetry: manualIdentifyCustomer,
    reset: resetCustomerIdentification,
    status: identificationStatus,
    isIdentifying,
    isIdentified: customerIdentified,
    hasFailed: identificationFailed,
    rate: customerRate,
    currencySymbol: customerCurrencySymbol,
    serviceStates: customerServiceStates,
  } = useSalesCustomerIdentification({
    bridge: bridge as any,
    isBridgeReady,
    isMqttConnected,
    attendantInfo: {
      id: `activator-${getSalesRoleUser()?.id || '001'}`,
      station: ACTIVATOR_STATION,
    },
    maxRetries: 3,
  });

  // Payment and service completion hook (for service reporting, not payment collection)
  const {
    publishPaymentAndService,
    status: paymentAndServiceStatus,
    reset: resetPaymentAndService,
  } = usePaymentAndService({
    onSuccess: (isIdempotent) => {
      setAssignedBattery(scannedBatteryPending);
      setScannedBatteryPending(null);
      setRegistrationId(generateRegistrationId());
      clearSalesSession();
      advanceToStep(6);
      toast.success(isIdempotent ? 'Activation completed! (already recorded)' : 'Activation completed! Assets assigned successfully.');
    },
    onError: (errorMsg) => {
      console.error('[Activator] Service completion failed:', errorMsg);
      toast.error(errorMsg);
    },
  });

  const isCompletingService = paymentAndServiceStatus === 'pending';

  // Vehicle assignment hook
  const {
    assignVehicle,
    status: vehicleAssignmentStatus,
    reset: resetVehicleAssignment,
    isLoading: isAssigningVehicle,
  } = useVehicleAssignment({
    onSuccess: (isIdempotent) => {
      toast.success(isIdempotent
        ? (t('activator.vehicleAlreadyAssigned') || 'Vehicle already assigned!')
        : (t('activator.vehicleAssigned') || 'Vehicle assigned successfully!'));
    },
    onError: (errorMsg) => {
      console.error('[Activator] Vehicle assignment failed:', errorMsg);
      toast.error(errorMsg || t('activator.vehicleAssignFailed') || 'Failed to assign vehicle. Please try again.');
      setScannedVehicleId(null);
    },
  });

  // Refs
  const scanTypeRef = useRef<'battery' | 'vehicle' | null>(null);
  const bridgeInitRef = useRef<boolean>(false);

  // Workflow session management
  const {
    status: sessionStatus,
    orderId: sessionOrderId,
    createSalesSession,
    updateSession,
    updateSessionWithProducts,
    clearSession,
    setOrderId: setSessionOrderId,
  } = useWorkflowSession({
    workflowType: 'activator',
    onSessionRestored: (sessionData, orderId) => {
      const restoredState = extractActivatorStateFromSession(sessionData);
      setCurrentStep(restoredState.currentStep as ActivatorStep);
      setMaxStepReached(restoredState.maxStepReached as ActivatorStep);
      setFormData(restoredState.formData);
      restoreCatalogSelections(undefined, restoredState.selectedPackageId, restoredState.selectedPlanId);
      setCreatedCustomerId(restoredState.createdCustomerId);
      setCreatedPartnerId(restoredState.createdPartnerId);
      setConfirmedSubscriptionCode(restoredState.confirmedSubscriptionCode);
      setScannedVehicleId(restoredState.scannedVehicleId);
      setScannedBatteryPending(restoredState.scannedBatteryPending);
      setAssignedBattery(restoredState.assignedBattery);
      setRegistrationId(restoredState.registrationId);
      clearSalesSession();
      toast.success(`${t('session.sessionRestored') || 'Session restored - continuing from step'} ${restoredState.currentStep}`);
    },
    onError: (error) => {
      console.error('[ActivatorFlow] Session error:', error);
    },
  });

  const [showSessionsHistory, setShowSessionsHistory] = useState(false);
  const [isReadOnlySession, setIsReadOnlySession] = useState(false);

  // Refs for vehicle assignment (to avoid stale closures)
  const assignVehicleRef = useRef<typeof assignVehicle | null>(null);
  const confirmedSubscriptionCodeRef = useRef<string | null>(null);

  // Advance to a new step
  const advanceToStep = useCallback((step: ActivatorStep) => {
    setCurrentStep(step);
    setMaxStepReached(prev => Math.max(prev, step) as ActivatorStep);
  }, []);

  // Handle selecting a session from history
  const handleSelectHistorySession = useCallback(async (order: OrderListItem, isReadOnly: boolean) => {
    if (!order.session?.session_data) {
      toast.error(t('sessions.noSessionData') || 'Session data not available');
      return;
    }

    setShowSessionsHistory(false);
    setIsReadOnlySession(isReadOnly);

    if (!isReadOnly) {
      setSessionOrderId(order.id);
    }

    const sessionData = order.session.session_data;
    const restoredState = extractActivatorStateFromSession(sessionData);

    setCurrentStep(restoredState.currentStep as ActivatorStep);
    setMaxStepReached(isReadOnly ? 6 : restoredState.maxStepReached as ActivatorStep);
    setFormData(restoredState.formData);
    restoreCatalogSelections(undefined, restoredState.selectedPackageId, restoredState.selectedPlanId);
    setCreatedCustomerId(restoredState.createdCustomerId);
    setCreatedPartnerId(restoredState.createdPartnerId);
    setConfirmedSubscriptionCode(restoredState.confirmedSubscriptionCode);
    setScannedVehicleId(restoredState.scannedVehicleId);
    setScannedBatteryPending(restoredState.scannedBatteryPending);
    setAssignedBattery(restoredState.assignedBattery);
    setRegistrationId(restoredState.registrationId);
    setSessionOrderId(order.id);
    clearSalesSession();

    if (isReadOnly) {
      toast(t('sessions.viewingReadOnly') || 'Viewing session (read-only)', { icon: '👁️' });
    } else {
      toast.success(`${t('session.sessionRestored') || 'Session restored - continuing from step'} ${restoredState.currentStep}`);
    }
  }, [t, restoreCatalogSelections, setSessionOrderId]);

  // Restore initial session from props (from sessions screen)
  useEffect(() => {
    if (initialSession) {
      handleSelectHistorySession(initialSession, initialSessionReadOnly || false);
      onInitialSessionConsumed?.();
    }
  }, [initialSession, initialSessionReadOnly, handleSelectHistorySession, onInitialSessionConsumed]);

  // Build current session state
  const buildCurrentSessionState = useCallback((): ActivatorWorkflowState => {
    return {
      currentStep,
      maxStepReached,
      actor: {
        id: `activator-${getSalesRoleUser()?.id || '001'}`,
        station: ACTIVATOR_STATION,
      },
      formData,
      selectedPackageId,
      selectedPlanId,
      createdCustomerId,
      createdPartnerId,
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
    currentStep, maxStepReached, formData, selectedPackageId, selectedPlanId,
    createdCustomerId, createdPartnerId, confirmedSubscriptionCode,
    scannedBatteryPending, assignedBattery, customerIdentified,
    customerRate, customerCurrencySymbol, scannedVehicleId, registrationId,
  ]);

  // Save session to backend
  const saveSessionToBackend = useCallback(async () => {
    if (!sessionOrderId) return;
    try {
      const currentState = buildCurrentSessionState();
      const sessionData = buildActivatorSessionData(currentState);
      await updateSession(sessionData);
    } catch (err) {
      console.error('[ActivatorFlow] saveSessionToBackend failed:', err);
    }
  }, [sessionOrderId, buildCurrentSessionState, updateSession]);

  // Auto-save on step transitions
  const prevStepRef = useRef<number>(currentStep);
  useEffect(() => {
    if (!sessionOrderId || currentStep === prevStepRef.current || currentStep < 2) {
      prevStepRef.current = currentStep;
      return;
    }

    if (currentStep === 6) {
      prevStepRef.current = currentStep;
      saveSessionToBackend().then(() => {
        clearSession();
      }).catch(() => {
        clearSession();
      });
      return;
    }

    prevStepRef.current = currentStep;
    saveSessionToBackend().catch((err) => {
      console.error('[ActivatorFlow] Step transition save failed:', err);
    });
  }, [currentStep, sessionOrderId, saveSessionToBackend, clearSession]);

  // Keep refs up to date
  useEffect(() => {
    assignVehicleRef.current = assignVehicle;
  }, [assignVehicle]);

  useEffect(() => {
    confirmedSubscriptionCodeRef.current = confirmedSubscriptionCode;
  }, [confirmedSubscriptionCode]);

  // MQTT publish function
  const mqttPublish = useCallback(
    (topic: string, content: any) => {
      if (!window.WebViewJavascriptBridge) {
        console.error('MQTT: Bridge not available');
        return;
      }
      try {
        window.WebViewJavascriptBridge.callHandler(
          "mqttPublishMsg",
          JSON.stringify({ topic, qos: 0, content }),
          () => {}
        );
      } catch (err) {
        console.error('MQTT: Publish error:', err);
      }
    },
    []
  );

  // Scanner timeout ref
  const scannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearScannerTimeout = useCallback(() => {
    if (scannerTimeoutRef.current) {
      clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = null;
    }
  }, []);

  // Start QR code scan
  const startQrCodeScan = useCallback(() => {
    if (isScannerOpening) return;
    if (!window.WebViewJavascriptBridge) {
      toast.error('Unable to access camera');
      return;
    }
    setIsScannerOpening(true);
    clearScannerTimeout();
    scannerTimeoutRef.current = setTimeout(() => {
      setIsScannerOpening(false);
    }, 60000);
    window.WebViewJavascriptBridge.callHandler('startQrCodeScan', 999, () => {});
  }, [isScannerOpening, clearScannerTimeout]);

  // Reset scanner state when navigating between steps so a pending
  // scanner open from a previous visit doesn't block interaction.
  useEffect(() => {
    setIsScannerOpening(false);
    clearScannerTimeout();
  }, [currentStep, clearScannerTimeout]);

  // BLE wrapper functions
  const startBleScan = useCallback(() => { hookStartScanning(); }, [hookStartScanning]);
  const stopBleScan = useCallback(() => { hookStopScanning(); }, [hookStopScanning]);
  const cancelBleOperation = useCallback((force?: boolean) => {
    hookCancelOperation(force);
    setIsScannerOpening(false);
    scanTypeRef.current = null;
  }, [hookCancelOperation]);

  const processBatteryQRData = useCallback((qrData: string) => {
    hookHandleQrScanned(qrData, 'old_battery');
  }, [hookHandleQrScanned]);

  const processBatteryQRDataRef = useRef<(data: string) => void>(() => {});
  useEffect(() => {
    processBatteryQRDataRef.current = processBatteryQRData;
  }, [processBatteryQRData]);

  // Initialize WebViewJavascriptBridge handlers
  useEffect(() => {
    const setupBridgeHandlers = () => {
      if (!window.WebViewJavascriptBridge || bridgeInitRef.current) return;
      bridgeInitRef.current = true;

      window.WebViewJavascriptBridge.registerHandler(
        'scanQrcodeResultCallBack',
        (data: string, responseCallback: (response: any) => void) => {
          clearScannerTimeout();
          setIsScannerOpening(false);

          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const qrVal = parsed.respData?.value || "";
            if (!qrVal) {
              responseCallback({ success: false, cancelled: true });
              return;
            }

            if (scanTypeRef.current === 'battery') {
              processBatteryQRDataRef.current(qrVal);
            } else if (scanTypeRef.current === 'vehicle') {
              let vehicleId = qrVal;
              try {
                const vehicleData = JSON.parse(qrVal);
                vehicleId = vehicleData.vehicle_id || vehicleData.id || vehicleData.vin || qrVal;
              } catch { /* plain string */ }

              if (vehicleId) {
                setScannedVehicleId(vehicleId);
                const subCode = confirmedSubscriptionCodeRef.current;
                if (subCode) {
                  assignVehicleRef.current?.({ planId: subCode, vehicleId });
                }
              }
              scanTypeRef.current = null;
            }

            responseCallback({ success: true });
          } catch (err) {
            console.error('[Activator QR] Error parsing QR callback data:', err);
            responseCallback({ success: false, error: String(err) });
          }
        }
      );
    };

    if (window.WebViewJavascriptBridge) {
      setupBridgeHandlers();
    } else {
      document.addEventListener('WebViewJavascriptBridgeReady', setupBridgeHandlers, false);
    }

    return () => {
      document.removeEventListener('WebViewJavascriptBridgeReady', setupBridgeHandlers, false);
      clearScannerTimeout();
    };
  }, [clearScannerTimeout]);

  // Action handlers
  const handleScanVehicle = useCallback(() => {
    setIsScannerOpening(false);
    clearScannerTimeout();
    scanTypeRef.current = 'vehicle';
    startQrCodeScan();
  }, [startQrCodeScan, clearScannerTimeout]);

  const handleScanBattery = useCallback(() => {
    scanTypeRef.current = 'battery';
    startQrCodeScan();
  }, [startQrCodeScan]);

  const handleBatteryDeviceSelect = useCallback((device: { macAddress: string; name: string }) => {
    scanTypeRef.current = 'battery';
    hookHandleQrScanned(device.name, 'old_battery');
  }, [hookHandleQrScanned]);

  const handleRescanBattery = useCallback(() => {
    setScannedBatteryPending(null);
    hookResetState();
    setIsScannerOpening(false);
    scanTypeRef.current = null;
    if (bleIsReady) startBleScan();
    toast('Ready to scan a new battery');
  }, [hookResetState, bleIsReady, startBleScan]);

  const handleRescanVehicle = useCallback(() => {
    setScannedVehicleId(null);
    resetVehicleAssignment();
    autoAdvancedVehicleIdRef.current = null;
    setIsScannerOpening(false);
    scanTypeRef.current = null;
    toast('Ready to scan a new vehicle');
  }, [resetVehicleAssignment]);

  const handleManualIdentify = useCallback(() => {
    const subscriptionId = confirmedSubscriptionCode;
    if (!subscriptionId) {
      toast.error('No subscription found. Please select a plan first.');
      return;
    }

    if (identificationStatus === 'idle' || identificationStatus === 'pending' || identificationStatus === 'retrying') {
      identifyCustomer({ subscriptionCode: subscriptionId, source: 'manual' });
    } else {
      manualIdentifyCustomer();
    }
  }, [confirmedSubscriptionCode, identificationStatus, identifyCustomer, manualIdentifyCustomer]);

  // Complete service - report via MQTT
  const handleCompleteService = useCallback(async () => {
    if (!isMqttConnected) {
      toast.error(t('activator.mqttNotConnected') || 'MQTT not connected. Please wait a moment and try again.');
      return;
    }
    if (!scannedBatteryPending) {
      toast.error('No battery scanned');
      return;
    }
    const subscriptionId = confirmedSubscriptionCode;
    if (!subscriptionId) {
      toast.error('No subscription found.');
      return;
    }
    if (!customerIdentified) {
      if (isIdentifying) {
        toast.error(t('sales.waitingForPricing') || 'Please wait, fetching pricing...');
        return;
      }
      if (identificationFailed) {
        toast.error(t('sales.pricingRequired') || 'Pricing info required. Tap "Fetch Pricing" to retry.');
        return;
      }
      identifyCustomer({ subscriptionCode: subscriptionId, source: 'manual' });
      toast.error(t('sales.waitingForPricing') || 'Please wait, fetching pricing...');
      return;
    }
    if (!customerRate || customerRate <= 0) {
      toast.error(t('sales.invalidPricing') || 'Invalid pricing data. Please tap "Fetch Pricing" to retry.');
      return;
    }

    const energyService = customerServiceStates.find(
      (service) => typeof service?.service_id === 'string' &&
        (service.service_id.includes('service-energy') || service.service_id.includes('service-electricity'))
    );
    if (!energyService || !energyService.service_id) {
      toast.error(t('sales.energyServiceNotFound') || 'Energy service not found. Please tap "Fetch Pricing" to retry.');
      return;
    }

    const rate = customerRate;
    const paymentCalc = calculateSwapPayment({
      newBatteryEnergyWh: scannedBatteryPending.energy,
      oldBatteryEnergyWh: 0,
      ratePerKwh: rate,
      quotaTotal: 0,
      quotaUsed: 0,
    });
    setComputedEnergyCost(paymentCalc.cost);

    const paymentRef = `ACTIVATION_${subscriptionId}_${Date.now()}`;

    const params: PublishPaymentAndServiceParams = {
      paymentReference: paymentRef,
      planId: subscriptionId,
      swapData: {
        oldBattery: null,
        newBattery: {
          id: scannedBatteryPending.id,
          actualBatteryId: scannedBatteryPending.actualBatteryId || null,
          energy: scannedBatteryPending.energy,
        },
        energyDiff: paymentCalc.energyDiff,
        cost: paymentCalc.cost,
        rate,
        currencySymbol: customerCurrencySymbol,
      },
      customerType: 'first-time',
      serviceId: energyService.service_id,
      actor: {
        type: 'attendant',
        id: `activator-${getSalesRoleUser()?.id || '001'}`,
        station: ACTIVATOR_STATION,
      },
      isQuotaBased: false,
      isZeroCostRounding: false,
    };

    await publishPaymentAndService(params);
  }, [
    scannedBatteryPending, confirmedSubscriptionCode,
    isMqttConnected, t, customerIdentified, isIdentifying,
    identificationFailed, customerRate, customerCurrencySymbol,
    customerServiceStates, identifyCustomer, publishPaymentAndService,
  ]);

  const handleFormChange = useCallback((field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

  const handlePackageSelect = useCallback((packageId: string) => {
    setSelectedPackageId(packageId);
  }, [setSelectedPackageId]);

  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
  }, [setSelectedPlanId]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as ActivatorStep);
    }
  }, [currentStep]);

  // Handle main action button
  const handleMainAction = useCallback(async () => {
    if (isReadOnlySession && currentStep < 6) {
      advanceToStep((currentStep + 1) as ActivatorStep);
      return;
    }

    switch (currentStep) {
      case 1: {
        if (!selectedExistingCustomer) {
          toast.error(t('sales.pleaseSelectCustomer') || 'Please select a customer');
          return;
        }
        setIsProcessing(true);
        try {
          setCreatedCustomerId(selectedExistingCustomer.id);
          setCreatedPartnerId(selectedExistingCustomer.partnerId);
          const nameParts = selectedExistingCustomer.name.split(' ');
          const existingFormData: CustomerFormData = {
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            phone: selectedExistingCustomer.phone || '',
            email: selectedExistingCustomer.email || '',
            street: selectedExistingCustomer.street || '',
            city: selectedExistingCustomer.city || '',
            zip: selectedExistingCustomer.zip || '',
          };
          setFormData(existingFormData);

          try {
            const initialSessionData = buildActivatorSessionData({
              currentStep: 2,
              maxStepReached: 2,
              actor: {
                id: `activator-${getSalesRoleUser()?.id || '001'}`,
                station: ACTIVATOR_STATION,
              },
              formData: existingFormData,
              selectedPackageId: '',
              selectedPlanId: '',
              createdCustomerId: selectedExistingCustomer.id,
              createdPartnerId: selectedExistingCustomer.partnerId,
              confirmedSubscriptionCode: null,
              scannedBatteryPending: null,
              assignedBattery: null,
              customerIdentification: { identified: false, rate: null, currencySymbol: null },
              scannedVehicleId: null,
              registrationId: '',
            });
            await createSalesSession(
              selectedExistingCustomer.partnerId,
              DEFAULT_COMPANY_ID,
              initialSessionData
            );
          } catch (err) {
            console.error('[ActivatorFlow] Failed to create backend session (non-blocking):', err);
          }
          toast.success(t('sales.customerSelected') || 'Customer selected successfully!');
          advanceToStep(2);
        } finally {
          setIsProcessing(false);
        }
        break;
      }
      case 2: {
        if (!selectedPackageId) {
          toast.error(t('activator.pleaseSelectPackage') || 'Please select a package');
          return;
        }
        advanceToStep(3);
        break;
      }
      case 3: {
        if (!selectedPlanId) {
          toast.error(t('activator.pleaseSelectPlan') || 'Please select a plan');
          return;
        }
        if (!selectedPlan) {
          toast.error('Selected plan data not found');
          return;
        }
        setIsProcessing(true);
        try {
          const products = [{
            product_id: selectedPlan.odooProductId,
            quantity: 1,
            price_unit: selectedPlan.price,
          }];
          const sessionData = buildActivatorSessionData(buildCurrentSessionState());
          const result = await updateSessionWithProducts(sessionData, products);
          if (result.success && result.subscriptionCode) {
            setConfirmedSubscriptionCode(result.subscriptionCode);
            advanceToStep(4);
          } else {
            toast.error('Failed to add plan to order. Please try again.');
          }
        } catch (err) {
          console.error('[ActivatorFlow] Failed to update session with products:', err);
          toast.error('Failed to add plan to order. Please try again.');
        } finally {
          setIsProcessing(false);
        }
        break;
      }
      case 4:
        if (scannedVehicleId) {
          advanceToStep(5);
        } else {
          handleScanVehicle();
        }
        break;
      case 5:
        if (scannedBatteryPending) {
          handleCompleteService();
        } else {
          handleScanBattery();
        }
        break;
      case 6: {
        // Reset everything for new activation
        clearSalesSession();
        setCurrentStep(1);
        setMaxStepReached(1);
        setFormData({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', zip: '' });
        setFormErrors({});
        setSelectedExistingCustomer(null);
        setSelectedPackageId('');
        setSelectedPlanId('');
        setCreatedCustomerId(null);
        setCreatedPartnerId(null);
        setConfirmedSubscriptionCode(null);
        setScannedVehicleId(null);
        setAssignedBattery(null);
        setScannedBatteryPending(null);
        resetCustomerIdentification();
        setComputedEnergyCost(0);
        resetPaymentAndService();
        resetVehicleAssignment();
        setRegistrationId('');
        setIsReadOnlySession(false);
        break;
      }
    }
  }, [
    currentStep, selectedExistingCustomer, selectedPackageId, selectedPlanId, selectedPlan,
    scannedVehicleId, scannedBatteryPending, isReadOnlySession,
    advanceToStep, handleScanVehicle, handleScanBattery, handleCompleteService,
    resetCustomerIdentification, resetPaymentAndService,
    resetVehicleAssignment, createSalesSession, buildActivatorSessionData,
    buildCurrentSessionState, updateSessionWithProducts,
    t, setSelectedPackageId, setSelectedPlanId,
  ]);

  // Handle step click in timeline
  const handleStepClick = useCallback((step: ActivatorStep) => {
    if (step <= maxStepReached && step !== currentStep) {
      if (!isReadOnlySession && step === 6) return;
      setCurrentStep(step);
    }
  }, [maxStepReached, currentStep, isReadOnlySession]);

  // Exit read-only mode
  const handleExitReadOnlyMode = useCallback(() => {
    clearSalesSession();
    setCurrentStep(1);
    setMaxStepReached(1);
    setFormData({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', zip: '' });
    setFormErrors({});
    setSelectedExistingCustomer(null);
    setSelectedPackageId('');
    setSelectedPlanId('');
    setCreatedCustomerId(null);
    setCreatedPartnerId(null);
    setConfirmedSubscriptionCode(null);
    setScannedVehicleId(null);
    setAssignedBattery(null);
    setScannedBatteryPending(null);
    resetCustomerIdentification();
    setComputedEnergyCost(0);
    resetPaymentAndService();
    resetVehicleAssignment();
    setRegistrationId('');
    setIsReadOnlySession(false);
  }, [resetCustomerIdentification, resetPaymentAndService, resetVehicleAssignment, setSelectedPackageId, setSelectedPlanId]);

  const handleBackToRoles = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  }, [onBack, router]);

  const handleLogout = useCallback(() => {
    clearSalesSession();
    clearSalesRoleLogin();
    toast.success(t('Signed out successfully'));
    if (onLogout) {
      onLogout();
    } else {
      router.push('/');
    }
  }, [onLogout, router, t]);

  // Track which vehicleId already triggered auto-advance so navigating back
  // to the vehicle step doesn't immediately kick the user forward again.
  const autoAdvancedVehicleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentStep === 4 && scannedVehicleId && !isReadOnlySession) {
      if (autoAdvancedVehicleIdRef.current === scannedVehicleId) return;
      const timer = setTimeout(() => {
        autoAdvancedVehicleIdRef.current = scannedVehicleId;
        advanceToStep(5);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, scannedVehicleId, advanceToStep, isReadOnlySession]);

  // Seed the ref when already past the vehicle step with a scanned vehicle
  // (e.g. session restore) so navigating back won't trigger auto-advance
  useEffect(() => {
    if (scannedVehicleId && currentStep !== 4) {
      autoAdvancedVehicleIdRef.current = scannedVehicleId;
    }
  }, [scannedVehicleId, currentStep]);

  // Trigger customer identification after vehicle scan (step 4 -> 5 transition)
  // so pricing is ready by the time battery is scanned
  useEffect(() => {
    if (currentStep === 5 && confirmedSubscriptionCode && !customerIdentified && !isIdentifying) {
      identifyCustomer({ subscriptionCode: confirmedSubscriptionCode, source: 'manual' });
    }
  }, [currentStep, confirmedSubscriptionCode, customerIdentified, isIdentifying, identifyCustomer]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1CustomerForm
            formData={formData}
            onFormChange={handleFormChange}
            errors={formErrors}
            customerMode="existing"
            onModeChange={() => {}}
            onSelectExistingCustomer={setSelectedExistingCustomer}
            selectedExistingCustomer={selectedExistingCustomer}
            existingOnly
          />
        );
      case 2:
        return (
          <Step2SelectPackage
            selectedPackage={selectedPackageId}
            onPackageSelect={handlePackageSelect}
            packages={availablePackages}
            isLoadingPackages={isLoadingPackages}
            loadError={packagesLoadError}
            onRetryLoad={fetchProductsAndPlans}
            hidePrice
          />
        );
      case 3:
        return (
          <Step3SelectSubscription
            selectedPlan={selectedPlanId}
            onPlanSelect={handlePlanSelect}
            plans={filteredPlans}
            isLoadingPlans={isLoadingPlans}
            loadError={plansLoadError}
            onRetryLoad={fetchProductsAndPlans}
          />
        );
      case 4:
        return (
          <Step6ScanVehicle
            formData={formData}
            onScanVehicle={handleScanVehicle}
            scannedVehicleId={scannedVehicleId}
            subscriptionCode={confirmedSubscriptionCode || ''}
            onRescanVehicle={handleRescanVehicle}
          />
        );
      case 5:
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
            subscriptionCode={confirmedSubscriptionCode || ''}
            scannedBattery={scannedBatteryPending}
            onCompleteService={handleCompleteService}
            isCompletingService={isCompletingService}
            onRescanBattery={handleRescanBattery}
            rate={customerRate}
            currencySymbol={customerCurrencySymbol}
            customerIdentified={customerIdentified}
            isIdentifying={isIdentifying}
            identificationFailed={identificationFailed}
            onManualIdentify={handleManualIdentify}
          />
        );
      case 6:
        return (
          <Step8Success
            formData={formData}
            selectedPlanId={selectedPlanId}
            battery={assignedBattery}
            registrationId={registrationId}
            plans={availablePlans}
            subscriptionCode={confirmedSubscriptionCode || undefined}
            vehicleId={scannedVehicleId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="sales-flow-container">
      <div className="sales-bg-gradient" />

      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              className="flow-header-back"
              onClick={handleBackToRoles}
              aria-label={t('attendant.changeRole') || 'Change Role'}
              title={t('attendant.changeRole') || 'Change Role'}
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
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button className="flow-header-lang" onClick={toggleLocale} aria-label={t('role.switchLanguage')}>
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
            <button className="flow-header-logout" onClick={handleLogout} aria-label={t('common.logout')} title={t('common.logout')}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 pt-2 flex flex-col gap-2">
        <MqttReconnectBanner />
      </div>

      <ActivatorTimeline
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        onStepClick={handleStepClick}
        readOnly={isReadOnlySession}
      />

      {isReadOnlySession && (
        <div className="readonly-banner">
          <div className="readonly-banner-content">
            <Eye size={16} />
            <span>{t('sessions.readOnlyMode') || 'Viewing completed session (read-only)'}</span>
          </div>
          <button
            className="readonly-banner-exit"
            onClick={handleExitReadOnlyMode}
            aria-label={t('sessions.exitReview') || 'Exit Review'}
          >
            <X size={14} />
            <span>{t('sessions.exitReview') || 'Exit'}</span>
          </button>
        </div>
      )}

      <main className={`sales-main ${isReadOnlySession ? 'sales-main-readonly' : ''}`}>
        {renderStepContent()}
      </main>

      {renderBottomNav ? (
        <div className="sales-bottom-fixed">
          <ActivatorActionBar
            currentStep={currentStep}
            onBack={handleBack}
            onMainAction={handleMainAction}
            isLoading={isProcessing || isCompletingService || isAssigningVehicle}
            isDisabled={false}
            hasVehicleScanned={!!scannedVehicleId}
            hasBatteryScanned={!!scannedBatteryPending}
            customerIdentified={customerIdentified}
            isIdentifying={isIdentifying}
            identificationFailed={identificationFailed}
            readOnly={isReadOnlySession}
          />
          {renderBottomNav()}
        </div>
      ) : (
        <ActivatorActionBar
          currentStep={currentStep}
          onBack={handleBack}
          onMainAction={handleMainAction}
          isLoading={isProcessing || isCompletingService || isAssigningVehicle}
          isDisabled={false}
          hasVehicleScanned={!!scannedVehicleId}
          hasBatteryScanned={!!scannedBatteryPending}
          customerIdentified={customerIdentified}
          isIdentifying={isIdentifying}
          identificationFailed={identificationFailed}
          readOnly={isReadOnlySession}
        />
      )}

      {(isProcessing || isAssigningVehicle || isCompletingService) &&
       !bleScanState.isConnecting &&
       !bleScanState.isReadingEnergy && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            {isAssigningVehicle
              ? t('sales.assigningVehicle') || 'Assigning vehicle...'
              : isCompletingService
              ? t('sales.completingService') || 'Completing service...'
              : t('common.processing') || 'Processing...'}
          </div>
        </div>
      )}

      <SessionsHistory
        isVisible={showSessionsHistory}
        onClose={() => setShowSessionsHistory(false)}
        onSelectSession={handleSelectHistorySession}
        authToken={getSalesRoleToken() || ''}
        workflowType="salesperson"
      />

      <BleProgressModal
        bleScanState={bleScanState}
        pendingBatteryId={pendingBatteryId}
        onCancel={cancelBleOperation}
      />
    </div>
  );
}
