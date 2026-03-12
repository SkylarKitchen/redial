/**
 * useDragReorder.ts — Shared hook for drag-to-reorder lists
 *
 * State machine: idle → pending (pointerdown, awaiting 3px dead zone) → dragging
 *
 * Follows LabelScrub.tsx pattern: PointerEvent + setPointerCapture(),
 * synchronous listener attachment in pointerdown, userSelect: none during drag.
 *
 * Visual feedback:
 * - Dragged item: translateY(offset), elevated shadow, zIndex 50
 * - Displaced items: translateY(±rowHeight) with 200ms transition
 * - Drop indicator: 2px indigo line between items
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { timing, ms } from "./timing";

interface DragState {
  dragIndex: number;
  overIndex: number;
  startY: number;
  offsetY: number;
  heights: number[];
  tops: number[];
}

export function useDragReorder<T>(
  items: T[],
  onChange: (items: T[]) => void,
): {
  registerRef: (index: number) => (el: HTMLElement | null) => void;
  handleProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  itemStyle: (index: number) => React.CSSProperties;
  dropLineStyle: () => React.CSSProperties | null;
  isDragging: boolean;
} {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [settling, setSettling] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateRef = useRef<DragState | null>(null);
  const refsMap = useRef<Map<number, HTMLElement>>(new Map());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => { clearTimeout(settleTimerRef.current); };
  }, []);

  const registerRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) {
        refsMap.current.set(index, el);
      } else {
        refsMap.current.delete(index);
      }
    },
    [],
  );

  const handleProps = useCallback(
    (index: number) => {
      const onPointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        if (settling) {
          clearTimeout(settleTimerRef.current);
          setSettling(false);
        }

        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);

        const startY = e.clientY;
        const heights: number[] = [];
        const tops: number[] = [];
        for (let i = 0; i < itemsRef.current.length; i++) {
          const el = refsMap.current.get(i);
          if (el) {
            const rect = el.getBoundingClientRect();
            heights.push(rect.height);
            tops.push(rect.top);
          } else {
            heights.push(0);
            tops.push(0);
          }
        }

        let isDragging = false;
        const DEAD_ZONE = 3;

        const prevSelect = document.body.style.userSelect;
        const prevCursor = document.body.style.cursor;

        function getOverIndex(dragIdx: number, offsetY: number): number {
          return computeOverIndex(dragIdx, offsetY, tops, heights);
        }

        function handleMove(ev: PointerEvent) {
          const dy = ev.clientY - startY;

          if (!isDragging) {
            if (Math.abs(dy) < DEAD_ZONE) return;
            isDragging = true;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "grabbing";
          }

          const overIdx = getOverIndex(index, dy);
          const state: DragState = {
            dragIndex: index,
            overIndex: overIdx,
            startY,
            offsetY: dy,
            heights,
            tops,
          };
          stateRef.current = state;
          setDragState(state);
        }

        let cleaned = false;
        function cleanup() {
          if (cleaned) return;
          cleaned = true;
          handle.removeEventListener("pointermove", handleMove);
          handle.removeEventListener("pointerup", handleUp);
          handle.removeEventListener("lostpointercapture", handleUp);
          window.removeEventListener("blur", handleUp);

          if (isDragging) {
            document.body.style.userSelect = prevSelect;
            document.body.style.cursor = prevCursor;

            const final = stateRef.current;
            if (final && final.dragIndex !== final.overIndex) {
              // Reorder array immediately
              const next = [...itemsRef.current];
              const [moved] = next.splice(final.dragIndex, 1);
              next.splice(final.overIndex, 0, moved);
              onChangeRef.current(next);

              // Use rAF to start settling AFTER React commits the reorder
              stateRef.current = null;
              setDragState(null);
              requestAnimationFrame(() => {
                setSettling(true);
                settleTimerRef.current = setTimeout(() => {
                  setSettling(false);
                }, timing.layout);
              });
              return;
            }
          }

          stateRef.current = null;
          setDragState(null);
        }

        function handleUp() {
          cleanup();
        }

        handle.addEventListener("pointermove", handleMove);
        handle.addEventListener("pointerup", handleUp);
        handle.addEventListener("lostpointercapture", handleUp);
        window.addEventListener("blur", handleUp);
      };

      return {
        onPointerDown,
        style: {
          cursor: dragState?.dragIndex === index ? "grabbing" : "grab",
          touchAction: "none" as const,
        },
      };
    },
    [dragState, settling],
  );

  const itemStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (settling) {
        return {
          position: "relative",
          transition: `transform ${ms("layout")} cubic-bezier(0.34, 1.56, 0.64, 1)`,
          transform: "translateY(0)",
        };
      }

      if (!dragState) return { position: "relative" };

      const { dragIndex, overIndex, offsetY, heights } = dragState;

      if (index === dragIndex) {
        return {
          position: "relative",
          zIndex: 50,
          transform: `translateY(${offsetY}px)`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          opacity: 0.95,
        };
      }

      // Items between dragIndex and overIndex need to shift
      const shift = computeItemShift(index, dragIndex, overIndex, heights[dragIndex]);

      return {
        position: "relative",
        transform: shift !== 0 ? `translateY(${shift}px)` : undefined,
        transition: `transform ${ms("layout")} ease`,
      };
    },
    [dragState, settling],
  );

  const dropLineStyle = useCallback((): React.CSSProperties | null => {
    if (!dragState || dragState.dragIndex === dragState.overIndex) return null;

    const { overIndex, dragIndex, tops, heights } = dragState;

    // Position the drop line at the boundary where the item will be inserted
    let top: number;
    if (dragIndex < overIndex) {
      // Dragging down: line at bottom of overIndex item
      top = tops[overIndex] + heights[overIndex] - tops[0];
    } else {
      // Dragging up: line at top of overIndex item
      top = tops[overIndex] - tops[0];
    }

    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: `${top}px`,
      height: "2px",
      background: "#6366f1",
      borderRadius: "1px",
      zIndex: 51,
      pointerEvents: "none",
    };
  }, [dragState]);

  return {
    registerRef,
    handleProps,
    itemStyle,
    dropLineStyle,
    isDragging: dragState !== null || settling,
  };
}

/** Pure computation: find which item index the dragged item is closest to. Exported for testing. */
export function computeOverIndex(
  dragIdx: number,
  offsetY: number,
  tops: number[],
  heights: number[],
): number {
  const dragCenter = tops[dragIdx] + heights[dragIdx] / 2 + offsetY;
  let best = dragIdx;
  let bestDist = Infinity;
  for (let i = 0; i < heights.length; i++) {
    const center = tops[i] + heights[i] / 2;
    const dist = Math.abs(dragCenter - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Pure computation: translateY shift for a displaced item. Exported for testing. */
export function computeItemShift(
  index: number,
  dragIndex: number,
  overIndex: number,
  dragHeight: number,
): number {
  if (dragIndex < overIndex) {
    if (index > dragIndex && index <= overIndex) return -dragHeight;
  } else if (dragIndex > overIndex) {
    if (index >= overIndex && index < dragIndex) return dragHeight;
  }
  return 0;
}
