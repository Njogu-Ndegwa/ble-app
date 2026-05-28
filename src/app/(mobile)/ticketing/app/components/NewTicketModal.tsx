'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { createTicket } from '@/lib/tickets-api';
import type { HelpdeskStage, TicketCreateBody, TicketPriority } from '@/lib/tickets-types';
import CustomerPicker from './CustomerPicker';
import StageSelect from './StageSelect';

interface Props {
  stages: HelpdeskStage[];
  token: string | undefined;
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function NewTicketModal({ stages, token, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const defaultStageId = useMemo(
    () => stages.find(s => !s.fold)?.id ?? stages[0]?.id ?? null,
    [stages],
  );
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [stageId, setStageId] = useState<number | null>(defaultStageId);
  const [customer, setCustomer] = useState<{ id: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body: TicketCreateBody = {
        subject: subject.trim(),
        priority,
      };
      if (description.trim()) body.description = description.trim();
      if (stageId !== null) body.stage_id = stageId;
      if (customer) body.partner_id = customer.id;

      await createTicket(body, token);
      toast.success(t('ticketing.new.created') || 'Ticket created');
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, subject, description, priority, stageId, customer, token, onCreated, t]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('ticketing.new') || 'New Ticket'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={`${t('ticketing.new.subject') || 'Subject'} *`}>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={t('ticketing.new.subjectPlaceholder') || 'Brief summary'}
              style={inputStyle}
              autoFocus
            />
          </Field>

          <Field label={t('ticketing.new.description') || 'Description'}>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={t('ticketing.new.descriptionPlaceholder') || 'Details…'}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          <Field label={t('ticketing.new.customer') || 'Customer'}>
            <CustomerPicker token={token} selected={customer} onChange={setCustomer} />
          </Field>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label={t('ticketing.list.filter.stage') || 'Stage'}>
              <StageSelect
                stages={stages}
                value={stageId}
                onChange={setStageId}
                disabled={stages.length === 0}
              />
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

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 14px',
              fontSize: 14,
              opacity: !canSubmit ? 0.5 : 1,
              cursor: !canSubmit ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
            {t('ticketing.new.submit') || 'Create ticket'}
          </button>
        </div>
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
