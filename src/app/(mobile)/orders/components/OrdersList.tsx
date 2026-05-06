'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, CreditCard, DollarSign } from 'lucide-react';
import ListScreen from '@/components/ui/ListScreen';
import FilterChips from '@/components/ui/FilterChips';
import { getOrders, formatCurrency, type GetOrdersParams } from '@/lib/portal/order-api';
import type { OrderEntity, OrderState, PaginationMeta } from '@/lib/portal/types';

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  sale: 'Confirmed',
  done: 'Done',
  cancel: 'Cancelled',
};

const STATE_BADGE_CLASS: Record<string, string> = {
  draft: 'list-card-badge list-card-badge--default',
  sent: 'list-card-badge list-card-badge--progress',
  sale: 'list-card-badge list-card-badge--completed',
  done: 'list-card-badge list-card-badge--completed',
  cancel: 'list-card-badge list-card-badge--default',
};

const PAYMENT_LABELS: Record<string, string> = {
  not_paid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

type StateFilter = 'all' | OrderState;

interface OrdersListProps {
  onSelect: (order: OrderEntity) => void;
  onCreateNew: () => void;
}

export default function OrdersList({ onSelect, onCreateNew }: OrdersListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderEntity[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = useMemo<GetOrdersParams>(() => {
    const p: GetOrdersParams = { page, limit: 20 };
    if (stateFilter !== 'all') p.state = stateFilter;
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    return p;
  }, [stateFilter, debouncedSearch, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOrders(params);
      setOrders(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load orders');
      setOrders([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter]);

  const total = pagination?.totalRecords ?? orders.length;

  const statePills: { key: StateFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'sale', label: 'Confirmed' },
    { key: 'done', label: 'Done' },
    { key: 'cancel', label: 'Cancelled' },
  ];

  const filterChips = (
    <FilterChips
      items={statePills.map((p) => ({ key: p.key, label: p.label }))}
      activeKey={stateFilter}
      onSelect={(key) => setStateFilter(key as StateFilter)}
    />
  );

  return (
    <ListScreen
      title="Orders"
      searchPlaceholder="Search orders by name, customer..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isLoading={loading}
      error={error}
      onRefresh={fetchData}
      isEmpty={orders.length === 0}
      emptyIcon={<ClipboardList size={28} className="text-text-muted" />}
      emptyMessage={debouncedSearch ? 'No orders found' : 'No orders yet'}
      emptyHint={debouncedSearch ? 'Try a different search term' : 'Tap + to create a new order'}
      itemCount={total}
      itemLabel={total === 1 ? 'order' : 'orders'}
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
      fabAction={onCreateNew}
      fabLabel="New Order"
    >
      {orders.map((order) => (
        <button
          key={order.id}
          onClick={() => onSelect(order)}
          className="list-card w-full text-left"
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{order.name}</div>
              <div className="list-card-secondary">
                {order.partnerName}
                {order.contactPerson && ` · ${order.contactPerson}`}
              </div>
              <div className="list-card-meta">
                <DollarSign size={10} />
                <span className="list-card-meta-bold list-card-meta-mono">
                  {formatCurrency(order.amountTotal)}
                </span>
                <span className="list-card-dot">&middot;</span>
                <CreditCard size={10} />
                <span>{PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}</span>
                {order.createdAt && (
                  <>
                    <span className="list-card-dot">&middot;</span>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="list-card-actions">
              <span className={STATE_BADGE_CLASS[order.state] ?? 'list-card-badge list-card-badge--default'}>
                {STATE_LABELS[order.state] ?? order.state}
              </span>
            </div>
          </div>
        </button>
      ))}
    </ListScreen>
  );
}
