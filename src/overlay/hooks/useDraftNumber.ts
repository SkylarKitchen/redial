/**
 * useDraftNumber.ts — Shared draft-state hook for numeric text inputs.
 *
 * Consolidates the hand-rolled "draft + commit-on-blur/Enter + Arrow-key
 * stepping + value resync" pattern reimplemented across the panel's numeric
 * cells. The hook owns the genuinely-common core:
 *   - local `draft` string state
 *   - resyncing the draft to `value` (gated by `resync`, e.g. `!editing`)
 *   - Enter / Escape / ArrowUp / ArrowDown key routing
 *   - the modifier→step math (Shift / Alt multipliers, clamp, round)
 *
 * Site-specific concerns stay with the caller via callbacks:
 *   - `onCommit(draft)`  — parse / clamp / dedup on Enter & blur
 *   - `onStep(next)`     — what to do with an arrow-stepped value
 *   - `onEscape()`       — extra side-effect on Escape (e.g. exit edit mode)
 *
 * This avoids a pile of boolean flags while keeping each call site
 * byte-for-byte equivalent to its previous bespoke implementation.
 */

import { useState, useEffect } from "react";

export interface UseDraftNumberOptions {
  /** The committed numeric value the draft mirrors. */
  value: number;
  /** When true, the draft follows `value` (typically `!editing` / `!focused`). */
  resync: boolean;
  /** Base arrow-key step (default 1). */
  step?: number;
  /** Step when Shift is held (default `step * 10`). */
  shiftStep?: number;
  /** Step when Alt/Option is held. Omit to ignore Alt. */
  altStep?: number;
  /** Clamp the stepped value to this lower bound. */
  min?: number;
  /** Clamp the stepped value to this upper bound. */
  max?: number;
  /** Round the stepped value to this many decimals. Omit to skip rounding. */
  round?: number;
  /** Blur the input after an Enter-commit. */
  blurOnEnter?: boolean;
  /** On Escape, reset the draft back to `String(value)`. */
  revertOnEscape?: boolean;
  /** On arrow-step, also write the stepped value back into the draft. */
  stepUpdatesDraft?: boolean;
  /** Commit handler — receives the current draft string (Enter & blur). */
  onCommit: (draft: string) => void;
  /** Arrow-step handler — receives the clamped/rounded next value. */
  onStep: (next: number) => void;
  /** Optional extra Escape side-effect (runs when reverting or when provided). */
  onEscape?: () => void;
}

export interface UseDraftNumberResult {
  draft: string;
  setDraft: (value: string) => void;
  inputProps: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
}

export function useDraftNumber(opts: UseDraftNumberOptions): UseDraftNumberResult {
  const {
    value,
    resync,
    step = 1,
    shiftStep,
    altStep,
    min,
    max,
    round,
    blurOnEnter = false,
    revertOnEscape = false,
    stepUpdatesDraft = false,
    onCommit,
    onStep,
    onEscape,
  } = opts;

  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (resync) setDraft(String(value));
  }, [value, resync]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onCommit(draft);
      if (blurOnEnter) e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (revertOnEscape) setDraft(String(value));
      if (revertOnEscape || onEscape) onEscape?.();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      let inc = step;
      if (e.shiftKey) inc = shiftStep ?? step * 10;
      else if (e.altKey && altStep != null) inc = altStep;

      let next = value + dir * inc;
      if (round != null) {
        const f = 10 ** round;
        next = Math.round(next * f) / f;
      }
      if (min != null) next = Math.max(min, next);
      if (max != null) next = Math.min(max, next);

      if (stepUpdatesDraft) setDraft(String(next));
      onStep(next);
    }
  };

  return {
    draft,
    setDraft,
    inputProps: {
      onChange: (e) => setDraft(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: () => onCommit(draft),
    },
  };
}
