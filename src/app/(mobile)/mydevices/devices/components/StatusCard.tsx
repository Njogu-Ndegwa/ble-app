'use client';

import React from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface StatusCardProps {
  hasRcrd: boolean;
  remainingDays: string | null;
  isRefreshing: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ hasRcrd, remainingDays, isRefreshing }) => {
  const { t } = useI18n();

  return (
    <div
      className="rounded-xl p-4 mb-4 flex items-center gap-3"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--accent-soft)' }}
      >
        <Calendar size={20} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('Remaining Days')}
        </p>
        {isRefreshing ? (
          <div className="flex items-center gap-2 mt-1">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('Updating...')}</span>
          </div>
        ) : hasRcrd ? (
          <span className="text-3xl font-bold font-mono leading-tight" style={{ color: 'var(--text-primary)' }}>
            {remainingDays ?? t('N/A')}
          </span>
        ) : (
          <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('Loading...')}</span>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
