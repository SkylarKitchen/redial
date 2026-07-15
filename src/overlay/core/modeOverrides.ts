/**
 * modeOverrides.ts — Runtime CSS variable mode overrides.
 *
 * Owns the `managedSheet("mode-overrides")` sheet (constructable stylesheet
 * on `document.adoptedStyleSheets`, with a `<style>` fallback — see ADR-0009)
 * that holds per-selector overrides for CSS custom properties in specific
 * modes. Integrates with the panel's undo/save system via subscription API.
 *
 * Undo is NOT owned here: every mode edit registers a revert/reapply closure on
 * apply.ts's ONE temporal stack via `pushForeignUndo`, so Cmd+Z reverses mode
 * edits interleaved with inline/state/class edits in true reverse-time order
 * (RFC #14 Increment 4a — see ADR-0006). Dependency is one-way (modeOverrides →
 * apply); apply never imports this module, so there is no cycle.
 */

import {
  pushForeignUndo,
  clearForeignUndo,
  beginForeignCoalesce,
  endForeignCoalesce,
} from "./apply";
import { managedSheet, _readManagedSheetCss } from "./managedSheet";

const SHEET_KEY = "mode-overrides";

// ─── Store ──────────────────────────────────────────────────────────

/** Map<selector, Map<varName, value>> */
const store = new Map<string, Map<string, string>>();

/** Monotonic counter for useSyncExternalStore snapshot */
let version = 0;

/** Test-only read of the mode-overrides sheet's serialized CSS. */
export function getModeOverridesCss(): string | null {
  return _readManagedSheetCss(SHEET_KEY);
}

// ─── Subscription ───────────────────────────────────────────────────

const listeners = new Set<() => void>();

export function subscribeModeOverrides(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getModeOverrideSnapshot(): number {
  return version;
}

function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

// ─── DOM ────────────────────────────────────────────────────────────

function renderStyleTag() {
  managedSheet(SHEET_KEY).replace(serializeModeOverrides());
}

// ─── Internal mutation helpers (no undo/redo side-effects) ──────────

function applyModeOverrideInternal(
  selector: string,
  varName: string,
  value: string,
): void {
  let vars = store.get(selector);
  if (!vars) {
    vars = new Map();
    store.set(selector, vars);
  }
  vars.set(varName, value);
  renderStyleTag();
  notify();
}

function removeModeOverrideInternal(
  selector: string,
  varName: string,
): void {
  const vars = store.get(selector);
  if (!vars) return;
  vars.delete(varName);
  if (vars.size === 0) store.delete(selector);
  renderStyleTag();
  notify();
}

// ─── Public API ─────────────────────────────────────────────────────

/** Enable undo coalescing (call before rapid-fire updates like color picker drag).
 *  Delegates to apply.ts's unified stack — consecutive applies for the same
 *  selector+varName merge into one undo step (RFC #14 Increment 4a). */
export function beginModeCoalesce(): void { beginForeignCoalesce(); }

/** Disable undo coalescing. */
export function endModeCoalesce(): void { endForeignCoalesce(); }

export function applyModeOverride(
  selector: string,
  varName: string,
  value: string,
): void {
  // Snapshot the prior value so the revert closure restores it (or removes the
  // variable if it didn't exist). The step lands on apply.ts's ONE temporal
  // stack; coalescing merges consecutive same-key drags into one undo.
  const prev = store.get(selector)?.get(varName) ?? null;
  pushForeignUndo({
    revert: () =>
      prev === null
        ? removeModeOverrideInternal(selector, varName)
        : applyModeOverrideInternal(selector, varName, prev),
    reapply: () => applyModeOverrideInternal(selector, varName, value),
    coalesceKey: `${selector} ${varName}`,
  });
  applyModeOverrideInternal(selector, varName, value);
}

export function removeModeOverride(
  selector: string,
  varName: string,
): void {
  // Unset is reversible: record the prior value so Cmd+Z restores the override,
  // mirroring applyModeOverride. A no-op (nothing to remove) registers no step.
  const prev = store.get(selector)?.get(varName) ?? null;
  if (prev === null) return;
  pushForeignUndo({
    revert: () => applyModeOverrideInternal(selector, varName, prev),
    reapply: () => removeModeOverrideInternal(selector, varName),
    coalesceKey: `${selector} ${varName}`,
  });
  removeModeOverrideInternal(selector, varName);
}

export function getModeOverrides(
  selector: string,
): Record<string, string> | undefined {
  const vars = store.get(selector);
  if (!vars || vars.size === 0) return undefined;
  return Object.fromEntries(vars);
}

export function resetAllModeOverrides(): void {
  // Mode's undo footprint lives on apply.ts's unified stack now — purge it there.
  clearForeignUndo();
  if (store.size === 0) return;
  store.clear();
  managedSheet(SHEET_KEY).replace("");
  notify();
}

export function serializeModeOverrides(): string {
  return serializeModeOverrideEntries(getAllModeOverrides());
}

/** One pending override as a flat entry — the save pipeline's iteration shape
 *  (issue #53, second half). */
export type ModeOverrideEntry = {
  selector: string;
  varName: string;
  value: string;
};

/** Every pending override, flattened in store order. */
export function getAllModeOverrides(): ModeOverrideEntry[] {
  const out: ModeOverrideEntry[] = [];
  for (const [selector, vars] of store)
    for (const [varName, value] of vars) out.push({ selector, varName, value });
  return out;
}

/** serializeModeOverrides for a SUBSET — the clipboard side-channel copies
 *  only the entries the save pipeline could NOT bind to a file. */
export function serializeModeOverrideEntries(
  entries: ModeOverrideEntry[],
): string {
  if (entries.length === 0) return "";
  const bySelector = new Map<string, string[]>();
  for (const { selector, varName, value } of entries) {
    const props = bySelector.get(selector) ?? [];
    props.push(`  ${varName}: ${value};`);
    bySelector.set(selector, props);
  }
  const blocks: string[] = [];
  for (const [selector, props] of bySelector) {
    blocks.push(`${selector} {\n${props.join("\n")}\n}`);
  }
  return blocks.join("\n\n");
}

/** Check if a specific selector + variable has an override applied */
export function isModeOverrideDirty(selector: string, varName: string): boolean {
  return store.get(selector)?.has(varName) ?? false;
}

/** Total number of overridden variable-mode pairs */
export function getModeOverrideCount(): number {
  let count = 0;
  for (const vars of store.values()) count += vars.size;
  return count;
}
