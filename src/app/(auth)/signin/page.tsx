'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, EyeOff, Eye, ArrowLeft } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth-context';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, loading, error } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    const credentials = {
        email:email,
        password:password
    }
    signIn(credentials);

  
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToCustomerView = () => {
    // Change the user role back to Customer in localStorage/AsyncStorage
    try {
      localStorage.setItem('userRole', 'Customer');
      // For React Native compatibility
      if (typeof AsyncStorage !== 'undefined') {
        AsyncStorage.setItem('userRole', 'Customer');
      }
      // Navigate back to the main page
      router.push('/');
    } catch (error) {
      console.error('Error changing user role:', error);
      toast.error('Failed to switch to Customer view');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen flex flex-col relative">
      {/* Back Button - Absolute positioned relative to the page */}
      <button 
        onClick={handleBackToCustomerView}
        className="absolute top-4 left-4 text-gray-400 hover:text-white focus:outline-none flex items-center gap-1 transition-colors z-10"
        aria-label="Back to Customer View"
      >
        <ArrowLeft className="h-5 w-5" />
        {/* <span className="text-sm">Customer View</span> */}
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
        
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold mb-2">BLE Device Manager</h1>
          <p className="text-gray-400 text-sm">Sign in to access your devices</p>
        </div>
        
        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="email"
              className="w-full px-4 py-3 pl-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-4 py-3 pl-10 pr-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Password"
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
          
          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                Remember me
              </label> */}
            </div>
            <div className="text-sm">
              <a href="/resetpwd" className="text-blue-500 hover:text-blue-400">
                Forgot password?
              </a>
            </div>
          </div>
          
          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
              isLoading 
                ? 'bg-blue-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
         {error && <p style={{ color: "red" }}>{error.message}</p>}
        {/* Create Account Link */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <a href="#" className="text-blue-500 hover:text-blue-400">
              Contact support
            </a>
          </p>
        </div>
        
        {/* Version Info */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Version 1.2.5</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;