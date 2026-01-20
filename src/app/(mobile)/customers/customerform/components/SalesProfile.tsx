"use client";

import React from 'react';
import { useI18n } from '@/i18n';

interface SalesProfileProps {
  employee: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
}

const SalesProfile: React.FC<SalesProfileProps> = ({ employee, onLogout }) => {
  const { t } = useI18n();

  const initials = employee?.name
    ? employee.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'SR';

  // Format phone number with + prefix and spaced digit groups
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return "";
    let cleaned = phone.replace(/\s+/g, "");
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      const countryCode = match[1];
      const remaining = match[2];
      const groups: string[] = [];
      let i = 0;
      if (remaining.length > 0) {
        groups.push(remaining.slice(0, 2));
        i = 2;
      }
      while (i < remaining.length) {
        groups.push(remaining.slice(i, i + 3));
        i += 3;
      }
      return `${countryCode} ${groups.join(" ")}`;
    }
    return cleaned;
  };

  return (
    <div className="rider-screen active">
      {/* Profile Header - Avatar centered, name and email below */}
      <div className="profile-header-centered">
        <div className="profile-avatar-large">{initials}</div>
        <div className="profile-name">{employee?.name || t('common.guest') || 'Guest'}</div>
        <div className="profile-phone">
          {employee?.phone ? formatPhoneNumber(employee.phone) : employee?.email || ''}
        </div>
      </div>

      {/* Employee Info Card - styled like Energy Service card */}
      <div className="energy-service-card">
        {/* Header with icon and title */}
        <div className="energy-service-header">
          <div className="energy-service-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div className="energy-service-title">
            <span className="energy-service-name">
              {t('role.salesRep') || 'Sales Representative'}
            </span>
            <span className="energy-service-status paid">
              <span className="status-dot"></span>
              {t('common.active') || 'Active'}
            </span>
          </div>
        </div>

        {/* Stats - Stacked vertically with icons */}
        <div className="energy-service-stats-vertical">
          {/* Employee ID - highlighted */}
          <div className="energy-stat-row highlighted">
            <div className="energy-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <circle cx="9" cy="10" r="2"/>
                <path d="M15 8h2M15 12h2"/>
                <path d="M7 16h10"/>
              </svg>
            </div>
            <div className="energy-stat-content">
              <div className="energy-stat-value">ID #{employee?.id || 'N/A'}</div>
              <div className="energy-stat-label">{t('sales.profile.employeeId') || 'Employee ID'}</div>
            </div>
          </div>

          {/* Email */}
          {employee?.email && (
            <div className="energy-stat-row">
              <div className="energy-stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div className="energy-stat-content">
                <div className="energy-stat-value" style={{ fontSize: '14px', wordBreak: 'break-all' }}>{employee.email}</div>
                <div className="energy-stat-label">{'Email Address'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu List */}
      <div className="menu-list">
        {/* Help & Support */}
        <div className="menu-item">
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <path d="M12 17h.01"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t('rider.helpSupport') || 'Help & Support'}
            </div>
            <div className="menu-item-subtitle">
              {t('rider.supportDesc') || 'FAQs, contact support'}
            </div>
          </div>
          <div className="menu-item-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>

        {/* Log Out */}
        <div className="menu-item logout" onClick={onLogout}>
          <div className="menu-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t('common.logout') || 'Log Out'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesProfile;
