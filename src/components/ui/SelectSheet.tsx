"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Search, X, AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * SelectSheet — reusable bottom-sheet picker.
 *
 * Pattern modeled on Google Material "Modal Bottom Sheet" / Apple HIG
 * "Action Sheet". On phones it slides up from the bottom and covers up to
 * ~80vh; on larger screens it becomes a centered modal.
 *
 * Use it wherever a user needs to pick one option from a short-to-medium list
 * (plans, stations, addresses, payment methods…) without leaving the current
 * context.
 *
 * ```tsx
 * <SelectSheet
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Switch plan"
 *   activeValue={currentPlanCode}
 *   items={plans.map((p) => ({
 *     value: p.code,
 *     label: p.name,
 *     description: `${p.currency} ${p.price.toLocaleString()}`,
 *     meta: formatDate(p.nextCycleDate),
 *     badges: [{ label: p.status, variant: 'success' }],
 *   }))}
 *   onSelect={(item) => switchPlan(item.value)}
 * />
 * ```
 */
export type SelectSheetBadgeVariant =
  | "success"
  | "warning"
  | "info"
  | "error"
  | "neutral";

export interface SelectSheetBadge {
  label: string;
  variant?: SelectSheetBadgeVariant;
}

export interface SelectSheetItem<T = string> {
  value: T;
  label: string;
  description?: string;
  /** Right-aligned secondary info (price, date, etc.) */
  meta?: React.ReactNode;
  /** Optional status chips shown under the label. */
  badges?: SelectSheetBadge[];
  /** Optional leading visual (icon / avatar). */
  leading?: React.ReactNode;
  disabled?: boolean;
  /** Free-form haystack for search, defaults to label + description. */
  searchText?: string;
}

interface SelectSheetProps<T = string> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: SelectSheetItem<T>[];
  activeValue?: T | null;
  onSelect: (item: SelectSheetItem<T>) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
  searchable?: boolean;
  /** Label shown on the active row (defaults to "Current"). */
  activeLabel?: string;
  /** Optional footer action (e.g. "Add plan"). */
  footer?: React.ReactNode;
}

export default function SelectSheet<T = string>({
  isOpen,
  onClose,
  title,
  subtitle,
  items,
  activeValue,
  onSelect,
  loading = false,
  error = null,
  onRetry,
  emptyText,
  searchable = false,
  activeLabel,
  footer,
}: SelectSheetProps<T>) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Reset search when closed.
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack =
        item.searchText ?? `${item.label} ${item.description ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [items, query]);

  if (!isOpen) return null;

  const showLoading = loading && items.length === 0;
  const showError = !!error && !loading;
  const showEmpty = !loading && !error && filtered.length === 0;

  return (
    <div
      className="select-sheet-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="select-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="select-sheet-handle" aria-hidden="true" />

        <div className="select-sheet-head">
          <div className="select-sheet-head-text">
            <div className="select-sheet-title">{title}</div>
            {subtitle && (
              <div className="select-sheet-subtitle">{subtitle}</div>
            )}
          </div>
          <button
            className="select-sheet-close"
            onClick={onClose}
            aria-label={t("common.close") || "Close"}
          >
            <X size={16} />
          </button>
        </div>

        {searchable && (
          <div className="select-sheet-search">
            <Search size={14} className="select-sheet-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search") || "Search..."}
              aria-label={t("common.search") || "Search"}
            />
            {query && (
              <button
                className="select-sheet-search-clear"
                onClick={() => setQuery("")}
                aria-label={t("common.clear") || "Clear"}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="select-sheet-body">
          {showLoading && (
            <div className="select-sheet-state">
              <div
                className="loading-spinner"
                style={{ width: 28, height: 28, borderWidth: 3 }}
              />
              <p>{t("common.loading") || "Loading..."}</p>
            </div>
          )}

          {showError && (
            <div className="select-sheet-state select-sheet-state--error">
              <AlertCircle size={28} />
              <p>{error}</p>
              {onRetry && (
                <button
                  className="select-sheet-retry"
                  onClick={onRetry}
                  type="button"
                >
                  {t("common.tryAgain") || "Try again"}
                </button>
              )}
            </div>
          )}

          {showEmpty && (
            <div className="select-sheet-state">
              <p>{emptyText || t("common.noResults") || "No results"}</p>
            </div>
          )}

          {!showLoading && !showError && filtered.length > 0 && (
            <ul className="select-sheet-list" role="listbox">
              {filtered.map((item) => {
                const isActive = activeValue != null && item.value === activeValue;
                return (
                  <li key={String(item.value)} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        onSelect(item);
                        onClose();
                      }}
                      className={`select-sheet-item${
                        isActive ? " select-sheet-item--active" : ""
                      }${item.disabled ? " select-sheet-item--disabled" : ""}`}
                    >
                      {item.leading && (
                        <span className="select-sheet-item-leading">
                          {item.leading}
                        </span>
                      )}
                      <span className="select-sheet-item-body">
                        <span className="select-sheet-item-head">
                          <span className="select-sheet-item-label">
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="select-sheet-item-active-pill">
                              <Check size={10} />
                              {activeLabel || t("common.current") || "Current"}
                            </span>
                          )}
                        </span>
                        {item.description && (
                          <span className="select-sheet-item-desc">
                            {item.description}
                          </span>
                        )}
                        {item.badges && item.badges.length > 0 && (
                          <span className="select-sheet-item-badges">
                            {item.badges.map((b, i) => (
                              <span
                                key={i}
                                className={`select-sheet-badge select-sheet-badge--${
                                  b.variant || "neutral"
                                }`}
                              >
                                {b.label}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      {item.meta != null && (
                        <span className="select-sheet-item-meta">{item.meta}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {footer && <div className="select-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
