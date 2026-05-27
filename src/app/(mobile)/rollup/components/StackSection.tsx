'use client';

import React from 'react';
import FileCard from './FileCard';
import type { RollupStack, RollupFileType } from '@/lib/rollup/types';

interface StackSectionProps {
  stack: RollupStack;
  onFileClick: (type: RollupFileType, id: number, displayName: string) => void;
}

export default function StackSection({ stack, onFileClick }: StackSectionProps) {
  if (stack.items.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-1) 0',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span
          className="text-caption"
          style={{
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          } as React.CSSProperties}
        >
          {stack.label}
        </span>
        <span className="text-caption text-muted">{stack.total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {stack.items.map((file) => (
          <FileCard key={`${file.type}-${file.id}`} file={file} onClick={onFileClick} />
        ))}
      </div>
    </div>
  );
}
