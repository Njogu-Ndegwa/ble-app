// login works well
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from 'next/navigation';
import { toast } from "react-hot-toast";
import { useI18n } from '@/i18n';
import { useBridge } from "@/app/context/bridgeContext";
import { Globe } from 'lucide-react';
import Image from "next/image";
import { PhoneInputWithCountry } from '@/components/ui';

// Define interfaces
interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
}

interface LoginProps {
  onLoginSuccess: (customer: Customer) => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { bridge } = useBridge();
  // Phone number in E.164 format without the + prefix (e.g., "254712345678")
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(false);
  const [scannedBatteryCode, setScannedBatteryCode] = useState<string | null>(null);
  const [isScanningBattery, setIsScanningBattery] = useState<boolean>(false);
  const bridgeInitRef = useRef(false);
  
  // Registration form state - only fields accepted by Odoo /api/auth/register
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [assignBattery, setAssignBattery] = useState<boolean>(false);

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

  // Load scanned battery code from localStorage on mount and when registration form is shown
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedBatteryCode = localStorage.getItem("assignedBatteryCode");
    if (storedBatteryCode) {
      setScannedBatteryCode(storedBatteryCode);
    }
  }, [showRegister]);

  // Persist scanned battery code to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (scannedBatteryCode) {
        localStorage.setItem("assignedBatteryCode", scannedBatteryCode);
      }
    } catch (error) {
      console.error("Failed to persist battery code:", error);
    }
  }, [scannedBatteryCode]);

  // Setup bridge for QR code scanning
  useEffect(() => {
    if (!bridge || bridgeInitRef.current) return;

    const setupBridge = () => {
      bridgeInitRef.current = true;

      const reg = (name: string, handler: any) => {
        bridge.registerHandler(name, handler);
        return () => bridge.registerHandler(name, () => {});
      };

      const offQr = reg("scanQrcodeResultCallBack", (data: string, resp: any) => {
        try {
          const parsed = JSON.parse(data);
          const qrVal = parsed.respData?.value || "";
          
          if (qrVal) {
            setScannedBatteryCode(qrVal);
            localStorage.setItem('assignedBatteryCode', qrVal);
            setIsScanningBattery(false);
            toast.success(t('Battery code scanned successfully'));
          }
        } catch (err) {
          console.error("Error processing QR code data:", err);
          toast.error(t("Error processing QR code"));
          setIsScanningBattery(false);
        }
        resp(data);
      });

      return () => {
        offQr();
        bridgeInitRef.current = false;
      };
    };

    return setupBridge();
  }, [bridge, t]);

  // Start QR code scan
  const startBatteryQrScan = useCallback(() => {
    if (!bridge) {
      toast.error(t("Bridge not initialized"));
      return;
    }

    setIsScanningBattery(true);
    bridge.callHandler(
      "startQrCodeScan",
      999,
      (responseData: string) => {
        console.info("QR Code Scan Response:", responseData);
      }
    );
  }, [bridge, t]);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Allow digits, spaces, dashes, parentheses, and plus sign
    // Minimum 5 digits (for short numbers), maximum 20 characters (for international numbers)
    const phoneRegex = /^[\d\s\-\(\)\+]{5,20}$/;
    // Must contain at least 5 digits
    const digitCount = (phone.match(/\d/g) || []).length;
    return phoneRegex.test(phone) && digitCount >= 5;
  };

  // Validate form - only name, email, phone are required by Odoo /api/auth/register
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    // Phone number from PhoneInputWithCountry is already in E.164 format without + prefix
    // Validate: should have at least 7 digits (dial code + some local number)
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      toast.error(t("rider.enterPhone") || t("Please enter your phone number"));
      return;
    }
    if (!password.trim()) {
      toast.error(t("Please enter your password"));
      return;
    }

    setIsSigningIn(true);

    try {
      // Phone number is already the full number from PhoneInputWithCountry
      const fullPhoneNumber = phoneDigits;
      
      console.log("Attempting login with phone:", fullPhoneNumber);
      console.log("Login endpoint: https://crm-omnivoltaic.odoo.com/api/auth/login");
      const response = await fetch(
        "https://crm-omnivoltaic.odoo.com/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify({ phone: fullPhoneNumber, password }),
        }
      );

      const data = await response.json();
      
      console.info("=== Login Response ===");
      console.info("Response Status:", response.status);
      console.info("Response OK:", response.ok);
      console.info("Response Headers:", Object.fromEntries(response.headers.entries()));
      console.info("Full Response Data:", JSON.stringify(data, null, 2));
      console.info("Payload Sent:", JSON.stringify({ phone: phoneNumber, password: "***" }, null, 2));

      if (response.status === 200) {
        console.log("Login successful");
        // Save full phone number (with country code) to localStorage
        localStorage.setItem("userPhone", fullPhoneNumber);
        // Save token to localStorage if present in response
        const token = data.session?.token || data.token;
        if (token) {
          localStorage.setItem("authToken_rider", token);
          console.log("Token saved to localStorage:", token.substring(0, 20) + "...");
          console.log("Verifying token in localStorage:", localStorage.getItem("authToken_rider") ? "Found" : "Not found");
        } else {
          console.warn("No token found in response. Available keys:", Object.keys(data));
          if (data.session) {
            console.warn("Session object keys:", Object.keys(data.session));
          }
        }
        // Extract customer data from session.user or fallback to data.customer
        // Explicitly extract all fields including partner_id from session.user
        const sessionUser = data.session?.user;
        const fallbackCustomer = data.customer;
        
        let customerData: Customer;
        
        if (sessionUser) {
          // Use session.user data (has partner_id)
          customerData = {
            id: sessionUser.id || 0,
            name: sessionUser.name || "",
            email: sessionUser.email || "",
            phone: sessionUser.phone || fullPhoneNumber,
            // Explicitly get partner_id - don't use || operator as 0 is valid
            partner_id: sessionUser.partner_id !== undefined ? sessionUser.partner_id : undefined,
          };
          console.log("Login: sessionUser object:", sessionUser);
          console.log("Login: sessionUser.partner_id:", sessionUser.partner_id);
        } else if (fallbackCustomer) {
          // Fallback to data.customer
          customerData = {
            id: fallbackCustomer.id || 0,
            name: fallbackCustomer.name || "",
            email: fallbackCustomer.email || "",
            phone: fallbackCustomer.phone || fullPhoneNumber,
            partner_id: fallbackCustomer.partner_id !== undefined ? fallbackCustomer.partner_id : undefined,
          };
        } else {
          throw new Error("No customer data found in response");
        }
        
        console.log("Login: Customer data prepared:", customerData);
        console.log("Login: partner_id from session.user:", data.session?.user?.partner_id);
        console.log("Login: Final customerData.partner_id:", customerData.partner_id);
        
        // Persist customer data to localStorage for auto-login
        localStorage.setItem("customerData_rider", JSON.stringify(customerData));
        
        onLoginSuccess(customerData);
      } else if (response.status === 404) {
        console.error("=== Login Error Response (404) ===");
        console.error("Response Status:", response.status);
        console.error("Response Headers:", Object.fromEntries(response.headers.entries()));
        console.error("Error Data:", JSON.stringify(data, null, 2));
        console.error("Payload Sent:", JSON.stringify({ phone: fullPhoneNumber, password: "***" }, null, 2));
        toast.error(t("User not found. Would you like to create an account?"));
        // Pre-fill the registration phone with the full number
        setFormData(prev => ({ ...prev, phone: fullPhoneNumber }));
        setTimeout(() => setShowRegister(true), 1500);
      } else if (response.status === 400) {
        console.error("=== Login Error Response (400) ===");
        console.error("Response Status:", response.status);
        console.error("Response Headers:", Object.fromEntries(response.headers.entries()));
        console.error("Error Data:", JSON.stringify(data, null, 2));
        console.error("Payload Sent:", JSON.stringify({ phone: fullPhoneNumber, password: "***" }, null, 2));
        throw new Error(t("rider.invalidPhoneRequest") || t("Invalid request. Please ensure your phone number is correct."));
      } else {
        console.error("=== Login Error Response ===");
        console.error("Response Status:", response.status);
        console.error("Response Headers:", Object.fromEntries(response.headers.entries()));
        console.error("Error Data:", JSON.stringify(data, null, 2));
        console.error("Payload Sent:", JSON.stringify({ phone: fullPhoneNumber, password: "***" }, null, 2));
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
      // Always use company_id: "14" regardless of country selection
      const apiData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company_id: "14",
      };

      console.log('Submitting registration:', apiData);
      console.log('Registration endpoint: https://crm-omnivoltaic.odoo.com/api/auth/register');
      const response = await fetch('https://crm-omnivoltaic.odoo.com/api/auth/register', {
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
          console.error('=== Registration Error Response ===');
          console.error('Response Status:', response.status);
          console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
          console.error('Error Data:', JSON.stringify(errorData, null, 2));
          console.error('Payload Sent:', JSON.stringify(apiData, null, 2));
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          console.error('=== Registration Error Response ===');
          console.error('Response Status:', response.status);
          console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
          console.error('Payload Sent:', JSON.stringify(apiData, null, 2));
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      console.info('=== Registration Response ===');
      console.info('Response Status:', response.status);
      console.info('Response OK:', response.ok);
      console.info('Response Headers:', Object.fromEntries(response.headers.entries()));
      console.info('Full Response Data:', JSON.stringify(result, null, 2));
      console.info('Payload Sent:', JSON.stringify(apiData, null, 2));
      
      toast.success(t('Registration successful! You can now sign in.'));
      
      // Switch back to login form and pre-fill phone
      setShowRegister(false);
      setPhoneNumber(formData.phone);
      
      // Reset registration form
      setFormData({
        name: '',
        email: '',
        phone: '',
      });
      setAssignBattery(false);
      // Keep scannedBatteryCode in localStorage - don't clear it after registration
      // Reload from localStorage to maintain persistence
      const persistedBatteryCode = localStorage.getItem('assignedBatteryCode');
      setScannedBatteryCode(persistedBatteryCode);
      setSubmitStatus(null);
      setErrors({});
      
    } catch (error: any) {
      console.error('Registration error:', error);
      setSubmitStatus('error');
      setSubmitMessage(error.message || 'Registration failed. Please try again.');
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

  // Handle phone change from PhoneInputWithCountry (receives full number without + prefix)
  const handlePhoneChange = useCallback((value: string) => {
    setPhoneNumber(value);
  }, []);
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
            <h1 className="login-title">{t('auth.createAccount') || 'Create Account'}</h1>
            <p className="login-subtitle">{t('auth.joinCommunity') || 'Join our community today'}</p>
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
            <div className="form-section-title">{t('sales.personalInfo') || 'Personal Information'}</div>
            
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">{t('sales.fullName') || 'Full Name'} *</label>
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
                  placeholder={t('sales.enterFullName') || 'Enter your full name'}
                />
              </div>
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">{t('sales.emailAddress') || 'Email'} *</label>
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
                  placeholder={t('sales.enterEmail') || 'Enter your email'}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">{t('rider.phoneNumber') || 'Phone'} *</label>
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

            {/* Company (Read-only) */}
            <div className="form-group">
              <label className="form-label">{t('sales.company') || 'Company'}</label>
              <input
                type="text"
                value="OVS-TOGO"
                disabled
                readOnly
                className="form-input"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <p className="form-hint" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('sales.companyHint') || 'Currently fixed - will be selectable in the future'}
              </p>
            </div>

            {/* Assign Battery Checkbox */}
            <div className="form-group" style={{ paddingTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={assignBattery}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setAssignBattery(isChecked);
                    if (!isChecked) {
                      setScannedBatteryCode(null);
                      localStorage.removeItem('assignedBatteryCode');
                    }
                  }}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('sales.assignBattery') || 'Assign Battery'}</span>
              </label>
              
              {assignBattery && (
                <div style={{ marginLeft: 24, marginTop: 8 }}>
                  {scannedBatteryCode ? (
                    <div style={{ 
                      background: 'var(--success-soft)', 
                      border: '1px solid var(--success)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: 12 
                    }}>
                      <p style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4 }}>{t('sales.batteryScanned') || 'Battery Code Scanned'}:</p>
                      <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{scannedBatteryCode}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setScannedBatteryCode(null);
                          localStorage.removeItem('assignedBatteryCode');
                        }}
                        style={{ 
                          marginTop: 8, 
                          fontSize: 11, 
                          color: 'var(--error)', 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        {t('common.clear') || 'Clear'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startBatteryQrScan}
                      disabled={isScanningBattery}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '10px 16px', fontSize: 12 }}
                    >
                      {isScanningBattery ? (
                        <>
                          <div className="loading-spinner" style={{ width: 14, height: 14, marginBottom: 0, borderWidth: 2 }}></div>
                          <span>{t('common.scanning') || 'Scanning...'}</span>
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <rect x="3" y="3" width="7" height="7"/>
                            <rect x="14" y="3" width="7" height="7"/>
                            <rect x="14" y="14" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                          </svg>
                          <span>{t('sales.scanBatteryQr') || 'Scan Battery QR Code'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="btn btn-primary login-btn"
            onClick={handleRegister}
            disabled={isSubmitting || (assignBattery && !scannedBatteryCode)}
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
                <span>{t('auth.creatingAccount') || 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <path d="M20 8v6M23 11h-6"/>
                </svg>
                <span>{t('auth.createAccount') || 'Create Account'}</span>
              </>
            )}
          </button>

          <p className="login-help">
            {t('auth.alreadyHaveAccount') || 'Already have an account?'}{' '}
            <button 
              onClick={() => setShowRegister(false)} 
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('auth.signIn') || 'Sign In'}
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
              aria-label={t('common.back') || 'Back'}
              title={t('common.back') || 'Back'}
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
              aria-label={t('role.switchLanguage') || 'Switch language'}
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
          <h1 className="login-title">{t('rider.loginTitle') || 'Rider Login'}</h1>
          <p className="login-subtitle">{t('rider.enterPhoneAndPassword') || 'Please enter phone number and password'}</p>
        </div>

      {/* Login Form */}
      <div className="login-form">
        {/* Phone Number Input with Country Code */}
        <PhoneInputWithCountry
          label={t('rider.phoneNumber') || 'Phone Number'}
          value={phoneNumber}
          onChange={handlePhoneChange}
          locale={locale}
          placeholder={t('rider.enterPhone') || 'Enter your phone number'}
          disabled={isSigningIn}
        />

        {/* Password Input */}
        <div className="form-group">
          <label className="form-label">{t('auth.passwordPlaceholder') || 'Password'}</label>
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
              placeholder={t('auth.passwordPlaceholder') || 'Enter your password'}
              disabled={isSigningIn}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('common.hidePassword') || 'Hide password' : t('common.showPassword') || 'Show password'}
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
          disabled={isSigningIn || phoneNumber.replace(/\D/g, '').length < 7 || !password.trim()}
        >
          {isSigningIn ? (
            <>
              <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
              <span>{t('auth.signingIn') || 'Signing in...'}</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span>{t('auth.signIn') || 'Sign In'}</span>
            </>
          )}
        </button>


        <p className="login-help">
          {t('auth.needHelp') || 'Need help? Contact support'}
        </p>
      </div>
    </div>
    </div>
  );
};

export default Login;
