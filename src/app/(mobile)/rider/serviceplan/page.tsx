"use client";

import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  LogIn,
  User,
  Loader2,
  DollarSign,
  Crown,
  Calendar,
  Phone,
  X,
  Wallet,
} from "lucide-react";

interface ServicePlan {
  name: string;
  duration: string;
  price: number;
  productId: string; // Added productId field
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

const AppContainer = () => {
  const [email, setEmail] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [activeTab, setActiveTab] = useState<"subscribed" | "all">(
    "subscribed"
  );
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] =
    useState<boolean>(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const subscribedPlans: ServicePlan[] = [
    {
      name: "PEG - OVT20",
      duration: "7 Days",
      price: 1,
      productId: "MOBILE-001",
    },
  ];

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
        console.log(
          "Login successful, setting isLoggedIn to true, selectedPlan to null, and storing customer data"
        );
        setIsLoggedIn(true);
        setSelectedPlan(null);
        setCustomer(data.customer);
        toast.success(`Welcome! Signed in as ${data.customer.name}`);
      } else if (response.status === 404) {
        throw new Error("User not found. Please check your email.");
      } else if (response.status === 400) {
        throw new Error(
          "Invalid request. Please ensure your email is correct."
        );
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

  const handleSelectPlan = (plan: ServicePlan) => {
    console.log("Selected plan:", plan);
    setSelectedPlan(plan);
    toast.success(`Selected ${plan.name} (${plan.duration})`);
  };

  const handlePayNow = () => {
    console.log("Pay Now clicked for plan:", selectedPlan);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    const phoneRegex = /^\d{9}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber)) {
      toast.error(
        "Please enter a valid 9-digit mobile number (e.g., 712345678)"
      );
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
        reference: selectedPlan.productId, // Use productId as reference
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
        toast.success(
          `Payment initiated successfully! Check your phone for confirmation.`
        );
        setShowPaymentModal(false);
        setPhoneNumber("");
      } else {
        throw new Error(
          data.message || "Payment initiation failed. Please try again."
        );
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

  const renderPlanCard = (plan: ServicePlan, isSubscribed: boolean = false) => (
    <div
      key={plan.name}
      className="relative bg-gray-700 hover:bg-gray-600 cursor-pointer rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl border border-gray-600"
      onClick={() => handleSelectPlan(plan)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isSubscribed ? "bg-indigo-600/20" : "bg-blue-500/20"
            }`}
          >
            <Calendar
              className={`w-5 h-5 ${
                isSubscribed ? "text-indigo-400" : "text-blue-400"
              }`}
            />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            <p className="text-gray-400 text-sm">
              {isSubscribed ? "Your active plan" : `${plan.duration} access`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-400">${plan.price}</p>
        </div>
      </div>

      <div
        className={`mt-6 w-full py-2 px-4 rounded-lg text-center font-semibold text-sm transition-all duration-200 ${
          isSubscribed
            ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
            : "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
        }`}
      >
        {isSubscribed ? "Currently Active" : "Select Plan"}
      </div>
    </div>
  );

  useEffect(() => {
    console.log("Current state:", { isLoggedIn, selectedPlan, customer });
  }, [isLoggedIn, selectedPlan, customer]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col items-center justify-center p-4">
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
              <h2 className="text-2xl font-bold text-white mb-2">
                Complete Payment
              </h2>
              <p className="text-gray-400 text-sm">
                Plan: {selectedPlan?.name} ({selectedPlan?.duration})
              </p>
              <p className="text-indigo-400 text-xl font-bold mt-2">
                ${selectedPlan?.price}
              </p>
            </div>

            <div className="mb-6">
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
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
                <p className="text-gray-400">
                  Please enter your email to continue
                </p>
              </div>
              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
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
                <p className="text-sm text-gray-500">
                  Need help? Contact support
                </p>
              </div>
            </>
          )}
        </div>
      ) : selectedPlan ? (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Confirm Product</h1>
            <p className="text-gray-400">
              Plan selected: {selectedPlan.name} ({selectedPlan.duration}) - $
              {selectedPlan.price}
            </p>
          </div>
          <button
            onClick={handlePayNow}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Pay Now
          </button>
          <button
            onClick={() => {
              console.log("Returning to plan selection");
              setSelectedPlan(null);
            }}
            className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Change Product
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
            <p className="text-gray-400">
              Manage your subscriptions and explore new products
            </p>
          </div>

          <div className="flex bg-gray-700 rounded-xl p-1 mb-8 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab("subscribed")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === "subscribed"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Crown className="w-4 h-4" />
              Subscribed
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === "all"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4" />
              All Products
            </button>
          </div>

          <div className="space-y-6">
            {activeTab === "subscribed" ? (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Crown className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Active Subscriptions
                  </h2>
                </div>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                  {subscribedPlans.map((plan) => renderPlanCard(plan, true))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-semibold text-white">
                    All Products
                  </h2>
                </div>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                  {allPlans.map((plan) => renderPlanCard(plan, false))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppContainer;

