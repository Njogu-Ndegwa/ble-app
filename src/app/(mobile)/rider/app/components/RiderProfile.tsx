"use client";

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';

interface ProfileData {
  name: string;
  initials: string;
  phone: string;
  balance: number;
  currency?: string;
  swapsThisMonth: number;
  planName: string;
  planValidity: string;
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | string;
  vehicleInfo: string;
  paymentMethod: string;
  currentBatteryId?: string;
}

interface RiderProfileProps {
  profile: ProfileData;
  bikeImageUrl?: string;
  onAccountDetails: () => void;
  onVehicle: () => void;
  onPlanDetails: () => void;
  onPaymentMethods: () => void;
  onSupport: () => void;
  onLogout: () => void;
}

const RiderProfile: React.FC<RiderProfileProps> = ({
  profile,
  bikeImageUrl,
  onAccountDetails,
  onVehicle,
  onPlanDetails,
  onPaymentMethods,
  onSupport,
  onLogout,
}) => {
  const { t } = useI18n();

  const getPaymentStateClass = (paymentState: string): string => {
    switch (paymentState) {
      case 'PAID':
      case 'active': return 'paid';
      case 'RENEWAL_DUE': return 'renewal-due';
      case 'OVERDUE':
      case 'inactive': return 'overdue';
      case 'PENDING': return 'pending';
      default: return 'paid';
    }
  };

  const getPaymentStateLabel = (paymentState: string): string => {
    switch (paymentState) {
      case 'PAID':
      case 'active': return t('common.active') || 'Active';
      case 'RENEWAL_DUE': return t('attendant.renewalDue') || 'Renewal Due';
      case 'OVERDUE':
      case 'inactive': return t('attendant.overdue') || 'Overdue';
      case 'PENDING': return t('common.pending') || 'Pending';
      default: return paymentState === 'active' ? (t('common.active') || 'Active') : paymentState;
    }
  };

  return (
    <div className="rider-screen active">
      <div className="profile-header">
        <div className="profile-avatar">{profile.initials}</div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-phone">{profile.phone}</div>
      </div>

      <div className="energy-service-card">
        <div className="energy-service-header">
          <div className="energy-service-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="energy-service-title">
            <span className="energy-service-name">{t('rider.energyService') || 'Energy Service'}</span>
            <span className={`energy-service-status ${getPaymentStateClass(profile.paymentState)}`}>
              <span className="status-dot"></span>
              {getPaymentStateLabel(profile.paymentState)}
            </span>
          </div>
        </div>
        
        <div className="energy-service-visual">
          <Image 
            src={bikeImageUrl || "/assets/Rider.png"} 
            alt="E-Vehicle" 
            className="energy-service-bike"
            width={120}
            height={70}
            style={{ objectFit: 'contain' }}
          />
          <div className="energy-service-glow"></div>
        </div>
        
        <div className="energy-service-stats">
          {/* <div className="energy-stat-card primary">
            <div className="energy-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v12M8 10h8M8 14h8"/>
              </svg>
            </div>
            <div className="energy-stat-info">
              <span className="energy-stat-value">{profile.currency || 'XOF'} {profile.balance.toLocaleString()}</span>
              <span className="energy-stat-label">{t('rider.accountBalance') || 'Account Balance'}</span>
            </div>
          </div> */}
          <div className="energy-stat-card">
            <div className="energy-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 6l-9.5 9.5-5-5L1 18"/>
                <path d="M17 6h6v6"/>
              </svg>
            </div>
            <div className="energy-stat-info">
              <span className="energy-stat-value">{profile.swapsThisMonth}</span>
              <span className="energy-stat-label">{t('rider.swapsThisMonth') || 'Swaps This Month'}</span>
            </div>
          </div>
        </div>
        
        <div className="energy-service-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="energy-plan-name">{profile.planName}</span>
            <span className="energy-plan-validity">{t('rider.validUntil') || 'Valid until'} {profile.planValidity}</span>
          </div>
        </div>
      </div>

      <div className="menu-list">
        <div className="menu-item" onClick={onAccountDetails}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('rider.accountDetails') || 'Account Details'}</div>
            <div className="menu-item-subtitle">{t('rider.personalInfoDesc') || 'Personal information & settings'}</div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>

        <div className="menu-item" onClick={onVehicle}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
              <path d="M5 17H3v-6l2-4h9l4 4h3v6h-2"/>
              <path d="M9 17h6"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('rider.myVehicle') || 'My Vehicle'}</div>
            <div className="menu-item-subtitle">{profile.vehicleInfo}</div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>

        {/* <div className="menu-item" onClick={onPlanDetails}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M16 13H8M16 17H8M10 9H8"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('rider.subscriptionPlan') || 'Subscription Plan'}</div>
            <div className="menu-item-subtitle">{t('rider.managePlanDesc') || 'Manage your plan & billing'}</div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div> */}

        {/* <div className="menu-item" onClick={onPaymentMethods}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <path d="M1 10h22"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('rider.paymentMethods') || 'Payment Methods'}</div>
            <div className="menu-item-subtitle">{profile.paymentMethod}</div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div> */}

        {/* <div className="menu-item" onClick={onSupport}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <path d="M12 17h.01"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('rider.helpSupport') || 'Help & Support'}</div>
            <div className="menu-item-subtitle">{t('rider.supportDesc') || 'FAQs, contact support'}</div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div> */}
      </div>

      <div className="menu-list">
        <div className="menu-item logout" onClick={onLogout}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">{t('common.logout') || 'Log Out'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderProfile;

