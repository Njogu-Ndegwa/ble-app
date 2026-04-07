'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Plus, X, User, Package, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { FormSection } from '@/components/ui';
import { LoadingState } from '@/components/ui/State';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getContacts, type OdooContact } from '@/lib/odoo-api';
import { createQuotation, formatCurrency } from '@/lib/portal/order-api';
import type { OrderEntity, CustomerEntity } from '@/lib/portal/types';

interface CreateOrderProps {
  onCreated: (order: OrderEntity) => void;
  onCancel: () => void;
}

interface OrderLine {
  tempId: string;
  productId: number;
  productName: string;
  sku: string | null;
  puCategory: string | null;
  priceUnit: number;
  quantity: number;
}

function mapContact(c: OdooContact): CustomerEntity {
  return {
    id: String(c.id),
    name: c.name,
    email: (c.email as string) || null,
    phone: (c.phone as string) || null,
    mobile: (c.mobile as string) || null,
    street: (c.street as string) || null,
    city: (c.city as string) || null,
    zip: (c.zip as string) || null,
    isCompany: c.is_company,
    companyId: c.company_id ?? null,
    companyName: c.company_name ?? null,
    countryName: c.country_name ?? null,
    assignedEmployeeId: c.assigned_employee_id ?? null,
    assignedEmployeeName: c.assigned_employee_name ?? null,
    createdAt: c.create_date ?? null,
    updatedAt: c.write_date ?? null,
  };
}

export default function CreateOrder({ onCreated, onCancel }: CreateOrderProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerEntity | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [creating, setCreating] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    if (!showCustomerDropdown) return;
    let cancelled = false;
    const fetchData = async () => {
      setCustomersLoading(true);
      try {
        const token = getSalesRoleToken();
        const result = await getContacts(
          { q: debouncedCustomerSearch || undefined, limit: 10 },
          token || undefined,
        );
        if (!cancelled) setCustomers(result.contacts.map(mapContact));
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [showCustomerDropdown, debouncedCustomerSearch]);

  useEffect(() => {
    if (!showProductDropdown) return;
    let cancelled = false;
    const fetchData = async () => {
      setProductsLoading(true);
      try {
        const token = getSalesRoleToken();
        const url = new URL(
          `${process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com'}/api/products`,
        );
        url.searchParams.set('limit', '10');
        url.searchParams.set('active', 'true');
        if (debouncedProductSearch) url.searchParams.set('search', debouncedProductSearch);

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const saId =
          typeof window !== 'undefined'
            ? localStorage.getItem('oves-sales-sa-id')
            : null;
        if (saId) headers['X-SA-ID'] = saId;

        const res = await fetch(url.toString(), { headers });
        const data = await res.json();
        if (!cancelled) setProducts(data.products ?? []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [showProductDropdown, debouncedProductSearch]);

  const handleSelectCustomer = useCallback((c: CustomerEntity) => {
    setSelectedCustomer(c);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  }, []);

  const handleAddProduct = useCallback((p: any) => {
    const pid = p.product_id ?? p.id;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === pid);
      if (existing) {
        return prev.map((l) =>
          l.productId === pid ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          productId: pid,
          productName: p.name,
          sku: p.default_code || null,
          puCategory: p.pu_category || null,
          priceUnit: p.list_price ?? 0,
          quantity: 1,
        },
      ];
    });
    setShowProductDropdown(false);
    setProductSearch('');
  }, []);

  const handleRemoveLine = (tempId: string) => {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const handleLineQtyChange = (tempId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, quantity: Math.max(1, qty) } : l)),
    );
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.priceUnit * l.quantity, 0),
    [lines],
  );

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Select a customer first.');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one product.');
      return;
    }

    setCreating(true);
    try {
      const result = await createQuotation({
        customer_id: Number(selectedCustomer.id),
        products: lines.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          price_unit: l.priceUnit,
        })),
      });

      if (!result.success || !result.order?.id) {
        toast.error(result.message ?? 'Failed to create order.');
        return;
      }

      toast.success('Order created!');
      onCreated(result.order);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create order.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">New Order</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Customer section */}
        <FormSection title="Customer">
          <div
            className="rounded-xl border border-border bg-bg-tertiary overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <User size={15} className="text-text-muted" />
                <span className="text-sm font-medium text-text-primary">
                  {selectedCustomer ? selectedCustomer.name : 'No customer selected'}
                </span>
              </div>
              <button
                onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-border"
                style={{ color: 'var(--color-brand)' }}
              >
                {selectedCustomer ? 'Change' : 'Select'}
              </button>
            </div>

            {showCustomerDropdown && (
              <div className="px-4 py-3 border-b border-border space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={14} className="text-text-muted" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {customersLoading ? (
                  <LoadingState size="sm" inline />
                ) : customers.length === 0 ? (
                  <p className="text-xs py-3 text-center text-text-muted">No customers found.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-bg-elevated"
                      >
                        <span className="font-medium text-text-primary">{c.name}</span>
                        {c.email && (
                          <span className="text-xs ml-2 text-text-muted">{c.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">
                    {selectedCustomer.email || selectedCustomer.phone || 'No contact info'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-md"
                  style={{ color: 'var(--color-error)' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </FormSection>

        {/* Products section */}
        <FormSection title="Products">
          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-text-muted" />
                <span className="text-sm font-medium text-text-primary">
                  {lines.length > 0 ? `${lines.length} item${lines.length > 1 ? 's' : ''}` : 'No products added'}
                </span>
              </div>
              <button
                onClick={() => setShowProductDropdown(!showProductDropdown)}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-border"
                style={{ color: 'var(--color-brand)' }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {showProductDropdown && (
              <div className="px-4 py-3 border-b border-border space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={14} className="text-text-muted" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {productsLoading ? (
                  <LoadingState size="sm" inline />
                ) : products.length === 0 ? (
                  <p className="text-xs py-3 text-center text-text-muted">No products found.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {products.map((p: any) => (
                      <button
                        key={p.product_id ?? p.id}
                        onClick={() => handleAddProduct(p)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-bg-elevated flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium text-text-primary">{p.name}</span>
                          {p.pu_category && (
                            <span className="list-card-badge list-card-badge--progress ml-2">
                              {p.pu_category}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-text-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(p.list_price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lines.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Package size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-xs text-text-muted">No products added yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lines.map((line) => (
                  <div key={line.tempId} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {line.productName}
                      </p>
                      <p className="text-xs text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(line.priceUnit)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineQtyChange(line.tempId, parseInt(e.target.value) || 1)
                        }
                        className="w-14 text-center text-sm rounded-lg border border-border py-1 outline-none bg-bg-tertiary text-text-primary"
                      />
                      <span
                        className="text-sm font-semibold w-20 text-right text-text-primary"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {formatCurrency(line.priceUnit * line.quantity)}
                      </span>
                      <button
                        onClick={() => handleRemoveLine(line.tempId)}
                        className="p-1"
                        style={{ color: 'var(--color-error)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lines.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex justify-between items-center">
                <span className="text-sm font-bold text-text-primary">Total</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(total)}
                </span>
              </div>
            )}
          </div>
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm active:scale-[0.98] transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={creating || !selectedCustomer || lines.length === 0}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="flex-1 py-3 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            'Create Order'
          )}
        </button>
      </div>
    </div>
  );
}
