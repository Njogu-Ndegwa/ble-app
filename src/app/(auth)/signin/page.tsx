'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, EyeOff, Eye, ArrowLeft } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth-context';
import { useI18n } from '@/i18n';

const LoginPage = () => {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, loading, error } = useAuth();

  // Watch for error changes and display toast
  useEffect(() => {
    if (!error) return;

    // Extract back-end message (if any) and map to localized text
    const raw = (
      (error?.graphQLErrors?.[0]?.extensions as any)?.originalError?.error ||
      error?.graphQLErrors?.[0]?.message ||
      error?.message ||
      ''
    ) as string;

    const lc = raw.toLowerCase();
    let message: string | undefined;

    if (lc.includes('bad request')) message = t('auth.error.badRequest');
    else if (lc.includes('unauthorized')) message = t('auth.error.unauthorized');
    else if (lc.includes('invalid credentials') || lc.includes('invalid email') || lc.includes('invalid password')) message = t('auth.error.invalidCredentials');
    else if (lc.includes('user not found') || lc.includes('not found')) message = t('auth.error.userNotFound');

    if (!message) message = t('auth.error.badRequest');

    toast.error(message);
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t('auth.error.missingCredentials'));
      return;
    }
    const credentials = {
      email: email,
      password: password,
    };
    setIsLoading(true); // Sync local loading state with button
    await signIn(credentials);
    setIsLoading(false);
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToCustomerView = () => {
    try {
      localStorage.setItem('userRole', 'Customer');
      if (typeof AsyncStorage !== 'undefined') {
        AsyncStorage.setItem('userRole', 'Customer');
      }
      router.push('/');
    } catch (error) {
      console.error('Error changing user role:', error);
      toast.error(t('auth.error.switchCustomer'));
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen flex flex-col relative">
      <button 
        onClick={handleBackToCustomerView}
        className="absolute top-4 left-4 text-gray-400 hover:text-white focus:outline-none flex items-center gap-1 transition-colors z-10"
        aria-label={t('auth.backToCustomer')}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: 'white',
            },
          },
        }}
      />
      
      <div className="p-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold mb-2">{t('auth.title')}</h1>
          <p className="text-gray-400 text-sm">{t('auth.subtitle')}</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="email"
              className="w-full px-4 py-3 pl-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-4 py-3 pl-10 pr-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-500" />
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center"></div>
            {/* <div className="text-sm">
              <a href="/resetpwd" className="text-blue-500 hover:text-blue-400">
                Forgot password?
              </a>
            </div> */}
          </div>
          
          <button
            type="submit"
            disabled={isLoading || loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
              (isLoading || loading)
                ? 'bg-blue-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {(isLoading || loading) ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('auth.signingIn')}
              </>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            {t('auth.noAccount')} {' '}
            <a href="#" className="text-blue-500 hover:text-blue-400">
              {t('auth.contactSupport')}
            </a>
          </p>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>{t('common.version', { version: '1.2.5' })}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;