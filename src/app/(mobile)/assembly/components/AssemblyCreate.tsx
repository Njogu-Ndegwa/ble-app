'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Factory, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getProducts } from '@/lib/odoo-api';
import type { OdooProduct } from '@/lib/portal/types';
import { createAssemblyMo } from '@/lib/assembly-api';
import type { AssemblyMoDetail } from '@/lib/assembly-types';

interface AssemblyCreateProps {
  /** Called with the created MO so the parent can open its detail screen. */
  onDone: (mo: AssemblyMoDetail) => void;
  onCancel: () => void;
}

export default function AssemblyCreate({ onDone, onCancel }: AssemblyCreateProps) {
  const { t } = useI18n();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<OdooProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OdooProduct | null>(null);
  const [qty, setQty] = useState('1');
  const [creating, setCreating] = useState(false);

  // Debounced product-catalog search while no product is selected.
  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const token = getSalesRoleToken() || '';
        const res = await getProducts(
          { search: search.trim() || undefined, page: 1, limit: 8 },
          token,
        );
        if (!cancelled) setResults(res.products ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selected]);

  const handleCreate = async () => {
    if (creating) return;
    if (!selected) {
      toast.error(t('assembly.create.selectProduct') || 'Select a product first');
      return;
    }
    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      toast.error(t('assembly.create.qtyInvalid') || 'Quantity must be a positive number');
      return;
    }

    setCreating(true);
    try {
      const token = getSalesRoleToken() || '';
      const res = await createAssemblyMo(
        { product_id: selected.id, product_qty: parsedQty },
        token,
      );
      toast.success(
        (t('assembly.create.created') || '{mo} created and governed to this SA').replace(
          '{mo}',
          res.mo.name,
        ),
      );
      onDone(res.mo);
    } catch (err: any) {
      toast.error(err?.message || t('assembly.create.createError') || 'Failed to create MO');
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
          aria-label={t('common.back') || 'Back'}
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {t('assembly.create.title') || 'Create Manufacturing Order'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          {t('assembly.create.note') ||
            'The MO is created in draft and governed to this Production Location SA.'}
        </p>

        <div>
          <label className="block mb-1 text-sm font-medium text-text-secondary">
            {t('assembly.create.productLabel') || 'Product'}
          </label>
          {selected ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-tertiary px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{selected.name}</p>
                <p className="text-xs text-text-muted truncate">
                  {selected.default_code
                    ? `${selected.default_code} · #${selected.id}`
                    : `#${selected.id}`}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-text-primary text-xs font-medium active:scale-[0.98] transition-transform"
              >
                {t('assembly.create.change') || 'Change'}
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search size={14} className="text-text-muted" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('assembly.create.productPlaceholder') || 'Search products...'}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div className="mt-2 rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
                {searching ? (
                  <p className="px-3 py-4 text-sm text-text-muted">
                    {t('assembly.create.searching') || 'Searching...'}
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-text-muted">
                    {t('assembly.create.noProducts') || 'No products found'}
                  </p>
                ) : (
                  results.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelected(product)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left border-b border-border last:border-b-0 bg-bg-tertiary active:bg-bg-elevated transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary truncate">
                          {product.name}
                        </span>
                        {product.default_code && (
                          <span className="block text-xs text-text-muted truncate">
                            {product.default_code}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted">#{product.id}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-text-secondary">
            {t('assembly.create.qtyLabel') || 'Quantity'}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm active:scale-[0.98] transition-transform"
        >
          {t('common.cancel') || 'Cancel'}
        </button>
        <button
          onClick={handleCreate}
          disabled={creating || !selected}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="flex-1 py-3 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('assembly.create.creating') || 'Creating...'}
            </>
          ) : (
            <>
              <Factory size={16} />
              {t('assembly.create.submit') || 'Create MO'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
