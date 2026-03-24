"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import AttendantApp from "./AttendantApp";
import Login from "./login";
import SelectServiceAccount from "@/components/ui/SelectServiceAccount";
import {
  isAttendantRoleLoggedIn,
  getAttendantRoleUser,
  getAttendantRoleToken,
  clearAttendantRoleLogin,
  type EmployeeUser,
} from "@/lib/attendant-auth";
import {
  fetchMyServiceAccounts,
  saveSelectedSA,
  getSelectedSAId,
  hasSASelected,
  clearSelectedSA,
} from "@/lib/sa-auth";
import type { ServiceAccount } from "@/lib/sa-types";

type Screen = "login" | "selectSA" | "app";

function getInitialScreen(): {
  screen: Screen;
  user: EmployeeUser | null;
} {
  if (typeof window === "undefined") return { screen: "login", user: null };
  try {
    if (!isAttendantRoleLoggedIn()) return { screen: "login", user: null };
    const user = getAttendantRoleUser();
    if (!user) return { screen: "login", user: null };
    if (hasSASelected("attendant")) return { screen: "app", user };
    return { screen: "selectSA", user };
  } catch {
    return { screen: "login", user: null };
  }
}

export default function AttendantPage() {
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen().screen);
  const [user, setUser] = useState<EmployeeUser | null>(
    () => getInitialScreen().user,
  );

  const [saAccounts, setSaAccounts] = useState<ServiceAccount[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [saErrorKind, setSaErrorKind] = useState<
    "noAccounts" | "loadFailed" | null
  >(null);

  const loadServiceAccounts = useCallback(
    async (token: string) => {
      setSaLoading(true);
      setSaErrorKind(null);
      try {
        const res = await fetchMyServiceAccounts(token);
        const accounts = res.service_accounts ?? [];
        setSaAccounts(accounts);

        if (accounts.length === 0) {
          setSaErrorKind("noAccounts");
          setScreen("selectSA");
          return;
        }

        if (accounts.length === 1 && res.auto_selected) {
          saveSelectedSA("attendant", accounts[0]);
          setScreen("app");
          return;
        }

        setScreen("selectSA");
      } catch (err) {
        console.error("[AttendantPage] Failed to load SAs:", err);
        setSaErrorKind("loadFailed");
        setScreen("selectSA");
      } finally {
        setSaLoading(false);
      }
    },
    [],
  );

  // When mounting into selectSA (already logged in, no SA chosen yet), fetch SAs
  useEffect(() => {
    if (screen === "selectSA" && saAccounts.length === 0 && !saLoading) {
      const token = getAttendantRoleToken();
      if (token) {
        loadServiceAccounts(token);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = useCallback(
    (customerData: any) => {
      const employeeUser: EmployeeUser = {
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        userType: "attendant",
      };
      setUser(employeeUser);

      const token = getAttendantRoleToken();
      if (token) {
        loadServiceAccounts(token);
      } else {
        setScreen("app");
      }
    },
    [loadServiceAccounts],
  );

  const handleSASelect = useCallback((sa: ServiceAccount) => {
    saveSelectedSA("attendant", sa);
    setScreen("app");
  }, []);

  const handleSARetry = useCallback(() => {
    const token = getAttendantRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

  const handleSignOut = useCallback(() => {
    clearAttendantRoleLogin();
    clearSelectedSA("attendant");
    setUser(null);
    setSaAccounts([]);
    setSaErrorKind(null);
    setScreen("login");
  }, []);

  const handleLogout = useCallback(() => {
    clearAttendantRoleLogin();
    clearSelectedSA("attendant");
    setUser(null);
    setSaAccounts([]);
    setScreen("login");
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
      {screen === "login" && (
        <Login onLoginSuccess={handleLoginSuccess} userType="attendant" />
      )}
      {screen === "selectSA" && (
        <SelectServiceAccount
          accounts={saAccounts}
          loading={saLoading}
          errorKind={saErrorKind}
          userName={user?.name ?? ""}
          userType="attendant"
          lastSAId={getSelectedSAId("attendant")}
          onSelect={handleSASelect}
          onSignOut={handleSignOut}
          onRetry={handleSARetry}
        />
      )}
      {screen === "app" && <AttendantApp onLogout={handleLogout} />}
    </>
  );
}
