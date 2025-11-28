'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';

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

interface AttendantFlowProps {
  onBack?: () => void;
}

export default function AttendantFlow({ onBack }: AttendantFlowProps) {
  const router = useRouter();
  const { bridge } = useBridge();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<AttendantStep>(1);
  
  // Input mode for step 1
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [manualSubscriptionId, setManualSubscriptionId] = useState('');
  
  // Data states
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [swapData, setSwapData] = useState<SwapData>({
    oldBattery: null,
    newBattery: null,
    energyDiff: 0,
    cost: 0,
    rate: 120, // KES per kWh
  });
  
  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Stats (would be fetched from API)
  const [stats] = useState({ today: 24, thisWeek: 156, successRate: 98 });

  // Transaction ID
  const [transactionId, setTransactionId] = useState<string>('');

  // Step 1: Scan Customer QR
  const handleScanCustomer = useCallback(async () => {
    setIsScanning(true);
    
    try {
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, (responseData: string) => {
          try {
            const result = JSON.parse(responseData);
            if (result.success && result.data) {
              const qrData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
              
              setCustomerData({
                id: qrData.customer_id || qrData.id || 'CUS-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                name: qrData.name || 'Customer',
                subscriptionId: qrData.subscription_code || qrData.subscriptionId || 'SUB-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                subscriptionType: qrData.plan_type || 'Pay-Per-Swap',
                swapCount: qrData.swap_count || 0,
                lastSwap: qrData.last_swap || 'First swap',
                // Quota info
                energyRemaining: qrData.energy_remaining || 62,
                energyTotal: qrData.energy_total || 100,
                swapsRemaining: qrData.swaps_remaining || 18,
                swapsTotal: qrData.swaps_total || 21,
                paymentStatus: qrData.payment_status || 'current',
                accountStatus: qrData.account_status || 'active',
                currentBatteryId: qrData.current_battery_id || 'BAT_004',
              });
              
              setCurrentStep(2);
              toast.success('Customer identified');
            } else {
              toast.error('Invalid QR code');
            }
          } catch (e) {
            console.error('Error parsing QR data:', e);
            toast.error('Failed to read QR code');
          }
          setIsScanning(false);
        });
      } else {
        // Simulate for testing without bridge
        setTimeout(() => {
          setCustomerData({
            id: 'CUS-8847-KE',
            name: 'James Mwangi',
            subscriptionId: 'SUB-8847-KE',
            subscriptionType: '7-Day Lux',
            swapCount: 34,
            lastSwap: '2 days ago',
            energyRemaining: 62,
            energyTotal: 100,
            swapsRemaining: 18,
            swapsTotal: 21,
            paymentStatus: 'current',
            accountStatus: 'active',
            currentBatteryId: 'BAT_004',
          });
          setCurrentStep(2);
          toast.success('Customer identified');
          setIsScanning(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge]);

  // Step 1: Manual lookup
  const handleManualLookup = useCallback(async () => {
    if (!manualSubscriptionId.trim()) {
      toast.error('Please enter a Subscription ID');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      setTimeout(() => {
        setCustomerData({
          id: 'CUS-' + manualSubscriptionId.slice(-4),
          name: 'John Doe',
          subscriptionId: manualSubscriptionId.toUpperCase(),
          subscriptionType: 'Pay-Per-Swap',
          swapCount: 12,
          lastSwap: '5 days ago',
          energyRemaining: 45,
          energyTotal: 80,
          swapsRemaining: 8,
          swapsTotal: 14,
          paymentStatus: 'current',
          accountStatus: 'active',
          currentBatteryId: 'BAT_012',
        });
        setCurrentStep(2);
        toast.success('Customer found');
        setIsProcessing(false);
      }, 1000);
    } catch (error) {
      console.error('Lookup error:', error);
      toast.error('Customer not found');
      setIsProcessing(false);
    }
  }, [manualSubscriptionId]);

  // Step 2: Scan Old Battery
  const handleScanOldBattery = useCallback(async () => {
    setIsScanning(true);
    
    try {
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, (responseData: string) => {
          try {
            const result = JSON.parse(responseData);
            if (result.success && result.data) {
              const batteryData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
              
              const oldBattery: BatteryData = {
                id: batteryData.battery_id || batteryData.id || 'BAT-2024-' + Math.random().toString().slice(2, 6),
                shortId: batteryData.short_id || 'BAT-' + Math.random().toString().slice(2, 6),
                chargeLevel: batteryData.charge_level || batteryData.soc || 35,
                energy: batteryData.energy || 0.87,
              };
              
              setSwapData(prev => ({ ...prev, oldBattery }));
              setCurrentStep(3);
              toast.success('Old battery scanned');
            } else {
              toast.error('Invalid battery QR');
            }
          } catch (e) {
            console.error('Error parsing battery data:', e);
            toast.error('Failed to read battery');
          }
          setIsScanning(false);
        });
      } else {
        // Simulate for testing
        setTimeout(() => {
          setSwapData(prev => ({
            ...prev,
            oldBattery: {
              id: 'BAT-2024-7829',
              shortId: 'BAT-7829',
              chargeLevel: 35,
              energy: 0.87,
            }
          }));
          setCurrentStep(3);
          toast.success('Old battery scanned');
          setIsScanning(false);
        }, 1200);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge]);

  // Step 3: Scan New Battery
  const handleScanNewBattery = useCallback(async () => {
    setIsScanning(true);
    
    try {
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, (responseData: string) => {
          try {
            const result = JSON.parse(responseData);
            if (result.success && result.data) {
              const batteryData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
              
              const newBattery: BatteryData = {
                id: batteryData.battery_id || batteryData.id || 'BAT-2024-' + Math.random().toString().slice(2, 6),
                shortId: batteryData.short_id || 'BAT-' + Math.random().toString().slice(2, 6),
                chargeLevel: batteryData.charge_level || batteryData.soc || 100,
                energy: batteryData.energy || 2.5,
              };
              
              const oldEnergy = swapData.oldBattery?.energy || 0;
              const newEnergy = newBattery.energy || 2.5;
              const energyDiff = newEnergy - oldEnergy;
              const cost = Math.round(energyDiff * swapData.rate);
              
              setSwapData(prev => ({ 
                ...prev, 
                newBattery,
                energyDiff: Math.round(energyDiff * 100) / 100,
                cost: cost > 0 ? cost : 0,
              }));
              setCurrentStep(4);
              toast.success('New battery scanned');
            } else {
              toast.error('Invalid battery QR');
            }
          } catch (e) {
            console.error('Error parsing battery data:', e);
            toast.error('Failed to read battery');
          }
          setIsScanning(false);
        });
      } else {
        // Simulate for testing
        setTimeout(() => {
          const newBattery: BatteryData = {
            id: 'BAT-2024-3156',
            shortId: 'BAT-3156',
            chargeLevel: 100,
            energy: 2.5,
          };
          
          const oldEnergy = swapData.oldBattery?.energy || 0.87;
          const energyDiff = 2.5 - oldEnergy;
          
          setSwapData(prev => ({
            ...prev,
            newBattery,
            energyDiff: Math.round(energyDiff * 100) / 100,
            cost: Math.round(energyDiff * prev.rate),
          }));
          setCurrentStep(4);
          toast.success('New battery scanned');
          setIsScanning(false);
        }, 1200);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Scan failed');
      setIsScanning(false);
    }
  }, [bridge, swapData.oldBattery, swapData.rate]);

  // Step 4: Proceed to payment
  const handleProceedToPayment = useCallback(() => {
    setCurrentStep(5);
  }, []);

  // Step 5: Confirm Payment via QR
  const handleConfirmPayment = useCallback(async () => {
    setIsScanning(true);
    
    try {
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, async () => {
          try {
            const txnId = 'TXN-' + Math.random().toString().slice(2, 8);
            setTransactionId(txnId);
            setCurrentStep(6);
            toast.success('Payment confirmed!');
          } catch (e) {
            console.error('Payment error:', e);
            toast.error('Payment confirmation failed');
          }
          setIsScanning(false);
        });
      } else {
        // Simulate for testing
        setTimeout(() => {
          const txnId = 'TXN-' + Math.random().toString().slice(2, 8);
          setTransactionId(txnId);
          setCurrentStep(6);
          toast.success('Payment confirmed!');
          setIsScanning(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed');
      setIsScanning(false);
    }
  }, [bridge]);

  // Step 5: Manual payment confirmation
  const handleManualPayment = useCallback((paymentId: string) => {
    setIsProcessing(true);
    
    setTimeout(() => {
      setTransactionId(paymentId.toUpperCase());
      setCurrentStep(6);
      toast.success('Payment confirmed!');
      setIsProcessing(false);
    }, 1000);
  }, []);

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
  }, []);

  // Go back one step
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as AttendantStep);
    }
  }, [currentStep]);

  // Handle back to roles
  const handleBackToRoles = useCallback(() => {
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
            isProcessing={isProcessing}
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
      
      {/* Back to Roles */}
      <div style={{ padding: '8px 16px 0' }}>
        <button className="back-to-roles" onClick={handleBackToRoles}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Change Role
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
        isLoading={isScanning || isProcessing}
      />

      {/* Loading Overlay */}
      {(isScanning || isProcessing) && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">{isScanning ? 'Scanning...' : 'Processing...'}</div>
        </div>
      )}
    </div>
  );
}
