'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FolderTree, Users, ShoppingCart, Target, ShoppingBag, RefreshCw, ChevronRight } from 'lucide-react';
import { StatCard } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { getRollup } from '@/lib/rollup/rollup-api';
import type { RollupResponse, RollupFolder } from '@/lib/rollup/types';

interface RollupDashboardProps {
  saId: number;
  saName: string;
  managerName?: string;
  onDrillIntoAccount: (saId: number) => void;
  onViewAllAccounts: () => void;
  onViewRecords: () => void;
}

export default function RollupDashboard({
  saId,
  saName,
  managerName,
  onDrillIntoAccount,
  onViewAllAccounts,
  onViewRecords,
}: RollupDashboardProps) {
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRollup({ saId, page: 1, limit: 20 });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [saId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics = data?.rollup?.metrics;
  const folders = data?.listing?.folders?.items ?? [];
  const totalFolders = data?.listing?.folders?.total ?? 0;

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 'var(--space-20)' }}>
      {/* Greeting + context */}
      <div style={{ padding: 'var(--space-2) 0' }}>
        <div className="text-caption text-muted">{greeting}</div>
        <div className="text-h4" style={{ marginTop: 'var(--space-0-5)' }}>{saName}</div>
        {managerName && (
          <div className="text-caption text-muted" style={{ marginTop: 'var(--space-0-5)' }}>
            Managed by {managerName}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
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

      {/* Error state */}
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
          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
            <StatCard value={metrics.descendant_sa_count} label="Sub-accounts" icon={<FolderTree size={20} />} />
            <StatCard value={metrics.customer} label="Customers" icon={<Users size={20} />} />
            <StatCard value={metrics.sale_order} label="Total Orders" icon={<ShoppingCart size={20} />} />
            <StatCard value={metrics.orders_open} label="Open Orders" icon={<ShoppingBag size={20} />} />
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <QuickAction
              icon={<FolderTree size={18} style={{ color: 'var(--color-brand)' }} />}
              label="Browse Accounts"
              hint={`${totalFolders} sub-account${totalFolders !== 1 ? 's' : ''}`}
              onClick={onViewAllAccounts}
            />
            <QuickAction
              icon={<Users size={18} style={{ color: 'var(--color-success)' }} />}
              label="View All Records"
              hint={`${metrics.customer + metrics.sale_order + metrics.lead} items`}
              onClick={onViewRecords}
            />
          </div>

          {/* Child accounts preview */}
          {folders.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="text-caption" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>
                  Sub-accounts
                </span>
                {totalFolders > 3 && (
                  <button
                    onClick={onViewAllAccounts}
                    style={{
                      background: 'none', border: 'none', color: 'var(--color-brand)',
                      fontSize: 'var(--font-xs)', fontFamily: 'var(--font-sans)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                    }}
                  >
                    View all <ChevronRight size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {folders.slice(0, 3).map((folder) => (
                  <CompactAccountCard key={folder.sa_id} folder={folder} onClick={onDrillIntoAccount} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuickAction({ icon, label, hint, onClick }: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        width: '100%', textAlign: 'left',
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{
        width: 'var(--space-9)', height: 'var(--space-9)',
        borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' } as React.CSSProperties}>{label}</div>
        <div className="text-caption text-muted">{hint}</div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}

function CompactAccountCard({ folder, onClick }: { folder: RollupFolder; onClick: (saId: number) => void }) {
  return (
    <Card variant="default" onClick={() => onClick(folder.sa_id)} style={folder.state !== 'active' ? { opacity: 0.5 } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          width: 'var(--space-9)', height: 'var(--space-9)', borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FolderTree size={16} style={{ color: 'var(--color-brand)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-body-sm truncate" style={{ fontWeight: 'var(--weight-medium)' } as React.CSSProperties}>{folder.name}</div>
          <div className="text-caption text-muted">
            {folder.child_count > 0 ? `${folder.child_count} sub-account${folder.child_count !== 1 ? 's' : ''}` : 'No sub-accounts'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <Badge variant={folder.account_class === 'OVAC' ? 'secondary' : 'default'} size="xs">{folder.account_class}</Badge>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </Card>
  );
}
