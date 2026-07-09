'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Boxes, Plus } from 'lucide-react';
import { useI18n } from '@/i18n';
import ListScreen from '@/components/ui/ListScreen';
import FilterChips from '@/components/ui/FilterChips';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { listFleets } from '@/lib/fleets-api';
import {
  FLEET_KIND_OPTIONS,
  fleetKindLabel,
  type FleetKind,
  type FleetRow,
  type FleetState,
  type FleetsPagination,
} from '@/lib/fleets-types';

type StateFilter = '' | FleetState;

const PAGE_SIZE = 20;

export function fleetStateBadgeClass(state: FleetState | string): string {
  return state === 'active'
    ? 'list-card-badge list-card-badge--completed'
    : 'list-card-badge list-card-badge--default';
}

interface FleetsListProps {
  onSelect: (fleet: FleetRow) => void;
  onCreate: () => void;
  /** Bumped by the parent when a fleet was created/edited/deactivated. */
  reloadKey: number;
}

export default function FleetsList({ onSelect, onCreate, reloadKey }: FleetsListProps) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<FleetKind | ''>('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('');
  const [page, setPage] = useState(1);

  const [fleets, setFleets] = useState<FleetRow[]>([]);
  const [pagination, setPagination] = useState<FleetsPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kindFilter, stateFilter]);

  const fetchFleets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getSalesRoleToken() || '';
      const res = await listFleets(
        {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          fleet_kind: kindFilter || undefined,
          state: stateFilter || undefined,
        },
        token,
      );
      setFleets(res.fleets ?? []);
      setPagination(res.pagination ?? null);
    } catch (err: any) {
      setFleets([]);
      setPagination(null);
      setError(err?.message ?? t('fleets.list.loadError') ?? 'Failed to load fleets');
    } finally {
      setLoading(false);
    }
  }, [page, kindFilter, stateFilter, debouncedSearch, t]);

  useEffect(() => {
    fetchFleets();
  }, [fetchFleets, reloadKey]);

  const stateChips = [
    { key: '', label: t('fleets.state.all') || 'All' },
    { key: 'active', label: t('fleets.state.active') || 'Active' },
    { key: 'inactive', label: t('fleets.state.inactive') || 'Inactive' },
  ];

  const kindChips = [
    { key: '', label: t('fleets.kind.all') || 'All kinds' },
    ...FLEET_KIND_OPTIONS.map((o) => ({ key: o.value, label: o.label })),
  ];

  const headerExtra = (
    <div className="flex flex-col gap-2">
      <FilterChips
        items={stateChips}
        activeKey={stateFilter}
        onSelect={(key) => setStateFilter(key as StateFilter)}
      />
      <FilterChips
        items={kindChips}
        activeKey={kindFilter}
        onSelect={(key) => setKindFilter(key as FleetKind | '')}
      />
    </div>
  );

  const total = pagination?.total ?? fleets.length;
  const totalPages = pagination?.total_pages ?? 1;

  return (
    <ListScreen
      title={t('fleets.list.title') || 'Fleets'}
      searchPlaceholder={t('fleets.list.searchPlaceholder') || 'Search fleets...'}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isLoading={loading}
      error={error}
      onRefresh={fetchFleets}
      isEmpty={fleets.length === 0}
      emptyIcon={<Boxes size={28} className="text-text-muted" />}
      emptyMessage={
        debouncedSearch
          ? (t('fleets.list.emptySearch') || 'No fleets found')
          : (t('fleets.list.empty') || 'No fleets yet')
      }
      emptyHint={
        debouncedSearch
          ? (t('fleets.list.emptySearchHint') || 'Try a different search term')
          : (t('fleets.list.emptyHint') ||
              'Fleets group serial-tracked items under an operational container governed by this service account.')
      }
      itemCount={total}
      itemLabel={
        total === 1
          ? (t('fleets.list.itemLabel') || 'fleet')
          : (t('fleets.list.itemLabelPlural') || 'fleets')
      }
      headerExtra={headerExtra}
      page={page}
      totalPages={totalPages}
      onNextPage={() => page < totalPages && setPage((p) => p + 1)}
      onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
      hasNextPage={page < totalPages}
      paginationLabel={
        pagination
          ? (t('fleets.list.pageLabel') || 'Showing page {page} of {pages}')
              .replace('{page}', String(pagination.page))
              .replace('{pages}', String(Math.max(totalPages, 1)))
          : undefined
      }
      fabAction={onCreate}
      fabLabel={t('fleets.list.newFleet') || 'New Fleet'}
    >
      {fleets.map((fleet) => (
        <button
          key={fleet.id}
          onClick={() => onSelect(fleet)}
          className="list-card w-full text-left"
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{fleet.name || `Fleet #${fleet.id}`}</div>
              <div
                className="list-card-secondary"
                style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {fleetKindLabel(fleet.fleet_kind)}
                {fleet.external_ref ? ` · ${fleet.external_ref}` : ''}
              </div>
              <div className="list-card-meta">
                <Boxes size={10} />
                <span className="list-card-meta-bold">
                  {fleet.item_count ?? 0}
                </span>
                <span>
                  {(fleet.item_count ?? 0) === 1
                    ? (t('fleets.list.serial') || 'serial')
                    : (t('fleets.list.serials') || 'serials')}
                </span>
              </div>
            </div>
            <div className="list-card-actions">
              <span className={fleetStateBadgeClass(fleet.state)}>
                {fleet.state === 'active'
                  ? (t('fleets.state.active') || 'Active')
                  : (t('fleets.state.inactive') || 'Inactive')}
              </span>
            </div>
          </div>
        </button>
      ))}
    </ListScreen>
  );
}
