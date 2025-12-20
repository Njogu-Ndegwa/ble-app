'use client';

import React, { useCallback, useMemo } from 'react';
import PhoneInput, { 
  type Country, 
  type Value,
  getCountryCallingCode,
  parsePhoneNumber as parsePhoneNumberLib,
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface PhoneInputWithCountryProps {
  /** Current phone value in E.164 format (e.g., "+254712345678") */
  value: string;
  /** Callback when phone changes - receives the full E.164 phone number */
  onChange: (value: string) => void;
  /** Label for the input */
  label?: string;
  /** Error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Initial country ISO code (e.g., 'KE') */
  defaultCountry?: Country;
  /** Current locale for default country detection */
  locale?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom className for the container */
  className?: string;
}

// Map locale to default country
const LOCALE_TO_COUNTRY: Record<string, Country> = {
  'en': 'KE',
  'fr': 'TG',
  'zh': 'CN',
};

/**
 * PhoneInputWithCountry - Mobile-friendly phone input with country code selector
 * 
 * Uses react-phone-number-input library for robust international phone support.
 * Features:
 * - Country flag and dial code selector
 * - Mobile-friendly dropdown for country selection
 * - Phone number formatting and validation
 * - Auto-detects country from locale or existing phone number
 * 
 * @example
 * <PhoneInputWithCountry
 *   value={phone}
 *   onChange={setPhone}
 *   label="Phone Number"
 *   locale="en"
 * />
 */
export default function PhoneInputWithCountry({
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
  defaultCountry,
  locale,
  placeholder,
  className = '',
}: PhoneInputWithCountryProps) {
  // Determine default country from props or locale
  const defaultCountryCode = useMemo((): Country => {
    if (defaultCountry) return defaultCountry;
    if (locale && LOCALE_TO_COUNTRY[locale.toLowerCase()]) {
      return LOCALE_TO_COUNTRY[locale.toLowerCase()];
    }
    return 'KE'; // Default to Kenya
  }, [defaultCountry, locale]);

  // Handle phone change - convert to format backend expects
  const handleChange = useCallback((newValue: Value) => {
    // react-phone-number-input returns undefined when empty, or E.164 format
    // Convert to string without + prefix for backend compatibility
    if (!newValue) {
      onChange('');
      return;
    }
    
    // Remove the + prefix for backend (e.g., "+254712345678" -> "254712345678")
    const valueWithoutPlus = newValue.startsWith('+') ? newValue.slice(1) : newValue;
    onChange(valueWithoutPlus);
  }, [onChange]);

  // Convert value to E.164 format for the library (add + if needed)
  const displayValue = useMemo(() => {
    if (!value) return undefined;
    // If already has +, use as is
    if (value.startsWith('+')) return value as Value;
    // Add + for the library
    return `+${value}` as Value;
  }, [value]);

  const hasError = !!error;

  return (
    <div className={`phone-input-wrapper ${className}`}>
      {label && (
        <label className="phone-input-label">
          {label}
          {required && <span className="phone-input-required">*</span>}
        </label>
      )}
      
      <div className={`phone-input-container ${hasError ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <PhoneInput
          international
          countryCallingCodeEditable={false}
          defaultCountry={defaultCountryCode}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || 'Enter phone number'}
          className="phone-input-field"
        />
      </div>
      
      {error && (
        <span className="phone-input-error-text">{error}</span>
      )}

      <style jsx global>{`
        /* Container wrapper */
        .phone-input-wrapper {
          margin-bottom: var(--space-2, 8px);
        }

        .phone-input-label {
          display: block;
          margin-bottom: 4px;
          font-size: var(--font-sm, 12px);
          font-weight: 500;
          color: var(--text-secondary, #a0aec0);
        }

        .phone-input-required {
          color: #ef4444;
          margin-left: 2px;
        }

        .phone-input-container {
          position: relative;
          background-color: var(--bg-surface, #1a1a2e);
          border: 1px solid var(--border-default, #2d2d44);
          border-radius: var(--radius-md, 8px);
          transition: border-color 0.2s ease;
          overflow: hidden;
        }

        .phone-input-container:focus-within {
          border-color: var(--color-brand, #00e5e5);
        }

        .phone-input-container.has-error {
          border-color: var(--color-error, #ef4444);
        }

        .phone-input-container.is-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .phone-input-error-text {
          display: block;
          margin-top: var(--space-1, 4px);
          font-size: 12px;
          color: var(--color-error, #ef4444);
        }

        /* Override react-phone-number-input styles for dark theme */
        .phone-input-field.PhoneInput {
          display: flex;
          align-items: center;
          background: transparent;
        }

        .phone-input-field .PhoneInputCountry {
          display: flex;
          align-items: center;
          padding: 10px 8px 10px 12px;
          margin-right: 0;
          background: transparent;
          border-right: 1px solid var(--border-default, #2d2d44);
        }

        .phone-input-field .PhoneInputCountryIcon {
          width: 24px;
          height: 18px;
          box-shadow: none;
          border-radius: 2px;
          overflow: hidden;
        }

        .phone-input-field .PhoneInputCountryIcon--border {
          box-shadow: none;
          background: transparent;
        }

        .phone-input-field .PhoneInputCountrySelectArrow {
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid var(--text-muted, #6b7280);
          margin-left: 6px;
          opacity: 1;
        }

        .phone-input-field .PhoneInputCountrySelect {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          z-index: 1;
          border: 0;
          opacity: 0;
          cursor: pointer;
        }

        .phone-input-field .PhoneInputCountrySelect:focus + .PhoneInputCountryIcon--border {
          box-shadow: none;
        }

        .phone-input-field .PhoneInputCountrySelect option {
          background-color: var(--bg-primary, #0d0d1a);
          color: var(--text-primary, #ffffff);
        }

        .phone-input-field .PhoneInputInput {
          flex: 1;
          padding: 10px 12px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          font-family: var(--font-sans);
          color: var(--text-primary, #ffffff);
          min-width: 0;
        }

        .phone-input-field .PhoneInputInput::placeholder {
          color: var(--text-muted, #6b7280);
        }

        .phone-input-field .PhoneInputInput:disabled {
          cursor: not-allowed;
        }

        /* Country select dropdown - ensure it's readable */
        .phone-input-field .PhoneInputCountrySelect:focus {
          outline: none;
        }

        /* For mobile devices - increase touch targets */
        @media (max-width: 640px) {
          .phone-input-field .PhoneInputCountry {
            padding: 12px 10px 12px 14px;
          }

          .phone-input-field .PhoneInputInput {
            padding: 12px 14px;
            font-size: 16px; /* Prevents zoom on iOS */
          }

          .phone-input-field .PhoneInputCountryIcon {
            width: 28px;
            height: 21px;
          }
        }
      `}</style>
    </div>
  );
}

// Re-export useful types and utilities from the library
export { 
  getCountryCallingCode,
  parsePhoneNumberLib as parsePhoneNumber,
  type Country,
  type Value as PhoneValue,
};
