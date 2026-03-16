/**
 * modeOverrides.ts — Runtime CSS variable mode overrides.
 *
 * Manages a <style id="redial-mode-overrides"> element that holds
 * per-selector overrides for CSS custom properties in specific modes.
 * Integrates with the panel's undo/save system via subscription API.
 */

// ─── Store ──────────────────────────────────────────────────────────

/** Map<selector, Map<varName, value>> */
const store = new Map<string, Map<string, string>>();

/** Monotonic counter for useSyncExternalStore snapshot */
let version = 0;

// ─── Undo / Redo ────────────────────────────────────────────────────

interface UndoEntry {
  selector: string;
  varName: string;
  prev: string | null; // null = variable didn't exist
  next: string;
}

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

/** Style element reference */
let styleEl: HTMLStyleElement | null = null;

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

const STYLE_ID = "redial-mode-overrides";

function ensureStyleEl(): HTMLStyleElement {
  if (styleEl && document.contains(styleEl)) return styleEl;
  styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function renderStyleTag() {
  const el = ensureStyleEl();
  el.textContent = serializeModeOverrides();
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

export function applyModeOverride(
  selector: string,
  varName: string,
  value: string,
): void {
  const prev = store.get(selector)?.get(varName) ?? null;
  undoStack.push({ selector, varName, prev, next: value });
  redoStack.length = 0;
  applyModeOverrideInternal(selector, varName, value);
}

export function removeModeOverride(
  selector: string,
  varName: string,
): void {
  removeModeOverrideInternal(selector, varName);
}

export function undoModeOverride(): void {
  const entry = undoStack.pop();
  if (!entry) return;
  redoStack.push(entry);
  if (entry.prev === null) {
    removeModeOverrideInternal(entry.selector, entry.varName);
  } else {
    applyModeOverrideInternal(entry.selector, entry.varName, entry.prev);
  }
}

export function redoModeOverride(): void {
  const entry = redoStack.pop();
  if (!entry) return;
  undoStack.push(entry);
  applyModeOverrideInternal(entry.selector, entry.varName, entry.next);
}

export function getModeOverrides(
  selector: string,
): Record<string, string> | undefined {
  const vars = store.get(selector);
  if (!vars || vars.size === 0) return undefined;
  return Object.fromEntries(vars);
}

export function resetAllModeOverrides(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  if (store.size === 0) return;
  store.clear();
  if (styleEl && document.contains(styleEl)) {
    styleEl.textContent = "";
  }
  notify();
}

export function serializeModeOverrides(): string {
  if (store.size === 0) return "";
  const blocks: string[] = [];
  for (const [selector, vars] of store) {
    const props = Array.from(vars.entries())
      .map(([name, val]) => `  ${name}: ${val};`)
      .join("\n");
    blocks.push(`${selector} {\n${props}\n}`);
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
