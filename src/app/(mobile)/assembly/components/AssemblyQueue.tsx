'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Factory, FileSearch, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import ListScreen from '@/components/ui/ListScreen';
import FilterChips from '@/components/ui/FilterChips';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  listAssemblyMos,
  lookupAssemblyMoByCkd,
  governMoToSa,
} from '@/lib/assembly-api';
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
  onSelect: (mo: AssemblyMoRow, foundByCkd?: string | null) => void;
  /** Bumped by the parent when a detail action changed MO state. */
  reloadKey: number;
}

export default function AssemblyQueue({ onSelect, reloadKey }: AssemblyQueueProps) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('');
  const [page, setPage] = useState(1);

  const [mos, setMos] = useState<AssemblyMoRow[]>([]);
  const [pagination, setPagination] = useState<AssemblyPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ckdInput, setCkdInput] = useState('');
  const [ckdLoading, setCkdLoading] = useState(false);
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);

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

  const handleCkdLookup = useCallback(async () => {
    const lot = ckdInput.trim();
    if (!lot || ckdLoading) return;
    setCkdLoading(true);
    try {
      const token = getSalesRoleToken() || '';
      const res = await lookupAssemblyMoByCkd(lot, token);
      toast.success(
        (t('assembly.queue.ckdMatched') || 'CKD lot matched {mo}').replace('{mo}', res.mo.name),
      );
      setCkdInput('');
      onSelect(res.mo, res.ckd_lot || lot);
    } catch (err: any) {
      toast.error(err?.message || t('assembly.queue.ckdError') || 'CKD lot not found');
    } finally {
      setCkdLoading(false);
    }
  }, [ckdInput, ckdLoading, onSelect, t]);

  const handleClaim = useCallback(async () => {
    const moId = Number(claimInput.trim());
    if (!Number.isInteger(moId) || moId <= 0) {
      toast.error(t('assembly.queue.claimInvalid') || 'Enter a valid MO ID');
      return;
    }
    if (claiming) return;
    setClaiming(true);
    try {
      const token = getSalesRoleToken() || '';
      const res = await governMoToSa(moId, token);
      toast.success(
        res.already_assigned
          ? (t('assembly.queue.claimAlready') || 'MO #{id} was already assigned to this SA').replace('{id}', String(moId))
          : (t('assembly.queue.claimed') || 'MO #{id} assigned to this SA').replace('{id}', String(moId)),
      );
      setClaimInput('');
      fetchQueue();
    } catch (err: any) {
      toast.error(err?.message || t('assembly.queue.claimError') || 'Failed to claim MO');
    } finally {
      setClaiming(false);
    }
  }, [claimInput, claiming, fetchQueue, t]);

  const stateChips = [
    { key: '', label: t('assembly.state.all') || 'All' },
    { key: 'confirmed', label: t('assembly.state.ready') || 'Ready' },
    { key: 'progress', label: t('assembly.state.progress') || 'In progress' },
    { key: 'to_close', label: t('assembly.state.toClose') || 'To close' },
    { key: 'done', label: t('assembly.state.done') || 'Done' },
  ];

  const headerExtra = (
    <div className="flex flex-col gap-2">
      <FilterChips
        items={stateChips}
        activeKey={stateFilter}
        onSelect={(key) => setStateFilter(key as StateFilter)}
      />

      {/* CKD lot lookup — the primary entry point for assembly operators. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FileSearch size={14} className="text-text-muted" />
          </div>
          <input
            type="text"
            value={ckdInput}
            onChange={(e) => setCkdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCkdLookup()}
            placeholder={t('assembly.queue.ckdPlaceholder') || 'Scan or enter CKD lot'}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm font-mono placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        <button
          onClick={handleCkdLookup}
          disabled={ckdLoading || !ckdInput.trim()}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="shrink-0 px-4 py-2 rounded-xl text-black font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {ckdLoading
            ? (t('assembly.queue.finding') || 'Finding...')
            : (t('assembly.queue.findMo') || 'Find MO')}
        </button>
      </div>

      {/* Claim a known MO into this Production Location SA. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <ShieldCheck size={14} className="text-text-muted" />
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={claimInput}
            onChange={(e) => setClaimInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
            placeholder={t('assembly.queue.claimPlaceholder') || 'MO ID to claim'}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming || !claimInput.trim()}
          className="shrink-0 px-4 py-2 rounded-xl border border-border bg-bg-tertiary text-text-primary font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {claiming
            ? (t('assembly.queue.claiming') || 'Claiming...')
            : (t('assembly.queue.claim') || 'Claim')}
        </button>
      </div>
    </div>
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
        'Enter a CKD lot, change the state filter, or claim a known MO into this Production Location.'
      }
      itemCount={total}
      itemLabel={
        total === 1
          ? (t('assembly.queue.itemLabel') || 'order')
          : (t('assembly.queue.itemLabelPlural') || 'orders')
      }
      headerExtra={headerExtra}
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
            </div>
          </div>
        </button>
      ))}
    </ListScreen>
  );
}
