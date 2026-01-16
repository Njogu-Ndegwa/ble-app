"use client";

import React from 'react';
import { useI18n } from '@/i18n';
import { User, Mail, Phone, LogOut, Shield, ChevronRight } from 'lucide-react';

interface AttendantProfileProps {
  employee: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
}

const AttendantProfile: React.FC<AttendantProfileProps> = ({ employee, onLogout }) => {
  const { t } = useI18n();

  const initials = employee?.name
    ? employee.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'AT';

  return (
    <div className="attendant-profile">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {initials}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{employee?.name || t('common.guest') || 'Guest'}</h2>
          <span className="profile-role">
            <Shield size={12} />
            {t('role.attendant') || 'Attendant'}
          </span>
        </div>
      </div>

      {/* Profile Details */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          {t('attendant.profile.accountInfo') || 'Account Information'}
        </h3>
        
        <div className="profile-details-card">
          {employee?.email && (
            <div className="profile-detail-row">
              <div className="detail-icon">
                <Mail size={16} />
              </div>
              <div className="detail-content">
                <span className="detail-label">{t('common.email') || 'Email'}</span>
                <span className="detail-value">{employee.email}</span>
              </div>
            </div>
          )}
          
          {employee?.phone && (
            <div className="profile-detail-row">
              <div className="detail-icon">
                <Phone size={16} />
              </div>
              <div className="detail-content">
                <span className="detail-label">{t('common.phone') || 'Phone'}</span>
                <span className="detail-value">{employee.phone}</span>
              </div>
            </div>
          )}
          
          <div className="profile-detail-row">
            <div className="detail-icon">
              <User size={16} />
            </div>
            <div className="detail-content">
              <span className="detail-label">{t('attendant.profile.employeeId') || 'Employee ID'}</span>
              <span className="detail-value">#{employee?.id || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          {t('attendant.profile.actions') || 'Actions'}
        </h3>
        
        <div className="profile-actions">
          <button 
            className="profile-action-btn logout"
            onClick={onLogout}
          >
            <div className="action-left">
              <LogOut size={18} />
              <span>{t('common.logout') || 'Log Out'}</span>
            </div>
            <ChevronRight size={16} className="action-chevron" />
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="profile-footer">
        <span className="app-version">OVES Attendant v1.0</span>
      </div>
    </div>
  );
};

export default AttendantProfile;

