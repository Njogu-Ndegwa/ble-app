'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

const QUICK_DAYS = [7, 14, 30, 90] as const;

interface AddDaysCardProps {
  selectedChip: number | 'custom' | null;
  customDays: string;
  duration: number | null;
  isBusy: boolean;
  busyActive: boolean;
  onSelectChip: (chip: number | 'custom') => void;
  onCustomChange: (raw: string) => void;
  onGenerate: () => void;
}

const AddDaysCard: React.FC<AddDaysCardProps> = ({
  selectedChip, customDays, duration, isBusy, busyActive,
  onSelectChip, onCustomChange, onGenerate,
}) => {
  const { t } = useI18n();
  const disabled = isBusy || !duration;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-glow)',
        boxShadow: '0 0 24px -10px var(--accent-glow)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--accent)' }}
      >
        {t('Add days')}
      </p>
      <div className="flex gap-2 mb-3">
        {QUICK_DAYS.map((d) => {
          const active = selectedChip === d;
          return (
            <button
              key={d}
              className="flex-1 rounded-lg text-sm font-semibold py-2 transition-colors"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onClick={() => onSelectChip(d)}
              disabled={isBusy}
            >
              {d}
            </button>
          );
        })}
        <button
          className="rounded-lg text-sm font-semibold py-2 px-3 transition-colors"
          style={{
            flex: '1.3 1 0%',
            background: selectedChip === 'custom' ? 'var(--accent-soft)' : 'transparent',
            border: `1px solid ${selectedChip === 'custom' ? 'var(--accent)' : 'var(--border)'}`,
            color: selectedChip === 'custom' ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          onClick={() => onSelectChip('custom')}
          disabled={isBusy}
        >
          {t('Custom')}
        </button>
      </div>
      {selectedChip === 'custom' && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="form-input"
            style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, width: '90px', flexShrink: 0 }}
            placeholder="0"
            value={customDays}
            onChange={(e) => onCustomChange(e.target.value)}
            autoFocus
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('days')}
          </span>
        </div>
      )}
      <button
        className="w-full rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        style={{
          minHeight: 44,
          padding: '12px 18px',
          fontSize: 14,
          background: disabled
            ? 'var(--bg-tertiary)'
            : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
          color: disabled ? 'var(--text-muted)' : '#fff',
          opacity: disabled ? 0.5 : 1,
          border: disabled ? '1px solid var(--border)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={onGenerate}
        disabled={disabled}
      >
        {busyActive ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t('Working...')}
          </>
        ) : (
          t('Generate & Write to Device')
        )}
      </button>
    </div>
  );
};

export default AddDaysCard;
