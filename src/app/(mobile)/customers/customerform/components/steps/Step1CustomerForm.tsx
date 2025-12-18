'use client';

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { CustomerFormData } from '../types';
import { detectCountryCodeFromLocale } from '@/lib/phone-utils';
import { 
  Screen, 
  PageHeader, 
  FormInput, 
  FormSection, 
  FormRow,
  PhoneInputWithCountryCode,
} from '@/components/ui';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
}

export default function Step1CustomerForm({ formData, onFormChange, errors = {} }: Step1Props) {
  const { t, locale } = useI18n();
  
  // Get default country code based on current locale
  // en → KE (Kenya), fr → TG (Togo), zh → CN (China)
  const defaultCountry = useMemo(() => detectCountryCodeFromLocale(locale), [locale]);
  
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
        
        <PhoneInputWithCountryCode
          label={t('sales.phoneNumber')}
          value={formData.phone}
          onChange={(value) => onFormChange('phone', value)}
          defaultCountry={defaultCountry}
          error={errors.phone}
        />
        {(errors.email || errors.phone) ? (
          <div className="text-sm text-red-400 mt-1 px-1">
            {errors.email || errors.phone}
          </div>
        ) : (
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
