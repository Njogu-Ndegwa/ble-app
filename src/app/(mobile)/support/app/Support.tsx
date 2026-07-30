'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Send,
  User,
  Loader2,
  Calendar,
  Tag,
  Layers,
  ChevronDown,
} from 'lucide-react';
import DetailScreen, { type DetailSection as DetailSectionType } from '@/components/ui/DetailScreen';
import { FormInput, FormSection } from '@/components/ui';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';
import { MasterDetail } from '@/components/layout';
import FilterChips from '@/components/ui/FilterChips';
import SelectSheet, { type SelectSheetItem } from '@/components/ui/SelectSheet';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  listTickets,
  getTicketById,
  updateTicket,
  createTicket,
  moveTicketStage,
  getHelpdeskStages,
  getTicketMessages,
  postTicketMessage,
  getSessionPartnerId,
  type ExistingTicket,
  type TicketStageFilter,
} from '@/lib/services/ticket-service';
import { displayMessage, htmlToText } from '@/lib/note-attribution';
import type { HelpdeskStage, TicketMessage, TicketPriority } from '@/lib/tickets-types';

// ============================================================================
// Support — the end-user ticketing applet (slug `ticketing-customer`).
//
// Ports the desktop portal's /portal/support applet: every member of the SA
// sees all the SA's tickets and can comment; tickets whose customer equals
// the session's partner are "mine" and can be edited or closed while open.
// Deliberately NOT shared with the agent Ticketing applet (no assignment,
// no stage moves besides close, no delete) — the two evolve independently.
// ============================================================================

type SubView = 'list' | 'detail' | 'edit' | 'create';

// Session-level cache keyed by stage+priority filter — survives remounts
const _cache: Partial<Record<string, { tickets: ExistingTicket[]; total: number }>> = {};
const cacheKey = (stage: TicketStageFilter, priority: TicketPriority | null) =>
  `${typeof stage === 'number' ? `s${stage}` : 'all'}|${priority ?? 'any'}`;
const clearCache = () => {
  Object.keys(_cache).forEach((k) => delete _cache[k]);
};

interface TicketFormState {
  subject: string;
  description: string;
  priority: TicketPriority;
}

const EMPTY_FORM: TicketFormState = {
  subject: '',
  description: '',
  priority: 'medium',
};

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  urgent: 'list-card-badge list-card-badge--priority-urgent',
  high: 'list-card-badge list-card-badge--priority-high',
  medium: 'list-card-badge list-card-badge--priority-medium',
  low: 'list-card-badge list-card-badge--priority-low',
  none: 'list-card-badge list-card-badge--priority-none',
};

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

interface SupportProps {
  onLogout?: () => void;
}

export default function Support({ onLogout: _onLogout }: SupportProps) {
  const { t } = useI18n();

  const [subView, setSubView] = useState<SubView>('list');
  const [selectedTicket, setSelectedTicket] = useState<ExistingTicket | null>(null);

  const [tickets, setTickets] = useState<ExistingTicket[]>(_cache[cacheKey('all', null)]?.tickets ?? []);
  const [isLoading, setIsLoading] = useState(!_cache[cacheKey('all', null)]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(_cache[cacheKey('all', null)]?.total ?? 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<ListPeriod>('all');
  const [stageFilter, setStageFilter] = useState<TicketStageFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [stages, setStages] = useState<HelpdeskStage[]>([]);
  // Distinguishes "stage fetch failed" (edit/close suppressed — we can't tell
  // whether a ticket is closed) from "team has no stages" (nothing can be
  // folded, so edit is legitimately available).
  const [stagesLoaded, setStagesLoaded] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // The session's partner id — what "mine" means everywhere in this applet.
  const [myPartnerId] = useState<number | null>(() => getSessionPartnerId());

  const [formData, setFormData] = useState<TicketFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TicketFormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Chatter
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [composing, setComposing] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Form pickers
  const [priorityOpen, setPriorityOpen] = useState(false);

  // ------------------------------------------------------------------
  // Stages — load once on mount (sorted by sequence in the service)
  // ------------------------------------------------------------------
  useEffect(() => {
    const token = getSalesRoleToken() || '';
    if (!token) return;
    getHelpdeskStages(token)
      .then((list) => {
        setStages(list);
        setStagesLoaded(true);
      })
      .catch(err => {
        console.error('[Support] Failed to load stages:', err);
        toast.error(err?.message || t('support.error.stages') || 'Failed to load stages');
      });
  }, [t]);

  const stageById = useMemo(() => {
    const m = new Map<number, HelpdeskStage>();
    stages.forEach((s) => m.set(s.id, s));
    return m;
  }, [stages]);

  // First folded stage (stages come sorted by sequence) = "Closed" target.
  // No folded stage → Close is hidden rather than broken.
  const closeStage = useMemo(() => stages.find((s) => s.fold) ?? null, [stages]);

  const isMine = useCallback(
    (ticket: ExistingTicket) => myPartnerId !== null && ticket.customerId === myPartnerId,
    [myPartnerId],
  );

  const isTerminal = useCallback(
    (ticket: ExistingTicket) =>
      ticket.stageId != null && (stageById.get(ticket.stageId)?.fold ?? false),
    [stageById],
  );

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
    priority: TicketPriority | null = null,
    pageNum = 1,
    append = false,
  ) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const token = getSalesRoleToken() || '';
      const result = await listTickets({
        page: pageNum,
        limit: PAGE_SIZE,
        search: query,
        stage,
        priority: priority ?? undefined,
      }, token);
      const incoming = result.tickets;
      setTickets(prev => append ? [...prev, ...incoming] : incoming);
      setTotalItems(result.total);
      setPage(pageNum);
      if (!query?.trim() && pageNum === 1) {
        _cache[cacheKey(stage, priority)] = { tickets: incoming, total: result.total };
      }
    } catch (err: any) {
      toast.error(err?.message || t('support.fetchError') || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [t]);

  const loadMore = useCallback(() => {
    fetchTickets(searchQuery, stageFilter, priorityFilter, page + 1, true);
  }, [fetchTickets, searchQuery, stageFilter, priorityFilter, page]);

  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstLoadRef.current ? 0 : 300;
    isFirstLoadRef.current = false;
    debounceRef.current = setTimeout(() => {
      fetchTickets(searchQuery, stageFilter, priorityFilter, 1, false);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, stageFilter, priorityFilter]);

  const filteredTickets = React.useMemo(() => {
    const cutoff = getDateCutoff(period);
    if (!cutoff) return tickets;
    return tickets.filter((t) => t.createdAt && new Date(t.createdAt) >= cutoff);
  }, [tickets, period, getDateCutoff]);

  // ------------------------------------------------------------------
  // Messages (chatter) — anyone in the SA can read and post
  // ------------------------------------------------------------------
  const loadMessages = useCallback(async (ticketId: number) => {
    setIsLoadingMessages(true);
    try {
      const token = getSalesRoleToken() || '';
      const list = await getTicketMessages(ticketId, token);
      setMessages(list);
    } catch (err: any) {
      console.error('[Support] Failed to load messages:', err);
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
      await loadMessages(selectedTicket.id);
    } catch (err: any) {
      toast.error(err?.message || t('support.detail.postError') || 'Failed to post note');
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
    try {
      const token = getSalesRoleToken() || '';
      const result = await getTicketById(ticket.id, token);
      setSelectedTicket(result.ticket);
      void loadMessages(ticket.id);
    } catch (err: any) {
      toast.error(err?.message || t('support.fetchDetailError') || 'Failed to load ticket');
      setSubView('list');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [t, loadMessages]);

  const openEdit = useCallback((ticket: ExistingTicket) => {
    // Only the ticket's owner can edit, and only while it's open. Requires a
    // successful stage load — otherwise we can't tell open from closed.
    if (!isMine(ticket) || !stagesLoaded || isTerminal(ticket)) return;
    setFormData({
      subject: ticket.subject,
      description: htmlToText(ticket.description),
      priority: ticket.priority === 'none' ? 'medium' : ticket.priority,
    });
    setFormErrors({});
    setSelectedTicket(ticket);
    setSubView('edit');
  }, [isMine, isTerminal, stagesLoaded]);

  const openCreate = useCallback(() => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setSelectedTicket(null);
    setSubView('create');
  }, []);

  const goBackToList = useCallback(() => {
    setSubView('list');
    setSelectedTicket(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setMessages([]);
    setComposing('');
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

      if (subView === 'edit' && selectedTicket) {
        const result = await updateTicket(selectedTicket.id, {
          subject: formData.subject.trim(),
          description: formData.description,
          priority: formData.priority,
        }, token);
        setSelectedTicket(result.ticket);
        toast.success(t('support.updated') || 'Ticket updated');
        setSubView('detail');
      } else {
        // Ticket customer = the logged-in user's partner. This is what marks
        // the ticket as "mine" (edit/close affordances) everywhere else. A
        // session without a partner record still creates fine — just unowned.
        await createTicket({
          subject: formData.subject.trim(),
          description: formData.description,
          priority: formData.priority,
          partnerId: getSessionPartnerId() ?? undefined,
        }, token);
        toast.success(t('support.created') || 'Ticket raised');
        goBackToList();
      }
      clearCache();
      fetchTickets(searchQuery, stageFilter, priorityFilter);
    } catch (err: any) {
      toast.error(err?.message || t('support.saveError') || 'Failed to save ticket');
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, formData, subView, selectedTicket, fetchTickets, searchQuery, stageFilter, priorityFilter, goBackToList, t]);

  // ------------------------------------------------------------------
  // Close — move to the first folded stage (Odoo's done/closed convention)
  // ------------------------------------------------------------------
  const handleClose = useCallback(async () => {
    if (!selectedTicket || !closeStage) return;
    setIsClosing(true);
    try {
      const token = getSalesRoleToken() || '';
      const result = await moveTicketStage(selectedTicket.id, closeStage.id, token);
      setSelectedTicket(result.ticket);
      toast.success(t('support.closed') || 'Ticket closed');
      setShowCloseConfirm(false);
      clearCache();
      fetchTickets(searchQuery, stageFilter, priorityFilter);
    } catch (err: any) {
      toast.error(err?.message || t('support.closeError') || 'Failed to close ticket');
    } finally {
      setIsClosing(false);
    }
  }, [selectedTicket, closeStage, fetchTickets, searchQuery, stageFilter, priorityFilter, t]);

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
  // CLOSE CONFIRMATION MODAL
  // ------------------------------------------------------------------
  const closeConfirmModal = showCloseConfirm && selectedTicket && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isClosing && setShowCloseConfirm(false)} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-success-soft, rgba(16,185,129,0.12))' }}
          >
            <CheckCircle2 size={24} style={{ color: 'var(--color-success)' }} />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('support.closeConfirmTitle') || 'Close Ticket?'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('support.closeConfirmMessage') || 'Support will stop working on this ticket.'}
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowCloseConfirm(false)}
            disabled={isClosing}
            className="flex-1 py-3 rounded-xl border font-medium text-sm transition-colors active:scale-[0.98]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleClose}
            disabled={isClosing}
            className="flex-1 py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: 'var(--color-success)' }}
          >
            {isClosing ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.closing') || 'Closing…'}</>
            ) : (
              <><CheckCircle2 size={16} />{t('support.close') || 'Close Ticket'}</>
            )}
          </button>
        </div>
      </div>
    </div>
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

  const PRIORITY_FILTER_ITEMS = React.useMemo(() => {
    const items = [{ key: 'any', label: t('ticketing.list.filter.any') || 'Any' }];
    for (const p of PRIORITIES) {
      items.push({ key: p, label: priorityLabel(p) });
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const renderList = () => (
      <ListScreen
        title={t('support.title') || 'Support'}
        searchPlaceholder={t('support.list.search') || 'Search tickets…'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        period={period}
        onPeriodChange={setPeriod}
        isLoading={isLoading}
        onRefresh={() => {
          clearCache();
          fetchTickets(searchQuery, stageFilter, priorityFilter);
        }}
        isEmpty={filteredTickets.length === 0}
        emptyIcon={<Tag size={28} className="text-text-muted" />}
        emptyMessage={
          searchQuery.trim()
            ? (t('support.list.noResults') || 'No tickets match your search')
            : (t('support.list.empty') || 'No tickets yet')
        }
        emptyHint={
          searchQuery.trim()
            ? (t('support.list.tryDifferentSearch') || 'Try a different search term')
            : (t('support.list.tapPlusToCreate') || 'Tap + to raise a ticket')
        }
        itemCount={filteredTickets.length}
        itemLabel={filteredTickets.length === 1
          ? (t('support.itemSingular') || 'ticket')
          : (t('support.itemPlural') || 'tickets')
        }
        headerExtra={
          <div className="flex flex-col gap-1.5">
            {stages.length > 0 && (
              <FilterChips
                items={STAGE_FILTER_ITEMS}
                activeKey={stageFilter === 'all' ? 'all' : String(stageFilter)}
                onSelect={(key) => setStageFilter(key === 'all' ? 'all' : Number(key))}
              />
            )}
            {/* Priority filtering doesn't depend on stages — keep it available
                even when the stage list is empty or failed to load. */}
            <FilterChips
              items={PRIORITY_FILTER_ITEMS}
              activeKey={priorityFilter ?? 'any'}
              onSelect={(key) => setPriorityFilter(key === 'any' ? null : (key as TicketPriority))}
            />
          </div>
        }
        fabAction={openCreate}
        fabLabel={t('support.new') || 'Raise Ticket'}
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
                <div className="flex flex-col items-end gap-1">
                  <span className={PRIORITY_BADGE_CLASS[ticket.priority] || PRIORITY_BADGE_CLASS.none}>
                    {priorityLabel(ticket.priority)}
                  </span>
                  {isMine(ticket) && (
                    <span className="list-card-badge list-card-badge--info">
                      {t('support.mine') || 'Mine'}
                    </span>
                  )}
                </div>
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
  // DETAIL VIEW (chatter + own-ticket edit/close affordances)
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
    const mine = isMine(selectedTicket);
    const terminal = isTerminal(selectedTicket);
    const canAct = mine && stagesLoaded && !terminal;
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
          { icon: <User size={15} />, label: t('ticketing.detail.assignedTo') || 'Assigned to', value: selectedTicket.assigneeName || '--' },
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
                {/* Composer — anyone in the SA can comment */}
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
        {closeConfirmModal}
        <DetailScreen
          onBack={goBackToList}
          avatar={`#${selectedTicket.id}`}
          title={selectedTicket.subject || `Ticket #${selectedTicket.id}`}
          subtitle={mine ? (t('support.mine') || 'Mine') : `ID: ${selectedTicket.id}`}
          sections={detailSections}
          headerActions={canAct && closeStage ? [
            {
              icon: <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />,
              label: t('support.close') || 'Close Ticket',
              onClick: () => setShowCloseConfirm(true),
            },
          ] : undefined}
          fabAction={canAct ? () => openEdit(selectedTicket) : undefined}
          fabIcon={canAct ? <Edit3 size={20} strokeWidth={2.5} /> : undefined}
          fabLabel={canAct ? (t('support.detail.edit') || 'Edit Ticket') : undefined}
        />
        <style jsx>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      </div>
    );
  };

  // ------------------------------------------------------------------
  // EDIT / CREATE VIEW — subject, description, priority. No stage or
  // customer pickers: the customer is always the session's own partner.
  // ------------------------------------------------------------------
  const renderForm = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button onClick={subView === 'edit' ? goBackToDetail : goBackToList} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors" aria-label="Back">
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {subView === 'edit'
            ? (t('support.detail.edit') || 'Edit Ticket')
            : (t('support.new') || 'Raise Ticket')}
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

          <SheetField
            label={t('ticketing.list.filter.priority') || 'Priority'}
            value={priorityLabel(formData.priority)}
            icon={<Tag size={14} />}
            onClick={() => setPriorityOpen(true)}
          />

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
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <button onClick={handleSave} disabled={isSaving} className="w-full py-3 rounded-xl bg-brand text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving') || 'Saving...'}</>
          ) : (
            subView === 'edit'
              ? (t('common.saveChanges') || 'Save Changes')
              : (t('support.new.submit') || 'Raise Ticket')
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
      placeholder={t('support.selectTicketHint') || 'Select a ticket to view its details'}
    />
  );
}

// ============================================================================
// SheetField — labeled trigger that opens a SelectSheet. Matches FormInput
// dimensions so the form reads visually consistent. (Module-private twin of
// the one in the agent Ticketing applet — the two applets stay independent.)
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
