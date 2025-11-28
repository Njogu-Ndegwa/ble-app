"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useI18n } from '@/i18n';
import { saveAttendantLogin, getStoredEmail } from '@/lib/attendant-auth';

// Define interfaces
interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface LoginProps {
  onLoginSuccess: (customer: Customer) => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { t } = useI18n();
  const [email, setEmail] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(false);
  
  // Pre-fill email from stored value
  useEffect(() => {
    const storedEmail = getStoredEmail();
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);
  
  // Registration form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
    country: '',
  });

  // Country options
  const countryOptions = [
    { value: 'Kenya', label: t('Kenya') },
    { value: 'Philippines', label: t('Philippines') },
    { value: 'Togo', label: t('Togo') },
    { value: 'Shenzhen', label: t('Shenzhen') }
  ];

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');

  // Validation functions
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
      newErrors.name = t('Full name is required');
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t('Name must be at least 2 characters long');
    }

    if (!formData.email) {
      newErrors.email = t('Email is required');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t('Please enter a valid email address');
    }

    if (!formData.phone) {
      newErrors.phone = t('Phone number is required');
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = t('Please enter a valid phone number');
    }

    if (!formData.street || formData.street.trim().length === 0) {
      newErrors.street = t('Street address is required');
    }

    if (!formData.city || formData.city.trim().length === 0) {
      newErrors.city = t('City is required');
    }

    if (!formData.zip || formData.zip.trim().length === 0) {
      newErrors.zip = t('Zip code is required');
    } else if (!validateZip(formData.zip)) {
      newErrors.zip = t('Please enter a valid zip code');
    }

    if (!formData.country) {
      newErrors.country = t('Please select a country');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      toast.error(t("Please enter your email"));
      return;
    }

    setIsSigningIn(true);

    try {
      console.log("Attempting login with email:", email);
      const response = await fetch(
        `${API_BASE}/customers/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      console.log("API Response:", { status: response.status, data });

      if (response.status === 200) {
        console.log("Login successful");
        saveAttendantLogin({
          id: data.customer.id,
          name: data.customer.name,
          email: data.customer.email || email,
          phone: data.customer.phone,
        });
        onLoginSuccess(data.customer);
      } else if (response.status === 404) {
        toast.error(t("User not found. Would you like to create an account?"));
        setFormData(prev => ({ ...prev, email }));
        setTimeout(() => setShowRegister(true), 1500);
      } else if (response.status === 400) {
        throw new Error(t("Invalid request. Please ensure your email is correct."));
      } else {
        throw new Error(data.message || t("Login failed. Please try again."));
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      toast.error(error.message || t("Sign-in failed. Please try again."));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      setSubmitStatus('error');
      setSubmitMessage(t('Please fix the errors above'));
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
        country: formData.country,
        is_company: false,
      };

      console.log('Submitting registration:', apiData);
      const response = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'abs_connector_secret_key_2024',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status} ${response.statusText}`;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Registration successful:', result);
      
      toast.success(t('Registration successful! You can now sign in.'));
      
      setShowRegister(false);
      setEmail(formData.email);
      
      setFormData({
        name: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        zip: '',
        country: '',
      });
      setSubmitStatus(null);
      setErrors({});
      
    } catch (error: any) {
      console.error('Registration error:', error);
      setSubmitStatus('error');
      setSubmitMessage(error.message || t('Registration failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (showRegister) {
        handleRegister();
      } else {
        handleSignIn();
      }
    }
  };

  // Registration Form
  if (showRegister) {
    return (
      <div className="login-container">
        {/* Back Button */}
        <button className="back-link" onClick={() => setShowRegister(false)} style={{ position: 'absolute', top: 16, left: 16 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {t('Back')}
        </button>

        {/* Header */}
        <div className="login-header">
          <div className="login-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <path d="M20 8v6M23 11h-6"/>
            </svg>
          </div>
          <h1 className="login-title">{t('Create Account')}</h1>
          <p className="login-subtitle">{t('Join our community today')}</p>
        </div>

        {/* Status Alert */}
        {submitStatus && (
          <div className={`status-alert ${submitStatus}`} style={{ maxWidth: 320, width: '100%' }}>
            {submitStatus === 'success' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            )}
            <span>{submitMessage}</span>
          </div>
        )}

        {/* Registration Form */}
        <div className="login-form">
          <div className="form-section">
            <div className="form-section-title">{t('Personal Information')}</div>
            
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">{t('Full Name')} *</label>
              <div className="input-with-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder={t('Enter your full name')}
                />
              </div>
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Country */}
            <div className="form-group">
              <label className="form-label">{t('Country')} *</label>
              <div className="input-with-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <select
                  className={`form-input ${errors.country ? 'error' : ''}`}
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  style={{ paddingLeft: 42, appearance: 'none' }}
                >
                  <option value="">{t('Select a country')}</option>
                  {countryOptions.map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.country && <p className="form-error">{errors.country}</p>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">{t('Email')} *</label>
              <div className="input-with-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder={t('Enter your email')}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">{t('Phone')} *</label>
              <div className="input-with-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input
                  type="tel"
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('Address')}</div>
            
            {/* Street */}
            <div className="form-group">
              <label className="form-label">{t('Street Address')} *</label>
              <input
                type="text"
                className={`form-input ${errors.street ? 'error' : ''}`}
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                placeholder={t('Enter street address')}
              />
              {errors.street && <p className="form-error">{errors.street}</p>}
            </div>

            {/* City & Zip */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('City')} *</label>
                <input
                  type="text"
                  className={`form-input ${errors.city ? 'error' : ''}`}
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder={t('City')}
                />
                {errors.city && <p className="form-error">{errors.city}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('Zip Code')} *</label>
                <input
                  type="text"
                  className={`form-input ${errors.zip ? 'error' : ''}`}
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  placeholder={t('Zip')}
                />
                {errors.zip && <p className="form-error">{errors.zip}</p>}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="btn btn-primary login-btn"
            onClick={handleRegister}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
                <span>{t('Creating Account...')}</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <path d="M20 8v6M23 11h-6"/>
                </svg>
                <span>{t('Create Account')}</span>
              </>
            )}
          </button>

          <p className="login-help">
            {t('Already have an account?')}{' '}
            <button 
              onClick={() => setShowRegister(false)} 
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('Sign In')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Login Form
  return (
    <div className="login-container">
      {/* Header */}
      <div className="login-header">
        <div className="login-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h1 className="login-title">{t('Staff Login')}</h1>
        <p className="login-subtitle">{t('Sign in to access your workspace')}</p>
      </div>

      {/* Login Form */}
      <div className="login-form">
        {/* Email Input */}
        <div className="form-group">
          <label className="form-label">{t('Email Address')}</label>
          <div className="input-with-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              placeholder={t('Enter your email')}
              disabled={isSigningIn}
            />
          </div>
        </div>

        {/* Sign In Button */}
        <button
          className="btn btn-primary login-btn"
          onClick={handleSignIn}
          disabled={isSigningIn || !email.trim()}
        >
          {isSigningIn ? (
            <>
              <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
              <span>{t('Signing in...')}</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span>{t('Sign In')}</span>
            </>
          )}
        </button>

        {/* Create Account Button */}
        <button
          className="btn btn-secondary"
          onClick={() => setShowRegister(true)}
          disabled={isSigningIn}
          style={{ width: '100%', marginTop: 10 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <path d="M20 8v6M23 11h-6"/>
          </svg>
          <span>{t('Create New Account')}</span>
        </button>

        <p className="login-help">
          {t('Need help? Contact your supervisor')}
        </p>
      </div>
    </div>
  );
};

export default Login;
