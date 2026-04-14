'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  User,
  Package,
  ArrowLeft,
  Tag,
  ChevronDown,
  Percent,
  Check,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FormSection } from '@/components/ui';
import { LoadingState } from '@/components/ui/State';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getContacts, getProducts, type OdooContact } from '@/lib/odoo-api';
import type { OdooProduct, OrderEntity, CustomerEntity } from '@/lib/portal/types';
import { createQuotation, sendOrder, formatCurrency } from '@/lib/portal/order-api';
import {
  DEMO_PRICE_LISTS,
  resolvePrice,
  type PriceList,
} from '@/lib/portal/price-list-data';

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
  listPrice: number;
  priceUnit: number;
  discountPercent: number;
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
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList>(
    DEMO_PRICE_LISTS.find((pl) => pl.isDefault) ?? DEMO_PRICE_LISTS[0],
  );
  const [showPriceListPicker, setShowPriceListPicker] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [creating, setCreating] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [products, setProducts] = useState<OdooProduct[]>([]);
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
        const data = await getProducts(
          { limit: 10, search: debouncedProductSearch || undefined },
          token || undefined,
        );
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

  const handleSelectPriceList = useCallback(
    (pl: PriceList) => {
      setSelectedPriceList(pl);
      setShowPriceListPicker(false);
      setLines((prev) =>
        prev.map((line) => {
          const resolved = resolvePrice(
            pl,
            { id: line.productId, list_price: line.listPrice, pu_category: line.puCategory || '' },
            line.quantity,
          );
          return { ...line, priceUnit: resolved.unitPrice, discountPercent: resolved.discountPercent };
        }),
      );
    },
    [],
  );

  const handleAddProduct = useCallback(
    (p: OdooProduct) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === p.id);
        if (existing) {
          const newQty = existing.quantity + 1;
          const resolved = resolvePrice(
            selectedPriceList,
            { id: p.id, list_price: p.list_price, pu_category: p.pu_category },
            newQty,
          );
          return prev.map((l) =>
            l.productId === p.id
              ? { ...l, quantity: newQty, priceUnit: resolved.unitPrice, discountPercent: resolved.discountPercent }
              : l,
          );
        }
        const resolved = resolvePrice(
          selectedPriceList,
          { id: p.id, list_price: p.list_price, pu_category: p.pu_category },
          1,
        );
        return [
          ...prev,
          {
            tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            productId: p.id,
            productName: p.name,
            sku: p.default_code || null,
            puCategory: p.pu_category || null,
            listPrice: p.list_price ?? 0,
            priceUnit: resolved.unitPrice,
            discountPercent: resolved.discountPercent,
            quantity: 1,
          },
        ];
      });
      setShowProductDropdown(false);
      setProductSearch('');
    },
    [selectedPriceList],
  );

  const handleRemoveLine = (tempId: string) => {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const handleLineQtyChange = useCallback(
    (tempId: string, qty: number) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.tempId !== tempId) return l;
          const safeQty = Math.max(1, qty);
          const resolved = resolvePrice(
            selectedPriceList,
            { id: l.productId, list_price: l.listPrice, pu_category: l.puCategory || '' },
            safeQty,
          );
          return {
            ...l,
            quantity: safeQty,
            priceUnit: resolved.unitPrice,
            discountPercent: resolved.discountPercent,
          };
        }),
      );
    },
    [selectedPriceList],
  );

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.priceUnit * l.quantity, 0),
    [lines],
  );

  const totalSavings = useMemo(
    () => lines.reduce((s, l) => s + (l.listPrice - l.priceUnit) * l.quantity, 0),
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

      try {
        await sendOrder(Number(result.order.id));
      } catch {
        // Send may fail but quotation is still created
      }

      toast.success('Order created!');
      onCreated(result.order);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create order.');
    } finally {
      setCreating(false);
    }
  };

  const hasActiveDiscount = !selectedPriceList.isDefault && selectedPriceList.rules.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">New Order</h2>
        {hasActiveDiscount && (
          <span
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
          >
            <Percent size={10} />
            {selectedPriceList.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* ─── Price List Section ─── */}
        <FormSection title="Price List">
          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
            <button
              onClick={() => setShowPriceListPicker(!showPriceListPicker)}
              className="w-full px-4 py-3 flex items-center justify-between transition-colors hover:bg-bg-elevated"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: hasActiveDiscount
                      ? 'var(--color-success-soft)'
                      : 'var(--bg-elevated)',
                  }}
                >
                  <Tag
                    size={16}
                    style={{
                      color: hasActiveDiscount
                        ? 'var(--color-success)'
                        : 'var(--text-muted)',
                    }}
                  />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {selectedPriceList.name}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    {selectedPriceList.description}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className="text-text-muted shrink-0 ml-2 transition-transform"
                style={showPriceListPicker ? { transform: 'rotate(180deg)' } : undefined}
              />
            </button>

            {showPriceListPicker && (
              <div className="border-t border-border">
                <div className="px-3 py-2">
                  <p className="text-[10px] uppercase font-medium text-text-muted tracking-wider mb-1.5">
                    Available Price Lists
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {DEMO_PRICE_LISTS.map((pl) => {
                    const isSelected = pl.id === selectedPriceList.id;
                    const rulesCount = pl.rules.length;
                    const topDiscount = pl.rules.reduce(
                      (max, r) => Math.max(max, r.discountPercent ?? 0),
                      0,
                    );

                    return (
                      <button
                        key={pl.id}
                        onClick={() => handleSelectPriceList(pl)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-t border-border/50"
                        style={
                          isSelected
                            ? { backgroundColor: 'var(--color-brand-soft, rgba(255,200,0,0.08))' }
                            : undefined
                        }
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: 'var(--color-brand)',
                                  borderColor: 'var(--color-brand)',
                                }
                              : { borderColor: 'var(--border-default)' }
                          }
                        >
                          {isSelected && <Check size={12} className="text-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {pl.name}
                            </span>
                            {topDiscount > 0 && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: 'var(--color-success-soft)',
                                  color: 'var(--color-success)',
                                }}
                              >
                                up to {topDiscount}% off
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {pl.description}
                          </p>
                          {rulesCount > 0 && (
                            <p className="text-[10px] text-text-muted mt-1">
                              {rulesCount} pricing rule{rulesCount > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasActiveDiscount && !showPriceListPicker && (
              <div
                className="px-4 py-2.5 border-t border-border flex items-center gap-2"
                style={{ backgroundColor: 'var(--color-success-soft)' }}
              >
                <Info size={13} style={{ color: 'var(--color-success)' }} />
                <span className="text-[11px] text-text-secondary">
                  Prices will be adjusted automatically based on{' '}
                  <strong style={{ color: 'var(--color-success)' }}>
                    {selectedPriceList.name}
                  </strong>{' '}
                  rules when you add products.
                </span>
              </div>
            )}
          </div>
        </FormSection>

        {/* ─── Customer Section ─── */}
        <FormSection title="Customer">
          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
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

        {/* ─── Products Section ─── */}
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
                    {products.map((p) => {
                      const resolved = resolvePrice(
                        selectedPriceList,
                        { id: p.id, list_price: p.list_price, pu_category: p.pu_category },
                        1,
                      );
                      const hasDiscount = resolved.discountPercent > 0;
                      return (
                        <button
                          key={p.id}
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
                          <div className="flex items-center gap-1.5">
                            {hasDiscount && (
                              <span
                                className="text-[10px] line-through text-text-muted"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {formatCurrency(p.list_price)}
                              </span>
                            )}
                            <span
                              className="text-xs font-semibold"
                              style={{
                                fontFamily: 'var(--font-mono)',
                                color: hasDiscount ? 'var(--color-success)' : 'var(--text-secondary)',
                              }}
                            >
                              {formatCurrency(resolved.unitPrice)}
                            </span>
                            {hasDiscount && (
                              <span
                                className="text-[9px] font-bold px-1 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                              >
                                -{resolved.discountPercent}%
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
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
                {lines.map((line) => {
                  const hasDiscount = line.discountPercent > 0;
                  return (
                    <div key={line.tempId} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {line.productName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasDiscount ? (
                            <>
                              <span
                                className="text-[10px] line-through text-text-muted"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {formatCurrency(line.listPrice)}
                              </span>
                              <span
                                className="text-xs font-semibold"
                                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}
                              >
                                {formatCurrency(line.priceUnit)}
                              </span>
                              <span
                                className="text-[9px] font-bold px-1 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                              >
                                -{line.discountPercent}%
                              </span>
                            </>
                          ) : (
                            <span
                              className="text-xs text-text-muted"
                              style={{ fontFamily: 'var(--font-mono)' }}
                            >
                              {formatCurrency(line.priceUnit)} each
                            </span>
                          )}
                        </div>
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
                  );
                })}
              </div>
            )}

            {lines.length > 0 && (
              <div className="px-4 py-3 border-t border-border space-y-1.5">
                {totalSavings > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Percent size={10} />
                      Discount savings
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
                    >
                      -{formatCurrency(totalSavings)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-text-primary">Total</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
                  >
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </div>

      {/* ─── Bottom Actions ─── */}
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
