"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "react-hot-toast";
import QRCode from "qrcode";
import { useI18n } from '@/i18n';

interface PaymentQRProps {
  customer: {
    id: number;
    partner_id?: number;
  } | null;
}

const PaymentQR: React.FC<PaymentQRProps> = ({ customer }) => {
  const { t } = useI18n();
  const [subscriptionCode, setSubscriptionCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string>("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isFetchingSubscription, setIsFetchingSubscription] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

  // Fetch subscription code on mount
  useEffect(() => {
    if (customer?.partner_id || customer?.id) {
      fetchSubscription();
    }
  }, [customer]);

  // Get authToken from localStorage
  useEffect(() => {
    const token = localStorage.getItem("authToken_rider");
    setAuthToken(token);
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!customer?.partner_id && !customer?.id) {
      toast.error(t("Customer data not available"));
      return;
    }

    setIsFetchingSubscription(true);
    try {
      const partnerId = customer.partner_id || customer.id;
      const token = localStorage.getItem("authToken_rider");
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = `https://crm-omnivoltaic.odoo.com/api/customers/${partnerId}/subscriptions?page=1&limit=20`;
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.subscriptions) && data.subscriptions.length > 0) {
        // Get the first active subscription or the first one available
        const activeSubscription = data.subscriptions.find(
          (sub: any) => sub.status === "active"
        ) || data.subscriptions[0];
        
        if (activeSubscription?.subscription_code) {
          setSubscriptionCode(activeSubscription.subscription_code);
        } else {
          toast.error(t("No subscription code found"));
        }
      } else {
        toast.error(t("No subscriptions found"));
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      toast.error(t("Failed to fetch subscription"));
    } finally {
      setIsFetchingSubscription(false);
    }
  }, [customer, t]);

  const handleGenerateQR = useCallback(async () => {
    if (!subscriptionCode || !transactionId.trim() || !authToken) {
      toast.error(t("Please ensure all fields are filled"));
      return;
    }

    setIsGeneratingQr(true);
    try {
      const qrData = {
        subscription_code: subscriptionCode,
        transaction_id: transactionId.trim(),
        authToken_rider: authToken,
      };

      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrDataUrl(qrDataUrl);
      toast.success(t("Payment QR code generated successfully"));
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error(t("Failed to generate QR code"));
    } finally {
      setIsGeneratingQr(false);
    }
  }, [subscriptionCode, transactionId, authToken, t]);

  const canGenerateQR = subscriptionCode && transactionId.trim() && authToken;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-4">
        {/* Subscription Code */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t("Subscription Code")}
          </label>
          {isFetchingSubscription ? (
            <div className="flex items-center gap-2 text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("Fetching subscription...")}</span>
            </div>
          ) : subscriptionCode ? (
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-white font-semibold">{subscriptionCode}</p>
            </div>
          ) : (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-red-300 text-sm">{t("No subscription found")}</p>
              <button
                onClick={fetchSubscription}
                className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
              >
                {t("Retry")}
              </button>
            </div>
          )}
        </div>

        {/* Transaction ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t("Transaction ID")}
          </label>
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder={t("Enter transaction ID")}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t("Enter the transaction ID from your payment confirmation")}
          </p>
        </div>

        {/* Generate QR Button */}
        <button
          onClick={handleGenerateQR}
          disabled={!canGenerateQR || isGeneratingQr}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all duration-200"
        >
          {isGeneratingQr ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("Generating...")}
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" />
              {t("Generate Payment QR")}
            </>
          )}
        </button>

        {/* QR Code Display */}
        {qrDataUrl && (
          <div className="mt-6 text-center space-y-3">
            <div className="inline-block bg-white p-4 rounded-2xl shadow-lg">
              <img
                src={qrDataUrl}
                alt={t("Payment QR Code")}
                className="w-64 h-64 object-contain"
              />
            </div>
            <p className="text-gray-300 text-sm">
              {t("Show this QR code to the attendant to complete your payment")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentQR;

