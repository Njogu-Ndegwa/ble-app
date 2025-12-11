'use client';

import React from 'react';
import { BoltIcon, SwapIcon } from './Icons';

// ============================================
// PROGRESS BAR
// ============================================

export type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'gradient';

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom label */
  label?: string;
  /** Height in pixels */
  height?: number;
  /** Animate the bar */
  animated?: boolean;
  /** Custom className */
  className?: string;
}

// Variant colors using CSS variables
const VARIANT_COLORS: Record<ProgressVariant, string> = {
  default: 'var(--color-brand)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  gradient: 'linear-gradient(90deg, var(--color-brand), #8b5cf6)',
};

/**
 * Get color based on percentage
 */
export function getProgressColor(percent: number): ProgressVariant {
  if (percent > 30) return 'success';
  if (percent > 10) return 'warning';
  return 'error';
}

/**
 * ProgressBar - Visual progress indicator
 */
export function ProgressBar({
  value,
  max = 100,
  variant = 'default',
  showLabel = false,
  label,
  height = 8,
  animated = false,
  className = '',
}: ProgressBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  const color = VARIANT_COLORS[variant];

  return (
    <div className={`progress-bar-container ${className}`}>
      {(showLabel || label) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-1)',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-muted)',
        }}>
          <span>{label}</span>
          {showLabel && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div 
        style={{
          height: `${height}px`,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: `${height / 2}px`,
          overflow: 'hidden',
        }}
      >
        <div 
          style={{
            height: '100%',
            width: `${percent}%`,
            background: color,
            borderRadius: `${height / 2}px`,
            transition: animated ? 'width 0.5s ease' : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ============================================
// QUOTA BAR
// ============================================

interface QuotaBarProps {
  /** Current/remaining value */
  remaining: number;
  /** Total value */
  total: number;
  /** Unit label */
  unit?: string;
  /** Type of quota */
  type?: 'energy' | 'swaps' | 'custom';
  /** Custom icon */
  icon?: React.ReactNode;
  /** Show monetary value */
  monetaryValue?: number;
  /** Currency symbol */
  currency?: string;
  /** Custom className */
  className?: string;
}

/**
 * Round to specified decimal places to avoid floating-point precision issues
 * (e.g., 3.47 - 3.46 = 0.01, not 0.010000000000000231)
 */
function roundValue(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Format remaining value for display, handling floating-point precision
 */
function formatRemaining(value: number): string {
  // Round to 2 decimal places to avoid floating-point precision display issues
  const rounded = roundValue(value, 2);
  // If the rounded value is an integer, display without decimals
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  // Otherwise display with up to 2 decimal places, trimming trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * QuotaBar - Display remaining quota with visual bar
 */
export function QuotaBar({
  remaining,
  total,
  unit = '',
  type = 'custom',
  icon,
  monetaryValue,
  currency = 'XOF',
  className = '',
}: QuotaBarProps) {
  // Round values to avoid floating-point precision issues
  const roundedRemaining = roundValue(remaining, 2);
  const percent = total > 0 ? (roundedRemaining / total) * 100 : 0;
  const variant = getProgressColor(percent);

  // Default icons based on type
  const typeIcons = {
    energy: <BoltIcon size={16} />,
    swaps: <SwapIcon size={16} />,
    custom: null,
  };

  const displayIcon = icon || typeIcons[type];

  return (
    <div className={`quota-bar ${className}`} style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      backgroundColor: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Icon */}
      {displayIcon && (
        <div style={{
          width: 'var(--icon-xl)',
          height: 'var(--icon-xl)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: type === 'energy' ? 'var(--color-warning-soft)' : 'rgba(6, 182, 212, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: type === 'energy' ? 'var(--color-warning)' : '#06b6d4',
          flexShrink: 0,
        }}>
          {displayIcon}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-1-5)',
        }}>
          <span style={{ 
            fontSize: 'var(--font-xl)', 
            fontWeight: 'var(--weight-semibold)',
            fontFamily: 'var(--font-mono)',
          }}>
            {formatRemaining(remaining)}
          </span>
          <span style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-muted)',
          }}>
            {unit}
          </span>
          {monetaryValue !== undefined && monetaryValue > 0 && (
            <span style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--text-muted)',
              marginLeft: 'var(--space-1)',
            }}>
              (≈ {monetaryValue.toLocaleString()} {currency})
            </span>
          )}
        </div>
        <ProgressBar 
          value={roundedRemaining} 
          max={total} 
          variant={variant}
          height={6}
          animated
        />
      </div>
    </div>
  );
}

// ============================================
// STEP PROGRESS
// ============================================

interface StepProgressProps {
  /** Current step (1-based) */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Show step label */
  showLabel?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * StepProgress - Show progress through steps
 */
export function StepProgress({
  currentStep,
  totalSteps,
  showLabel = true,
  className = '',
}: StepProgressProps) {
  const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className={`step-progress ${className}`}>
      {showLabel && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-muted)',
        }}>
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round(percent)}% complete</span>
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: index < currentStep ? 'var(--color-brand)' : 'var(--bg-surface)',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// CIRCULAR PROGRESS
// ============================================

interface CircularProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Show value in center */
  showValue?: boolean;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Custom className */
  className?: string;
}

/**
 * CircularProgress - Circular progress indicator
 */
export function CircularProgress({
  value,
  size = 64,
  strokeWidth = 6,
  showValue = true,
  variant = 'default',
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (percent / 100) * circumference;
  const color = VARIANT_COLORS[variant];

  return (
    <div 
      className={`circular-progress ${className}`}
      style={{ position: 'relative', width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-surface)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.includes('gradient') ? 'var(--color-brand)' : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {showValue && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size / 4,
          fontWeight: 'var(--weight-semibold)' as React.CSSProperties['fontWeight'],
        }}>
          {Math.round(percent)}%
        </div>
      )}
    </div>
  );
}
