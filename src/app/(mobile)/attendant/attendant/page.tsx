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

const AttendantApp = dynamic(() => import("./AttendantApp"), {
  loading: AppLoadingFallback,
  ssr: false,
});

const Login = dynamic(() => import("./login"), {
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
    console.info('[AttendantPage] getInitialScreen: SSR (window undefined) → login');
    return { screen: "login", user: null };
  }
  try {
    console.info('[AttendantPage] getInitialScreen: checking localStorage...');
    console.info('[AttendantPage] oves-sales-data:', localStorage.getItem('oves-sales-data')?.slice(0, 100) ?? 'NULL');
    console.info('[AttendantPage] oves-sales-token:', localStorage.getItem('oves-sales-token')?.slice(0, 30) ?? 'NULL');

    const loggedIn = isSalesRoleLoggedIn();
    console.info('[AttendantPage] isSalesRoleLoggedIn():', loggedIn);
    if (!loggedIn) return { screen: "login", user: null };

    const user = getSalesRoleUser();
    console.info('[AttendantPage] getSalesRoleUser():', user ? `${user.name} (${user.email})` : 'NULL');
    if (!user) return { screen: "login", user: null };

    const hasSA = hasSASelected("attendant");
    console.info('[AttendantPage] hasSASelected("attendant"):', hasSA);
    if (hasSA) return { screen: "app", user };
    return { screen: "selectSA", user };
  } catch (err) {
    console.info('[AttendantPage] ERROR: getInitialScreen error:', err);
    return { screen: "login", user: null };
  }
}

export default function AttendantPage() {
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
    saveSelectedSA("attendant", sa);
    setScreen("app");
  }, []);

  const handleSARetry = useCallback(() => {
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

  const handleSignOut = useCallback(() => {
    clearSalesRoleLogin();
    clearSelectedSA("attendant");
    setUser(null);
    setSaAccounts([]);
    setSaErrorKind(null);
    setScreen("login");
  }, []);

  const handleLogout = useCallback(() => {
    clearSalesRoleLogin();
    clearSelectedSA("attendant");
    setUser(null);
    setSaAccounts([]);
    setScreen("login");
  }, []);

  const handleSwitchSA = useCallback(() => {
    clearSelectedSA("attendant");
    setSaAccounts([]);
    setScreen("selectSA");
    const token = getSalesRoleToken();
    if (token) {
      loadServiceAccounts(token);
    }
  }, [loadServiceAccounts]);

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
        <Login onLoginSuccess={handleLoginSuccess} userType="sales" microsoftReturnPath="/attendant/attendant" />
      )}
      {screen === "selectSA" && (
        <SelectServiceAccount
          accounts={saAccounts}
          loading={saLoading}
          errorKind={saErrorKind}
          userName={user?.name ?? ""}
          userType="sales"
          lastSAId={getSelectedSAId("attendant")}
          onSelect={handleSASelect}
          onSignOut={handleSignOut}
          onRetry={handleSARetry}
        />
      )}
      {screen === "app" && <AttendantApp onLogout={handleLogout} onSwitchSA={handleSwitchSA} />}
    </>
  );
}
