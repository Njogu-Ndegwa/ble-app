'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  AlertTriangle,
  Trash2,
  Edit3,
  Send,
  User,
  Search as SearchIcon,
  Loader2,
  Calendar,
  Tag,
  Layers,
  ChevronDown,
  X,
} from 'lucide-react';
import DetailScreen, { type DetailSection as DetailSectionType } from '@/components/ui/DetailScreen';
import { FormInput, FormSection, FormRow } from '@/components/ui';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';
import { MasterDetail } from '@/components/layout';
import FilterChips from '@/components/ui/FilterChips';
import SelectSheet, { type SelectSheetItem } from '@/components/ui/SelectSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TicketAssignees from './TicketAssignees';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { displayMessage, htmlToText } from '@/lib/note-attribution';
import type { TicketActor } from '@/lib/ticket-actors-api';
import {
  searchTickets,
  getAllTickets,
  getTicketById,
  updateTicket,
  createTicket,
  deleteTicket,
  getHelpdeskStages,
  getTicketMessages,
  postTicketMessage,
  type ExistingTicket,
  type TicketStageFilter,
} from '@/lib/services/ticket-service';
import { getContacts, type OdooContact } from '@/lib/odoo-api';
import type { HelpdeskStage, TicketMessage, TicketPriority } from '@/lib/tickets-types';

type SubView = 'list' | 'detail' | 'edit' | 'create';

// Session-level cache keyed by stage filter — survives remounts
const _cache: Partial<Record<string, { tickets: ExistingTicket[]; total: number }>> = {};
const cacheKey = (stage: TicketStageFilter) => (typeof stage === 'number' ? `s${stage}` : 'all');

interface TicketFormState {
  subject: string;
  description: string;
  priority: TicketPriority;
  stageId: number | null;
  partnerId: number | null;
  customerName: string;
}

const EMPTY_FORM: TicketFormState = {
  subject: '',
  description: '',
  priority: 'medium',
  stageId: null,
  partnerId: null,
  customerName: '',
};

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  urgent: 'list-card-badge list-card-badge--priority-urgent',
  high: 'list-card-badge list-card-badge--priority-high',
  medium: 'list-card-badge list-card-badge--priority-medium',
  low: 'list-card-badge list-card-badge--priority-low',
  none: 'list-card-badge list-card-badge--priority-none',
};

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

interface TicketingProps {
  onLogout?: () => void;
}

export default function Ticketing({ onLogout: _onLogout }: TicketingProps) {
  const { t } = useI18n();

  const [subView, setSubView] = useState<SubView>('list');
  const [selectedTicket, setSelectedTicket] = useState<ExistingTicket | null>(null);

  const [tickets, setTickets] = useState<ExistingTicket[]>(_cache['all']?.tickets ?? []);
  const [isLoading, setIsLoading] = useState(!_cache['all']);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(_cache['all']?.total ?? 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<ListPeriod>('all');
  const [stageFilter, setStageFilter] = useState<TicketStageFilter>('all');
  const [stages, setStages] = useState<HelpdeskStage[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<TicketFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TicketFormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Chatter
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [composing, setComposing] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Governance actors, reported up by TicketAssignees — the Assigned-to row
  // derives from them (the backend never dual-writes legacy assigned_to).
  const [detailActors, setDetailActors] = useState<TicketActor[]>([]);

  // Form pickers
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);

  // ------------------------------------------------------------------
  // Stages — load once on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    const token = getSalesRoleToken() || '';
    if (!token) return;
    getHelpdeskStages(token)
      .then(setStages)
      .catch(err => {
        console.error('[Ticketing] Failed to load stages:', err);
        toast.error(err?.message || t('ticketing.error.stages') || 'Failed to load stages');
      });
  }, [t]);

  // ------------------------------------------------------------------
  // Date filter helper
  // ------------------------------------------------------------------
  const getDateCutoff = useCallback((p: ListPeriod): Date | null => {
    const now = new Date();
    switch (p) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case '3days': { const d = new Date(now); d.setDate(d.getDate() - 3); return d; }
      case '5days': { const d = new Date(now); d.setDate(d.getDate() - 5); return d; }
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      case '14days': { const d = new Date(now); d.setDate(d.getDate() - 14); return d; }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
      default: return null;
    }
  }, []);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------
  const PAGE_SIZE = 20;

  const fetchTickets = useCallback(async (
    query?: string,
    stage: TicketStageFilter = 'all',
    pageNum = 1,
    append = false,
  ) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const token = getSalesRoleToken() || '';
      const result = query?.trim()
        ? await searchTickets(query, token, stage)
        : await getAllTickets(pageNum, PAGE_SIZE, token, stage);
      const incoming = result.tickets;
      setTickets(prev => append ? [...prev, ...incoming] : incoming);
      setTotalItems(result.total);
      setPage(pageNum);
      if (!query?.trim() && pageNum === 1) {
        _cache[cacheKey(stage)] = { tickets: incoming, total: result.total };
      }
    } catch (err: any) {
      toast.error(err?.message || t('ticketing.fetchError') || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [t]);

  const loadMore = useCallback(() => {
    fetchTickets(searchQuery, stageFilter, page + 1, true);
  }, [fetchTickets, searchQuery, stageFilter, page]);

  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstLoadRef.current ? 0 : 300;
    isFirstLoadRef.current = false;
    debounceRef.current = setTimeout(() => {
      fetchTickets(searchQuery, stageFilter, 1, false);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, stageFilter]);

  const filteredTickets = React.useMemo(() => {
    const cutoff = getDateCutoff(period);
    if (!cutoff) return tickets;
    return tickets.filter((t) => t.createdAt && new Date(t.createdAt) >= cutoff);
  }, [tickets, period, getDateCutoff]);

  // ------------------------------------------------------------------
  // Messages (chatter)
  // ------------------------------------------------------------------
  const loadMessages = useCallback(async (ticketId: number) => {
    setIsLoadingMessages(true);
    try {
      const token = getSalesRoleToken() || '';
      const list = await getTicketMessages(ticketId, token);
      setMessages(list);
    } catch (err: any) {
      console.error('[Ticketing] Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const handlePostMessage = useCallback(async () => {
    if (!selectedTicket) return;
    const body = composing.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    try {
      const token = getSalesRoleToken() || '';
      await postTicketMessage(selectedTicket.id, body, token);
      setComposing('');
      toast.success(t('ticketing.detail.noteLogged') || 'Note logged');
      await loadMessages(selectedTicket.id);
    } catch (err: any) {
      toast.error(err?.message || t('ticketing.detail.postError') || 'Failed to post note');
    } finally {
      setIsPosting(false);
    }
  }, [selectedTicket, composing, isPosting, loadMessages, t]);

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------
  const openDetail = useCallback(async (ticket: ExistingTicket) => {
    setSelectedTicket(null);
    setIsLoadingDetail(true);
    setSubView('detail');
    setMessages([]);
    setComposing('');
    setDetailActors([]);
    try {
      const token = getSalesRoleToken() || '';
      const result = await getTicketById(ticket.id, token);
      setSelectedTicket(result.ticket);
      void loadMessages(ticket.id);
    } catch (err: any) {
      toast.error(err?.message || t('ticketing.fetchDetailError') || 'Failed to load ticket');
      setSubView('list');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [t, loadMessages]);

  const openEdit = useCallback((ticket: ExistingTicket) => {
    setFormData({
      subject: ticket.subject,
      description: htmlToText(ticket.description),
      priority: ticket.priority === 'none' ? 'medium' : ticket.priority,
      stageId: ticket.stageId,
      partnerId: ticket.customerId,
      customerName: ticket.customerName,
    });
    setFormErrors({});
    setSelectedTicket(ticket);
    setSubView('edit');
  }, []);

  const openCreate = useCallback(() => {
    const defaultStage = stages.find(s => !s.fold)?.id ?? stages[0]?.id ?? null;
    setFormData({ ...EMPTY_FORM, stageId: defaultStage });
    setFormErrors({});
    setSelectedTicket(null);
    setSubView('create');
  }, [stages]);

  const goBackToList = useCallback(() => {
    setSubView('list');
    setSelectedTicket(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setMessages([]);
    setComposing('');
    setDetailActors([]);
  }, []);

  const goBackToDetail = useCallback(() => {
    setSubView('detail');
    setFormErrors({});
  }, []);

  // ------------------------------------------------------------------
  // Form helpers
  // ------------------------------------------------------------------
  const handleFormChange = useCallback(
    <K extends keyof TicketFormState>(field: K, value: TicketFormState[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof TicketFormState, string>> = {};
    if (!formData.subject.trim()) {
      errors.subject = t('ticketing.form.subjectRequired') || 'Subject is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  // ------------------------------------------------------------------
  // Save (create / update)
  // ------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const token = getSalesRoleToken() || '';
      const payload = {
        subject: formData.subject.trim(),
        description: formData.description,
        priority: formData.priority,
        stageId: formData.stageId ?? undefined,
        partnerId: formData.partnerId ?? undefined,
      };

      if (subView === 'edit' && selectedTicket) {
        const result = await updateTicket(selectedTicket.id, payload, token);
        setSelectedTicket(result.ticket);
        toast.success(t('ticketing.updated') || 'Ticket updated');
        setSubView('detail');
      } else {
        await createTicket(payload, token);
        toast.success(t('ticketing.created') || 'Ticket created');
        goBackToList();
      }
      // Invalidate cache so list reflects latest
      delete _cache[cacheKey(stageFilter)];
      fetchTickets(searchQuery, stageFilter);
    } catch (err: any) {
      toast.error(err?.message || t('ticketing.saveError') || 'Failed to save ticket');
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, formData, subView, selectedTicket, fetchTickets, searchQuery, stageFilter, goBackToList, t]);

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  const handleDelete = useCallback(async () => {
    if (!selectedTicket) return;
    setIsDeleting(true);
    try {
      const token = getSalesRoleToken() || '';
      await deleteTicket(selectedTicket.id, token);
      toast.success(t('ticketing.deleted') || 'Ticket deleted');
      setShowDeleteConfirm(false);
      goBackToList();
      delete _cache[cacheKey(stageFilter)];
      fetchTickets(searchQuery, stageFilter);
    } catch (err: any) {
      toast.error(err?.message || t('ticketing.deleteError') || 'Failed to delete ticket');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedTicket, fetchTickets, searchQuery, stageFilter, goBackToList, t]);

  // ------------------------------------------------------------------
  // Format helpers
  // ------------------------------------------------------------------
  const formatDate = (iso: string) => {
    if (!iso) return '--';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const priorityLabel = (p: ExistingTicket['priority']) => {
    if (p === 'none') return t('ticketing.priority.none') || 'None';
    return t(`ticketing.priority.${p}`) || p.charAt(0).toUpperCase() + p.slice(1);
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  // ------------------------------------------------------------------
  // DELETE CONFIRMATION MODAL
  // ------------------------------------------------------------------
  const deleteConfirmModal = selectedTicket && (
    <ConfirmDialog
      open={showDeleteConfirm}
      title={t('ticketing.detail.deleteConfirmTitle') || 'Delete Ticket?'}
      message={t('ticketing.detail.deleteConfirmMessage') || `Delete "${selectedTicket.subject}"? This cannot be undone.`}
      confirmLabel={t('common.delete') || 'Delete'}
      icon={<AlertTriangle size={24} style={{ color: 'var(--color-error)' }} />}
      iconBackground="var(--color-error-soft)"
      danger
      busy={isDeleting}
      cancelLabel={t('common.cancel') || 'Cancel'}
      onCancel={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
    />
  );

  // ------------------------------------------------------------------
  // LIST VIEW
  // ------------------------------------------------------------------
  const STAGE_FILTER_ITEMS = React.useMemo(() => {
    const items = [{ key: 'all', label: t('ticketing.list.filter.all') || 'All' }];
    for (const s of stages) {
      items.push({ key: String(s.id), label: s.name });
    }
    return items;
  }, [stages, t]);

  const renderList = () => (
      <ListScreen
        title={t('ticketing.title') || 'Tickets'}
        searchPlaceholder={t('ticketing.list.search') || 'Search tickets…'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        period={period}
        onPeriodChange={setPeriod}
        isLoading={isLoading}
        onRefresh={() => {
          delete _cache[cacheKey(stageFilter)];
          fetchTickets(searchQuery, stageFilter);
        }}
        isEmpty={filteredTickets.length === 0}
        emptyIcon={<Tag size={28} className="text-text-muted" />}
        emptyMessage={
          searchQuery.trim()
            ? (t('ticketing.list.noResults') || 'No tickets match your search')
            : (t('ticketing.list.empty') || 'No tickets yet')
        }
        emptyHint={
          searchQuery.trim()
            ? (t('ticketing.list.tryDifferentSearch') || 'Try a different search term')
            : (t('ticketing.list.tapPlusToCreate') || 'Tap + to create a new ticket')
        }
        itemCount={filteredTickets.length}
        itemLabel={filteredTickets.length === 1
          ? (t('ticketing.itemSingular') || 'ticket')
          : (t('ticketing.itemPlural') || 'tickets')
        }
        headerExtra={
          stages.length > 0 ? (
            <FilterChips
              items={STAGE_FILTER_ITEMS}
              activeKey={stageFilter === 'all' ? 'all' : String(stageFilter)}
              onSelect={(key) => setStageFilter(key === 'all' ? 'all' : Number(key))}
            />
          ) : undefined
        }
        fabAction={openCreate}
        fabLabel={t('ticketing.new') || 'New Ticket'}
      >
        {filteredTickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => openDetail(ticket)}
            className="list-card w-full text-left"
          >
            <div className="list-card-body list-card-body--with-avatar">
              <div className="list-card-avatar list-card-avatar--primary">
                #{ticket.id}
              </div>
              <div className="list-card-content">
                <div className="list-card-primary">{ticket.subject || `Ticket #${ticket.id}`}</div>
                <div className="list-card-secondary">
                  <Layers size={10} /> {ticket.stageName || (t('ticketing.stage.unknown') || '(no stage)')}
                </div>
                <div className="list-card-meta">
                  {ticket.customerName ? (
                    <>
                      <User size={10} />
                      <span>{ticket.customerName}</span>
                      <span className="list-card-dot">&middot;</span>
                    </>
                  ) : null}
                  <Calendar size={10} />
                  <span>{formatDate(ticket.createdAt)}</span>
                </div>
              </div>
              <div className="list-card-actions">
                <span className={PRIORITY_BADGE_CLASS[ticket.priority] || PRIORITY_BADGE_CLASS.none}>
                  {priorityLabel(ticket.priority)}
                </span>
              </div>
            </div>
          </button>
        ))}
        {!searchQuery.trim() && tickets.length < totalItems && (
          <div style={{ padding: '8px 0 4px', display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={loadMore}
              disabled={isLoadingMore}
              style={{ minWidth: 140 }}
            >
              {isLoadingMore
                ? (t('common.loading') || 'Loading…')
                : `${t('common.loadMore') || 'Load more'} (${totalItems - tickets.length} ${t('common.remaining') || 'remaining'})`}
            </button>
          </div>
        )}
      </ListScreen>
  );

  // ------------------------------------------------------------------
  // DETAIL VIEW (with delete support + embedded chatter)
  // ------------------------------------------------------------------
  const renderDetailLoading = () => (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button onClick={goBackToList} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors" aria-label="Back">
            <ArrowLeft size={20} className="text-text-primary" />
          </button>
        </div>
        <div className="flex-1 px-4 pb-6 animate-pulse">
          <div className="flex items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-bg-elevated flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-bg-elevated" />
              <div className="h-3 w-20 rounded bg-bg-elevated" />
            </div>
          </div>
          <div className="flex flex-col gap-4 mt-1">
            {[3, 2, 1].map((rows, i) => (
              <div key={i}>
                <div className="h-3 w-16 rounded bg-bg-elevated mb-2 ml-1" />
                <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden divide-y divide-border">
                  {Array.from({ length: rows }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-5 h-5 rounded bg-bg-elevated flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-12 rounded bg-bg-elevated" />
                        <div className="h-3.5 w-32 rounded bg-bg-elevated" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
  );

  const renderDetail = () => {
    if (!selectedTicket) return null;
    const stageName = selectedTicket.stageName || (t('ticketing.stage.unknown') || '(no stage)');
    const description = htmlToText(selectedTicket.description);
    const detailSections: DetailSectionType[] = [
      {
        title: t('ticketing.detail.summary') || 'Summary',
        fields: [
          {
            icon: <Tag size={15} />,
            label: t('ticketing.list.filter.priority') || 'Priority',
            value: priorityLabel(selectedTicket.priority),
            renderValue: (
              <span className={PRIORITY_BADGE_CLASS[selectedTicket.priority] || PRIORITY_BADGE_CLASS.none}>
                {priorityLabel(selectedTicket.priority)}
              </span>
            ),
          },
          { icon: <Layers size={15} />, label: t('ticketing.list.filter.stage') || 'Stage', value: stageName },
          { icon: <Calendar size={15} />, label: t('ticketing.detail.created') || 'Created', value: formatDate(selectedTicket.createdAt) },
        ],
      },
      ...(description ? [{
        title: t('ticketing.new.description') || 'Description',
        fields: [
          {
            icon: undefined,
            label: '',
            value: description,
            renderValue: (
              <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                {description}
              </p>
            ),
          },
        ],
      }] : []),
      {
        title: t('ticketing.detail.people') || 'People',
        fields: [
          { icon: <User size={15} />, label: t('ticketing.detail.customer') || 'Customer', value: selectedTicket.customerName || '--' },
          {
            icon: <User size={15} />,
            label: t('ticketing.detail.assignedTo') || 'Assigned to',
            // Primary actor → any actor → legacy assigned_to → "--". The
            // backend never dual-writes assigned_to when actors change, so
            // the governance actors list is the source of truth.
            value:
              (detailActors.find((a) => a.isPrimary)?.name
                ?? detailActors[0]?.name
                ?? selectedTicket.assigneeName) || '--',
          },
        ],
      },
      {
        title: t('ticketing.detail.assignees') || 'Assignees',
        fields: [
          {
            icon: undefined,
            label: '',
            value: '',
            renderValue: (
              <TicketAssignees
                ticketId={selectedTicket.id}
                onActorsChange={setDetailActors}
              />
            ),
          },
        ],
      },
      {
        title: t('ticketing.detail.chatter') || 'Activity',
        fields: [
          {
            icon: undefined,
            label: '',
            value: '',
            renderValue: (
              <div className="flex flex-col gap-3 w-full">
                {/* Composer */}
                <div className="flex flex-col gap-2">
                  <textarea
                    value={composing}
                    onChange={(e) => setComposing(e.target.value)}
                    placeholder={t('ticketing.detail.composePlaceholder') || 'Post a note…'}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-bg-surface text-text-primary text-sm p-2 outline-none focus:border-primary"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePostMessage(); }}
                    disabled={!composing.trim() || isPosting}
                    className="self-end flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                  >
                    {isPosting ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.posting') || 'Posting…'}</>
                    ) : (
                      <><Send size={12} />{t('ticketing.detail.post') || 'Post'}</>
                    )}
                  </button>
                </div>
                {/* Messages */}
                {isLoadingMessages ? (
                  <div className="flex justify-center py-3">
                    <Loader2 size={18} className="animate-spin text-text-muted" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-text-muted italic">
                    {t('ticketing.detail.noMessages') || 'No activity yet.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((m) => {
                      const dm = displayMessage(m);
                      return (
                        <div key={m.id} className="rounded-lg border border-border bg-bg-surface p-2.5">
                          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                            <span className="font-semibold text-text-primary">{dm.author}</span>
                            <span>{m.date}</span>
                          </div>
                          <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                            {dm.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ],
      },
    ];

    return (
      <div className="h-full" style={{ animation: 'fadeIn 150ms ease-out' }}>
        {deleteConfirmModal}
        <DetailScreen
          onBack={goBackToList}
          avatar={`#${selectedTicket.id}`}
          title={selectedTicket.subject || `Ticket #${selectedTicket.id}`}
          subtitle={selectedTicket.saName ? `SA: ${selectedTicket.saName}` : `ID: ${selectedTicket.id}`}
          sections={detailSections}
          headerActions={[
            {
              icon: <Trash2 size={18} style={{ color: 'var(--color-error)' }} />,
              label: t('ticketing.detail.delete') || 'Delete Ticket',
              onClick: () => setShowDeleteConfirm(true),
            },
          ]}
          fabAction={() => openEdit(selectedTicket)}
          fabIcon={<Edit3 size={20} strokeWidth={2.5} />}
          fabLabel={t('ticketing.detail.edit') || 'Edit Ticket'}
        />
        <style jsx>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      </div>
    );
  };

  // ------------------------------------------------------------------
  // EDIT / CREATE VIEW
  // ------------------------------------------------------------------
  const renderForm = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button onClick={subView === 'edit' ? goBackToDetail : goBackToList} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors" aria-label="Back">
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {subView === 'edit'
            ? (t('ticketing.detail.edit') || 'Edit Ticket')
            : (t('ticketing.new') || 'New Ticket')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FormSection title={t('ticketing.form.basics') || 'Basics'}>
          <FormInput
            label={t('ticketing.new.subject') || 'Subject'}
            required
            value={formData.subject}
            onChange={(e) => handleFormChange('subject', e.target.value)}
            placeholder={t('ticketing.new.subjectPlaceholder') || 'Brief summary'}
            error={formErrors.subject}
          />

          <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: 4, fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {t('ticketing.new.description') || 'Description'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder={t('ticketing.new.descriptionPlaceholder') || 'Details…'}
              rows={4}
              className="w-full"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                padding: '10px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
              }}
            />
          </div>

          <FormRow columns={2}>
            <SheetField
              label={t('ticketing.list.filter.priority') || 'Priority'}
              value={priorityLabel(formData.priority)}
              icon={<Tag size={14} />}
              onClick={() => setPriorityOpen(true)}
            />
            <SheetField
              label={t('ticketing.list.filter.stage') || 'Stage'}
              value={
                formData.stageId !== null
                  ? (stages.find(s => s.id === formData.stageId)?.name
                      ?? (t('ticketing.stage.unknown') || '(no stage)'))
                  : (t('ticketing.stage.unknown') || '(no stage)')
              }
              icon={<Layers size={14} />}
              placeholder={stages.length === 0 ? (t('common.loading') || 'Loading…') : undefined}
              disabled={stages.length === 0}
              onClick={() => setStageOpen(true)}
            />
          </FormRow>

          <SelectSheet<TicketPriority>
            isOpen={priorityOpen}
            onClose={() => setPriorityOpen(false)}
            title={t('ticketing.list.filter.priority') || 'Priority'}
            activeValue={formData.priority}
            items={PRIORITIES.map<SelectSheetItem<TicketPriority>>(p => ({
              value: p,
              label: priorityLabel(p),
            }))}
            onSelect={(item) => handleFormChange('priority', item.value)}
          />
          <SelectSheet<number>
            isOpen={stageOpen}
            onClose={() => setStageOpen(false)}
            title={t('ticketing.list.filter.stage') || 'Stage'}
            activeValue={formData.stageId ?? undefined}
            items={stages.map<SelectSheetItem<number>>(s => ({
              value: s.id,
              label: s.name,
              badges: s.fold
                ? [{ label: t('ticketing.stage.done') || 'Done', variant: 'neutral' }]
                : undefined,
            }))}
            onSelect={(item) => handleFormChange('stageId', item.value)}
          />
        </FormSection>

        <FormSection title={t('ticketing.new.customer') || 'Customer'}>
          <CustomerPickerField
            value={formData.partnerId ? { id: formData.partnerId, name: formData.customerName } : null}
            onChange={(c) => {
              setFormData(prev => ({
                ...prev,
                partnerId: c?.id ?? null,
                customerName: c?.name ?? '',
              }));
            }}
          />
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <button onClick={handleSave} disabled={isSaving} className="w-full py-3 rounded-xl bg-brand text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving') || 'Saving...'}</>
          ) : (
            subView === 'edit'
              ? (t('common.saveChanges') || 'Save Changes')
              : (t('ticketing.new.submit') || 'Create Ticket')
          )}
        </button>
      </div>
    </div>
  );

  const detailPane =
    subView === 'detail'
      ? (isLoadingDetail ? renderDetailLoading() : renderDetail())
      : subView === 'create' || subView === 'edit'
        ? renderForm()
        : null;

  return (
    <MasterDetail
      isDetailActive={subView !== 'list'}
      list={renderList()}
      detail={detailPane}
      placeholder={t('ticketing.selectTicketHint') || 'Select a ticket to view its details'}
    />
  );
}

// ============================================================================
// SheetField — labeled trigger that opens a SelectSheet. Matches FormInput
// dimensions so the form reads visually consistent.
// ============================================================================

function SheetField({
  label,
  value,
  icon,
  placeholder,
  disabled,
  onClick,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const hasValue = value.length > 0;
  return (
    <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
      <label
        className="text-label"
        style={{
          display: 'block',
          marginBottom: 4,
          fontSize: 'var(--font-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full flex items-center gap-2 transition-colors"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)',
          padding: '10px 12px',
          fontSize: '13px',
          height: 40,
          textAlign: 'left',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {icon && (
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>{icon}</span>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hasValue ? value : placeholder || ''}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
    </div>
  );
}

// ============================================================================
// CustomerPickerField — orders-style inline expand card (avoids absolute
// dropdown clipping by parent overflow containers).
// ============================================================================

interface PickedCustomer { id: number; name: string }

function CustomerPickerField({
  value,
  onChange,
}: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<OdooContact[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce search input → debouncedQuery
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch on open or when debounced query changes — mirrors orders/CreateOrder.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getSalesRoleToken();
        const res = await getContacts(
          { q: debouncedQuery.trim() || undefined, limit: 10 },
          token || undefined,
        );
        if (!cancelled) setResults(res.contacts ?? []);
      } catch (err) {
        console.error('[Ticketing] customer search failed:', err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [open, debouncedQuery]);

  return (
    <>
      {/* Trigger pill — same dimensions as FormInput / SheetField */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center gap-2 transition-colors active:scale-[0.98]"
        style={{
          backgroundColor: value ? 'var(--color-brand-soft, rgba(255,200,0,0.06))' : 'var(--bg-surface)',
          border: `1px solid ${value ? 'var(--color-brand)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          padding: '10px 12px',
          fontSize: '13px',
          minHeight: 40,
          textAlign: 'left',
        }}
      >
        <User
          size={14}
          style={{ color: value ? 'var(--color-brand)' : 'var(--text-muted)', flexShrink: 0 }}
        />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? value.name : (t('ticketing.new.customerPlaceholder') || 'Search customers…')}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange(null);
              }
            }}
            aria-label={t('common.clear') || 'Clear'}
            style={{ color: 'var(--text-muted)', flexShrink: 0, padding: 2 }}
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : undefined,
              transition: 'transform 150ms',
            }}
          />
        )}
      </button>

      {/* Selected customer brief — same as orders */}
      {value && !open && (
        <div
          className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
            style={{ backgroundColor: 'var(--color-brand)', color: 'var(--text-inverse, #000)' }}
          >
            {value.name.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs font-medium text-text-primary truncate flex-1">{value.name}</p>
        </div>
      )}

      {/* Inline expand card with search + results — no absolute positioning,
          so it can't be clipped by parent overflow. */}
      {open && (
        <div
          className="mt-2 rounded-xl border border-border overflow-hidden shadow-lg"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="p-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon size={14} className="text-text-muted" />
              </div>
              <input
                type="text"
                placeholder={t('ticketing.new.customerPlaceholder') || 'Search customers…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          {loading ? (
            <div className="py-4 flex justify-center">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs py-4 text-center text-text-muted">
              {t('ticketing.new.noCustomers') || 'No customers found.'}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-1">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: c.id, name: c.name });
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-bg-elevated"
                >
                  <span className="font-medium text-text-primary">{c.name}</span>
                  {(c.email || c.phone) && (
                    <span className="text-[11px] ml-2 text-text-muted">
                      {String(c.email || c.phone)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
