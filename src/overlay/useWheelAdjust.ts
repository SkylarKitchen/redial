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

  useEffect(() => {
    const el = elRef.current;
    if (!el || disabled) return;

    const handler = (e: WheelEvent) => {
      // Only activate when this element or a descendant has focus
      if (!el.contains(document.activeElement)) return;

      e.preventDefault();

      const { value: cur, onChange: emit, step: baseStep, min, max } = latest.current;
      const step = e.shiftKey ? 10 : e.altKey ? 0.1 : baseStep;
      // Scroll up (negative deltaY) → increase, scroll down → decrease
      const delta = e.deltaY < 0 ? step : -step;
      let next = Math.round((cur + delta) * 100) / 100;
      if (max !== undefined) next = Math.min(next, max);
      if (min !== undefined) next = Math.max(next, min);
      emit(next);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [elRef, disabled]);
}
