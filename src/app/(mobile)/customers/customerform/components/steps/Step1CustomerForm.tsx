'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { CustomerFormData } from '../types';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
}

export default function Step1CustomerForm({ formData, onFormChange, errors = {} }: Step1Props) {
  const { t } = useI18n();
  
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>{t('sales.newCustomer')}</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>{t('sales.enterCustomerDetails')}</p>

      <div className="form-section">
        <div className="form-section-title">{t('sales.personalInfo')}</div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('sales.firstName')} <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.firstName ? 'form-input-error' : ''}`}
              value={formData.firstName}
              onChange={(e) => onFormChange('firstName', e.target.value)}
              placeholder="John"
            />
            {errors.firstName && <span className="form-error">{errors.firstName}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('sales.lastName')} <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.lastName ? 'form-input-error' : ''}`}
              value={formData.lastName}
              onChange={(e) => onFormChange('lastName', e.target.value)}
              placeholder="Doe"
            />
            {errors.lastName && <span className="form-error">{errors.lastName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('sales.emailAddress')} <span className="form-required">*</span></label>
          <input 
            type="email" 
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            value={formData.email}
            onChange={(e) => onFormChange('email', e.target.value)}
            placeholder="customer@example.com"
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">{t('sales.phoneNumber')} <span className="form-required">*</span></label>
          <input 
            type="tel" 
            className={`form-input ${errors.phone ? 'form-input-error' : ''}`}
            value={formData.phone}
            onChange={(e) => onFormChange('phone', e.target.value)}
            placeholder="+254 7XX XXX XXX"
          />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>

      </div>
    </div>
  );
}
