'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, ShoppingCart, Target, ChevronRight, ChevronLeft,
  ArrowLeft, FolderOpen,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/State';
import { getRollup } from '@/lib/rollup/rollup-api';
import FileCard from './FileCard';
import type { RollupResponse, RollupFileType, RollupFile, RollupMetrics } from '@/lib/rollup/types';

type RecordCategory = 'customer' | 'sale_order' | 'lead';

const CATEGORIES: {
  type: RecordCategory;
  label: string;
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  metricKey: keyof RollupMetrics;
}[] = [
  { type: 'customer', label: 'Customers', icon: Users, color: 'var(--color-brand)', bg: 'rgba(0, 229, 229, 0.1)', metricKey: 'customer' },
  { type: 'sale_order', label: 'Orders', icon: ShoppingCart, color: 'var(--color-success)', bg: 'var(--color-success-soft)', metricKey: 'sale_order' },
  { type: 'lead', label: 'Leads', icon: Target, color: 'var(--color-warning)', bg: 'var(--color-warning-soft)', metricKey: 'lead' },
];

interface RollupRecordsProps {
  saId: number;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
}

export default function RollupRecords({ saId, onFileClick }: RollupRecordsProps) {
  const [selectedCategory, setSelectedCategory] = useState<RecordCategory | null>(null);
  const [metrics, setMetrics] = useState<RollupMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch metrics for the category cards on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setMetricsLoading(true);
      try {
        const result = await getRollup({ saId, page: 1, limit: 1 });
        if (!cancelled) setMetrics(result.rollup?.metrics ?? null);
      } catch { /* ignore — cards show without counts */ }
      finally { if (!cancelled) setMetricsLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [saId]);

  if (selectedCategory) {
    return (
      <RecordList
        saId={saId}
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
        onFileClick={onFileClick}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 'var(--space-20)' }}>
      <div style={{ padding: 'var(--space-2) 0' }}>
        <div className="text-h4">Records</div>
        <div className="text-caption text-muted">Browse items across your managed accounts</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = metrics?.[cat.metricKey] ?? null;
          return (
            <Card key={cat.type} variant="default" onClick={() => setSelectedCategory(cat.type)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)',
                  backgroundColor: cat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={22} style={{ color: cat.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-h5">{cat.label}</div>
                  <div className="text-caption text-muted">
                    {metricsLoading ? '...' : count !== null ? `${count} across all accounts` : 'Tap to browse'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {count !== null && !metricsLoading && (
                    <Badge variant="secondary" size="sm">{count}</Badge>
                  )}
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Inner list view for a single record type
// ────────────────────────────────────────────────────────────────────────

function RecordList({ saId, category, onBack, onFileClick }: {
  saId: number;
  category: RecordCategory;
  onBack: () => void;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const catConfig = CATEGORIES.find((c) => c.type === category)!;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRollup({ saId, page, limit: 20, kind: 'file', types: [category] });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load records');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [saId, page, category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stacks = data?.listing?.stacks ?? [];
  const files: RollupFile[] = stacks.flatMap((s) => s.items);
  const totalPages = data?.listing?.pages ?? 1;
  const totalItems = data?.listing?.total ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-20)' }}>
      {/* Header with back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'var(--space-9)', height: 'var(--space-9)',
            borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-h4">{catConfig.label}</div>
          <div className="text-caption text-muted">Across all managed accounts</div>
        </div>
      </div>

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
          <div className="text-caption text-muted">
            {totalItems} {catConfig.label.toLowerCase()}
          </div>

          {files.length === 0 && (
            <EmptyState
              title={`No ${catConfig.label.toLowerCase()}`}
              description={`No ${catConfig.label.toLowerCase()} found across your managed accounts.`}
              icon={<FolderOpen size={40} />}
            />
          )}

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {files.map((file) => (
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
