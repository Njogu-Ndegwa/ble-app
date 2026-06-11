'use client';

import React from 'react';
import { Calendar, Clipboard, KeyRound, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { chunk3 } from './format';

interface StatusCardProps {
  hasRcrd: boolean;
  remainingDays: string | null;
  hasPubk: boolean;
  pubkValue: string | null;
  isRefreshing: boolean;
  onCopy: (code: string) => void;
}

const StatusCard: React.FC<StatusCardProps> = ({
  hasRcrd, remainingDays, hasPubk, pubkValue, isRefreshing, onCopy,
}) => {
  const { t } = useI18n();

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
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

      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--border)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <KeyRound size={12} style={{ color: 'var(--accent)' }} />
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('Current Code')}
              </span>
            </div>
            {isRefreshing ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Updating...')}</span>
              </div>
            ) : hasPubk ? (
              <p
                className="text-base font-bold font-mono mt-0.5 break-all"
                style={{ color: 'var(--text-primary)' }}
              >
                {pubkValue ? chunk3(pubkValue) : t('N/A')}
              </p>
            ) : (
              <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('Loading...')}</span>
            )}
          </div>
          {!isRefreshing && pubkValue && (
            <button
              className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => onCopy(pubkValue)}
              aria-label={t('Copy code')}
            >
              <Clipboard size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
