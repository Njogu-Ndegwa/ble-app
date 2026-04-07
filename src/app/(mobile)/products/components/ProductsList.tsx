'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Tag } from 'lucide-react';
import ListScreen from '@/components/ui/ListScreen';
import { portalApolloClient } from '@/lib/portal/portal-apollo-client';
import { PRODUCT_UNITS_QUERY } from '@/lib/portal/queries';
import type {
  ProductUnitEntity,
  ProductUnitsListResponse,
  ProductUnitsFilterInput,
  PaginationMeta,
} from '@/lib/portal/types';

type CategoryFilter = 'all' | 'physical' | 'service' | 'contract' | 'digital';

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  physical: 'list-card-badge list-card-badge--progress',
  service: 'list-card-badge list-card-badge--completed',
  contract: 'list-card-badge list-card-badge--default',
  digital: 'list-card-badge list-card-badge--progress',
};

interface ProductsListProps {
  onSelect: (product: ProductUnitEntity) => void;
}

export default function ProductsList({ onSelect }: ProductsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<ProductUnitEntity[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filters = useMemo<ProductUnitsFilterInput>(() => {
    const f: ProductUnitsFilterInput = { page, limit: 20 };
    if (categoryFilter !== 'all') f.puCategory = categoryFilter;
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    return f;
  }, [categoryFilter, debouncedSearch, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await portalApolloClient.query<ProductUnitsListResponse>({
        query: PRODUCT_UNITS_QUERY,
        variables: { filters },
        fetchPolicy: 'network-only',
      });
      setProducts(data.productUnits.data);
      setPagination(data.productUnits.pagination);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load products');
      setProducts([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter]);

  const total = pagination?.totalRecords ?? products.length;

  const categoryPills: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'physical', label: 'Physical' },
    { key: 'service', label: 'Service' },
    { key: 'contract', label: 'Contract' },
    { key: 'digital', label: 'Digital' },
  ];

  const filterChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
      {categoryPills.map((pill) => (
        <button
          key={pill.key}
          onClick={() => setCategoryFilter(pill.key)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            categoryFilter === pill.key
              ? 'border-transparent text-text-inverse'
              : 'border-border bg-bg-tertiary text-text-secondary'
          }`}
          style={categoryFilter === pill.key ? { backgroundColor: 'var(--color-brand)' } : undefined}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );

  return (
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
      headerExtra={filterChips}
      page={pagination?.currentPage ?? page}
      totalPages={pagination?.totalPages ?? 1}
      onNextPage={() => setPage((p) => p + 1)}
      onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
      hasNextPage={pagination?.hasNextPage ?? false}
      paginationLabel={
        pagination
          ? `Showing page ${pagination.currentPage} of ${pagination.totalPages}`
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
              {product.sku && (
                <div className="list-card-secondary list-card-meta-mono">
                  {product.sku}
                </div>
              )}
              <div className="list-card-meta">
                <Tag size={10} />
                <span className="list-card-meta-bold list-card-meta-mono">
                  {product.currencyName ?? ''} {product.listPrice?.toLocaleString() ?? '—'}
                </span>
                <span className="list-card-dot">&middot;</span>
                <span>{product.recurringInvoice ? 'Recurring' : 'One-time'}</span>
              </div>
            </div>
            <div className="list-card-actions">
              {product.puCategory && (
                <span className={CATEGORY_BADGE_CLASS[product.puCategory] ?? 'list-card-badge list-card-badge--default'}>
                  {product.puCategory}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </ListScreen>
  );
}
