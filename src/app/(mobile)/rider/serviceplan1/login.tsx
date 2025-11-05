// login works well
"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { LogIn, User, Loader2, UserPlus, Mail, Phone, MapPin, AlertCircle, CheckCircle, Globe, Eye, EyeOff } from "lucide-react";
import { useI18n } from '@/i18n';

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
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(false);
  
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
    { value: 'Kenya', label: 'Kenya' },
    { value: 'Philippines', label: 'Philippines' },
    { value: 'Togo', label: 'Togo' },
    { value: 'Shenzhen', label: 'Shenzhen' }
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
      console.log("Attempting login with email:", email);
      const response = await fetch(
        `${API_BASE}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();
      console.log("API Response:", { status: response.status, data });
      console.log("Full response data:", JSON.stringify(data, null, 2));

      if (response.status === 200) {
        console.log("Login successful");
        localStorage.setItem("userEmail", email);
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
            phone: sessionUser.phone || "",
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
            phone: fallbackCustomer.phone || "",
            partner_id: fallbackCustomer.partner_id !== undefined ? fallbackCustomer.partner_id : undefined,
          };
        } else {
          throw new Error("No customer data found in response");
        }
        
        console.log("Login: Customer data prepared:", customerData);
        console.log("Login: partner_id from session.user:", data.session?.user?.partner_id);
        console.log("Login: Final customerData.partner_id:", customerData.partner_id);
        
        // toast.success(`Welcome! Signed in as ${customerData.name}`);
        onLoginSuccess(customerData);
      } else if (response.status === 404) {
        toast.error(t("User not found. Would you like to create an account?"));
        // Optionally pre-fill the registration email
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
      
      // Switch back to login form and pre-fill email
      setShowRegister(false);
      setEmail(formData.email);
      
      // Reset registration form
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

  if (showRegister) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="bg-blue-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('Create Account')}</h1>
            <p className="text-gray-400">{t('Join our community today')}</p>
          </div>

          {/* Success/Error Messages */}
          {submitStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-center ${
              submitStatus === 'success' 
                ? 'bg-green-900/50 border border-green-700 text-green-200' 
                : 'bg-red-900/50 border border-red-700 text-red-200'
            }`}>
              {submitStatus === 'success' ? (
                <CheckCircle size={16} className="mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle size={16} className="mr-2 flex-shrink-0" />
              )}
              <span className="text-sm">{submitMessage}</span>
            </div>
          )}

          {/* Registration Form */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('Full Name')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-10 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder={t('Enter your full name')}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Country Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('Country')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-3 text-gray-500 z-10" />
                <select
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none ${
                    errors.country ? 'border-red-500' : 'border-gray-600'
                  }`}
                >
                  <option value="" className="text-gray-400">{t('Please select a country')}</option>
                  {countryOptions.map((country) => (
                    <option key={country.value} value={country.value} className="bg-gray-700 text-white">
                      {country.label}
                    </option>
                  ))}
                </select>
                {/* Custom dropdown arrow */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {errors.country && (
                <p className="mt-1 text-sm text-red-400">{errors.country}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('Email')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-10 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder={t('Enter your email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('Phone')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-10 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder={t('Enter your phone number')}
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-400">{errors.phone}</p>
              )}
            </div>

            {/* Street */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('Street Address')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.street ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder={t('Enter street address')}
              />
              {errors.street && (
                <p className="mt-1 text-sm text-red-400">{errors.street}</p>
              )}
            </div>

            {/* City and Zip */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('City')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.city ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder={t('City')}
                />
                {errors.city && (
                  <p className="mt-1 text-sm text-red-400">{errors.city}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('Zip')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.zip ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder={t('Zip')}
                />
                {errors.zip && (
                  <p className="mt-1 text-sm text-red-400">{errors.zip}</p>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleRegister}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('Creating Account...')}
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  {t('Create Account')}
                </>
              )}
            </button>

            <button
              onClick={() => setShowRegister(false)}
              disabled={isSubmitting}
              className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {t('Back to Sign In')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login Form
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md">
        {isSigningIn ? (
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-white mt-4">Signing in...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="bg-blue-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{t('Welcome')}</h1>
              <p className="text-gray-400">{t('Please enter your email and password to continue')}</p>
            </div>
            
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                {t('Email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                onKeyPress={handleKeyPress}
                placeholder={t('Enter your email')}
                disabled={isSigningIn}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                {t('Password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyPress={handleKeyPress}
                  placeholder={t('Enter your password')}
                  disabled={isSigningIn}
                  className="w-full pr-12 pl-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('Hide password') : t('Show password')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-200"
                  disabled={isSigningIn}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                disabled={isSigningIn || !email.trim() || !password.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('Signing in...')}
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    {t('Sign In')}
                  </>
                )}
              </button>

              <button
                onClick={() => setShowRegister(true)}
                disabled={isSigningIn}
                className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                <UserPlus className="w-5 h-5 inline mr-2" />
                {t('Create New Account')}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">{t('Need help? Contact support')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;