'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { 
  defaultCountries,
  parseCountry,
  usePhoneInput,
  FlagImage,
  type CountryIso2,
  type ParsedCountry,
  type CountryData,
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
  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Determine default country from props or locale
  const defaultCountryCode = useMemo((): CountryIso2 => {
    if (defaultCountry) return defaultCountry;
    if (locale && LOCALE_TO_COUNTRY[locale.toLowerCase()]) {
      return LOCALE_TO_COUNTRY[locale.toLowerCase()];
    }
    return 'ke'; // Default to Kenya
  }, [defaultCountry, locale]);

  // Convert value to E.164 format for the library (add + if needed)
  const displayValue = useMemo(() => {
    if (!value) return '';
    if (value.startsWith('+')) return value;
    return `+${value}`;
  }, [value]);

  // Use the phone input hook
  const {
    inputValue,
    handlePhoneValueChange,
    inputRef,
    country,
    setCountry,
  } = usePhoneInput({
    defaultCountry: defaultCountryCode,
    value: displayValue,
    countries: defaultCountries,
    forceDialCode: true,
    onChange: (data) => {
      // Remove the + prefix for backend compatibility
      const valueWithoutPlus = data.phone.startsWith('+') ? data.phone.slice(1) : data.phone;
      onChange(valueWithoutPlus);
    },
  });

  // Get sorted countries with preferred ones at top
  const sortedCountries = useMemo(() => {
    const preferred: CountryData[] = [];
    const others: CountryData[] = [];
    
    for (const countryData of defaultCountries) {
      const parsed = parseCountry(countryData);
      if (PREFERRED_COUNTRIES.includes(parsed.iso2)) {
        preferred.push(countryData);
      } else {
        others.push(countryData);
      }
    }
    
    // Sort preferred by the order in PREFERRED_COUNTRIES
    preferred.sort((a, b) => {
      const aIndex = PREFERRED_COUNTRIES.indexOf(parseCountry(a).iso2);
      const bIndex = PREFERRED_COUNTRIES.indexOf(parseCountry(b).iso2);
      return aIndex - bIndex;
    });
    
    return { preferred, others, all: [...preferred, ...others] };
  }, []);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedCountries.all;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return sortedCountries.all.filter(countryData => {
      const parsed = parseCountry(countryData);
      return (
        parsed.name.toLowerCase().includes(query) ||
        parsed.iso2.toLowerCase().includes(query) ||
        parsed.dialCode.includes(query)
      );
    });
  }, [searchQuery, sortedCountries]);

  // Find the divider index (end of preferred countries in filtered list)
  const preferredEndIndex = useMemo(() => {
    if (searchQuery.trim()) return -1; // No divider when searching
    return sortedCountries.preferred.length - 1;
  }, [searchQuery, sortedCountries.preferred.length]);

  // Handle country selection
  const handleCountrySelect = useCallback((countryData: CountryData) => {
    const parsed = parseCountry(countryData);
    setCountry(parsed.iso2);
    setIsDropdownOpen(false);
    setSearchQuery('');
    setFocusedIndex(0);
    // Focus the phone input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [setCountry, inputRef]);

  // Handle dropdown toggle
  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsDropdownOpen(prev => {
      if (!prev) {
        setSearchQuery('');
        setFocusedIndex(0);
        // Focus search input when opening
        setTimeout(() => searchInputRef.current?.focus(), 10);
      }
      return !prev;
    });
  }, [disabled]);

  // Handle keyboard navigation in dropdown
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredCountries.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCountries[focusedIndex]) {
          handleCountrySelect(filteredCountries[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSearchQuery('');
        break;
    }
  }, [filteredCountries, focusedIndex, handleCountrySelect]);

  // Scroll focused item into view
  useEffect(() => {
    if (isDropdownOpen && listRef.current) {
      const focusedElement = listRef.current.querySelector(`[data-index="${focusedIndex}"]`);
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isDropdownOpen]);

  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const hasError = !!error;

  return (
    <div 
      ref={containerRef}
      className={`phone-input-wrapper ${className}`} 
      style={{ marginBottom: 'var(--space-2, 8px)' }}
    >
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
        }}
      >
        {/* Main input container */}
        <div className="phone-input-row">
          {/* Country selector button */}
          <button
            type="button"
            className="country-selector-btn"
            onClick={toggleDropdown}
            disabled={disabled}
            aria-label="Select country"
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
          >
            <FlagImage iso2={country.iso2} size="18px" />
            <span className="dial-code">+{country.dialCode}</span>
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {/* Phone number input */}
          <input
            ref={inputRef}
            type="tel"
            className="phone-number-input"
            value={inputValue}
            onChange={handlePhoneValueChange}
            placeholder={placeholder || 'Enter phone number'}
            disabled={disabled}
          />
        </div>

        {/* Country dropdown */}
        {isDropdownOpen && (
          <div 
            ref={dropdownRef}
            className="country-dropdown"
            onKeyDown={handleDropdownKeyDown}
          >
            {/* Search input */}
            <div className="dropdown-search-container">
              <input
                ref={searchInputRef}
                type="text"
                className="dropdown-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleDropdownKeyDown}
                placeholder="Search country..."
                autoComplete="off"
              />
            </div>

            {/* Country list */}
            <ul ref={listRef} className="country-list" role="listbox">
              {filteredCountries.length === 0 ? (
                <li className="country-item no-results">No countries found</li>
              ) : (
                filteredCountries.map((countryData, index) => {
                  const parsed = parseCountry(countryData);
                  const isSelected = parsed.iso2 === country.iso2;
                  const isFocused = index === focusedIndex;
                  const showDivider = index === preferredEndIndex && preferredEndIndex >= 0;

                  return (
                    <React.Fragment key={parsed.iso2}>
                      <li
                        data-index={index}
                        className={`country-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                        onClick={() => handleCountrySelect(countryData)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <FlagImage iso2={parsed.iso2} size="18px" className="country-flag" />
                        <span className="country-name">{parsed.name}</span>
                        <span className="country-dial-code">+{parsed.dialCode}</span>
                      </li>
                      {showDivider && <li className="country-divider" aria-hidden="true" />}
                    </React.Fragment>
                  );
                })
              )}
            </ul>
          </div>
        )}
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
        /* Main input row - contains country selector and phone input */
        .phone-input-row {
          display: flex;
          align-items: center;
          height: 40px;
          background-color: var(--bg-surface, rgba(255, 255, 255, 0.05));
          border: 1px solid var(--border-default, #1e2d2d);
          border-radius: var(--radius-md, 8px);
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .phone-input-container.has-error .phone-input-row {
          border-color: var(--color-error, #ef4444);
        }

        .phone-input-row:focus-within {
          border-color: var(--color-brand, #00e5e5);
        }

        /* Country selector button */
        .country-selector-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 10px;
          height: 100%;
          background: transparent;
          border: none;
          border-right: 1px solid var(--border-default, #1e2d2d);
          cursor: pointer;
          min-width: 85px;
          font-family: var(--font-sans, 'Outfit', sans-serif);
        }

        .country-selector-btn:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .country-selector-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .country-selector-btn .dial-code {
          font-size: 12px;
          color: var(--text-secondary, #94b8b8);
        }

        .country-selector-btn .dropdown-arrow {
          font-size: 8px;
          color: var(--text-muted, #5a8080);
          transition: transform 0.2s ease;
          margin-left: 2px;
        }

        .country-selector-btn .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        /* Phone number input */
        .phone-number-input {
          flex: 1;
          height: 100%;
          padding: 0 12px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 12px;
          font-family: var(--font-sans, 'Outfit', sans-serif);
          color: var(--text-primary, #f0fafa);
          min-width: 0;
        }

        .phone-number-input::placeholder {
          color: var(--text-muted, #5a8080);
        }

        .phone-number-input:disabled {
          cursor: not-allowed;
        }

        /* Country dropdown */
        .country-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          z-index: 9999;
          min-width: 260px;
          max-width: 300px;
          background-color: var(--bg-elevated, #1a2424);
          border: 1px solid var(--border-default, #1e2d2d);
          border-radius: var(--radius-md, 8px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          max-height: 280px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Dropdown search container */
        .dropdown-search-container {
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-default, #1e2d2d);
        }

        .dropdown-search-input {
          width: 100%;
          height: 32px;
          padding: 0 10px;
          background-color: var(--bg-surface, rgba(255, 255, 255, 0.05));
          border: 1px solid var(--border-default, #1e2d2d);
          border-radius: 6px;
          font-size: 13px;
          font-family: var(--font-sans, 'Outfit', sans-serif);
          color: var(--text-primary, #f0fafa);
          outline: none;
          box-sizing: border-box;
        }

        .dropdown-search-input:focus {
          border-color: var(--color-brand, #00e5e5);
        }

        .dropdown-search-input::placeholder {
          color: var(--text-muted, #5a8080);
        }

        /* Country list */
        .country-list {
          flex: 1;
          overflow-y: auto;
          padding: 2px 0;
          margin: 0;
          list-style: none;
          -webkit-overflow-scrolling: touch;
        }

        /* Country item */
        .country-item {
          display: flex;
          align-items: center;
          padding: 7px 10px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          gap: 8px;
        }

        .country-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .country-item.selected,
        .country-item.focused {
          background-color: rgba(0, 229, 229, 0.1);
        }

        .country-item.no-results {
          padding: 16px;
          text-align: center;
          color: var(--text-muted, #5a8080);
          font-size: 13px;
          cursor: default;
        }

        .country-item.no-results:hover {
          background-color: transparent;
        }

        .country-item .country-flag {
          flex-shrink: 0;
        }

        .country-item .country-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #f0fafa);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .country-item .country-dial-code {
          font-size: 12px;
          color: var(--text-secondary, #94b8b8);
          flex-shrink: 0;
        }

        /* Preferred countries divider */
        .country-divider {
          height: 1px;
          background-color: var(--border-default, #1e2d2d);
          margin: 2px 0;
          list-style: none;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .phone-input-row {
            height: 44px;
          }

          .country-selector-btn {
            padding: 0 10px;
            min-width: 88px;
          }

          .country-selector-btn .dial-code {
            font-size: 13px;
          }

          .phone-number-input {
            padding: 0 12px;
            font-size: 16px; /* Prevents zoom on iOS */
          }

          .country-dropdown {
            max-height: 55vh;
            min-width: 240px;
            max-width: 280px;
          }

          .dropdown-search-container {
            padding: 6px;
          }

          .dropdown-search-input {
            height: 34px;
            font-size: 16px; /* Prevents zoom on iOS */
            padding: 0 10px;
          }

          .country-list {
            padding: 2px 0;
          }

          .country-item {
            padding: 8px 10px;
            gap: 8px;
          }

          .country-item .country-name {
            font-size: 14px;
          }

          .country-item .country-dial-code {
            font-size: 12px;
          }

          .country-divider {
            margin: 2px 0;
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
