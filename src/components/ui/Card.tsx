'use client';

import React from 'react';
import Avatar from './Avatar';
import Badge from './Badge';
import { CheckIcon } from './Icons';

// ============================================
// BASE CARD
// ============================================

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';

interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: CardVariant;
  /** Click handler (makes card interactive) */
  onClick?: () => void;
  /** Whether the card is selected */
  selected?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<CardVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
  },
  elevated: {
    backgroundColor: 'var(--bg-surface-hover)',
    boxShadow: 'var(--shadow-card)',
  },
  outlined: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-default)',
  },
  filled: {
    backgroundColor: 'var(--bg-surface)',
  },
};

/**
 * Card - Base card container component
 */
export default function Card({
  children,
  variant = 'default',
  onClick,
  selected = false,
  disabled = false,
  className = '',
  style,
}: CardProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const isInteractive = !!onClick && !disabled;

  const baseStyles: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4)',
    transition: 'var(--transition-fast)',
    ...variantStyle,
    ...(isInteractive && {
      cursor: 'pointer',
    }),
    ...(selected && {
      borderColor: 'var(--color-brand)',
      backgroundColor: 'rgba(0, 229, 229, 0.08)',
    }),
    ...(disabled && {
      opacity: 0.5,
      pointerEvents: 'none',
    }),
    ...style,
  };

  return (
    <div 
      className={`card card-${variant} ${selected ? 'card-selected' : ''} ${className}`}
      style={baseStyles}
      onClick={isInteractive ? onClick : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ============================================
// CUSTOMER CARD
// ============================================

interface CustomerCardProps {
  /** Customer name */
  name: string;
  /** Phone number */
  phone?: string;
  /** Email */
  email?: string;
  /** Plan/subscription name */
  plan?: string;
  /** Status badge */
  status?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * CustomerCard - Display customer information
 */
export function CustomerCard({
  name,
  phone,
  email,
  plan,
  status,
  onClick,
  compact = false,
  className = '',
}: CustomerCardProps) {
  return (
    <Card variant="default" onClick={onClick} className={`customer-card ${className}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Avatar name={name} size={compact ? 'sm' : 'md'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-h5 truncate">{name}</div>
          {phone && (
            <div className="text-mono-sm text-muted">{phone}</div>
          )}
          {!compact && email && (
            <div className="text-caption text-muted">{email}</div>
          )}
        </div>
        {plan && <Badge variant="secondary">{plan}</Badge>}
        {status}
      </div>
    </Card>
  );
}

// ============================================
// SELECTABLE CARD
// ============================================

interface SelectableCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Whether the card is selected */
  selected?: boolean;
  /** Click handler */
  onSelect: () => void;
  /** Whether to show checkmark */
  showCheck?: boolean;
  /** Whether to show radio button */
  showRadio?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

/**
 * SelectableCard - Card with selection indicator
 */
export function SelectableCard({
  children,
  selected = false,
  onSelect,
  showCheck = true,
  showRadio = false,
  disabled = false,
  className = '',
  style,
}: SelectableCardProps) {
  const radioButton = showRadio ? (
    <div style={{
      width: 'var(--space-5)',
      height: 'var(--space-5)',
      borderRadius: 'var(--radius-full)',
      border: `2px solid ${selected ? 'var(--color-brand)' : 'var(--border-default)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {selected && (
        <div style={{
          width: 'var(--space-2-5)',
          height: 'var(--space-2-5)',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-brand)',
        }} />
      )}
    </div>
  ) : null;

  return (
    <Card 
      variant="outlined" 
      selected={selected} 
      onClick={onSelect}
      disabled={disabled}
      className={`selectable-card ${className}`}
      style={{ position: 'relative', ...style }}
    >
      {showCheck && selected && (
        <div style={{
          position: 'absolute',
          top: 'var(--space-2)',
          right: 'var(--space-2)',
          width: 'var(--space-6)',
          height: 'var(--space-6)',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckIcon size={14} color="var(--text-inverse)" strokeWidth={3} />
        </div>
      )}
      {showRadio ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          width: '100%',
        }}>
          {radioButton}
          <div style={{ flex: 1, minWidth: 0 }}>
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

// ============================================
// PREVIEW ROW
// ============================================

interface PreviewRowProps {
  /** Label */
  label: string;
  /** Value */
  value: React.ReactNode;
  /** Use mono font for value */
  mono?: boolean;
  /** Value color */
  valueColor?: string;
  /** Icon on the left */
  icon?: React.ReactNode;
}

/**
 * PreviewRow - Key-value display row for receipts/previews
 */
export function PreviewRow({
  label,
  value,
  mono = false,
  valueColor,
  icon,
}: PreviewRowProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'var(--space-2) 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--space-2)',
        color: 'var(--text-muted)',
        fontSize: 'var(--font-sm)',
      }}>
        {icon}
        {label}
      </span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
        color: valueColor || 'var(--text-primary)',
        fontSize: 'var(--font-sm)',
      }}>
        {value}
      </span>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  /** Stat value */
  value: string | number;
  /** Stat label */
  label: string;
  /** Icon */
  icon?: React.ReactNode;
  /** Trend (positive/negative/neutral) */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value */
  trendValue?: string;
  /** Custom className */
  className?: string;
}

/**
 * StatCard - Display a statistic with optional trend
 */
export function StatCard({
  value,
  label,
  icon,
  trend,
  trendValue,
  className = '',
}: StatCardProps) {
  const trendColor = trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-error)' : 'var(--text-muted)';

  return (
    <Card variant="filled" className={`stat-card ${className}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="text-3xl" style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-1)' }}>
            {value}
          </div>
          <div className="text-caption text-muted">{label}</div>
          {trendValue && (
            <div style={{ 
              fontSize: 'var(--font-xs)', 
              color: trendColor,
              marginTop: 'var(--space-1)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div style={{ opacity: 0.5, width: 'var(--icon-xl)', height: 'var(--icon-xl)' }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
