"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Draggable bottom sheet with three snap points.
 *
 * Defaults are tuned for the redesigned Stations map:
 *   - `peek`  ≈ 160px  — enough to host the horizontal station carousel
 *   - `half`  ≈ 52vh   — vertical list + filters
 *   - `full`  ≈ 88vh   — full list / filters
 *
 * Callers may override via `heights`. Heights are resolved in pixels using the
 * current window, so vh-style strings like "52vh" are respected on mount and
 * on viewport resize.
 */
export type SheetSnap = "peek" | "half" | "full";

export interface SheetHeights {
  peek?: number | string;
  half?: number | string;
  full?: number | string;
}

interface MapBottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  heights?: SheetHeights;
  /** When true, the handle is hidden (e.g. when carousel is the main affordance). */
  hideHandle?: boolean;
}

const DEFAULTS: Required<SheetHeights> = {
  peek: 160,
  half: "52vh",
  full: "88vh",
};

function resolveHeight(value: number | string): number {
  if (typeof value === "number") return value;
  const match = /^(\d+(?:\.\d+)?)(vh|px)$/.exec(value.trim());
  if (!match) return parseInt(value, 10) || 0;
  const n = parseFloat(match[1]);
  if (match[2] === "vh") {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return (vh * n) / 100;
  }
  return n;
}

export default function MapBottomSheet({
  snap,
  onSnapChange,
  children,
  header,
  heights,
  hideHandle = false,
}: MapBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const startSnapHeightRef = useRef(0);

  // Force re-resolution of vh-based heights on viewport resize.
  const [, bumpResize] = useState(0);
  useEffect(() => {
    const onResize = () => bumpResize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resolved = useMemo(() => {
    const h = { ...DEFAULTS, ...(heights || {}) };
    return {
      peek: resolveHeight(h.peek),
      half: resolveHeight(h.half),
      full: resolveHeight(h.full),
    };
  }, [heights]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startYRef.current = e.clientY;
      startSnapHeightRef.current = sheetRef.current?.offsetHeight ?? 0;
      setDragging(true);
      setDragOffset(0);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const delta = e.clientY - startYRef.current;
      setDragOffset(delta);
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);

      const finalHeight = startSnapHeightRef.current - dragOffset;
      let closest: SheetSnap = "half";
      let closestDist = Infinity;
      (Object.keys(resolved) as SheetSnap[]).forEach((key) => {
        const d = Math.abs(resolved[key] - finalHeight);
        if (d < closestDist) {
          closest = key;
          closestDist = d;
        }
      });
      setDragOffset(0);
      if (closest !== snap) onSnapChange(closest);
    },
    [dragging, dragOffset, snap, onSnapChange, resolved],
  );

  const baseHeight = `${resolved[snap]}px`;
  const transform = dragging && dragOffset !== 0 ? `translateY(${dragOffset}px)` : undefined;

  return (
    <div
      ref={sheetRef}
      className="rm-bottom-sheet"
      style={{
        height: baseHeight,
        transform,
        transition: dragging ? "none" : "height 220ms ease, transform 220ms ease",
      }}
    >
      <div
        className="rm-sheet-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!hideHandle && <div className="rm-sheet-handle" aria-hidden="true" />}
        {header}
      </div>
      <div className="rm-sheet-body">{children}</div>
    </div>
  );
}
