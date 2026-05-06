"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Package, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { useI18n } from "@/i18n";
import ListScreen from "@/components/ui/ListScreen";
import { getSubscriptionProducts } from "@/lib/odoo-api";

export interface RiderPlan {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  suggested_billing_frequency?: string;
  currency?: string;
  category?: string;
}

interface RiderPlansProps {
  /** Pre-loaded plans; if omitted, the component fetches from Odoo. */
  plans?: RiderPlan[];
  onSelectPlan: (plan: RiderPlan) => void;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  defaultCurrency?: string;
  /** Auth token for /api/products/subscription (optional). */
  token?: string | null;
}

/**
 * Rider plans / products catalog — uses `ListScreen` + `.list-card` pattern.
 */
export default function RiderPlans({
  plans,
  onSelectPlan,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 20,
  isLoading: externalLoading = false,
  onPageChange,
  defaultCurrency = "",
  token,
}: RiderPlansProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [fetchedPlans, setFetchedPlans] = useState<RiderPlan[] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch plans from the Odoo subscription products endpoint when no
  // pre-loaded plans were provided.
  useEffect(() => {
    if (plans !== undefined) return; // caller already provided plans
    let cancelled = false;
    const run = async () => {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const res = await getSubscriptionProducts(1, 50, token || undefined);
        if (cancelled) return;
        const list = [
          ...(res.data?.products || []),
          ...(res.data?.mainServiceProducts || []),
          ...(res.data?.batterySwapProducts || []),
        ].map<RiderPlan>((p) => ({
          name: p.name,
          price: p.list_price,
          productId: p.id,
          default_code: p.default_code || `P-${p.id}`,
          suggested_billing_frequency: p.pu_category || undefined,
          category: p.category_name || p.pu_category || undefined,
        }));
        setFetchedPlans(list);
      } catch (err: any) {
        if (!cancelled) {
          setFetchError(err?.message || "Failed to load plans");
          setFetchedPlans([]);
        }
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [plans, token, defaultCurrency, refreshTick]);

  const effectivePlans = useMemo(
    () => plans ?? fetchedPlans ?? [],
    [plans, fetchedPlans],
  );
  const isLoading = externalLoading || fetchLoading;

  const categories = useMemo(() => {
    const seen = new Set<string>();
    effectivePlans.forEach((p) => {
      if (p.category) seen.add(p.category);
      else if (p.suggested_billing_frequency) seen.add(p.suggested_billing_frequency);
    });
    return ["all", ...Array.from(seen)];
  }, [effectivePlans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return effectivePlans.filter((p) => {
      if (category !== "all") {
        const cat = p.category || p.suggested_billing_frequency || "";
        if (cat !== category) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.default_code.toLowerCase().includes(q)
      );
    });
  }, [effectivePlans, query, category]);

  const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const renderPagination = () => {
    if (!onPageChange || totalPages <= 1) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {t("Showing") || "Showing"} {startItem}-{endItem} {t("of") || "of"}{" "}
          {totalCount}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 10px" }}
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 10px" }}
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <ListScreen
      title={t("rider.plans.title") || "Plans"}
      searchPlaceholder={t("rider.plans.search") || "Search plans..."}
      searchQuery={query}
      onSearchChange={setQuery}
      isLoading={isLoading}
      error={fetchError || undefined}
      onRefresh={() => setRefreshTick((n) => n + 1)}
      isEmpty={filtered.length === 0}
      emptyIcon={<Package size={28} />}
      emptyMessage={t("rider.plans.empty") || "No plans available"}
      emptyHint={t("rider.plans.emptyHint") || "Check back soon for new offers."}
      itemCount={filtered.length}
      itemLabel={
        filtered.length === 1
          ? t("rider.plans.itemSingular") || "plan"
          : t("rider.plans.itemPlural") || "plans"
      }
      headerExtra={
        categories.length > 1 ? (
          <div className="rm-filter-pills">
            {categories.map((c) => (
              <button
                key={c}
                className={`rm-filter-pill${category === c ? " active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? t("rider.all") || "All" : c}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {filtered.map((p) => (
        <div
          key={`${p.productId}-${p.default_code}`}
          className="list-card"
          onClick={() => onSelectPlan(p)}
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{p.name}</div>
              <div className="list-card-secondary">{p.default_code}</div>
              <div className="list-card-meta">
                <Tag size={10} />
                <span>
                  {p.suggested_billing_frequency ||
                    p.category ||
                    t("rider.plans.planType") ||
                    "Plan"}
                </span>
              </div>
            </div>
            <div className="list-card-actions">
              <span
                className="list-card-badge--info"
                style={{ fontSize: 13, padding: "6px 10px" }}
              >
                {defaultCurrency ? `${defaultCurrency} ` : ''}{p.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
      {renderPagination()}
    </ListScreen>
  );
}
