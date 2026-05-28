'use client';

import React from 'react';
import { Clock, User, HelpCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { Ticket } from '@/lib/tickets-types';
import PriorityBadge from './PriorityBadge';

interface Props {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
}

export default function TicketCard({ ticket, onClick }: Props) {
  const { t } = useI18n();
  const stageName = ticket.stage?.name || t('ticketing.stage.unknown') || '(no stage)';
  const customer = ticket.customer?.name;
  const assignee = ticket.assigned_to?.name;
  const created = ticket.created_at
    ? new Date(ticket.created_at).toLocaleDateString()
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(ticket)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(ticket);
        }
      }}
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-tertiary)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <HelpCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontSize: 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            #{ticket.id}
          </span>
          <span
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            {stageName}
          </span>
        </div>
        <PriorityBadge priority={ticket.priority} />
      </div>

      <h3
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {ticket.subject || ticket.name || `Ticket #${ticket.id}`}
      </h3>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {customer ? (
            <>
              <User size={13} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 160,
                }}
                title={customer}
              >
                {customer}
              </span>
            </>
          ) : assignee ? (
            <>
              <User size={13} />
              <span>{assignee}</span>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={13} />
          <span>{created}</span>
        </div>
      </div>
    </div>
  );
}
