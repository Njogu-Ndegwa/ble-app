'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { fetchTickets } from '@/lib/tickets-api';
import type { HelpdeskStage, ListTicketsParams, Ticket, TicketPriority } from '@/lib/tickets-types';
import TicketCard from './TicketCard';

interface Props {
  stages: HelpdeskStage[];
  stagesLoading: boolean;
  stagesError: string | null;
  token: string | undefined;
  reloadKey: number;
  onTicketClick: (ticket: Ticket) => void;
  onNewTicket: () => void;
}

const PAGE_SIZE = 20;
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TicketList({
  stages,
  stagesLoading,
  stagesError,
  token,
  reloadKey,
  onTicketClick,
  onNewTicket,
}: Props) {
  const { t } = useI18n();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState<number | null>(null);
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [showDone, setShowDone] = useState(false);

  // Debounce the search input → search state.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const params: ListTicketsParams = useMemo(() => {
    const p: ListTicketsParams = { page, limit: PAGE_SIZE };
    if (search) p.search = search;
    if (stageId !== null) p.stage_id = stageId;
    if (priority) p.priority = priority;
    return p;
  }, [page, search, stageId, priority]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTickets(params, token)
      .then(res => {
        if (cancelled) return;
        setTickets(res.tickets ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setTickets([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, token, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleStages = useMemo(
    () => stages.filter(s => (showDone ? true : !s.fold)),
    [stages, showDone],
  );
  const hasFoldedStages = stages.some(s => s.fold);

  const handleStageChange = useCallback((id: number | null) => {
    setStageId(id);
    setPage(1);
  }, []);

  const handlePriorityChange = useCallback((p: TicketPriority | '') => {
    setPriority(p);
    setPage(1);
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('ticketing.title') || 'Ticketing'}{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>
            ({total})
          </span>
        </h2>
        <button
          type="button"
          onClick={onNewTicket}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}
        >
          <Plus size={16} />
          {t('ticketing.new') || 'New Ticket'}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)',
          }}
        />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={t('ticketing.list.search') || 'Search tickets…'}
          style={{
            width: '100%',
            paddingLeft: 36,
            paddingRight: 12,
            paddingTop: 9,
            paddingBottom: 9,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            borderRadius: 10,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* Stage chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <StageChip
          active={stageId === null}
          onClick={() => handleStageChange(null)}
          label={t('ticketing.list.filter.all') || 'All'}
        />
        {stagesLoading && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>…</span>}
        {visibleStages.map(s => (
          <StageChip
            key={s.id}
            active={stageId === s.id}
            onClick={() => handleStageChange(s.id)}
            label={s.name}
            folded={s.fold}
          />
        ))}
        {hasFoldedStages && (
          <button
            type="button"
            onClick={() => setShowDone(v => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            {showDone
              ? t('ticketing.list.hideDone') || 'Hide done'
              : t('ticketing.list.showDone') || 'Show done'}
          </button>
        )}
      </div>

      {/* Priority filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t('ticketing.list.filter.priority') || 'Priority'}:
        </label>
        <select
          value={priority}
          onChange={e => handlePriorityChange(e.target.value as TicketPriority | '')}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          <option value="">{t('ticketing.list.filter.any') || 'Any'}</option>
          {PRIORITIES.map(p => (
            <option key={p} value={p}>
              {t(`ticketing.priority.${p}`) || p}
            </option>
          ))}
        </select>
      </div>

      {/* Error states */}
      {stagesError && (
        <div
          style={{
            background: 'var(--color-error-soft)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error-soft)',
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {stagesError}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : error ? (
        <div
          style={{
            background: 'var(--color-error-soft)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error-soft)',
            borderRadius: 10,
            padding: 16,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <MessageCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {t('ticketing.list.empty') || 'No tickets yet'}
          </p>
          <button
            type="button"
            onClick={onNewTicket}
            className="btn btn-secondary"
            style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
          >
            <Plus size={14} />
            {t('ticketing.new') || 'New Ticket'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={onTicketClick} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 16,
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {t('ticketing.list.pageOf', { page: String(page), total: String(totalPages) }) ||
              `Page ${page} of ${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function StageChip({
  active,
  onClick,
  label,
  folded,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  folded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: active ? 'white' : folded ? 'var(--text-muted)' : 'var(--text-primary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        opacity: folded && !active ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}
