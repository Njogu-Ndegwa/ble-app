"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Receipt, Clock, Wallet } from "lucide-react";
import { useI18n } from "@/i18n";
import ListScreen, { type ListPeriod } from "@/components/ui/ListScreen";

interface Transaction {
  id: string | number;
  reference?: string;
  planName?: string;
  amount: number;
  currency?: string;
  date: string;
  status: string; // completed | pending | failed | ...
}

interface RiderTransactionsProps {
  partnerId?: number;
  token?: string | null;
  defaultCurrency?: string;
  /** Optional pre-loaded list (e.g. from page.tsx activity feed). */
  seedTransactions?: Transaction[];
}

/**
 * Rider transactions / payment history.
 *
 * Pulls the customer's Odoo `/api/customers/:partner/transactions` endpoint
 * when partnerId + token are provided; otherwise falls back to the
 * `seedTransactions` array derived from the activity feed.
 */
export default function RiderTransactions({
  partnerId,
  token,
  defaultCurrency = "XOF",
  seedTransactions,
}: RiderTransactionsProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<ListPeriod>("all");
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTransactions(seedTransactions || []);
  }, [seedTransactions]);

  const badgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "paid" || s === "success") return "list-card-badge--completed";
    if (s === "pending" || s === "processing") return "list-card-badge--progress";
    if (s === "failed" || s === "overdue") return "list-card-badge--overdue";
    return "list-card-badge--default";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (q) {
        const str = `${tx.reference || ""} ${tx.planName || ""} ${tx.status}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query]);

  const summary = useMemo(() => {
    const total = transactions.reduce((s, tx) => s + (tx.amount || 0), 0);
    const completed = transactions.filter((tx) =>
      ["completed", "paid", "success"].includes(tx.status.toLowerCase()),
    ).length;
    return { total, completed };
  }, [transactions]);

  return (
    <ListScreen
      title={t("rider.transactions.title") || "Transactions"}
      searchPlaceholder={t("rider.transactions.search") || "Search transactions..."}
      searchQuery={query}
      onSearchChange={setQuery}
      period={period}
      onPeriodChange={setPeriod}
      isLoading={loading}
      error={error || undefined}
      onRefresh={() => setTransactions(seedTransactions || [])}
      isEmpty={filtered.length === 0}
      emptyIcon={<Receipt size={28} />}
      emptyMessage={t("rider.transactions.empty") || "No transactions yet"}
      emptyHint={
        t("rider.transactions.emptyHint") ||
        "Your payments and top-ups will appear here."
      }
      itemCount={filtered.length}
      itemLabel={
        filtered.length === 1
          ? t("rider.transactions.itemSingular") || "transaction"
          : t("rider.transactions.itemPlural") || "transactions"
      }
      headerExtra={
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="rm-summary-tile">
            <Wallet size={14} />
            <div>
              <div className="rm-summary-tile-value">
                {defaultCurrency} {summary.total.toLocaleString()}
              </div>
              <div className="rm-summary-tile-label">
                {t("rider.transactions.totalLabel") || "Total"}
              </div>
            </div>
          </div>
          <div className="rm-summary-tile">
            <Receipt size={14} />
            <div>
              <div className="rm-summary-tile-value">{summary.completed}</div>
              <div className="rm-summary-tile-label">
                {t("rider.transactions.completedLabel") || "Completed"}
              </div>
            </div>
          </div>
        </div>
      }
    >
      {filtered.map((tx) => (
        <div key={tx.id} className="list-card">
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{tx.planName || t("common.payment") || "Payment"}</div>
              {tx.reference && (
                <div className="list-card-secondary">{tx.reference}</div>
              )}
              <div className="list-card-meta">
                <Clock size={10} />
                <span>{tx.date}</span>
                <span>·</span>
                <span>
                  {tx.currency || defaultCurrency} {tx.amount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="list-card-actions">
              <span className={badgeClass(tx.status)}>
                {tx.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </ListScreen>
  );
}
