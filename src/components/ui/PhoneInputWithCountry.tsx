'use client';

import React, { useCallback, useMemo } from 'react';
import { 
  PhoneInput, 
  defaultCountries,
  parseCountry,
  type CountryIso2,
  type ParsedCountry,
} from 'react-international-phone';
import 'react-international-phone/style.css';

interface PhoneInputWithCountryProps {
  /** Current phone value (can be E.164 format or just digits) */
  value: string;
  /** Callback when phone changes - receives the phone number without + prefix */
  onChange: (value: string) => void;
  /** Label for the input */
  label?: string;
  /** Error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Initial country ISO code (e.g., 'ke' for Kenya) - lowercase */
  defaultCountry?: CountryIso2;
  /** Current locale for default country detection */
  locale?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom className for the container */
  className?: string;
}

// Map locale to default country (lowercase ISO2 codes)
const LOCALE_TO_COUNTRY: Record<string, CountryIso2> = {
  'en': 'ke', // Kenya
  'fr': 'tg', // Togo
  'zh': 'cn', // China
};

// Preferred countries to show at top of the dropdown
const PREFERRED_COUNTRIES: CountryIso2[] = [
  'ke', // Kenya
  'tg', // Togo
  'cn', // China
  'ng', // Nigeria
  'ug', // Uganda
  'tz', // Tanzania
  'rw', // Rwanda
  'gh', // Ghana
  'za', // South Africa
  'in', // India
];

/**
 * PhoneInputWithCountry - Mobile-friendly phone input with country code selector
 * 
 * Uses react-international-phone library for robust international phone support.
 * 
 * Features:
 * - Searchable country dropdown with flags
 * - Phone number formatting and validation per country
 * - Auto-detects country from locale or existing phone number
 * - Mobile-friendly design
 * - E.164 format output
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
  const defaultCountryCode = useMemo((): CountryIso2 => {
    if (defaultCountry) return defaultCountry;
    if (locale && LOCALE_TO_COUNTRY[locale.toLowerCase()]) {
      return LOCALE_TO_COUNTRY[locale.toLowerCase()];
    }
    return 'ke'; // Default to Kenya
  }, [defaultCountry, locale]);

  // Handle phone change - convert to format backend expects
  const handleChange = useCallback((
    phone: string,
    meta: { country: ParsedCountry; inputValue: string }
  ) => {
    // The library returns E.164 format with + prefix
    // Remove the + prefix for backend compatibility (e.g., "+254712345678" -> "254712345678")
    const valueWithoutPlus = phone.startsWith('+') ? phone.slice(1) : phone;
    onChange(valueWithoutPlus);
  }, [onChange]);

  // Convert value to E.164 format for the library (add + if needed)
  const displayValue = useMemo(() => {
    if (!value) return '';
    // If already has +, use as is
    if (value.startsWith('+')) return value;
    // Add + for the library
    return `+${value}`;
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
          defaultCountry={defaultCountryCode}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || 'Enter phone number'}
          preferredCountries={PREFERRED_COUNTRIES}
          forceDialCode
          inputClassName="phone-input-field"
          countrySelectorStyleProps={{
            buttonClassName: 'phone-country-button',
            dropdownStyleProps: {
              className: 'phone-country-dropdown',
              listItemClassName: 'phone-country-item',
              listItemFlagClassName: 'phone-country-flag',
              listItemCountryNameClassName: 'phone-country-name',
              listItemDialCodeClassName: 'phone-country-dialcode',
            },
          }}
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
        }

        .phone-input-container.has-error .react-international-phone-input-container {
          border-color: var(--color-error, #ef4444) !important;
        }

        .phone-input-container.is-disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .phone-input-error-text {
          display: block;
          margin-top: var(--space-1, 4px);
          font-size: 12px;
          color: var(--color-error, #ef4444);
        }

        /* Main container styling */
        .react-international-phone-input-container {
          display: flex;
          align-items: center;
          background-color: var(--bg-surface, #1a1a2e) !important;
          border: 1px solid var(--border-default, #2d2d44) !important;
          border-radius: var(--radius-md, 8px) !important;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .react-international-phone-input-container:focus-within {
          border-color: var(--color-brand, #00e5e5) !important;
        }

        /* Country selector button */
        .react-international-phone-country-selector-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 8px 10px 12px !important;
          background: transparent !important;
          border: none !important;
          border-right: 1px solid var(--border-default, #2d2d44) !important;
          cursor: pointer;
          min-width: auto !important;
          height: auto !important;
        }

        .react-international-phone-country-selector-button:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }

        .react-international-phone-country-selector-button__button-content {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Flag in button */
        .react-international-phone-flag-emoji {
          font-size: 20px !important;
          line-height: 1;
        }

        /* Dropdown arrow */
        .react-international-phone-country-selector-button__dropdown-arrow {
          border-top-color: var(--text-muted, #6b7280) !important;
          margin-left: 4px;
        }

        /* Phone input field */
        .react-international-phone-input {
          flex: 1;
          padding: 10px 12px !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          font-size: 14px !important;
          font-family: var(--font-sans) !important;
          color: var(--text-primary, #ffffff) !important;
          min-width: 0;
          height: auto !important;
        }

        .react-international-phone-input::placeholder {
          color: var(--text-muted, #6b7280) !important;
        }

        /* Country dropdown */
        .react-international-phone-country-selector-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          margin-top: 4px;
          background-color: var(--bg-primary, #0d0d1a) !important;
          border: 1px solid var(--border-default, #2d2d44) !important;
          border-radius: var(--radius-md, 8px) !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
          max-height: 300px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Search input in dropdown */
        .react-international-phone-country-selector-dropdown__search-input-container {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-default, #2d2d44);
        }

        .react-international-phone-country-selector-dropdown__search-input {
          width: 100%;
          padding: 10px 12px !important;
          background-color: var(--bg-surface, #1a1a2e) !important;
          border: 1px solid var(--border-default, #2d2d44) !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-family: var(--font-sans) !important;
          color: var(--text-primary, #ffffff) !important;
          outline: none !important;
        }

        .react-international-phone-country-selector-dropdown__search-input:focus {
          border-color: var(--color-brand, #00e5e5) !important;
        }

        .react-international-phone-country-selector-dropdown__search-input::placeholder {
          color: var(--text-muted, #6b7280) !important;
        }

        /* Country list */
        .react-international-phone-country-selector-dropdown__list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
          -webkit-overflow-scrolling: touch;
        }

        /* Country list item */
        .react-international-phone-country-selector-dropdown__list-item {
          display: flex;
          align-items: center;
          padding: 12px 16px !important;
          cursor: pointer;
          transition: background-color 0.15s ease;
          gap: 12px;
        }

        .react-international-phone-country-selector-dropdown__list-item:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item--selected,
        .react-international-phone-country-selector-dropdown__list-item--focused {
          background-color: rgba(0, 229, 229, 0.1) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-flag-emoji {
          font-size: 22px !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-country-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #ffffff) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-dial-code {
          font-size: 13px;
          color: var(--text-secondary, #a0aec0) !important;
        }

        /* Preferred countries divider */
        .react-international-phone-country-selector-dropdown__preferred-list-divider {
          height: 1px;
          background-color: var(--border-default, #2d2d44) !important;
          margin: 4px 0;
        }

        /* No results */
        .react-international-phone-country-selector-dropdown__list-item--no-results {
          padding: 20px !important;
          text-align: center;
          color: var(--text-muted, #6b7280) !important;
          font-size: 14px;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .react-international-phone-country-selector-button {
            padding: 12px 10px 12px 14px !important;
          }

          .react-international-phone-input {
            padding: 12px 14px !important;
            font-size: 16px !important; /* Prevents zoom on iOS */
          }

          .react-international-phone-flag-emoji {
            font-size: 24px !important;
          }

          .react-international-phone-country-selector-dropdown {
            max-height: 60vh;
          }

          .react-international-phone-country-selector-dropdown__list-item {
            padding: 14px 16px !important;
          }

          .react-international-phone-country-selector-dropdown__list-item-flag-emoji {
            font-size: 26px !important;
          }

          .react-international-phone-country-selector-dropdown__list-item-country-name {
            font-size: 15px;
          }

          .react-international-phone-country-selector-dropdown__search-input {
            padding: 12px 14px !important;
            font-size: 16px !important;
          }
        }

        /* Dial code preview (shown with the input) */
        .react-international-phone-dial-code-preview {
          color: var(--text-secondary, #a0aec0) !important;
          font-size: 14px;
          padding-left: 8px;
        }
      `}</style>
    </div>
  );
}

// Re-export useful types and utilities from the library
export { 
  parseCountry,
  defaultCountries,
  type CountryIso2,
  type ParsedCountry,
};
