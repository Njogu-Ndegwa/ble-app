'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import SalesFlow from './SalesFlow';
import Login from '../../attendant/attendant/login';
import { isAttendantLoggedIn, getAttendantUser, type AttendantUser } from '@/lib/attendant-auth';

export default function CustomerFormPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
  const [user, setUser] = useState<AttendantUser | null>(null);

  // Check login status on mount
  useEffect(() => {
    const loggedIn = isAttendantLoggedIn();
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      setUser(getAttendantUser());
    }
  }, []);

  const handleLoginSuccess = useCallback((customerData: any) => {
    setUser({
      id: customerData.id,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
    });
    setIsLoggedIn(true);
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
        <SalesFlow />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
