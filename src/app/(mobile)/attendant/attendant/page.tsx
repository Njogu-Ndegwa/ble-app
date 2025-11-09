"use client";

import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Loader2, Menu, X, LayoutDashboard, Battery, User, LogOut } from "lucide-react";
import Dashboard from "./dashboard";
import Login from "./login";
import Swap from "./swap";
import { useI18n } from '@/i18n';

// Define interfaces
interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
  company_id?: number;
}

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const AppContainer = () => {
  const { t } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "swap">("swap");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Check local storage for email on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        try {
          const response = await fetch(
            `${API_BASE}/customers/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": "abs_connector_secret_key_2024",
              },
              body: JSON.stringify({ email: storedEmail }),
            }
          );

          const data = await response.json();
          if (response.status === 200) {
            setCustomer(data.customer);
            setIsLoggedIn(true);
            setCurrentPage("swap");
          } else {
            localStorage.removeItem("userEmail");
          }
        } catch (error) {
          console.error("Error verifying stored email:", error);
          localStorage.removeItem("userEmail");
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (customerData: Customer) => {
    localStorage.setItem("userEmail", customerData.email);
    setIsLoggedIn(true);
    setCustomer(customerData);
    setCurrentPage("swap");
    toast.success(t("Welcome! Signed in successfully"));
  };

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    setIsLoggedIn(false);
    setCustomer(null);
    toast.success(t("Signed out successfully"));
  };

  const menuItems = [
    { id: "dashboard", labelKey: "Dashboard", icon: LayoutDashboard },
    { id: "swap", labelKey: "Attendant", icon: Battery },
    { id: "logout", labelKey: "Logout", icon: LogOut },
  ];

  const renderMainContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard customer={customer} />;
      case "swap":
        return <Swap customer={customer} />;
      default:
        return <Dashboard customer={customer} />;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#333",
            color: "#fff",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #374151",
          },
          success: {
            iconTheme: {
              primary: "#10B981",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "#EF4444",
              secondary: "white",
            },
          },
        }}
      />

      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } transition-transform duration-300 ease-in-out`}
          >
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">{t("Menu")}</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col h-full">
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === "logout") {
                          handleSignOut();
                        } else {
                          setCurrentPage(item.id as "dashboard" | "swap");
                        }
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                        item.id === "logout"
                          ? "text-red-400 hover:bg-red-900/20 hover:text-red-300"
                          : currentPage === item.id
                          ? "bg-gray-600 text-white shadow-lg"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {t(item.labelKey)}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 rounded-full p-2">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{customer?.name || "User"}</p>
                    <p className="text-xs text-gray-400 truncate">{customer?.email || "No email"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className={`flex-1 flex flex-col ${sidebarOpen ? "hidden" : "flex"}`}>
            <div className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-white capitalize">{t(menuItems.find((i) => i.id === currentPage)?.labelKey || currentPage)}</h1>
              <div className="w-6" />
            </div>

            <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppContainer;
