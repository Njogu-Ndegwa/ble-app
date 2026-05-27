'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import FilterChips from '@/components/ui/FilterChips';
import { EmptyState } from '@/components/ui/State';
import { getRollup } from '@/lib/rollup/rollup-api';
import FileCard from './FileCard';
import type { RollupResponse, RollupFileType, RollupFile } from '@/lib/rollup/types';

type RecordFilter = 'all' | 'customers' | 'orders' | 'leads';

const FILTER_CHIPS: { key: RecordFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'customers', label: 'Customers' },
  { key: 'orders', label: 'Orders' },
  { key: 'leads', label: 'Leads' },
];

function filterToTypes(filter: RecordFilter): RollupFileType[] | undefined {
  switch (filter) {
    case 'customers': return ['customer'];
    case 'orders': return ['sale_order'];
    case 'leads': return ['lead'];
    default: return undefined;
  }
}

interface RollupRecordsProps {
  saId: number;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
}

export default function RollupRecords({ saId, onFileClick }: RollupRecordsProps) {
  const [activeFilter, setActiveFilter] = useState<RecordFilter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const types = filterToTypes(activeFilter);
      const result = await getRollup({
        saId,
        page,
        limit: 20,
        kind: 'file',
        types,
      });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load records');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [saId, activeFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [activeFilter]);

  const stacks = data?.listing?.stacks ?? [];
  const allFiles: RollupFile[] = stacks.flatMap((s) => s.items);
  const totalPages = data?.listing?.pages ?? 1;
  const totalItems = data?.listing?.total ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-20)' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-2) 0' }}>
        <div className="text-h4">Records</div>
        <div className="text-caption text-muted">All items across your managed accounts</div>
      </div>

      {/* Filter tabs */}
      <FilterChips
        items={FILTER_CHIPS}
        activeKey={activeFilter}
        onSelect={(key) => setActiveFilter(key as RecordFilter)}
      />

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 56, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
          <div className="text-body-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
          <button
            onClick={fetchData}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Count */}
          <div className="text-caption text-muted">
            {totalItems} record{totalItems !== 1 ? 's' : ''}
          </div>

          {/* Empty */}
          {allFiles.length === 0 && (
            <EmptyState
              title="No records found"
              description={activeFilter === 'all' ? 'No customers, orders, or leads in your managed accounts.' : `No ${activeFilter} found.`}
              icon={<FolderOpen size={40} />}
            />
          )}

          {/* File list */}
          {allFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {allFiles.map((file) => (
                <FileCard key={`${file.type}-${file.id}`} file={file} onClick={onFileClick} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) 0' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-sans)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-caption text-muted">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-sans)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
