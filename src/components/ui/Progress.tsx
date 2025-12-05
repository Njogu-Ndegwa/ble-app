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

// Variant colors
const VARIANT_COLORS: Record<ProgressVariant, string> = {
  default: 'var(--color-primary, #6366f1)',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gradient: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
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
          marginBottom: '4px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          <span>{label}</span>
          {showLabel && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div 
        style={{
          height: `${height}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  const percent = total > 0 ? (remaining / total) * 100 : 0;
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
      gap: '12px',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '10px',
    }}>
      {/* Icon */}
      {displayIcon && (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: type === 'energy' 
            ? 'rgba(245, 158, 11, 0.2)' 
            : 'rgba(6, 182, 212, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: type === 'energy' ? '#f59e0b' : '#06b6d4',
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
          gap: '4px',
          marginBottom: '6px',
        }}>
          <span style={{ 
            fontSize: '18px', 
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
          }}>
            {remaining}
          </span>
          <span style={{ 
            fontSize: '12px', 
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            {unit}
          </span>
          {monetaryValue !== undefined && monetaryValue > 0 && (
            <span style={{ 
              fontSize: '11px', 
              color: 'rgba(255, 255, 255, 0.4)',
              marginLeft: '4px',
            }}>
              (≈ {monetaryValue.toLocaleString()} {currency})
            </span>
          )}
        </div>
        <ProgressBar 
          value={remaining} 
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
          marginBottom: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round(percent)}% complete</span>
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: index < currentStep 
                ? 'var(--color-primary, #6366f1)'
                : 'rgba(255, 255, 255, 0.1)',
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
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.includes('gradient') ? 'var(--color-primary, #6366f1)' : color}
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
          fontWeight: 600,
        }}>
          {Math.round(percent)}%
        </div>
      )}
    </div>
  );
}
