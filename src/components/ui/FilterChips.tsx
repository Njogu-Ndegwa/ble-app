'use client';

import React from 'react';

export interface FilterChipItem {
  key: string;
  label: string;
}

interface FilterChipsProps {
  items: FilterChipItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

/**
 * Horizontal scrollable filter chip strip.
 * Selected chip gets a solid brand fill; others use the muted tertiary style.
 * Used by Products, Orders, and Customers for their header filter rows.
 */
export default function FilterChips({
  items,
  activeKey,
  onSelect,
  className = '',
}: FilterChipsProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar ${className}`}>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            activeKey === item.key
              ? 'border-transparent text-text-inverse'
              : 'border-border bg-bg-tertiary text-text-secondary'
          }`}
          style={activeKey === item.key ? { backgroundColor: 'var(--color-brand)' } : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
