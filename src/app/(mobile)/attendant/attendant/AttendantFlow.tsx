'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { useBridge } from '@/app/context/bridgeContext';

// Types
interface CustomerData {
  id: string;
  name: string;
  subscriptionId: string;
  subscriptionType: string;
  swapCount?: number;
  lastSwap?: string;
}

interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy?: number;
}

interface SwapData {
  oldBattery: BatteryData | null;
  newBattery: BatteryData | null;
  energyDiff: number;
  cost: number;
  rate: number;
}

type AttendantStep = 1 | 2 | 3 | 4 | 5 | 6;

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

  // Helper: Get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Helper: Get battery level class
  const getBatteryClass = (level: number) => {
    if (level >= 80) return 'full';
    if (level >= 40) return 'medium';
    return 'low';
  };

  // Step 1: Scan Customer QR
  const handleScanCustomer = useCallback(async () => {
    setIsScanning(true);
    
    try {
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, (responseData: string) => {
          try {
            const result = JSON.parse(responseData);
            if (result.success && result.data) {
              // Parse QR code data - expecting subscription info
              const qrData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
              
              setCustomerData({
                id: qrData.customer_id || qrData.id || 'CUS-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                name: qrData.name || 'Customer',
                subscriptionId: qrData.subscription_code || qrData.subscriptionId || 'SUB-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                subscriptionType: qrData.plan_type || 'Pay-Per-Swap',
                swapCount: qrData.swap_count || 0,
                lastSwap: qrData.last_swap || 'First swap',
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
            subscriptionType: 'Pay-Per-Swap',
            swapCount: 34,
            lastSwap: '2 days ago',
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
      // In production, this would be an API call
      // For now, simulate lookup
      setTimeout(() => {
        setCustomerData({
          id: 'CUS-' + manualSubscriptionId.slice(-4),
          name: 'John Doe',
          subscriptionId: manualSubscriptionId.toUpperCase(),
          subscriptionType: 'Pay-Per-Swap',
          swapCount: 12,
          lastSwap: '5 days ago',
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

  // Step 2: Scan Old Battery (customer bringing in)
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

  // Step 3: Scan New Battery (giving to customer)
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
              
              // Calculate energy difference and cost
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

  // Step 5: Confirm Payment
  const handleConfirmPayment = useCallback(async () => {
    setIsScanning(true);
    
    try {
      // In production, this would scan customer QR and confirm payment via API
      if (bridge) {
        bridge.callHandler('scanQRCode', {}, async (responseData: string) => {
          try {
            // Process payment confirmation
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

  // Render progress bar
  const renderProgressBar = () => (
    <div className="progress-bar">
      {[1, 2, 3, 4, 5, 6].map((step) => (
        <div
          key={step}
          className={`progress-step ${
            step === currentStep ? 'active' : step < currentStep ? 'completed' : ''
          }`}
        />
      ))}
    </div>
  );

  // Render Step 1: Identify Customer
  const renderStep1 = () => (
    <div className="scan-prompt">
      <h1 className="scan-title">Identify Customer</h1>
      
      {/* Toggle between Scan and Manual */}
      <div className="input-toggle">
        <button 
          className={`toggle-btn ${inputMode === 'scan' ? 'active' : ''}`}
          onClick={() => setInputMode('scan')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Scan QR
        </button>
        <button 
          className={`toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
          onClick={() => setInputMode('manual')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Enter ID
        </button>
      </div>
      
      {inputMode === 'scan' ? (
        <>
          <p className="scan-subtitle">Scan customer&apos;s QR code</p>
          
          <div className="scanner-area" onClick={handleScanCustomer}>
            <div className="scanner-frame">
              <div className="scanner-corners">
                <div className="scanner-corner-bl"></div>
                <div className="scanner-corner-br"></div>
              </div>
              <div className="scanner-line"></div>
              <div className="scanner-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
            </div>
          </div>
          
          <p className="scan-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Customer shows their app QR code
          </p>
        </>
      ) : (
        <>
          <p className="scan-subtitle">Enter Subscription ID manually</p>
          
          <div className="manual-entry-form">
            <div className="form-group">
              <label className="form-label">Subscription ID</label>
              <input 
                type="text" 
                className="form-input manual-id-input" 
                placeholder="e.g. SUB-8847-KE"
                value={manualSubscriptionId}
                onChange={(e) => setManualSubscriptionId(e.target.value)}
              />
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '8px' }}
              onClick={handleManualLookup}
              disabled={isProcessing}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              {isProcessing ? 'Looking up...' : 'Look Up Customer'}
            </button>
          </div>
          
          <p className="scan-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Find ID on customer&apos;s account or receipt
          </p>
        </>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats.today}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.thisWeek}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.successRate}%</div>
          <div className="stat-label">Success</div>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Scan Old Battery
  const renderStep2 = () => (
    <>
      <div className="customer-card" style={{ marginBottom: '12px' }}>
        <div className="customer-header" style={{ marginBottom: 0 }}>
          <div className="customer-avatar">{customerData ? getInitials(customerData.name) : 'CU'}</div>
          <div>
            <div className="customer-name">{customerData?.name || 'Customer'}</div>
            <div className="customer-id">{customerData?.subscriptionId} • {customerData?.subscriptionType}</div>
          </div>
          <span className="battery-status verified" style={{ marginLeft: 'auto' }}>Verified</span>
        </div>
      </div>

      <div className="scan-prompt">
        <h1 className="scan-title">Scan Old Battery</h1>
        <p className="scan-subtitle">Scan the battery the customer brought in</p>
        
        <div className="scanner-area" onClick={handleScanOldBattery} style={{ margin: '12px auto' }}>
          <div className="scanner-frame">
            <div className="scanner-corners">
              <div className="scanner-corner-bl"></div>
              <div className="scanner-corner-br"></div>
            </div>
            <div className="scanner-line"></div>
            <div className="scanner-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
              </svg>
            </div>
          </div>
        </div>
        
        <p className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          Verify battery belongs to customer
        </p>
      </div>
    </>
  );

  // Render Step 3: Scan New Battery
  const renderStep3 = () => (
    <>
      <div className="battery-card" style={{ marginBottom: '12px' }}>
        <div className="battery-header" style={{ marginBottom: '8px' }}>
          <div>
            <div className="battery-id">OLD BATTERY</div>
            <div className="battery-name">{swapData.oldBattery?.id}</div>
          </div>
          <span className="battery-status verified">Matched</span>
        </div>
        <div className="battery-visual" style={{ padding: '8px', marginBottom: 0 }}>
          <div className="battery-icon-large" style={{ width: '40px', height: '60px' }}>
            <div 
              className="battery-level" 
              style={{ '--level': `${swapData.oldBattery?.chargeLevel || 35}%` } as React.CSSProperties}
            ></div>
          </div>
          <div className="battery-info">
            <div className="battery-charge" style={{ fontSize: '20px' }}>{swapData.oldBattery?.chargeLevel || 35}%</div>
            <div className="battery-charge-label">Charge Remaining</div>
          </div>
        </div>
      </div>

      <div className="scan-prompt">
        <h1 className="scan-title">Scan New Battery</h1>
        <p className="scan-subtitle">Scan the fresh battery to give customer</p>
        
        <div className="scanner-area" onClick={handleScanNewBattery} style={{ margin: '12px auto' }}>
          <div className="scanner-frame">
            <div className="scanner-corners">
              <div className="scanner-corner-bl"></div>
              <div className="scanner-corner-br"></div>
            </div>
            <div className="scanner-line"></div>
            <div className="scanner-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render Step 4: Review & Cost
  const renderStep4 = () => (
    <>
      {/* Visual Battery Comparison */}
      <div className="battery-swap-visual">
        <div className="battery-swap-item">
          <div className={`battery-icon-swap ${getBatteryClass(swapData.oldBattery?.chargeLevel || 35)}`}>
            <div 
              className="battery-level-swap" 
              style={{ '--level': `${swapData.oldBattery?.chargeLevel || 35}%` } as React.CSSProperties}
            ></div>
            <span className="battery-percent">{swapData.oldBattery?.chargeLevel || 35}%</span>
          </div>
          <div className="battery-swap-label">RETURNING</div>
          <div className="battery-swap-id">{swapData.oldBattery?.shortId}</div>
        </div>
        
        <div className="swap-arrow-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        
        <div className="battery-swap-item">
          <div className={`battery-icon-swap ${getBatteryClass(swapData.newBattery?.chargeLevel || 100)}`}>
            <div 
              className="battery-level-swap" 
              style={{ '--level': `${swapData.newBattery?.chargeLevel || 100}%` } as React.CSSProperties}
            ></div>
            <span className="battery-percent">{swapData.newBattery?.chargeLevel || 100}%</span>
          </div>
          <div className="battery-swap-label">RECEIVING</div>
          <div className="battery-swap-id">{swapData.newBattery?.shortId}</div>
        </div>
      </div>

      {/* Energy Differential Badge */}
      <div className="energy-diff-badge">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>+{swapData.energyDiff} kWh</span>
      </div>

      <div className="cost-card">
        <div className="cost-title">Cost Breakdown</div>
        <div className="cost-row">
          <span className="cost-label">Energy Received</span>
          <span className="cost-value">{swapData.energyDiff} kWh</span>
        </div>
        <div className="cost-row">
          <span className="cost-label">Rate</span>
          <span className="cost-value">KES {swapData.rate}/kWh</span>
        </div>
        <div className="cost-total">
          <span className="cost-total-label">Total Due</span>
          <span className="cost-total-value">KES {swapData.cost}</span>
        </div>
      </div>

      <div className="customer-card" style={{ padding: '10px' }}>
        <div className="customer-header" style={{ marginBottom: 0 }}>
          <div className="customer-avatar">{customerData ? getInitials(customerData.name) : 'CU'}</div>
          <div>
            <div className="customer-name">{customerData?.name}</div>
            <div className="customer-id">{customerData?.swapCount} swaps • Last: {customerData?.lastSwap}</div>
          </div>
        </div>
      </div>
    </>
  );

  // Render Step 5: Confirm Payment
  const renderStep5 = () => (
    <>
      <div className="cost-card" style={{ marginBottom: '12px' }}>
        <div className="cost-total" style={{ marginTop: 0 }}>
          <span className="cost-total-label">Amount to Collect</span>
          <span className="cost-total-value">KES {swapData.cost}</span>
        </div>
      </div>

      <div className="payment-scan">
        <h2 className="payment-title">Confirm Payment</h2>
        <p className="payment-subtitle">After customer pays, scan their QR to confirm</p>
        
        <div className="qr-scanner-area" onClick={handleConfirmPayment}>
          <div className="qr-scanner-frame">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
        </div>
        
        <div className="payment-amount">KES {swapData.cost.toFixed(2)}</div>
        <div className="payment-status">Scan customer QR after payment</div>
      </div>
    </>
  );

  // Render Step 6: Success
  const renderStep6 = () => (
    <div className="success-screen">
      <div className="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2 className="success-title">Swap Complete!</h2>
      <p className="success-message">Hand over {swapData.newBattery?.id} to customer</p>
      
      <div className="receipt-card">
        <div className="receipt-header">
          <span className="receipt-title">Transaction Receipt</span>
          <span className="receipt-id">#{transactionId}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Customer</span>
          <span className="receipt-value">{customerData?.name}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Returned</span>
          <span className="receipt-value">{swapData.oldBattery?.id} ({swapData.oldBattery?.chargeLevel}%)</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Issued</span>
          <span className="receipt-value">{swapData.newBattery?.id} ({swapData.newBattery?.chargeLevel}%)</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Energy</span>
          <span className="receipt-value">{swapData.energyDiff} kWh</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Amount Paid</span>
          <span className="receipt-value" style={{ color: 'var(--success)' }}>KES {swapData.cost.toFixed(2)}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Time</span>
          <span className="receipt-value">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return renderStep1();
    }
  };

  // Get action bar config for current step
  const getActionBarConfig = () => {
    switch (currentStep) {
      case 1:
        return {
          showBack: false,
          mainText: 'Scan Customer',
          mainAction: handleScanCustomer,
          mainIcon: 'qr',
        };
      case 2:
        return {
          showBack: true,
          mainText: 'Scan Old Battery',
          mainAction: handleScanOldBattery,
          mainIcon: 'scan',
        };
      case 3:
        return {
          showBack: true,
          mainText: 'Scan New Battery',
          mainAction: handleScanNewBattery,
          mainIcon: 'scan',
        };
      case 4:
        return {
          showBack: true,
          mainText: 'Collect Payment',
          mainAction: handleProceedToPayment,
          mainIcon: 'arrow',
        };
      case 5:
        return {
          showBack: true,
          mainText: 'Confirm Payment',
          mainAction: handleConfirmPayment,
          mainIcon: 'qr',
        };
      case 6:
        return {
          showBack: false,
          mainText: 'New Swap',
          mainAction: handleNewSwap,
          mainIcon: 'plus',
          mainClass: 'btn-success',
        };
      default:
        return {
          showBack: false,
          mainText: 'Scan Customer',
          mainAction: handleScanCustomer,
          mainIcon: 'qr',
        };
    }
  };

  const actionConfig = getActionBarConfig();

  // Icon components for action bar
  const ActionIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'qr':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        );
      case 'scan':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
          </svg>
        );
      case 'arrow':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        );
      case 'plus':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="attendant-container">
      <div className="attendant-bg-gradient" />
      
      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Main Content */}
      <main className="attendant-main">
        {/* Back to Roles */}
        <button className="back-to-roles" onClick={handleBackToRoles}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Change Role
        </button>

        {/* Step Content */}
        {renderStepContent()}
      </main>

      {/* Action Bar */}
      <div className="action-bar">
        <div className="action-bar-inner">
          {actionConfig.showBack && (
            <button className="btn btn-secondary" onClick={handleBack}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
          )}
          <button 
            className={`btn ${actionConfig.mainClass || 'btn-primary'}`}
            onClick={actionConfig.mainAction}
            disabled={isScanning || isProcessing}
          >
            <ActionIcon type={actionConfig.mainIcon} />
            <span>{isScanning ? 'Scanning...' : actionConfig.mainText}</span>
          </button>
        </div>
      </div>

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



