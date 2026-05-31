/**
 * engine.ts — Unified Style Engine facade (RFC #14, Phase 1)
 *
 * A thin, ADDITIVE facade over the four style subsystems that exist today:
 *   - core/apply.ts              inline + state-keyed overrides, undo/redo, diff
 *   - core/scope.ts              class-scope <style> rules
 *   - core/statePreview.ts       pseudo-state (:hover/:focus) <style> preview
 *   - variables/modeOverrides.ts CSS-variable theme-mode overrides
 *
 * Phase 1 introduces the unified surface — `StyleEngine` + the `OverrideTarget`
 * discriminated union — WITHOUT touching any caller. Every method delegates to
 * the functions those callers already use, so behavior is unchanged and the
 * existing suite still exercises the real engine underneath. Callers migrate
 * onto `styleEngine` one at a time in Phase 2; the underlying modules collapse
 * into plugins in Phases 3-4.
 *
 * The single biggest win here is `apply(target, …)`: it folds the scattered
 * `(scope, activeClassName, activeState)` triple + the separate mode-override
 * call path (see WebflowPanel.tsx's `apply` callback) into one typed dispatch.
 *
 * See https://github.com/SkylarKitchen/redial/issues/14.
 */

import {
  applyInlineStyle,
  stateKey,
  undo as undoInline,
  redo as redoInline,
  beginBatch as beginInlineBatch,
  endBatch as endInlineBatch,
  diffAll,
  resetProp as resetInlineProp,
  reset as resetElementInline,
  resetAll as resetAllInline,
  totalOverrideCount,
  subscribeOverrides,
  getOverrideSnapshot,
  type DiffEntry,
} from "./apply";
import { applyClassStyle, destroyClassStyles } from "./scope";
import { applyStateStyle, destroyStateStyles } from "./statePreview";
import {
  applyModeOverride,
  undoModeOverride,
  redoModeOverride,
  serializeModeOverrides,
  getModeOverrideCount,
  subscribeModeOverrides,
  getModeOverrideSnapshot,
} from "../variables/modeOverrides";

// ─── Unified target model ────────────────────────────────────────────────────

/**
 * Where a style mutation lands. This discriminated union replaces today's
 * scattered `(scope, activeClassName, activeState)` triple plus the separate
 * mode-override call path with a single typed dispatch surface.
 */
export type OverrideTarget =
  | { scope: "element"; el: Element }
  | { scope: "class"; el: Element; className: string }
  | { scope: "state"; el: Element; state: string }
  | { scope: "mode"; selector: string; varName: string };

/** Result of an undo/redo step over inline/class/state. Mode steps return null. */
export type UndoResult = { el: Element; prop?: string };

/**
 * A complete picture of session changes for the commit pipeline:
 *   - `elements`: per-element inline + state-keyed diffs (state encoded on
 *                 `DiffEntry.state`); this is what the file-write path consumes.
 *   - `modes`:    serialized CSS-variable mode overrides (currently clipboard-only,
 *                 not file-saveable — see issue #35).
 */
export interface UnifiedDiff {
  elements: Array<{ el: Element; changes: DiffEntry[] }>;
  modes: string;
}

export interface StyleEngine {
  /** Apply `value` to `prop` at `target`. For `mode` targets, `prop` is ignored
   *  (the variable name is carried by the target). */
  apply(target: OverrideTarget, prop: string, value: string): void;
  undo(): UndoResult | null;
  redo(): UndoResult | null;
  beginBatch(): void;
  endBatch(): void;
  diff(): UnifiedDiff;
  dirtyCount(): number;
  resetProp(el: Element, prop: string): void;
  resetElement(el: Element): void;
  resetAll(): void;
  subscribe(cb: () => void): () => void;
  getSnapshot(): number;
}

// ─── Facade implementation ─────────────────────────────────────────────────────

/**
 * Dispatch a mutation to the right subsystem. Routing is identical to
 * WebflowPanel.tsx's `apply` callback — kept here verbatim so migrating that
 * callback to `engine.apply(target, …)` in Phase 2 is behaviour-preserving.
 */
function apply(target: OverrideTarget, prop: string, value: string): void {
  switch (target.scope) {
    case "state":
      // Preview via the state <style> tag, and mirror into apply.ts's override
      // map under a composite key so undo/redo/diff observe the state edit.
      applyStateStyle(target.el, target.state, prop, value);
      applyInlineStyle(target.el, stateKey(target.state, prop), value);
      return;
    case "class":
      // The class rule is the persisted form; the inline write is the live preview.
      applyClassStyle(target.className, prop, value);
      applyInlineStyle(target.el, prop, value, target.className);
      return;
    case "element":
      applyInlineStyle(target.el, prop, value);
      return;
    case "mode":
      applyModeOverride(target.selector, target.varName, value);
      return;
  }
}

/**
 * Unified undo. Mirrors Overlay's current fallthrough: try the inline/class/state
 * stack first, and only fall back to the mode stack when it has nothing to undo.
 * Returns the affected element (for re-inference) or null for a mode-only step.
 */
function undo(): UndoResult | null {
  const result = undoInline();
  if (result) return result;
  undoModeOverride();
  return null;
}

function redo(): UndoResult | null {
  const result = redoInline();
  if (result) return result;
  redoModeOverride();
  return null;
}

function diff(): UnifiedDiff {
  // `diffAll()` already includes state-keyed entries (DiffEntry.state), since
  // state edits are mirrored into apply.ts's map under a composite key.
  return { elements: diffAll(), modes: serializeModeOverrides() };
}

function dirtyCount(): number {
  return totalOverrideCount() + getModeOverrideCount();
}

/**
 * Session-wide reset. Mirrors the legacy `handleResetAll` (inline + class + state).
 * Mode overrides are intentionally left untouched here — they reset via their own
 * path today, and unifying that is deferred to a later phase of #14.
 */
function resetAll(): void {
  resetAllInline();
  destroyClassStyles();
  destroyStateStyles();
}

function subscribe(cb: () => void): () => void {
  const unsubOverrides = subscribeOverrides(cb);
  const unsubModes = subscribeModeOverrides(cb);
  return () => {
    unsubOverrides();
    unsubModes();
  };
}

/**
 * Combined change counter for `useSyncExternalStore`. The sum changes whenever
 * either subsystem changes; an offsetting same-tick change in both is not a real
 * scenario (the two systems are mutated by disjoint call paths).
 */
function getSnapshot(): number {
  return getOverrideSnapshot() + getModeOverrideSnapshot();
}

/**
 * The Phase-1 facade. A module singleton, because the subsystems it wraps are
 * themselves module singletons; per-instance engines with injected adapters
 * arrive in Phase 4.
 */
export const styleEngine: StyleEngine = {
  apply,
  undo,
  redo,
  beginBatch: beginInlineBatch,
  endBatch: endInlineBatch,
  diff,
  dirtyCount,
  resetProp: resetInlineProp,
  resetElement: resetElementInline,
  resetAll,
  subscribe,
  getSnapshot,
};
