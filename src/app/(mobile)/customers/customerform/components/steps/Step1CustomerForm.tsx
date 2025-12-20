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

        <FormInput
          label={t('sales.emailAddress')}
          type="email"
          value={formData.email}
          onChange={(e) => onFormChange('email', e.target.value)}
          placeholder="customer@example.com"
          error={errors.email}
        />
        
        <PhoneInputWithCountry
          label={t('sales.phoneNumber')}
          value={formData.phone}
          onChange={handlePhoneChange}
          locale={locale}
          error={errors.phone}
        />
        
        {!(errors.email || errors.phone) && (
          <p className="text-xs text-gray-400 mt-1 px-1">
            {t('sales.emailOrPhoneRequired') || 'Enter either an email address or phone number'}
          </p>
        )}
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
