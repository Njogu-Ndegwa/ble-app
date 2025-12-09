"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { Globe, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useBridge } from '@/app/context/bridgeContext';
import { useRiderData } from '@/lib/services/hooks/useRiderData';
import {
  RiderNav,
  RiderHome,
  RiderActivity,
  RiderStations,
  RiderProfile,
  QRCodeModal,
} from './components';
import type { ActivityItem, Station } from './components';

// API Configuration
const API_BASE = "https://crm-omnivoltaic.odoo.com/api";
const API_KEY = "abs_connector_secret_key_2024";

// Interfaces
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
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface ProfileData {
  name: string;
  initials: string;
  phone: string;
  balance: number;
  currency: string;
  swapsThisMonth: number;
  planName: string;
  planValidity: string;
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | string;
  vehicleInfo: string;
  paymentMethod: string;
  currentBatteryId?: string;
  electricityUsed?: number;
  electricityQuota?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
}

// Login Component
const LoginScreen: React.FC<{ onLoginSuccess: (customer: Customer) => void }> = ({ onLoginSuccess }) => {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  const handleBackToRoles = () => {
    router.push('/');
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error(t('Please enter email and password'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const token = data.session?.token || data.token;
        if (token) {
          localStorage.setItem('authToken_rider', token);
        }
        localStorage.setItem('userEmail', email);

        const sessionUser = data.session?.user;
        const customerData: Customer = {
          id: sessionUser?.id || data.customer?.id || 0,
          name: sessionUser?.name || data.customer?.name || '',
          email: sessionUser?.email || data.customer?.email || '',
          phone: sessionUser?.phone || data.customer?.phone || '',
          partner_id: sessionUser?.partner_id || data.customer?.partner_id,
        };

        localStorage.setItem('customerData_rider', JSON.stringify(customerData));
        onLoginSuccess(customerData);
      } else {
        toast.error(data.message || t('Login failed'));
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || t('Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rider-container">
      <div className="rider-bg-gradient" />
      
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button className="flow-header-back" onClick={handleBackToRoles} aria-label={t('Back')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image src="/assets/Logo-Oves.png" alt="Omnivoltaic" width={100} height={28} style={{ objectFit: 'contain' }} priority />
            </div>
          </div>
          <div className="flow-header-right">
            <button className="flow-header-lang" onClick={toggleLocale} aria-label={t('Switch Language')}>
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="rider-main" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: 'var(--accent-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{t('Rider Login')}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('Sign in to access your account')}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">{t('Email Address')}</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('Enter your email')}
                disabled={isLoading}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">{t('Password')}</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('Enter your password')}
                disabled={isLoading}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSignIn}
            disabled={isLoading || !email.trim() || !password.trim()}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
                <span>{t('Signing in...')}</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <span>{t('Sign In')}</span>
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            {t('Need help? Contact support')}
          </p>
        </div>
      </main>
    </div>
  );
};

// Main Rider App Component
const RiderApp: React.FC = () => {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { bridge } = useBridge();
  
  // Use the rider data hook for stations and activities
  const {
    stations: apiStations,
    stationsLoading,
    stationsError,
    activities: apiActivities,
    activitiesLoading,
    activitiesError,
    fetchStations,
    fetchActivities,
    refreshAll,
  } = useRiderData();
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  // UI state
  const [currentScreen, setCurrentScreen] = useState<'home' | 'map' | 'activity' | 'profile'>('home');
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Data state
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('XOF');
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>(undefined);
  const [servicePlanId, setServicePlanId] = useState<string>('');
  const [bike, setBike] = useState<BikeInfo>({
    model: 'E-Trike 3X',
    vehicleId: 'VEH-2024-0000',
    lastSwap: '-',
    totalSwaps: 0,
    paymentState: 'PAID',
    currentBatteryId: undefined,
  });
  const [paymentState, setPaymentState] = useState<string>('PAID');
  const [electricityUsed, setElectricityUsed] = useState<number>(0);
  const [electricityQuota, setElectricityQuota] = useState<number>(0);
  
  // Data fetched flag
  const dataFetchedRef = useRef(false);

  // Convert API stations to component format
  const stations: Station[] = apiStations.map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    distance: s.distance || 'N/A',
    batteries: s.availableBatteries,
    waitTime: s.waitTime,
    lat: s.lat,
    lng: s.lng,
  }));

  // Convert API activities to component format
  const activities: ActivityItem[] = apiActivities.map(a => ({
    id: a.id,
    type: a.type as ActivityItem['type'],
    title: a.title,
    subtitle: a.subtitle,
    amount: a.amount,
    currency: a.currency,
    isPositive: a.isPositive,
    time: a.time,
    date: a.date,
  }));

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken_rider');
      const storedCustomerData = localStorage.getItem('customerData_rider');
      
      if (token && storedCustomerData) {
        try {
          const customerData = JSON.parse(storedCustomerData);
          setCustomer(customerData);
          setIsLoggedIn(true);
          // Fetch dashboard data
          fetchDashboardData(token);
        } catch (e) {
          console.error('Error parsing stored customer data:', e);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Get user location
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Could not get user location:', error);
          // Default to Nairobi as fallback
          setUserLocation({ lat: -1.2921, lng: 36.8219 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Fetch rider data when logged in and we have required info
  useEffect(() => {
    if (isLoggedIn && customer && !dataFetchedRef.current) {
      dataFetchedRef.current = true;
      
      // Use a default plan ID for now - in production this would come from customer data
      const planId = servicePlanId || 'service-plan-basic-newest-d';
      const customerId = customer.partner_id?.toString() || customer.id?.toString() || 'CUST-RIDER-001';
      
      // Fetch stations with location
      fetchStations(planId, customerId, userLocation);
      
      // Fetch activities
      if (servicePlanId) {
        fetchActivities(servicePlanId, currency);
      }
    }
  }, [isLoggedIn, customer, servicePlanId, userLocation, currency, fetchStations, fetchActivities]);

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
        
        // Update balance if available
        if (data.summary) {
          setBalance(data.summary.total_paid || 0);
        }

        // Extract service plan ID if available
        if (data.active_subscriptions?.length > 0) {
          const subscription = data.active_subscriptions[0];
          if (subscription.subscription_code) {
            setServicePlanId(subscription.subscription_code);
          }
          if (subscription.currency_symbol) {
            setCurrency(subscription.currency_symbol);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Update rider data from MQTT service plan response
  const updateFromServicePlan = (servicePlanData: any) => {
    if (!servicePlanData) return;
    
    // Extract payment state
    if (servicePlanData.paymentState) {
      setPaymentState(servicePlanData.paymentState);
      setBike(prev => ({ ...prev, paymentState: servicePlanData.paymentState }));
    }
    
    // Extract current battery from service states
    const serviceStates = servicePlanData.serviceStates || [];
    const batteryService = serviceStates.find((s: any) => 
      s.service_id?.includes('battery-fleet')
    );
    if (batteryService?.current_asset) {
      setBike(prev => ({ ...prev, currentBatteryId: batteryService.current_asset }));
    }
    
    // Extract swap count
    const swapService = serviceStates.find((s: any) => 
      s.service_id?.includes('swap-count')
    );
    if (swapService) {
      setBike(prev => ({ ...prev, totalSwaps: swapService.used || 0 }));
    }
    
    // Extract electricity usage
    const electricityService = serviceStates.find((s: any) => 
      s.service_id?.includes('electricity')
    );
    if (electricityService) {
      setElectricityUsed(electricityService.used || 0);
      setElectricityQuota(electricityService.quota || 0);
    }
    
    // Extract currency
    if (servicePlanData.currency) {
      setCurrency(servicePlanData.currency);
    }
  };

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (!customer) return;
    
    const planId = servicePlanId || 'service-plan-basic-newest-d';
    const customerId = customer.partner_id?.toString() || customer.id?.toString() || 'CUST-RIDER-001';
    
    refreshAll(planId, customerId, servicePlanId || undefined, currency, userLocation);
    toast.success(t('Refreshing data...'));
  }, [customer, servicePlanId, currency, userLocation, refreshAll, t]);

  // Lock body overflow
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

  const handleBackToRoles = () => {
    router.push('/');
  };

  const handleLoginSuccess = (customerData: Customer) => {
    setCustomer(customerData);
    setIsLoggedIn(true);
    dataFetchedRef.current = false; // Reset to allow fetching data
    const token = localStorage.getItem('authToken_rider');
    if (token) {
      fetchDashboardData(token);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken_rider');
    localStorage.removeItem('customerData_rider');
    localStorage.removeItem('userEmail');
    setIsLoggedIn(false);
    setCustomer(null);
    setCurrentScreen('home');
    dataFetchedRef.current = false;
  };

  const handleTopUp = () => {
    toast.success(t('Top-up feature coming soon'));
  };

  const handleSelectStation = (stationId: number | string) => {
    setCurrentScreen('map');
    // Find and select the station
    const station = stations.find(s => s.id === stationId);
    if (station) {
      toast.success(`${t('Selected')}: ${station.name}`);
    }
  };

  const handleNavigateToStation = (station: Station) => {
    // Open external maps app for navigation
    if (station.lat && station.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`, '_blank');
    } else {
      toast.success(t('Navigation started'));
    }
  };

  // Profile data
  const profileData: ProfileData = {
    name: customer?.name || 'Guest',
    initials: customer?.name ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'G',
    phone: customer?.phone || '',
    balance: balance,
    currency: currency,
    swapsThisMonth: activities.filter(a => a.type === 'swap').length,
    planName: '7-Day Lux Plan',
    planValidity: 'Dec 9, 2025',
    paymentState: paymentState,
    vehicleInfo: `${bike.model} • ${bike.currentBatteryId || bike.vehicleId}`,
    paymentMethod: 'MTN Mobile Money',
    currentBatteryId: bike.currentBatteryId,
    electricityUsed: electricityUsed,
    electricityQuota: electricityQuota,
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="rider-container">
        <div className="rider-bg-gradient" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('Loading...')}</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-center" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
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
              <button className="flow-header-back" onClick={handleBackToRoles} aria-label={t('Change Role')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="flow-header-logo">
                <Image src="/assets/Logo-Oves.png" alt="Omnivoltaic" width={100} height={28} style={{ objectFit: 'contain' }} priority />
              </div>
            </div>
            <div className="flow-header-right">
              <button 
                className="flow-header-lang" 
                onClick={handleRefresh} 
                aria-label={t('Refresh')}
                style={{ marginRight: 8 }}
              >
                <RefreshCw size={14} />
              </button>
              <button className="flow-header-lang" onClick={toggleLocale} aria-label={t('Switch Language')}>
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
              userName={customer?.name || 'Guest'}
              balance={balance}
              currency={currency}
              bike={bike}
              nearbyStations={stations.slice(0, 5).map(s => ({
                id: typeof s.id === 'string' ? parseInt(s.id) || 0 : s.id,
                name: s.name,
                distance: s.distance,
                batteries: s.batteries,
                lat: s.lat,
                lng: s.lng,
              }))}
              onFindStation={() => setCurrentScreen('map')}
              onShowQRCode={() => setShowQRModal(true)}
              onTopUp={handleTopUp}
              onSelectStation={handleSelectStation}
              onViewAllStations={() => setCurrentScreen('map')}
            />
          )}
          
          {currentScreen === 'activity' && (
            <RiderActivity 
              activities={activities}
              isLoading={activitiesLoading}
              error={activitiesError}
              onRefresh={handleRefresh}
            />
          )}
          
          {currentScreen === 'map' && (
            <RiderStations
              stations={stations}
              onNavigateToStation={handleNavigateToStation}
              userLocation={userLocation}
              isLoading={stationsLoading}
              error={stationsError}
            />
          )}
          
          {currentScreen === 'profile' && (
            <RiderProfile
              profile={profileData}
              onAccountDetails={() => toast.success(t('Account details coming soon'))}
              onVehicle={() => toast.success(t('Vehicle details coming soon'))}
              onPlanDetails={() => toast.success(t('Plan details coming soon'))}
              onPaymentMethods={() => toast.success(t('Payment methods coming soon'))}
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
      />
    </>
  );
};

export default RiderApp;
