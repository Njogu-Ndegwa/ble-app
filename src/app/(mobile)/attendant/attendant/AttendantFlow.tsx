'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  energyRemaining?: number;
  swapsRemaining?: number;
  status?: 'active' | 'current' | 'overdue';
  paymentStatus?: 'current' | 'overdue';
  currentBatteryId?: string;
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
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<AttendantStep>(1);
  
  // Input mode for step 1 and step 5
  const [customerInputMode, setCustomerInputMode] = useState<'scan' | 'manual'>('scan');
  const [paymentInputMode, setPaymentInputMode] = useState<'scan' | 'manual'>('scan');
  const [manualSubscriptionId, setManualSubscriptionId] = useState('');
  const [manualPaymentId, setManualPaymentId] = useState('');
  
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

  // Scroll timeline to center active step
  useEffect(() => {
    if (timelineRef.current) {
      const activeStep = timelineRef.current.querySelector('.timeline-step.active');
      if (activeStep) {
        activeStep.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentStep]);

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

  // Timeline click handler (only allow going back to completed steps)
  const handleTimelineClick = useCallback((step: number) => {
    if (step < currentStep) {
      setCurrentStep(step as AttendantStep);
    }
  }, [currentStep]);

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
                subscriptionType: qrData.plan_type || '7-Day Lux',
                swapCount: qrData.swap_count || 34,
                lastSwap: qrData.last_swap || '2 days ago',
                energyRemaining: qrData.energy_remaining || 62,
                swapsRemaining: qrData.swaps_remaining || 18,
                status: 'active',
                paymentStatus: 'current',
                currentBatteryId: qrData.battery_id || 'BAT_004',
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
            swapsRemaining: 18,
            status: 'active',
            paymentStatus: 'current',
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
          swapsRemaining: 10,
          status: 'active',
          paymentStatus: 'current',
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
  const handleManualPaymentConfirm = useCallback(() => {
    if (!manualPaymentId.trim()) {
      toast.error('Please enter a Payment ID');
      return;
    }
    
    setIsProcessing(true);
    setTimeout(() => {
      setTransactionId(manualPaymentId.toUpperCase());
      setCurrentStep(6);
      toast.success('Payment confirmed!');
      setIsProcessing(false);
    }, 1000);
  }, [manualPaymentId]);

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
    setManualPaymentId('');
    setTransactionId('');
    setCustomerInputMode('scan');
    setPaymentInputMode('scan');
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

  // Timeline step icons
  const TimelineIcons = {
    customer: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    oldBattery: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="16" height="10" rx="2"/>
        <path d="M22 11v2"/>
        <path d="M6 11v2"/>
      </svg>
    ),
    newBattery: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="16" height="10" rx="2"/>
        <path d="M22 11v2"/>
        <path d="M7 11h4M9 9v4"/>
      </svg>
    ),
    review: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6"/>
        <path d="M16 13H8M16 17H8"/>
      </svg>
    ),
    payment: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <path d="M1 10h22"/>
      </svg>
    ),
    done: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
  };

  // Render Interactive Timeline
  const renderTimeline = () => {
    const steps = [
      { num: 1, label: 'Customer', icon: TimelineIcons.customer },
      { num: 2, label: 'Return', icon: TimelineIcons.oldBattery },
      { num: 3, label: 'New', icon: TimelineIcons.newBattery },
      { num: 4, label: 'Review', icon: TimelineIcons.review },
      { num: 5, label: 'Pay', icon: TimelineIcons.payment },
      { num: 6, label: 'Done', icon: TimelineIcons.done },
    ];

    return (
      <div className="flow-timeline" ref={timelineRef}>
        <div className="timeline-track">
          {steps.map((step, index) => (
            <React.Fragment key={step.num}>
              <div 
                className={`timeline-step ${
                  step.num === currentStep ? 'active' : 
                  step.num < currentStep ? 'completed' : 
                  step.num === 6 && currentStep === 6 ? 'success' : 'disabled'
                }`}
                onClick={() => handleTimelineClick(step.num)}
              >
                <div className="timeline-dot">
                  {step.icon}
                </div>
                <span className="timeline-label">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`timeline-connector ${step.num < currentStep ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Render Customer State Panel (visible after step 1)
  const renderCustomerStatePanel = () => {
    if (!customerData || currentStep === 1) return null;

    return (
      <>
        <div className="customer-state-panel visible">
          <div className="customer-state-inner">
            <div className="state-customer">
              <div className="state-avatar">{getInitials(customerData.name)}</div>
              <div className="state-customer-info">
                <div className="state-customer-name">{customerData.name}</div>
                <div className="state-plan-row">
                  <span className="state-plan-name">{customerData.subscriptionType}</span>
                  <span className={`state-badge ${customerData.status}`}>
                    {customerData.status === 'active' ? 'Active' : customerData.status}
                  </span>
                  <span className={`state-badge ${customerData.paymentStatus}`}>
                    {customerData.paymentStatus === 'current' ? 'Current' : 'Overdue'}
                  </span>
                </div>
              </div>
            </div>
            <div className="state-battery">
              <div className="state-battery-icon">
                <div className="state-battery-fill" style={{ '--level': '100%' } as React.CSSProperties}></div>
              </div>
              <span className="state-battery-id">{customerData.currentBatteryId}</span>
            </div>
          </div>
        </div>
        
        {/* Quotas Panel */}
        <div className="state-quotas visible">
          <div className="state-quota-item">
            <div className="state-quota-icon energy">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div className="state-quota-info">
              <div className="state-quota-value">
                <span className="remaining">{customerData.energyRemaining}</span>
                <span className="unit">kWh left</span>
              </div>
              <div className="state-quota-bar">
                <div 
                  className={`state-quota-fill ${customerData.energyRemaining! > 30 ? 'good' : customerData.energyRemaining! > 10 ? 'warning' : 'critical'}`} 
                  style={{ width: `${Math.min((customerData.energyRemaining! / 100) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="state-quota-item">
            <div className="state-quota-icon swaps">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </div>
            <div className="state-quota-info">
              <div className="state-quota-value">
                <span className="remaining">{customerData.swapsRemaining}</span>
                <span className="unit">swaps left</span>
              </div>
              <div className="state-quota-bar">
                <div 
                  className={`state-quota-fill ${customerData.swapsRemaining! > 10 ? 'good' : customerData.swapsRemaining! > 5 ? 'warning' : 'critical'}`} 
                  style={{ width: `${Math.min((customerData.swapsRemaining! / 30) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Render Step 1: Identify Customer
  const renderStep1 = () => (
    <div className="screen active animate-fade-slide-in">
      <div className="scan-prompt">
        <h1 className="scan-title">Identify Customer</h1>
        
        {/* Toggle between Scan and Manual */}
        <div className="input-toggle">
          <button 
            className={`toggle-btn ${customerInputMode === 'scan' ? 'active' : ''}`}
            onClick={() => setCustomerInputMode('scan')}
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
            className={`toggle-btn ${customerInputMode === 'manual' ? 'active' : ''}`}
            onClick={() => setCustomerInputMode('manual')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Enter ID
          </button>
        </div>
        
        {customerInputMode === 'scan' ? (
          <div className="customer-input-mode">
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
          </div>
        ) : (
          <div className="customer-input-mode">
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
                  autoComplete="off"
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
          </div>
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
    </div>
  );

  // Render Step 2: Scan Old Battery
  const renderStep2 = () => (
    <div className="screen active animate-fade-slide-in">
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
    </div>
  );

  // Render Step 3: Scan New Battery
  const renderStep3 = () => (
    <div className="screen active animate-fade-slide-in">
      {/* Compact Old Battery Card */}
      <div className="battery-return-card">
        <div className="battery-return-header">
          <span className="battery-return-label">OLD BATTERY</span>
          <span className="battery-return-status">Matched</span>
        </div>
        <div className="battery-return-content">
          <div className="battery-return-id">{swapData.oldBattery?.id}</div>
          <div className="battery-return-charge">
            <div className={`battery-return-icon ${getBatteryClass(swapData.oldBattery?.chargeLevel || 35)}`}>
              <div className="battery-return-fill" style={{ '--level': `${swapData.oldBattery?.chargeLevel || 35}%` } as React.CSSProperties}></div>
            </div>
            <span className="battery-return-percent">{swapData.oldBattery?.chargeLevel || 35}%</span>
            <span className="battery-return-unit">Charge</span>
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
    </div>
  );

  // Render Step 4: Review & Cost
  const renderStep4 = () => (
    <div className="screen active animate-fade-slide-in">
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
    </div>
  );

  // Render Step 5: Confirm Payment
  const renderStep5 = () => (
    <div className="screen active animate-fade-slide-in">
      <div className="cost-card" style={{ marginBottom: '8px' }}>
        <div className="cost-total" style={{ marginTop: 0 }}>
          <span className="cost-total-label">Amount to Collect</span>
          <span className="cost-total-value">KES {swapData.cost}</span>
        </div>
      </div>

      <div className="payment-scan">
        <h2 className="payment-title">Confirm Payment</h2>
        
        {/* Toggle between Scan and Manual */}
        <div className="input-toggle">
          <button 
            className={`toggle-btn ${paymentInputMode === 'scan' ? 'active' : ''}`}
            onClick={() => setPaymentInputMode('scan')}
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
            className={`toggle-btn ${paymentInputMode === 'manual' ? 'active' : ''}`}
            onClick={() => setPaymentInputMode('manual')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Enter ID
          </button>
        </div>
        
        {paymentInputMode === 'scan' ? (
          <div className="payment-input-mode">
            <p className="payment-subtitle">Scan customer&apos;s QR after payment</p>
            
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
            <div className="payment-status">Tap to scan customer QR</div>
          </div>
        ) : (
          <div className="payment-input-mode">
            <p className="payment-subtitle">Enter payment transaction ID</p>
            
            <div className="manual-entry-form">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Payment / Transaction ID</label>
                <input 
                  type="text" 
                  className="form-input manual-id-input" 
                  placeholder="e.g. TXN-892741 or M-PESA code"
                  value={manualPaymentId}
                  onChange={(e) => setManualPaymentId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px' }}
                onClick={handleManualPaymentConfirm}
                disabled={isProcessing}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Confirm Payment
              </button>
            </div>
            
            <div className="payment-amount" style={{ marginTop: '8px' }}>KES {swapData.cost.toFixed(2)}</div>
            <p className="scan-hint" style={{ marginTop: '4px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Enter M-PESA code or receipt number
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Render Step 6: Success
  const renderStep6 = () => (
    <div className="screen active animate-fade-slide-in">
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
      
      {/* Back to Roles - At very top */}
      <button className="back-to-roles" onClick={handleBackToRoles} style={{ margin: '0 16px 8px', zIndex: 20, position: 'relative' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Change Role
      </button>

      {/* Interactive Timeline */}
      {renderTimeline()}

      {/* Customer State Panel */}
      {renderCustomerStatePanel()}

      {/* Main Content */}
      <main className="attendant-main">
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
