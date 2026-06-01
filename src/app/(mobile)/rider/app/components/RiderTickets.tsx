"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HelpCircle, MessageCircle, Clock, X } from "lucide-react";
import { useI18n } from "@/i18n";
import ListScreen from "@/components/ui/ListScreen";
import { buildOdooHeaders } from "@/lib/odoo-api";

interface Ticket {
  id: number;
  number?: string;
  subject: string;
  priority: string;
  partner_id?: number;
  customer?: string;
  create_date: string;
  description?: string;
}

interface RiderTicketsProps {
  partnerId?: number | null;
  customer?: {
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    partner_id?: number;
  } | null;
  activeSubscriptionId?: number | null;
}

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";

const getHeaders = (): HeadersInit => {
  // Rider context — explicitly omit X-SA-ID. The rider applet is not
  // SA-scoped and a stale SA id sitting in localStorage from a prior
  // attendant/sales session would otherwise leak into rider requests.
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken_rider") ?? undefined
      : undefined;
  return buildOdooHeaders(token, null);
};

const priorityBadge = (priority: string) => {
  switch (priority) {
    case "4":
      return "list-card-badge--overdue";
    case "3":
      return "list-card-badge--progress";
    case "1":
      return "list-card-badge--default";
    default:
      return "list-card-badge--info";
  }
};

const priorityLabel = (priority: string, t: (k: string) => string): string => {
  switch (priority) {
    case "1":
      return t("Low") || "Low";
    case "2":
      return t("Medium") || "Medium";
    case "3":
      return t("High") || "High";
    case "4":
      return t("Urgent") || "Urgent";
    default:
      return t("Medium") || "Medium";
  }
};

/**
 * Rider tickets — migrated to the shared `ListScreen` pattern with a FAB to
 * open a new-ticket modal.
 */
export default function RiderTickets({
  partnerId,
  customer,
  activeSubscriptionId,
}: RiderTicketsProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "2",
  });
  const [submitting, setSubmitting] = useState(false);

  const resolvedPartner =
    partnerId ||
    customer?.partner_id ||
    (() => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem("customerData_rider");
        if (stored) return JSON.parse(stored)?.partner_id || null;
      } catch {}
      return null;
    })();

  const PAGE_SIZE = 20;

  const fetchTickets = useCallback(async (pageNum = 1, append = false) => {
    if (!resolvedPartner) {
      setTickets([]);
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/tickets?partner_id=${resolvedPartner}&page=${pageNum}&page_size=${PAGE_SIZE}`,
        { headers: getHeaders() },
      );
      const data = await res.json();
      if (res.ok) {
        const list: Ticket[] = data.tickets || data.data?.tickets || data.data || [];
        setTickets(prev => append ? [...prev, ...list] : list);
        setPage(pageNum);
        // Support both pagination shapes the API may return
        const pagination = data.pagination || data.meta || {};
        setHasMore(
          pagination.has_next_page ??
          pagination.hasNextPage ??
          list.length === PAGE_SIZE
        );
      } else {
        setError(data.message || t("rider.tickets.error") || "Failed to load tickets");
      }
    } catch {
      setError(t("rider.tickets.error") || "Failed to load tickets");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [resolvedPartner, t]);

  const loadMore = useCallback(() => {
    fetchTickets(page + 1, true);
  }, [fetchTickets, page]);

  useEffect(() => {
    fetchTickets(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPartner]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter(
      (tk) =>
        !q ||
        tk.subject.toLowerCase().includes(q) ||
        (tk.number || "").toLowerCase().includes(q),
    );
  }, [tickets, query]);

  const submitTicket = async () => {
    if (!form.subject.trim() || !form.description.trim() || !customer?.id) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        subject: form.subject,
        description: form.description,
        priority: priorityLabel(form.priority, t).toLowerCase(),
        customer_identity: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      };
      if (activeSubscriptionId) payload.subscription_id = activeSubscriptionId;

      const res = await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm({ subject: "", description: "", priority: "2" });
        setShowNew(false);
        fetchTickets(1, false);
      } else {
        setError(data.message || t("rider.tickets.createError") || "Failed to create ticket");
      }
    } catch {
      setError(t("rider.tickets.createError") || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ListScreen
        title={t("rider.tickets.title") || "Tickets"}
        searchPlaceholder={t("rider.tickets.search") || "Search tickets..."}
        searchQuery={query}
        onSearchChange={setQuery}
        isLoading={loading}
        error={error || undefined}
        onRefresh={() => fetchTickets(1, false)}
        isEmpty={filtered.length === 0}
        emptyIcon={<HelpCircle size={28} />}
        emptyMessage={t("rider.tickets.empty") || "No tickets yet"}
        emptyHint={
          t("rider.tickets.emptyHint") || "Open a ticket and we'll get back to you."
        }
        itemCount={filtered.length}
        itemLabel={
          filtered.length === 1
            ? t("rider.tickets.itemSingular") || "ticket"
            : t("rider.tickets.itemPlural") || "tickets"
        }
        fabAction={() => setShowNew(true)}
        fabLabel={t("rider.tickets.new") || "New ticket"}
      >
        {filtered.map((tk) => {
          const date = new Date(tk.create_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          return (
            <div key={tk.id} className="list-card">
              <div className="list-card-body">
                <div className="list-card-content">
                  <div className="list-card-primary">{tk.subject}</div>
                  {tk.number && (
                    <div className="list-card-secondary">#{tk.number}</div>
                  )}
                  <div className="list-card-meta">
                    <Clock size={10} />
                    <span>{date}</span>
                    {tk.customer && (
                      <>
                        <span>·</span>
                        <MessageCircle size={10} />
                        <span>{tk.customer}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="list-card-actions">
                  <span className={priorityBadge(tk.priority)}>
                    {priorityLabel(tk.priority, t)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {hasMore && !query.trim() && (
          <div style={{ padding: '8px 0 4px', display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ minWidth: 120 }}
            >
              {loadingMore
                ? (t('common.loading') || 'Loading…')
                : (t('common.loadMore') || 'Load more')}
            </button>
          </div>
        )}
      </ListScreen>

      {showNew && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => !submitting && setShowNew(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              padding: 18,
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("rider.tickets.new") || "New ticket"}
              </h2>
              <button
                onClick={() => setShowNew(false)}
                className="btn btn-secondary"
                style={{ padding: 6 }}
                disabled={submitting}
              >
                <X size={16} />
              </button>
            </div>

            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              {t("rider.tickets.subject") || "Subject"}
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            />

            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              {t("rider.tickets.priority") || "Priority"}
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              <option value="1">{t("Low") || "Low"}</option>
              <option value="2">{t("Medium") || "Medium"}</option>
              <option value="3">{t("High") || "High"}</option>
              <option value="4">{t("Urgent") || "Urgent"}</option>
            </select>

            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              {t("rider.tickets.description") || "Description"}
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={5}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                marginBottom: 16,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            <div className="action-bar">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNew(false)}
                disabled={submitting}
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                onClick={submitTicket}
                disabled={
                  submitting || !form.subject.trim() || !form.description.trim()
                }
              >
                {submitting
                  ? t("common.submitting") || "Submitting..."
                  : t("rider.tickets.submit") || "Submit ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
