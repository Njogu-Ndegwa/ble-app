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

// Variant styles using CSS variables
const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-brand)',
    color: 'var(--text-inverse)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  success: {
    backgroundColor: 'var(--color-success)',
    color: 'white',
    border: 'none',
  },
  warning: {
    backgroundColor: 'var(--color-warning)',
    color: 'white',
    border: 'none',
  },
  danger: {
    backgroundColor: 'var(--color-error)',
    color: 'white',
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

// Size styles using CSS variables
const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { 
    height: 'var(--btn-height-sm)',
    padding: '0 var(--space-3)', 
    fontSize: 'var(--font-sm)', 
    gap: 'var(--space-1-5)' 
  },
  md: { 
    height: 'var(--btn-height-md)',
    padding: '0 var(--space-4)', 
    fontSize: 'var(--font-base)', 
    gap: 'var(--space-2)' 
  },
  lg: { 
    height: 'var(--btn-height-lg)',
    padding: '0 var(--space-6)', 
    fontSize: 'var(--font-md)', 
    gap: 'var(--space-2-5)' 
  },
};

/**
 * Button - Styled button component
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
    borderRadius: 'var(--radius-lg)',
    fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
    fontFamily: 'var(--font-sans)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'var(--transition-fast)',
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
            <span style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)', display: 'flex' }}>
              {leftIcon}
            </span>
          )}
          <span>{children}</span>
          {rightIcon && (
            <span style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)', display: 'flex' }}>
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
  sm: { width: 'var(--btn-height-sm)', height: 'var(--btn-height-sm)' },
  md: { width: 'var(--btn-height-md)', height: 'var(--btn-height-md)' },
  lg: { width: 'var(--btn-height-lg)', height: 'var(--btn-height-lg)' },
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
        borderRadius: 'var(--radius-lg)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition-fast)',
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
