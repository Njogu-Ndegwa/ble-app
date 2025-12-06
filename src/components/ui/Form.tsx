'use client';

import React from 'react';

// ============================================
// FORM INPUT
// ============================================

export type InputType = 'text' | 'email' | 'tel' | 'password' | 'number' | 'search';
export type InputSize = 'sm' | 'md' | 'lg';

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required indicator */
  required?: boolean;
  /** Size variant */
  size?: InputSize;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
}

const SIZE_STYLES: Record<InputSize, React.CSSProperties> = {
  sm: { height: '36px', padding: '8px 10px', fontSize: '12px' },
  md: { height: '40px', padding: '10px 12px', fontSize: '12px' },
  lg: { height: '48px', padding: '12px 14px', fontSize: '14px' },
};

/**
 * FormInput - Styled input field with label and error state
 */
export function FormInput({
  label,
  error,
  helperText,
  required = false,
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  style,
  ...props
}: FormInputProps) {
  const sizeStyle = SIZE_STYLES[size];
  const hasError = !!error;

  const inputStyles: React.CSSProperties = {
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: 'var(--bg-surface)',
    border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-sans)',
    ...sizeStyle,
    ...(leftIcon && { paddingLeft: 'var(--space-10)' }),
    ...(rightIcon && { paddingRight: 'var(--space-10)' }),
    ...style,
  };

  return (
    <div className={`form-group ${className}`} style={{ marginBottom: 'var(--space-2)' }}>
      {label && (
        <label className="text-label" style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: 'var(--font-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            width: 'var(--icon-md)',
            height: 'var(--icon-md)',
          }}>
            {leftIcon}
          </div>
        )}
        <input
          className={`form-input ${hasError ? 'form-input-error' : ''}`}
          style={inputStyles}
          {...props}
        />
        {rightIcon && (
          <div style={{
            position: 'absolute',
            right: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            width: 'var(--icon-md)',
            height: 'var(--icon-md)',
          }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--color-error)',
        }}>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--text-muted)',
        }}>
          {helperText}
        </span>
      )}
    </div>
  );
}

// ============================================
// FORM GROUP
// ============================================

interface FormGroupProps {
  /** Children */
  children: React.ReactNode;
  /** Layout direction */
  direction?: 'row' | 'column';
  /** Gap between items */
  gap?: number;
  /** Custom className */
  className?: string;
}

/**
 * FormGroup - Group form fields together
 */
export function FormGroup({
  children,
  direction = 'column',
  gap = 16,
  className = '',
}: FormGroupProps) {
  return (
    <div 
      className={`form-group-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// FORM SECTION
// ============================================

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Children */
  children: React.ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * FormSection - Section with title for grouping related fields
 */
export function FormSection({
  title,
  description,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`form-section ${className}`} style={{ marginBottom: '16px' }}>
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ 
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '4px',
          color: 'var(--text-secondary)',
        }}>{title}</h3>
        {description && (
          <p className="text-caption text-muted" style={{ margin: 0 }}>{description}</p>
        )}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// FORM ROW
// ============================================

interface FormRowProps {
  /** Children */
  children: React.ReactNode;
  /** Number of columns */
  columns?: 2 | 3 | 4;
  /** Gap between items */
  gap?: number;
  /** Custom className */
  className?: string;
}

/**
 * FormRow - Horizontal row of form fields
 */
export function FormRow({
  children,
  columns = 2,
  gap = 8,
  className = '',
}: FormRowProps) {
  return (
    <div 
      className={`form-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// TOGGLE GROUP
// ============================================

interface ToggleOption<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupProps<T> {
  /** Options */
  options: ToggleOption<T>[];
  /** Selected value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * ToggleGroup - Toggle between options (like scan/manual)
 */
export function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: ToggleGroupProps<T>) {
  return (
    <div 
      className={`toggle-group ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-1)',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1-5)',
            padding: 'var(--space-2-5) var(--space-4)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-sm)',
            fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: value === option.value ? 'var(--color-brand)' : 'transparent',
            color: value === option.value ? 'var(--text-inverse)' : 'var(--text-muted)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {option.icon && (
            <span style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }}>
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
