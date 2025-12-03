"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, QrCode, Copy } from "lucide-react";
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
        timestamp: Date.now(),
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

  const handleCopyTransactionId = useCallback(() => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
      toast.success(t("Transaction ID copied"));
    }
  }, [transactionId, t]);

  const canGenerateQR = subscriptionCode && transactionId.trim() && authToken;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Manual Entry & QR Generation */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Subscription Code */}
        <div>
          <label className="form-label">{t("Subscription Code")}</label>
          {isFetchingSubscription ? (
            <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("Fetching subscription...")}</span>
            </div>
          ) : subscriptionCode ? (
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
              <p className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{subscriptionCode}</p>
            </div>
          ) : (
            <div className="rounded-lg p-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)' }}>
              <p className="text-sm" style={{ color: 'var(--error)' }}>{t("No subscription found")}</p>
              <button
                onClick={fetchSubscription}
                className="mt-2 text-sm underline"
                style={{ color: 'var(--error)' }}
              >
                {t("Retry")}
              </button>
            </div>
          )}
        </div>

        {/* Transaction ID Input */}
        <div>
          <label className="form-label">{t("Transaction ID")}</label>
          <div className="relative">
            <input
              type="text"
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value.toUpperCase());
                setQrDataUrl(null); // Clear QR when ID changes
              }}
              placeholder={t("Enter transaction ID from payment SMS")}
              className="form-input font-mono"
              style={{ paddingRight: 44 }}
            />
            {transactionId && (
              <button
                onClick={handleCopyTransactionId}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={t("Copy")}
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t("Enter the transaction ID from your payment confirmation SMS")}
          </p>
        </div>

        {/* Generate QR Button */}
        <button
          onClick={handleGenerateQR}
          disabled={!canGenerateQR || isGeneratingQr}
          className="btn btn-primary w-full"
          style={{ padding: '14px 20px' }}
        >
          {isGeneratingQr ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t("Generating...")}</span>
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" />
              <span>{t("Generate Payment QR")}</span>
            </>
          )}
        </button>

        {/* QR Code Display */}
        {qrDataUrl && (
          <div className="mt-6 text-center space-y-4">
            <div className="inline-block rounded-2xl shadow-lg p-4" style={{ background: '#FFFFFF' }}>
              <img
                src={qrDataUrl}
                alt={t("Payment QR Code")}
                className="w-64 h-64 object-contain"
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {t("Show this QR code to the attendant")}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t("They will scan it to complete your payment confirmation")}
              </p>
              <div className="inline-block px-4 py-2 rounded-lg" style={{ background: 'var(--success-soft)' }}>
                <p className="text-sm font-mono" style={{ color: 'var(--success)' }}>
                  {t("Transaction ID")}: {transactionId}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t("How it works")}</h4>
        <ol className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>1</span>
            <span>{t("Make your payment through mobile money (M-Pesa, T-Money, etc.)")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>2</span>
            <span>{t("Copy the transaction ID from your payment confirmation SMS")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>3</span>
            <span>{t("Paste it in the field above and generate the QR code")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>4</span>
            <span>{t("Show the QR code to the salesperson or attendant to confirm payment")}</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default PaymentQR;
