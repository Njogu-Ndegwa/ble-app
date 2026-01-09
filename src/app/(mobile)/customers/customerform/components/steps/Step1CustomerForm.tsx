'use client';

import React, { useCallback } from 'react';
import { useI18n } from '@/i18n';
import { CustomerFormData } from '../types';
import { 
  Screen, 
  PageHeader, 
  FormInput, 
  FormSection, 
  FormRow,
  PhoneInputWithCountry,
} from '@/components/ui';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
}

export default function Step1CustomerForm({ formData, onFormChange, errors = {} }: Step1Props) {
  const { t, locale } = useI18n();
  
  // Handle phone number change from the country code selector
  // The component returns the phone number in E.164 format without the + prefix
  const handlePhoneChange = useCallback((value: string) => {
    onFormChange('phone', value);
  }, [onFormChange]);
  
  return (
    <Screen>
      <PageHeader 
        title={t('sales.newCustomer')} 
        subtitle={t('sales.enterCustomerDetails')}
        align="center"
      />

      <FormSection title={t('sales.personalInfo')}>
        <FormRow columns={2}>
          <FormInput
            label={t('sales.firstName')}
            required
            value={formData.firstName}
            onChange={(e) => onFormChange('firstName', e.target.value)}
            placeholder="John"
            error={errors.firstName}
          />
          <FormInput
            label={t('sales.lastName')}
            required
            value={formData.lastName}
            onChange={(e) => onFormChange('lastName', e.target.value)}
            placeholder="Doe"
            error={errors.lastName}
          />
        </FormRow>

        {/* Contact info hint - always visible */}
        <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 flex-shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
          <p className="text-xs text-blue-300">
            {t('sales.contactInfoHint') || 'Please provide at least one contact method: email or phone number (or both).'}
          </p>
        </div>

        <FormInput
          label={t('sales.emailAddress')}
          type="email"
          value={formData.email}
          onChange={(e) => onFormChange('email', e.target.value)}
          placeholder="customer@example.com"
          error={errors.email}
        />
        
        {/* "or" divider between email and phone */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 border-t border-gray-700"></div>
          <span className="text-xs text-gray-500 uppercase">{t('common.or') || 'or'}</span>
          <div className="flex-1 border-t border-gray-700"></div>
        </div>
        
        <PhoneInputWithCountry
          label={t('sales.phoneNumber')}
          value={formData.phone}
          onChange={handlePhoneChange}
          locale={locale}
          error={errors.phone}
        />
      </FormSection>

      <FormSection title={t('sales.addressInfo')}>
        <FormInput
          label={t('sales.street')}
          required
          value={formData.street}
          onChange={(e) => onFormChange('street', e.target.value)}
          placeholder="123 Main Street"
          error={errors.street}
        />

        <FormRow columns={2}>
          <FormInput
            label={t('sales.city')}
            required
            value={formData.city}
            onChange={(e) => onFormChange('city', e.target.value)}
            placeholder="Nairobi"
            error={errors.city}
          />
          <FormInput
            label={t('sales.zip')}
            required
            value={formData.zip}
            onChange={(e) => onFormChange('zip', e.target.value)}
            placeholder="00100"
            error={errors.zip}
          />
        </FormRow>
      </FormSection>
    </Screen>
  );
}
