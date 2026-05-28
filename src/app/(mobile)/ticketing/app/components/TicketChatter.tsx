'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import toast from 'react-hot-toast';
import { fetchTicketMessages, postTicketMessage } from '@/lib/tickets-api';
import type { TicketMessage } from '@/lib/tickets-types';

interface Props {
  ticketId: number;
  token: string | undefined;
}

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export default function TicketChatter({ ticketId, token }: Props) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchTicketMessages(ticketId, token);
      setMessages(m);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ticketId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePost = useCallback(async () => {
    const trimmed = composing.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await postTicketMessage(ticketId, trimmed, token);
      setComposing('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPosting(false);
    }
  }, [composing, posting, ticketId, token, load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
        {t('ticketing.detail.chatter') || 'Activity'}
      </h4>

      {/* Composer */}
      <div
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 8,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={composing}
          onChange={e => setComposing(e.target.value)}
          placeholder={t('ticketing.detail.composePlaceholder') || 'Post a note…'}
          rows={2}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            resize: 'vertical',
            outline: 'none',
            minHeight: 40,
          }}
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={!composing.trim() || posting}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 13,
            opacity: !composing.trim() || posting ? 0.5 : 1,
            cursor: !composing.trim() || posting ? 'not-allowed' : 'pointer',
          }}
        >
          {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {t('ticketing.detail.post') || 'Post'}
        </button>
      </div>

      {/* Messages */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--color-error)', fontSize: 12 }}>{error}</div>
      ) : messages.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {t('ticketing.detail.noMessages') || 'No activity yet.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => (
            <div
              key={m.id}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.author}</span>
                <span>{m.date}</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {stripHtml(m.body)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
