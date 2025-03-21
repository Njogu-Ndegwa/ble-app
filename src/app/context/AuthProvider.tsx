'use client'

import React, { createContext, useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid, getUserFromToken } from '../components/authUtils';

interface AuthUser {
  id?: string;
  email?: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, userData?: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('auth_token');
      
      if (token && isTokenValid(token)) {
        const userData = getUserFromToken(token);
        setUser(userData as AuthUser);
        setIsAuthenticated(true);
      } else {
        // Clean up invalid token
        if (token) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Set up token expiration checker
  useEffect(() => {
    const checkTokenExpiry = () => {
      const token = localStorage.getItem('auth_token');
      if (token && !isTokenValid(token)) {
        handleLogout();
      }
    };

    // Check token validity every minute
    const intervalId = setInterval(checkTokenExpiry, 60000);
    
    return () => clearInterval(intervalId);
  }, [router]);

  const handleLogin = (token: string, userData?: any) => {
    localStorage.setItem('auth_token', token);
    
    if (userData) {
      localStorage.setItem('user_data', JSON.stringify(userData));
    }
    
    const decodedUser = getUserFromToken(token);
    setUser(decodedUser as AuthUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    setUser(null);
    setIsAuthenticated(false);
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};