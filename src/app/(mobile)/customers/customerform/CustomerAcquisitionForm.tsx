'use client';

import React, { useState } from 'react';
import { User, Building2, Mail, Phone, Briefcase, MapPin, CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { useI18n } from '@/i18n';

interface FormData {
  customerType: 'individual' | 'company';
  name?: string;
  companyName?: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

interface FormErrors {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  emailOrPhone?: string;
  street?: string;
  city?: string;
  zip?: string;
}

const CustomerAcquisitionForm = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<FormData>({
    customerType: 'individual',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[\s\d\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  };

  const validateZip = (zip: string): boolean => {
    return zip.trim().length >= 3;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const hasEmail = formData.email && formData.email.trim().length > 0;
    const hasPhone = formData.phone && formData.phone.trim().length > 0;

    // Require at least one of email or phone
    if (!hasEmail && !hasPhone) {
      newErrors.emailOrPhone = t('sales.emailOrPhoneRequired') || 'Enter either an email address or phone number';
    } else {
      // Validate email format if provided
      if (hasEmail && !validateEmail(formData.email)) {
        newErrors.email = t('Please enter a valid email address') || 'Please enter a valid email address';
      }

      // Validate phone format if provided
      if (hasPhone && !validatePhone(formData.phone)) {
        newErrors.phone = t('Please enter a valid phone number') || 'Please enter a valid phone number';
      }
    }

    if (!formData.street || formData.street.trim().length === 0) {
      newErrors.street = t('Street address is required') || 'Street is required';
    }

    if (!formData.city || formData.city.trim().length === 0) {
      newErrors.city = t('City is required') || 'City is required';
    }

    if (!formData.zip || formData.zip.trim().length === 0) {
      newErrors.zip = t('Zip code is required') || 'Zip code is required';
    } else if (!validateZip(formData.zip)) {
      newErrors.zip = t('Please enter a valid zip code') || 'Please enter a valid zip code';
    }

    if (formData.customerType === 'individual') {
      if (!formData.name || formData.name.trim().length === 0) {
        newErrors.name = t('Full name is required') || 'Name is required';
      }
    } else {
      if (!formData.companyName || formData.companyName.trim().length === 0) {
        newErrors.companyName = t('sales.companyNameRequired') || 'Company name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    // Clear the emailOrPhone error when either field is updated
    if ((field === 'email' || field === 'phone') && errors.emailOrPhone) {
      setErrors(prev => ({ ...prev, emailOrPhone: undefined }));
    }
  };

  const handleCustomerTypeChange = (type: 'individual' | 'company') => {
    setFormData(prev => ({
      customerType: type,
      email: prev.email,
      phone: prev.phone,
      street: prev.street,
      city: prev.city,
      zip: prev.zip,
      name: undefined,
      companyName: undefined,
    }));
    setErrors({});
    setSubmitStatus(null);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSubmitStatus('error');
      setSubmitMessage('Please fix the errors above');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const apiData = {
        name: formData.customerType === 'individual' ? formData.name : formData.companyName,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.phone,
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
        is_company: formData.customerType === 'company',
      };

      console.log('Submitting to API:', {
        url: 'https://evans-musamia-odoorestapi.odoo.com/api/contacts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'abs_connector_secret_key_2024',
        },
        body: JSON.stringify(apiData, null, 2),
      });

      const response = await fetch('https://evans-musamia-odoorestapi.odoo.com/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'abs_connector_secret_key_2024',
        },
        body: JSON.stringify(apiData),
        // mode: 'no-cors', // Add this
      });

      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status} ${response.statusText}`;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          console.log('Error Response Body:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const text = await response.text();
          console.log('Non-JSON Response Body:', text);
          errorMessage = text || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Success Response Body:', result);
      setSubmitStatus('success');
      setSubmitMessage('Form submitted successfully! We\'ll be in touch soon.');
      
      setTimeout(() => {
        setFormData({
          customerType: 'individual',
          email: '',
          phone: '',
          street: '',
          city: '',
          zip: '',
        });
        setSubmitStatus(null);
      }, 3000);
    } catch (error: any) {
      console.error('Form Submission Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      });
      setSubmitStatus('error');
      setSubmitMessage(error.message || 'An error occurred during submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissMessage = () => {
    setSubmitStatus(null);
    setSubmitMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Join Our Platform</h1>
            <p className="text-gray-400 text-sm">Get Started</p>
          </div>

          {submitStatus && (
            <div className={`mb-6 p-4 rounded-lg border flex items-start justify-between ${
              submitStatus === 'success' 
                ? 'bg-green-900 border-green-700 text-green-100' 
                : 'bg-red-900 border-red-700 text-red-100'
            }`}>
              <div className="flex items-start space-x-2">
                {submitStatus === 'success' ? (
                  <CheckCircle size={20} className="text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-sm">{submitMessage}</span>
              </div>
              <button
                onClick={dismissMessage}
                className="text-gray-400 hover:text-white ml-2"
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">I am a:</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer border-2 rounded-lg p-4 flex flex-col items-center space-y-2 transition-all ${
                  formData.customerType === 'individual'
                    ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="customerType"
                    value="individual"
                    checked={formData.customerType === 'individual'}
                    onChange={(e) => handleCustomerTypeChange(e.target.value as 'individual')}
                    className="sr-only"
                    aria-describedby="individual-desc"
                  />
                  <User size={24} />
                  <span className="text-sm font-medium">Individual</span>
                  <span id="individual-desc" className="text-xs text-center text-gray-400">
                    Personal account
                  </span>
                </label>

                <label className={`cursor-pointer border-2 rounded-lg p-4 flex flex-col items-center space-y-2 transition-all ${
                  formData.customerType === 'company'
                    ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="customerType"
                    value="company"
                    checked={formData.customerType === 'company'}
                    onChange={(e) => handleCustomerTypeChange(e.target.value as 'company')}
                    className="sr-only"
                    aria-describedby="company-desc"
                  />
                  <Building2 size={24} />
                  <span className="text-sm font-medium">Company</span>
                  <span id="company-desc" className="text-xs text-center text-gray-400">
                    Business account
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {formData.customerType === 'individual' && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      id="name"
                      value={formData.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.name ? 'border-red-500' : 'border-gray-600'
                      }`}
                      placeholder="Enter your full name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                  </div>
                  {errors.name && (
                    <p id="name-error" className="mt-1 text-sm text-red-400" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>
              )}

              {formData.customerType === 'company' && (
                <>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-1">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                          errors.companyName ? 'border-red-500' : 'border-gray-600'
                        }`}
                        placeholder="Enter company name"
                        aria-invalid={!!errors.companyName}
                        aria-describedby={errors.companyName ? 'company-error' : undefined}
                      />
                    </div>
                    {errors.companyName && (
                      <p id="company-error" className="mt-1 text-sm text-red-400" role="alert">
                        {errors.companyName}
                      </p>
                    )}
                  </div>

                </>
              )}

              {/* Contact Information Section with hint */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                  <Info size={16} className="text-blue-400 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    {t('sales.contactInfoHint') || 'Please provide at least one contact method: email or phone number (or both).'}
                  </p>
                </div>

                {errors.emailOrPhone && (
                  <p className="text-sm text-red-400 flex items-center gap-1" role="alert">
                    <AlertCircle size={14} />
                    {errors.emailOrPhone}
                  </p>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                    {t('sales.emailAddress') || 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.email || errors.emailOrPhone ? 'border-red-500' : 'border-gray-600'
                      }`}
                      placeholder={t('Enter your email') || 'Enter your email address'}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="mt-1 text-sm text-red-400" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-600"></div>
                  <span className="text-xs text-gray-500 uppercase">{t('common.or') || 'or'}</span>
                  <div className="flex-1 border-t border-gray-600"></div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                    {t('sales.phoneNumber') || 'Phone Number'}
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.phone || errors.emailOrPhone ? 'border-red-500' : 'border-gray-600'
                      }`}
                      placeholder={t('Enter your phone number') || 'Enter your phone number'}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'phone-error' : undefined}
                    />
                  </div>
                  {errors.phone && (
                    <p id="phone-error" className="mt-1 text-sm text-red-400" role="alert">
                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="street" className="block text-sm font-medium text-gray-300 mb-1">
                  Street Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    id="street"
                    value={formData.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      errors.street ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="Enter your street address"
                    aria-invalid={!!errors.street}
                    aria-describedby={errors.street ? 'street-error' : undefined}
                  />
                </div>
                {errors.street && (
                  <p id="street-error" className="mt-1 text-sm text-red-400" role="alert">
                    {errors.street}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-1">
                  City <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      errors.city ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="Enter your city"
                    aria-invalid={!!errors.city}
                    aria-describedby={errors.city ? 'city-error' : undefined}
                  />
                </div>
                {errors.city && (
                  <p id="city-error" className="mt-1 text-sm text-red-400" role="alert">
                    {errors.city}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-300 mb-1">
                  Zip Code <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => handleInputChange('zip', e.target.value)}
                    className={`w-full bg-gray-700 border rounded-lg px-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      errors.zip ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="Enter your zip code"
                    aria-invalid={!!errors.zip}
                    aria-describedby={errors.zip ? 'zip-error' : undefined}
                  />
                </div>
                {errors.zip && (
                  <p id="zip-error" className="mt-1 text-sm text-red-400" role="alert">
                    {errors.zip}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full mt-6 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                isSubmitting
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit Application'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              By submitting this form, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAcquisitionForm;
