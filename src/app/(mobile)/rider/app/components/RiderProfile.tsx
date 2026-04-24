"use client";

import React from "react";
import Image from "next/image";
import { CreditCard, ArrowLeftRight } from "lucide-react";
import { useI18n } from "@/i18n";

interface ProfileData {
  name: string;
  initials: string;
  phone: string;
  balance: number;
  currency?: string;
  swapsThisMonth: number;
  planName: string;
  planValidity: string;
  paymentState: "PAID" | "RENEWAL_DUE" | "OVERDUE" | "PENDING" | string;
  currentBatteryId?: string;
}

interface RiderProfileProps {
  profile: ProfileData;
  bikeImageUrl?: string;
  onSupport: () => void;
  onLogout: () => void;
  onSwitchSubscription?: () => void;
  subscriptionCode?: string | null;
  subscriptionStatus?: string | null;
}

const RiderProfile: React.FC<RiderProfileProps> = ({
  profile,
  bikeImageUrl,
  onSupport,
  onLogout,
  onSwitchSubscription,
  subscriptionCode,
  subscriptionStatus,
}) => {
  const { t } = useI18n();

  const getPaymentStateClass = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return "paid";
      case "RENEWAL_DUE":
        return "renewal-due";
      case "OVERDUE":
      case "inactive":
        return "overdue";
      case "PENDING":
        return "pending";
      default:
        return "paid";
    }
  };

  const getPaymentStateLabel = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return t("common.active") || "Active";
      case "RENEWAL_DUE":
        return t("attendant.renewalDue") || "Renewal Due";
      case "OVERDUE":
      case "inactive":
        return t("attendant.overdue") || "Overdue";
      case "PENDING":
        return t("common.pending") || "Pending";
      default:
        return paymentState === "active"
          ? t("common.active") || "Active"
          : paymentState;
    }
  };

  // Format phone number with + prefix and spaced digit groups
  // Example: +228 91 234 567
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return "";
    let cleaned = phone.replace(/\s+/g, "");
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      const countryCode = match[1];
      const remaining = match[2];
      const groups: string[] = [];
      let i = 0;
      if (remaining.length > 0) {
        groups.push(remaining.slice(0, 2));
        i = 2;
      }
      while (i < remaining.length) {
        groups.push(remaining.slice(i, i + 3));
        i += 3;
      }
      return `${countryCode} ${groups.join(" ")}`;
    }
    return cleaned;
  };

  return (
    <div className="rider-screen active">
      {/* Profile Header - Avatar centered, name and phone below */}
      <div className="profile-header-centered">
        <div className="profile-avatar-large">{profile.initials}</div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-phone">{formatPhoneNumber(profile.phone)}</div>
      </div>

      {/* Energy Service Card */}
      <div className="energy-service-card">
        {/* Header with icon, title and status */}
        <div className="energy-service-header">
          <div className="energy-service-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="energy-service-title">
            <span className="energy-service-name">
              {t("rider.energyService") || "Energy Service"}
            </span>
            <span
              className={`energy-service-status ${getPaymentStateClass(
                profile.paymentState
              )}`}
            >
              <span className="status-dot"></span>
              {getPaymentStateLabel(profile.paymentState)}
            </span>
          </div>
        </div>

        {/* E-Trike Image */}
        <div className="energy-service-visual">
          <Image
            src={bikeImageUrl || "/assets/E-3-one.png"}
            alt="E-Trike"
            width={180}
            height={110}
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Stats - Stacked vertically with icons */}
        <div className="energy-service-stats-vertical">
          {/* Account Balance */}
          <div className="energy-stat-row highlighted">
            <div className="energy-stat-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v12M8 10h8M8 14h8"></path>
              </svg>
            </div>
            <div className="energy-stat-content">
              <div className="energy-stat-value">
                {profile.currency || ""} {profile.balance.toLocaleString()}
              </div>
              <div className="energy-stat-label">
                {t("rider.accountBalance") || "Account Balance"}
              </div>
            </div>
          </div>

          {/* Swaps This Month */}
          <div className="energy-stat-row">
            <div className="energy-stat-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M17 7h4v4" />
              </svg>
            </div>
            <div className="energy-stat-content">
              <div className="energy-stat-value">{profile.swapsThisMonth}</div>
              <div className="energy-stat-label">
                {profile.swapsThisMonth === 1
                  ? t("rider.swapThisMonth") || "Swap This Month"
                  : t("rider.swapsThisMonth") || "Swaps This Month"}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Info Footer - name on left, validity on right */}
        <div className="energy-service-footer-row">
          <span className="energy-plan-name">{profile.planName}</span>
          {profile.planValidity && (
            <span className="energy-plan-validity">
              {t("rider.validUntil") || "Valid until"} {profile.planValidity}
            </span>
          )}
        </div>
      </div>

      {/* Subscription chip — SA-style switcher */}
      {onSwitchSubscription && (
        <div className="rm-sub-chip">
          <div className="rm-sub-chip-icon">
            <CreditCard size={18} />
          </div>
          <div className="rm-sub-chip-body">
            <p className="rm-sub-chip-label">
              {t("rider.currentPlan") || "Current plan"}
            </p>
            <p className="rm-sub-chip-name">{profile.planName}</p>
            <div className="rm-sub-chip-badges">
              <span className="sa-badge sa-badge-staff">
                {getPaymentStateLabel(
                  subscriptionStatus || profile.paymentState
                )}
              </span>
              {subscriptionCode && (
                <span className="sa-badge sa-badge-class">
                  {subscriptionCode}
                </span>
              )}
            </div>
          </div>
          <button
            className="rm-sub-chip-btn"
            onClick={onSwitchSubscription}
            aria-label={t("rider.switchPlan") || "Switch plan"}
          >
            <ArrowLeftRight size={13} />
            <span>{t("rider.switchPlan") || "Switch"}</span>
          </button>
        </div>
      )}

      {/* Simplified Menu - Help & Logout only */}
      <div className="menu-list">
        {/* Help & Support */}
        <div className="menu-item" onClick={onSupport}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("rider.helpSupport") || "Help & Support"}
            </div>
            <div className="menu-item-subtitle">
              {t("rider.supportDesc") || "FAQs, contact support"}
            </div>
          </div>
          <div className="menu-item-arrow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>

        {/* Log Out */}
        <div className="menu-item logout" onClick={onLogout}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("common.logout") || "Log Out"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderProfile;
