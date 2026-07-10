'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Factory } from 'lucide-react';
import { useI18n } from '@/i18n';
import ListScreen from '@/components/ui/ListScreen';
import FilterChips from '@/components/ui/FilterChips';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getSelectedSA } from '@/lib/sa-auth';
import { listAssemblyMos } from '@/lib/assembly-api';
import type { AssemblyMoRow, AssemblyMoState, AssemblyPagination } from '@/lib/assembly-types';

type StateFilter = '' | AssemblyMoState;

const PAGE_SIZE = 20;

export const MO_STATE_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  progress: 'In progress',
  to_close: 'To close',
  done: 'Done',
  cancel: 'Cancelled',
};

export function moStateBadgeClass(state?: string): string {
  switch (state) {
    case 'done':
      return 'list-card-badge list-card-badge--completed';
    case 'progress':
    case 'to_close':
      return 'list-card-badge list-card-badge--progress';
    case 'cancel':
      return 'list-card-badge list-card-badge--overdue';
    case 'confirmed':
      return 'list-card-badge list-card-badge--info';
    default:
      return 'list-card-badge list-card-badge--default';
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '--';
  try {
    // Odoo dates are UTC without a timezone suffix.
    const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

interface AssemblyQueueProps {
  onSelect: (mo: AssemblyMoRow) => void;
  /** Opens the manager-only Create MO screen. */
  onCreate: () => void;
  /** Bumped by the parent when a detail action changed MO state. */
  reloadKey: number;
}

export default function AssemblyQueue({ onSelect, onCreate, reloadKey }: AssemblyQueueProps) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('');
  const [page, setPage] = useState(1);

  const [mos, setMos] = useState<AssemblyMoRow[]>([]);
  const [pagination, setPagination] = useState<AssemblyPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manager signal gating the Create MO FAB. Seeded from the stored SA
  // membership after mount (localStorage — keeps SSR/first paint stable),
  // then overridden by the authoritative list `context` when the backend
  // returns one.
  const [canCreateMo, setCanCreateMo] = useState(false);

  useEffect(() => {
    const sa = getSelectedSA('sales');
    setCanCreateMo(sa?.is_sa_manager === true || sa?.is_platform_admin === true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getSalesRoleToken() || '';
      const res = await listAssemblyMos(
        {
          page,
          limit: PAGE_SIZE,
          state: stateFilter || undefined,
          search: debouncedSearch.trim() || undefined,
        },
        token,
      );
      setMos(res.mos ?? []);
      setPagination(res.pagination ?? null);
      if (res.context) setCanCreateMo(res.context.is_sa_manager);
    } catch (err: any) {
      setMos([]);
      setPagination(null);
      setError(err?.message ?? t('assembly.queue.loadError') ?? 'Failed to load assembly orders');
    } finally {
      setLoading(false);
    }
  }, [page, stateFilter, debouncedSearch, t]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue, reloadKey]);

  const stateChips = [
    { key: '', label: t('assembly.state.all') || 'All' },
    { key: 'confirmed', label: t('assembly.state.ready') || 'Ready' },
    { key: 'progress', label: t('assembly.state.progress') || 'In progress' },
    { key: 'to_close', label: t('assembly.state.toClose') || 'To close' },
    { key: 'done', label: t('assembly.state.done') || 'Done' },
  ];

  const headerExtra = (
    <FilterChips
      items={stateChips}
      activeKey={stateFilter}
      onSelect={(key) => setStateFilter(key as StateFilter)}
    />
  );

  const total = pagination?.total ?? mos.length;
  const totalPages = pagination?.total_pages ?? 1;

  return (
    <ListScreen
      title={t('assembly.queue.title') || 'Assembly Cell'}
      searchPlaceholder={t('assembly.queue.searchPlaceholder') || 'Search MO or product...'}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isLoading={loading}
      error={error}
      onRefresh={fetchQueue}
      isEmpty={mos.length === 0}
      emptyIcon={<Factory size={28} className="text-text-muted" />}
      emptyMessage={t('assembly.queue.empty') || 'No MOs in this queue'}
      emptyHint={
        t('assembly.queue.emptyHint') ||
        'Change the state filter or search. An SA manager can create a new MO for this Production Location.'
      }
      itemCount={total}
      itemLabel={
        total === 1
          ? (t('assembly.queue.itemLabel') || 'order')
          : (t('assembly.queue.itemLabelPlural') || 'orders')
      }
      headerExtra={headerExtra}
      fabAction={canCreateMo ? onCreate : undefined}
      fabLabel={t('assembly.queue.createMo') || 'Create MO'}
      page={page}
      totalPages={totalPages}
      onNextPage={() => page < totalPages && setPage((p) => p + 1)}
      onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
      hasNextPage={page < totalPages}
      paginationLabel={
        pagination
          ? (t('assembly.queue.pageLabel') || 'Showing page {page} of {pages}')
              .replace('{page}', String(pagination.page))
              .replace('{pages}', String(Math.max(totalPages, 1)))
          : undefined
      }
    >
      {mos.map((mo) => (
        <button
          key={mo.id}
          onClick={() => onSelect(mo)}
          className="list-card w-full text-left"
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">
                <span className="text-text-muted mr-1.5">#{mo.id}</span>
                {mo.name}
              </div>
              <div
                className="list-card-secondary"
                style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {mo.product?.name || (t('assembly.queue.noProduct') || 'No product')}
              </div>
              <div className="list-card-meta">
                <span className="list-card-meta-bold list-card-meta-mono">
                  {mo.qty_produced ?? 0} / {mo.qty_planned ?? 0}
                </span>
                <span className="list-card-dot">&middot;</span>
                <span>{formatDate(mo.create_date)}</span>
              </div>
            </div>
            <div className="list-card-actions">
              <span className={moStateBadgeClass(mo.state)}>
                {MO_STATE_LABEL[mo.state] ?? mo.state}
              </span>
              {mo.governed_to_context_sa === false && (
                <span className="list-card-badge list-card-badge--default">
                  {t('assembly.queue.unclaimed') || 'Unclaimed'}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </ListScreen>
  );
}
