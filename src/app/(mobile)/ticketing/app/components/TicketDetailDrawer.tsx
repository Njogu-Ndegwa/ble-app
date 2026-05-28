'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { deleteTicket, getTicket, updateTicket } from '@/lib/tickets-api';
import type { HelpdeskStage, Ticket, TicketPriority, TicketUpdateBody } from '@/lib/tickets-types';
import { priorityKey } from '@/lib/tickets-types';
import PriorityBadge from './PriorityBadge';
import StageSelect from './StageSelect';
import TicketChatter from './TicketChatter';

interface Props {
  ticketId: number;
  stages: HelpdeskStage[];
  token: string | undefined;
  onBack: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TicketDetailDrawer({
  ticketId,
  stages,
  token,
  onBack,
  onUpdated,
  onDeleted,
}: Props) {
  const { t } = useI18n();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [stageId, setStageId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTicket(ticketId, token)
      .then(tk => {
        if (cancelled) return;
        setTicket(tk);
        setSubject(tk.subject || tk.name || '');
        setDescription(tk.description || '');
        const pk = priorityKey(tk.priority);
        setPriority(pk === 'none' ? 'medium' : pk);
        setStageId(tk.stage?.id ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, token]);

  const isDirty = (() => {
    if (!ticket) return false;
    if (subject !== (ticket.subject || ticket.name || '')) return true;
    if (description !== (ticket.description || '')) return true;
    const tkPriority = priorityKey(ticket.priority);
    if (priority !== (tkPriority === 'none' ? 'medium' : tkPriority)) return true;
    if (stageId !== (ticket.stage?.id ?? null)) return true;
    return false;
  })();

  const handleSave = useCallback(async () => {
    if (!ticket || !isDirty || saving) return;
    setSaving(true);
    try {
      const body: TicketUpdateBody = {};
      if (subject !== (ticket.subject || ticket.name || '')) body.subject = subject.trim();
      if (description !== (ticket.description || '')) body.description = description;
      const currentPK = priorityKey(ticket.priority);
      if (priority !== (currentPK === 'none' ? 'medium' : currentPK)) body.priority = priority;
      if (stageId !== (ticket.stage?.id ?? null) && stageId !== null) body.stage_id = stageId;

      const updated = await updateTicket(ticket.id, body, token);
      setTicket(updated);
      toast.success(t('ticketing.detail.saved') || 'Saved');
      onUpdated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [ticket, isDirty, saving, subject, description, priority, stageId, token, onUpdated, t]);

  const handleDelete = useCallback(async () => {
    if (!ticket || deleting) return;
    const ok = window.confirm(
      t('ticketing.detail.deleteConfirm') || `Delete ticket #${ticket.id}?`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteTicket(ticket.id, token);
      toast.success(t('ticketing.detail.deleted') || 'Ticket deleted');
      onDeleted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [ticket, deleting, token, onDeleted, t]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={16} />
          {t('ticketing.detail.back') || 'Back'}
        </button>
        <p style={{ color: 'var(--color-error)' }}>{error || 'Ticket not found'}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>#{ticket.id}</span>
          <PriorityBadge priority={ticket.priority} />
          {ticket.sa && (
            <span
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
              }}
              title={`SA ${ticket.sa.id}`}
            >
              {ticket.sa.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--color-error)',
              opacity: deleting ? 0.5 : 1,
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t('ticketing.detail.delete') || 'Delete'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              fontSize: 12,
              opacity: !isDirty || saving ? 0.5 : 1,
              cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('ticketing.detail.save') || 'Save'}
          </button>
        </div>
      </div>

      {/* Editable form */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Field label={t('ticketing.new.subject') || 'Subject'}>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label={t('ticketing.new.description') || 'Description'}>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <Field label={t('ticketing.list.filter.stage') || 'Stage'}>
            <StageSelect stages={stages} value={stageId} onChange={setStageId} />
          </Field>
          <Field label={t('ticketing.list.filter.priority') || 'Priority'}>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TicketPriority)}
              style={inputStyle}
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {t(`ticketing.priority.${p}`) || p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {ticket.customer && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {t('ticketing.detail.customer') || 'Customer'}:{' '}
            <span style={{ color: 'var(--text-primary)' }}>{ticket.customer.name}</span>
          </div>
        )}
        {ticket.assigned_to && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {t('ticketing.detail.assignedTo') || 'Assigned to'}:{' '}
            <span style={{ color: 'var(--text-primary)' }}>{ticket.assigned_to.name}</span>
          </div>
        )}
      </div>

      {/* Chatter */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <TicketChatter ticketId={ticket.id} token={token} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};
