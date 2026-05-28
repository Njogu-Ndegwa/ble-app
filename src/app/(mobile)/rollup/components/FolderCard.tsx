'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Folder, Users, ChevronRight } from 'lucide-react';
import type { RollupFolder } from '@/lib/rollup/types';

interface FolderCardProps {
  folder: RollupFolder;
  onClick: (saId: number) => void;
}

export default function FolderCard({ folder, onClick }: FolderCardProps) {
  const isInactive = folder.state !== 'active';

  return (
    <Card
      variant="default"
      onClick={() => onClick(folder.sa_id)}
      style={isInactive ? { opacity: 0.5 } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 'var(--space-10)',
            height: 'var(--space-10)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: folder.is_app_users_pool
              ? 'var(--color-info-soft)'
              : 'var(--bg-surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {folder.is_app_users_pool ? (
            <Users size={18} style={{ color: 'var(--color-info)' }} />
          ) : (
            <Folder size={18} style={{ color: 'var(--color-brand)' }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-h5 truncate">{folder.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-0-5)' }}>
            {folder.account_code && (
              <span className="text-mono-sm text-muted">{folder.account_code}</span>
            )}
            {folder.child_count > 0 && (
              <span className="text-caption text-muted">
                {folder.child_count} service account{folder.child_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <Badge variant={folder.account_class === 'OVAC' ? 'secondary' : 'default'}>
            {folder.account_class}
          </Badge>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </Card>
  );
}
