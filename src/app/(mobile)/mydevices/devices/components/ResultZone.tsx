'use client';

import React from 'react';
import {
  Clipboard, Loader2, CheckCircle, AlertCircle, Download, Send,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import type { CodeType, LastCode, ResultState } from './types';

const chunk3 = (code: string) => code.replace(/(\d{3})(?=\d)/g, '$1 ');

interface ResultZoneProps {
  result: ResultState;
  lastCode: LastCode | null;
  remainingDays: string | null;
  isRefreshing: boolean;
  onRetrieve: () => void;
  onRetryWrite: () => void;
  onTryAgain: () => void;
  onResend: () => void;
  onCopy: (code: string) => void;
}

const ResultZone: React.FC<ResultZoneProps> = ({
  result, lastCode, remainingDays, isRefreshing,
  onRetrieve, onRetryWrite, onTryAgain, onResend, onCopy,
}) => {
  const { t } = useI18n();

  const codeTypeLabel = (ct: CodeType | null) => {
    switch (ct) {
      case 'days': return t('Days Code');
      case 'free': return t('Free Code');
      case 'reset': return t('Reset Code');
      case 'retrieve': return t('Retrieved Code');
      default: return t('Code');
    }
  };

  const relTime = (at: number) => {
    const mins = Math.floor((Date.now() - at) / 60000);
    if (mins < 1) return t('just now');
    if (mins < 60) return t('{n}m ago', { n: mins });
    return t('{n}h ago', { n: Math.floor(mins / 60) });
  };

  // Generating
  if (result.status === 'generating') {
    return (
      <div
        className="rounded-xl p-4 mb-4 flex items-center gap-3"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {result.codeType === 'retrieve' ? t('Retrieving last code...') : t('Generating code...')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{codeTypeLabel(result.codeType)}</p>
        </div>
      </div>
    );
  }

  // Generated / Writing / Written / WriteFailed — code is present
  if (
    (result.status === 'generated' || result.status === 'writing'
      || result.status === 'written' || result.status === 'writeFailed')
    && result.codeDec
  ) {
    const borderColor =
      result.status === 'written' ? 'var(--color-success)'
      : result.status === 'writeFailed' ? '#f59e0b'
      : 'var(--border)';

    return (
      <div
        className="rounded-xl p-4 mb-4 transition-all duration-300"
        style={{ background: 'var(--bg-secondary)', border: `1px solid ${borderColor}` }}
      >
        <div className="flex items-start justify-between mb-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {codeTypeLabel(result.codeType)}
            {result.status === 'written' && ` · ${t('just now')}`}
            {result.status === 'writeFailed' && ` · ${t('Not on device yet')}`}
          </span>
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => onCopy(result.codeDec!)}
            aria-label={t('Copy code')}
          >
            <Clipboard size={16} />
          </button>
        </div>
        <p
          className="text-3xl font-bold font-mono tracking-wider mb-3 text-center"
          style={{ color: 'var(--accent)' }}
        >
          {chunk3(result.codeDec)}
        </p>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          {(result.status === 'generated' || result.status === 'writing') && (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('Writing code to device...')}
              </span>
            </>
          )}
          {result.status === 'written' && (
            <>
              <CheckCircle size={14} className="flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                {isRefreshing || remainingDays == null
                  ? t('Written. Confirming days...')
                  : t('Written. Device now reads {days} days', { days: remainingDays })}
              </span>
            </>
          )}
          {result.status === 'writeFailed' && (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={14} className="flex-shrink-0" style={{ color: '#f59e0b' }} />
                <span className="text-xs font-medium break-words" style={{ color: '#f59e0b' }}>
                  {result.error || t('Failed to write to device')}
                </span>
              </div>
              <button
                className="text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0"
                style={{ color: 'var(--accent)', background: 'var(--bg-secondary)' }}
                onClick={onRetryWrite}
              >
                {t('Retry write')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Generation / retrieval error
  if (result.status === 'error') {
    return (
      <div
        className="rounded-xl p-4 mb-4 flex items-start gap-3"
        style={{
          background: 'var(--color-error-soft, rgba(239,68,68,0.08))',
          border: '1px solid var(--color-error)',
        }}
      >
        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-error)' }}>
            {result.codeType === 'retrieve' ? t('Failed to retrieve code') : t('Failed to generate code')}
          </p>
          <p className="text-xs break-words" style={{ color: 'var(--text-secondary)' }}>{result.error}</p>
        </div>
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
          style={{
            color: 'var(--color-error)',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
          onClick={onTryAgain}
        >
          {t('Try Again')}
        </button>
      </div>
    );
  }

  // Idle with a known last code — resting row
  if (lastCode) {
    return (
      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t('Last code')} · {codeTypeLabel(lastCode.codeType)} · {relTime(lastCode.at)}
          </p>
          <p className="text-sm font-mono mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
            {chunk3(lastCode.codeDec)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            onClick={onResend}
          >
            <Send size={12} />
            {t('Resend')}
          </button>
          <button
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => onCopy(lastCode.codeDec)}
            aria-label={t('Copy code')}
          >
            <Clipboard size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Idle, nothing known — retrieve affordance
  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2"
      style={{ background: 'transparent', border: '1px dashed var(--border)' }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {t('Last code')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('Not loaded')}</p>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        onClick={onRetrieve}
      >
        <Download size={12} />
        {t('Retrieve & rewrite')}
      </button>
    </div>
  );
};

export default ResultZone;
