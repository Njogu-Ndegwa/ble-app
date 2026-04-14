'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Tag } from 'lucide-react';
import ListScreen from '@/components/ui/ListScreen';
import { getProducts } from '@/lib/odoo-api';
import type {
  OdooProduct,
  OdooCatalogRoot,
  OdooProductsPagination,
} from '@/lib/portal/types';

const DEFAULT_CATEGORY_ID = 115;

function parseLastSegment(completeName: string): string {
  const parts = completeName.split('/');
  return parts[parts.length - 1].trim();
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  consu: 'Consumable',
  service: 'Service',
  product: 'Storable',
};

interface ProductsListProps {
  onSelect: (product: OdooProduct) => void;
}

export default function ProductsList({ onSelect }: ProductsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number>(DEFAULT_CATEGORY_ID);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [pagination, setPagination] = useState<OdooProductsPagination | null>(null);
  const [catalogRoots, setCatalogRoots] = useState<OdooCatalogRoot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts({
        page,
        limit: 20,
        category_id: categoryId,
        search: debouncedSearch.trim() || undefined,
      });
      setProducts(data.products);
      setPagination(data.pagination);
      if (data.catalog_roots?.length) {
        setCatalogRoots(data.catalog_roots);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load products');
      setProducts([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, categoryId, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId]);

  const total = pagination?.total ?? products.length;

  return (
    <div className="flex flex-col h-full">
      {/* Category filter pills - always visible once loaded */}
      {catalogRoots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1 no-scrollbar">
          {catalogRoots.map((root) => (
            <button
              key={root.id}
              onClick={() => setCategoryId(root.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                categoryId === root.id
                  ? 'border-transparent text-text-inverse'
                  : 'border-border bg-bg-tertiary text-text-secondary'
              }`}
              style={categoryId === root.id ? { backgroundColor: 'var(--color-brand)' } : undefined}
            >
              {root.id === DEFAULT_CATEGORY_ID ? 'All' : parseLastSegment(root.complete_name)}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ListScreen
          title="Products"
          searchPlaceholder="Search products by name, SKU..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={loading}
          error={error}
          onRefresh={fetchData}
          isEmpty={products.length === 0}
          emptyIcon={<Package size={28} className="text-text-muted" />}
          emptyMessage={debouncedSearch ? 'No products found' : 'No products yet'}
          emptyHint={debouncedSearch ? 'Try a different search term' : 'Products are managed on the backend'}
          itemCount={total}
          itemLabel={total === 1 ? 'product' : 'products'}
          page={pagination?.page ?? page}
          totalPages={pagination?.total_pages ?? 1}
          onNextPage={() => setPage((p) => p + 1)}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          hasNextPage={pagination?.has_next ?? false}
          paginationLabel={
            pagination
              ? `Showing page ${pagination.page} of ${pagination.total_pages}`
              : undefined
          }
        >
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onSelect(product)}
          className="list-card w-full text-left"
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{product.name}</div>
              <div className="list-card-secondary">
                {product.description_sale || PRODUCT_TYPE_LABELS[product.type] || product.type}
              </div>
              <div className="list-card-meta">
                <Tag size={10} />
                <span className="list-card-meta-bold list-card-meta-mono">
                  {product.list_price?.toLocaleString() ?? '—'}
                </span>
                <span className="list-card-dot">&middot;</span>
                <span>{product.recurring_invoice ? 'Recurring' : 'One-time'}</span>
              </div>
            </div>
            <div className="list-card-actions">
              {product.category?.complete_name && (
                <span className="list-card-badge list-card-badge--default">
                  {parseLastSegment(product.category.complete_name)}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
        </ListScreen>
      </div>
    </div>
  );
}
