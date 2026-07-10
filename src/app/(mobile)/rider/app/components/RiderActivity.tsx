"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  Clock,
  Zap,
  Wallet,
  CreditCard,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/i18n";
import ListScreen from "@/components/ui/ListScreen";
import { isEnergyServiceType } from "../hooks/useRiderActivity";
import type { RiderActivityItem, RiderActivityRecord } from "../types";

// Keep export compat for the orchestrator that imported it from here.
export type ActivityItem = RiderActivityItem;

interface RiderActivityProps {
  activities: RiderActivityItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  currency?: string;
}

type FilterKey = "all" | "swap" | "payment" | "topup";

/**
 * Activity feed — migrated to the shared `ListScreen` + `.list-card` pattern
 * so it matches Customer/Activator/Sales/Products.
 */
export default function RiderActivity({
  activities,
  isLoading,
  onRefresh,
  currency,
}: RiderActivityProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  // Row tapped by the rider — opens the detail sheet with the raw ABS records.
  const [detail, setDetail] = useState<RiderActivityItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = useCallback(async (id: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(id);
      } else {
        // Fallback for WebViews without the modern clipboard API.
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1500);
    } catch (err) {
      console.warn("[RiderActivity] Clipboard copy failed:", err);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (filter === "swap" && a.type !== "swap") return false;
      if (filter === "topup" && a.type !== "topup") return false;
      if (filter === "payment" && a.type !== "payment") return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
      );
    });
  }, [activities, query, filter]);

  const grouped = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const groups = new Map<string, RiderActivityItem[]>();
    filtered.forEach((a) => {
      const key =
        a.date === today
          ? t("rider.today") || "Today"
          : a.date === yesterday
            ? t("rider.yesterday") || "Yesterday"
            : new Date(a.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
      const arr = groups.get(key) || [];
      arr.push(a);
      groups.set(key, arr);
    });
    return groups;
  }, [filtered, t]);

  const summary = useMemo(() => {
    const swaps = activities.filter((a) => a.type === "swap").length;
    const totalSpent = activities
      .filter((a) => a.type === "payment" && !a.isPositive)
      .reduce((s, a) => s + (a.amount ?? 0), 0);
    return { swaps, totalSpent };
  }, [activities]);

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("rider.all") || "All" },
    { key: "swap", label: t("rider.swaps") || "Swaps" },
    { key: "topup", label: t("rider.topUps") || "Top-ups" },
    { key: "payment", label: t("rider.payments") || "Payments" },
  ];

  const renderHeaderExtra = () => (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="rm-summary-tile">
          <Zap size={14} />
          <div>
            <div className="rm-summary-tile-value">{summary.swaps}</div>
            <div className="rm-summary-tile-label">
              {t("rider.swaps") || "Swaps"}
            </div>
          </div>
        </div>
        <div className="rm-summary-tile">
          <Wallet size={14} />
          <div>
            <div className="rm-summary-tile-value">
              {currency ? `${currency} ` : ''}{summary.totalSpent.toLocaleString()}
            </div>
            <div className="rm-summary-tile-label">
              {t("rider.totalSpent") || "Total spent"}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === opt.key
                ? "border-transparent text-text-inverse"
                : "border-border bg-bg-tertiary text-text-secondary"
            }`}
            style={
              filter === opt.key
                ? { backgroundColor: "var(--color-brand)" }
                : undefined
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const typeIcon = (type: RiderActivityItem["type"]) => {
    if (type === "swap") return <Zap size={14} />;
    if (type === "topup") return <Wallet size={14} />;
    return <CreditCard size={14} />;
  };

  // Human label for a raw record's amount: kWh for energy usage, a plain
  // count for swap-count services, money for payments.
  const recordAmountLabel = (r: RiderActivityRecord) => {
    if (r.kind === "payment") {
      return `${currency ? `${currency} ` : ""}${Math.abs(r.amount).toLocaleString()}`;
    }
    if (isEnergyServiceType(r.type)) return `${r.amount} kWh`;
    return `${r.amount}`;
  };

  return (
    <>
    <ListScreen
      title={t("rider.activity") || "Activity"}
      searchPlaceholder={t("rider.activity.search") || "Search activity..."}
      searchQuery={query}
      onSearchChange={setQuery}
      isLoading={!!isLoading}
      onRefresh={onRefresh || (() => {})}
      isEmpty={filtered.length === 0}
      emptyIcon={<ActivityIcon size={28} />}
      emptyMessage={t("rider.noActivities") || "No activities found"}
      emptyHint={t("rider.activity.emptyHint") || "Your swaps and payments appear here"}
      itemCount={filtered.length}
      itemLabel={
        filtered.length === 1
          ? t("rider.activity.itemSingular") || "activity"
          : t("rider.activity.itemPlural") || "activities"
      }
      headerExtra={renderHeaderExtra()}
    >
      {Array.from(grouped.entries()).map(([date, items]) => (
        <React.Fragment key={date}>
          <div
            style={{
              padding: "10px 2px 4px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {date}
          </div>
          {items.map((a) => {
            const recordId = a.records?.[0]?.id || "";
            return (
              <div
                key={a.id}
                className="list-card"
                role="button"
                tabIndex={0}
                onClick={() => setDetail(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setDetail(a);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="list-card-body">
                  <div className="list-card-content">
                    <div className="list-card-primary">{a.title}</div>
                    {a.subtitle && (
                      <div className="list-card-secondary">{a.subtitle}</div>
                    )}
                    <div className="list-card-meta">
                      {typeIcon(a.type)}
                      <Clock size={10} />
                      <span>{a.time}</span>
                      {recordId && (
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 10,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 140,
                          }}
                        >
                          {recordId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="list-card-actions">
                    {a.energy ? (
                      <span className="list-card-badge list-card-badge--default">
                        {a.energy}
                      </span>
                    ) : a.amount !== undefined ? (
                      <span
                        className={`list-card-badge ${
                          a.isPositive
                            ? "list-card-badge--completed"
                            : "list-card-badge--default"
                        }`}
                      >
                        {a.isPositive ? "+" : "-"}
                        {(a.currency || currency) ? `${a.currency || currency} ` : ''}
                        {Math.abs(a.amount).toLocaleString()}
                      </span>
                    ) : null}
                    <ChevronRight
                      size={14}
                      style={{ color: "var(--text-muted)", flexShrink: 0 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </ListScreen>

    {/* Record detail sheet — the raw ABS service/payment actions behind the
        tapped row, with copyable IDs so support can trace a specific record. */}
    {detail && (
      <div
        className="select-sheet-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}
      >
        <div className="select-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="select-sheet-handle" aria-hidden="true" />
          <div className="select-sheet-head" style={{ position: "relative" }}>
            <div
              className="select-sheet-title"
              style={{ textAlign: "center", width: "100%" }}
            >
              {detail.title}
            </div>
            <button
              className="select-sheet-close"
              onClick={() => setDetail(null)}
              aria-label={t("common.close") || "Close"}
              style={{ position: "absolute", right: 16, top: 12 }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 16, height: 16 }}
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="select-sheet-body" style={{ overflowY: "auto" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 2px 10px" }}>
              {new Date(detail.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {detail.time}
            </div>
            {(detail.records && detail.records.length > 0
              ? detail.records
              : null
            )?.map((r) => (
              <div
                key={r.id || r.createdAt}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {r.kind === "payment"
                      ? t("rider.activity.paymentRecord") || "Payment record"
                      : t("rider.activity.serviceRecord") || "Service record"}
                  </span>
                  <span className="list-card-badge list-card-badge--default">
                    {recordAmountLabel(r)}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {r.kind === "payment"
                        ? t("rider.activity.paymentId") || "Payment ID"
                        : t("rider.activity.serviceId") || "Service ID"}
                    </div>
                    <button
                      type="button"
                      onClick={() => r.id && handleCopyId(r.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        width: "100%",
                        background: "var(--bg-tertiary)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                      }}
                      aria-label={t("rider.activity.copyId") || "Copy ID"}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          wordBreak: "break-all",
                          textAlign: "left",
                          flex: 1,
                        }}
                      >
                        {r.id || "—"}
                      </span>
                      {copiedId === r.id ? (
                        <Check size={13} style={{ flexShrink: 0 }} />
                      ) : (
                        <Copy size={13} style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {t("rider.activity.recordType") || "Type"}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{r.type || "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {t("rider.activity.recordedAt") || "Recorded at"}
                    </span>
                    <span>
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )) || (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  padding: "24px 0",
                }}
              >
                {t("rider.activity.noRecords") ||
                  "No record details available for this entry"}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
