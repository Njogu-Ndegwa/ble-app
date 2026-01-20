"use client";

import React from "react";
import Image from "next/image";
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
  vehicleInfo: string;
  paymentMethod: string;
  currentBatteryId?: string;
}

interface RiderProfileProps {
  profile: ProfileData;
  bikeImageUrl?: string;
  onAccountDetails: () => void;
  onVehicle: () => void;
  onPlanDetails: () => void;
  onPaymentMethods: () => void;
  onSupport: () => void;
  onLogout: () => void;
}

const RiderProfile: React.FC<RiderProfileProps> = ({
  profile,
  bikeImageUrl,
  onAccountDetails,
  onVehicle,
  onPlanDetails,
  onPaymentMethods,
  onSupport,
  onLogout,
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

    // Remove any existing spaces and ensure we have just digits (and maybe a +)
    let cleaned = phone.replace(/\s+/g, "");

    // Ensure + prefix
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    // Extract country code (1-3 digits after +) and remaining digits
    const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      const countryCode = match[1];
      const remaining = match[2];
      
      // Format remaining digits in groups of 2-3 for readability
      // e.g., 91234567 -> 91 234 567
      const groups: string[] = [];
      let i = 0;
      
      // First group can be 2 digits
      if (remaining.length > 0) {
        groups.push(remaining.slice(0, 2));
        i = 2;
      }
      
      // Remaining groups of 3 digits
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

      {/* Energy Service Card - matching abs-design.vercel.app exactly */}
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
          {/* Account Balance - with accent border */}
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
                {profile.currency || "XOF"} {profile.balance.toLocaleString()}
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
          <span className="energy-plan-name">
            {profile.planName || "7-Day Lux Plan"}
          </span>
          <span className="energy-plan-validity">
            {t("rider.validUntil") || "Valid until"}{" "}
            {profile.planValidity || "Dec 9, 2025"}
          </span>
        </div>
      </div>

      {/* Menu List - matching abs-design.vercel.app exactly */}
      <div className="menu-list">
        {/* Account Details */}
        <div className="menu-item" onClick={onAccountDetails}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("rider.accountDetails") || "Account Details"}
            </div>
            <div className="menu-item-subtitle">
              {t("rider.personalInfoDesc") || "Personal information & settings"}
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

        {/* My Vehicle */}
        <div className="menu-item" onClick={onVehicle}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
              <path d="M5 17H3v-6l2-4h9l4 4h3v6h-2" />
              <path d="M9 17h6" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("rider.myVehicle") || "My Vehicle"}
            </div>
            <div className="menu-item-subtitle">
              {profile.vehicleInfo || "Oves Tuk-Tuk • REG-2024-KE"}
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

        {/* Subscription Plan */}
        <div className="menu-item" onClick={onPlanDetails}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("rider.subscriptionPlan") || "Subscription Plan"}
            </div>
            <div className="menu-item-subtitle">
              {t("rider.managePlanDesc") || "Manage your plan & billing"}
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

        {/* Payment Methods */}
        <div className="menu-item" onClick={onPaymentMethods}>
          <div className="menu-item-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="menu-item-content">
            <div className="menu-item-title">
              {t("rider.paymentMethods") || "Payment Methods"}
            </div>
            <div className="menu-item-subtitle">
              {t("rider.paymentMethodsDesc") || "Manage your payment options"}
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
