"use client";

import React, { useCallback } from "react";
import Image from "next/image";
import { Globe, CreditCard } from "lucide-react";
import { useI18n } from "@/i18n";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { RiderSubscription } from "../types";

interface SelectSubscriptionProps {
  subscriptions: RiderSubscription[];
  activeCode: string | null;
  loading: boolean;
  error: string | null;
  userName: string;
  onSelect: (sub: RiderSubscription) => void;
  onBack: () => void;
  onRetry: () => void;
}

/**
 * Full-screen subscription picker — mirrors SelectServiceAccount.
 *
 * Shows the rider's available subscriptions as a grid of large tappable cards
 * using the shared `.sa-grid` / `.sa-card` / `.sa-badge` styling system so the
 * visual language matches the rest of the platform.
 */
export default function SelectSubscription({
  subscriptions,
  activeCode,
  loading,
  error,
  userName,
  onSelect,
  onBack,
  onRetry,
}: SelectSubscriptionProps) {
  const { locale, setLocale, t } = useI18n();

  const toggleLocale = useCallback(() => {
    const next = locale === "en" ? "fr" : locale === "fr" ? "zh" : "en";
    setLocale(next);
  }, [locale, setLocale]);

  const showLoading = loading && subscriptions.length === 0;
  const hasError = !!error && !loading;
  const hasSubs = subscriptions.length > 0;

  const statusBadgeClass = (status: string) => {
    if (status === "active") return "sa-badge-staff";
    if (status === "pending") return "sa-badge-agent";
    return "sa-badge-class";
  };

  return (
    <div className="login-page-container">
      <div className="login-bg-gradient" />

      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              className="flow-header-back"
              onClick={onBack}
              aria-label={t("common.back") || "Back"}
              title={t("common.back") || "Back"}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>
          <div
            className="flow-header-right"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t("role.switchLanguage") || "Switch language"}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="login-container">
        {!hasError && !showLoading && (
          <div className="login-header">
            <div className="login-icon">
              <CreditCard size={24} strokeWidth={1.5} />
            </div>
            <h1 className="login-title">
              {t("rider.selectSubscription.title") || "Select a subscription"}
            </h1>
            <p className="login-subtitle">
              {userName
                ? (t("rider.selectSubscription.welcome") || "Welcome, {name}").replace(
                    "{name}",
                    userName,
                  )
                : t("rider.selectSubscription.subtitle") ||
                  "Pick the plan you want to use."}
            </p>
          </div>
        )}

        {showLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "48px 0",
            }}
          >
            <div
              className="loading-spinner"
              style={{ width: 32, height: 32, borderWidth: 3 }}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("rider.selectSubscription.loading") || "Loading subscriptions..."}
            </p>
          </div>
        )}

        {hasError && (
          <div className="sa-error-card">
            <h2 className="sa-error-title">
              {t("rider.selectSubscription.errorTitle") ||
                "Couldn't load subscriptions"}
            </h2>
            <p className="sa-error-desc">{error}</p>
            <div className="sa-error-actions">
              <button className="btn btn-primary" onClick={onRetry}>
                <span>{t("common.tryAgain") || "Try again"}</span>
              </button>
            </div>
          </div>
        )}

        {!hasError && !showLoading && !hasSubs && (
          <div className="sa-error-card">
            <h2 className="sa-error-title">
              {t("rider.selectSubscription.emptyTitle") || "No subscriptions yet"}
            </h2>
            <p className="sa-error-desc">
              {t("rider.selectSubscription.emptyDesc") ||
                "You don't have any active subscriptions. Contact support to get started."}
            </p>
          </div>
        )}

        {!hasError && !showLoading && hasSubs && (
          <div className="sa-grid">
            {subscriptions.map((sub) => {
              const isActive = activeCode === sub.subscription_code;
              const price = sub.price_at_signup ?? sub.price ?? 0;
              const currency = sub.currency_symbol || sub.currency || "";
              return (
                <button
                  key={sub.id}
                  onClick={() => onSelect(sub)}
                  className={`sa-card${isActive ? " sa-card-last-used" : ""}`}
                >
                  {isActive && (
                    <span className="sa-card-last-used-pill">
                      {t("rider.selectSubscription.current") || "Current"}
                    </span>
                  )}
                  <div className="sa-card-name">{sub.product_name}</div>
                  <div className="sa-card-badges">
                    <span className={`sa-badge ${statusBadgeClass(sub.status)}`}>
                      {sub.status}
                    </span>
                    <span className="sa-badge sa-badge-class">
                      {sub.subscription_code}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      marginTop: 8,
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    {price > 0 && (
                      <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                        {currency} {price.toLocaleString()}
                      </span>
                    )}
                    {sub.next_cycle_date && (
                      <span>
                        {t("rider.validUntil") || "Valid until"}{" "}
                        {new Date(sub.next_cycle_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
