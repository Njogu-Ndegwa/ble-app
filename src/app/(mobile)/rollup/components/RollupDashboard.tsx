'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree, Users, ShoppingCart, ShoppingBag, Target,
  ChevronRight, RefreshCw, FolderOpen, Loader2,
} from 'lucide-react';
import { StatCard } from '@/components/ui/Card';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/State';
import { getRollup } from '@/lib/rollup/rollup-api';
import RollupBreadcrumb from './RollupBreadcrumb';
import FolderCard from './FolderCard';
import type {
  RollupResponse, RollupFileType, RollupStack, RollupFolder,
} from '@/lib/rollup/types';

const STACK_CONFIG: Record<string, {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
}> = {
  customer:   { icon: Users,        color: 'var(--color-brand)',   bg: 'rgba(0, 229, 229, 0.1)' },
  sale_order: { icon: ShoppingCart,  color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  lead:       { icon: Target,        color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
};

function getStackConfig(type: string) {
  return STACK_CONFIG[type] ?? { icon: FolderOpen, color: 'var(--text-muted)', bg: 'var(--bg-surface-hover)' };
}

interface RollupDashboardProps {
  saId: number;
  saName: string;
  onDrillToSA: (saId: number, saName?: string) => void;
  onBreadcrumbNavigate: (saId: number) => void;
  onSaResolved?: (saId: number, saName: string) => void;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
  onOpenApplet: (type: string, label: string) => void;
}

const FOLDER_PREVIEW = 5;
const FOLDER_PAGE_SIZE = 20;

export default function RollupDashboard({
  saId,
  saName,
  onDrillToSA,
  onBreadcrumbNavigate,
  onSaResolved,
  onFileClick,
  onOpenApplet,
}: RollupDashboardProps) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accumulatedFolders, setAccumulatedFolders] = useState<RollupFolder[]>([]);
  const [showAllFolders, setShowAllFolders] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRollup({ saId, page, limit: FOLDER_PAGE_SIZE });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [saId, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setPage(1);
    setAccumulatedFolders([]);
    setShowAllFolders(false);
  }, [saId]);

  useEffect(() => {
    const items = data?.listing?.folders?.items;
    if (!items) return;
    setAccumulatedFolders((prev) => {
      if (page === 1) return items;
      const seen = new Set(prev.map((f) => f.sa_id));
      const merged = prev.slice();
      for (const f of items) if (!seen.has(f.sa_id)) merged.push(f);
      return merged;
    });
  }, [data?.listing?.folders?.items, page]);

  // Tell the parent the canonical name once the API resolves it — keeps the
  // breadcrumb in the header/back-stack readable.
  useEffect(() => {
    const resolved = data?.path?.name;
    if (resolved && data?.path?.sa_id === saId) {
      onSaResolved?.(saId, resolved);
    }
  }, [data?.path?.name, data?.path?.sa_id, saId, onSaResolved]);

  const handleFolderClick = useCallback((folderSaId: number) => {
    const folder = accumulatedFolders.find((f) => f.sa_id === folderSaId);
    onDrillToSA(folderSaId, folder?.name);
  }, [accumulatedFolders, onDrillToSA]);

  const handleBreadcrumbNavigate = useCallback((segSaId: number) => {
    onBreadcrumbNavigate(segSaId);
  }, [onBreadcrumbNavigate]);

  const metrics = data?.rollup?.metrics;
  const folderTotal = data?.listing?.folders?.total ?? accumulatedFolders.length;
  const folderPages = data?.listing?.folders?.pages ?? 1;
  const stacks = data?.listing?.stacks ?? [];
  const visibleStacks = stacks.filter((s) => s.total > 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const visibleFolders = showAllFolders
    ? accumulatedFolders
    : accumulatedFolders.slice(0, FOLDER_PREVIEW);
  const hasMoreInline = !showAllFolders && accumulatedFolders.length > FOLDER_PREVIEW;
  const hasMoreFromServer = page < folderPages;
  const canShowMore = hasMoreInline || hasMoreFromServer;
  const loadingMore = loading && page > 1;

  const handleShowMore = useCallback(() => {
    if (hasMoreInline) {
      setShowAllFolders(true);
      return;
    }
    if (hasMoreFromServer && !loading) {
      setPage((p) => p + 1);
    }
  }, [hasMoreInline, hasMoreFromServer, loading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-10)' }}>
      {/* Breadcrumb — only when drilled in */}
      {data?.path?.breadcrumb && data.path.breadcrumb.length > 1 && (
        <RollupBreadcrumb segments={data.path.breadcrumb} onNavigate={handleBreadcrumbNavigate} />
      )}

      {/* Greeting + SA name */}
      <div style={{ padding: 'var(--space-1) 0' }}>
        {data?.path?.breadcrumb && data.path.breadcrumb.length <= 1 && (
          <div className="text-caption text-muted">{greeting}</div>
        )}
        <div className="text-h4" style={{ marginTop: 'var(--space-0-5)' }}>
          {data?.path?.name ?? saName}
        </div>
        {data?.sa_manager && (
          <div className="text-caption text-muted" style={{ marginTop: 'var(--space-0-5)' }}>
            Manager: {data.sa_manager.display_name}
          </div>
        )}
      </div>

      {/* Initial loading (first page only) */}
      {loading && page === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 80, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
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
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!error && metrics && (page > 1 || !loading) && (() => {
        const hasFolders = accumulatedFolders.length > 0;
        const hasRecords = visibleStacks.length > 0;
        const isEmpty = !hasFolders && !hasRecords;

        if (isEmpty) {
          return (
            <EmptyState
              title="This account is empty"
              description="No service accounts or records at this level."
              icon={<FolderOpen size={40} />}
            />
          );
        }

        return (
          <>
            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
              <StatCard value={metrics.descendant_sa_count} label="Service Accounts" icon={<FolderTree size={20} />} />
              <StatCard value={metrics.customer} label="Customers" icon={<Users size={20} />} />
              <StatCard value={metrics.sale_order} label="Total Orders" icon={<ShoppingCart size={20} />} />
              <StatCard value={metrics.orders_open} label="Open Orders" icon={<ShoppingBag size={20} />} />
            </div>

            {/* Service Accounts */}
            {hasFolders && (
              <div>
                <SectionHeader
                  label="Service Accounts"
                  count={folderTotal}
                  shown={visibleFolders.length}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {visibleFolders.map((folder) => (
                    <FolderCard key={folder.sa_id} folder={folder} onClick={handleFolderClick} />
                  ))}
                </div>
                {canShowMore && (
                  <button
                    onClick={handleShowMore}
                    disabled={loadingMore}
                    className="text-caption"
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-2)',
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontWeight: 'var(--weight-medium)',
                      fontFamily: 'var(--font-sans)',
                      cursor: loadingMore ? 'wait' : 'pointer',
                      opacity: loadingMore ? 0.7 : 1,
                    } as React.CSSProperties}
                  >
                    {loadingMore ? (
                      <><Loader2 size={14} className="animate-spin" /> Loading…</>
                    ) : hasMoreInline ? (
                      <>Show all {folderTotal} <ChevronRight size={14} /></>
                    ) : (
                      <>Load more <ChevronRight size={14} /></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Record categories */}
            {hasRecords && (
              <div>
                <SectionHeader label="Records" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {visibleStacks.map((stack) => (
                    <StackCategoryCard
                      key={stack.type}
                      stack={stack}
                      onClick={() => onOpenApplet(stack.type, stack.label)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function SectionHeader({ label, count, shown }: { label: string; count?: number; shown?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-2) 0', marginBottom: 'var(--space-1)',
    }}>
      <span className="text-caption" style={{
        fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      } as React.CSSProperties}>
        {label}
      </span>
      {count != null && (
        <span className="text-caption text-muted">
          {shown != null && shown < count ? `${shown} of ${count}` : count}
        </span>
      )}
    </div>
  );
}

function StackCategoryCard({ stack, onClick }: { stack: RollupStack; onClick: () => void }) {
  const config = getStackConfig(stack.type);
  const Icon = config.icon;

  return (
    <Card variant="default" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          width: 'var(--space-10)', height: 'var(--space-10)', borderRadius: 'var(--radius-lg)',
          backgroundColor: config.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} style={{ color: config.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-body-sm" style={{ fontWeight: 'var(--weight-medium)' } as React.CSSProperties}>
            {stack.label}
          </div>
          <div className="text-caption text-muted">{stack.total} in this account</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <Badge variant="secondary" size="xs">{stack.total}</Badge>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </Card>
  );
}
