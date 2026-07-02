/**
 * apply.ts — inline style management, undo stack, diff tracking
 *
 * Every slider drag calls applyInlineStyle() which:
 * 1. Records the initial value (for amber highlighting + reset)
 * 2. Pushes to the undo stack
 * 3. Sets the inline style with !important
 *
 * diff() returns the list of changes for commit.ts to write to source files.
 *
 * Session persistence: overrides are serialized to localStorage keyed by
 * pathname so changes survive page refreshes and HMR reloads.
 */

import { getStableSelector } from "../util";
import { isInvalidDeclaration } from "../../lib/css";
import { beginClassStyleBatch, endClassStyleBatch, detachSessionClasses } from "./scope";

export type Override = {
  initial: string;
  current: string;
  inlineOriginal: string | null;
};

export type DiffEntry = {
  prop: string;
  from: string;
  to: string;
  state?: string;
  /** Responsive breakpoint this change belongs to; absent = the base breakpoint
   *  (no `@media`). RFC #14 Increment C — see ADR-0005. */
  breakpoint?: string;
};

// --- Composite key helpers (breakpoint ▸ state ▸ prop) ---
//
// The override map keys everything by a single composite string so diff/undo/
// reset/persistence all share one shape. Two orthogonal dimensions namespace the
// bare CSS property: a pseudo-state (`hover`) and a responsive breakpoint (`768`).
// The cascade reads breakpoint-OUTER, state-INNER — `@media(≥768px){ :hover{…} }` —
// so the key is `<breakpoint>@@<state>::<prop>`. The BASE breakpoint and the
// "none" state are elided, which keeps base keys BYTE-IDENTICAL to the legacy
// `state::prop` form (backward-compatible with persisted sessions + undo entries).

/** Sentinel for "no responsive breakpoint" (the un-mediated base styles). */
export const BASE_BREAKPOINT = "base";
const BP_DELIM = "@@";

/**
 * Build a composite key encoding pseudo-class state + CSS property.
 * "none" state (default) returns just the bare property name.
 */
export function stateKey(state: string, prop: string): string {
  return state === "none" ? prop : `${state}::${prop}`;
}

/**
 * Parse a composite key back into { state, prop } (breakpoint-agnostic — kept for
 * the many callers that only care about the state dimension). For the full triple,
 * use {@link parseKey}.
 */
export function parseStateKey(key: string): { state: string; prop: string } {
  const idx = key.indexOf("::");
  return idx < 0 ? { state: "none", prop: key } : { state: key.slice(0, idx), prop: key.slice(idx + 2) };
}

/**
 * Build the full composite key for a (breakpoint, state, prop) triple. The base
 * breakpoint elides its prefix so the result equals {@link stateKey}.
 */
export function compositeKey(breakpoint: string, state: string, prop: string): string {
  const sk = stateKey(state, prop);
  return breakpoint === BASE_BREAKPOINT ? sk : `${breakpoint}${BP_DELIM}${sk}`;
}

/**
 * Parse a composite key back into { breakpoint, state, prop }. Splits the
 * breakpoint prefix first, then defers to {@link parseStateKey} for the rest.
 */
export function parseKey(key: string): { breakpoint: string; state: string; prop: string } {
  const idx = key.indexOf(BP_DELIM);
  if (idx < 0) {
    const { state, prop } = parseStateKey(key);
    return { breakpoint: BASE_BREAKPOINT, state, prop };
  }
  const breakpoint = key.slice(0, idx);
  const { state, prop } = parseStateKey(key.slice(idx + BP_DELIM.length));
  return { breakpoint, state, prop };
}

/**
 * Whether a composite key maps to the element's LIVE inline style. Only base-
 * breakpoint, no-state keys do — pseudo-state keys render through statePreview's
 * `<style>` tag, and breakpoint keys are media-gated (rendered by #35, not inline).
 * This replaces the scattered `prop.includes("::")` guard, which is blind to the
 * breakpoint dimension (a key like `768@@color` has no `::` but is NOT inline).
 */
function isInlineWritable(key: string): boolean {
  const { breakpoint, state } = parseKey(key);
  return breakpoint === BASE_BREAKPOINT && state === "none";
}

type SingleUndoEntry = { el: Element; prop: string; prev: string; state: string; className?: string };
type BatchUndoEntry = { type: 'batch'; entries: SingleUndoEntry[] };
type DomMoveUndoEntry = { type: 'dom-move'; undo: () => void; redo: () => void };
/**
 * A foreign subsystem's undo step in the ONE temporal stack — a generic
 * closure-pair entry (structurally like dom-move) that apply.ts reverts/reapplies
 * without knowing the subsystem. modeOverrides.ts registers through
 * `pushForeignUndo`. `coalesceKey` enables drag-coalescing (consecutive
 * same-key steps merge into one undo). RFC #14 Increment 4a — see ADR-0006.
 */
type ForeignUndoEntry = { type: 'foreign'; revert: () => void; reapply: () => void; coalesceKey?: string };
type UndoEntry = SingleUndoEntry | BatchUndoEntry | DomMoveUndoEntry | ForeignUndoEntry;

function isBatch(entry: UndoEntry): entry is BatchUndoEntry {
  return 'type' in entry && entry.type === 'batch';
}

function isDomMove(entry: UndoEntry): entry is DomMoveUndoEntry {
  return 'type' in entry && entry.type === 'dom-move';
}

function isForeign(entry: UndoEntry): entry is ForeignUndoEntry {
  return 'type' in entry && entry.type === 'foreign';
}

// --- Subscription API for useSyncExternalStore ---

const listeners = new Set<() => void>();

/**
 * Register a callback to be notified whenever the overrides map changes.
 * Designed for use with `useSyncExternalStore`.
 * @param callback - Function invoked on every override mutation.
 * @returns An unsubscribe function that removes the callback.
 */
export function subscribeOverrides(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

/**
 * Return the current count of dirty overrides (where initial !== current) for
 * elements still connected to a document. Used as the snapshot value for
 * `useSyncExternalStore`.
 *
 * Starts from the maintained `dirtyCount` (kept in sync by every mutation
 * path) and subtracts dirty entries on disconnected elements. Nothing prunes
 * map entries when an element leaves the DOM (React re-render, route change,
 * HMR node replacement), so without this subtraction the count would stay
 * inflated indefinitely. The hot-path cost is one O(1) `isConnected` flag
 * check per touched element — unlike the previous full walk, which compared
 * every entry and did an ancestor-chain `document.contains` lookup per
 * element on every notifyListeners() call (hundreds of times per second
 * during a scrub).
 * @returns The number of active dirty overrides.
 */
export function getOverrideSnapshot(): number {
  let count = dirtyCount;
  for (const [el, props] of overrides) {
    if (el.isConnected) continue;
    for (const { initial, current } of props.values()) {
      if (initial !== current) count--;
    }
  }
  return count;
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

// --- Change listener API (for history tracking) ---

export type ChangeInfo = { el: Element; prop: string; from: string; to: string };
const changeListeners = new Set<(info: ChangeInfo) => void>();

/**
 * Register a callback that fires on every individual CSS property change.
 * Used for history tracking. Receives a `ChangeInfo` with the element, property,
 * previous value, and new value.
 * @param callback - Function invoked after each style mutation.
 * @returns An unsubscribe function that removes the callback.
 */
export function subscribeChanges(callback: (info: ChangeInfo) => void): () => void {
  changeListeners.add(callback);
  return () => { changeListeners.delete(callback); };
}

function notifyChange(el: Element, prop: string, from: string, to: string) {
  const info: ChangeInfo = { el, prop, from, to };
  changeListeners.forEach(fn => fn(info));
}

// --- State change listener API (for statePreview.ts sync) ---

export type StateChangeInfo = { el: Element; state: string; prop: string; value: string | null };
const stateChangeListeners = new Set<(info: StateChangeInfo) => void>();

/**
 * Register a callback that fires when undo/redo processes a state-keyed entry.
 * `value` is the new value to apply, or `null` if the property was removed.
 * Returns an unsubscribe function.
 */
export function onStateChange(callback: (info: StateChangeInfo) => void): () => void {
  stateChangeListeners.add(callback);
  return () => { stateChangeListeners.delete(callback); };
}

function notifyStateChange(el: Element, state: string, prop: string, value: string | null) {
  const info: StateChangeInfo = { el, state, prop, value };
  stateChangeListeners.forEach(fn => fn(info));
}

// --- Class change listener API (for class-scope undo sync) ---

export type ClassChangeInfo = { className: string; prop: string; value: string | null };
const classChangeListeners = new Set<(info: ClassChangeInfo) => void>();

/**
 * Register a callback that fires when undo/redo processes a class-scoped entry.
 * `value` is the new value to apply, or `null` if the property was removed.
 * Returns an unsubscribe function.
 */
export function onClassChange(callback: (info: ClassChangeInfo) => void): () => void {
  classChangeListeners.add(callback);
  return () => { classChangeListeners.delete(callback); };
}

function notifyClassChange(className: string, prop: string, value: string | null) {
  classChangeListeners.forEach(fn => fn({ className, prop, value }));
}

// --- State ---

const overrides = new Map<Element, Map<string, Override>>();

// O(1) running counter of dirty overrides (initial !== current).
// Maintained by all mutation paths so totalOverrideCount() avoids iteration.
let dirtyCount = 0;

// Overrides cleared by clearRedundantOverrides — kept so undo/redo can
// recover the "current" value that was removed when HMR made it redundant.
const clearedOverrides = new Map<Element, Map<string, Override>>();

// --- Style Clipboard ---

let styleClipboard: { prop: string; value: string }[] = [];

/**
 * Copy the current overrides from an element to the style clipboard.
 * Returns the number of styles copied.
 */
export function copyStyles(el: Element): number {
  const entries = diff(el);
  styleClipboard = entries.map((e) => ({ prop: e.prop, value: e.to }));
  return styleClipboard.length;
}

/**
 * Paste clipboard styles onto an element.
 * Wraps in beginBatch/endBatch so the entire paste is one undo entry.
 * `breakpoint` keys the pasted props to the active responsive breakpoint
 * (ADR-0005) — at the default base breakpoint this is byte-identical to the
 * legacy bare-prop paste; at a non-base breakpoint the paste is tracked
 * media-gated instead of clobbering the base inline style.
 * Returns the number of styles pasted.
 */
export function pasteStyles(el: Element, breakpoint: string = BASE_BREAKPOINT): number {
  if (styleClipboard.length === 0) return 0;
  beginBatch();
  for (const { prop, value } of styleClipboard) {
    applyInlineStyle(el, compositeKey(breakpoint, "none", prop), value);
  }
  endBatch();
  return styleClipboard.length;
}

/**
 * Check if the style clipboard has any entries.
 */
export function hasClipboardStyles(): boolean {
  return styleClipboard.length > 0;
}
const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];
const MAX_UNDO = 200;

// --- Batch API ---

let batchDepth = 0;
let batchEntries: SingleUndoEntry[] = [];

/**
 * Begin a batch of style changes. All `applyInlineStyle` calls while a batch
 * is open are grouped into a single undo entry. Batches may be nested.
 */
export function beginBatch(): void {
  batchDepth++;
  // Defer class-scope <style> rebuilds for the duration of the batch (issue #29)
  // so a slider drag rewrites the tag once on endBatch, not per pointermove.
  beginClassStyleBatch();
}

/**
 * Close the current batch. When the outermost batch is closed, all collected
 * undo entries are flushed as a single `BatchUndoEntry` onto the undo stack.
 */
export function endBatch(): void {
  batchDepth--;
  if (batchDepth <= 0) {
    batchDepth = 0; // safety reset
    if (batchEntries.length > 0) {
      undoStack.push({ type: 'batch', entries: [...batchEntries] });
      if (undoStack.length > MAX_UNDO) {
        undoStack.splice(0, undoStack.length - MAX_UNDO);
      }
      batchEntries = [];
    }
  }
  // Mirror the batch close to the class-scope rebuilder; the outermost close
  // flushes the single deferred rebuild (issue #29).
  endClassStyleBatch();
}

// --- Public API ---

/**
 * Apply an inline style override to an element.
 * Records the initial computed value on first touch, pushes an undo entry,
 * sets the inline style with `!important`, and schedules session persistence.
 * State-keyed props (e.g. `"hover::color"`) are NOT written to inline style —
 * they are handled by `statePreview.ts` via a `<style>` tag.
 * @param el - The target DOM element.
 * @param prop - CSS property name, or a composite `"state::prop"` key.
 * @param value - The new CSS value to apply.
 * @param className - Optional class name for class-scoped undo notifications.
 */
export function applyInlineStyle(
  el: Element,
  prop: string,
  value: string,
  className?: string
): void {
  if (!(el as HTMLElement).isConnected) return;

  // Decompose the composite key (breakpoint ▸ state ▸ prop). Only base-breakpoint,
  // no-state keys touch the live inline style; state keys render via statePreview
  // and breakpoint keys are media-gated (tracked here, rendered by #35).
  const parsed = parseKey(prop);
  const writeInline = parsed.breakpoint === BASE_BREAKPOINT && parsed.state === "none";
  const cssProp = parsed.prop; // the real CSS property name

  // Semantic-validity guard (defense-in-depth for the toggle-deselect bug
  // class): a single-select toggle's deselect emits `none`, which is invalid
  // CSS for some props (box-sizing, text-align, …). The browser silently
  // rejects the inline write, but recording it here would still leak the
  // invalid value into diff() → localStorage → the source commit path. Drop it.
  if (isInvalidDeclaration(cssProp, value)) return;

  // New action invalidates redo history (standard undo/redo semantics)
  if (redoStack.length > 0) redoStack.length = 0;

  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  if (!elOverrides.has(prop)) {
    // First time touching this prop — capture the original computed value
    // Also capture pre-existing inline value so undo/reset can restore it
    const inlineOriginal = writeInline ? ((el as HTMLElement).style.getPropertyValue(cssProp) || null) : null;
    const initial = getComputedStyle(el).getPropertyValue(cssProp).trim();
    elOverrides.set(prop, { initial, current: value, inlineOriginal });

    // New override: dirty if initial !== value
    if (initial !== value) dirtyCount++;

    if (batchDepth > 0) {
      // In batch mode: collect undo entries, only first touch per (el, prop)
      if (!batchEntries.some((e) => e.el === el && e.prop === prop)) {
        batchEntries.push({ el, prop, prev: initial, state: parsed.state, className });
      }
    } else {
      undoStack.push({ el, prop, prev: initial, state: parsed.state, className });
    }
  } else {
    const existing = elOverrides.get(prop)!;
    const wasDirty = existing.initial !== existing.current;

    if (batchDepth > 0) {
      // In batch mode: only record first touch per (el, prop)
      if (!batchEntries.some((e) => e.el === el && e.prop === prop)) {
        batchEntries.push({ el, prop, prev: existing.current, state: parsed.state, className });
      }
    } else {
      undoStack.push({ el, prop, prev: existing.current, state: parsed.state, className });
    }
    existing.current = value;

    // Update dirtyCount based on transition
    const isDirtyNow = existing.initial !== value;
    if (!wasDirty && isDirtyNow) dirtyCount++;
    else if (wasDirty && !isDirtyNow) dirtyCount--;
  }

  // Prevent unbounded undo stack growth in long sessions (only outside batch)
  if (batchDepth <= 0 && undoStack.length > MAX_UNDO) {
    undoStack.splice(0, undoStack.length - MAX_UNDO);
  }

  // Only base-breakpoint, no-state props apply to the live inline style.
  // State-keyed props render via the <style> tag in statePreview.ts; breakpoint
  // props are media-gated and tracked here (their live render lands with #35).
  if (writeInline) {
    (el as HTMLElement).style.setProperty(prop, value, "important");
  }
  schedulePersist();
  notifyListeners();
  notifyChange(el, cssProp, elOverrides.get(prop)!.initial, value);
}

/**
 * Keep the custom-property shadow map in sync when undo/redo rewrites a
 * `--var` entry (issue #71). Only entries that went through
 * applyCustomProperty live in the shadow map — `--` props applied via
 * applyInlineStyle (Custom Properties section) are intentionally not tracked,
 * so this only updates an EXISTING entry (never creates one). Reverting to
 * the initial value keeps the entry (marking the var as custom-managed for
 * priority alignment) but makes it non-dirty, so the dirty dot goes out.
 */
function syncCustomPropertyOverride(el: Element, prop: string, value: string): void {
  if (!prop.startsWith("--")) return;
  const cp = customPropertyOverrides.get(prop);
  if (cp && cp.scope === el) cp.current = value;
}

/**
 * Priority to use when undo/redo re-applies an inline value (issue #71).
 * applyCustomProperty sets variables WITHOUT "important" — re-applying them
 * with it would flip the effective cascade across undo/redo cycles. Everything
 * else (including `--` props applied via applyInlineStyle, which are not in
 * the shadow map) keeps the engine's standard "important".
 */
function undoRedoPriority(el: Element, prop: string): "" | "important" {
  return prop.startsWith("--") && customPropertyOverrides.get(prop)?.scope === el
    ? ""
    : "important";
}

/**
 * Undo the most recent style change or batch of changes.
 * Pops from the undo stack, restores previous values, and pushes a redo entry.
 * Handles single overrides, batches, and DOM-move operations.
 * @returns An object with the affected element (and property for single entries),
 *          or `null` if the undo stack is empty.
 */
export function undo(): { el: Element; prop?: string } | null {
  const last = undoStack.pop();
  if (!last) return null;

  if (isDomMove(last)) {
    last.undo();
    redoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }

  if (isForeign(last)) {
    last.revert();
    redoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }

  if (isBatch(last)) {
    // Build redo batch: capture current values before restoring
    const redoEntries: SingleUndoEntry[] = [];
    let result: { el: Element; prop: string } | null = null;
    for (let i = last.entries.length - 1; i >= 0; i--) {
      const { el, prop, prev, state, className } = last.entries[i];
      const { breakpoint: bpK, state: stK, prop: cssProp } = parseKey(prop);
      const writeInline = bpK === BASE_BREAKPOINT && stK === "none";
      const notifyState = bpK === BASE_BREAKPOINT && stK !== "none";
      if (!overrides.has(el)) overrides.set(el, new Map());
      const elOverrides = overrides.get(el)!;
      let entry = elOverrides.get(prop);
      if (!entry) {
        // Override was cleared (e.g., by clearRedundantOverrides after save).
        // Re-create using the stashed cleared value if available, else computed.
        const cleared = clearedOverrides.get(el)?.get(prop);
        const baseline = cleared?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();
        entry = { initial: baseline, current: baseline, inlineOriginal: null };
        elOverrides.set(prop, entry);
      }

      redoEntries.push({ el, prop, prev: entry.current, state, className });

      const wasDirty = entry.initial !== entry.current;

      if (prev === entry.initial) {
        if (writeInline) {
          if (entry.inlineOriginal) {
            (el as HTMLElement).style.setProperty(prop, entry.inlineOriginal);
          } else {
            (el as HTMLElement).style.removeProperty(prop);
          }
        }
        elOverrides.delete(prop);
        if (elOverrides.size === 0) overrides.delete(el);
        if (notifyState) notifyStateChange(el, stK, cssProp, null);
        if (className) notifyClassChange(className, prop, null);
        if (wasDirty) dirtyCount--;
      } else {
        if (writeInline) (el as HTMLElement).style.setProperty(prop, prev, undoRedoPriority(el, prop));
        entry.current = prev;
        if (notifyState) notifyStateChange(el, stK, cssProp, prev);
        if (className) notifyClassChange(className, prop, prev);
        const isDirtyNow = entry.initial !== prev;
        if (!wasDirty && isDirtyNow) dirtyCount++;
        else if (wasDirty && !isDirtyNow) dirtyCount--;
      }
      syncCustomPropertyOverride(el, prop, prev);
      result = { el, prop };
    }
    if (redoEntries.length > 0) {
      redoStack.push({ type: 'batch', entries: redoEntries });
    }
    schedulePersist();
    notifyListeners();
    return result;
  }

  const single = last as SingleUndoEntry;
  const { el, prop, prev, state, className } = single;
  const { breakpoint: bpK, state: stK, prop: cssProp } = parseKey(prop);
  const writeInline = bpK === BASE_BREAKPOINT && stK === "none";
  const notifyState = bpK === BASE_BREAKPOINT && stK !== "none";
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  let entry = elOverrides.get(prop);
  if (!entry) {
    // Override was cleared (e.g., by clearRedundantOverrides after save).
    // Re-create using the stashed cleared value if available, else computed.
    const cleared = clearedOverrides.get(el)?.get(prop);
    const baseline = cleared?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();
    entry = { initial: baseline, current: baseline, inlineOriginal: null };
    elOverrides.set(prop, entry);
  }

  // Capture forward state for redo before restoring
  redoStack.push({ el, prop, prev: entry.current, state, className });

  const wasDirty = entry.initial !== entry.current;

  if (prev === entry.initial) {
    // Undoing back to original — restore pre-existing inline value or remove
    if (writeInline) {
      if (entry.inlineOriginal) {
        (el as HTMLElement).style.setProperty(prop, entry.inlineOriginal);
      } else {
        (el as HTMLElement).style.removeProperty(prop);
      }
    }
    elOverrides.delete(prop);
    if (elOverrides.size === 0) overrides.delete(el);
    if (notifyState) notifyStateChange(el, stK, cssProp, null);
    if (className) notifyClassChange(className, prop, null);
    if (wasDirty) dirtyCount--;
  } else {
    if (writeInline) (el as HTMLElement).style.setProperty(prop, prev, undoRedoPriority(el, prop));
    entry.current = prev;
    if (notifyState) notifyStateChange(el, stK, cssProp, prev);
    if (className) notifyClassChange(className, prop, prev);
    const isDirtyNow = entry.initial !== prev;
    if (!wasDirty && isDirtyNow) dirtyCount++;
    else if (wasDirty && !isDirtyNow) dirtyCount--;
  }
  syncCustomPropertyOverride(el, prop, prev);

  schedulePersist();
  notifyListeners();
  return { el, prop };
}

/**
 * Redo the most recently undone change or batch of changes.
 * Pops from the redo stack, re-applies values, and pushes an undo entry.
 * Handles single overrides, batches, and DOM-move operations.
 * @returns An object with the affected element (and property for single entries),
 *          or `null` if the redo stack is empty.
 */
export function redo(): { el: Element; prop?: string } | null {
  const last = redoStack.pop();
  if (!last) return null;

  if (isDomMove(last)) {
    last.redo();
    undoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }

  if (isForeign(last)) {
    last.reapply();
    undoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }

  if (isBatch(last)) {
    // Re-apply batch entries and push an undo batch
    const undoEntries: SingleUndoEntry[] = [];
    let result: { el: Element; prop: string } | null = null;
    for (const { el, prop, prev: redoValue, state, className } of last.entries) {
      const { breakpoint: bpK, state: stK, prop: cssProp } = parseKey(prop);
      const writeInline = bpK === BASE_BREAKPOINT && stK === "none";
      const notifyState = bpK === BASE_BREAKPOINT && stK !== "none";
      if (!overrides.has(el)) overrides.set(el, new Map());
      const elOverrides = overrides.get(el)!;
      const entry = elOverrides.get(prop);
      const currentValue = entry?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();

      undoEntries.push({ el, prop, prev: currentValue, state, className });

      if (entry) {
        const wasDirty = entry.initial !== entry.current;
        entry.current = redoValue;
        const isDirtyNow = entry.initial !== redoValue;
        if (!wasDirty && isDirtyNow) dirtyCount++;
        else if (wasDirty && !isDirtyNow) dirtyCount--;
      } else {
        const initial = getComputedStyle(el).getPropertyValue(cssProp).trim();
        elOverrides.set(prop, { initial, current: redoValue, inlineOriginal: null });
        if (initial !== redoValue) dirtyCount++;
      }
      if (writeInline) {
        (el as HTMLElement).style.setProperty(prop, redoValue, undoRedoPriority(el, prop));
      } else if (notifyState) {
        notifyStateChange(el, stK, cssProp, redoValue);
      }
      if (className) notifyClassChange(className, prop, redoValue);
      syncCustomPropertyOverride(el, prop, redoValue);
      result = { el, prop };
    }
    if (undoEntries.length > 0) {
      undoStack.push({ type: 'batch', entries: undoEntries });
    }
    schedulePersist();
    notifyListeners();
    return result;
  }

  const { el, prop, prev: redoValue, state, className } = last as SingleUndoEntry;
  const { breakpoint: bpK, state: stK, prop: cssProp } = parseKey(prop);
  const writeInline = bpK === BASE_BREAKPOINT && stK === "none";
  const notifyState = bpK === BASE_BREAKPOINT && stK !== "none";
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;
  const entry = elOverrides.get(prop);
  const currentValue = entry?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();

  // Push undo entry for this redo
  undoStack.push({ el, prop, prev: currentValue, state, className });

  if (entry) {
    const wasDirty = entry.initial !== entry.current;
    entry.current = redoValue;
    const isDirtyNow = entry.initial !== redoValue;
    if (!wasDirty && isDirtyNow) dirtyCount++;
    else if (wasDirty && !isDirtyNow) dirtyCount--;
  } else {
    const initial = getComputedStyle(el).getPropertyValue(cssProp).trim();
    elOverrides.set(prop, { initial, current: redoValue, inlineOriginal: null });
    if (initial !== redoValue) dirtyCount++;
  }
  if (writeInline) {
    (el as HTMLElement).style.setProperty(prop, redoValue, undoRedoPriority(el, prop));
  } else if (notifyState) {
    notifyStateChange(el, stK, cssProp, redoValue);
  }
  if (className) notifyClassChange(className, prop, redoValue);
  syncCustomPropertyOverride(el, prop, redoValue);

  schedulePersist();
  notifyListeners();
  return { el, prop };
}

/**
 * Clear all composite-keyed overrides for a specific state on an element.
 * Called by Footer.tsx handleReset to keep apply.ts in sync with statePreview.ts.
 */
export function resetStateOverrides(el: Element, state: string, breakpoint: string = BASE_BREAKPOINT): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  // Match by both dimensions so a per-breakpoint reset clears only that
  // breakpoint's state cell. Defaults to the base breakpoint → byte-identical
  // for every pre-Increment-C caller (RFC #14, ADR-0005).
  const matches = (key: string) => {
    const parsed = parseKey(key);
    return parsed.state === state && parsed.breakpoint === breakpoint;
  };

  const keysToRemove: string[] = [];
  for (const [key, override] of elOverrides) {
    if (matches(key)) {
      keysToRemove.push(key);
      if (override.initial !== override.current) dirtyCount--;
    }
  }
  for (const key of keysToRemove) {
    elOverrides.delete(key);
  }
  if (elOverrides.size === 0) overrides.delete(el);

  // Also remove undo/redo entries for this element + state + breakpoint
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (isBatch(entry)) {
        entry.entries = entry.entries.filter(e => !(e.el === el && matches(e.prop)));
        if (entry.entries.length === 0) stack.splice(i, 1);
      } else if (!isDomMove(entry) && !isForeign(entry) && entry.el === el && matches(entry.prop)) {
        stack.splice(i, 1);
      }
    }
  }

  // Write through to session persistence so the cleared state overrides don't
  // resurrect from localStorage on the next reload (issue #72).
  schedulePersist();
  notifyListeners();
}

/**
 * Reset only the overrides on an element that belong to ONE breakpoint, leaving
 * other breakpoints intact — the surgical partner to the engine's per-breakpoint
 * Footer reset (RFC #14 Increment C, ADR-0005). At the base breakpoint this
 * matches {@link reset}'s effect on the override map (clearing the element's
 * un-mediated keys, including its base pseudo-state keys, and restoring inline
 * styles); non-base breakpoints are tracked-only today, so their keys are simply
 * dropped (no inline render to revert until #35).
 */
export function resetElementBreakpoint(el: Element, breakpoint: string): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  const keysToRemove: string[] = [];
  for (const [prop, override] of elOverrides) {
    if (parseKey(prop).breakpoint !== breakpoint) continue;
    keysToRemove.push(prop);
    if (override.initial !== override.current) dirtyCount--;
    if (isInlineWritable(prop)) {
      if (override.inlineOriginal) {
        (el as HTMLElement).style.setProperty(prop, override.inlineOriginal);
      } else {
        (el as HTMLElement).style.removeProperty(prop);
      }
    }
  }
  for (const key of keysToRemove) elOverrides.delete(key);
  if (elOverrides.size === 0) overrides.delete(el);

  // Remove undo/redo entries for this element + breakpoint
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (isBatch(entry)) {
        entry.entries = entry.entries.filter(
          (e) => !(e.el === el && parseKey(e.prop).breakpoint === breakpoint),
        );
        if (entry.entries.length === 0) stack.splice(i, 1);
      } else if (
        !isBatch(entry) && !isDomMove(entry) && !isForeign(entry) &&
        entry.el === el && parseKey(entry.prop).breakpoint === breakpoint
      ) {
        stack.splice(i, 1);
      }
    }
  }
  schedulePersist();
  notifyListeners();
}

/**
 * Reset all overrides on a single element, restoring inline styles to their
 * pre-tuning values (or removing them if there was no prior inline value).
 * Clears all undo/redo entries for the element and schedules session persistence.
 * @param el - The element whose overrides should be cleared.
 */
export function reset(el: Element): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  for (const [prop, override] of elOverrides) {
    if (override.initial !== override.current) dirtyCount--;
    // Only revert inline style for live (base-breakpoint, no-state) keys.
    if (isInlineWritable(prop)) {
      if (override.inlineOriginal) {
        (el as HTMLElement).style.setProperty(prop, override.inlineOriginal);
      } else {
        (el as HTMLElement).style.removeProperty(prop);
      }
    }
  }
  overrides.delete(el);

  // Remove all undo/redo entries for this element (handle both single and batch)
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (isBatch(entry)) {
        entry.entries = entry.entries.filter((e) => e.el !== el);
        if (entry.entries.length === 0) stack.splice(i, 1);
      } else if (!isBatch(entry) && !isDomMove(entry) && !isForeign(entry) && entry.el === el) {
        stack.splice(i, 1);
      }
    }
  }
  schedulePersist();
  notifyListeners();
}

/**
 * Reset every override across all elements. Removes all inline styles, clears
 * the overrides map, empties the undo/redo stacks, and wipes the persisted
 * session from localStorage.
 */
export function resetAll(): void {
  for (const [el, props] of overrides) {
    for (const [prop, override] of props) {
      if (isInlineWritable(prop)) {
        if (override.inlineOriginal) {
          (el as HTMLElement).style.setProperty(prop, override.inlineOriginal);
        } else {
          (el as HTMLElement).style.removeProperty(prop);
        }
      }
    }
  }
  overrides.clear();
  clearedOverrides.clear();
  customPropertyOverrides.clear();
  dirtyCount = 0;
  // Clear the undo/redo stacks of every dimension this reset actually clears
  // (inline/state/class/batch/dom-move/custom-prop) — but PRESERVE foreign (mode)
  // entries. A session-wide style reset does NOT clear mode overrides (ADR-0004),
  // so their undo steps must survive too, else a surviving mode override would be
  // permanently un-undoable (ADR-0006). Foreign revert closures act on the mode
  // store, not the now-cleared inline map, so they stay valid.
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!isForeign(stack[i])) stack.splice(i, 1);
    }
  }
  // Session-attached classes (class creation, audit 05) are unsaved session
  // state too: Discard (CloseWarningBar → styleEngine.resetAll → here) must
  // remove the attached class from the DOM along with every other override.
  detachSessionClasses();
  clearPersistedSession();
  notifyListeners();
}

/**
 * Returns the diff for the given element — what changed from initial.
 * Used by the footer's Copy and Save buttons.
 */
export function diff(el: Element): DiffEntry[] {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return [];

  const entries: DiffEntry[] = [];
  for (const [key, { initial, current }] of elOverrides) {
    if (initial !== current) {
      const { breakpoint, state, prop } = parseKey(key);
      entries.push({
        prop,
        from: initial,
        to: current,
        state: state === "none" ? undefined : state,
        breakpoint: breakpoint === BASE_BREAKPOINT ? undefined : breakpoint,
      });
    }
  }
  return entries;
}

/**
 * Returns all diffs across all elements.
 */
export function diffAll(): Array<{ el: Element; changes: DiffEntry[] }> {
  const result: Array<{ el: Element; changes: DiffEntry[] }> = [];
  for (const [el] of overrides) {
    const changes = diff(el);
    if (changes.length > 0) {
      result.push({ el, changes });
    }
  }
  return result;
}

/** Check if a CSS value string is numerically zero (e.g. "0px", "0em", "0%", "0"). */
function isZeroValue(v: string): boolean {
  if (!v || v === "none" || v === "auto" || v === "normal") return false;
  const n = parseFloat(v);
  return n === 0 && !isNaN(n);
}

/**
 * Check if a transition value is a no-op default.
 * Browsers return "all" or "all 0s ease 0s" for elements with no explicit
 * transition — these are semantically equivalent to "none".
 */
function isDefaultTransition(v: string): boolean {
  if (!v || v === "none" || v === "all") return true;
  // "all 0s ease 0s" — normalize whitespace and check
  const trimmed = v.replace(/\s+/g, " ").trim();
  return trimmed === "all 0s ease 0s";
}

/**
 * Check if a specific CSS property on an element has been modified from its
 * initial value. Used for amber "dirty" highlighting on slider fills.
 * Treats semantically-equivalent values (zero lengths, default transitions)
 * as unchanged.
 * @param el - The element to inspect.
 * @param prop - The CSS property name to check.
 * @returns `true` if the property has a meaningful change from its initial value.
 */
export function isDirty(el: Element, prop: string): boolean {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return false;
  const entry = elOverrides.get(prop);
  if (!entry) return false;
  // Fast path: identical strings
  if (entry.initial === entry.current) return false;
  // Defense in depth: "0px" vs "0em" etc. are semantically equal
  if (isZeroValue(entry.initial) && isZeroValue(entry.current)) return false;
  // "all" / "all 0s ease 0s" / "none" are all no-op transitions
  if (prop === "transition" && isDefaultTransition(entry.initial) && isDefaultTransition(entry.current)) return false;
  return true;
}

/**
 * Get the initial (pre-tuning) value for a property.
 * Returns null if the property hasn't been touched.
 */
export function getInitial(el: Element, prop: string): string | null {
  return overrides.get(el)?.get(prop)?.initial ?? null;
}

/**
 * HMR auto-reset: after source files change and HMR reloads styles,
 * check if any inline overrides are now redundant (real styles caught up).
 * Remove those overrides so the amber indicators clear.
 *
 * Batches DOM reads/writes to avoid N forced reflows:
 * 1. Remove all inline overrides (write phase)
 * 2. Read all computed values at once (single reflow)
 * 3. Restore non-redundant overrides (write phase)
 *
 * Returns the number of overrides that were auto-cleared.
 */
export function clearRedundantOverrides(): number {
  // Collect all (element, prop, current) tuples — skip state-keyed overrides
  // (state overrides are managed via the <style> tag, not inline)
  const entries: Array<{ el: Element; prop: string; current: string }> = [];
  for (const [el, props] of overrides) {
    // Skip detached elements: getComputedStyle on a disconnected node returns
    // "" for every property, which would make the comparison below always
    // fail and pointlessly re-apply inline styles to dead nodes.
    if (!el.isConnected) continue;
    for (const [prop, { current }] of props) {
      if (!isInlineWritable(prop)) continue; // skip state- and breakpoint-keyed (not inline)
      entries.push({ el, prop, current });
    }
  }
  if (entries.length === 0) return 0;

  // Phase 1: Remove all inline overrides (batched writes)
  for (const { el, prop } of entries) {
    (el as HTMLElement).style.removeProperty(prop);
  }

  // Phase 2: Read all computed values (single reflow per element)
  const computedCache = new Map<Element, CSSStyleDeclaration>();
  const realValues: string[] = [];
  for (const { el, prop } of entries) {
    if (!computedCache.has(el)) {
      computedCache.set(el, getComputedStyle(el));
    }
    realValues.push(computedCache.get(el)!.getPropertyValue(prop).trim());
  }

  // Phase 3: Restore non-redundant overrides (batched writes)
  let cleared = 0;
  for (let i = 0; i < entries.length; i++) {
    const { el, prop, current } = entries[i];
    const real = realValues[i];
    const currentTrimmed = current.trim();

    if (
      real === currentTrimmed ||
      parseFloat(real) === parseFloat(currentTrimmed)
    ) {
      // Real styles caught up — remove override permanently.
      // Stash it in clearedOverrides so undo/redo can recover the value.
      const removed = overrides.get(el)?.get(prop);
      if (removed) {
        if (removed.initial !== removed.current) dirtyCount--;
        if (!clearedOverrides.has(el)) clearedOverrides.set(el, new Map());
        clearedOverrides.get(el)!.set(prop, { ...removed });
      }
      overrides.get(el)?.delete(prop);
      cleared++;
    } else {
      // Real styles didn't match — restore the override
      (el as HTMLElement).style.setProperty(prop, current, "important");
    }
  }

  // Clean up empty override maps
  for (const [el, props] of overrides) {
    if (props.size === 0) overrides.delete(el);
  }

  if (cleared > 0) {
    // Persist the post-clear state so redundant overrides don't resurrect
    // from localStorage as phantom "changes" on the next reload (issue #72).
    schedulePersist();
    notifyListeners();
  }
  return cleared;
}

/**
 * Strip all inline overrides from the DOM (for visual diff).
 * Does NOT clear the overrides map — values stay tracked for restore.
 * Returns true if any overrides were stripped.
 */
export function stripAllOverrides(): boolean {
  let stripped = false;
  for (const [el, props] of overrides) {
    for (const [prop] of props) {
      if (isInlineWritable(prop)) {
        (el as HTMLElement).style.removeProperty(prop);
      }
      stripped = true;
    }
  }
  return stripped;
}

/**
 * Restore all tracked overrides back to the DOM (after diff peek).
 * Re-applies the current value with !important.
 */
export function restoreAllOverrides(): void {
  for (const [el, props] of overrides) {
    for (const [prop, { current }] of props) {
      if (isInlineWritable(prop)) {
        (el as HTMLElement).style.setProperty(prop, current, "important");
      }
    }
  }
}

/**
 * Get count of active overrides for an element.
 */
export function overrideCount(el: Element): number {
  return overrides.get(el)?.size ?? 0;
}

/**
 * Check if any overrides exist at all.
 */
export function hasOverrides(): boolean {
  return overrides.size > 0;
}

/**
 * Total number of property overrides across all elements.
 */
export function totalOverrideCount(): number {
  return dirtyCount;
}

/**
 * Number of distinct elements that have at least one active override.
 */
export function touchedElementCount(): number {
  let count = 0;
  for (const [, props] of overrides) {
    for (const [, { initial, current }] of props) {
      if (initial !== current) { count++; break; }
    }
  }
  return count;
}

// --- Per-property reset ---

/**
 * Reset a single property on an element back to its initial value.
 * Removes the inline override and cleans up tracking.
 */
export function resetProp(el: Element, prop: string): void {
  const elOverrides = overrides.get(el);
  const entry = elOverrides?.get(prop);

  // Save the initial value before deleting — needed for cascade logic below.
  const revertValue = entry?.initial;

  if (entry && entry.initial !== entry.current) dirtyCount--;
  if (elOverrides && isInlineWritable(prop)) {
    if (entry?.inlineOriginal) {
      (el as HTMLElement).style.setProperty(prop, entry.inlineOriginal);
    } else {
      (el as HTMLElement).style.removeProperty(prop);
    }
  }
  if (elOverrides) {
    elOverrides.delete(prop);
    if (elOverrides.size === 0) overrides.delete(el);
  }
  // Remove undo/redo entries for this prop (handle both single and batch)
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (isBatch(entry)) {
        entry.entries = entry.entries.filter((e) => !(e.el === el && e.prop === prop));
        if (entry.entries.length === 0) stack.splice(i, 1);
      } else if (!isBatch(entry) && !isDomMove(entry) && !isForeign(entry) && entry.el === el && entry.prop === prop) {
        stack.splice(i, 1);
      }
    }
  }

  // Cascade-reset: when display reverts to a non-flex/non-grid value,
  // clear stale flex/grid layout overrides whose controls are no longer visible.
  if (prop === "display" && revertValue !== undefined) {
    const flexGridValues = new Set(["flex", "inline-flex", "grid", "inline-grid"]);
    if (!flexGridValues.has(revertValue)) {
      const cascadeProps = [
        "flex-direction", "justify-content", "align-items", "justify-items",
        "align-content", "flex-wrap", "gap", "row-gap", "column-gap",
      ];
      const currentOverrides = overrides.get(el);
      if (currentOverrides) {
        for (const cp of cascadeProps) {
          if (currentOverrides.has(cp)) {
            const cpEntry = currentOverrides.get(cp)!;
            if (cpEntry.initial !== cpEntry.current) dirtyCount--;
            if (cpEntry.inlineOriginal) {
              (el as HTMLElement).style.setProperty(cp, cpEntry.inlineOriginal);
            } else {
              (el as HTMLElement).style.removeProperty(cp);
            }
            currentOverrides.delete(cp);
            // Remove undo entries for cascaded prop
            for (let i = undoStack.length - 1; i >= 0; i--) {
              const ue = undoStack[i];
              if (isBatch(ue)) {
                ue.entries = ue.entries.filter((e) => !(e.el === el && e.prop === cp));
                if (ue.entries.length === 0) undoStack.splice(i, 1);
              } else if (!isBatch(ue) && !isDomMove(ue) && !isForeign(ue) && ue.el === el && ue.prop === cp) {
                undoStack.splice(i, 1);
              }
            }
          }
        }
        if (currentOverrides.size === 0) overrides.delete(el);
      }
    }
  }

  schedulePersist();
  notifyListeners();
}

/**
 * Reset a CSS property and read back its computed value as a number.
 * Shared helper to avoid duplicating resetProp + getComputedStyle + parseFloat
 * across every section component.
 */
export function resetAndReadNum(element: Element, prop: string): number {
  resetProp(element, prop);
  return parseFloat(getComputedStyle(element).getPropertyValue(prop).trim()) || 0;
}

/**
 * Reset a CSS property and read back its computed value as a string.
 * String counterpart to resetAndReadNum — avoids duplicating the
 * resetProp + getComputedStyle + trim pattern in every section component.
 */
export function resetAndReadStr(element: Element, prop: string): string {
  resetProp(element, prop);
  return getComputedStyle(element).getPropertyValue(prop).trim();
}

// --- Transition application ---

// --- CSS Custom Property Overrides ---

/**
 * Track custom property overrides separately from element overrides.
 * Key: variable name (e.g. "--color-primary")
 * Value: { scope, initial, current }
 */
type CustomPropOverride = {
  scope: Element;
  initial: string;
  current: string;
};

const customPropertyOverrides = new Map<string, CustomPropOverride>();

/**
 * Apply a CSS custom property change on its definition scope.
 * e.g. set --color-primary on :root (document.documentElement)
 */
export function applyCustomProperty(
  scope: Element,
  name: string,
  value: string
): void {
  // New action invalidates redo history (standard undo/redo semantics) —
  // same as applyInlineStyle and removeCustomProperty (issue #71).
  if (redoStack.length > 0) redoStack.length = 0;

  // Read initial value ONCE before any DOM mutation
  let initial: string | undefined;
  if (!customPropertyOverrides.has(name)) {
    initial = getComputedStyle(scope).getPropertyValue(name).trim();
    customPropertyOverrides.set(name, { scope, initial, current: value });
    const undoEntry: SingleUndoEntry = { el: scope, prop: name, prev: initial, state: "none" };
    if (batchDepth > 0) {
      batchEntries.push(undoEntry);
    } else {
      undoStack.push(undoEntry);
    }
  } else {
    const existing = customPropertyOverrides.get(name)!;
    initial = existing.initial;
    const undoEntry: SingleUndoEntry = { el: scope, prop: name, prev: existing.current, state: "none" };
    if (batchDepth > 0) {
      batchEntries.push(undoEntry);
    } else {
      undoStack.push(undoEntry);
    }
    existing.current = value;
  }

  (scope as HTMLElement).style.setProperty(name, value);

  // Also track in the regular overrides map so diff/session/save work
  if (!overrides.has(scope)) overrides.set(scope, new Map());
  const scopeOverrides = overrides.get(scope)!;
  if (!scopeOverrides.has(name)) {
    scopeOverrides.set(name, { initial: initial || "", current: value, inlineOriginal: null });
    if ((initial || "") !== value) dirtyCount++;
  } else {
    const existing = scopeOverrides.get(name)!;
    const wasDirty = existing.initial !== existing.current;
    existing.current = value;
    const isDirtyNow = existing.initial !== value;
    if (!wasDirty && isDirtyNow) dirtyCount++;
    else if (wasDirty && !isDirtyNow) dirtyCount--;
  }

  schedulePersist();
  notifyListeners();
}

/**
 * Add a new CSS custom property with validation.
 * Name must start with `--` and match /^--[\w-]+$/.
 */
export function addCustomProperty(
  scope: Element,
  name: string,
  value: string
): void {
  if (!/^--[\w-]+$/.test(name)) {
    throw new Error(`Invalid custom property name: "${name}". Must match /^--[\\w-]+$/.`);
  }
  applyCustomProperty(scope, name, value);
}

/**
 * Remove a CSS custom property from its scope element.
 * Pushes an undo entry so the removal can be reversed.
 * Respects batchDepth so it works inside beginBatch/endBatch.
 */
export function removeCustomProperty(scope: Element, name: string): void {
  // Read current value from tracking or computed style
  const tracked = customPropertyOverrides.get(name);
  const currentValue = tracked?.current ?? getComputedStyle(scope).getPropertyValue(name).trim();

  // New action clears redo
  if (redoStack.length > 0) redoStack.length = 0;

  // Remove from DOM
  (scope as HTMLElement).style.removeProperty(name);

  // Remove from customPropertyOverrides
  customPropertyOverrides.delete(name);

  // Remove from overrides map and adjust dirtyCount
  const scopeOverrides = overrides.get(scope);
  if (scopeOverrides) {
    const entry = scopeOverrides.get(name);
    if (entry && entry.initial !== entry.current) dirtyCount--;
    scopeOverrides.delete(name);
    if (scopeOverrides.size === 0) overrides.delete(scope);
  }

  // Push undo entry — route to batchEntries when inside a batch
  const undoEntry: SingleUndoEntry = { el: scope, prop: name, prev: currentValue, state: "none" };
  if (batchDepth > 0) {
    batchEntries.push(undoEntry);
  } else {
    undoStack.push(undoEntry);
    if (undoStack.length > MAX_UNDO) {
      undoStack.splice(0, undoStack.length - MAX_UNDO);
    }
  }

  schedulePersist();
  notifyListeners();
}

/**
 * Rename a CSS custom property. Wraps remove + apply in a batch for single undo.
 * Optionally accepts a `replaceRefs` callback to update var() references.
 * Returns the number of references updated (0 if no callback provided).
 */
export function renameCustomProperty(
  scope: Element,
  oldName: string,
  newName: string,
  replaceRefs?: (oldName: string, newName: string) => number
): number {
  // Read current value before any mutations
  const tracked = customPropertyOverrides.get(oldName);
  const value = tracked?.current ?? getComputedStyle(scope).getPropertyValue(oldName).trim();

  beginBatch();
  removeCustomProperty(scope, oldName);
  applyCustomProperty(scope, newName, value);
  endBatch();

  // Replace var() references if callback provided
  if (replaceRefs) {
    return replaceRefs(oldName, newName);
  }
  return 0;
}

/**
 * Check if a custom property has been modified.
 */
export function isCustomPropertyDirty(name: string): boolean {
  const entry = customPropertyOverrides.get(name);
  if (!entry) return false;
  return entry.initial !== entry.current;
}

// --- DOM Move (Navigator drag-to-reorder) ---

/**
 * Push a DOM move operation onto the undo stack.
 * Used by NavigatorPanel after a drag-to-reorder drop.
 */
export function pushDomMove(result: { undo: () => void; redo: () => void }): void {
  // New action invalidates redo history
  if (redoStack.length > 0) redoStack.length = 0;
  undoStack.push({ type: 'dom-move', undo: result.undo, redo: result.redo });
  if (undoStack.length > MAX_UNDO) {
    undoStack.splice(0, undoStack.length - MAX_UNDO);
  }
  notifyListeners();
}

// --- Foreign-op undo seam (modeOverrides registers through this) ---
//
// A foreign subsystem (today: CSS-variable mode overrides) records its undo steps
// on apply.ts's ONE temporal stack instead of running a parallel stack, so Cmd+Z
// reverses edits across every dimension in true reverse-time order. apply.ts stays
// the single owner of temporal order; modeOverrides depends on apply (one-way — no
// import cycle). RFC #14 Increment 4a — see ADR-0006.

/** When true, consecutive `pushForeignUndo` calls with the same `coalesceKey`
 *  merge into the last foreign entry (one undo step per drag/session). */
let foreignCoalescing = false;
/** True until the FIRST push of the current coalesce session lands. Without it,
 *  a new drag's first push would merge into the PREVIOUS drag's entry whenever
 *  they share a `coalesceKey` (same selector+var) — collapsing two separate
 *  drags into one undo step, and (worse) reverting through the earlier drag's
 *  captured `prev`. Resetting it per `beginForeignCoalesce` cuts the chain. */
let foreignCoalesceFresh = false;

/** Begin coalescing foreign undo steps (call before a rapid-fire drag). */
export function beginForeignCoalesce(): void {
  foreignCoalescing = true;
  foreignCoalesceFresh = true;
}

/** End coalescing foreign undo steps. */
export function endForeignCoalesce(): void { foreignCoalescing = false; }

/**
 * Register a foreign subsystem's undo step on the ONE temporal stack. `revert`
 * undoes the step, `reapply` redoes it. While coalescing, a step whose
 * `coalesceKey` matches the top foreign entry — AND that was pushed earlier in
 * the SAME coalesce session — merges into it (keeps the original `revert`,
 * advances `reapply`) so a whole drag is one undo. The first push of a session
 * never merges (so separate drags stay separate). A fresh step clears the redo
 * stack (standard undo semantics).
 */
export function pushForeignUndo(step: { revert: () => void; reapply: () => void; coalesceKey?: string }): void {
  const top = undoStack[undoStack.length - 1];
  if (
    foreignCoalescing && !foreignCoalesceFresh && step.coalesceKey != null &&
    top && isForeign(top) && top.coalesceKey === step.coalesceKey
  ) {
    top.reapply = step.reapply; // keep the original revert; advance the forward value
    return;
  }
  foreignCoalesceFresh = false; // the first push of this coalesce session has landed
  if (redoStack.length > 0) redoStack.length = 0;
  undoStack.push({ type: 'foreign', revert: step.revert, reapply: step.reapply, coalesceKey: step.coalesceKey });
  if (undoStack.length > MAX_UNDO) {
    undoStack.splice(0, undoStack.length - MAX_UNDO);
  }
}

/** Drop every foreign entry from both stacks — used when a foreign subsystem
 *  resets all of its state (today only modeOverrides via resetAllModeOverrides). */
export function clearForeignUndo(): void {
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (isForeign(stack[i])) stack.splice(i, 1);
    }
  }
}

// --- Session Persistence ---

type SerializedOverride = { initial: string; current: string };
type SerializedSession = Record<string, Record<string, SerializedOverride>>;

const STORAGE_PREFIX = "__tuner_session:";
const MAX_STORAGE_BYTES = 100_000;

function storageKey(): string {
  return STORAGE_PREFIX + location.pathname;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced save to localStorage — avoids thrashing on rapid slider drags. */
function schedulePersist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistToStorage();
  }, 150);
}

function persistToStorage(): void {
  try {
    const data: SerializedSession = {};
    for (const [el, props] of overrides) {
      const selector = getStableSelector(el);
      if (!selector) continue;
      const propData: Record<string, SerializedOverride> = {};
      for (const [prop, override] of props) {
        if (override.initial !== override.current) {
          propData[prop] = { initial: override.initial, current: override.current };
        }
      }
      if (Object.keys(propData).length > 0) {
        data[selector] = propData;
      }
    }

    const json = JSON.stringify(data);
    if (json.length > MAX_STORAGE_BYTES) return; // silently skip if too large
    if (Object.keys(data).length === 0) {
      localStorage.removeItem(storageKey());
    } else {
      localStorage.setItem(storageKey(), json);
    }
  } catch {
    // localStorage unavailable or quota exceeded — silently skip
  }
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    // ignore
  }
}

/**
 * Restore overrides from localStorage.
 * Re-resolves elements by selector, re-applies inline styles.
 * Returns the number of properties restored.
 */
export function restoreSession(): number {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return 0;

    const data: SerializedSession = JSON.parse(raw);
    let restored = 0;

    for (const [selector, props] of Object.entries(data)) {
      const el = document.querySelector(selector);
      if (!el) continue; // element no longer exists on this page

      if (!overrides.has(el)) overrides.set(el, new Map());
      const elOverrides = overrides.get(el)!;

      for (const [prop, override] of Object.entries(props)) {
        // Idempotent dirtyCount update: restoreSession can run more than once
        // for the same (el, prop) — e.g. React StrictMode double-mounting the
        // overlay's restore effect — so account for an existing entry that was
        // already counted instead of unconditionally incrementing.
        const existing = elOverrides.get(prop);
        const wasDirty = existing ? existing.initial !== existing.current : false;
        elOverrides.set(prop, { initial: override.initial, current: override.current, inlineOriginal: null });
        const isDirtyNow = override.initial !== override.current;
        if (!wasDirty && isDirtyNow) dirtyCount++;
        else if (wasDirty && !isDirtyNow) dirtyCount--;

        const parsed = parseKey(prop);
        if (parsed.breakpoint !== BASE_BREAKPOINT) {
          // Non-base breakpoint: tracked in the map only — its media-gated render
          // lands with #35, so nothing to write to the live DOM here.
        } else if (parsed.state !== "none") {
          // State-keyed: notify listeners so statePreview.ts can rebuild <style> tag
          notifyStateChange(el, parsed.state, parsed.prop, override.current);
        } else {
          (el as HTMLElement).style.setProperty(prop, override.current, "important");
        }
        restored++;
      }
    }

    if (restored > 0) notifyListeners();
    return restored;
  } catch {
    clearPersistedSession();
    return 0;
  }
}
