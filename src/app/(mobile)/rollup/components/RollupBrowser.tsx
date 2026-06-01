'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import FilterChips from '@/components/ui/FilterChips';
import { EmptyState } from '@/components/ui/State';
import { getRollup } from '@/lib/rollup/rollup-api';
import type {
  RollupResponse,
  RollupFilterTab,
  RollupFileType,
  RollupItemKind,
} from '@/lib/rollup/types';
import RollupBreadcrumb from './RollupBreadcrumb';
import RollupStatsRow from './RollupStatsRow';
import FolderCard from './FolderCard';
import StackSection from './StackSection';

const FILTER_CHIPS: { key: RollupFilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'folders', label: 'Folders' },
  { key: 'customers', label: 'Customers' },
  { key: 'orders', label: 'Orders' },
  { key: 'leads', label: 'Leads' },
];

function filterToParams(filter: RollupFilterTab): {
  kind?: RollupItemKind;
  types?: RollupFileType[];
} {
  switch (filter) {
    case 'folders':
      return { kind: 'folder' };
    case 'customers':
      return { kind: 'file', types: ['customer'] };
    case 'orders':
      return { kind: 'file', types: ['sale_order'] };
    case 'leads':
      return { kind: 'file', types: ['lead'] };
    default:
      return {};
  }
}

interface RollupBrowserProps {
  initialSaId: number;
  initialSaName: string;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
}

export default function RollupBrowser({
  initialSaId,
  initialSaName,
  onFileClick,
}: RollupBrowserProps) {
  const [currentSaId, setCurrentSaId] = useState(initialSaId);
  const [activeFilter, setActiveFilter] = useState<RollupFilterTab>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { kind, types } = filterToParams(activeFilter);
      const result = await getRollup({
        saId: currentSaId,
        page,
        limit: 20,
        kind,
        types,
      });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentSaId, activeFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [currentSaId, activeFilter]);

  const handleFolderClick = useCallback((saId: number) => {
    setCurrentSaId(saId);
    setActiveFilter('all');
  }, []);

  const handleBreadcrumbNavigate = useCallback((saId: number) => {
    setCurrentSaId(saId);
    setActiveFilter('all');
  }, []);

  const handleFilterChange = useCallback((key: string) => {
    setActiveFilter(key as RollupFilterTab);
  }, []);

  const listing = data?.listing;
  const totalPages = listing?.pages ?? 1;
  const showFolders = activeFilter === 'all' || activeFilter === 'folders';
  const showStacks = activeFilter !== 'folders';
  const folders = listing?.folders?.items ?? [];
  const stacks = listing?.stacks ?? [];
  const hasContent = folders.length > 0 || stacks.some((s) => s.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', paddingBottom: 'var(--space-20)' }}>
      {/* Breadcrumb */}
      {data?.path?.breadcrumb && (
        <RollupBreadcrumb
          segments={data.path.breadcrumb}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

      {/* SA Manager */}
      {data?.sa_manager && (
        <div
          className="text-caption text-muted"
          style={{ padding: 'var(--space-0-5) 0' }}
        >
          SA Manager: <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' } as React.CSSProperties}>{data.sa_manager.display_name}</span>
        </div>
      )}

      {/* Stats row */}
      {data?.rollup?.metrics && !loading && (
        <RollupStatsRow metrics={data.rollup.metrics} />
      )}

      {/* Filter tabs */}
      <div style={{ padding: 'var(--space-1) 0' }}>
        <FilterChips
          items={FILTER_CHIPS}
          activeKey={activeFilter}
          onSelect={handleFilterChange}
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: 'var(--space-4) 0',
        }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-surface)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-10) var(--space-4)',
          textAlign: 'center',
        }}>
          <div className="text-body-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Item count */}
          {listing && (
            <div className="text-caption text-muted" style={{ padding: 'var(--space-1) 0' }}>
              {listing.total} item{listing.total !== 1 ? 's' : ''}
            </div>
          )}

          {/* Empty state */}
          {!hasContent && (
            <EmptyState
              title="This folder is empty"
              description="No subfolders or records at this level."
              icon={<FolderOpen size={40} />}
            />
          )}

          {/* Folder cards */}
          {showFolders && folders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {folders.map((folder) => (
                <FolderCard
                  key={folder.sa_id}
                  folder={folder}
                  onClick={handleFolderClick}
                />
              ))}
            </div>
          )}

          {/* Stack sections */}
          {showStacks &&
            stacks.map((stack) => (
              <StackSection
                key={stack.type}
                stack={stack}
                onFileClick={onFileClick}
              />
            ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) 0',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: 'var(--font-sm)',
                  fontFamily: 'var(--font-sans)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} />
                Prev
              </button>

              <span className="text-caption text-muted">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: 'var(--font-sm)',
                  fontFamily: 'var(--font-sans)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
