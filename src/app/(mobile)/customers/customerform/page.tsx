'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import SalesFlow from './SalesFlow';
import Login from '../../attendant/attendant/login';
import { 
  isEmployeeLoggedIn, 
  getEmployeeUser, 
  getEmployeeUserType,
  type EmployeeUser 
} from '@/lib/attendant-auth';
import { clearSalesSession } from '@/lib/sales-session';

export default function CustomerFormPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
  const [user, setUser] = useState<EmployeeUser | null>(null);

  // Check login status on mount - verify user is logged in as sales
  // Also clears sales session if token has expired
  useEffect(() => {
    const loggedIn = isEmployeeLoggedIn();
    const userType = getEmployeeUserType();
    
    // Allow access if employee is logged in (any type can use sales flow)
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      setUser(getEmployeeUser());
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

  // Handle logout - reset login state and clear sales session
  const handleLogout = useCallback(() => {
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
              primary: "#00d9a0",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "#ff5a5a",
              secondary: "white",
            },
          },
        }}
      />
      {isLoggedIn ? (
        <SalesFlow onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} userType="sales" />
      )}
    </>
  );
}
