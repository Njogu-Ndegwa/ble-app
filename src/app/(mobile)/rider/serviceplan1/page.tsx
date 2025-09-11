"use client";

import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  LogIn,
  User,
  Loader2,
  Wallet,
  LayoutDashboard,
  Package,
  CreditCard,
  Menu,
  LogOut,
  X,
  MapPin,
} from "lucide-react";
import Dashboard from "./dashboard";
import Products from "./products";
import Payments from "./payments";
import ChargingStationFinder from "./ChargingStationFinder";
import { useBridge } from "@/app/context/bridgeContext"; // Import useBridge hook

// Define interfaces
interface ServicePlan {
  name: string;
  duration: string;
  price: number;
  productId: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface PaymentTransaction {
  id: string;
  planName: string;
  amount: number;
  date: string;
  status: "completed" | "pending" | "failed";
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  locationName?: string;
  [key: string]: any;
}

interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
  imageUrl?: string;
  firmwareVersion?: string;
  deviceId?: string;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const AppContainer = () => {
  const [email, setEmail] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "products" | "payments" | "stations">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isLocationListenerActive, setIsLocationListenerActive] = useState<boolean>(false); // Location state
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationData | null>(null); // Location state
  const bridgeInitRef = useRef(false); // Bridge initialization ref
  const { bridge } = useBridge(); // Use bridge context

  const allPlans: ServicePlan[] = [
    {
      name: "PEG - OVT20",
      duration: "7 Days",
      price: 1,
      productId: "MOBILE-001",
    },
    {
      name: "PEG - OVT21",
      duration: "14 Days",
      price: 5,
      productId: "MOBILE-002",
    },
    {
      name: "PEG - OVT22",
      duration: "30 Days",
      price: 10,
      productId: "MOBILE-003",
    },
  ];

  const [paymentHistory] = useState<PaymentTransaction[]>([
    {
      id: "TXN001",
      planName: "PEG - OVT20",
      amount: 1,
      date: "2024-01-15",
      status: "completed",
    },
    {
      id: "TXN002",
      planName: "PEG - OVT21",
      amount: 5,
      date: "2024-01-10",
      status: "completed",
    },
    {
      id: "TXN003",
      planName: "PEG - OVT22",
      amount: 10,
      date: "2024-01-05",
      status: "pending",
    },
  ]);

  // Updated menu items with Charging Station Finder
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "stations", label: "Stations", icon: MapPin }, // New menu item
  ];

  // Validate coordinates
  const hasValidCoordinates = (location: LocationData | null) => {
    return (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude) &&
      location.latitude !== 0 &&
      location.longitude !== 0 &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  };

  // Initialize bridge and set up location callback
  useEffect(() => {
    if (!bridge || bridgeInitRef.current) return;

    const setupBridge = (bridge: WebViewJavascriptBridge) => {
      bridgeInitRef.current = true;

      try {
        bridge.init((_m, r) => r("js success!"));
      } catch (error) {
        console.error("Error initializing bridge:", error);
      }

      const noop = () => {};
      const reg = (name: string, handler: any) => {
        bridge.registerHandler(name, handler);
        return () => bridge.registerHandler(name, noop);
      };

      const offPrint = reg("print", (data: string, resp: any) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.data) resp(parsed.data);
          else throw new Error("Parsed data is not in the expected format.");
        } catch (err) {
          console.error("Error parsing JSON in 'print':", err);
        }
      });

      const offLocationCallback = reg(
        "locationCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const rawLocationData = typeof data === "string" ? JSON.parse(data) : data;

            if (!rawLocationData || typeof rawLocationData !== "object") {
              toast.error("Invalid location data format");
              responseCallback({ success: false, error: "Invalid format" });
              return;
            }

            const { latitude, longitude } = rawLocationData;

            if (
              typeof latitude !== "number" ||
              typeof longitude !== "number" ||
              isNaN(latitude) ||
              isNaN(longitude)
            ) {
              toast.error("Invalid coordinates: Must be valid numbers");
              responseCallback({ success: false, error: "Invalid coordinates" });
              return;
            }

            const locationData: LocationData = {
              latitude,
              longitude,
              timestamp: rawLocationData.timestamp || Date.now(),
              locationName: rawLocationData.locationName,
            };

            if (!hasValidCoordinates(locationData)) {
              if (latitude === 0 && longitude === 0) {
                toast.error("Location at (0,0) - possible GPS error");
              } else {
                toast.error("Coordinates out of valid range");
              }
              responseCallback({ success: false, error: "Invalid coordinates" });
              return;
            }

            setLastKnownLocation(locationData);
            setIsLocationListenerActive(true);
            console.log("Location callback received:", locationData);
            responseCallback({ success: true, location: locationData });
          } catch (error) {
            toast.error("Error processing location data");
            console.error("Error in location callback:", error);
            responseCallback({ success: false, error: String(error) });
          }
        }
      );

      return () => {
        offPrint();
        offLocationCallback();
      };
    };

    if (bridge) {
      return setupBridge(bridge);
    }

    return () => {};
  }, [bridge]);

  // Start location listener automatically when bridge is available
  useEffect(() => {
    if (bridge && bridgeInitRef.current) {
      console.info("Requesting to start location listener");
      toast.loading("Starting location listener...", { id: "location-loading" });

      bridge.callHandler(
        "startLocationListener",
        {},
        (responseData) => {
          try {
            const parsedResponse = JSON.parse(responseData);
            toast.dismiss("location-loading");

            if (parsedResponse?.respCode === "200") {
              setIsLocationListenerActive(true);
              // toast.success("Location tracking started");
            } else {
              setIsLocationListenerActive(false);
              toast.error(`Failed to start: ${parsedResponse?.respMessage || "Unknown error"}`);
            }
          } catch (error) {
            toast.dismiss("location-loading");
            toast.error("Invalid response from location service");
            console.error("Error parsing start location response:", error);
          }
        }
      );
    }
  }, [bridge, bridgeInitRef.current]);

  const handleSignIn = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    setIsSigningIn(true);

    try {
      console.log("Attempting login with email:", email);
      const response = await fetch(
        "https://evans-musamia-odoorestapi.odoo.com/api/customers/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      console.log("API Response:", { status: response.status, data });

      if (response.status === 200) {
        console.log("Login successful, setting isLoggedIn to true");
        setIsLoggedIn(true);
        setSelectedPlan(null);
        setCustomer(data.customer);
        setCurrentPage("dashboard");
        toast.success(`Welcome! Signed in as ${data.customer.name}`);
      } else if (response.status === 404) {
        throw new Error("User not found. Please check your email.");
      } else if (response.status === 400) {
        throw new Error("Invalid request. Please ensure your email is correct.");
      } else {
        throw new Error(data.message || "Login failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      toast.error(error.message || "Sign-in failed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setCustomer(null);
    setSelectedPlan(null);
    setEmail("");
    setCurrentPage("dashboard");
    toast.success("Signed out successfully");
  };

  const handlePayNow = () => {
    console.log("Pay Now clicked for plan:", selectedPlan);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    const phoneRegex = /^\d{9}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber)) {
      toast.error("Please enter a valid 9-digit mobile number (e.g., 712345678)");
      return;
    }

    if (!selectedPlan) {
      toast.error("No plan selected");
      return;
    }

    if (!customer) {
      toast.error("Customer data not available. Please sign in again.");
      return;
    }

    setIsProcessingPayment(true);

    try {
      const fullPhoneNumber = `254${phoneNumber}`;
      const paymentData = {
        partner_id: customer.id,
        amount: selectedPlan.price,
        phone_number: fullPhoneNumber,
        reference: selectedPlan.productId,
        description: `Payment for ${selectedPlan.name}`,
      };

      console.log("Initiating payment with data:", paymentData);

      const response = await fetch(
        "https://evans-musamia-odoorestapi.odoo.com/api/lipay/initiate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          },
          body: JSON.stringify(paymentData),
        }
      );

      const data = await response.json();
      console.log("Payment API Response:", { status: response.status, data });

      if (response.ok) {
        toast.success("Payment initiated successfully! Check your phone for confirmation.");
        setShowPaymentModal(false);
        setPhoneNumber("");
        setSelectedPlan(null);
      } else {
        throw new Error(data.message || "Payment initiation failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setPhoneNumber("");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhoneNumber(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSignIn();
    }
  };

  const handlePhoneKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePaymentSubmit();
    }
  };

  const renderMainContent = () => {
    if (selectedPlan) {
      return (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Confirm Product</h1>
            <p className="text-gray-400">
              Plan selected: {selectedPlan.name} ({selectedPlan.duration}) - ${selectedPlan.price}
            </p>
          </div>
          <button
            onClick={handlePayNow}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Pay Now
          </button>
          <button
            onClick={() => setSelectedPlan(null)}
            className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Change Product
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard customer={customer} />;
      case "products":
        return <Products allPlans={allPlans} subscribedPlans={[]} onSelectPlan={setSelectedPlan} />;
      case "payments":
        return <Payments paymentHistory={paymentHistory} />;
      case "stations":
        return (
          <ChargingStationFinder
            userLocation={lastKnownLocation}
            isLocationActive={isLocationListenerActive}
            lastKnownLocation={lastKnownLocation}
          />
        );
      default:
        return <Dashboard customer={customer} />;
    }
  };

  useEffect(() => {
    console.log("Current state:", { isLoggedIn, selectedPlan, customer, currentPage });
  }, [isLoggedIn, selectedPlan, customer, currentPage]);

  return (
    <div className="min-h-screen bg-[#0C0C0E] flex">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1f2937",
            color: "#f9fafb",
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md relative">
            <button
              onClick={handleCloseModal}
              disabled={isProcessingPayment}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="bg-indigo-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
              <p className="text-gray-400 text-sm">
                Plan: {selectedPlan?.name} ({selectedPlan?.duration})
              </p>
              <p className="text-indigo-400 text-xl font-bold mt-2">${selectedPlan?.price}</p>
            </div>

            <div className="mb-6">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                Mobile Number
              </label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-4 py-3 bg-gray-600 border border-r-0 border-gray-600 rounded-l-lg text-gray-300 text-sm font-medium">
                  254
                </span>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  onKeyPress={handlePhoneKeyPress}
                  placeholder="712345678"
                  maxLength={9}
                  disabled={isProcessingPayment}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-r-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter your 9-digit mobile number (e.g., 712345678)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isProcessingPayment}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                disabled={isProcessingPayment || phoneNumber.length !== 9}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Pay Now</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md">
            {isSigningIn ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                <p className="text-white mt-4">Signing in...</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="bg-blue-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-2">Welcome</h1>
                  <p className="text-gray-400">Please enter your email to continue</p>
                </div>
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your email"
                    disabled={isSigningIn}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn || !email.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Sign In
                    </>
                  )}
                </button>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">Need help? Contact support</p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
      <>
          {/* Sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
          >
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Dashboard</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col h-full">
              <nav className="flex-1 px-4 py-6 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentPage(item.id as any);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                        currentPage === item.id
                          ? "bg-indigo-600 text-white shadow-lg"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-600 rounded-full p-2">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{customer?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{customer?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
          <div className={`flex-1 flex flex-col lg:ml-0 ${sidebarOpen ? "hidden lg:flex" : "flex"}`}>
            <div className="lg:hidden flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-white capitalize">{currentPage}</h1>
              <div className="w-6" /> {/* Spacer */}
            </div>

            <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppContainer;