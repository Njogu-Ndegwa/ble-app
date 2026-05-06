"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import {
  isSalesRoleLoggedIn,
  getSalesRoleUser,
  getSalesRoleToken,
  clearSalesRoleLogin,
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

const AppLoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
    <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
  </div>
);

const Login = dynamic(() => import("./attendant/login"), {
  loading: AppLoadingFallback,
  ssr: false,
});

const SelectServiceAccount = dynamic(() => import("@/components/ui/SelectServiceAccount"), {
  loading: AppLoadingFallback,
  ssr: false,
});

type Screen = "login" | "selectSA" | "app";

function getInitialScreen(): {
  screen: Screen;
  user: EmployeeUser | null;
} {
  if (typeof window === "undefined") {
    return { screen: "login", user: null };
  }
  try {
    const loggedIn = isSalesRoleLoggedIn();
    if (!loggedIn) return { screen: "login", user: null };

    const user = getSalesRoleUser();
    if (!user) return { screen: "login", user: null };

    const hasSA = hasSASelected("attendant");
    if (hasSA) return { screen: "app", user };
    return { screen: "selectSA", user };
  } catch (err) {
    return { screen: "login", user: null };
  }
}

export interface AttendantPageShellProps {
  /** The main app component rendered after login + SA selection */
  appComponent: React.ComponentType<{
    onLogout?: () => void;
    onSwitchSA?: () => void;
  }>;
  /** Microsoft OAuth return path (e.g. /attendant/attendant) */
  microsoftReturnPath: string;
  /** SA storage key suffix (default: "attendant") */
  saKey?: 'attendant' | 'sales';
}

export default function AttendantPageShell({
  appComponent: AppComponent,
  microsoftReturnPath,
  saKey = "attendant",
}: AttendantPageShellProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen().screen);
  const [user, setUser] = useState<EmployeeUser | null>(
    () => getInitialScreen().user,
  );

  useEffect(() => {
    if (screen === "login") router.replace("/signin");
  }, [screen, router]);

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
          saveSelectedSA(saKey, accounts[0]);
          setScreen("app");
          return;
        }

        setScreen("selectSA");
      } catch (err) {
        console.error("[AttendantPageShell] Failed to load SAs:", err);
        setSaErrorKind("loadFailed");
        setScreen("selectSA");
      } finally {
        setSaLoading(false);
      }
    },
    [saKey],
  );

  // When mounting into selectSA (already logged in, no SA chosen yet), fetch SAs
  useEffect(() => {
    if (screen === "selectSA" && saAccounts.length === 0 && !saLoading) {
      const token = getSalesRoleToken();
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
        userType: "sales",
      };
      setUser(employeeUser);

      const token = getSalesRoleToken();
      if (token) {
        loadServiceAccounts(token);
      } else {
        setScreen("app");
      }
    },
    [loadServiceAccounts],
  );

  const handleSASelect = useCallback((sa: ServiceAccount) => {
    saveSelectedSA(saKey, sa);
    setScreen("app");
  }, [saKey]);

  const handleSARetry = useCallback(() => {
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

  const handleSignOut = useCallback(() => {
    clearSalesRoleLogin();
    clearSelectedSA(saKey);
    setUser(null);
    setSaAccounts([]);
    setSaErrorKind(null);
    setScreen("login");
  }, [saKey]);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSelectedSA(saKey);
    setUser(null);
    setSaAccounts([]);
    setScreen("login");
  }, [saKey]);

  const handleSwitchSA = useCallback(() => {
    clearSelectedSA(saKey);
    setSaAccounts([]);
    setScreen("selectSA");
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts, saKey]);

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
        <Login onLoginSuccess={handleLoginSuccess} userType="sales" microsoftReturnPath={microsoftReturnPath} />
      )}
      {screen === "selectSA" && (
        <SelectServiceAccount
          accounts={saAccounts}
          loading={saLoading}
          errorKind={saErrorKind}
          userName={user?.name ?? ""}
          userType="sales"
          lastSAId={getSelectedSAId(saKey)}
          onSelect={handleSASelect}
          onSignOut={handleSignOut}
          onRetry={handleSARetry}
        />
      )}
      {screen === "app" && <AppComponent onLogout={handleLogout} onSwitchSA={handleSwitchSA} />}
    </>
  );
}
