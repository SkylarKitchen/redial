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
};

type SingleUndoEntry = { el: Element; prop: string; prev: string };
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
  return totalOverrideCount();
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

// --- State ---

const overrides = new Map<Element, Map<string, Override>>();

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
  value: string
): void {
  if (!(el as HTMLElement).isConnected) return;

  // New action invalidates redo history (standard undo/redo semantics)
  if (redoStack.length > 0) redoStack.length = 0;

  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  if (!elOverrides.has(prop)) {
    // First time touching this prop — capture the original computed value
    const initial = getComputedStyle(el).getPropertyValue(prop).trim();
    elOverrides.set(prop, { initial, current: value });

    if (batchDepth > 0) {
      // In batch mode: collect undo entries, only first touch per (el, prop)
      if (!batchEntries.some((e) => e.el === el && e.prop === prop)) {
        batchEntries.push({ el, prop, prev: initial });
      }
    } else {
      undoStack.push({ el, prop, prev: initial });
    }
  } else {
    const existing = elOverrides.get(prop)!;

    if (batchDepth > 0) {
      // In batch mode: only record first touch per (el, prop)
      if (!batchEntries.some((e) => e.el === el && e.prop === prop)) {
        batchEntries.push({ el, prop, prev: existing.current });
      }
    } else {
      // Coalesce: if the last undo entry is for the same (el, prop), don't push
      // another entry — keeps the original `prev` so undo reverts the entire drag
      const lastUndo = undoStack[undoStack.length - 1];
      if (!(lastUndo && !isBatch(lastUndo) && lastUndo.el === el && lastUndo.prop === prop)) {
        undoStack.push({ el, prop, prev: existing.current });
      }
    }
    existing.current = value;
  }

  // Prevent unbounded undo stack growth in long sessions (only outside batch)
  if (batchDepth <= 0 && undoStack.length > MAX_UNDO) {
    undoStack.splice(0, undoStack.length - MAX_UNDO);
  }

  (el as HTMLElement).style.setProperty(prop, value, "important");
  schedulePersist();
  notifyListeners();
}

export function undo(): { el: Element; prop: string } | null {
  const last = undoStack.pop();
  if (!last) return null;

  if (isBatch(last)) {
    // Build redo batch: capture current values before restoring
    const redoEntries: SingleUndoEntry[] = [];
    let result: { el: Element; prop: string } | null = null;
    for (let i = last.entries.length - 1; i >= 0; i--) {
      const { el, prop, prev } = last.entries[i];
      const elOverrides = overrides.get(el);
      if (!elOverrides) continue;
      const entry = elOverrides.get(prop);
      if (!entry) continue;

      redoEntries.push({ el, prop, prev: entry.current });

      if (prev === entry.initial) {
        (el as HTMLElement).style.removeProperty(prop);
        elOverrides.delete(prop);
        if (elOverrides.size === 0) overrides.delete(el);
      } else {
        (el as HTMLElement).style.setProperty(prop, prev, "important");
        entry.current = prev;
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
  const { el, prop, prev } = single;
  const elOverrides = overrides.get(el);
  if (!elOverrides) return null;

  const entry = elOverrides.get(prop);
  if (!entry) return null;

  // Capture forward state for redo before restoring
  redoStack.push({ el, prop, prev: entry.current });

  if (prev === entry.initial) {
    // Undoing back to original — remove override entirely
    (el as HTMLElement).style.removeProperty(prop);
    elOverrides.delete(prop);
    if (elOverrides.size === 0) overrides.delete(el);
  } else {
    (el as HTMLElement).style.setProperty(prop, prev, "important");
    entry.current = prev;
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
    for (const { el, prop, prev: redoValue } of last.entries) {
      if (!overrides.has(el)) overrides.set(el, new Map());
      const elOverrides = overrides.get(el)!;
      const entry = elOverrides.get(prop);
      const currentValue = entry?.current ?? getComputedStyle(el).getPropertyValue(prop).trim();

      undoEntries.push({ el, prop, prev: currentValue });

      if (entry) {
        entry.current = redoValue;
      } else {
        const initial = getComputedStyle(el).getPropertyValue(prop).trim();
        elOverrides.set(prop, { initial, current: redoValue });
      }
      (el as HTMLElement).style.setProperty(prop, redoValue, "important");
      result = { el, prop };
    }
    if (undoEntries.length > 0) {
      undoStack.push({ type: 'batch', entries: undoEntries });
    }
    schedulePersist();
    notifyListeners();
    return result;
  }

  const { el, prop, prev: redoValue } = last as SingleUndoEntry;
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;
  const entry = elOverrides.get(prop);
  const currentValue = entry?.current ?? getComputedStyle(el).getPropertyValue(prop).trim();

  // Push undo entry for this redo
  undoStack.push({ el, prop, prev: currentValue });

  if (entry) {
    entry.current = redoValue;
  } else {
    const initial = getComputedStyle(el).getPropertyValue(prop).trim();
    elOverrides.set(prop, { initial, current: redoValue });
  }
  (el as HTMLElement).style.setProperty(prop, redoValue, "important");

  schedulePersist();
  notifyListeners();
  return { el, prop };
}

export function reset(el: Element): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  for (const [prop] of elOverrides) {
    (el as HTMLElement).style.removeProperty(prop);
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
      (el as HTMLElement).style.removeProperty(prop);
    }
  }
  overrides.clear();
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
  for (const [prop, { initial, current }] of elOverrides) {
    if (initial !== current) {
      entries.push({ prop, from: initial, to: current });
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
export function isDirty(el: Element, prop: string): boolean {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return false;
  const entry = elOverrides.get(prop);
  if (!entry) return false;
  return entry.initial !== entry.current;
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
  // Collect all (element, prop, current) tuples
  const entries: Array<{ el: Element; prop: string; current: string }> = [];
  for (const [el, props] of overrides) {
    for (const [prop, { current }] of props) {
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
      // Real styles caught up — remove override permanently
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
      (el as HTMLElement).style.removeProperty(prop);
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
      (el as HTMLElement).style.setProperty(prop, current, "important");
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
  let total = 0;
  for (const [, props] of overrides) {
    for (const [, { initial, current }] of props) {
      if (initial !== current) total++;
    }
  }
  return total;
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
  (el as HTMLElement).style.removeProperty(prop);
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

// --- Transition application ---

/**
 * Convert a spring/easing config to a CSS transition and apply it.
 * Spring params are approximated as cubic-bezier for CSS.
 */
export function applyTransition(
  el: Element,
  config: { type: string; visualDuration?: number; bounce?: number; duration?: number; ease?: number[] }
): void {
  if (config.type === "spring") {
    const duration = config.visualDuration ?? 0.3;
    const bounce = config.bounce ?? 0;
    const easing =
      bounce <= 0
        ? "ease"
        : `cubic-bezier(0.2, ${(1 + bounce).toFixed(2)}, ${(0.8 - bounce * 0.4).toFixed(2)}, 1)`;
    applyInlineStyle(el, "transition", `all ${duration}s ${easing}`);
  } else if (config.type === "easing") {
    const duration = config.duration ?? 0.3;
    const [x1, y1, x2, y2] = config.ease ?? [0.4, 0, 0.2, 1];
    applyInlineStyle(
      el,
      "transition",
      `all ${duration}s cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`
    );
  }
}

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
    undoStack.push({ el: scope, prop: name, prev: initial });
  } else {
    const existing = customPropertyOverrides.get(name)!;
    initial = existing.initial;
    undoStack.push({ el: scope, prop: name, prev: existing.current });
    existing.current = value;
  }

  (scope as HTMLElement).style.setProperty(name, value);

  // Also track in the regular overrides map so diff/session/save work
  if (!overrides.has(scope)) overrides.set(scope, new Map());
  const scopeOverrides = overrides.get(scope)!;
  if (!scopeOverrides.has(name)) {
    scopeOverrides.set(name, { initial: initial || value, current: value });
  } else {
    scopeOverrides.get(name)!.current = value;
  }

  schedulePersist();
  notifyListeners();
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
        (el as HTMLElement).style.setProperty(prop, override.current, "important");
        restored++;
      }
    }

    if (restored > 0) notifyListeners();
    return restored;
  } catch {
    return 0;
  }
}
