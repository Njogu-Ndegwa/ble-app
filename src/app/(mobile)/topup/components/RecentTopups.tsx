"use client";

import React, { useEffect, useState } from 'react';
import { History, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { loadRecentTopups, type RecentTopup } from '../lib/topup-core';

export default function RecentTopups() {
  const { t } = useI18n();
  const [items, setItems] = useState<RecentTopup[]>([]);

  // localStorage is browser-only — load after mount to stay SSR-safe.
  useEffect(() => {
    setItems(loadRecentTopups());
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 8,
        }}
      >
        <History size={13} />
        {t('topup.recentTitle') || 'Recent top-ups (this device)'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.slice(0, 5).map((item) => (
          <div
            key={item.reference}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', padding: '10px 12px', fontSize: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.subscriptionCode}
              </div>
              <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {new Date(item.timestamp).toLocaleString()} · {item.reference}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
              <Zap size={12} />
              {`+${item.kwh.toLocaleString()}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
