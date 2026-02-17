'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import {
  Search,
  Plus,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit3,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  FormInput,
  FormSection,
  FormRow,
  PhoneInputWithCountry,
} from '@/components/ui';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  searchCustomers,
  getAllCustomers,
  updateCustomer,
  createCustomerDummy,
  type ExistingCustomer,
} from '@/lib/services/customer-service';

type SubView = 'list' | 'detail' | 'edit' | 'create';

interface CustomerFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

const EMPTY_FORM: CustomerFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  zip: '',
};

export default function SalesCustomers() {
  const { t, locale } = useI18n();

  // Sub-view navigation
  const [subView, setSubView] = useState<SubView>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);

  // List state
  const [customers, setCustomers] = useState<ExistingCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Form state (edit / create)
  const [formData, setFormData] = useState<CustomerFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------
  const fetchCustomers = useCallback(async (query?: string) => {
    setIsLoading(true);
    try {
      const token = getSalesRoleToken() || '';
      const result = query?.trim()
        ? await searchCustomers(query, token)
        : await getAllCustomers(1, 50, token);
      setCustomers(result.customers);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search (also handles the initial load via the first render)
  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Run immediately on first render; debounce subsequent searches
    const delay = isFirstLoadRef.current ? 0 : 300;
    isFirstLoadRef.current = false;

    debounceRef.current = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchCustomers]);

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------
  const openDetail = useCallback(async (customer: ExistingCustomer) => {
    setSelectedCustomer(customer);
    setSubView('detail');
  }, []);

  const openEdit = useCallback((customer: ExistingCustomer) => {
    const nameParts = customer.name.split(' ');
    setFormData({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: customer.email || '',
      phone: customer.phone || '',
      street: customer.street || '',
      city: customer.city || '',
      zip: customer.zip || '',
    });
    setFormErrors({});
    setSelectedCustomer(customer);
    setSubView('edit');
  }, []);

  const openCreate = useCallback(() => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setSelectedCustomer(null);
    setSubView('create');
  }, []);

  const goBackToList = useCallback(() => {
    setSubView('list');
    setSelectedCustomer(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
  }, []);

  const goBackToDetail = useCallback(() => {
    setSubView('detail');
    setFormErrors({});
  }, []);

  // ------------------------------------------------------------------
  // Form helpers
  // ------------------------------------------------------------------
  const handleFormChange = useCallback(
    (field: keyof CustomerFormState, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (field === 'email' || field === 'phone') {
        setFormErrors((prev) => ({ ...prev, email: undefined, phone: undefined }));
      }
    },
    [formErrors]
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CustomerFormState, string>> = {};

    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';

    const hasEmail = formData.email.trim().length > 0;
    const phoneDigits = formData.phone.replace(/\D/g, '');
    const hasPhone = phoneDigits.length >= 7;

    if (!hasEmail && !hasPhone) {
      errors.email = 'Email or phone required';
      errors.phone = 'Email or phone required';
    } else {
      if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errors.email = 'Invalid email';
      }
      if (hasPhone && phoneDigits.length < 10) {
        errors.phone = 'Invalid phone number';
      }
    }

    if (!formData.street.trim()) errors.street = 'Street is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.zip.trim()) errors.zip = 'ZIP code is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // ------------------------------------------------------------------
  // Save (create / update)
  // ------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    try {
      const token = getSalesRoleToken() || '';
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\D/g, ''),
        street: formData.street.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
      };

      if (subView === 'edit' && selectedCustomer) {
        const result = await updateCustomer(selectedCustomer.id, payload, token);
        setSelectedCustomer(result.customer);
        toast.success(t('sales.customerUpdated') || 'Customer updated');
        setSubView('detail');
      } else {
        await createCustomerDummy(payload, token);
        toast.success(t('sales.customerCreated') || 'Customer created');
        goBackToList();
      }
      // Refresh list
      fetchCustomers(searchQuery);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, formData, subView, selectedCustomer, fetchCustomers, searchQuery, goBackToList, t]);

  // ------------------------------------------------------------------
  // Format helpers
  // ------------------------------------------------------------------
  const formatPhone = (phone: string) => {
    if (!phone) return '--';
    if (phone.startsWith('254') && phone.length >= 12) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    }
    return phone.length > 4 ? `+${phone}` : phone;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  // ------------------------------------------------------------------
  // LIST VIEW
  // ------------------------------------------------------------------
  if (subView === 'list') {
    return (
      <div className="flex flex-col h-full relative">
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            {t('sales.customersTitle') || 'Customers'}
          </h2>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={18} className="text-text-muted" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sales.searchCustomerPlaceholder') || 'Search by name, email, or phone...'}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-surface-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <X size={16} className="text-text-muted hover:text-text-primary" />
              </button>
            ) : (
              <button
                onClick={() => fetchCustomers()}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <RefreshCw size={16} className={`text-text-muted hover:text-text-primary ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-20">
          {/* Loading skeletons */}
          {isLoading && customers.length === 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
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

          {/* Customer cards */}
          {!isLoading && customers.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs text-text-muted">
                {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
              </p>
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => openDetail(customer)}
                  className="w-full text-left rounded-xl border border-border bg-surface-secondary p-3.5 transition-all active:scale-[0.98] hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                      {customer.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
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
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && customers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <User size={28} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary mb-1">
                {searchQuery.trim()
                  ? (t('sales.noCustomersFound') || 'No customers found')
                  : (t('sales.noCustomersYet') || 'No customers yet')}
              </p>
              <p className="text-xs text-text-muted">
                {searchQuery.trim()
                  ? (t('sales.tryDifferentSearch') || 'Try a different search term')
                  : (t('sales.tapPlusToCreate') || 'Tap + to create a new customer')}
              </p>
            </div>
          )}
        </div>

        {/* FAB - Create */}
        <button
          onClick={openCreate}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30 hover:bg-primary/90"
          aria-label={t('sales.createCustomer') || 'Create Customer'}
        >
          <Plus size={24} />
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // DETAIL VIEW
  // ------------------------------------------------------------------
  if (subView === 'detail' && selectedCustomer) {
    return (
      <div className="flex flex-col h-full">
        {/* Back header */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button
            onClick={goBackToList}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-text-primary" />
          </button>
          <h2 className="text-lg font-semibold text-text-primary flex-1 truncate">
            {selectedCustomer.name}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Avatar + name card */}
          <div className="flex flex-col items-center py-6">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary mb-3">
              {selectedCustomer.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{selectedCustomer.name}</h3>
            <p className="text-xs text-text-muted mt-1">ID: {selectedCustomer.id}</p>
          </div>

          {/* Info cards */}
          <div className="flex flex-col gap-3">
            <DetailRow icon={<Phone size={16} />} label={t('sales.phoneNumber') || 'Phone'} value={formatPhone(selectedCustomer.phone)} />
            <DetailRow icon={<Mail size={16} />} label={t('sales.emailAddress') || 'Email'} value={selectedCustomer.email || '--'} />
            <DetailRow icon={<MapPin size={16} />} label={t('sales.street') || 'Street'} value={selectedCustomer.street || '--'} />
            <DetailRow icon={<MapPin size={16} />} label={t('sales.city') || 'City'} value={selectedCustomer.city || '--'} />
            <DetailRow icon={<MapPin size={16} />} label={t('sales.zip') || 'ZIP'} value={selectedCustomer.zip || '--'} />
            <DetailRow icon={<Calendar size={16} />} label={t('sales.createdAt') || 'Created'} value={formatDate(selectedCustomer.createdAt)} />
          </div>
        </div>

        {/* Edit button */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={() => openEdit(selectedCustomer)}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Edit3 size={16} />
            {t('sales.editCustomer') || 'Edit Customer'}
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // EDIT / CREATE VIEW
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={subView === 'edit' ? goBackToDetail : goBackToList}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {subView === 'edit'
            ? (t('sales.editCustomer') || 'Edit Customer')
            : (t('sales.createCustomer') || 'New Customer')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FormSection title={t('sales.personalInfo') || 'Personal Information'}>
          <FormRow columns={2}>
            <FormInput
              label={t('sales.firstName') || 'First Name'}
              required
              value={formData.firstName}
              onChange={(e) => handleFormChange('firstName', e.target.value)}
              placeholder="John"
              error={formErrors.firstName}
            />
            <FormInput
              label={t('sales.lastName') || 'Last Name'}
              required
              value={formData.lastName}
              onChange={(e) => handleFormChange('lastName', e.target.value)}
              placeholder="Doe"
              error={formErrors.lastName}
            />
          </FormRow>

          <FormInput
            label={t('sales.emailAddress') || 'Email'}
            type="email"
            value={formData.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
            placeholder="customer@example.com"
            error={formErrors.email}
          />

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-text-muted">{t('sales.orEnterPhoneNumber') || 'Or enter phone number'}</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <PhoneInputWithCountry
            label={t('sales.phoneNumber') || 'Phone'}
            value={formData.phone}
            onChange={(val) => handleFormChange('phone', val)}
            locale={locale}
            error={formErrors.phone}
          />
        </FormSection>

        <FormSection title={t('sales.addressInfo') || 'Address'}>
          <FormInput
            label={t('sales.street') || 'Street'}
            required
            value={formData.street}
            onChange={(e) => handleFormChange('street', e.target.value)}
            placeholder="123 Main Street"
            error={formErrors.street}
          />
          <FormRow columns={2}>
            <FormInput
              label={t('sales.city') || 'City'}
              required
              value={formData.city}
              onChange={(e) => handleFormChange('city', e.target.value)}
              placeholder="Nairobi"
              error={formErrors.city}
            />
            <FormInput
              label={t('sales.zip') || 'ZIP'}
              required
              value={formData.zip}
              onChange={(e) => handleFormChange('zip', e.target.value)}
              placeholder="00100"
              error={formErrors.zip}
            />
          </FormRow>
        </FormSection>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('common.saving') || 'Saving...'}
            </>
          ) : (
            subView === 'edit'
              ? (t('sales.saveChanges') || 'Save Changes')
              : (t('sales.createCustomer') || 'Create Customer')
          )}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-component: detail row
// ------------------------------------------------------------------
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-secondary p-3.5">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-muted flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted mb-0.5">{label}</p>
        <p className="text-sm text-text-primary break-all">{value}</p>
      </div>
    </div>
  );
}
