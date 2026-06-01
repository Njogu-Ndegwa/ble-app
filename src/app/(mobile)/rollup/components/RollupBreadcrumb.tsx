'use client';

import React, { useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { RollupBreadcrumbSegment } from '@/lib/rollup/types';

interface RollupBreadcrumbProps {
  segments: RollupBreadcrumbSegment[];
  onNavigate: (saId: number) => void;
}

export default function RollupBreadcrumb({ segments, onNavigate }: RollupBreadcrumbProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [segments]);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 overflow-x-auto no-scrollbar"
      style={{ padding: 'var(--space-2) 0' }}
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={seg.sa_id}>
            {i > 0 && (
              <ChevronRight
                size={14}
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
              />
            )}
            <button
              onClick={() => !isLast && onNavigate(seg.sa_id)}
              disabled={isLast}
              className="shrink-0"
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-1) var(--space-1-5)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-xs)',
                fontFamily: 'var(--font-sans)',
                fontWeight: isLast ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: isLast ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-fast)',
              } as React.CSSProperties}
            >
              {seg.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
