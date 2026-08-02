"use client";

import React from 'react';
import { useMediaQuery } from '@/lib/hooks';
import { layout } from '@/styles/tokens';

export interface MasterDetailProps {
  /** The list pane — always mounted on desktop, sole view on mobile when no detail is active. */
  list: React.ReactNode;
  /** The detail (or create/edit) pane content, or null when nothing is selected. */
  detail: React.ReactNode | null;
  /** True when the app's screen state is showing detail/create (mobile swaps to it). */
  isDetailActive: boolean;
  /** Desktop empty state for the detail pane ("Select an order…"). */
  placeholder?: React.ReactNode;
}

/**
 * MasterDetail — two-pane list|detail split at the split breakpoint (1080px+).
 *
 * Below the split: exactly the pre-existing behavior — the panes swap based on
 * the applet's own `screen` state; only one is mounted (lists fetch data, so
 * both panes must NOT mount on phones). Every tablet in portrait lands here,
 * including iPad Pro 13" at 1024, which is why the threshold is 1080 and not
 * Tailwind's 1024 — see `layout` in styles/tokens.ts.
 *
 * At or above it: list stays mounted in a fixed-width left pane with its own
 * scroll, detail (or `placeholder`) fills the right pane. Selection state
 * still lives in the applet — this component is purely presentational, so a
 * live resize across the boundary loses nothing.
 *
 * JS switching (not CSS visibility) is deliberate here; useMediaQuery's
 * pre-hydration default is `false` → mobile render, the safe fallback.
 */
const MasterDetail: React.FC<MasterDetailProps> = ({
  list,
  detail,
  isDetailActive,
  placeholder,
}) => {
  const isDesktop = useMediaQuery(`(min-width: ${layout.split})`);

  if (!isDesktop) {
    return <>{isDetailActive ? detail : list}</>;
  }

  return (
    <div className="master-detail">
      <div className="master-detail-list">{list}</div>
      <div className="master-detail-pane">
        {detail ?? (
          <div className="master-detail-placeholder">{placeholder}</div>
        )}
      </div>
    </div>
  );
};

export default MasterDetail;
