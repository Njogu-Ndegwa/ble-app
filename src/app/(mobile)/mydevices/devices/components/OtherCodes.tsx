'use client';

import React from 'react';
import { Unlock, RotateCcw, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { CodeType } from './types';

interface OtherCodesProps {
  isBusy: boolean;
  busyType: CodeType | null;
  onRequest: (type: 'free' | 'reset') => void;
}

const OtherCodes: React.FC<OtherCodesProps> = ({ isBusy, busyType, onRequest }) => {
  const { t } = useI18n();

  const rows: Array<{
    type: 'free' | 'reset';
    icon: React.ReactNode;
    title: string;
    desc: string;
  }> = [
    {
      type: 'free',
      icon: <Unlock size={18} style={{ color: 'var(--accent)' }} />,
      title: t('Free Code'),
      desc: t('Unlocks the device permanently'),
    },
    {
      type: 'reset',
      icon: <RotateCcw size={18} style={{ color: 'var(--accent)' }} />,
      title: t('Reset Code'),
      desc: t('Restores the device to default state'),
    },
  ];

  return (
    <div className="mb-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-2 px-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('Other codes')}
      </h3>
      {rows.map((row) => (
        <div
          key={row.type}
          className="rounded-xl p-3 mb-2 flex items-center gap-3"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-soft)' }}
          >
            {row.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.title}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.desc}</p>
          </div>
          <button
            className="text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0 flex items-center gap-1.5"
            style={{
              color: isBusy ? 'var(--text-muted)' : 'var(--accent)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1,
            }}
            onClick={() => onRequest(row.type)}
            disabled={isBusy}
          >
            {isBusy && busyType === row.type ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            {t('Generate')}
          </button>
        </div>
      ))}
    </div>
  );
};

export default OtherCodes;
