'use client';

import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Optional icon rendered in a circle above the title. */
  icon?: React.ReactNode;
  /** Background for the icon circle (defaults to the brand soft tint). */
  iconBackground?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Disables both buttons and spins the confirm one while the action runs. */
  busy?: boolean;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Small centered confirm modal — same visual pattern as the ticket
 * delete/close confirms. Ported from the desktop portal's ConfirmDialog.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  icon,
  iconBackground,
  danger = false,
  busy = false,
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          {icon && (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: iconBackground || 'var(--color-brand-soft, rgba(255,200,0,0.12))' }}
            >
              {icon}
            </div>
          )}
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-xl border font-medium text-sm transition-colors active:scale-[0.98]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: danger ? 'var(--color-error)' : 'var(--color-brand)' }}
          >
            {busy && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
