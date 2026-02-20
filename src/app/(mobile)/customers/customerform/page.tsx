'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import SalesApp from './SalesApp';
import Login from '../../attendant/attendant/login';
import { 
  isSalesRoleLoggedIn, 
  getSalesRoleUser,
  clearSalesRoleLogin,
  type EmployeeUser 
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';

export default function CustomerFormPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
  const [user, setUser] = useState<EmployeeUser | null>(null);

  // Check login status on mount - specifically for sales role
  // Note: Attendant and Sales are now separate roles with separate sessions
  // Also clears sales session if token has expired
  useEffect(() => {
    const loggedIn = isSalesRoleLoggedIn();
    
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      setUser(getSalesRoleUser());
    } else {
      // Token has expired or user is not logged in
      // Clear any stored sales session to start fresh when they log in again
      clearSalesSession();
    }
  }, []);

  const handleLoginSuccess = useCallback((customerData: any) => {
    setUser({
      id: customerData.id,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      userType: 'sales',
    });
    setIsLoggedIn(true);
  }, []);

  // Handle logout - reset login state and clear sales role session
  // Note: Attendant and Sales are now separate roles with separate sessions
  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  // Show loading state while checking auth
  if (isLoggedIn === null) {
    return (
      <div className="splash-screen">
        <div className="splash-loading">
          <div className="splash-loading-dots">
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            fontSize: "13px",
            fontFamily: "'Outfit', sans-serif",
          },
          success: {
            iconTheme: {
              primary: "var(--color-success)",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--color-error)",
              secondary: "white",
            },
          },
        }}
      />
      {isLoggedIn ? (
        <SalesApp onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} userType="sales" />
      )}
    </>
  );
}
