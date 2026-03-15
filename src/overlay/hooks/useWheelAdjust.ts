/**
 * useWheelAdjust.ts — Scroll-wheel-to-adjust for numeric inputs
 *
 * Attaches a non-passive wheel listener to an element so that scrolling
 * up/down increments/decrements the value when the element (or a child)
 * has focus. Uses the same modifier convention as arrow keys:
 *   - Default: base step
 *   - Shift: 10×
 *   - Alt: 0.1×
 *
 * Must use native addEventListener with { passive: false } because React 17+
 * registers onWheel as passive, preventing preventDefault().
 */

import { useEffect, useRef } from "react";
import { beginBatch, endBatch } from "../core/apply";

export function useWheelAdjust(
  elRef: React.RefObject<HTMLElement | null>,
  value: number,
  onChange: (v: number) => void,
  opts?: { step?: number; min?: number; max?: number; disabled?: boolean }
) {
  // Store latest values in a ref so the effect doesn't need to re-attach on every render
  const latest = useRef({ value, onChange, step: opts?.step ?? 1, min: opts?.min, max: opts?.max });
  latest.current = { value, onChange, step: opts?.step ?? 1, min: opts?.min, max: opts?.max };

  const disabled = opts?.disabled ?? false;
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inBatchRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || disabled) return;

    const handler = (e: WheelEvent) => {
      // Only activate when this element or a descendant has focus
      if (!el.contains(document.activeElement)) return;

      e.preventDefault();

      // Begin batch on first wheel tick
      if (!inBatchRef.current) {
        beginBatch();
        inBatchRef.current = true;
      }

      // Reset the 500ms idle timer
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(() => {
        endBatch();
        inBatchRef.current = false;
        batchTimerRef.current = null;
      }, 500);

      const { value: cur, onChange: emit, step: baseStep, min, max } = latest.current;
      const next = computeWheelValue(cur, e.deltaY, e.shiftKey, e.altKey, baseStep, min, max);
      emit(next);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
      // Cleanup: end batch and clear timer on unmount
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      if (inBatchRef.current) {
        endBatch();
        inBatchRef.current = false;
      }
    };
  }, [elRef, disabled]);
}

/** Pure computation extracted for testing. */
export function computeWheelValue(
  current: number,
  deltaY: number,
  shiftKey: boolean,
  altKey: boolean,
  baseStep: number,
  min?: number,
  max?: number,
): number {
  const step = shiftKey ? 10 : altKey ? 0.1 : baseStep;
  const delta = deltaY < 0 ? step : -step;
  let next = Math.round((current + delta) * 100) / 100;
  if (max !== undefined) next = Math.min(next, max);
  if (min !== undefined) next = Math.max(next, min);
  return next;
}
