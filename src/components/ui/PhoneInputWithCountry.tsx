'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { 
  COUNTRIES, 
  getDefaultCountry, 
  parsePhoneNumber,
  type CountryPhoneFormat 
} from '@/lib/phone-utils';

interface PhoneInputWithCountryProps {
  /** Current phone value (can be local number or full with country code) */
  value: string;
  /** Callback when phone changes - receives the local number (without country code) */
  onChange: (localNumber: string, fullNumber: string, country: CountryPhoneFormat) => void;
  /** Label for the input */
  label?: string;
  /** Error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Initial country ISO code (e.g., 'KE') */
  defaultCountryCode?: string;
  /** Current locale for default country detection */
  locale?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom className for the container */
  className?: string;
}

/**
 * PhoneInputWithCountry - Mobile-friendly phone input with country code selector
 * 
 * Features:
 * - Country flag and dial code selector
 * - Full-screen modal for country selection on mobile
 * - Search functionality
 * - Auto-detects country from locale or existing phone number
 * 
 * @example
 * <PhoneInputWithCountry
 *   value={phone}
 *   onChange={(local, full, country) => setPhone(local)}
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
  defaultCountryCode,
  locale,
  placeholder,
  className = '',
}: PhoneInputWithCountryProps) {
  // Determine initial country from props or locale
  const initialCountry = useMemo(() => {
    if (defaultCountryCode) {
      const country = COUNTRIES.find(c => c.isoCode === defaultCountryCode);
      if (country) return country;
    }
    return getDefaultCountry(locale);
  }, [defaultCountryCode, locale]);

  const [selectedCountry, setSelectedCountry] = useState<CountryPhoneFormat>(initialCountry);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localNumber, setLocalNumber] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Parse existing value on mount
  useEffect(() => {
    if (value) {
      // Try to parse the phone number to extract country
      const parsed = parsePhoneNumber(value);
      if (parsed) {
        setSelectedCountry(parsed.country);
        setLocalNumber(parsed.localNumber);
      } else {
        // Just set the local number as-is
        setLocalNumber(value.replace(/[^0-9]/g, ''));
      }
    }
  }, []); // Only run on mount

  // Filter countries based on search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    
    const query = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.dialCode.includes(query) ||
      country.isoCode.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle country selection
  const handleCountrySelect = useCallback((country: CountryPhoneFormat) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    
    // Notify parent with updated phone
    const fullNumber = country.dialCode.replace('+', '') + localNumber;
    onChange(localNumber, fullNumber, country);
    
    // Focus the input after selection
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [localNumber, onChange]);

  // Handle local number change
  const handleLocalNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Only allow digits
    newValue = newValue.replace(/[^0-9]/g, '');
    
    // Remove leading zero if present
    if (newValue.startsWith('0')) {
      newValue = newValue.slice(1);
    }
    
    setLocalNumber(newValue);
    
    // Notify parent with full number
    const fullNumber = selectedCountry.dialCode.replace('+', '') + newValue;
    onChange(newValue, fullNumber, selectedCountry);
  }, [selectedCountry, onChange]);

  // Handle opening the modal
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery('');
    // Focus search input after modal opens
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [disabled]);

  // Handle closing the modal
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const hasError = !!error;

  return (
    <div className={`phone-input-with-country ${className}`}>
      {label && (
        <label className="phone-input-label">
          {label}
          {required && <span className="phone-input-required">*</span>}
        </label>
      )}
      
      <div className={`phone-input-container ${hasError ? 'phone-input-error' : ''} ${disabled ? 'phone-input-disabled' : ''}`}>
        {/* Country Code Button */}
        <button
          type="button"
          className="phone-country-button"
          onClick={handleOpen}
          disabled={disabled}
          aria-label="Select country code"
          aria-expanded={isOpen}
        >
          <span className="phone-country-flag">{selectedCountry.flag}</span>
          <span className="phone-country-code">{selectedCountry.dialCode}</span>
          <ChevronDown size={14} className="phone-country-chevron" />
        </button>
        
        {/* Divider */}
        <div className="phone-input-divider" />
        
        {/* Phone Number Input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          className="phone-number-input"
          value={localNumber}
          onChange={handleLocalNumberChange}
          placeholder={placeholder || selectedCountry.placeholder}
          disabled={disabled}
          aria-label="Phone number"
        />
      </div>
      
      {error && (
        <span className="phone-input-error-text">{error}</span>
      )}

      {/* Country Selection Modal (Full screen on mobile) */}
      {isOpen && (
        <div className="phone-country-modal-overlay" onClick={handleClose}>
          <div 
            ref={modalRef}
            className="phone-country-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="phone-country-modal-header">
              <h2 className="phone-country-modal-title">Select Country</h2>
              <button
                type="button"
                className="phone-country-modal-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            {/* Search Input */}
            <div className="phone-country-search-container">
              <Search size={18} className="phone-country-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="phone-country-search-input"
                placeholder="Search country or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="phone-country-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Country List */}
            <div className="phone-country-list">
              {filteredCountries.length === 0 ? (
                <div className="phone-country-empty">
                  No countries found
                </div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.isoCode}
                    type="button"
                    className={`phone-country-item ${selectedCountry.isoCode === country.isoCode ? 'phone-country-item-selected' : ''}`}
                    onClick={() => handleCountrySelect(country)}
                  >
                    <span className="phone-country-item-flag">{country.flag}</span>
                    <span className="phone-country-item-name">{country.name}</span>
                    <span className="phone-country-item-code">{country.dialCode}</span>
                    {selectedCountry.isoCode === country.isoCode && (
                      <Check size={18} className="phone-country-item-check" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .phone-input-with-country {
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
          display: flex;
          align-items: center;
          background-color: var(--bg-surface, #1a1a2e);
          border: 1px solid var(--border-default, #2d2d44);
          border-radius: var(--radius-md, 8px);
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .phone-input-container:focus-within {
          border-color: var(--color-brand, #00e5e5);
        }

        .phone-input-error {
          border-color: var(--color-error, #ef4444);
        }

        .phone-input-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .phone-country-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 8px 10px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background-color 0.2s ease;
        }

        .phone-country-button:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .phone-country-button:disabled {
          cursor: not-allowed;
        }

        .phone-country-flag {
          font-size: 18px;
          line-height: 1;
        }

        .phone-country-code {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #ffffff);
        }

        .phone-country-chevron {
          color: var(--text-muted, #6b7280);
          transition: transform 0.2s ease;
        }

        .phone-input-divider {
          width: 1px;
          height: 24px;
          background-color: var(--border-default, #2d2d44);
        }

        .phone-number-input {
          flex: 1;
          padding: 10px 12px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          font-family: var(--font-sans);
          color: var(--text-primary, #ffffff);
        }

        .phone-number-input::placeholder {
          color: var(--text-muted, #6b7280);
        }

        .phone-number-input:disabled {
          cursor: not-allowed;
        }

        .phone-input-error-text {
          display: block;
          margin-top: var(--space-1, 4px);
          font-size: 12px;
          color: var(--color-error, #ef4444);
        }

        /* Modal Overlay */
        .phone-country-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal */
        .phone-country-modal {
          width: 100%;
          max-height: 85vh;
          background-color: var(--bg-primary, #0d0d1a);
          border-radius: 20px 20px 0 0;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @media (min-width: 640px) {
          .phone-country-modal-overlay {
            align-items: center;
          }

          .phone-country-modal {
            max-width: 400px;
            max-height: 70vh;
            border-radius: 16px;
            animation: scaleIn 0.2s ease;
          }

          @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }

        /* Modal Header */
        .phone-country-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-default, #2d2d44);
        }

        .phone-country-modal-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
          margin: 0;
        }

        .phone-country-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .phone-country-modal-close:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #ffffff);
        }

        /* Search */
        .phone-country-search-container {
          position: relative;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-default, #2d2d44);
        }

        .phone-country-search-icon {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #6b7280);
          pointer-events: none;
        }

        .phone-country-search-input {
          width: 100%;
          padding: 12px 40px 12px 44px;
          background-color: var(--bg-surface, #1a1a2e);
          border: 1px solid var(--border-default, #2d2d44);
          border-radius: 10px;
          font-size: 15px;
          font-family: var(--font-sans);
          color: var(--text-primary, #ffffff);
          outline: none;
          transition: border-color 0.2s ease;
        }

        .phone-country-search-input:focus {
          border-color: var(--color-brand, #00e5e5);
        }

        .phone-country-search-input::placeholder {
          color: var(--text-muted, #6b7280);
        }

        .phone-country-search-clear {
          position: absolute;
          right: 28px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          transition: background-color 0.2s ease;
        }

        .phone-country-search-clear:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Country List */
        .phone-country-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
          -webkit-overflow-scrolling: touch;
        }

        .phone-country-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted, #6b7280);
          font-size: 14px;
        }

        .phone-country-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 14px 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s ease;
        }

        .phone-country-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .phone-country-item:active {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .phone-country-item-selected {
          background-color: rgba(0, 229, 229, 0.1);
        }

        .phone-country-item-selected:hover {
          background-color: rgba(0, 229, 229, 0.15);
        }

        .phone-country-item-flag {
          font-size: 22px;
          margin-right: 14px;
          line-height: 1;
        }

        .phone-country-item-name {
          flex: 1;
          font-size: 15px;
          font-weight: 500;
          color: var(--text-primary, #ffffff);
        }

        .phone-country-item-code {
          font-size: 13px;
          color: var(--text-secondary, #a0aec0);
          margin-right: 8px;
        }

        .phone-country-item-check {
          color: var(--color-brand, #00e5e5);
        }
      `}</style>
    </div>
  );
}
