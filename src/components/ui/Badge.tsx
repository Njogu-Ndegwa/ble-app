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

// Variant styles
const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  primary: {
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: 'white',
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  success: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  info: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
  },
  // Payment states
  'payment-current': {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
  },
  'payment-due': {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
  },
  'payment-overdue': {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  // Service states
  'service-active': {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    color: '#06b6d4',
  },
  'service-pending': {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
  },
  'service-complete': {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
};

// Size styles
const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  xs: { fontSize: '10px', padding: '2px 6px' },
  sm: { fontSize: '11px', padding: '3px 8px' },
  md: { fontSize: '12px', padding: '4px 10px' },
};

/**
 * Badge - Status/label badge component
 * 
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="payment-due" size="sm">Due</Badge>
 * <Badge variant="error" dot>Overdue</Badge>
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
    gap: '4px',
    fontWeight: 500,
    borderRadius: pill ? '100px' : '4px',
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
            borderRadius: '50%',
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
 * 
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="paid" label="Payment Current" />
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
