'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import { User, ShoppingCart, Target } from 'lucide-react';
import type { RollupFile, RollupFileType } from '@/lib/rollup/types';

const FILE_TYPE_CONFIG: Record<RollupFileType, {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
}> = {
  customer: { icon: User, color: 'var(--color-brand)', bg: 'rgba(0, 229, 229, 0.1)' },
  sale_order: { icon: ShoppingCart, color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  lead: { icon: Target, color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
};

interface FileCardProps {
  file: RollupFile;
  onClick: (type: RollupFileType, id: number, displayName: string) => void;
}

export default function FileCard({ file, onClick }: FileCardProps) {
  const config = FILE_TYPE_CONFIG[file.type] ?? FILE_TYPE_CONFIG.customer;
  const Icon = config.icon;

  return (
    <Card variant="default" onClick={() => onClick(file.type, file.id, file.display_name)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 'var(--space-9)',
            height: 'var(--space-9)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: config.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} style={{ color: config.color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-body-sm truncate" style={{ fontWeight: 'var(--weight-medium)' } as React.CSSProperties}>
            {file.display_name}
          </div>
          <div className="text-caption text-muted" style={{ textTransform: 'capitalize' }}>
            {file.type.replace('_', ' ')}
          </div>
        </div>
      </div>
    </Card>
  );
}
