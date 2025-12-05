'use client';

import React from 'react';
import { LoaderIcon } from './Icons';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size */
  size?: ButtonSize;
  /** Full width */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
}

// Variant styles
const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: 'white',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  success: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
  },
  warning: {
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
  },
  danger: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.8)',
    border: 'none',
  },
};

// Size styles
const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '13px', gap: '6px' },
  md: { padding: '12px 20px', fontSize: '14px', gap: '8px' },
  lg: { padding: '14px 24px', fontSize: '15px', gap: '10px' },
};

/**
 * Button - Styled button component
 * 
 * @example
 * <Button variant="primary">Click me</Button>
 * <Button variant="secondary" leftIcon={<ArrowLeftIcon />}>Back</Button>
 * <Button loading loadingText="Saving...">Save</Button>
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: isDisabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    ...variantStyle,
    ...sizeStyle,
    ...style,
  };

  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      style={baseStyles}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <LoaderIcon size={16} />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {leftIcon && (
            <span style={{ width: '16px', height: '16px', display: 'flex' }}>
              {leftIcon}
            </span>
          )}
          <span>{children}</span>
          {rightIcon && (
            <span style={{ width: '16px', height: '16px', display: 'flex' }}>
              {rightIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ============================================
// ICON BUTTON
// ============================================

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon */
  icon: React.ReactNode;
  /** Aria label */
  'aria-label': string;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
}

const ICON_SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { width: '32px', height: '32px' },
  md: { width: '40px', height: '40px' },
  lg: { width: '48px', height: '48px' },
};

/**
 * IconButton - Button with just an icon
 */
export function IconButton({
  icon,
  'aria-label': ariaLabel,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  style,
  ...props
}: IconButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = ICON_SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <button
      className={`icon-btn ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '10px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: isDisabled ? 0.6 : 1,
        padding: 0,
        ...variantStyle,
        ...sizeStyle,
        ...style,
      }}
      disabled={isDisabled}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? <LoaderIcon size={20} /> : icon}
    </button>
  );
}

// ============================================
// BUTTON GROUP
// ============================================

interface ButtonGroupProps {
  /** Children (Button components) */
  children: React.ReactNode;
  /** Direction */
  direction?: 'row' | 'column';
  /** Gap between buttons */
  gap?: number;
  /** Full width for all buttons */
  fullWidth?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * ButtonGroup - Group buttons together
 */
export function ButtonGroup({
  children,
  direction = 'row',
  gap = 8,
  fullWidth = false,
  className = '',
}: ButtonGroupProps) {
  return (
    <div 
      className={`button-group ${className}`}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `${gap}px`,
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && fullWidth) {
          return React.cloneElement(child as React.ReactElement<ButtonProps>, {
            fullWidth: true,
          });
        }
        return child;
      })}
    </div>
  );
}
