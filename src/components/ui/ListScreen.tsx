'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import {
  Search,
  X,
  RefreshCw,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Plus,
} from 'lucide-react';

/**
 * Period options for date filtering (matches TransactionPeriod from odoo-api)
 */
export type ListPeriod = 'today' | '3days' | '5days' | '7days' | '14days' | '30days' | 'all';

export const PERIOD_OPTIONS: { value: ListPeriod; labelKey: string; fallback: string }[] = [
  { value: 'today', labelKey: 'common.periodToday', fallback: 'Today' },
  { value: '3days', labelKey: 'common.period3Days', fallback: 'Last 3 Days' },
  { value: '5days', labelKey: 'common.period5Days', fallback: 'Last 5 Days' },
  { value: '7days', labelKey: 'common.period7Days', fallback: 'Last 7 Days' },
  { value: '14days', labelKey: 'common.period14Days', fallback: 'Last 14 Days' },
  { value: '30days', labelKey: 'common.period30Days', fallback: 'Last 30 Days' },
  { value: 'all', labelKey: 'common.periodAll', fallback: 'All Time' },
];

export interface ListScreenProps {
  /** Page title */
  title: string;
  /** Search input placeholder */
  searchPlaceholder: string;
  /** Current search query (controlled) */
  searchQuery: string;
  /** Called on every keystroke */
  onSearchChange: (query: string) => void;
  /** If provided, called when user presses Enter in the search bar (for server-side search) */
  onSearch?: () => void;
  /** Current period filter value */
  period?: ListPeriod;
  /** Called when user picks a new period */
  onPeriodChange?: (period: ListPeriod) => void;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message, if any */
  error?: string | null;
  /** Refresh / reload data */
  onRefresh: () => void;
  /** Retry after error (defaults to onRefresh) */
  onRetry?: () => void;
  /** Whether the list is empty (after loading) */
  isEmpty: boolean;
  /** Icon shown in empty state */
  emptyIcon: React.ReactNode;
  /** Primary empty-state text */
  emptyMessage: string;
  /** Secondary empty-state hint */
  emptyHint: string;
  /** Total item count (shown above list) */
  itemCount?: number;
  /** Label for items, e.g. "customers" */
  itemLabel?: string;
  /** Content rendered between filter bar and list (e.g. summary cards) */
  headerExtra?: React.ReactNode;
  // --- Pagination (optional) ---
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  hasNextPage?: boolean;
  /** e.g. "Showing 1-15 of 45" */
  paginationLabel?: string;
  // --- Children = list items ---
  children: React.ReactNode;
  // --- Optional FAB ---
  fabAction?: () => void;
  fabLabel?: string;
}

/**
 * ListScreen - Shared mobile-optimized list container.
 *
 * Provides a consistent shell for all list/table views:
 * title + refresh, search bar, date-period filter, loading skeletons,
 * empty/error states, pagination, and an optional FAB.
 */
export default function ListScreen({
  title,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  onSearch,
  period,
  onPeriodChange,
  isLoading,
  error,
  onRefresh,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyMessage,
  emptyHint,
  itemCount,
  itemLabel,
  headerExtra,
  page,
  totalPages,
  totalItems,
  onNextPage,
  onPrevPage,
  hasNextPage,
  paginationLabel,
  children,
  fabAction,
  fabLabel,
}: ListScreenProps) {
  const { t } = useI18n();
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const selectedPeriodLabel = period
    ? PERIOD_OPTIONS.find((p) => p.value === period)
    : null;

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch();
    }
  };

  const hasPagination =
    page !== undefined && totalPages !== undefined && (onNextPage || onPrevPage);

  return (
    <div className="flex flex-col h-full relative">
      {/* ---- Header ---- */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all disabled:opacity-50"
            aria-label={t('common.refresh') || 'Refresh'}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={16} className="text-text-muted" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5"
            >
              <X size={14} className="text-text-muted hover:text-text-primary" />
            </button>
          )}
        </div>

        {/* Date / period filter */}
        {onPeriodChange && period && (
          <div className="relative">
            <button
              onClick={() => setShowPeriodPicker(!showPeriodPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-tertiary text-text-secondary text-sm hover:text-text-primary hover:bg-bg-elevated transition-all"
            >
              <Calendar size={14} />
              <span>
                {selectedPeriodLabel
                  ? t(selectedPeriodLabel.labelKey) || selectedPeriodLabel.fallback
                  : period}
              </span>
              <ChevronRight
                size={14}
                className={`transition-transform ${showPeriodPicker ? 'rotate-90' : ''}`}
              />
            </button>
            {showPeriodPicker && (
              <div className="absolute top-full left-0 right-auto mt-1 z-20 min-w-[180px] rounded-xl border border-border bg-bg-elevated shadow-lg overflow-hidden">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onPeriodChange(opt.value);
                      setShowPeriodPicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      period === opt.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    {t(opt.labelKey) || opt.fallback}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Header extra (e.g. summary cards) ---- */}
      {headerExtra && !isLoading && !error && <div className="px-4">{headerExtra}</div>}

      {/* ---- Content area ---- */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-bg-tertiary p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-border/50" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-border/50 rounded mb-2" />
                    <div className="h-3 w-48 bg-border/50 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-error mb-3">{error}</p>
            <button
              onClick={onRetry || onRefresh}
              className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium active:scale-95 transition-transform"
            >
              {t('common.tryAgain') || 'Try Again'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
              {emptyIcon}
            </div>
            <p className="text-sm text-text-secondary mb-1">{emptyMessage}</p>
            <p className="text-xs text-text-muted">{emptyHint}</p>
          </div>
        )}

        {/* Item count */}
        {!isLoading && !error && !isEmpty && itemCount !== undefined && (
          <p className="text-xs text-text-muted mt-2 mb-2">
            {itemCount} {itemLabel || (itemCount === 1 ? 'item' : 'items')}
          </p>
        )}

        {/* List content */}
        {!isLoading && !error && !isEmpty && (
          <div className="flex flex-col gap-2">{children}</div>
        )}
      </div>

      {/* ---- Pagination ---- */}
      {hasPagination && !isLoading && !error && !isEmpty && (
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span>
            {paginationLabel ||
              `${t('common.showing') || 'Showing'} ${page}/${totalPages}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevPage}
              disabled={page! <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-30 hover:bg-bg-tertiary transition-colors"
              aria-label={t('common.previous') || 'Previous'}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-text-secondary font-medium">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={onNextPage}
              disabled={!hasNextPage}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-30 hover:bg-bg-tertiary transition-colors"
              aria-label={t('common.next') || 'Next'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ---- FAB ---- */}
      {fabAction && (
        <button
          onClick={fabAction}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="fixed bottom-24 right-5 flex items-center gap-2 h-12 px-5 rounded-full text-black font-semibold text-sm active:scale-95 transition-transform z-30"
          aria-label={fabLabel || 'Add'}
        >
          <Plus size={20} strokeWidth={2.5} />
          {fabLabel && <span>{fabLabel}</span>}
        </button>
      )}
    </div>
  );
}
