"use client";

import React, { useMemo, useState } from "react";
import { Activity as ActivityIcon, Clock, Zap, Wallet, CreditCard } from "lucide-react";
import { useI18n } from "@/i18n";
import ListScreen from "@/components/ui/ListScreen";
import type { RiderActivityItem } from "../types";

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
      .reduce((s, a) => s + a.amount, 0);
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

  return (
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
          {items.map((a) => (
            <div key={a.id} className="list-card">
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
                  </div>
                </div>
                <div className="list-card-actions">
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
                </div>
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </ListScreen>
  );
}
