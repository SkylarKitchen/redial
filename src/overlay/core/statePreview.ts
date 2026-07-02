/**
 * statePreview.ts — Pseudo-class style preview via a managed stylesheet
 *
 * Inline styles can't target pseudo-classes (:hover, :focus, etc.).
 * This module owns a `managedSheet("state-preview")` (constructable
 * stylesheet on `document.adoptedStyleSheets`, with a `<style>` fallback —
 * see ADR-0009 / managedSheet.ts) that injects rules like:
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
 *
 * FORCED state preview (`setForcedState`): rules gated on the REAL
 * pseudo-state are invisible exactly when the user needs them — scrubbing a
 * slider puts the pointer in the panel, not over the element. So while a
 * pseudo-state is selected in the panel, the element renders AS IF in that
 * state: the AUTHOR's matching pseudo-state rules are gathered from
 * `document.styleSheets`, de-pseudoed, re-scoped to the element's attribute
 * selector and injected `!important` in source order (preserving any @media
 * wrapper), followed by the redial edit overrides for that (element, state),
 * also de-pseudoed — equal specificity, later source order, so edits win.
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

/** True when the element still has overrides under ANY state. */
function elementHasOverrides(el: Element): boolean {
  const elId = getElId(el);
  for (const k of overrides.keys()) {
    if (k.startsWith(`${elId}:`)) return true;
  }
  return false;
}

// --- Forced state (panel state selector) ---

// The single (element, state) currently selected in the panel's state
// selector. While set, rebuildStyleTag() additionally injects (1) the
// author's matching pseudo-state rules and (2) the edit overrides for this
// pair, both de-pseudoed so they apply WITHOUT the real pseudo-state.
let forced: { el: Element; state: string } | null = null;

// Author rules are gathered once per activation (a stylesheet walk per scrub
// frame would be wasteful) and invalidated on every setForcedState change.
// Deliberate staleness window: author sheets replaced by HMR mid-force are
// re-gathered on the next state/element switch.
let forcedAuthorCssCache: string[] | null = null;

/** Selectors belonging to the panel itself — never gather these.
 *  (Mirrors navigator/cssRuleGatherer.ts. That module cannot be imported
 *  here: it reads VALID_STATES from this module at module-eval time, so a
 *  static import back at it is a TDZ cycle — verified to throw.) */
const TUNER_SELECTOR_RE = /\.__tuner-root|\[data-tuner-/;

/** Regex matching `:{state}` with a boundary lookahead so `:focus` cannot
 *  match inside `:focus-within` / `:focus-visible` (#76). `state` is
 *  allowlisted via VALID_STATES, so interpolation is regex-safe. */
function statePseudoRe(state: string, flags = ""): RegExp {
  return new RegExp(`:${state}(?![\\w-])`, flags);
}

/**
 * Walk `document.styleSheets` and collect the author's rules for `state`
 * that match `el`, rewritten as de-pseudoed rule blocks scoped to the
 * element's attribute selector, `!important`, in source order. Rules inside
 * @media keep their wrapper so the browser evaluates the condition live.
 *
 * De-pseudoing removes ONLY the forced pseudo (devtools `:hov` semantics):
 * other pseudo-classes stay in the match check, so `.btn:hover:focus` is
 * forced by hover only while the element is REALLY focused, and structural
 * pseudos like `:first-child` keep their meaning.
 */
function gatherForcedAuthorRules(el: Element, state: string): string[] {
  const out: string[] = [];
  const scoped = `${elAttrSelector(el)}.__tuner-state-preview`;
  const hasState = statePseudoRe(state);
  const stripState = statePseudoRe(state, "g");

  const visitStyleRule = (rule: CSSStyleRule, media?: string): void => {
    const selectorText = rule.selectorText;
    if (!selectorText || TUNER_SELECTOR_RE.test(selectorText)) return;
    if (!hasState.test(selectorText)) return;

    // Find a selector-list part that carries the forced pseudo AND matches
    // el once only that pseudo is removed. Keep a trailing pseudo-element
    // (`.btn:hover::after`) so the declarations land where the author put them.
    let pseudoEl: string | null = null;
    for (const raw of selectorText.split(",")) {
      const part = raw.trim();
      if (!hasState.test(part)) continue;
      const pe = part.match(/(::[\w-]+)$/)?.[1] ?? "";
      const base = part
        .replace(stripState, "")
        .replace(/::[\w-]+/g, "")
        .trim();
      if (!base) continue;
      try {
        if (el.matches(base)) {
          pseudoEl = pe;
          break;
        }
      } catch {
        // Selector left malformed by the strip — skip this part
      }
    }
    if (pseudoEl == null) return;

    const declarations: string[] = [];
    for (let i = 0; i < rule.style.length; i++) {
      const prop = rule.style[i];
      if (!isValidCSSProp(prop)) continue;
      const value = rule.style.getPropertyValue(prop);
      declarations.push(`  ${prop}: ${sanitizeCSSValue(value)} !important;`);
    }
    if (declarations.length === 0) return;

    const block = `${scoped}${pseudoEl} {\n${declarations.join("\n")}\n}`;
    out.push(media ? `@media ${media} {\n${block}\n}` : block);
  };

  const visit = (rules: CSSRuleList, media?: string): void => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSStyleRule) {
        visitStyleRule(rule, media);
      } else if (
        typeof CSSMediaRule !== "undefined" &&
        rule instanceof CSSMediaRule
      ) {
        visit(rule.cssRules, rule.conditionText || rule.media?.mediaText);
      } else if ("cssRules" in rule) {
        // CSSSupportsRule, CSSLayerBlockRule — pass through same media context
        visit((rule as CSSGroupingRule).cssRules, media);
      }
    }
  };

  for (let s = 0; s < document.styleSheets.length; s++) {
    let rules: CSSRuleList;
    try {
      rules = document.styleSheets[s].cssRules;
    } catch {
      // Cross-origin sheets throw SecurityError — skip gracefully
      continue;
    }
    visit(rules);
  }

  return out;
}

/**
 * Force `state` on `el` while it is selected in the panel's state selector.
 * Pass `null` / `"none"` / an invalid state to clear. Idempotent per
 * (element, state) pair; switching swaps the injected author rules.
 *
 * Wiring: Overlay.tsx drives this from (selectedEl, activeState) —
 *   useEffect(() => setForcedState(selectedEl, activeState), [selectedEl, activeState]);
 */
export function setForcedState(el: Element | null, state: string | null): void {
  const next = el && state && VALID_STATES.has(state) ? { el, state } : null;
  const prev = forced;
  if (prev?.el === next?.el && prev?.state === next?.state) return;

  forced = next;
  forcedAuthorCssCache = null;

  if (next) {
    if (!taggedElements.has(next.el)) {
      (next.el as HTMLElement).setAttribute(
        "data-tuner-state-id",
        String(getElId(next.el)),
      );
      taggedElements.add(next.el);
    }
    next.el.classList.add("__tuner-state-preview");
  }

  // Un-class the previous target unless it still previews edit overrides
  if (prev && prev.el !== next?.el && !elementHasOverrides(prev.el)) {
    prev.el.classList.remove("__tuner-state-preview");
  }

  rebuildStyleTag();
}

// --- Managed sheet ---

/** Test-only read of the state-preview sheet's serialized CSS, or null if never registered. */
export function getStateStyleCss(): string | null {
  return _readManagedSheetCss(SHEET_KEY);
}

// --- Rebuild (with rAF debounce for hot-path calls) ---

let rebuildRafId: number | null = null;

function scheduleRebuild(): void {
  if (rebuildRafId != null) return;
  rebuildRafId = requestAnimationFrame(() => {
    rebuildRafId = null;
    rebuildStyleTag();
  });
}

/** Cancel any pending rAF-scheduled rebuild (#83 — a queued frame firing
 *  after destroy would resurrect the disposed sheet). */
function cancelScheduledRebuild(): void {
  if (rebuildRafId != null) {
    cancelAnimationFrame(rebuildRafId);
    rebuildRafId = null;
  }
}

/** Flush any pending rAF-scheduled rebuild synchronously. Exposed for tests. */
export function flushScheduledRebuild(): void {
  if (rebuildRafId != null) {
    cancelScheduledRebuild();
    rebuildStyleTag();
  }
}

/** Serialize an overrides map to indented `prop: value !important;` lines. */
function serializeDeclarations(
  props: Map<string, { initial: string; current: string }>,
): string {
  return Array.from(props.entries())
    .filter(([prop]) => isValidCSSProp(prop))
    .map(([prop, { current }]) => `  ${prop}: ${sanitizeCSSValue(current)} !important;`)
    .join("\n");
}

function rebuildStyleTag(): void {
  const rules: string[] = [];

  // 1) Forced AUTHOR rules — while a pseudo-state is selected in the panel,
  // the element must LOOK like it's in that state, so the author's own
  // `.btn:hover { … }` declarations render un-pseudoed. Emitted FIRST so the
  // edit overrides in (3) win ties (equal specificity, both !important →
  // later source order decides).
  if (forced) {
    if (forcedAuthorCssCache == null) {
      forcedAuthorCssCache = gatherForcedAuthorRules(forced.el, forced.state);
    }
    rules.push(...forcedAuthorCssCache);
  }

  // 2) Edit overrides gated on the REAL pseudo-state (persistent preview —
  // these keep working after the state selector returns to "none").
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
    const declarations = serializeDeclarations(props);
    if (!declarations) continue;
    rules.push(`${selector} {\n${declarations}\n}`);
  }

  // 3) Forced EDIT overrides, de-pseudoed and LAST — while the state is
  // selected, edits must be visible without the real pseudo-state being
  // active, and must beat the forced author rules from (1).
  if (forced) {
    const props = overrides.get(stateKey(forced.el, forced.state));
    if (props) {
      const declarations = serializeDeclarations(props);
      if (declarations) {
        rules.push(
          `${elAttrSelector(forced.el)}.__tuner-state-preview {\n${declarations}\n}`,
        );
      }
    }
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

  // Drop the preview class only when no overrides remain AND the element is
  // not the forced-state target (the forced author rules still need it)
  if (!elementHasOverrides(el) && forced?.el !== el) {
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

  // Drop the preview class only when no overrides remain AND the element is
  // not the forced-state target (the forced author rules still need it)
  if (!elementHasOverrides(el) && forced?.el !== el) {
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
  // Cancel any pending debounced rebuild — the queued frame must not run
  // after teardown or it re-creates the disposed sheet (#83)
  cancelScheduledRebuild();

  // Clear the forced state so nothing re-gathers author rules after teardown
  forced = null;
  forcedAuthorCssCache = null;

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
