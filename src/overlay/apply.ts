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

import { getStableSelector } from "./util";

export type Override = {
  initial: string;
  current: string;
};

export type DiffEntry = {
  prop: string;
  from: string;
  to: string;
  state?: string;
};

// --- Composite state key helpers ---

/**
 * Build a composite key encoding pseudo-class state + CSS property.
 * "none" state (default) returns just the bare property name.
 */
export function stateKey(state: string, prop: string): string {
  return state === "none" ? prop : `${state}::${prop}`;
}

/**
 * Parse a composite key back into { state, prop }.
 */
export function parseStateKey(key: string): { state: string; prop: string } {
  const idx = key.indexOf("::");
  return idx < 0 ? { state: "none", prop: key } : { state: key.slice(0, idx), prop: key.slice(idx + 2) };
}

type SingleUndoEntry = { el: Element; prop: string; prev: string; state: string; className?: string };
type BatchUndoEntry = { type: 'batch'; entries: SingleUndoEntry[] };
type UndoEntry = SingleUndoEntry | BatchUndoEntry;

function isBatch(entry: UndoEntry): entry is BatchUndoEntry {
  return 'type' in entry && entry.type === 'batch';
}

// --- Subscription API for useSyncExternalStore ---

const listeners = new Set<() => void>();

export function subscribeOverrides(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function getOverrideSnapshot(): number {
  let count = 0;
  for (const [el, props] of overrides) {
    if (!document.contains(el)) continue;
    for (const [, { initial, current }] of props) {
      if (initial !== current) count++;
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
 * Returns the number of styles pasted.
 */
export function pasteStyles(el: Element): number {
  if (styleClipboard.length === 0) return 0;
  beginBatch();
  for (const { prop, value } of styleClipboard) {
    applyInlineStyle(el, prop, value);
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

export function beginBatch(): void {
  batchDepth++;
}

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
}

// --- Public API ---

export function applyInlineStyle(
  el: Element,
  prop: string,
  value: string,
  className?: string
): void {
  if (!(el as HTMLElement).isConnected) return;

  // Determine if this is a state-keyed property (e.g. "hover::color")
  const parsed = parseStateKey(prop);
  const isStateKeyed = parsed.state !== "none";
  const cssProp = parsed.prop; // the real CSS property name

  // New action invalidates redo history (standard undo/redo semantics)
  if (redoStack.length > 0) redoStack.length = 0;

  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  if (!elOverrides.has(prop)) {
    // First time touching this prop — capture the original computed value
    const initial = getComputedStyle(el).getPropertyValue(cssProp).trim();
    elOverrides.set(prop, { initial, current: value });

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
      // Coalesce: if the last undo entry is for the same (el, prop), don't push
      // another entry — keeps the original `prev` so undo reverts the entire drag
      const lastUndo = undoStack[undoStack.length - 1];
      if (!(lastUndo && !isBatch(lastUndo) && lastUndo.el === el && lastUndo.prop === prop)) {
        undoStack.push({ el, prop, prev: existing.current, state: parsed.state, className });
      }
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

  // Only apply to inline style for non-state properties.
  // State-keyed props are applied via the <style> tag in statePreview.ts.
  if (!isStateKeyed) {
    (el as HTMLElement).style.setProperty(prop, value, "important");
  }
  schedulePersist();
  notifyListeners();
  notifyChange(el, cssProp, elOverrides.get(prop)!.initial, value);
}

export function undo(): { el: Element; prop: string } | null {
  const last = undoStack.pop();
  if (!last) return null;

  if (isBatch(last)) {
    // Build redo batch: capture current values before restoring
    const redoEntries: SingleUndoEntry[] = [];
    let result: { el: Element; prop: string } | null = null;
    for (let i = last.entries.length - 1; i >= 0; i--) {
      const { el, prop, prev, state, className } = last.entries[i];
      const isState = state !== "none";
      const cssProp = isState ? parseStateKey(prop).prop : prop;
      if (!overrides.has(el)) overrides.set(el, new Map());
      const elOverrides = overrides.get(el)!;
      let entry = elOverrides.get(prop);
      if (!entry) {
        // Override was cleared (e.g., by clearRedundantOverrides after save).
        // Re-create using the stashed cleared value if available, else computed.
        const cleared = clearedOverrides.get(el)?.get(prop);
        const baseline = cleared?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();
        entry = { initial: baseline, current: baseline };
        elOverrides.set(prop, entry);
      }

      redoEntries.push({ el, prop, prev: entry.current, state, className });

      const wasDirty = entry.initial !== entry.current;

      if (prev === entry.initial) {
        if (!isState) (el as HTMLElement).style.removeProperty(prop);
        elOverrides.delete(prop);
        if (elOverrides.size === 0) overrides.delete(el);
        if (isState) notifyStateChange(el, state, cssProp, null);
        if (className) notifyClassChange(className, prop, null);
        if (wasDirty) dirtyCount--;
      } else {
        if (!isState) (el as HTMLElement).style.setProperty(prop, prev, "important");
        entry.current = prev;
        if (isState) notifyStateChange(el, state, cssProp, prev);
        if (className) notifyClassChange(className, prop, prev);
        const isDirtyNow = entry.initial !== prev;
        if (!wasDirty && isDirtyNow) dirtyCount++;
        else if (wasDirty && !isDirtyNow) dirtyCount--;
      }
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
  const isState = state !== "none";
  const cssProp = isState ? parseStateKey(prop).prop : prop;
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  let entry = elOverrides.get(prop);
  if (!entry) {
    // Override was cleared (e.g., by clearRedundantOverrides after save).
    // Re-create using the stashed cleared value if available, else computed.
    const cleared = clearedOverrides.get(el)?.get(prop);
    const baseline = cleared?.current ?? getComputedStyle(el).getPropertyValue(cssProp).trim();
    entry = { initial: baseline, current: baseline };
    elOverrides.set(prop, entry);
  }

  // Capture forward state for redo before restoring
  redoStack.push({ el, prop, prev: entry.current, state, className });

  const wasDirty = entry.initial !== entry.current;

  if (prev === entry.initial) {
    // Undoing back to original — remove override entirely
    if (!isState) (el as HTMLElement).style.removeProperty(prop);
    elOverrides.delete(prop);
    if (elOverrides.size === 0) overrides.delete(el);
    if (isState) notifyStateChange(el, state, cssProp, null);
    if (className) notifyClassChange(className, prop, null);
    if (wasDirty) dirtyCount--;
  } else {
    if (!isState) (el as HTMLElement).style.setProperty(prop, prev, "important");
    entry.current = prev;
    if (isState) notifyStateChange(el, state, cssProp, prev);
    if (className) notifyClassChange(className, prop, prev);
    const isDirtyNow = entry.initial !== prev;
    if (!wasDirty && isDirtyNow) dirtyCount++;
    else if (wasDirty && !isDirtyNow) dirtyCount--;
  }

  schedulePersist();
  notifyListeners();
  return { el, prop };
}

export function redo(): { el: Element; prop: string } | null {
  const last = redoStack.pop();
  if (!last) return null;

  if (isBatch(last)) {
    // Re-apply batch entries and push an undo batch
    const undoEntries: SingleUndoEntry[] = [];
    let result: { el: Element; prop: string } | null = null;
    for (const { el, prop, prev: redoValue, state, className } of last.entries) {
      const isState = state !== "none";
      const cssProp = isState ? parseStateKey(prop).prop : prop;
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
        elOverrides.set(prop, { initial, current: redoValue });
        if (initial !== redoValue) dirtyCount++;
      }
      if (!isState) {
        (el as HTMLElement).style.setProperty(prop, redoValue, "important");
      } else {
        notifyStateChange(el, state, cssProp, redoValue);
      }
      if (className) notifyClassChange(className, prop, redoValue);
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
  const isState = state !== "none";
  const cssProp = isState ? parseStateKey(prop).prop : prop;
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
    elOverrides.set(prop, { initial, current: redoValue });
    if (initial !== redoValue) dirtyCount++;
  }
  if (!isState) {
    (el as HTMLElement).style.setProperty(prop, redoValue, "important");
  } else {
    notifyStateChange(el, state, cssProp, redoValue);
  }
  if (className) notifyClassChange(className, prop, redoValue);

  schedulePersist();
  notifyListeners();
  return { el, prop };
}

/**
 * Clear all composite-keyed overrides for a specific state on an element.
 * Called by Footer.tsx handleReset to keep apply.ts in sync with statePreview.ts.
 */
export function resetStateOverrides(el: Element, state: string): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  const keysToRemove: string[] = [];
  for (const [key, override] of elOverrides) {
    const parsed = parseStateKey(key);
    if (parsed.state === state) {
      keysToRemove.push(key);
      if (override.initial !== override.current) dirtyCount--;
    }
  }
  for (const key of keysToRemove) {
    elOverrides.delete(key);
  }
  if (elOverrides.size === 0) overrides.delete(el);

  // Also remove undo/redo entries for this element+state
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (isBatch(entry)) {
        entry.entries = entry.entries.filter(e => !(e.el === el && e.state === state));
        if (entry.entries.length === 0) stack.splice(i, 1);
      } else if (entry.el === el && entry.state === state) {
        stack.splice(i, 1);
      }
    }
  }

  notifyListeners();
}

export function reset(el: Element): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  for (const [prop, { initial, current }] of elOverrides) {
    if (initial !== current) dirtyCount--;
    // Only remove inline style for non-state-keyed properties
    if (!prop.includes("::")) {
      (el as HTMLElement).style.removeProperty(prop);
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
      } else if (!isBatch(entry) && entry.el === el) {
        stack.splice(i, 1);
      }
    }
  }
  schedulePersist();
  notifyListeners();
}

export function resetAll(): void {
  for (const [el, props] of overrides) {
    for (const [prop] of props) {
      if (!prop.includes("::")) {
        (el as HTMLElement).style.removeProperty(prop);
      }
    }
  }
  overrides.clear();
  clearedOverrides.clear();
  dirtyCount = 0;
  // Clear entire undo/redo stack
  undoStack.length = 0;
  redoStack.length = 0;
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
      const { state, prop } = parseStateKey(key);
      entries.push({ prop, from: initial, to: current, state: state === "none" ? undefined : state });
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

/**
 * Check if a specific property on an element has been modified.
 * Used for amber "dirty" highlighting on slider fills.
 */
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
    for (const [prop, { current }] of props) {
      if (prop.includes("::")) continue; // skip state-keyed
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

  if (cleared > 0) notifyListeners();
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
      if (!prop.includes("::")) {
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
      if (!prop.includes("::")) {
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
  if (!elOverrides) return;
  const entry = elOverrides.get(prop);
  if (entry && entry.initial !== entry.current) dirtyCount--;
  if (!prop.includes("::")) {
    (el as HTMLElement).style.removeProperty(prop);
  }
  elOverrides.delete(prop);
  if (elOverrides.size === 0) overrides.delete(el);
  // Remove undo entries for this prop (handle both single and batch)
  for (let i = undoStack.length - 1; i >= 0; i--) {
    const entry = undoStack[i];
    if (isBatch(entry)) {
      entry.entries = entry.entries.filter((e) => !(e.el === el && e.prop === prop));
      if (entry.entries.length === 0) undoStack.splice(i, 1);
    } else if (!isBatch(entry) && entry.el === el && entry.prop === prop) {
      undoStack.splice(i, 1);
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
    const effectiveInitial = initial || value;
    scopeOverrides.set(name, { initial: effectiveInitial, current: value });
    if (effectiveInitial !== value) dirtyCount++;
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
        elOverrides.set(prop, { initial: override.initial, current: override.current });
        if (override.initial !== override.current) dirtyCount++;

        const parsed = parseStateKey(prop);
        if (parsed.state !== "none") {
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
    return 0;
  }
}
