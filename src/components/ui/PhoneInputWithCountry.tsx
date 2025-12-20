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
 * Styled to match FormInput component for visual consistency.
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
    <div className={`phone-input-wrapper ${className}`} style={{ marginBottom: 'var(--space-2, 8px)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: 'var(--font-sm, 12px)',
          fontWeight: 500,
          color: 'var(--text-secondary, #94b8b8)',
        }}>
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      
      <div 
        className={`phone-input-container ${hasError ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}
        style={{
          position: 'relative',
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          overflow: 'visible',
        }}
      >
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
        <span style={{ 
          display: 'block',
          marginTop: 'var(--space-1, 4px)',
          fontSize: '11px',
          color: 'var(--color-error, #ef4444)',
        }}>
          {error}
        </span>
      )}

      <style jsx global>{`
        /* Main container styling - matches FormInput height and styling */
        .react-international-phone-input-container {
          display: flex !important;
          align-items: center !important;
          height: 40px !important;
          min-height: 40px !important;
          max-height: 40px !important;
          background-color: var(--bg-surface, rgba(255, 255, 255, 0.05)) !important;
          border: 1px solid var(--border-default, #1e2d2d) !important;
          border-radius: var(--radius-md, 8px) !important;
          overflow: visible !important;
          transition: border-color 0.2s ease !important;
          box-sizing: border-box !important;
        }

        .phone-input-container.has-error .react-international-phone-input-container {
          border-color: var(--color-error, #ef4444) !important;
        }

        .react-international-phone-input-container:focus-within {
          border-color: var(--color-brand, #00e5e5) !important;
        }

        /* Country selector button - consistent height with container */
        .react-international-phone-country-selector {
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
        }

        .react-international-phone-country-selector-button {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          padding: 0 8px 0 12px !important;
          height: 100% !important;
          min-height: 38px !important;
          background: transparent !important;
          border: none !important;
          border-right: 1px solid var(--border-default, #1e2d2d) !important;
          cursor: pointer !important;
          min-width: 60px !important;
          box-sizing: border-box !important;
        }

        .react-international-phone-country-selector-button:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }

        .react-international-phone-country-selector-button__button-content {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
        }

        /* Flag emoji - visible and properly sized */
        .react-international-phone-flag-emoji {
          font-size: 18px !important;
          line-height: 1 !important;
          display: inline-block !important;
        }

        /* Dropdown arrow */
        .react-international-phone-country-selector-button__dropdown-arrow {
          border-top-color: var(--text-muted, #5a8080) !important;
          border-width: 4px 4px 0 4px !important;
          margin-left: 2px !important;
        }

        /* Phone input field - matches FormInput styling */
        .react-international-phone-input {
          flex: 1 !important;
          height: 100% !important;
          padding: 0 12px !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          font-size: 12px !important;
          font-family: var(--font-sans, 'Outfit', sans-serif) !important;
          color: var(--text-primary, #f0fafa) !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .react-international-phone-input::placeholder {
          color: var(--text-muted, #5a8080) !important;
        }

        /* Dial code preview styling */
        .react-international-phone-dial-code-preview {
          color: var(--text-secondary, #94b8b8) !important;
          font-size: 12px !important;
          padding-left: 4px !important;
          padding-right: 0 !important;
        }

        /* Country dropdown - must appear above all other content */
        .react-international-phone-country-selector-dropdown {
          position: absolute !important;
          top: calc(100% + 4px) !important;
          left: 0 !important;
          right: auto !important;
          z-index: 9999 !important;
          min-width: 280px !important;
          max-width: 320px !important;
          background-color: var(--bg-elevated, #1a2424) !important;
          border: 1px solid var(--border-default, #1e2d2d) !important;
          border-radius: var(--radius-md, 8px) !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
          max-height: 300px !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }

        /* Ensure country selector is interactive */
        .react-international-phone-country-selector {
          position: relative !important;
          z-index: 1 !important;
        }

        /* Search input in dropdown */
        .react-international-phone-country-selector-dropdown__search-input-container {
          padding: 8px 12px !important;
          border-bottom: 1px solid var(--border-default, #1e2d2d) !important;
        }

        .react-international-phone-country-selector-dropdown__search-input {
          width: 100% !important;
          height: 36px !important;
          padding: 0 12px !important;
          background-color: var(--bg-surface, rgba(255, 255, 255, 0.05)) !important;
          border: 1px solid var(--border-default, #1e2d2d) !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-family: var(--font-sans, 'Outfit', sans-serif) !important;
          color: var(--text-primary, #f0fafa) !important;
          outline: none !important;
          box-sizing: border-box !important;
        }

        .react-international-phone-country-selector-dropdown__search-input:focus {
          border-color: var(--color-brand, #00e5e5) !important;
        }

        .react-international-phone-country-selector-dropdown__search-input::placeholder {
          color: var(--text-muted, #5a8080) !important;
        }

        /* Country list */
        .react-international-phone-country-selector-dropdown__list {
          flex: 1 !important;
          overflow-y: auto !important;
          padding: 4px 0 !important;
          -webkit-overflow-scrolling: touch !important;
          margin: 0 !important;
          list-style: none !important;
        }

        /* Country list item */
        .react-international-phone-country-selector-dropdown__list-item {
          display: flex !important;
          align-items: center !important;
          padding: 10px 16px !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease !important;
          gap: 10px !important;
        }

        .react-international-phone-country-selector-dropdown__list-item:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item--selected,
        .react-international-phone-country-selector-dropdown__list-item--focused {
          background-color: rgba(0, 229, 229, 0.1) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-flag-emoji {
          font-size: 20px !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-country-name {
          flex: 1 !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          color: var(--text-primary, #f0fafa) !important;
        }

        .react-international-phone-country-selector-dropdown__list-item-dial-code {
          font-size: 13px !important;
          color: var(--text-secondary, #94b8b8) !important;
        }

        /* Preferred countries divider */
        .react-international-phone-country-selector-dropdown__preferred-list-divider {
          height: 1px !important;
          background-color: var(--border-default, #1e2d2d) !important;
          margin: 4px 0 !important;
          border: none !important;
        }

        /* No results */
        .react-international-phone-country-selector-dropdown__list-item--no-results {
          padding: 20px !important;
          text-align: center !important;
          color: var(--text-muted, #5a8080) !important;
          font-size: 14px !important;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .react-international-phone-input-container {
            height: 44px !important;
            min-height: 44px !important;
            max-height: 44px !important;
          }

          .react-international-phone-country-selector-button {
            padding: 0 10px 0 14px !important;
            min-height: 42px !important;
          }

          .react-international-phone-input {
            padding: 0 14px !important;
            font-size: 16px !important; /* Prevents zoom on iOS */
          }

          .react-international-phone-flag-emoji {
            font-size: 20px !important;
          }

          .react-international-phone-dial-code-preview {
            font-size: 14px !important;
          }

          .react-international-phone-country-selector-dropdown {
            max-height: 60vh !important;
            min-width: 260px !important;
          }

          .react-international-phone-country-selector-dropdown__list-item {
            padding: 12px 16px !important;
          }

          .react-international-phone-country-selector-dropdown__list-item-flag-emoji {
            font-size: 24px !important;
          }

          .react-international-phone-country-selector-dropdown__list-item-country-name {
            font-size: 15px !important;
          }

          .react-international-phone-country-selector-dropdown__search-input {
            height: 40px !important;
            font-size: 16px !important;
          }
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
