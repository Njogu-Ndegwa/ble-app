"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import AttendantFlow from "./AttendantFlow";
import Login from "./login";
import { 
  isAttendantRoleLoggedIn, 
  getAttendantRoleUser,
  clearAttendantRoleLogin,
  type EmployeeUser 
} from "@/lib/attendant-auth";

export default function AttendantPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
  const [customer, setCustomer] = useState<EmployeeUser | null>(null);

  // Check login status on mount - specifically for attendant role
  useEffect(() => {
    const loggedIn = isAttendantRoleLoggedIn();
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      setCustomer(getAttendantRoleUser());
    }
  }, []);

  const handleLoginSuccess = useCallback((customerData: any) => {
    setCustomer({
      id: customerData.id,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      userType: 'attendant',
    });
    setIsLoggedIn(true);
  }, []);

  // Handle logout - reset login state to show login screen
  const handleLogout = useCallback(() => {
    setCustomer(null);
    setIsLoggedIn(false);
  }, []);

  // Show nothing while checking auth status
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
        <AttendantFlow onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} userType="attendant" />
      )}
    </>
  );
}
