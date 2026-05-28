'use client';

import React from 'react';
import type { HelpdeskStage } from '@/lib/tickets-types';

interface Props {
  stages: HelpdeskStage[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}

export default function StageSelect({ stages, value, onChange, disabled }: Props) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={e => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      style={{
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 13,
        width: '100%',
      }}
    >
      {stages.map(s => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
