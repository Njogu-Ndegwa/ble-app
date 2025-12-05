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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  elevated: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  outlined: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  filled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.2s ease',
    ...variantStyle,
    ...(isInteractive && {
      cursor: 'pointer',
    }),
    ...(selected && {
      borderColor: 'var(--color-primary, #6366f1)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Avatar name={name} size={compact ? 'sm' : 'md'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: compact ? '14px' : '16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
          {phone && (
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: 'var(--font-mono)',
            }}>
              {phone}
            </div>
          )}
          {!compact && email && (
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              {email}
            </div>
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
}: SelectableCardProps) {
  return (
    <Card 
      variant="outlined" 
      selected={selected} 
      onClick={onSelect}
      disabled={disabled}
      className={`selectable-card ${className}`}
      style={{ position: 'relative' }}
    >
      {showCheck && selected && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckIcon size={14} color="white" strokeWidth={3} />
        </div>
      )}
      {showRadio && (
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: `2px solid ${selected ? 'var(--color-primary, #6366f1)' : 'rgba(255, 255, 255, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {selected && (
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary, #6366f1)',
            }} />
          )}
        </div>
      )}
      {children}
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
      padding: '8px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <span style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '13px',
      }}>
        {icon}
        {label}
      </span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontWeight: 500,
        color: valueColor || 'white',
        fontSize: '13px',
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
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : 'rgba(255,255,255,0.6)';

  return (
    <Card variant="filled" className={`stat-card ${className}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
            {value}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
            {label}
          </div>
          {trendValue && (
            <div style={{ 
              fontSize: '11px', 
              color: trendColor,
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div style={{ 
            opacity: 0.5,
            width: '32px',
            height: '32px',
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
