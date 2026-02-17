'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';
import { Search, User, Phone, Mail, MapPin, Check, X } from 'lucide-react';
import { CustomerFormData } from '../types';
import type { ExistingCustomer } from '@/lib/services/customer-service';
import { searchCustomers } from '@/lib/services/customer-service';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { 
  Screen, 
  PageHeader, 
  FormInput, 
  FormSection, 
  FormRow,
  PhoneInputWithCountry,
} from '@/components/ui';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
  /** Current customer mode */
  customerMode: 'new' | 'existing';
  /** Callback when mode changes */
  onModeChange: (mode: 'new' | 'existing') => void;
  /** Callback when an existing customer is selected (null to deselect) */
  onSelectExistingCustomer: (customer: ExistingCustomer | null) => void;
  /** Currently selected existing customer (null if none) */
  selectedExistingCustomer: ExistingCustomer | null;
}

export default function Step1CustomerForm({ 
  formData, 
  onFormChange, 
  errors = {},
  customerMode,
  onModeChange,
  onSelectExistingCustomer,
  selectedExistingCustomer,
}: Step1Props) {
  const { t, locale } = useI18n();
  
  // Search state for existing customer mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExistingCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle phone number change from the country code selector
  const handlePhoneChange = useCallback((value: string) => {
    onFormChange('phone', value);
  }, [onFormChange]);

  // Debounced search for existing customers
  useEffect(() => {
    if (customerMode !== 'existing') return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = getSalesRoleToken() || '';
        const result = await searchCustomers(searchQuery, token);
        setSearchResults(result.customers);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, customerMode]);

  // Load initial customers when switching to existing mode
  useEffect(() => {
    if (customerMode !== 'existing') return;
    if (hasSearched || searchQuery.trim()) return;

    let cancelled = false;
    const loadInitial = async () => {
      setIsSearching(true);
      try {
        const token = getSalesRoleToken() || '';
        const result = await searchCustomers('', token);
        if (!cancelled) {
          setSearchResults(result.customers);
          setHasSearched(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    loadInitial();
    return () => { cancelled = true; };
  }, [customerMode, hasSearched, searchQuery]);

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.startsWith('254') && phone.length >= 12) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    }
    return phone.length > 4 ? `+${phone}` : phone;
  };

  return (
    <Screen>
      <PageHeader 
        title={t('sales.newCustomer') || 'Customer'} 
        subtitle={customerMode === 'new' 
          ? (t('sales.enterCustomerDetails') || 'Enter customer details')
          : (t('sales.selectExistingCustomer') || 'Search and select a customer')
        }
        align="center"
      />

      {/* Mode Toggle - Pill style */}
      <div className="flex items-center justify-center mb-4 px-1">
        <div className="flex w-full rounded-xl overflow-hidden border border-border bg-surface-secondary">
          <button
            type="button"
            onClick={() => onModeChange('new')}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              customerMode === 'new'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t('sales.newCustomer') || 'New Customer'}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('existing')}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              customerMode === 'existing'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t('sales.existingCustomer') || 'Existing Customer'}
          </button>
        </div>
      </div>

      {/* NEW CUSTOMER MODE - existing form */}
      {customerMode === 'new' && (
        <>
          <FormSection title={t('sales.personalInfo')}>
            <FormRow columns={2}>
              <FormInput
                label={t('sales.firstName')}
                required
                value={formData.firstName}
                onChange={(e) => onFormChange('firstName', e.target.value)}
                placeholder="John"
                error={errors.firstName}
              />
              <FormInput
                label={t('sales.lastName')}
                required
                value={formData.lastName}
                onChange={(e) => onFormChange('lastName', e.target.value)}
                placeholder="Doe"
                error={errors.lastName}
              />
            </FormRow>

            {/* Contact info hint */}
            <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 flex-shrink-0">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <p className="text-xs text-blue-300">
                {t('sales.contactInfoHint') || 'Please provide at least one contact method: email or phone number (or both).'}
              </p>
            </div>

            <FormInput
              label={t('sales.emailAddress')}
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              placeholder="customer@example.com"
              error={errors.email}
            />
            
            {/* "or" divider between email and phone */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 border-t border-border"></div>
              <span className="text-xs text-text-muted">{t('sales.orEnterPhoneNumber') || 'Or enter phone number'}</span>
              <div className="flex-1 border-t border-border"></div>
            </div>
            
            <PhoneInputWithCountry
              label={t('sales.phoneNumber')}
              value={formData.phone}
              onChange={handlePhoneChange}
              locale={locale}
              error={errors.phone}
            />
          </FormSection>

          <FormSection title={t('sales.addressInfo')}>
            <FormInput
              label={t('sales.street')}
              required
              value={formData.street}
              onChange={(e) => onFormChange('street', e.target.value)}
              placeholder="123 Main Street"
              error={errors.street}
            />

            <FormRow columns={2}>
              <FormInput
                label={t('sales.city')}
                required
                value={formData.city}
                onChange={(e) => onFormChange('city', e.target.value)}
                placeholder="Nairobi"
                error={errors.city}
              />
              <FormInput
                label={t('sales.zip')}
                required
                value={formData.zip}
                onChange={(e) => onFormChange('zip', e.target.value)}
                placeholder="00100"
                error={errors.zip}
              />
            </FormRow>
          </FormSection>
        </>
      )}

      {/* EXISTING CUSTOMER MODE */}
      {customerMode === 'existing' && (
        <div className="flex flex-col gap-3">
          {/* Selected customer card */}
          {selectedExistingCustomer && (
            <div className="border-2 border-green-500/60 bg-green-900/20 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check size={16} className="text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                    {t('sales.selectedCustomer') || 'Selected'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectExistingCustomer(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted"
                >
                  <X size={16} />
                </button>
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">
                {selectedExistingCustomer.name}
              </h3>
              <div className="flex flex-col gap-1">
                {selectedExistingCustomer.phone && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone size={13} className="text-text-muted" />
                    <span>{formatPhone(selectedExistingCustomer.phone)}</span>
                  </div>
                )}
                {selectedExistingCustomer.email && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Mail size={13} className="text-text-muted" />
                    <span>{selectedExistingCustomer.email}</span>
                  </div>
                )}
                {selectedExistingCustomer.city && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <MapPin size={13} className="text-text-muted" />
                    <span>{selectedExistingCustomer.city}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={18} className="text-text-muted" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sales.searchCustomerPlaceholder') || 'Search by name, email, or phone...'}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setHasSearched(false); }}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <X size={16} className="text-text-muted hover:text-text-primary" />
              </button>
            )}
          </div>

          {/* Loading skeleton */}
          {isSearching && (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-surface-secondary p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-48 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results list */}
          {!isSearching && hasSearched && searchResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-muted px-1">
                {searchResults.length} {searchResults.length === 1 ? 'customer' : 'customers'} found
              </p>
              {searchResults.map((customer) => {
                const isSelected = selectedExistingCustomer?.id === customer.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onSelectExistingCustomer(customer)}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface-secondary hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        isSelected ? 'bg-primary/20 text-primary' : 'bg-white/10 text-text-secondary'
                      }`}>
                        {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-text-primary truncate">
                          {customer.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-0.5">
                          {customer.phone && (
                            <span className="flex items-center gap-1 text-xs text-text-muted truncate">
                              <Phone size={11} />
                              {formatPhone(customer.phone)}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 text-xs text-text-muted truncate">
                              <Mail size={11} />
                              {customer.email}
                            </span>
                          )}
                        </div>
                        {customer.city && (
                          <span className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                            <MapPin size={11} />
                            {customer.city}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={18} className="text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isSearching && hasSearched && searchResults.length === 0 && searchQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <User size={24} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary mb-1">
                {t('sales.noCustomersFound') || 'No customers found'}
              </p>
              <p className="text-xs text-text-muted">
                {t('sales.tryDifferentSearch') || 'Try a different search term or create a new customer'}
              </p>
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}
