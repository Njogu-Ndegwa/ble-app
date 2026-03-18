'use client';

import React, { useState, useCallback } from 'react';
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

function getInitialAuth(): { loggedIn: boolean; user: EmployeeUser | null } {
  if (typeof window === 'undefined') return { loggedIn: false, user: null };
  try {
    const loggedIn = isSalesRoleLoggedIn();
    if (loggedIn) return { loggedIn: true, user: getSalesRoleUser() };
    clearSalesSession();
    return { loggedIn: false, user: null };
  } catch {
    clearSalesRoleLogin();
    clearSalesSession();
    return { loggedIn: false, user: null };
  }
}

export default function CustomerFormPage() {
  const [{ loggedIn: isLoggedIn, user }, setAuth] = useState(getInitialAuth);

  const handleLoginSuccess = useCallback((customerData: any) => {
    setAuth({
      loggedIn: true,
      user: {
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        userType: 'sales',
      },
    });
  }, []);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSalesSession();
    setAuth({ loggedIn: false, user: null });
  }, []);

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
