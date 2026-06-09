/**
 * statePreview.ts — Pseudo-class style preview via <style> tag injection
 *
 * Inline styles can't target pseudo-classes (:hover, :focus, etc.).
 * This module manages a <style> tag that injects rules like:
 *
 *   .__tuner-state-preview:hover {
 *     font-size: 20px !important;
 *   }
 *
 * The temporary class `__tuner-state-preview` is added to the target
 * element so the injected rules take effect.
 *
 * Each (element, state) pair gets a unique data attribute for targeting,
 * since multiple elements may have state previews simultaneously.
 */

import type { DiffEntry } from "./apply";
import { onStateChange } from "./apply";
import { isValidCSSProp, sanitizeCSSValue } from "../../lib/css";
import { managedSheet, _readManagedSheetCss } from "./managedSheet";

const SHEET_KEY = "state-preview";

// --- Valid pseudo-class states (allowlist) ---

export const VALID_STATES = new Set([
  "hover", "focus", "active", "visited",
  "focus-within", "focus-visible", "first-child", "last-child",
]);

// --- State ---

// Key: serialized (elId, state) → Map<prop, value>
type StateKey = string;
const overrides = new Map<StateKey, Map<string, { initial: string; current: string }>>();

// Track which elements have been tagged
const taggedElements = new Set<Element>();

// Monotonic ID counter for element targeting
let nextElId = 0;
const elIdMap = new WeakMap<Element, number>();

function getElId(el: Element): number {
  let id = elIdMap.get(el);
  if (id == null) {
    id = nextElId++;
    elIdMap.set(el, id);
  }
  return id;
}

function stateKey(el: Element, state: string): StateKey {
  return `${getElId(el)}:${state}`;
}

/** CSS attribute selector for a specific element */
function elAttrSelector(el: Element): string {
  const id = getElId(el);
  return `[data-tuner-state-id="${id}"]`;
}

// --- Managed sheet ---

/** Test-only read of the state-preview sheet's serialized CSS, or null if never registered. */
export function getStateStyleCss(): string | null {
  return _readManagedSheetCss(SHEET_KEY);
}

// --- Rebuild (with rAF debounce for hot-path calls) ---

let rebuildScheduled = false;

function scheduleRebuild(): void {
  if (rebuildScheduled) return;
  rebuildScheduled = true;
  requestAnimationFrame(() => {
    rebuildScheduled = false;
    rebuildStyleTag();
  });
}

/** Flush any pending rAF-scheduled rebuild synchronously. Exposed for tests. */
export function flushScheduledRebuild(): void {
  if (rebuildScheduled) {
    rebuildScheduled = false;
    rebuildStyleTag();
  }
}

function rebuildStyleTag(): void {
  const rules: string[] = [];

  // Group by (element, state)
  const grouped = new Map<string, { el: Element; state: string; props: Map<string, { initial: string; current: string }> }>();

  for (const [key, props] of overrides) {
    // Parse back the element and state from overrides
    // We need the element reference — store it alongside
    const meta = overrideMeta.get(key);
    if (!meta) continue;
    grouped.set(key, { el: meta.el, state: meta.state, props });
  }

  for (const [, { el, state, props }] of grouped) {
    const selector = `${elAttrSelector(el)}.__tuner-state-preview:${state}`;
    const declarations = Array.from(props.entries())
      .filter(([prop]) => isValidCSSProp(prop))
      .map(([prop, { current }]) => `  ${prop}: ${sanitizeCSSValue(current)} !important;`)
      .join("\n");
    if (!declarations) continue;
    rules.push(`${selector} {\n${declarations}\n}`);
  }

  managedSheet(SHEET_KEY).replace(rules.join("\n\n"));
}

// Track element + state metadata for each override key
const overrideMeta = new Map<StateKey, { el: Element; state: string }>();

// --- Public API ---

/**
 * Apply a pseudo-class style preview. Injects a CSS rule into a managed
 * <style> tag and adds the preview class to the element.
 */
export function applyStateStyle(
  el: Element,
  state: string,
  prop: string,
  value: string
): void {
  if (!VALID_STATES.has(state)) return;

  const key = stateKey(el, state);

  // Ensure element has the targeting attribute + preview class
  if (!taggedElements.has(el)) {
    (el as HTMLElement).setAttribute("data-tuner-state-id", String(getElId(el)));
    taggedElements.add(el);
  }
  el.classList.add("__tuner-state-preview");

  // Track override
  if (!overrides.has(key)) {
    overrides.set(key, new Map());
    overrideMeta.set(key, { el, state });
  }
  const props = overrides.get(key)!;
  if (!props.has(prop)) {
    // Capture initial (we can't read the pseudo-class computed value, so use "")
    props.set(prop, { initial: "", current: value });
  } else {
    props.get(prop)!.current = value;
  }

  scheduleRebuild();
}

/**
 * Remove a single property from a state preview.
 */
export function removeStateStyle(
  el: Element,
  state: string,
  prop: string
): void {
  if (!VALID_STATES.has(state)) return;

  const key = stateKey(el, state);
  const props = overrides.get(key);
  if (!props) return;

  props.delete(prop);
  if (props.size === 0) {
    overrides.delete(key);
    overrideMeta.delete(key);
  }

  // Check if this element has ANY remaining state overrides
  const elId = getElId(el);
  let hasAny = false;
  for (const k of overrides.keys()) {
    if (k.startsWith(`${elId}:`)) {
      hasAny = true;
      break;
    }
  }
  if (!hasAny) {
    el.classList.remove("__tuner-state-preview");
  }

  rebuildStyleTag();
}

/**
 * Reset all overrides for an element + state.
 */
export function resetStateStyles(el: Element, state: string): void {
  const key = stateKey(el, state);
  overrides.delete(key);
  overrideMeta.delete(key);

  // Check if this element has ANY remaining state overrides
  const elId = getElId(el);
  let hasAny = false;
  for (const k of overrides.keys()) {
    if (k.startsWith(`${elId}:`)) {
      hasAny = true;
      break;
    }
  }
  if (!hasAny) {
    el.classList.remove("__tuner-state-preview");
  }

  rebuildStyleTag();
}

/**
 * Get the diff for state-specific overrides on an element.
 * Returns DiffEntry[] compatible with the commit pipeline.
 */
export function diffState(el: Element, state: string): DiffEntry[] {
  const key = stateKey(el, state);
  const props = overrides.get(key);
  if (!props) return [];

  const entries: DiffEntry[] = [];
  for (const [prop, { initial, current }] of props) {
    entries.push({ prop, from: initial, to: current });
  }
  return entries;
}

/**
 * Clean up everything — remove the <style> tag, preview classes, and tracking data.
 */
export function destroyStateStyles(): void {
  // Cancel any pending debounced rebuild
  rebuildScheduled = false;

  // Remove preview class and data attribute from all tagged elements
  for (const el of taggedElements) {
    el.classList.remove("__tuner-state-preview");
    (el as HTMLElement).removeAttribute("data-tuner-state-id");
  }
  taggedElements.clear();

  // Dispose managed sheet
  managedSheet(SHEET_KEY).dispose();

  // Clear tracking
  overrides.clear();
  overrideMeta.clear();
}

// --- Sync with apply.ts undo/redo ---

/**
 * Register a listener on apply.ts so that undo/redo of state-keyed entries
 * updates the <style> tag. Returns an unsubscribe function.
 */
export function syncWithApplyUndoRedo(): () => void {
  return onStateChange(({ el, state, prop, value }) => {
    if (value !== null) {
      applyStateStyle(el, state, prop, value);
    } else {
      removeStateStyle(el, state, prop);
    }
  });
}
