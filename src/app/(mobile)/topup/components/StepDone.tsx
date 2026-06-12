"use client";

import React, { useCallback, useState } from 'react';
import { Zap, Copy, Check, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { TopupReceipt } from './StepConfirm';

interface StepDoneProps {
  receipt: TopupReceipt;
  onRestart: () => void;
}

export default function StepDone({ receipt, onRestart }: StepDoneProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(receipt.reference);
      } else {
        const ta = document.createElement('textarea');
        ta.value = receipt.reference;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[TOPUP] Clipboard copy failed:', err);
    }
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
          {t('topup.doneDesc', {
            sub: receipt.subscriptionCode,
            after: receipt.quotaAfter.toLocaleString(),
            before: receipt.quotaBefore.toLocaleString(),
          }) || `${receipt.subscriptionCode} now has ${receipt.quotaAfter.toLocaleString()} kWh (was ${receipt.quotaBefore.toLocaleString()}).`}
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={onRestart} style={{ width: '100%' }}>
          {t('topup.topUpAnother') || 'Top up another'}
        </button>
      </div>
    </div>
  );
}
