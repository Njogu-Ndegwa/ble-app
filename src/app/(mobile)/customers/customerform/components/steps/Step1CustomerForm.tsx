'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { CustomerFormData } from '../types';
import { 
  Screen, 
  PageHeader, 
  FormInput, 
  FormSection, 
  FormRow 
} from '@/components/ui';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
}

// Helper function to detect if input is email or phone
const detectInputType = (value: string): 'email' | 'phone' | 'unknown' => {
  const trimmed = value.trim();
  if (!trimmed) return 'unknown';
  
  const firstChar = trimmed[0];
  
  // If starts with + or a digit, treat as phone immediately
  if (firstChar === '+' || /\d/.test(firstChar)) {
    return 'phone';
  }
  
  // If starts with @ or a letter, treat as email
  if (firstChar === '@' || /[a-zA-Z]/.test(firstChar)) {
    return 'email';
  }
  
  // Check if it looks like an email (contains @ and .)
  if (trimmed.includes('@') && trimmed.includes('.')) {
    return 'email';
  }
  
  // Check if it looks like a phone (contains digits, +, spaces, dashes, parentheses)
  if (/^[\+]?[\s\d\-\(\)]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length > 0) {
    return 'phone';
  }
  
  return 'unknown';
};

export default function Step1CustomerForm({ formData, onFormChange, errors = {} }: Step1Props) {
  const { t } = useI18n();
  
  // Combined value for email/phone field
  const emailOrPhoneValue = formData.email || formData.phone;
  const [inputType, setInputType] = useState<'email' | 'phone' | 'unknown'>('unknown');
  
  // Detect input type when value changes
  useEffect(() => {
    if (emailOrPhoneValue) {
      setInputType(detectInputType(emailOrPhoneValue));
    } else {
      setInputType('unknown');
    }
  }, [emailOrPhoneValue]);
  
  const handleEmailOrPhoneChange = (value: string) => {
    // Detect type immediately based on first character
    const detectedType = detectInputType(value);
    setInputType(detectedType);
    
    // Clear the other field and set the detected one
    if (detectedType === 'email') {
      onFormChange('email', value);
      onFormChange('phone', '');
    } else if (detectedType === 'phone') {
      onFormChange('phone', value);
      onFormChange('email', '');
    } else {
      // Unknown type - try to determine based on current input
      // If it has @, treat as email; otherwise treat as phone if it has digits
      if (value.includes('@')) {
        onFormChange('email', value);
        onFormChange('phone', '');
      } else if (value.replace(/\D/g, '').length > 0) {
        // If has any digits, treat as phone
        onFormChange('phone', value);
        onFormChange('email', '');
        setInputType('phone');
      } else {
        // Clear both if unclear
        onFormChange('email', '');
        onFormChange('phone', '');
      }
    }
  };
  
  // Determine placeholder and label based on detected type
  const getPlaceholder = () => {
    if (inputType === 'email') {
      return 'customer@example.com';
    } else if (inputType === 'phone') {
      return '+254 7XX XXX XXX';
    }
    return t('sales.emailOrPhonePlaceholder') || 'Email or Phone Number';
  };
  
  const getLabel = () => {
    return t('sales.emailOrPhone') || 'Email or Phone Number';
  };
  
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
          label={getLabel()}
          type={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
          value={emailOrPhoneValue}
          onChange={(e) => handleEmailOrPhoneChange(e.target.value)}
          placeholder={getPlaceholder()}
          error={errors.email || errors.phone}
        />
        {errors.email || errors.phone ? (
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
