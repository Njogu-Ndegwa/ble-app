'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit3,
  Trash2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
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
  getCustomerById,
  updateCustomer,
  createCustomer,
  deleteCustomer,
  type ExistingCustomer,
} from '@/lib/services/customer-service';
import { resetPassword } from '@/lib/odoo-api';

type SubView = 'list' | 'detail' | 'edit' | 'create';

type CustomerTypeFilter = 'all' | 'company' | 'individual';

interface CustomerFormState {
  isCompany: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

const EMPTY_FORM: CustomerFormState = {
  isCompany: false,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  zip: '',
};

interface CustomerManagementProps {
  onLogout?: () => void;
}

export default function CustomerManagement({ onLogout }: CustomerManagementProps) {
  const { t, locale } = useI18n();

  const [subView, setSubView] = useState<SubView>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);

  const [customers, setCustomers] = useState<ExistingCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<ListPeriod>('all');
  const [customerType, setCustomerType] = useState<CustomerTypeFilter>('all');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<CustomerFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [lastResetPassword, setLastResetPassword] = useState<string | null>(null);
  const [isPasswordCopied, setIsPasswordCopied] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

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
  const fetchCustomers = useCallback(async (
    query?: string,
    type: CustomerTypeFilter = 'all'
  ) => {
    setIsLoading(true);
    try {
      const token = getSalesRoleToken() || '';
      const result = query?.trim()
        ? await searchCustomers(query, token, type)
        : await getAllCustomers(1, 50, token, type);
      setCustomers(result.customers);
    } catch {
      toast.error(t('sales.fetchCustomersError') || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstLoadRef.current ? 0 : 300;
    isFirstLoadRef.current = false;
    debounceRef.current = setTimeout(() => {
      fetchCustomers(searchQuery, customerType);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, customerType, fetchCustomers]);

  const filteredCustomers = React.useMemo(() => {
    const cutoff = getDateCutoff(period);
    if (!cutoff) return customers;
    return customers.filter((c) => new Date(c.createdAt) >= cutoff);
  }, [customers, period, getDateCutoff]);

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------
  const openDetail = useCallback(async (customer: ExistingCustomer) => {
    setSelectedCustomer(null);
    setShowPassword(false);
    setLastResetPassword(null);
    setIsPasswordCopied(false);
    setIsLoadingDetail(true);
    setSubView('detail');
    try {
      const token = getSalesRoleToken() || '';
      const result = await getCustomerById(customer.id, token);
      setSelectedCustomer(result.customer);
    } catch {
      toast.error(t('sales.fetchCustomerError') || 'Failed to load customer details');
      setSubView('list');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [t]);

  const openEdit = useCallback((customer: ExistingCustomer) => {
    const isCompany = customer.isCompany;
    const nameParts = customer.name.split(' ');
    setFormData({
      isCompany,
      firstName: isCompany ? customer.name : (nameParts[0] || ''),
      lastName: isCompany ? '' : nameParts.slice(1).join(' '),
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

    if (!formData.firstName.trim()) {
      errors.firstName = formData.isCompany
        ? (t('sales.companyNameRequired') || 'Company name is required')
        : (t('sales.firstNameRequired') || 'First name is required');
    }
    if (!formData.isCompany && !formData.lastName.trim()) {
      errors.lastName = t('sales.lastNameRequired') || 'Last name is required';
    }

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
      const name = formData.isCompany
        ? formData.firstName.trim()
        : `${formData.firstName} ${formData.lastName}`.trim();
      const payload = {
        name,
        isCompany: formData.isCompany,
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
      fetchCustomers(searchQuery, customerType);
    } catch (err: any) {
      toast.error(err.message || t('sales.saveCustomerError') || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, formData, subView, selectedCustomer, fetchCustomers, searchQuery, customerType, goBackToList, t]);

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  const handleDelete = useCallback(async () => {
    if (!selectedCustomer) return;
    setIsDeleting(true);

    try {
      const token = getSalesRoleToken() || '';
      await deleteCustomer(selectedCustomer.id, token);
      toast.success(t('customerMgmt.customerDeleted') || 'Customer deleted');
      setShowDeleteConfirm(false);
      goBackToList();
      fetchCustomers(searchQuery, customerType);
    } catch (err: any) {
      toast.error(err.message || t('customerMgmt.deleteCustomerError') || 'Failed to delete customer');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedCustomer, fetchCustomers, searchQuery, customerType, goBackToList, t]);

  // ------------------------------------------------------------------
  // Reset password (set phone number as password)
  // ------------------------------------------------------------------
  const handleResetPassword = useCallback(async () => {
    if (!selectedCustomer) return;
    const phone = selectedCustomer.phone;
    const email = selectedCustomer.email;
    if (!phone && !email) {
      toast.error(t('customerMgmt.noContactForPassword') || 'Customer has no phone or email to reset password');
      return;
    }

    setIsResettingPassword(true);
    setIsPasswordCopied(false);
    try {
      const token = getSalesRoleToken() || undefined;
      const payload: { email?: string; phone?: string; new_password?: string } = {};
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      if (phone) payload.new_password = phone;

      console.warn('[CustomerManagement] RESET PASSWORD - Payload:', JSON.stringify(payload));

      const res = await resetPassword(payload, token);
      console.warn('[CustomerManagement] RESET PASSWORD - Response:', JSON.stringify(res));

      const newPw = phone || res.new_password || '';
      setLastResetPassword(newPw);
      setShowPassword(true);
      toast.success(t('customerMgmt.passwordResetSuccess') || 'Password has been reset to the phone number');
    } catch (err: any) {
      console.error('[CustomerManagement] RESET PASSWORD - Failed:', err);
      toast.error(err.message || t('customerMgmt.passwordResetFailed') || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  }, [selectedCustomer, t]);

  const handleCopyPassword = useCallback(async () => {
    if (!lastResetPassword) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(lastResetPassword);
      } else {
        const ta = document.createElement('textarea');
        ta.value = lastResetPassword;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setIsPasswordCopied(true);
      toast.success(t('customerMgmt.passwordCopied') || 'Password copied to clipboard');
      setTimeout(() => setIsPasswordCopied(false), 1800);
    } catch (err) {
      console.error('[CustomerManagement] COPY PASSWORD - Failed:', err);
    }
  }, [lastResetPassword, t]);

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
  // DELETE CONFIRMATION MODAL
  // ------------------------------------------------------------------
  const deleteConfirmModal = showDeleteConfirm && selectedCustomer && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-error-soft)' }}
          >
            <AlertTriangle size={24} style={{ color: 'var(--color-error)' }} />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('customerMgmt.deleteConfirmTitle') || 'Delete Customer?'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('customerMgmt.deleteConfirmMessage') || `Are you sure you want to delete "${selectedCustomer.name}"? This action cannot be undone.`}
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-xl border font-medium text-sm transition-colors active:scale-[0.98]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: 'var(--color-error)' }}
          >
            {isDeleting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.deleting') || 'Deleting...'}</>
            ) : (
              <><Trash2 size={16} />{t('common.delete') || 'Delete'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ------------------------------------------------------------------
  // LIST VIEW
  // ------------------------------------------------------------------
  const TYPE_FILTER_OPTIONS: { value: CustomerTypeFilter; label: string }[] = [
    { value: 'all', label: t('customerMgmt.filterAll') || 'All' },
    { value: 'individual', label: t('customerMgmt.filterIndividual') || 'Individual' },
    { value: 'company', label: t('customerMgmt.filterCompany') || 'Company' },
  ];

  if (subView === 'list') {
    return (
      <ListScreen
        title={t('customerMgmt.title') || 'Customer Management'}
        searchPlaceholder={t('sales.searchCustomerPlaceholder') || 'Search by name, email, or phone...'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        period={period}
        onPeriodChange={setPeriod}
        isLoading={isLoading}
        onRefresh={() => fetchCustomers(searchQuery, customerType)}
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
        headerExtra={
          <div className="flex gap-2 pb-2 pt-1">
            {TYPE_FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCustomerType(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  customerType === value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-elevated'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
                {customer.isCompany
                  ? <Building2 size={18} />
                  : customer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="list-card-content">
                <div className="list-card-primary">{customer.name}</div>
                <div className="list-card-secondary">
                  <Phone size={10} /> {customer.phone ? formatPhone(customer.phone) : 'N/A'}
                </div>
                <div className="list-card-meta">
                  <Mail size={10} />
                  <span>{customer.email || 'N/A'}</span>
                  <span className="list-card-dot">&middot;</span>
                  <MapPin size={10} />
                  <span>{customer.city || 'N/A'}</span>
                </div>
              </div>
              <div className="list-card-actions">
                <span className={`list-card-badge ${customer.isCompany ? 'list-card-badge--info' : 'list-card-badge--completed'}`}>
                  {customer.isCompany
                    ? (t('customerMgmt.filterCompany') || 'Company')
                    : (t('customerMgmt.filterIndividual') || 'Individual')}
                </span>
              </div>
            </div>
          </button>
        ))}
      </ListScreen>
    );
  }

  // ------------------------------------------------------------------
  // DETAIL VIEW (with delete support)
  // ------------------------------------------------------------------
  if (subView === 'detail' && isLoadingDetail) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button onClick={goBackToList} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors" aria-label="Back">
            <ArrowLeft size={20} className="text-text-primary" />
          </button>
        </div>
        <div className="flex-1 px-4 pb-6 animate-pulse">
          <div className="flex items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-bg-elevated flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-bg-elevated" />
              <div className="h-3 w-20 rounded bg-bg-elevated" />
            </div>
          </div>
          <div className="flex flex-col gap-4 mt-1">
            {[2, 3, 1, 1].map((rows, i) => (
              <div key={i}>
                <div className="h-3 w-16 rounded bg-bg-elevated mb-2 ml-1" />
                <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
                  {Array.from({ length: rows }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-5 h-5 rounded bg-bg-elevated flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-12 rounded bg-bg-elevated" />
                        <div className="h-3.5 w-32 rounded bg-bg-elevated" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'detail' && selectedCustomer) {
    const initials = selectedCustomer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const detailSections: DetailSectionType[] = [
      {
        title: t('sales.contactInfo') || 'Contact',
        fields: [
          {
            icon: selectedCustomer.isCompany ? <Building2 size={15} /> : <User size={15} />,
            label: t('customerMgmt.customerType') || 'Type',
            value: selectedCustomer.isCompany
              ? (t('customerMgmt.filterCompany') || 'Company')
              : (t('customerMgmt.filterIndividual') || 'Individual'),
          },
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
        title: t('sales.accountInfo') || 'Account',
        fields: [
          {
            icon: <Lock size={15} />,
            label: t('sales.password') || 'Password',
            value: lastResetPassword || (t('customerMgmt.passwordHidden') || 'Password is hidden — reset to reveal'),
            renderValue: (
              <div className="flex flex-col gap-2">
                {lastResetPassword ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono truncate flex-1 text-text-primary">
                      {showPassword ? lastResetPassword : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPassword((v) => !v); }}
                      className="p-1 rounded-md hover:bg-bg-elevated transition-colors flex-shrink-0"
                      aria-label={showPassword ? (t('customerMgmt.hidePassword') || 'Hide password') : (t('customerMgmt.showPassword') || 'Show password')}
                    >
                      {showPassword ? <EyeOff size={14} className="text-text-muted" /> : <Eye size={14} className="text-text-muted" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyPassword(); }}
                      className="p-1 rounded-md hover:bg-bg-elevated transition-colors flex-shrink-0"
                      aria-label={t('customerMgmt.copyPassword') || 'Copy password'}
                      title={t('customerMgmt.copyPassword') || 'Copy password'}
                    >
                      {isPasswordCopied
                        ? <Check size={14} className="text-brand" />
                        : <Copy size={14} className="text-text-muted" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted italic">
                    {t('customerMgmt.passwordHidden') || 'Password is hidden \u2014 reset to reveal'}
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetPassword(); }}
                  disabled={isResettingPassword}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-brand text-white text-xs font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  {isResettingPassword ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('customerMgmt.resettingPassword') || 'Resetting...'}
                    </>
                  ) : (
                    <>
                      <KeyRound size={13} />
                      {t('customerMgmt.resetPasswordPhone') || 'Reset Password (Phone)'}
                    </>
                  )}
                </button>
              </div>
            ),
          },
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
      <div className="h-full" style={{ animation: 'fadeIn 150ms ease-out' }}>
        {deleteConfirmModal}
        <DetailScreen
          onBack={goBackToList}
          avatar={initials}
          title={selectedCustomer.name}
          subtitle={`ID: ${selectedCustomer.id}`}
          sections={detailSections}
          headerActions={[
            {
              icon: <Trash2 size={18} style={{ color: 'var(--color-error)' }} />,
              label: t('customerMgmt.deleteCustomer') || 'Delete Customer',
              onClick: () => setShowDeleteConfirm(true),
            },
          ]}
          fabAction={() => openEdit(selectedCustomer)}
          fabIcon={<Edit3 size={20} strokeWidth={2.5} />}
          fabLabel={t('sales.editCustomer') || 'Edit Customer'}
        />
        <style jsx>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      </div>
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
        {/* Company / Individual toggle — only shown on create; for edit, type is pre-set */}
        {subView === 'create' && (
          <div className="flex gap-2 mt-2 mb-1">
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, isCompany: false, lastName: '' }));
                setFormErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                !formData.isCompany
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              <User size={15} />
              {t('customerMgmt.filterIndividual') || 'Individual'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, isCompany: true, lastName: '' }));
                setFormErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                formData.isCompany
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              <Building2 size={15} />
              {t('customerMgmt.filterCompany') || 'Company'}
            </button>
          </div>
        )}

        <FormSection title={t('sales.personalInfo') || 'Personal Information'}>
          {formData.isCompany ? (
            <FormInput
              label={t('customerMgmt.companyName') || 'Company Name'}
              required
              value={formData.firstName}
              onChange={(e) => handleFormChange('firstName', e.target.value)}
              placeholder="Acme Corp"
              error={formErrors.firstName}
            />
          ) : (
            <FormRow columns={2}>
              <FormInput label={t('sales.firstName') || 'First Name'} required value={formData.firstName} onChange={(e) => handleFormChange('firstName', e.target.value)} placeholder="John" error={formErrors.firstName} />
              <FormInput label={t('sales.lastName') || 'Last Name'} required value={formData.lastName} onChange={(e) => handleFormChange('lastName', e.target.value)} placeholder="Doe" error={formErrors.lastName} />
            </FormRow>
          )}
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
