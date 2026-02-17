'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

// ============================================
// DetailField - single label + value pair
// ============================================
export interface DetailField {
  icon?: React.ReactNode;
  label: string;
  value: string;
  /** Make value tappable (e.g. phone or email) */
  onTap?: () => void;
  /** Render value in monospace (e.g. IDs, codes) */
  mono?: boolean;
}

// ============================================
// DetailSection - grouped card of fields
// ============================================
export interface DetailSection {
  title: string;
  fields: DetailField[];
}

// ============================================
// DetailAction - button in the header or footer
// ============================================
export interface DetailAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'default';
}

// ============================================
// DetailScreenProps
// ============================================
export interface DetailScreenProps {
  /** Back button handler */
  onBack: () => void;
  /** Avatar content (initials, icon, or image) */
  avatar: React.ReactNode;
  /** Primary name / title */
  title: string;
  /** Subtitle (e.g. role, ID, phone) */
  subtitle?: string;
  /** Optional badge next to name */
  badge?: React.ReactNode;
  /** Grouped sections of detail fields */
  sections: DetailSection[];
  /** Action buttons shown in header bar (icon buttons) */
  headerActions?: DetailAction[];
  /** Primary action button at bottom */
  primaryAction?: DetailAction;
  /** Secondary action button at bottom */
  secondaryAction?: DetailAction;
}

/**
 * DetailScreen - Reusable mobile-optimized detail/profile view.
 *
 * Provides: back nav, compact profile header, grouped field sections,
 * and optional action buttons. Designed to be shared across
 * customer details, transaction details, session details, etc.
 */
export default function DetailScreen({
  onBack,
  avatar,
  title,
  subtitle,
  badge,
  sections,
  headerActions,
  primaryAction,
  secondaryAction,
}: DetailScreenProps) {
  return (
    <div className="flex flex-col h-full">
      {/* ---- Top bar ---- */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <span className="flex-1" />
        {headerActions?.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-secondary"
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Profile header - compact inline */}
        <div className="flex items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--bg-primary)' }}
          >
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-text-muted truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Field sections */}
        <div className="flex flex-col gap-4 mt-1">
          {sections.map((section, si) => (
            <div key={si}>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h3>
              <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
                {section.fields.map((field, fi) => (
                  <div
                    key={fi}
                    className={`flex items-center gap-3 px-4 py-3 ${field.onTap ? 'cursor-pointer active:bg-bg-elevated' : ''}`}
                    onClick={field.onTap}
                  >
                    {field.icon && (
                      <div className="w-5 text-text-muted flex-shrink-0 flex items-center justify-center">
                        {field.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-muted">{field.label}</p>
                      <p className={`text-sm text-text-primary truncate ${field.mono ? 'font-mono' : ''}`}>
                        {field.value || '--'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Bottom actions ---- */}
      {(primaryAction || secondaryAction) && (
        <div className="px-4 py-3 border-t border-border flex gap-3">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform hover:bg-bg-elevated"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              style={{ backgroundColor: 'var(--color-brand)' }}
              className="flex-1 py-3 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
