'use client';

import React from 'react';
import { StatCard } from '@/components/ui/Card';
import { FolderTree, Users, ShoppingCart, Target } from 'lucide-react';
import type { RollupMetrics } from '@/lib/rollup/types';

interface RollupStatsRowProps {
  metrics: RollupMetrics;
}

export default function RollupStatsRow({ metrics }: RollupStatsRowProps) {
  const stats = [
    {
      value: metrics.descendant_sa_count,
      label: 'Service Accounts',
      icon: <FolderTree size={20} />,
    },
    {
      value: metrics.customer,
      label: 'Customers',
      icon: <Users size={20} />,
    },
    {
      value: metrics.sale_order,
      label: 'Orders',
      icon: <ShoppingCart size={20} />,
    },
    {
      value: metrics.lead,
      label: 'Leads',
      icon: <Target size={20} />,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) 0',
      }}
    >
      {stats.map((s) => (
        <StatCard
          key={s.label}
          value={s.value}
          label={s.label}
          icon={s.icon}
        />
      ))}
    </div>
  );
}
