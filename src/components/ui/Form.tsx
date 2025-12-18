'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// ============================================
// FORM INPUT
// ============================================

export type InputType = 'text' | 'email' | 'tel' | 'password' | 'number' | 'search';
export type InputSize = 'sm' | 'md' | 'lg';

// Country code data for phone input
export interface CountryCodeOption {
  code: string;       // ISO country code (e.g., 'KE')
  dialCode: string;   // Dial code with + (e.g., '+254')
  name: string;       // Country name
  flag: string;       // Flag emoji
  placeholder: string; // Phone number placeholder without country code
}

// Supported countries - Kenya, Togo, China
export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪', placeholder: '7XX XXX XXX' },
  { code: 'TG', dialCode: '+228', name: 'Togo', flag: '🇹🇬', placeholder: 'XX XX XX XX' },
  { code: 'CN', dialCode: '+86', name: 'China', flag: '🇨🇳', placeholder: '1XX XXXX XXXX' },
];

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
// PHONE INPUT WITH COUNTRY CODE
// ============================================

interface PhoneInputWithCountryCodeProps {
  /** Input label */
  label?: string;
  /** The full phone number value including country code (e.g., '+254712345678') */
  value: string;
  /** Change handler - receives the full phone number with country code */
  onChange: (value: string) => void;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required indicator */
  required?: boolean;
  /** Size variant */
  size?: InputSize;
  /** Default country code (e.g., 'KE') */
  defaultCountry?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * PhoneInputWithCountryCode - Phone input with country code selector
 * 
 * Allows selecting country code from a dropdown and entering the phone number.
 * Value is stored as full phone number with country code (e.g., '+254712345678').
 */
export function PhoneInputWithCountryCode({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  size = 'md',
  defaultCountry = 'KE',
  disabled = false,
  className = '',
}: PhoneInputWithCountryCodeProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Parse the current value to extract country code and local number
  const parsePhoneValue = (phone: string): { countryCode: string; localNumber: string } => {
    if (!phone) {
      return { countryCode: defaultCountry, localNumber: '' };
    }
    
    // Find matching country by dial code
    for (const country of COUNTRY_CODES) {
      if (phone.startsWith(country.dialCode)) {
        return {
          countryCode: country.code,
          localNumber: phone.slice(country.dialCode.length),
        };
      }
      // Also check without + prefix
      const dialCodeWithoutPlus = country.dialCode.replace('+', '');
      if (phone.startsWith(dialCodeWithoutPlus)) {
        return {
          countryCode: country.code,
          localNumber: phone.slice(dialCodeWithoutPlus.length),
        };
      }
    }
    
    // Default to provided defaultCountry if no match
    return { countryCode: defaultCountry, localNumber: phone.replace(/^\+/, '') };
  };
  
  const { countryCode, localNumber } = parsePhoneValue(value);
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];
  
  // Handle country code selection
  const handleCountrySelect = (country: CountryCodeOption) => {
    setIsDropdownOpen(false);
    // Rebuild the full phone number with new country code
    onChange(`${country.dialCode}${localNumber}`);
  };
  
  // Handle local number input
  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocalNumber = e.target.value.replace(/[^0-9]/g, ''); // Only allow digits
    onChange(`${selectedCountry.dialCode}${newLocalNumber}`);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);
  
  const sizeStyle = SIZE_STYLES[size];
  const hasError = !!error;
  
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
      
      <div style={{ display: 'flex', gap: '4px', position: 'relative' }} ref={dropdownRef}>
        {/* Country Code Selector */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minWidth: '90px',
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'var(--transition-fast)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            ...sizeStyle,
            padding: '0 8px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: '16px' }}>{selectedCountry.flag}</span>
          <span style={{ fontWeight: 500 }}>{selectedCountry.dialCode}</span>
          <ChevronDown size={14} style={{ 
            marginLeft: 'auto', 
            transition: 'transform 0.2s',
            transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>
        
        {/* Country Dropdown */}
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 100,
            minWidth: '180px',
            overflow: 'hidden',
          }}>
            {COUNTRY_CODES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountrySelect(country)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: country.code === selectedCountry.code 
                    ? 'var(--bg-active)' 
                    : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (country.code !== selectedCountry.code) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 
                    country.code === selectedCountry.code ? 'var(--bg-active)' : 'transparent';
                }}
              >
                <span style={{ fontSize: '18px' }}>{country.flag}</span>
                <span style={{ flex: 1 }}>{country.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{country.dialCode}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Phone Number Input */}
        <input
          type="tel"
          value={localNumber}
          onChange={handleLocalNumberChange}
          placeholder={selectedCountry.placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'var(--transition-fast)',
            fontFamily: 'var(--font-sans)',
            ...sizeStyle,
            opacity: disabled ? 0.5 : 1,
          }}
        />
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
