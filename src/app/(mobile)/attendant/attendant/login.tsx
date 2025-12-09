"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { toast } from "react-hot-toast";
import { useI18n } from '@/i18n';
import { Globe } from 'lucide-react';
import Image from "next/image";
import { 
  employeeLogin, 
  saveEmployeeLogin, 
  getStoredEmployeeEmail,
  type EmployeeUser 
} from '@/lib/attendant-auth';

// Define interfaces
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  accessToken?: string;
}

interface LoginProps {
  onLoginSuccess: (customer: Customer) => void;
  /** User type for authentication - 'attendant' or 'sales'. Defaults to 'attendant' */
  userType?: 'attendant' | 'sales';
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

// Keep API_BASE for registration (still uses Odoo)
const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const Login: React.FC<LoginProps> = ({ onLoginSuccess, userType = 'attendant' }) => {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(false);
  
  // Pre-fill email from stored value
  useEffect(() => {
    const storedEmail = getStoredEmployeeEmail();
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  // Lock body overflow for fixed container
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  // Toggle locale function
  const toggleLocale = useCallback(() => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  }, [locale, setLocale]);

  // Navigate back to roles page
  const handleBackToRoles = useCallback(() => {
    router.push('/');
  }, [router]);
  
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
    if (!password.trim()) {
      toast.error(t("Please enter your password"));
      return;
    }

    setIsSigningIn(true);

    try {
      console.log(`Attempting ${userType} login with email:`, email);
      console.log("Using Employee Login API endpoint");
      
      // Use the new Employee Login API for Attendant/Sales authentication
      const result = await employeeLogin(email.trim(), password, userType);

      if (result.success && result.user) {
        const user = result.user;
        console.log("Login successful:", user.name);
        
        // Store the access token for future API calls
        if (user.accessToken) {
          localStorage.setItem('attendant_access_token', user.accessToken);
        }
        
        // Build customer data from the employee response
        const customerData: Customer = {
          id: String(user.id) || "",
          name: user.name || "",
          email: user.email || email,
          phone: user.phone || "",
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          accessToken: user.accessToken,
        };
        
        if (!customerData.id && !customerData.name) {
          throw new Error(t("No user data found in response"));
        }
        
        // saveEmployeeLogin is already called inside employeeLogin()
        onLoginSuccess(customerData);
      } else {
        throw new Error(result.error || t("Login failed. Please try again."));
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      
      const errorMessage = error.message || t("Sign-in failed. Please try again.");
      
      if (errorMessage.toLowerCase().includes("not found") || errorMessage.toLowerCase().includes("user")) {
        toast.error(t("User not found. Would you like to create an account?"));
        setFormData(prev => ({ ...prev, email }));
        setTimeout(() => setShowRegister(true), 1500);
      } else if (errorMessage.toLowerCase().includes("password") || errorMessage.toLowerCase().includes("credentials") || errorMessage.toLowerCase().includes("invalid")) {
        toast.error(t("Invalid email or password. Please try again."));
      } else {
        toast.error(errorMessage);
      }
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
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
    <div className="login-page-container">
      <div className="login-bg-gradient" />
      
      {/* Header with Back + Logo on left, Language Toggle on right */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={() => setShowRegister(false)}
              aria-label={t('Back')}
              title={t('Back')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right">
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage')}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="login-container">

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
    </div>
    );
  }

  // Login Form
  return (
    <div className="login-page-container">
      <div className="login-bg-gradient" />
      
      {/* Header with Back + Logo on left, Language Toggle on right */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToRoles}
              aria-label={t('Back')}
              title={t('Back')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right">
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage')}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

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

        {/* Password Input */}
        <div className="form-group">
          <label className="form-label">{t('Password')}</label>
          <div className="input-with-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={password}
              onChange={handlePasswordChange}
              onKeyPress={handleKeyPress}
              placeholder={t('Enter your password')}
              disabled={isSigningIn}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('Hide password') : t('Show password')}
              disabled={isSigningIn}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Sign In Button */}
        <button
          className="btn btn-primary login-btn"
          onClick={handleSignIn}
          disabled={isSigningIn || !email.trim() || !password.trim()}
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
    </div>
  );
};

export default Login;
