/**
 * engine.ts — Unified Style Engine facade (RFC #14, Phase 1)
 *
 * A thin, ADDITIVE facade over the four style subsystems that exist today:
 *   - core/apply.ts              inline + state-keyed overrides, undo/redo, diff
 *   - core/scope.ts              class-scope <style> rules
 *   - core/statePreview.ts       pseudo-state (:hover/:focus) <style> preview
 *   - core/modeOverrides.ts      CSS-variable theme-mode overrides
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
  compositeKey,
  BASE_BREAKPOINT,
  undo as undoInline,
  redo as redoInline,
  beginBatch as beginInlineBatch,
  endBatch as endInlineBatch,
  diff as diffElementInline,
  diffAll,
  overrideCount as overrideCountInline,
  resetProp as resetInlineProp,
  reset as resetElementInline,
  resetElementBreakpoint,
  resetStateOverrides,
  resetAll as resetAllInline,
  totalOverrideCount,
  subscribeOverrides,
  getOverrideSnapshot,
  type DiffEntry,
} from "./apply";
import { applyClassStyle, destroyClassStyles, resetClassStyles } from "./scope";
import {
  applyStateStyle,
  destroyStateStyles,
  diffState as diffStateInline,
  resetStateStyles,
} from "./statePreview";

export type { DiffEntry } from "./apply";
import {
  applyModeOverride,
  serializeModeOverrides,
  getModeOverrideCount,
  subscribeModeOverrides,
  getModeOverrideSnapshot,
} from "./modeOverrides";

// ─── Unified target model ────────────────────────────────────────────────────

/**
 * Where a style mutation lands. This discriminated union replaces today's
 * scattered `(scope, activeClassName, activeState)` triple plus the separate
 * mode-override call path with a single typed dispatch surface.
 *
 * `breakpoint` is an ORTHOGONAL composition dimension (RFC #14 Increment C,
 * ADR-0005): it rides on the element/class/state arms rather than being a 5th
 * arm, because a responsive edit composes WITH those (a `:hover` at `≥768px` is
 * a state edit AND a breakpoint edit). Absent / `"base"` means the un-mediated
 * base styles. Mode overrides are a separate dimension and carry no breakpoint.
 */
export type OverrideTarget =
  | { scope: "element"; el: Element; breakpoint?: string }
  | { scope: "class"; el: Element; className: string; breakpoint?: string }
  | { scope: "state"; el: Element; state: string; breakpoint?: string }
  | { scope: "mode"; selector: string; varName: string };

/**
 * The panel's current scoping state: which scope is active, the active class
 * (when in class scope), the active pseudo-state, and the active responsive
 * breakpoint. `resolveTarget` collapses this onto an `OverrideTarget`.
 */
export interface ScopeContext {
  scope: string; // "element" | "class"
  activeClassName: string | null;
  activeState: string; // "none" | a pseudo-state like "hover"
  /** Active responsive breakpoint; absent / "base" = the un-mediated base
   *  styles. Optional so pre-Increment-C callers compile unchanged. */
  activeBreakpoint?: string;
}

/**
 * Build the `OverrideTarget` for an edit on `el` given the panel's scoping
 * state. This is the SINGLE source of truth for the
 * `(scope, activeClassName, activeState)` → target mapping that callers used to
 * re-implement inline (spacing box model, CSS import, the CSS-import hotkey).
 *
 * Precedence matches every legacy copy: a pseudo-state edit is always a `state`
 * target (even on a class); otherwise a class scope with an active class name is
 * a `class` target; otherwise it's a plain `element` target.
 */
export function resolveTarget(el: Element, ctx: ScopeContext): OverrideTarget {
  // Carry the active breakpoint onto whichever arm we resolve to (omitted at the
  // base breakpoint so base targets stay shape-identical to pre-Increment-C).
  const bp =
    ctx.activeBreakpoint && ctx.activeBreakpoint !== BASE_BREAKPOINT
      ? { breakpoint: ctx.activeBreakpoint }
      : undefined;
  if (ctx.activeState !== "none") {
    return { scope: "state", el, state: ctx.activeState, ...bp };
  }
  if (ctx.scope === "class" && ctx.activeClassName) {
    return { scope: "class", el, className: ctx.activeClassName, ...bp };
  }
  return { scope: "element", el, ...bp };
}

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
  /** Number of tracked overrides on a single element (the Footer's per-element
   *  Save/Reset enablement keys off this; counts state-keyed entries too). */
  overrideCount(el: Element): number;
  /** Per-element diff — base + state-keyed changes (the Footer reads this for
   *  Copy, and for Save when no pseudo-state is active). */
  diffElement(el: Element): DiffEntry[];
  /** Per-element, per-state diff — the pseudo-state preview map (the Footer's
   *  Save path when a pseudo-state is active). */
  diffState(el: Element, state: string): DiffEntry[];
  resetProp(el: Element, prop: string): void;
  resetElement(el: Element): void;
  /** Reset ONE element's overrides for its active scope/state. State-first
   *  precedence, mirroring the legacy Footer reset — but does NOT touch global
   *  mode overrides (see `resetScope` impl). */
  resetScope(el: Element, ctx: ScopeContext): void;
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
    case "state": {
      const bp = target.breakpoint ?? BASE_BREAKPOINT;
      // Live pseudo-state preview (the <style> tag) is base-only today; a
      // breakpoint pseudo-state is tracked under its composite key, with its
      // media-gated render deferred to #35. Always mirror into apply.ts's map
      // (keyed by breakpoint ▸ state ▸ prop) so undo/redo/diff observe the edit.
      if (bp === BASE_BREAKPOINT) applyStateStyle(target.el, target.state, prop, value);
      applyInlineStyle(target.el, compositeKey(bp, target.state, prop), value);
      return;
    }
    case "class": {
      const bp = target.breakpoint ?? BASE_BREAKPOINT;
      if (bp === BASE_BREAKPOINT) {
        // The class rule is the persisted form; the inline write is the live preview.
        applyClassStyle(target.className, prop, value);
        applyInlineStyle(target.el, prop, value, target.className);
      } else {
        // Breakpoint class edit: tracked only (per-breakpoint class rule = #35).
        applyInlineStyle(target.el, compositeKey(bp, "none", prop), value);
      }
      return;
    }
    case "element": {
      const bp = target.breakpoint ?? BASE_BREAKPOINT;
      applyInlineStyle(target.el, compositeKey(bp, "none", prop), value);
      return;
    }
    case "mode":
      applyModeOverride(target.selector, target.varName, value);
      return;
  }
}

/**
 * Unified undo over the ONE temporal stack — inline, state, class, batch,
 * dom-move, AND mode (which rides apply.ts's `pushForeignUndo` seam since RFC #14
 * Increment 4a, ADR-0006). Steps revert in true reverse-time order regardless of
 * dimension, so the legacy inline→mode fallthrough — which always undid every
 * inline edit before any mode edit, ignoring when each happened — is gone.
 * Returns the affected element, or the `document.body` sentinel for a non-element
 * step (mode / dom-move). Mode/dom-move return a truthy result (not null) so the
 * ChangesDrawer history scrub keeps stepping past them.
 */
function undo(): UndoResult | null {
  return undoInline();
}

function redo(): UndoResult | null {
  return redoInline();
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

// ─── Per-element / per-state surface (the Footer "wall", Phase 3) ───────────────

/** Tracked override count for one element (includes state-keyed entries). */
function overrideCount(el: Element): number {
  return overrideCountInline(el);
}

/** Per-element diff: base + state-keyed changes from apply.ts's map. */
function diffElement(el: Element): DiffEntry[] {
  return diffElementInline(el);
}

/** Per-element, per-state diff from the pseudo-state preview map. */
function diffState(el: Element, state: string): DiffEntry[] {
  return diffStateInline(el, state);
}

/**
 * Reset the overrides on ONE element in its active scope/state. Mirrors the
 * legacy Footer `handleReset` precedence — a pseudo-state edit resets only that
 * state (in both the preview <style> and apply.ts's mirror map); otherwise the
 * element's inline overrides reset, plus the shared class rule when in class
 * scope.
 *
 * ONE deliberate divergence from the legacy code: this does **not** clear global
 * CSS-variable mode overrides. A mode override is a separate dimension (keyed by
 * `selector + varName`, created in the Variables panel, not attached to this
 * element), so wiping every mode override when resetting one element was an
 * over-clear bug — resetting an element's `:hover` could silently destroy
 * unrelated theme edits. Mode overrides stay clearable via undo (Cmd/Ctrl+Z, now
 * on the ONE unified temporal stack — ADR-0006); a dedicated Variables-panel
 * clear affordance is tracked in issue #52.
 * See https://github.com/SkylarKitchen/redial/issues/14.
 */
function resetScope(el: Element, ctx: ScopeContext): void {
  const bp = ctx.activeBreakpoint ?? BASE_BREAKPOINT;
  if (ctx.activeState !== "none") {
    // Live state <style> is base-only; clear it only at the base breakpoint.
    if (bp === BASE_BREAKPOINT) resetStateStyles(el, ctx.activeState);
    resetStateOverrides(el, ctx.activeState, bp); // mirror map, scoped to this breakpoint
    return;
  }
  // Surgical (ADR-0005): clear only the ACTIVE breakpoint's cell, leaving other
  // breakpoints intact. At the base breakpoint this matches the legacy full
  // element reset (the only breakpoint that exists pre-#35).
  resetElementBreakpoint(el, bp);
  if (bp === BASE_BREAKPOINT && ctx.scope === "class" && ctx.activeClassName) {
    resetClassStyles(ctx.activeClassName);
  }
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
  overrideCount,
  diffElement,
  diffState,
  resetProp: resetInlineProp,
  resetElement: resetElementInline,
  resetScope,
  resetAll,
  subscribe,
  getSnapshot,
};
