'use client';

import React from 'react';

export type BadgeVariant = 
  | 'default' 
  | 'primary' 
  | 'secondary'
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info'
  // Payment states
  | 'payment-current'
  | 'payment-due'
  | 'payment-overdue'
  // Service states
  | 'service-active'
  | 'service-pending'
  | 'service-complete';

export type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Color variant */
  variant?: BadgeVariant;
  /** Size */
  size?: BadgeSize;
  /** Show dot indicator */
  dot?: boolean;
  /** Make it pill-shaped */
  pill?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

// Variant styles using CSS variables
const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
  },
  primary: {
    backgroundColor: 'var(--color-brand)',
    color: 'var(--text-inverse)',
  },
  secondary: {
    backgroundColor: 'var(--bg-surface-hover)',
    color: 'var(--text-primary)',
  },
  success: {
    backgroundColor: 'var(--color-success-soft)',
    color: 'var(--color-success)',
  },
  warning: {
    backgroundColor: 'var(--color-warning-soft)',
    color: 'var(--color-warning)',
  },
  error: {
    backgroundColor: 'var(--color-error-soft)',
    color: 'var(--color-error)',
  },
  info: {
    backgroundColor: 'var(--color-info-soft)',
    color: 'var(--color-info)',
  },
  // Payment states
  'payment-current': {
    backgroundColor: 'var(--color-success-soft)',
    color: 'var(--color-success)',
  },
  'payment-due': {
    backgroundColor: 'var(--color-warning-soft)',
    color: 'var(--color-warning)',
  },
  'payment-overdue': {
    backgroundColor: 'var(--color-error-soft)',
    color: 'var(--color-error)',
  },
  // Service states
  'service-active': {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
  },
  'service-pending': {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    color: '#a855f7',
  },
  'service-complete': {
    backgroundColor: 'var(--color-success-soft)',
    color: 'var(--color-success)',
  },
};

// Size styles using CSS variables
const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  xs: { fontSize: 'var(--font-2xs)', padding: 'var(--space-0-5) var(--space-1-5)' },
  sm: { fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-2)' },
  md: { fontSize: 'var(--font-sm)', padding: 'var(--space-1) var(--space-2-5)' },
};

/**
 * Badge - Status/label badge component
 */
export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pill = true,
  className = '',
  style,
}: BadgeProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
    fontFamily: 'var(--font-sans)',
    borderRadius: pill ? 'var(--radius-full)' : 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    ...variantStyle,
    ...sizeStyle,
    ...style,
  };

  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`} style={baseStyles}>
      {dot && (
        <span 
          style={{
            width: '6px',
            height: '6px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'currentColor',
          }}
        />
      )}
      {children}
    </span>
  );
}

// ============================================
// STATUS BADGE (Preset for common states)
// ============================================

export type StatusType = 
  | 'active' | 'inactive' | 'pending' | 'complete' | 'error'
  | 'paid' | 'due' | 'overdue'
  | 'connected' | 'disconnected'
  | 'new' | 'returned' | 'issued' | 'lost';

interface StatusBadgeProps {
  /** Status type */
  status: StatusType;
  /** Size */
  size?: BadgeSize;
  /** Custom label (overrides default) */
  label?: string;
  /** Show dot */
  dot?: boolean;
  /** Custom className */
  className?: string;
}

// Status to variant mapping
const STATUS_CONFIG: Record<StatusType, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'default', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },
  complete: { variant: 'success', label: 'Complete' },
  error: { variant: 'error', label: 'Error' },
  paid: { variant: 'payment-current', label: 'Paid' },
  due: { variant: 'payment-due', label: 'Due' },
  overdue: { variant: 'payment-overdue', label: 'Overdue' },
  connected: { variant: 'success', label: 'Connected' },
  disconnected: { variant: 'error', label: 'Disconnected' },
  new: { variant: 'info', label: 'New' },
  returned: { variant: 'service-complete', label: 'Returned' },
  issued: { variant: 'service-active', label: 'Issued' },
  lost: { variant: 'error', label: 'Lost' },
};

/**
 * StatusBadge - Preset badge for common status types
 */
export function StatusBadge({
  status,
  size = 'sm',
  label,
  dot = false,
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <Badge 
      variant={config.variant} 
      size={size} 
      dot={dot}
      className={className}
    >
      {label || config.label}
    </Badge>
  );
}
