'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';
import { getAttendantUser, clearAttendantLogin } from '@/lib/attendant-auth';

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
} from './components';

// Constants
const PAYMENT_CONFIRMATION_ENDPOINT = "https://crm-omnivoltaic.odoo.com/api/lipay/manual-confirm";

interface AttendantFlowProps {
  onBack?: () => void;
}

export default function AttendantFlow({ onBack }: AttendantFlowProps) {
  const router = useRouter();
  const { bridge } = useBridge();
  
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
  
  // Stats (fetched from API in a real implementation)
  const [stats] = useState({ today: 0, thisWeek: 0, successRate: 0 });

  // Transaction ID
  const [transactionId, setTransactionId] = useState<string>('');
  
  // Ref for correlation ID
  const correlationIdRef = useRef<string>('');

  // Get electricity service from service states
  const electricityService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-electricity')
  );

  // Get battery fleet service (to check current_asset for customer type)
  const batteryFleetService = serviceStates.find(
    (service) => typeof service?.service_id === 'string' && service.service_id.includes('service-battery-fleet')
  );

  // Step 1: Scan Customer QR - with MQTT identify_customer
  const handleScanCustomer = useCallback(async () => {
    if (!bridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    
    const processQRData = (qrCodeData: string) => {
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
      const responseTopic = `echo/abs/service/plan/${currentPlanId}/identify_customer`;

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

      console.info("=== Customer Identification MQTT ===");
      console.info("Request Topic:", requestTopic);
      console.info("Response Topic:", responseTopic);
      console.info("Payload:", JSON.stringify(payload, null, 2));

      // Register response handler
      bridge.registerHandler(
        "mqttMsgArrivedCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const parsedMqttData = JSON.parse(data);
            const topic = parsedMqttData.topic;
            const rawMessageContent = parsedMqttData.message;

            // Check if this is our response topic
            if (topic === responseTopic) {
              console.info("Response received from identify_customer:", JSON.stringify(parsedMqttData, null, 2));

              let responseData: any;
              try {
                responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
              } catch {
                responseData = rawMessageContent;
              }

              // Check correlation ID
              const storedCorrelationId = (window as any).__customerIdentificationCorrelationId;
              const responseCorrelationId = responseData?.correlation_id;

              const correlationMatches =
                Boolean(storedCorrelationId) &&
                Boolean(responseCorrelationId) &&
                (responseCorrelationId === storedCorrelationId ||
                  responseCorrelationId.startsWith(storedCorrelationId) ||
                  storedCorrelationId.startsWith(responseCorrelationId));

              if (correlationMatches) {
                // Parse response structure: data.success, data.signals, data.metadata
                const success = responseData?.data?.success ?? false;
                const signals = responseData?.data?.signals || [];

                const hasRequiredSignal = success === true && 
                  Array.isArray(signals) && 
                  signals.includes("CUSTOMER_IDENTIFIED_SUCCESS");

                if (hasRequiredSignal) {
                  console.info("Customer identification successful!");
                  
                  // Extract from data.metadata structure
                  const metadata = responseData?.data?.metadata;
                  const servicePlanData = metadata?.service_plan_data;
                  const serviceBundle = metadata?.service_bundle;
                  const identifiedCustomerId = metadata?.customer_id;
                  
                  if (servicePlanData) {
                    // Extract service states
                    const extractedServiceStates = (servicePlanData.serviceStates || []).filter(
                      (service: any) => typeof service?.service_id === 'string'
                    );
                    
                    // Enrich with service bundle info (usageUnitPrice, name)
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
                    
                    // Determine customer type from battery fleet service current_asset
                    const batteryFleet = enrichedServiceStates.find(
                      (s: any) => s.service_id?.includes('service-battery-fleet')
                    );
                    const inferredType = batteryFleet?.current_asset ? 'returning' : 'first-time';
                    setCustomerType(inferredType);
                    
                    // Find electricity service for rate and quotas
                    const elecService = enrichedServiceStates.find(
                      (s: any) => s.service_id?.includes('service-electricity')
                    );
                    
                    // Find swap count service for swap quotas
                    const swapCountService = enrichedServiceStates.find(
                      (s: any) => s.service_id?.includes('service-swap-count')
                    );
                    
                    // Update rate from service
                    if (elecService?.usageUnitPrice) {
                      setSwapData(prev => ({ ...prev, rate: elecService.usageUnitPrice }));
                    }
                    
                    // Set customer data from response
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
                      paymentStatus: servicePlanData.paymentState === 'CURRENT' ? 'current' : 'overdue',
                      accountStatus: servicePlanData.status === 'ACTIVE' ? 'active' : 'inactive',
                      currentBatteryId: batteryFleet?.current_asset || undefined,
                    });
                    
                    setCurrentStep(2);
                    toast.success('Customer identified');
                  } else {
                    console.error("No service_plan_data in response");
                    toast.error("Invalid customer data received");
                  }
                } else {
                  console.error("Customer identification failed - missing required signal");
                  const errorMsg = responseData?.data?.error || responseData?.error || "Customer identification failed";
                  toast.error(errorMsg);
                }
              }
            }
            responseCallback({});
          } catch (err) {
            console.error("Error processing MQTT response:", err);
          }
          setIsScanning(false);
        }
      );

      // Publish the request
      bridge.callHandler(
        "mqttPublishMsg",
        JSON.stringify(dataToPublish),
        (publishResponse: string) => {
          try {
            const pubResp = typeof publishResponse === 'string' ? JSON.parse(publishResponse) : publishResponse;
            if (pubResp?.error || pubResp?.respCode !== "200") {
              console.error("Failed to publish identify_customer:", pubResp?.respDesc || pubResp?.error);
              toast.error("Failed to identify customer");
              setIsScanning(false);
            } else {
              console.info("identify_customer published, waiting for response...");
            }
          } catch (err) {
            console.error("Error parsing publish response:", err);
            toast.error("Error identifying customer");
            setIsScanning(false);
          }
        }
      );
    };

    try {
      bridge.callHandler('scanQRCode', {}, (responseData: string) => {
        try {
          const result = JSON.parse(responseData);
          if (result.success && result.data) {
            const qrData = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
            processQRData(qrData);
          } else {
            toast.error('Failed to scan QR code');
            setIsScanning(false);
          }
        } catch (e) {
          console.error('Error parsing QR data:', e);
          toast.error('Failed to read QR code');
          setIsScanning(false);
        }
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge, attendantInfo]);

  // Step 1: Manual lookup - also uses MQTT
  const handleManualLookup = useCallback(async () => {
    if (!manualSubscriptionId.trim()) {
      toast.error('Please enter a Subscription ID');
      return;
    }

    if (!bridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }
    
    setIsProcessing(true);
    
    // Use the subscription ID as the plan_id
    const subscriptionCode = manualSubscriptionId.trim();
    setDynamicPlanId(subscriptionCode);
    
    // Generate correlation ID
    const correlationId = `att-customer-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    correlationIdRef.current = correlationId;
    (window as any).__customerIdentificationCorrelationId = correlationId;

    // Build MQTT payload for manual lookup
    const requestTopic = `emit/uxi/attendant/plan/${subscriptionCode}/identify_customer`;
    const responseTopic = `echo/abs/service/plan/${subscriptionCode}/identify_customer`;

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
    console.info("Payload:", JSON.stringify(payload, null, 2));

    // Register response handler (same as QR scan)
    bridge.registerHandler(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedMqttData = JSON.parse(data);
          const topic = parsedMqttData.topic;
          const rawMessageContent = parsedMqttData.message;

          if (topic === responseTopic) {
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
              const success = responseData?.data?.success ?? false;
              const signals = responseData?.data?.signals || [];

              if (success && signals.includes("CUSTOMER_IDENTIFIED_SUCCESS")) {
                const metadata = responseData?.data?.metadata;
                const servicePlanData = metadata?.service_plan_data;
                const serviceBundle = metadata?.service_bundle;
                const identifiedCustomerId = metadata?.customer_id;
                
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
                    paymentStatus: servicePlanData.paymentState === 'CURRENT' ? 'current' : 'overdue',
                    accountStatus: servicePlanData.status === 'ACTIVE' ? 'active' : 'inactive',
                    currentBatteryId: batteryFleet?.current_asset || undefined,
                  });
                  
                  setCurrentStep(2);
                  toast.success('Customer found');
                }
              } else {
                const errorMsg = responseData?.data?.error || "Customer not found";
                toast.error(errorMsg);
              }
            }
          }
          responseCallback({});
        } catch (err) {
          console.error("Error processing MQTT response:", err);
        }
        setIsProcessing(false);
      }
    );

    // Publish the request
    bridge.callHandler(
      "mqttPublishMsg",
      JSON.stringify(dataToPublish),
      (publishResponse: string) => {
        try {
          const pubResp = typeof publishResponse === 'string' ? JSON.parse(publishResponse) : publishResponse;
          if (pubResp?.error || pubResp?.respCode !== "200") {
            console.error("Failed to publish identify_customer:", pubResp?.respDesc || pubResp?.error);
            toast.error("Failed to lookup customer");
            setIsProcessing(false);
          }
        } catch (err) {
          console.error("Error parsing publish response:", err);
          toast.error("Error looking up customer");
          setIsProcessing(false);
        }
      }
    );
  }, [bridge, manualSubscriptionId, attendantInfo]);

  // Step 2: Scan Old Battery
  const handleScanOldBattery = useCallback(async () => {
    if (!bridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    
    try {
      bridge.callHandler('scanQRCode', {}, (responseData: string) => {
        try {
          const result = JSON.parse(responseData);
          if (result.success && result.data) {
            let batteryData: any;
            try {
              batteryData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
            } catch {
              batteryData = { id: result.data };
            }
            
            const oldBattery: BatteryData = {
              id: batteryData.battery_id || batteryData.id || batteryData,
              shortId: (batteryData.battery_id || batteryData.id || batteryData).toString().slice(-6),
              chargeLevel: batteryData.charge_level || batteryData.soc || batteryData.chargeLevel || 0,
              energy: batteryData.energy || batteryData.kwh || 0,
            };
            
            setSwapData(prev => ({ ...prev, oldBattery }));
            setCurrentStep(3);
            toast.success('Old battery scanned');
          } else {
            toast.error('Failed to scan battery QR');
          }
        } catch (e) {
          console.error('Error parsing battery data:', e);
          toast.error('Failed to read battery');
        }
        setIsScanning(false);
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge]);

  // Step 3: Scan New Battery
  const handleScanNewBattery = useCallback(async () => {
    if (!bridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    
    try {
      bridge.callHandler('scanQRCode', {}, (responseData: string) => {
        try {
          const result = JSON.parse(responseData);
          if (result.success && result.data) {
            let batteryData: any;
            try {
              batteryData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
            } catch {
              batteryData = { id: result.data };
            }
            
            const newBattery: BatteryData = {
              id: batteryData.battery_id || batteryData.id || batteryData,
              shortId: (batteryData.battery_id || batteryData.id || batteryData).toString().slice(-6),
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
          } else {
            toast.error('Failed to scan battery QR');
          }
        } catch (e) {
          console.error('Error parsing battery data:', e);
          toast.error('Failed to read battery');
        }
        setIsScanning(false);
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge, swapData.oldBattery, swapData.rate, electricityService?.usageUnitPrice]);

  // Step 4: Proceed to payment
  const handleProceedToPayment = useCallback(() => {
    setCurrentStep(5);
  }, []);

  // Step 5: Confirm Payment via HTTP
  const handleConfirmPayment = useCallback(async () => {
    if (!bridge) {
      toast.error('Bridge not available. Please restart the app.');
      return;
    }

    setIsScanning(true);
    
    // Scan customer QR for payment confirmation
    bridge.callHandler('scanQRCode', {}, async (responseData: string) => {
      try {
        const result = JSON.parse(responseData);
        if (result.success && result.data) {
          // Extract transaction ID from QR
          let qrData: any;
          try {
            qrData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
          } catch {
            qrData = { transaction_id: result.data };
          }
          const txnId = qrData.transaction_id || qrData.txn_id || qrData.id || result.data;
          
          // Call HTTP endpoint for payment confirmation
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
              
              // Now publish payment_and_service
              publishPaymentAndService(txnId);
            } else {
              const errorData = await response.json().catch(() => ({}));
              toast.error(errorData.message || 'Payment confirmation failed');
              setIsScanning(false);
            }
          } catch (err) {
            console.error('Payment confirmation error:', err);
            toast.error('Payment confirmation failed. Check network connection.');
            setIsScanning(false);
          }
        } else {
          toast.error('Failed to scan payment QR');
          setIsScanning(false);
        }
      } catch (e) {
        console.error('Payment error:', e);
        toast.error('Payment confirmation failed');
        setIsScanning(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, dynamicPlanId, swapData.cost]);

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
      setIsScanning(false);
      setIsProcessing(false);
      return;
    }

    const requestTopic = `emit/uxi/attendant/plan/${dynamicPlanId}/payment_and_service`;
    
    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content: paymentAndServicePayload,
    };

    console.info("=== Publishing payment_and_service ===");
    console.info("Topic:", requestTopic);
    console.info("Payload:", JSON.stringify(paymentAndServicePayload, null, 2));

    bridge.callHandler(
      "mqttPublishMsg",
      JSON.stringify(dataToPublish),
      (publishResponse: any) => {
        try {
          const pubResp = typeof publishResponse === 'string' 
            ? JSON.parse(publishResponse) 
            : publishResponse;
          
          if (pubResp?.error || pubResp?.respCode !== "200") {
            console.error("Failed to publish payment_and_service:", pubResp?.respDesc || pubResp?.error);
            toast.error("Failed to complete swap");
            setPaymentAndServiceStatus('error');
          } else {
            console.info("payment_and_service published successfully");
            setPaymentAndServiceStatus('success');
            setCurrentStep(6);
            toast.success('Swap completed!');
          }
        } catch (err) {
          console.error("Error parsing publish response:", err);
          toast.error("Error completing swap");
          setPaymentAndServiceStatus('error');
        }
        setIsScanning(false);
        setIsProcessing(false);
      }
    );
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
  }, []);

  // Go back one step
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as AttendantStep);
    }
  }, [currentStep]);

  // Handle logout and back to roles
  const handleBackToRoles = useCallback(() => {
    clearAttendantLogin();
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
        return <Step2OldBattery onScanOldBattery={handleScanOldBattery} />;
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
      
      {/* Back to Roles / Logout */}
      <div style={{ padding: '8px 16px 0' }}>
        <button className="back-to-roles" onClick={handleBackToRoles}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Logout
        </button>
      </div>

      {/* Interactive Timeline */}
      <Timeline 
        currentStep={currentStep} 
        onStepClick={handleTimelineClick}
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
