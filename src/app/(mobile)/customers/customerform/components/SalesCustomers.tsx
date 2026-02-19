'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit3,
} from 'lucide-react';
import DetailScreen, { type DetailSection as DetailSectionType } from '@/components/ui/DetailScreen';
import {
  FormInput,
  FormSection,
  FormRow,
  PhoneInputWithCountry,
} from '@/components/ui';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  searchCustomers,
  getAllCustomers,
  updateCustomer,
  createCustomer,
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
  const [period, setPeriod] = useState<ListPeriod>('all');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Form state (edit / create)
  const [formData, setFormData] = useState<CustomerFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------------
  // Date filter helper
  // ------------------------------------------------------------------
  const getDateCutoff = useCallback((p: ListPeriod): Date | null => {
    const now = new Date();
    switch (p) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case '3days': { const d = new Date(now); d.setDate(d.getDate() - 3); return d; }
      case '5days': { const d = new Date(now); d.setDate(d.getDate() - 5); return d; }
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      case '14days': { const d = new Date(now); d.setDate(d.getDate() - 14); return d; }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
      default: return null;
    }
  }, []);

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
      toast.error(t('sales.fetchCustomersError') || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Debounced search (also handles the initial load via the first render)
  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstLoadRef.current ? 0 : 300;
    isFirstLoadRef.current = false;
    debounceRef.current = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchCustomers]);

  // Apply date filter client-side
  const filteredCustomers = React.useMemo(() => {
    const cutoff = getDateCutoff(period);
    if (!cutoff) return customers;
    return customers.filter((c) => new Date(c.createdAt) >= cutoff);
  }, [customers, period, getDateCutoff]);

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------
  const openDetail = useCallback((customer: ExistingCustomer) => {
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

    if (!formData.firstName.trim()) errors.firstName = t('sales.firstNameRequired') || 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = t('sales.lastNameRequired') || 'Last name is required';

    const hasEmail = formData.email.trim().length > 0;
    const phoneDigits = formData.phone.replace(/\D/g, '');
    const hasPhone = phoneDigits.length >= 7;

    if (!hasEmail && !hasPhone) {
      errors.email = t('sales.emailOrPhoneRequired') || 'Email or phone required';
      errors.phone = t('sales.emailOrPhoneRequired') || 'Email or phone required';
    } else {
      if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errors.email = t('sales.invalidEmail') || 'Invalid email';
      }
      if (hasPhone && phoneDigits.length < 10) {
        errors.phone = t('sales.invalidPhone') || 'Invalid phone number';
      }
    }

    if (!formData.street.trim()) errors.street = t('sales.streetRequired') || 'Street is required';
    if (!formData.city.trim()) errors.city = t('sales.cityRequired') || 'City is required';
    if (!formData.zip.trim()) errors.zip = t('sales.zipRequired') || 'ZIP code is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

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
        await createCustomer(payload, token);
        toast.success(t('sales.customerCreated') || 'Customer created');
        goBackToList();
      }
      fetchCustomers(searchQuery);
    } catch (err: any) {
      toast.error(err.message || t('sales.saveCustomerError') || 'Failed to save customer');
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
  // LIST VIEW (uses ListScreen)
  // ------------------------------------------------------------------
  if (subView === 'list') {
    return (
      <ListScreen
        title={t('sales.customersTitle') || 'Customers'}
        searchPlaceholder={t('sales.searchCustomerPlaceholder') || 'Search by name, email, or phone...'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        period={period}
        onPeriodChange={setPeriod}
        isLoading={isLoading}
        onRefresh={() => fetchCustomers()}
        isEmpty={filteredCustomers.length === 0}
        emptyIcon={<User size={28} className="text-text-muted" />}
        emptyMessage={
          searchQuery.trim()
            ? (t('sales.noCustomersFound') || 'No customers found')
            : (t('sales.noCustomersYet') || 'No customers yet')
        }
        emptyHint={
          searchQuery.trim()
            ? (t('sales.tryDifferentSearch') || 'Try a different search term')
            : (t('sales.tapPlusToCreate') || 'Tap + to create a new customer')
        }
        itemCount={filteredCustomers.length}
        itemLabel={filteredCustomers.length === 1
          ? (t('sales.customerSingular') || 'customer')
          : (t('sales.customerPlural') || 'customers')
        }
        fabAction={openCreate}
        fabLabel={t('sales.createCustomer') || 'Create Customer'}
      >
        {filteredCustomers.map((customer) => (
          <button
            key={customer.id}
            onClick={() => openDetail(customer)}
            className="list-card w-full text-left"
          >
            <div className="list-card-body list-card-body--with-avatar">
              <div className="list-card-avatar list-card-avatar--primary">
                {customer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="list-card-content">
                <div className="list-card-primary">{customer.name}</div>
                {customer.phone && (
                  <div className="list-card-secondary">
                    <Phone size={10} /> {formatPhone(customer.phone)}
                  </div>
                )}
                <div className="list-card-meta">
                  {customer.email && (
                    <>
                      <Mail size={10} />
                      <span>{customer.email}</span>
                    </>
                  )}
                  {customer.email && customer.city && <span className="list-card-dot">&middot;</span>}
                  {customer.city && (
                    <>
                      <MapPin size={10} />
                      <span>{customer.city}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </ListScreen>
    );
  }

  // ------------------------------------------------------------------
  // DETAIL VIEW (uses shared DetailScreen)
  // ------------------------------------------------------------------
  if (subView === 'detail' && selectedCustomer) {
    const initials = selectedCustomer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const detailSections: DetailSectionType[] = [
      {
        title: t('sales.contactInfo') || 'Contact',
        fields: [
          { icon: <Phone size={15} />, label: t('sales.phoneNumber') || 'Phone', value: formatPhone(selectedCustomer.phone) },
          { icon: <Mail size={15} />, label: t('sales.emailAddress') || 'Email', value: selectedCustomer.email || '--' },
        ],
      },
      {
        title: t('sales.addressInfo') || 'Address',
        fields: [
          { icon: <MapPin size={15} />, label: t('sales.street') || 'Street', value: selectedCustomer.street || '--' },
          { icon: <MapPin size={15} />, label: t('sales.city') || 'City', value: selectedCustomer.city || '--' },
          { icon: <MapPin size={15} />, label: t('sales.zip') || 'ZIP', value: selectedCustomer.zip || '--' },
        ],
      },
      {
        title: t('sales.otherInfo') || 'Other',
        fields: [
          { icon: <Calendar size={15} />, label: t('sales.createdAt') || 'Created', value: formatDate(selectedCustomer.createdAt) },
        ],
      },
    ];

    return (
      <DetailScreen
        onBack={goBackToList}
        avatar={initials}
        title={selectedCustomer.name}
        subtitle={`ID: ${selectedCustomer.id}`}
        sections={detailSections}
        fabAction={() => openEdit(selectedCustomer)}
        fabIcon={<Edit3 size={20} strokeWidth={2.5} />}
        fabLabel={t('sales.editCustomer') || 'Edit Customer'}
      />
    );
  }

  // ------------------------------------------------------------------
  // EDIT / CREATE VIEW
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button onClick={subView === 'edit' ? goBackToDetail : goBackToList} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors" aria-label="Back">
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {subView === 'edit' ? (t('sales.editCustomer') || 'Edit Customer') : (t('sales.createCustomer') || 'New Customer')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FormSection title={t('sales.personalInfo') || 'Personal Information'}>
          <FormRow columns={2}>
            <FormInput label={t('sales.firstName') || 'First Name'} required value={formData.firstName} onChange={(e) => handleFormChange('firstName', e.target.value)} placeholder="John" error={formErrors.firstName} />
            <FormInput label={t('sales.lastName') || 'Last Name'} required value={formData.lastName} onChange={(e) => handleFormChange('lastName', e.target.value)} placeholder="Doe" error={formErrors.lastName} />
          </FormRow>
          <FormInput label={t('sales.emailAddress') || 'Email'} type="email" value={formData.email} onChange={(e) => handleFormChange('email', e.target.value)} placeholder="customer@example.com" error={formErrors.email} />
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-text-muted">{t('sales.orEnterPhoneNumber') || 'Or enter phone number'}</span>
            <div className="flex-1 border-t border-border" />
          </div>
          <PhoneInputWithCountry label={t('sales.phoneNumber') || 'Phone'} value={formData.phone} onChange={(val) => handleFormChange('phone', val)} locale={locale} error={formErrors.phone} />
        </FormSection>

        <FormSection title={t('sales.addressInfo') || 'Address'}>
          <FormInput label={t('sales.street') || 'Street'} required value={formData.street} onChange={(e) => handleFormChange('street', e.target.value)} placeholder="123 Main Street" error={formErrors.street} />
          <FormRow columns={2}>
            <FormInput label={t('sales.city') || 'City'} required value={formData.city} onChange={(e) => handleFormChange('city', e.target.value)} placeholder="Nairobi" error={formErrors.city} />
            <FormInput label={t('sales.zip') || 'ZIP'} required value={formData.zip} onChange={(e) => handleFormChange('zip', e.target.value)} placeholder="00100" error={formErrors.zip} />
          </FormRow>
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <button onClick={handleSave} disabled={isSaving} className="w-full py-3 rounded-xl bg-brand text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving') || 'Saving...'}</>
          ) : (
            subView === 'edit' ? (t('sales.saveChanges') || 'Save Changes') : (t('sales.createCustomer') || 'Create Customer')
          )}
        </button>
      </div>
    </div>
  );
}

