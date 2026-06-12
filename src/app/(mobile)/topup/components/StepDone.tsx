"use client";

import React, { useCallback, useState } from 'react';
import { Zap, Copy, Check, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { copyToClipboard } from '@/lib/clipboard';
import type { TopupReceipt } from './StepConfirm';

interface StepDoneProps {
  receipt: TopupReceipt;
  onRestart: () => void;
}

export default function StepDone({ receipt, onRestart }: StepDoneProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(receipt.reference);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) window.setTimeout(() => setCopied(false), 1500);
  }, [receipt.reference]);

  return (
    <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
        }}
      >
        <Zap size={32} />
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {`+${receipt.kwhCredited.toLocaleString()} kWh`}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {receipt.wasRetry
            ? (t('topup.doneDescRetry', {
                sub: receipt.subscriptionCode,
              }) || `Credit applied to ${receipt.subscriptionCode}.`)
            : (t('topup.doneDesc', {
                sub: receipt.subscriptionCode,
                after: receipt.quotaAfter.toLocaleString(),
                before: receipt.quotaBefore.toLocaleString(),
              }) || `${receipt.subscriptionCode} now has ${receipt.quotaAfter.toLocaleString()} kWh (was ${receipt.quotaBefore.toLocaleString()}).`)}
        </p>
      </div>

      {receipt.wasRetry && (
        <div
          role="status"
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left',
            padding: 12, fontSize: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--accent-soft)', color: 'var(--text-primary)',
            border: '1px solid var(--accent)',
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {t('topup.alreadyCredited') || 'This credit had already been applied — the retry was detected and no double charge occurred.'}
          </span>
        </div>
      )}

      <div
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', padding: 12, textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 6,
          position: 'relative',
        }}
      >
        <span className="form-label" style={{ margin: 0 }}>
          {t('topup.reference') || 'Reference'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all',
          }}
          aria-label={t('topup.copyReference') || 'Copy reference'}
        >
          <span style={{ textAlign: 'left' }}>{receipt.reference}</span>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        {copyFailed && (
          <span role="status" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t('topup.copyFailed') || 'Couldn’t copy automatically — note the reference manually.'}
          </span>
        )}
        <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {copied ? (t('topup.copied') || 'Copied') : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={onRestart} style={{ width: '100%' }}>
          {t('topup.topUpAnother') || 'Top up another'}
        </button>
      </div>
    </div>
  );
}
