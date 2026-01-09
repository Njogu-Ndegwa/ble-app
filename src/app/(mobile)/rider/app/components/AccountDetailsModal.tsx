"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import { changePassword, type ChangePasswordPayload } from '@/lib/odoo-api';

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordChanged: () => void; // Callback after successful password change (to logout)
}

const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({ 
  isOpen, 
  onClose,
  onPasswordChanged 
}) => {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t('rider.currentPasswordRequired') || 'Please enter your current password';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = t('rider.newPasswordRequired') || 'Please enter a new password';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = t('rider.passwordMinLength') || 'Password must be at least 6 characters';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('rider.confirmPasswordRequired') || 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('rider.passwordsDoNotMatch') || 'Passwords do not match';
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = t('rider.newPasswordMustBeDifferent') || 'New password must be different from current password';
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
      const token = localStorage.getItem('authToken_rider');
      
      if (!token) {
        toast.error(t('rider.notAuthenticated') || 'You must be logged in to change your password');
        return;
      }

      const payload: ChangePasswordPayload = {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      };

      await changePassword(payload, token);

      toast.success(t('rider.passwordChangedSuccess') || 'Password changed successfully');
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      
      // Close modal
      onClose();
      
      // Callback to logout user (they need to login with new password)
      setTimeout(() => {
        onPasswordChanged();
      }, 500);
    } catch (error: any) {
      console.error('Password change error:', error);
      const errorMessage = error.message || t('rider.passwordChangeFailed') || 'Failed to change password. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="qr-modal-overlay active" 
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleClose();
      }}
    >
      <div className="qr-modal" style={{ maxWidth: '420px' }}>
        <div className="qr-modal-header">
          <h3 className="qr-modal-title">
            {t('rider.changePassword') || 'Change Password'}
          </h3>
          <button 
            className="qr-modal-close" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="qr-modal-body" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Current Password */}
            <div>
              <label 
                htmlFor="currentPassword" 
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px'
                }}
              >
                {t('rider.currentPassword') || 'Current Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={t('rider.enterCurrentPassword') || 'Enter your current password'}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'var(--bg-surface)',
                    border: errors.currentPassword ? '1px solid var(--color-error)' : '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.currentPassword ? 'var(--color-error)' : 'var(--border-default)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={isSubmitting}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  aria-label={showCurrentPassword ? (t('rider.hidePassword') || 'Hide password') : (t('rider.showPassword') || 'Show password')}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.currentPassword && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-error)' }}>
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label 
                htmlFor="newPassword" 
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px'
                }}
              >
                {t('rider.newPassword') || 'New Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={t('rider.enterNewPassword') || 'Enter your new password'}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'var(--bg-surface)',
                    border: errors.newPassword ? '1px solid var(--color-error)' : '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.newPassword ? 'var(--color-error)' : 'var(--border-default)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isSubmitting}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  aria-label={showNewPassword ? (t('rider.hidePassword') || 'Hide password') : (t('rider.showPassword') || 'Show password')}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.newPassword && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-error)' }}>
                  {errors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px'
                }}
              >
                {t('rider.confirmPassword') || 'Confirm New Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={t('rider.confirmNewPassword') || 'Confirm your new password'}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'var(--bg-surface)',
                    border: errors.confirmPassword ? '1px solid var(--color-error)' : '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.confirmPassword ? 'var(--color-error)' : 'var(--border-default)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  aria-label={showConfirmPassword ? (t('rider.hidePassword') || 'Hide password') : (t('rider.showPassword') || 'Show password')}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-error)' }}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              style={{
                width: '100%',
                padding: '14px',
                background: isSubmitting || !currentPassword || !newPassword || !confirmPassword 
                  ? 'var(--bg-secondary)' 
                  : 'var(--color-brand)',
                color: 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isSubmitting || !currentPassword || !newPassword || !confirmPassword 
                  ? 'not-allowed' 
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                opacity: isSubmitting || !currentPassword || !newPassword || !confirmPassword ? 0.6 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  {t('rider.changingPassword') || 'Changing Password...'}
                </>
              ) : (
                <>
                  <Lock size={18} />
                  {t('rider.changePassword') || 'Change Password'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsModal;

