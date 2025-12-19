"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  RiderNav,
  RiderHome,
  RiderActivity,
  RiderStations,
  RiderProfile,
  QRCodeModal,
  TopUpModal,
} from './components';
import type { ActivityItem, Station } from './components';
import Login from '../serviceplan1/login';

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";
const API_KEY = "abs_connector_secret_key_2024";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
}

interface BikeInfo {
  model: string;
  vehicleId: string;
  lastSwap: string;
  totalSwaps: number;
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | 'active' | 'inactive' | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface Subscription {
  id: number;
  subscription_code: string;
  status: string;
  product_id: number;
  product_name: string;
  start_date: string;
  next_cycle_date: string;
  price_at_signup: number;
  currency: string;
  cycle_interval: number;
  cycle_unit: string;
}

const RiderApp: React.FC = () => {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  // UI state
  const [currentScreen, setCurrentScreen] = useState<'home' | 'stations' | 'activity' | 'profile'>('home');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  
  // Data state
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('XOF');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [bike, setBike] = useState<BikeInfo>({
    model: 'E-Trike 3X',
    vehicleId: 'VEH-2024-8847',
    lastSwap: '2h ago',
    totalSwaps: 47,
    paymentState: 'PAID',
    currentBatteryId: undefined,
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showFoundCustomer, setShowFoundCustomer] = useState(false);

  // Check authentication on mount - show found customer screen if credentials exist
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken_rider');
      const storedCustomerData = localStorage.getItem('customerData_rider');
      
      if (token && storedCustomerData) {
        try {
          const customerData = JSON.parse(storedCustomerData);
          setCustomer(customerData);
          setShowFoundCustomer(true); // Show found customer screen instead of auto-login
        } catch (e) {
          console.error('Error parsing stored customer data:', e);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Fetch dashboard data from API
  const fetchDashboardData = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/customer/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.summary) {
          setBalance(data.summary.total_paid || 0);
        }
        
        // Don't use activity_history from dashboard - use GraphQL instead
        // Activity data will be fetched from GraphQL when subscription is loaded
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Fetch activity data from GraphQL
  const fetchActivityData = async (subscriptionCode: string) => {
    try {
      const graphqlEndpoint = 'https://abs-platform-dev.omnivoltaic.com/graphql';
      
      const query = `
        query {
          servicePlanActions(servicePlanId: "${subscriptionCode}", limit: 20) {
            servicePlanId
            paymentAccountId
            serviceAccountId
            paymentActions {
              paymentActionId
              paymentType
              paymentAmount
              createdAt
            }
            serviceActions {
              serviceActionId
              serviceType
              serviceAmount
              createdAt
            }
          }
        }
      `;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.data?.servicePlanActions) {
          const { paymentActions, serviceActions } = result.data.servicePlanActions;
          const mappedActivities: ActivityItem[] = [];

          // Map paymentActions to "payment" type
          if (paymentActions && Array.isArray(paymentActions)) {
            paymentActions.forEach((action: any) => {
              const date = new Date(action.createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });

              let title = '';
              let isPositive = false;
              
              if (action.paymentType === 'DEPOSIT' || action.paymentType === 'TOPUP') {
                title = t('rider.balanceTopUp') || 'Balance Top-up';
                isPositive = true;
              } else if (action.paymentType === 'SUBSCRIPTION_PAYMENT') {
                title = t('rider.subscriptionPayment') || 'Subscription Payment';
                isPositive = false;
              } else {
                title = t('common.payment') || 'Payment';
                isPositive = action.paymentType === 'DEPOSIT' || action.paymentType === 'TOPUP';
              }

              mappedActivities.push({
                id: action.paymentActionId || `payment-${Date.now()}`,
                type: 'payment',
                title: title,
                subtitle: action.paymentType || '',
                amount: Math.abs(action.paymentAmount || 0),
                currency: currency,
                isPositive: isPositive,
                time: timeStr,
                date: formattedDate,
              });
            });
          }

          // Map serviceActions to "swap" type
          if (serviceActions && Array.isArray(serviceActions)) {
            serviceActions.forEach((action: any) => {
              const date = new Date(action.createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });

              let title = '';
              let subtitle = '';
              
              if (action.serviceType?.includes('swap')) {
                title = t('attendant.batterySwap') || 'Battery Swap';
                subtitle = t('rider.batterySwapTransaction') || 'Battery swap transaction';
              } else if (action.serviceType?.includes('electricity')) {
                title = t('rider.electricityUsage') || 'Electricity Usage';
                subtitle = `${action.serviceAmount || 0} kWh`;
              } else {
                title = t('common.service') || 'Service';
                subtitle = action.serviceType || '';
              }

              mappedActivities.push({
                id: action.serviceActionId || `service-${Date.now()}`,
                type: 'swap',
                title: title,
                subtitle: subtitle,
                amount: Math.abs(action.serviceAmount || 0),
                currency: currency,
                isPositive: false,
                time: timeStr,
                date: formattedDate,
              });
            });
          }

          // Sort by date (newest first)
          mappedActivities.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time).getTime();
            const dateB = new Date(b.date + 'T' + b.time).getTime();
            return dateB - dateA;
          });

          setActivities(mappedActivities);
          console.log('Activity data fetched from GraphQL:', mappedActivities.length, 'activities');
        } else {
          console.log('No activity data in GraphQL response');
          setActivities([]);
        }
      } else {
        console.error('GraphQL response not OK:', response.status);
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activity data:', error);
      setActivities([]);
    }
  };

  // Fetch subscription data using partner_id 
  const fetchSubscriptionData = async (partnerId: number, token: string) => {
    try {
      const response = await fetch(`${API_BASE}/customers/${partnerId}/subscriptions?page=1&limit=20`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.subscriptions && data.subscriptions.length > 0) {
          // Find active subscription or use the first one
          const activeSubscription = data.subscriptions.find((sub: Subscription) => sub.status === 'active') || data.subscriptions[0];
          console.log('Subscription loaded:', activeSubscription.subscription_code, activeSubscription.product_name);
          setSubscription(activeSubscription);
          
          // Update bike payment state with subscription status
          setBike(prev => ({
            ...prev,
            paymentState: activeSubscription.status === 'active' ? 'active' : activeSubscription.status,
          }));

          // Fetch activity data using subscription code
          if (activeSubscription.subscription_code) {
            console.log('Fetching activity data for subscription:', activeSubscription.subscription_code);
            await fetchActivityData(activeSubscription.subscription_code);
          } else {
            console.warn('No subscription_code found in subscription data');
          }
        } else {
          console.warn('No subscriptions found in response');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    }
  };

  // Refetch activity when subscription changes
  useEffect(() => {
    if (subscription?.subscription_code) {
      console.log('Subscription changed, fetching activity data:', subscription.subscription_code);
      fetchActivityData(subscription.subscription_code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.subscription_code]);

  // Fetch stations
  useEffect(() => {
    if (isLoggedIn) {
      const fetchStations = async () => {
        try {
          const token = localStorage.getItem('authToken_rider');
          const response = await fetch(`${API_BASE}/stations/nearby`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': API_KEY,
              ...(token && { 'Authorization': `Bearer ${token}` }),
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.stations) {
              setStations(data.stations);
            }
          }
        } catch (error) {
          console.error('Error fetching stations:', error);
          // Use mock data as fallback
          setStations([
            { id: 1, name: 'Lome Central Station', address: 'Rue du Commerce, Lome', distance: '0.8 km', batteries: 12, waitTime: '~3 min' },
            { id: 2, name: 'Tokoin Market Station', address: 'Tokoin Market Area', distance: '1.4 km', batteries: 3, waitTime: '~5 min' },
            { id: 3, name: 'Agoe Station', address: 'Agoe District', distance: '2.1 km', batteries: 8, waitTime: '~2 min' },
            { id: 4, name: 'Be Station', address: 'Be Quarter', distance: '3.2 km', batteries: 15, waitTime: '~1 min' },
            { id: 5, name: 'Adidogome Station', address: 'Adidogome Area', distance: '4.5 km', batteries: 6, waitTime: '~4 min' },
          ]);
        }
      };

      fetchStations();
    }
  }, [isLoggedIn]);

  // Lock body overflow
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  const handleBackToRoles = () => {
    router.push('/');
  };

  const handleLoginSuccess = async (customerData: Customer) => {
    setCustomer(customerData);
    setIsLoggedIn(true);
    const token = localStorage.getItem('authToken_rider');
    if (token) {
      fetchDashboardData(token);
      
      // Fetch subscription data if partner_id is available
      if (customerData.partner_id) {
        await fetchSubscriptionData(customerData.partner_id, token);
      }
    }
  };

  const handleLogout = () => {
    // Clear all credentials from localStorage on logout
    localStorage.removeItem('authToken_rider');
    localStorage.removeItem('customerData_rider');
    localStorage.removeItem('userPhone');
    setIsLoggedIn(false);
    setCustomer(null);
    setCurrentScreen('home');
    toast.success(t('common.logoutSuccess') || 'Logged out successfully');
  };

  const handleTopUp = () => {
    setShowTopUpModal(true);
  };

  const handleConfirmTopUp = async (amount: number, transactionId: string, paymentMethod: string) => {
    try {
      const token = localStorage.getItem('authToken_rider');
      if (!token) throw new Error('Not authenticated');
      
      // TODO: Call actual API endpoint for top-up
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setBalance(prev => prev + amount);
      
      const newActivity: ActivityItem = {
        id: Date.now().toString(),
        type: 'topup',
        title: t('rider.balanceTopUp') || 'Balance Top-up',
        subtitle: paymentMethod === 'mtn' ? t('rider.mtnMobileMoney') : paymentMethod === 'flooz' ? t('rider.flooz') : t('rider.bankTransfer'),
        amount: amount,
        currency: currency,
        isPositive: true,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: new Date().toISOString().split('T')[0],
      };
      setActivities(prev => [newActivity, ...prev]);
      toast.success(t('rider.topUpSuccess') || 'Top-up successful');
    } catch (error: any) {
      console.error('Top-up error:', error);
      toast.error(error.message || t('rider.topUpFailed') || 'Top-up failed');
      throw error;
    }
  };

  const handleNavigateToStation = (station: Station) => {
    if (station.lat && station.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`, '_blank');
    } else {
      toast.success(t('rider.navigationStarted') || 'Navigation started');
    }
  };

  const handleSelectStation = (stationId: number) => {
    setCurrentScreen('stations');
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="rider-container">
        <div className="rider-bg-gradient" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Found customer screen - show before login if credentials exist
  if (!isLoggedIn && showFoundCustomer && customer) {
    const initials = customer.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <>
        <Toaster position="top-center" />
        <div className="rider-container">
          <div className="rider-bg-gradient" />
          
          {/* Header */}
          <header className="flow-header">
            <div className="flow-header-inner">
              <div className="flow-header-left">
                <button className="flow-header-back" onClick={() => window.location.href = '/'} aria-label={t('common.back') || 'Back'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  <span style={{ marginLeft: '4px', fontSize: '14px' }}>{t('common.back') || 'Back'}</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="rider-main" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="rider-screen active" style={{ width: '100%', maxWidth: '100%' }}>
              {/* Large Profile Icon */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                border: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'white',
                textAlign: 'center',
                marginBottom: '8px'
              }}>
                {t('rider.loginTitle') || 'Rider Login'}
              </h2>

              {/* Welcome Message */}
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                marginBottom: '32px'
              }}>
                {t('rider.welcomeBack') || 'Welcome back!'}
              </p>

              {/* Account Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    marginBottom: '4px',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'white'
                  }}>
                    {customer.name}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: '400', 
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {t('role.rider') || 'Rider'}
                  </div>
                </div>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: 'white',
                  padding: '4px 10px',
                  background: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  flexShrink: 0
                }}>
                  {t('common.active') || 'Active'}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('authToken_rider');
                    if (token && customer) {
                      setIsLoggedIn(true);
                      await fetchDashboardData(token);
                      if (customer.partner_id) {
                        await fetchSubscriptionData(customer.partner_id, token);
                      }
                    }
                  }}
                  style={{ 
                    width: '100%',
                    padding: '14px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {t('common.continue') || 'Continue'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
                
                <button
                  onClick={() => {
                    localStorage.removeItem('authToken_rider');
                    localStorage.removeItem('customerData_rider');
                    localStorage.removeItem('userPhone');
                    setShowFoundCustomer(false);
                    setCustomer(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                >
                  {t('rider.switchAccount') || 'Switch Account'}
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-center" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Main app
  return (
    <>
      <Toaster position="top-center" />
      
      <div className="rider-container">
        <div className="rider-bg-gradient" />

        {/* Header */}
        <header className="flow-header">
          <div className="flow-header-inner">
            <div className="flow-header-left">
              <button className="flow-header-back" onClick={handleBackToRoles} aria-label={t('attendant.changeRole') || 'Change Role'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="flow-header-logo">
                <Image src="/assets/Logo-Oves.png" alt="Omnivoltaic" width={100} height={28} style={{ objectFit: 'contain' }} priority />
              </div>
            </div>
            <div className="flow-header-right">
              <button className="flow-header-lang" onClick={toggleLocale} aria-label={t('role.switchLanguage') || 'Switch Language'}>
                <Globe size={14} />
                <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="rider-main">
          {currentScreen === 'home' && (
            <RiderHome
              userName={customer?.name || t('common.guest')}
              balance={balance}
              currency={currency}
              bike={{
                ...bike,
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || bike.paymentState,
              }}
              nearbyStations={stations.map(s => ({
                id: s.id,
                name: s.name,
                distance: s.distance,
                batteries: s.batteries,
              }))}
              onFindStation={() => setCurrentScreen('stations')}
              onShowQRCode={() => setShowQRModal(true)}
              onTopUp={handleTopUp}
              onSelectStation={handleSelectStation}
              onViewAllStations={() => setCurrentScreen('stations')}
            />
          )}
          
          {currentScreen === 'activity' && (
            <RiderActivity activities={activities} />
          )}
          
          {currentScreen === 'stations' && (
            <RiderStations
              stations={stations}
              onNavigateToStation={handleNavigateToStation}
            />
          )}
          
          {currentScreen === 'profile' && (
            <RiderProfile
              profile={{
                name: customer?.name || t('common.guest'),
                initials: customer?.name ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'G',
                phone: customer?.phone || '',
                balance: balance,
                currency: currency,
                swapsThisMonth: activities.filter(a => a.type === 'swap').length,
                planName: subscription?.product_name || '',
                planValidity: subscription?.next_cycle_date 
                  ? new Date(subscription.next_cycle_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '',
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || 'PAID',
                vehicleInfo: 'E-Trike • REG-2024-KE',
                paymentMethod: t('rider.mtnMobileMoney'),
              }}
              onAccountDetails={() => toast.success(t('rider.accountDetailsSoon') || 'Account details coming soon')}
              onVehicle={() => toast.success(t('rider.vehicleDetailsSoon') || 'Vehicle details coming soon')}
              onPlanDetails={() => toast.success(t('rider.planDetailsSoon') || 'Plan details coming soon')}
              onPaymentMethods={() => toast.success(t('rider.paymentMethodsSoon') || 'Payment methods coming soon')}
              onSupport={() => router.push('/rider/serviceplan1?page=support')}
              onLogout={handleLogout}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <RiderNav
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
        />
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        customerId={customer?.id?.toString()}
        subscriptionCode={subscription?.subscription_code}
      />

      {/* Top-Up Modal */}
      <TopUpModal
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        currency={currency}
        onConfirmTopUp={handleConfirmTopUp}
      />
    </>
  );
};

export default RiderApp;

