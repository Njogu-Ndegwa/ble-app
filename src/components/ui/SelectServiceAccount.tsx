"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import Image from "next/image";
import { useI18n } from "@/i18n";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { ServiceAccount } from "@/lib/sa-types";

type ErrorKind = "noAccounts" | "loadFailed" | null;

interface SelectServiceAccountProps {
  accounts: ServiceAccount[];
  loading: boolean;
  errorKind: ErrorKind;
  userName: string;
  userType: "attendant" | "sales";
  lastSAId: number | null;
  onSelect: (sa: ServiceAccount) => void;
  onSignOut: () => void;
  onRetry: () => void;
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: "sa-badge-admin",
  staff: "sa-badge-staff",
  agent: "sa-badge-agent",
};

export default function SelectServiceAccount({
  accounts,
  loading,
  errorKind,
  userName,
  lastSAId,
  onSelect,
  onSignOut,
  onRetry,
}: SelectServiceAccountProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const toggleLocale = useCallback(() => {
    const nextLocale = locale === "en" ? "fr" : locale === "fr" ? "zh" : "en";
    setLocale(nextLocale);
  }, [locale, setLocale]);

  const handleBackToRoles = useCallback(() => {
    router.push("/");
  }, [router]);

  const hasError = errorKind !== null;
  // Treat "no accounts, no error, not loading" as still loading (fetch hasn't started yet)
  const showLoading = loading || (!hasError && accounts.length === 0);

  return (
    <div className="login-page-container">
      <div className="login-bg-gradient" />

      {/* Header — same as login page */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              className="flow-header-back"
              onClick={handleBackToRoles}
              aria-label={t("Back")}
              title={t("Back")}
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
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t("role.switchLanguage")}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">
                {locale.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="login-container">
        {/* Title — only when there are accounts to pick */}
        {!hasError && !showLoading && (
          <div className="login-header">
            <div className="login-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 3h-8l-2 4h12l-2-4z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </div>
            <h1 className="login-title">{t("sa.selectAccount")}</h1>
            <p className="login-subtitle">
              {t("sa.welcome").replace("{name}", userName)}
            </p>
          </div>
        )}

        {/* Loading spinner */}
        {showLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0" }}>
            <div
              className="loading-spinner"
              style={{ width: 32, height: 32, borderWidth: 3 }}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("sa.loadingAccounts")}
            </p>
          </div>
        )}

        {/* Error / no-access state */}
        {hasError && !showLoading && (
          <div className="sa-error-card">
            <div className="sa-error-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0 0 12 3.714Z" />
                <path d="M12 15.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="sa-error-title">{t("sa.noAccessTitle")}</h2>
            <p className="sa-error-desc">{t("sa.noAccessDescription")}</p>
            <p className="sa-error-hint">{t("sa.noAccessHint")}</p>
            <div className="sa-error-actions">
              <button className="btn btn-secondary" onClick={onRetry}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 14, height: 14, marginRight: 6 }}
                >
                  <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                <span>{t("sa.tryAgain")}</span>
              </button>
              <button className="btn btn-primary" onClick={onSignOut}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 14, height: 14, marginRight: 6 }}
                >
                  <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                <span>{t("sa.signOut")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Account cards */}
        {!showLoading && !hasError && (
          <div className="sa-grid">
            {accounts.map((sa) => {
              const isLast = lastSAId === sa.id;
              const roleCls = ROLE_BADGE_CLASS[sa.my_role] ?? "sa-badge-agent";

              return (
                <button
                  key={sa.id}
                  onClick={() => onSelect(sa)}
                  className={`sa-card${isLast ? " sa-card-last-used" : ""}`}
                >
                  {isLast && (
                    <span className="sa-card-last-used-pill">
                      {t("sa.lastUsed")}
                    </span>
                  )}
                  <div className="sa-card-name">{sa.name}</div>
                  <div className="sa-card-badges">
                    <span className={`sa-badge ${roleCls}`}>
                      {sa.my_role}
                    </span>
                    <span className="sa-badge sa-badge-class">
                      {sa.account_class}
                    </span>
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
