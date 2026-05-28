'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { priorityKey, type RawPriority } from '@/lib/tickets-types';

interface Props {
  priority: RawPriority | undefined;
  size?: 'sm' | 'md';
}

function colorsFor(key: ReturnType<typeof priorityKey>) {
  switch (key) {
    case 'urgent':
      return { bg: 'var(--color-error-soft)', text: 'var(--color-error)', border: 'var(--color-error-soft)' };
    case 'high':
      return { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)', border: 'var(--color-warning-soft)' };
    case 'medium':
      return { bg: 'var(--color-info-soft, var(--bg-tertiary))', text: 'var(--color-info, var(--text-secondary))', border: 'var(--border)' };
    case 'low':
      return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' };
    default:
      return { bg: 'var(--bg-tertiary)', text: 'var(--text-muted)', border: 'var(--border)' };
  }
}

export default function PriorityBadge({ priority, size = 'sm' }: Props) {
  const { t } = useI18n();
  const key = priorityKey(priority);
  const color = colorsFor(key);
  const label =
    key === 'none'
      ? t('ticketing.priority.none') || 'None'
      : t(`ticketing.priority.${key}`) || key.charAt(0).toUpperCase() + key.slice(1);
  const padX = size === 'md' ? 10 : 8;
  const padY = size === 'md' ? 3 : 2;
  return (
    <span
      style={{
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        borderRadius: 999,
        padding: `${padY}px ${padX}px`,
        fontSize: size === 'md' ? 12 : 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
