"use client";

import React, { useState, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import AttendantApp from "./AttendantApp";
import Login from "./login";
import { 
  isAttendantRoleLoggedIn, 
  getAttendantRoleUser,
  type EmployeeUser 
} from "@/lib/attendant-auth";

function getInitialAuth(): { loggedIn: boolean; user: EmployeeUser | null } {
  if (typeof window === 'undefined') return { loggedIn: false, user: null };
  try {
    const loggedIn = isAttendantRoleLoggedIn();
    if (loggedIn) return { loggedIn: true, user: getAttendantRoleUser() };
    return { loggedIn: false, user: null };
  } catch {
    return { loggedIn: false, user: null };
  }
}

export default function AttendantPage() {
  const [{ loggedIn: isLoggedIn, user: customer }, setAuth] = useState(getInitialAuth);

  const handleLoginSuccess = useCallback((customerData: any) => {
    setAuth({
      loggedIn: true,
      user: {
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        userType: 'attendant',
      },
    });
  }, []);

  const handleLogout = useCallback(() => {
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
        <AttendantApp onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} userType="attendant" />
      )}
    </>
  );
}
