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
  sm: { padding: '8px 12px', fontSize: '13px' },
  md: { padding: '12px 14px', fontSize: '14px' },
  lg: { padding: '14px 16px', fontSize: '15px' },
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${hasError ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
    borderRadius: '8px',
    color: 'white',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    ...sizeStyle,
    ...(leftIcon && { paddingLeft: '40px' }),
    ...(rightIcon && { paddingRight: '40px' }),
    ...style,
  };

  return (
    <div className={`form-group ${className}`} style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.8)',
        }}>
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.4)',
            width: '18px',
            height: '18px',
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
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.4)',
            width: '18px',
            height: '18px',
          }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <span style={{ 
          display: 'block',
          marginTop: '4px',
          fontSize: '12px',
          color: '#ef4444',
        }}>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span style={{ 
          display: 'block',
          marginTop: '4px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.5)',
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
    <div className={`form-section ${className}`} style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'white',
          marginBottom: '4px',
        }}>
          {title}
        </h3>
        {description && (
          <p style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            margin: 0,
          }}>
            {description}
          </p>
        )}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
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
  gap = 12,
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
        gap: '8px',
        padding: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
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
            gap: '6px',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: value === option.value 
              ? 'var(--color-primary, #6366f1)' 
              : 'transparent',
            color: value === option.value 
              ? 'white' 
              : 'rgba(255, 255, 255, 0.6)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {option.icon && (
            <span style={{ width: '16px', height: '16px' }}>
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
