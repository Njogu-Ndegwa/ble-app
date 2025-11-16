"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Settings, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useI18n } from '@/i18n';

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t("Please enter your current password");
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = t("Please enter a new password");
    } else if (newPassword.length < 6) {
      newErrors.newPassword = t("Password must be at least 6 characters");
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t("Please confirm your new password");
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t("Passwords do not match");
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = t("New password must be different from current password");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get token from localStorage
      const token = localStorage.getItem("authToken_rider");
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };

      // Add Bearer token if available
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        toast.success(t("Password changed successfully"));
        // Reset form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});

        // Invalidate session and redirect to login
        try {
          localStorage.removeItem("authToken_rider");
          localStorage.removeItem("customerData_rider");
        } catch {}

        // Give the user a moment to see the success toast, then redirect
        setTimeout(() => {
          // Navigate back to serviceplan1 route and force a reload so parent state resets to login
          router.replace("/rider/serviceplan1");
          // Ensure parent container re-runs auth checks and shows Login
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.replace('/rider/serviceplan1');
            }
          }, 100);
        }, 800);
      } else {
        const errorMessage = data.message || data.error || t("Failed to change password. Please try again.");
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("Password change error:", error);
      toast.error(error.message || t("An error occurred while changing password. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t("Settings")}</h2>
          <p className="text-gray-400 text-sm">{t("Change your password")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
              {t("Current Password")}
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder={t("Enter your current password")}
                className="w-full px-4 py-3 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={showCurrentPassword ? t("Hide password") : t("Show password")}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-400">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
              {t("New Password")}
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder={t("Enter your new password")}
                className="w-full px-4 py-3 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={showNewPassword ? t("Hide password") : t("Show password")}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-400">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              {t("Confirm New Password")}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder={t("Confirm your new password")}
                className="w-full px-4 py-3 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={showConfirmPassword ? t("Hide password") : t("Show password")}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("Changing Password...")}
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                {t("Change Password")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;

