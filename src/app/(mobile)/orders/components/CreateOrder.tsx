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
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingState } from '@/components/ui/State';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getContacts, getProducts, type OdooContact } from '@/lib/odoo-api';
import type { OdooProduct, OrderEntity, CustomerEntity } from '@/lib/portal/types';
import { createQuotation, sendOrder, formatCurrency, getPriceLists } from '@/lib/portal/order-api';
import {
  DEMO_PRICE_LISTS,
  resolvePrice,
  mapOdooPriceList,
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
  const [priceLists, setPriceLists] = useState<PriceList[]>(DEMO_PRICE_LISTS);
  const [priceListsLoading, setPriceListsLoading] = useState(true);
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
    let cancelled = false;
    (async () => {
      try {
        const raw = await getPriceLists();
        if (cancelled || raw.length === 0) return;
        const mapped = raw.map(mapOdooPriceList);
        setPriceLists(mapped);
        setSelectedPriceList(mapped.find((pl) => pl.isDefault) ?? mapped[0]);
      } catch {
        // Keep demo fallback
      } finally {
        if (!cancelled) setPriceListsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">New Quotation</h2>
      </div>

      {/* ─── Context bar: Customer + Price List as compact pills ─── */}
      <div className="px-4 pb-2 flex gap-2">
        <button
          onClick={() => {
            setShowCustomerDropdown(!showCustomerDropdown);
            if (!showCustomerDropdown) setShowPriceListPicker(false);
          }}
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors active:scale-[0.98]"
          style={{
            borderColor: selectedCustomer ? 'var(--color-brand)' : 'var(--border-default)',
            backgroundColor: selectedCustomer ? 'var(--color-brand-soft, rgba(255,200,0,0.06))' : 'var(--bg-tertiary)',
          }}
        >
          <User size={14} className="shrink-0" style={{ color: selectedCustomer ? 'var(--color-brand)' : 'var(--text-muted)' }} />
          <span className="text-sm truncate" style={{ color: selectedCustomer ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {selectedCustomer ? selectedCustomer.name : 'Customer'}
          </span>
          {selectedCustomer ? (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
              className="ml-auto shrink-0 p-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          ) : (
            <ChevronDown size={14} className="ml-auto shrink-0 text-text-muted" />
          )}
        </button>

        <button
          onClick={() => {
            setShowPriceListPicker(!showPriceListPicker);
            if (!showPriceListPicker) setShowCustomerDropdown(false);
          }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-colors active:scale-[0.98]"
          style={{
            borderColor: hasActiveDiscount ? 'var(--color-success)' : 'var(--border-default)',
            backgroundColor: hasActiveDiscount ? 'var(--color-success-soft)' : 'var(--bg-tertiary)',
          }}
        >
          <Tag size={13} style={{ color: hasActiveDiscount ? 'var(--color-success)' : 'var(--text-muted)' }} />
          <span
            className="text-xs font-medium max-w-[100px] truncate"
            style={{ color: hasActiveDiscount ? 'var(--color-success)' : 'var(--text-secondary)' }}
          >
            {selectedPriceList.name}
          </span>
          <ChevronDown
            size={12}
            className="shrink-0 transition-transform"
            style={{
              color: hasActiveDiscount ? 'var(--color-success)' : 'var(--text-muted)',
              transform: showPriceListPicker ? 'rotate(180deg)' : undefined,
            }}
          />
        </button>
      </div>

      {/* ─── Customer search dropdown (expands below context bar) ─── */}
      {showCustomerDropdown && (
        <div className="mx-4 mb-2 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
          <div className="p-3">
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
          </div>
          <div className="border-t border-border">
            {customersLoading ? (
              <div className="py-4"><LoadingState size="sm" inline /></div>
            ) : customers.length === 0 ? (
              <p className="text-xs py-4 text-center text-text-muted">No customers found.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-elevated border-b border-border/30 last:border-0"
                  >
                    <span className="font-medium text-text-primary">{c.name}</span>
                    {(c.email || c.phone) && (
                      <span className="text-[11px] ml-2 text-text-muted">{c.email || c.phone}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Price list picker dropdown ─── */}
      {showPriceListPicker && (
        <div className="mx-4 mb-2 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {priceListsLoading ? (
              <div className="py-4"><LoadingState size="sm" inline /></div>
            ) : priceLists.map((pl) => {
              const isSelected = pl.id === selectedPriceList.id;
              const topDiscount = pl.rules.reduce(
                (max, r) => Math.max(max, r.discountPercent ?? 0),
                0,
              );
              return (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPriceList(pl)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-border/30 last:border-0"
                  style={
                    isSelected
                      ? { backgroundColor: 'var(--color-brand-soft, rgba(255,200,0,0.08))' }
                      : undefined
                  }
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                        : { borderColor: 'var(--border-default)' }
                    }
                  >
                    {isSelected && <Check size={12} className="text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{pl.name}</span>
                      {topDiscount > 0 && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                        >
                          up to {topDiscount}% off
                        </span>
                      )}
                    </div>
                    {pl.description && (
                      <p className="text-[11px] text-text-muted mt-0.5">{pl.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Main cart area ─── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Add product button / search */}
        <button
          onClick={() => {
            setShowProductDropdown(!showProductDropdown);
            setShowCustomerDropdown(false);
            setShowPriceListPicker(false);
          }}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-border text-text-muted transition-colors hover:bg-bg-elevated hover:border-text-muted active:scale-[0.99] mb-3"
        >
          <Plus size={16} />
          <span className="text-sm">Add product</span>
          {hasActiveDiscount && (
            <span
              className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
            >
              <Percent size={9} className="inline -mt-px mr-0.5" />
              {selectedPriceList.name}
            </span>
          )}
        </button>

        {/* Product search dropdown */}
        {showProductDropdown && (
          <div className="mb-3 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
            <div className="p-3">
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
            </div>
            <div className="border-t border-border">
              {productsLoading ? (
                <div className="py-4"><LoadingState size="sm" inline /></div>
              ) : products.length === 0 ? (
                <p className="text-xs py-4 text-center text-text-muted">No products found.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
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
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-elevated flex justify-between items-center border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-text-primary">{p.name}</span>
                          {p.pu_category && (
                            <span className="list-card-badge list-card-badge--progress ml-2">
                              {p.pu_category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
          </div>
        )}

        {/* Cart lines */}
        {lines.length === 0 && !showProductDropdown ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <ShoppingCart size={24} className="text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-secondary mb-1">No products yet</p>
            <p className="text-xs text-text-muted">Tap &ldquo;Add product&rdquo; above to get started</p>
          </div>
        ) : lines.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
            <div className="divide-y divide-border">
              {lines.map((line) => {
                const hasDiscount = line.discountPercent > 0;
                return (
                  <div key={line.tempId} className="px-3 py-3">
                    {/* Row 1: product name + remove */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-text-primary leading-tight">
                        {line.productName}
                      </p>
                      <button
                        onClick={() => handleRemoveLine(line.tempId)}
                        className="p-0.5 shrink-0 rounded"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* Row 2: price × qty = subtotal */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {hasDiscount && (
                          <span
                            className="text-[10px] line-through text-text-muted"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {formatCurrency(line.listPrice)}
                          </span>
                        )}
                        <span
                          className="text-xs font-medium"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: hasDiscount ? 'var(--color-success)' : 'var(--text-secondary)',
                          }}
                        >
                          {formatCurrency(line.priceUnit)}
                        </span>
                        {hasDiscount && (
                          <span
                            className="text-[9px] font-bold px-1 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                          >
                            -{line.discountPercent}%
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-muted mx-0.5">&times;</span>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineQtyChange(line.tempId, parseInt(e.target.value) || 1)
                        }
                        className="w-12 text-center text-xs font-medium rounded-lg border border-border py-1 outline-none bg-bg-tertiary text-text-primary"
                      />
                      <span className="text-xs text-text-muted mx-0.5">=</span>
                      <span
                        className="text-sm font-semibold text-text-primary ml-auto"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {formatCurrency(line.priceUnit * line.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="px-3 py-3 border-t border-border space-y-1">
              {totalSavings > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <Percent size={9} />
                    Savings
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
                  >
                    -{formatCurrency(totalSavings)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-bold text-text-primary">
                  Total
                  <span className="text-[11px] font-normal text-text-muted ml-1.5">
                    {lines.length} item{lines.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <span
                  className="text-base font-bold"
                  style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom action ─── */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={handleSubmit}
          disabled={creating || !selectedCustomer || lines.length === 0}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="w-full py-3.5 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            'Create Quotation'
          )}
        </button>
      </div>
    </div>
  );
}
