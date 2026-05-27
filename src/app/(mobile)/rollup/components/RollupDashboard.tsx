'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree, Users, ShoppingCart, ShoppingBag, Target,
  ChevronRight, ChevronLeft, RefreshCw, FolderOpen,
} from 'lucide-react';
import { StatCard } from '@/components/ui/Card';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/State';
import { getRollup } from '@/lib/rollup/rollup-api';
import RollupBreadcrumb from './RollupBreadcrumb';
import FolderCard from './FolderCard';
import type {
  RollupResponse, RollupFileType, RollupStack,
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
  initialSaId: number;
  initialSaName: string;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
  onOpenApplet: (type: string, label: string) => void;
}

export default function RollupDashboard({
  initialSaId,
  initialSaName,
  onFileClick,
  onOpenApplet,
}: RollupDashboardProps) {
  const [currentSaId, setCurrentSaId] = useState(initialSaId);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRollup({ saId: currentSaId, page, limit: 20 });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentSaId, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [currentSaId]);

  const handleFolderClick = useCallback((saId: number) => {
    setCurrentSaId(saId);
  }, []);

  const handleBreadcrumbNavigate = useCallback((saId: number) => {
    setCurrentSaId(saId);
  }, []);

  const metrics = data?.rollup?.metrics;
  const folders = data?.listing?.folders?.items ?? [];
  const folderPages = data?.listing?.folders?.pages ?? 1;
  const stacks = data?.listing?.stacks ?? [];
  const visibleStacks = stacks.filter((s) => s.total > 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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
          {data?.path?.name ?? initialSaName}
        </div>
        {data?.sa_manager && (
          <div className="text-caption text-muted" style={{ marginTop: 'var(--space-0-5)' }}>
            Manager: {data.sa_manager.display_name}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
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

      {!loading && !error && metrics && (
        <>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
            <StatCard value={metrics.descendant_sa_count} label="Sub-accounts" icon={<FolderTree size={20} />} />
            <StatCard value={metrics.customer} label="Customers" icon={<Users size={20} />} />
            <StatCard value={metrics.sale_order} label="Total Orders" icon={<ShoppingCart size={20} />} />
            <StatCard value={metrics.orders_open} label="Open Orders" icon={<ShoppingBag size={20} />} />
          </div>

          {/* Sub-accounts */}
          {folders.length > 0 && (
            <div>
              <SectionHeader label="Sub-accounts" count={data?.listing?.folders?.total} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {folders.map((folder) => (
                  <FolderCard key={folder.sa_id} folder={folder} onClick={handleFolderClick} />
                ))}
              </div>
              {folderPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) 0' }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-caption"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                      color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-caption text-muted">Page {page} of {folderPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(folderPages, p + 1))}
                    disabled={page >= folderPages}
                    className="text-caption"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                      color: page >= folderPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page >= folderPages ? 'not-allowed' : 'pointer', opacity: page >= folderPages ? 0.5 : 1,
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Record categories — dynamic, only types with items */}
          {visibleStacks.length > 0 && (
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

          {/* Truly empty */}
          {folders.length === 0 && visibleStacks.length === 0 && (
            <EmptyState
              title="This account is empty"
              description="No sub-accounts or records at this level."
              icon={<FolderOpen size={40} />}
            />
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
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
      {count != null && <span className="text-caption text-muted">{count}</span>}
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
