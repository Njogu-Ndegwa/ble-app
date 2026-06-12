'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Star, X, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import SelectSheet, { type SelectSheetItem } from '@/components/ui/SelectSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  listTicketActors,
  assignTicketActor,
  removeTicketActor,
  promoteTicketActor,
  getServiceAccountMembers,
  type TicketActor,
  type TicketMember,
} from '@/lib/ticket-actors-api';

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

interface TicketAssigneesProps {
  ticketId: number;
  /** SA the ticket is governed by — its active members are the candidate actors. */
  saId: number | null;
  /** Reports the loaded actor list upward (the detail view derives the Assigned-to row from it). */
  onActorsChange?: (actors: TicketActor[]) => void;
}

// Every mutation is staged here first; the ConfirmDialog executes it and
// toasts on success (ported from the desktop ticketing refinements).
type PendingAction =
  | { kind: 'add'; member: TicketMember }
  | { kind: 'remove'; actor: TicketActor }
  | { kind: 'promote'; actor: TicketActor };

export default function TicketAssignees({ ticketId, saId, onActorsChange }: TicketAssigneesProps) {
  const { t } = useI18n();
  const [actors, setActors] = useState<TicketActor[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [acting, setActing] = useState(false);
  const reqRef = useRef(0);

  // Member picker (bottom sheet)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [members, setMembers] = useState<TicketMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const a = await listTicketActors(ticketId);
      if (reqRef.current === seq) {
        setActors(a);
        onActorsChange?.(a);
      }
    } catch (err) {
      if (reqRef.current === seq) {
        setActors([]);
        onActorsChange?.([]);
        console.error('[TicketAssignees] load failed', err);
      }
    } finally {
      if (reqRef.current === seq) setLoading(false);
    }
  }, [ticketId, onActorsChange]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMembers = useCallback(async () => {
    if (saId == null) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      setMembers(await getServiceAccountMembers(saId));
    } catch (err) {
      setMembers([]);
      setMembersError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [saId]);

  const openSheet = () => {
    setSheetOpen(true);
    loadMembers();
  };

  const assignedIds = new Set(actors.map((a) => a.partnerId));
  const candidateItems: SelectSheetItem<number>[] = members
    .filter((m) => !assignedIds.has(m.partnerId))
    .map((m) => ({ value: m.partnerId, label: m.name, description: m.email }));

  const handleConfirm = async () => {
    if (!pending) return;
    setActing(true);
    try {
      if (pending.kind === 'add') {
        // The first actor becomes primary by default.
        await assignTicketActor(ticketId, pending.member.partnerId, actors.length === 0);
        toast.success(
          t('ticketing.assignees.assigned', { name: pending.member.name }) ||
            `${pending.member.name} assigned`,
        );
      } else if (pending.kind === 'remove') {
        await removeTicketActor(ticketId, pending.actor.partnerId);
        toast.success(
          t('ticketing.assignees.removed', { name: pending.actor.name }) ||
            `${pending.actor.name} removed`,
        );
      } else {
        await promoteTicketActor(ticketId, pending.actor.partnerId);
        toast.success(
          t('ticketing.assignees.nowPrimary', { name: pending.actor.name }) ||
            `${pending.actor.name} is now primary`,
        );
      }
      setPending(null);
      await load();
    } catch (err) {
      setPending(null);
      const fallback =
        pending.kind === 'add'
          ? 'Failed to assign actor'
          : pending.kind === 'remove'
            ? 'Failed to remove actor'
            : 'Failed to set primary';
      toast.error(err instanceof Error ? err.message : fallback);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {loading ? (
        <div className="flex items-center gap-2 py-1 text-xs text-text-muted">
          <Loader2 size={14} className="animate-spin" /> {t('common.loading') || 'Loading…'}
        </div>
      ) : actors.length === 0 ? (
        <p className="text-xs italic text-text-muted">
          {t('ticketing.assignees.none') || 'No assignees yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {actors.map((a) => (
            <div key={a.partnerId} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface text-[10px] font-semibold text-text-primary">
                {initials(a.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{a.name}</span>
              {a.isPrimary ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold"
                  style={{ color: 'var(--color-brand)' }}
                >
                  <Star size={11} className="fill-current" />
                  {t('ticketing.assignees.primary') || 'Primary'}
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPending({ kind: 'promote', actor: a });
                  }}
                  disabled={acting}
                  title={t('ticketing.assignees.makePrimary') || 'Make primary'}
                  className="rounded-md p-1 text-text-muted transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Star size={14} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPending({ kind: 'remove', actor: a });
                }}
                disabled={acting}
                title={t('ticketing.assignees.remove') || 'Remove assignee'}
                className="rounded-md p-1 transition-transform active:scale-95 disabled:opacity-50"
                style={{ color: 'var(--color-error)' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          openSheet();
        }}
        disabled={acting}
        className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-transform active:scale-[0.97] disabled:opacity-50"
      >
        <UserPlus size={12} />
        {t('ticketing.assignees.add') || 'Add assignee'}
      </button>

      <SelectSheet<number>
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('ticketing.assignees.add') || 'Add assignee'}
        searchable
        loading={membersLoading}
        error={membersError}
        onRetry={loadMembers}
        emptyText={
          saId == null
            ? (t('ticketing.assignees.noSA') || 'No service account on ticket')
            : (t('ticketing.assignees.noMembers') || 'No members available')
        }
        items={candidateItems}
        onSelect={(item) => {
          const member = members.find((m) => m.partnerId === item.value);
          if (member) setPending({ kind: 'add', member });
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'add'
            ? (t('ticketing.assignees.confirmAddTitle', { name: pending.member.name }) || `Assign ${pending.member.name}?`)
            : pending?.kind === 'remove'
              ? (t('ticketing.assignees.confirmRemoveTitle', { name: pending.actor.name }) || `Remove ${pending.actor.name}?`)
              : pending
                ? (t('ticketing.assignees.confirmPromoteTitle', { name: pending.actor.name }) || `Make ${pending.actor.name} primary?`)
                : ''
        }
        message={
          pending?.kind === 'add'
            ? (t('ticketing.assignees.confirmAddMessage', { name: pending.member.name }) || `${pending.member.name} will be added as an assignee on this ticket.`)
            : pending?.kind === 'remove'
              ? (t('ticketing.assignees.confirmRemoveMessage', { name: pending.actor.name }) || `${pending.actor.name} will no longer be assigned to this ticket.`)
              : pending
                ? (t('ticketing.assignees.confirmPromoteMessage', { name: pending.actor.name }) || `${pending.actor.name} will become the primary assignee.`)
                : ''
        }
        confirmLabel={
          pending?.kind === 'add'
            ? (t('ticketing.assignees.assign') || 'Assign')
            : pending?.kind === 'remove'
              ? (t('ticketing.assignees.remove') || 'Remove')
              : (t('ticketing.assignees.makePrimary') || 'Make primary')
        }
        danger={pending?.kind === 'remove'}
        busy={acting}
        cancelLabel={t('common.cancel') || 'Cancel'}
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
