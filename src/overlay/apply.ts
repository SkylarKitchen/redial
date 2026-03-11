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

// --- State ---

const overrides = new Map<Element, Map<string, Override>>();
const undoStack: UndoEntry[] = [];
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
      if (!(lastUndo && !('type' in lastUndo) && lastUndo.el === el && lastUndo.prop === prop)) {
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
}

export function undo(): { el: Element; prop: string } | null {
  const last = undoStack.pop();
  if (!last) return null;

  const { el, prop, prev } = last;
  const elOverrides = overrides.get(el);
  if (!elOverrides) return null;

  const entry = elOverrides.get(prop);
  if (!entry) return null;

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
  return { el, prop };
}

export function reset(el: Element): void {
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  for (const [prop] of elOverrides) {
    (el as HTMLElement).style.removeProperty(prop);
  }
  overrides.delete(el);

  // Remove all undo entries for this element
  for (let i = undoStack.length - 1; i >= 0; i--) {
    if (undoStack[i].el === el) {
      undoStack.splice(i, 1);
    }
  }
  schedulePersist();
}

export function resetAll(): void {
  for (const [el] of overrides) {
    // Inline the reset logic to avoid double-persist per element
    const elOverrides = overrides.get(el);
    if (!elOverrides) continue;
    for (const [prop] of elOverrides) {
      (el as HTMLElement).style.removeProperty(prop);
    }
    overrides.delete(el);
    for (let i = undoStack.length - 1; i >= 0; i--) {
      if (undoStack[i].el === el) {
        undoStack.splice(i, 1);
      }
    }
  }
  clearPersistedSession();
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
 * Returns the number of overrides that were auto-cleared.
 */
export function clearRedundantOverrides(): number {
  let cleared = 0;

  for (const [el, props] of overrides) {
    for (const [prop, { current }] of props) {
      // Temporarily remove our inline override to see the real computed value
      (el as HTMLElement).style.removeProperty(prop);
      const real = getComputedStyle(el).getPropertyValue(prop).trim();
      const currentTrimmed = current.trim();

      if (
        real === currentTrimmed ||
        parseFloat(real) === parseFloat(currentTrimmed)
      ) {
        // Real styles caught up — remove override permanently
        props.delete(prop);
        cleared++;
      } else {
        // Real styles didn't match — restore the override
        (el as HTMLElement).style.setProperty(prop, current, "important");
      }
    }

    if (props.size === 0) overrides.delete(el);
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
  // Remove undo entries for this prop
  for (let i = undoStack.length - 1; i >= 0; i--) {
    if (undoStack[i].el === el && undoStack[i].prop === prop) {
      undoStack.splice(i, 1);
    }
  }
  schedulePersist();
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
  if (!customPropertyOverrides.has(name)) {
    const initial = getComputedStyle(scope).getPropertyValue(name).trim();
    customPropertyOverrides.set(name, { scope, initial, current: value });
    undoStack.push({ el: scope, prop: name, prev: initial });
  } else {
    const existing = customPropertyOverrides.get(name)!;
    undoStack.push({ el: scope, prop: name, prev: existing.current });
    existing.current = value;
  }

  (scope as HTMLElement).style.setProperty(name, value);

  // Also track in the regular overrides map so diff/session/save work
  if (!overrides.has(scope)) overrides.set(scope, new Map());
  const scopeOverrides = overrides.get(scope)!;
  if (!scopeOverrides.has(name)) {
    const initial = getComputedStyle(scope).getPropertyValue(name).trim() || value;
    scopeOverrides.set(name, { initial, current: value });
  } else {
    scopeOverrides.get(name)!.current = value;
  }

  schedulePersist();
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

    return restored;
  } catch {
    return 0;
  }
}
