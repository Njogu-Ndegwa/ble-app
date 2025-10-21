'use client';

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, CheckCircle, AlertCircle, X, UserPlus } from 'lucide-react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
}

const RegisterForm = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
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

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters long';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.street || formData.street.trim().length === 0) {
      newErrors.street = 'Street address is required';
    }

    if (!formData.city || formData.city.trim().length === 0) {
      newErrors.city = 'City is required';
    }

    if (!formData.zip || formData.zip.trim().length === 0) {
      newErrors.zip = 'Zip code is required';
    } else if (!validateZip(formData.zip)) {
      newErrors.zip = 'Please enter a valid zip code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
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
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.phone,
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
        is_company: false,
      };

      console.log('Submitting to API:', {
        url: 'https://evans-musamia-odoorestapi.odoo.com/api',
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
      setSubmitMessage('Registration successful! Welcome to our platform.');
      
      setTimeout(() => {
        setFormData({
          name: '',
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
      setSubmitMessage(error.message || 'An error occurred during registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissMessage = () => {
    setSubmitStatus(null);
    setSubmitMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-800 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gray-700 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gray-800 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* Header with icon and title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 border border-gray-700 rounded-full mb-4 shadow-lg">
              <UserPlus size={28} className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Create Your Account
            </h1>
            <p className="text-gray-400 text-sm">Join our community today</p>
          </div>

          {/* Success/Error Messages */}
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-xl border backdrop-blur-sm flex items-start justify-between shadow-lg ${
              submitStatus === 'success' 
                ? 'bg-green-950/50 border-green-800/50 text-green-200' 
                : 'bg-red-950/50 border-red-800/50 text-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {submitStatus === 'success' ? (
                  <CheckCircle size={20} className="text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{submitMessage}</span>
              </div>
              <button
                onClick={dismissMessage}
                className="text-gray-400 hover:text-white ml-2 transition-colors"
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Main Form */}
          <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-2xl">
            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <User size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full bg-gray-800/50 border rounded-xl px-10 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                      errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Enter your full name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                  />
                </div>
                {errors.name && (
                  <p id="name-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                    <AlertCircle size={14} className="mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full bg-gray-800/50 border rounded-xl px-10 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Enter your email address"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                    <AlertCircle size={14} className="mr-1" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <Phone size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full bg-gray-800/50 border rounded-xl px-10 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                      errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Enter your phone number"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                </div>
                {errors.phone && (
                  <p id="phone-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                    <AlertCircle size={14} className="mr-1" />
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Address Section */}
              <div className="border-t border-gray-700 pt-5">
                <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center">
                  <MapPin size={16} className="mr-2 text-blue-400" />
                  Address Information
                </h3>
                
                <div className="space-y-4">
                  {/* Street */}
                  <div>
                    <label htmlFor="street" className="block text-sm font-medium text-gray-300 mb-2">
                      Street Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="street"
                      value={formData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        errors.street ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'
                      }`}
                      placeholder="Enter your street address"
                      aria-invalid={!!errors.street}
                      aria-describedby={errors.street ? 'street-error' : undefined}
                    />
                    {errors.street && (
                      <p id="street-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                        <AlertCircle size={14} className="mr-1" />
                        {errors.street}
                      </p>
                    )}
                  </div>

                  {/* City and Zip in a row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-200 mb-2">
                        City <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 ${
                          errors.city ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/20'
                        }`}
                        placeholder="City"
                        aria-invalid={!!errors.city}
                        aria-describedby={errors.city ? 'city-error' : undefined}
                      />
                      {errors.city && (
                        <p id="city-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                          <AlertCircle size={14} className="mr-1" />
                          {errors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="zip" className="block text-sm font-medium text-gray-200 mb-2">
                        Zip Code <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="zip"
                        value={formData.zip}
                        onChange={(e) => handleInputChange('zip', e.target.value)}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 ${
                          errors.zip ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/20'
                        }`}
                        placeholder="Zip"
                        aria-invalid={!!errors.zip}
                        aria-describedby={errors.zip ? 'zip-error' : undefined}
                      />
                      {errors.zip && (
                        <p id="zip-error" className="mt-2 text-sm text-red-400 flex items-center" role="alert">
                          <AlertCircle size={14} className="mr-1" />
                          {errors.zip}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full mt-6 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent transform hover:scale-[1.02] ${
                isSubmitting
                  ? 'bg-gray-600/50 text-gray-300 cursor-not-allowed scale-100'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <UserPlus size={16} />
                  <span>Create Account</span>
                </div>
              )}
            </button>

            <p className="text-xs text-gray-300 text-center mt-4 opacity-75">
              By creating an account, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;