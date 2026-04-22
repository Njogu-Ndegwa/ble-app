"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Draggable bottom sheet with three snap points:
 * - `peek`  (~96px visible)   — station count only
 * - `half`  (~45vh)            — list of nearby stations
 * - `full`  (~85vh)            — full-screen list + filters
 *
 * Drag the handle (or any white-space in the sheet header) to move between
 * snap points. Uses pointer events only — no third-party library.
 */
export type SheetSnap = "peek" | "half" | "full";

interface MapBottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: React.ReactNode;
  header?: React.ReactNode;
}

function snapToHeight(snap: SheetSnap): string {
  switch (snap) {
    case "peek":
      return "96px";
    case "half":
      return "45vh";
    case "full":
      return "85vh";
  }
}

export default function MapBottomSheet({
  snap,
  onSnapChange,
  children,
  header,
}: MapBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const startSnapHeightRef = useRef(0);

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

      const vh = window.innerHeight;
      const finalHeight = startSnapHeightRef.current - dragOffset;
      // Decide closest snap
      const heights: Record<SheetSnap, number> = {
        peek: 96,
        half: vh * 0.45,
        full: vh * 0.85,
      };
      let closest: SheetSnap = "half";
      let closestDist = Infinity;
      (Object.keys(heights) as SheetSnap[]).forEach((key) => {
        const d = Math.abs(heights[key] - finalHeight);
        if (d < closestDist) {
          closest = key;
          closestDist = d;
        }
      });
      setDragOffset(0);
      if (closest !== snap) onSnapChange(closest);
    },
    [dragging, dragOffset, snap, onSnapChange],
  );

  // Apply transient drag height
  const baseHeight = snapToHeight(snap);
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
        <div className="rm-sheet-handle" aria-hidden="true" />
        {header}
      </div>
      <div className="rm-sheet-body">{children}</div>
    </div>
  );
}
