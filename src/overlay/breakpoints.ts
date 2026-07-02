/**
 * breakpoints.ts — Canonical responsive breakpoints + @media serialization (#35).
 *
 * The Unified Style Engine already treats a breakpoint as an orthogonal
 * composition dimension on the override model (ADR-0005): an edit made at a
 * non-base breakpoint is keyed, diffed, undone and reset independently, but is
 * deliberately NOT written to the element's inline style — its media-gated
 * render was deferred to this issue.
 *
 * This module supplies the layers #35 adds on top of that model:
 *   1. the selectable breakpoint SET (mobile-first, min-width cascade),
 *   2. the min-width media CONDITION for a breakpoint id,
 *   3. a SERIALIZER from breakpoint-tagged `DiffEntry[]` to `@media` CSS,
 *      shared by the live-preview <style> tag (breakpointPreview.ts) and the
 *      clipboard export, and
 *   4. the ONE base-vs-`@media` partition for every copy/export surface
 *      (`composeExportCSS` / `composeTailwindExport`) — Footer Copy, Cmd+C,
 *      ChangesDrawer "Copy All", and the Save clipboard side-channel all route
 *      through here so no surface can flatten responsive edits into the base
 *      rule again.
 *
 * The set is mobile-first (min-width), matching the engine's "≥768px" wording
 * and this tool's Next.js/Tailwind audience: Base is the un-mediated default and
 * larger breakpoints layer styles ON in ascending order.
 */

import type { DiffEntry } from "./core/apply";
import { getConfig, type TunerBreakpoint } from "./core/config";
import { getSelector } from "./util";
import { formatTailwindDiff } from "./tailwind";

export interface Breakpoint {
  /** Stable id used as the engine breakpoint key. "base" = un-mediated. */
  id: string;
  /** Human label shown in the selector, e.g. "Base", "≥ 768". */
  label: string;
  /** min-width in px; absent for the base breakpoint. */
  minWidth?: number;
}

/** Engine sentinel for the un-mediated base styles (mirrors apply.ts). */
export const BASE_BREAKPOINT_ID = "base";

/**
 * The DEFAULT selectable breakpoints — a conventional viewport list (like the
 * pseudo-state list in StateSelector) used only when the project supplies
 * nothing better. The ACTIVE set is resolved by {@link getBreakpoints}:
 * config override → stylesheet auto-detection → these defaults.
 */
export const BREAKPOINTS: Breakpoint[] = [
  { id: BASE_BREAKPOINT_ID, label: "Base" },
  { id: "640", label: "≥ 640", minWidth: 640 },
  { id: "768", label: "≥ 768", minWidth: 768 },
  { id: "1024", label: "≥ 1024", minWidth: 1024 },
  { id: "1280", label: "≥ 1280", minWidth: 1280 },
];

// ─── Active-set resolution: config → detection → defaults ────────────────────

/** Build a Breakpoint list from validated min-widths (ascending, Base first). */
function buildSet(entries: Array<{ minWidth: number; label?: string }>): Breakpoint[] {
  return [
    { id: BASE_BREAKPOINT_ID, label: "Base" },
    ...entries.map(({ minWidth, label }) => ({
      id: String(minWidth),
      label: label ?? `≥ ${minWidth}`,
      minWidth,
    })),
  ];
}

/** Config set cached by source-array identity (getBreakpoint runs in loops). */
let configCache: { source: TunerBreakpoint[]; set: Breakpoint[] | null } | null = null;

/** Sanitize the configured breakpoints: positive finite min-widths, deduped,
 *  ascending. Returns null when nothing valid remains (→ fall through). */
function fromConfig(source: TunerBreakpoint[]): Breakpoint[] | null {
  if (configCache?.source === source) return configCache.set;
  const byMin = new Map<number, TunerBreakpoint>();
  for (const b of source) {
    if (!Number.isFinite(b.minWidth) || b.minWidth <= 0) continue;
    const min = Math.round(b.minWidth);
    if (!byMin.has(min)) byMin.set(min, b);
  }
  const entries = Array.from(byMin.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([minWidth, src]) => ({ minWidth, label: src.label }));
  const set = entries.length > 0 ? buildSet(entries) : null;
  configCache = { source, set };
  return set;
}

/** Matches `(min-width: 768px)` / `(min-width: 48em)` inside a media condition. */
const MIN_WIDTH_RE = /\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)/gi;

function collectMinWidths(rules: CSSRuleList, out: Set<number>): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as CSSRule & {
      cssRules?: CSSRuleList;
      conditionText?: string;
      media?: MediaList;
    };
    if (typeof CSSMediaRule !== "undefined" && rule instanceof CSSMediaRule) {
      const cond = rule.conditionText ?? rule.media?.mediaText ?? "";
      for (const m of cond.matchAll(MIN_WIDTH_RE)) {
        const n = parseFloat(m[1]);
        const px = m[2].toLowerCase() === "px" ? n : n * 16; // em/rem at 16px root
        if (Number.isFinite(px) && px > 0) out.add(Math.round(px));
      }
    }
    // Recurse into grouping rules (@supports, @layer, nested @media).
    if (rule.cssRules) collectMinWidths(rule.cssRules, out);
  }
}

/**
 * Scan a document's stylesheets for `@media (min-width: …)` rules and return
 * the distinct min-widths actually used by the project, ascending (px; em/rem
 * converted at 16px). Resilient to cross-origin sheets: any sheet whose
 * `cssRules` access throws is skipped, never aborting the scan.
 */
export function detectBreakpointsFromStyleSheets(
  doc: { styleSheets: ArrayLike<CSSStyleSheet> } = document,
): number[] {
  const found = new Set<number>();
  let sheets: ArrayLike<CSSStyleSheet>;
  try {
    sheets = doc.styleSheets;
  } catch {
    return [];
  }
  for (let i = 0; i < sheets.length; i++) {
    let rules: CSSRuleList;
    try {
      rules = sheets[i].cssRules;
    } catch {
      continue; // cross-origin sheet — skip, keep scanning
    }
    try {
      collectMinWidths(rules, found);
    } catch {
      continue; // defensive: a hostile rule object must not abort detection
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}

/** Detected set, memoized at first resolution (≈ first panel open).
 *  `undefined` = not yet computed; `null` = computed, nothing coherent found. */
let detected: Breakpoint[] | null | undefined;

/** Forget the memoized detection result (tests / future re-detection hooks). */
export function invalidateBreakpointDetection(): void {
  detected = undefined;
}

/** A detected set is coherent when the project uses 2–6 distinct min-widths;
 *  outside that, detection is noise and the defaults are safer. */
function toDetectedSet(minWidths: number[]): Breakpoint[] | null {
  if (minWidths.length < 2 || minWidths.length > 6) return null;
  return buildSet(minWidths.map((minWidth) => ({ minWidth })));
}

/**
 * Resolve the active breakpoint set. `runDetection` gates the (memoized)
 * stylesheet scan so hot lookup paths ({@link getBreakpoint}, serialization)
 * never trigger a scan themselves — numeric-id fallbacks already cover them.
 */
function activeBreakpoints(runDetection: boolean): Breakpoint[] {
  const cfg = getConfig().breakpoints;
  if (cfg && cfg.length > 0) {
    const set = fromConfig(cfg);
    if (set) return set;
  }
  if (detected === undefined && runDetection && typeof document !== "undefined") {
    detected = toDetectedSet(detectBreakpointsFromStyleSheets(document));
  }
  return detected ?? BREAKPOINTS;
}

/**
 * The ACTIVE selectable breakpoints: the configured set when
 * `configure({ breakpoints })` was given, else the set auto-detected from the
 * project's stylesheets (first call scans; ≈ panel open), else
 * {@link BREAKPOINTS}. Selector UI reads this.
 */
export function getBreakpoints(): Breakpoint[] {
  return activeBreakpoints(true);
}

/** Look up a breakpoint by id in the active set (undefined if not known). */
export function getBreakpoint(id: string): Breakpoint | undefined {
  return activeBreakpoints(false).find((b) => b.id === id);
}

/**
 * The `@media` condition for a breakpoint id, or null for the base breakpoint.
 * Falls back to parsing an arbitrary numeric id so serialization never chokes on
 * a breakpoint the engine produced that isn't in {@link BREAKPOINTS}.
 */
export function mediaConditionFor(id: string): string | null {
  if (id === BASE_BREAKPOINT_ID) return null;
  const known = getBreakpoint(id);
  const min = known?.minWidth ?? parseInt(id, 10);
  if (!Number.isFinite(min) || min <= 0) return null;
  return `(min-width: ${min}px)`;
}

/** Numeric sort key for a breakpoint id (base sorts first). */
function bpOrder(id: string): number {
  if (id === BASE_BREAKPOINT_ID) return -1;
  const known = getBreakpoint(id);
  return known?.minWidth ?? (parseInt(id, 10) || 0);
}

/**
 * Serialize breakpoint-tagged element changes into `@media` CSS blocks, ascending
 * by min-width. Base-breakpoint changes (no `breakpoint`) are skipped — those are
 * the live inline styles, not media-gated. A pseudo-state composes INTO the
 * selector (breakpoint outer, state inner): `@media(≥768){ sel:hover { … } }`.
 *
 * @param items per-element changes already paired with the CSS selector that
 *   targets that element (e.g. `[data-redial-bp="1"]`).
 */
export function serializeBreakpointCSS(
  items: Array<{ selector: string; changes: DiffEntry[] }>,
): string {
  // breakpoint id → (effective selector → "prop: value;" lines)
  const byBreakpoint = new Map<string, Map<string, string[]>>();

  for (const { selector, changes } of items) {
    for (const c of changes) {
      if (!c.breakpoint) continue; // base = inline, not media-gated
      const effSelector = c.state ? `${selector}:${c.state}` : selector;
      let bySelector = byBreakpoint.get(c.breakpoint);
      if (!bySelector) {
        bySelector = new Map();
        byBreakpoint.set(c.breakpoint, bySelector);
      }
      const lines = bySelector.get(effSelector) ?? [];
      lines.push(`    ${c.prop}: ${c.to};`);
      bySelector.set(effSelector, lines);
    }
  }

  if (byBreakpoint.size === 0) return "";

  const blocks: string[] = [];
  const sortedBps = Array.from(byBreakpoint.keys()).sort(
    (a, b) => bpOrder(a) - bpOrder(b),
  );
  for (const bp of sortedBps) {
    const cond = mediaConditionFor(bp);
    if (!cond) continue;
    const ruleBlocks: string[] = [];
    for (const [selector, lines] of byBreakpoint.get(bp)!) {
      ruleBlocks.push(`  ${selector} {\n${lines.join("\n")}\n  }`);
    }
    blocks.push(`@media ${cond} {\n${ruleBlocks.join("\n")}\n}`);
  }
  return blocks.join("\n\n");
}

// ─── Shared export composition (the ONE base-vs-@media partition) ─────────────

/**
 * Compose the full CSS export for a set of elements' changes: base
 * (un-mediated) changes go through `formatBase` per element, and
 * breakpoint-tagged changes become `@media` blocks via
 * {@link serializeBreakpointCSS}. Elements with no base changes emit no empty
 * base rule.
 *
 * Every copy/export surface MUST route through this (Footer Copy CSS/SCSS,
 * Cmd+C, ChangesDrawer "Copy All", the Save clipboard fallback) — the
 * per-surface private copies of this partition are exactly how responsive
 * edits got flattened into the base rule.
 */
export function composeExportCSS(
  items: Array<{ el: Element; changes: DiffEntry[] }>,
  formatBase: (el: Element, changes: DiffEntry[]) => string,
): string {
  const blocks: string[] = [];
  for (const { el, changes } of items) {
    const base = changes.filter((c) => !c.breakpoint);
    if (base.length > 0) blocks.push(formatBase(el, base));
  }
  const bpCSS = serializeBreakpointCSS(
    items.map(({ el, changes }) => ({ selector: getSelector(el), changes })),
  );
  if (bpCSS) blocks.push(bpCSS);
  return blocks.join("\n\n");
}

/**
 * One element's breakpoint-tagged changes as `@media` CSS against its display
 * selector — the Save clipboard side-channel (#53: breakpoint changes are not
 * file-written yet, so Save exports them here instead of dropping them).
 */
export function serializeElementBreakpointCSS(
  el: Element,
  changes: DiffEntry[],
): string {
  return serializeBreakpointCSS([{ selector: getSelector(el), changes }]);
}

/** Redial's breakpoint set maps 1:1 onto Tailwind's default responsive scale. */
const TAILWIND_PREFIXES: Record<string, string> = {
  "640": "sm",
  "768": "md",
  "1024": "lg",
  "1280": "xl",
};

/**
 * Tailwind responsive variant for a breakpoint id: the canonical set maps to
 * `sm:`/`md:`/`lg:`/`xl:`; an arbitrary numeric id falls back to Tailwind v4's
 * arbitrary variant (`min-[900px]`); base / unparseable ids get no prefix.
 */
export function tailwindPrefixFor(id: string): string | null {
  if (id === BASE_BREAKPOINT_ID) return null;
  const known = TAILWIND_PREFIXES[id];
  if (known) return known;
  const min = getBreakpoint(id)?.minWidth ?? parseInt(id, 10);
  if (!Number.isFinite(min) || min <= 0) return null;
  return `min-[${min}px]`;
}

/**
 * Tailwind-class export with the responsive dimension preserved: base changes
 * convert unprefixed; breakpoint-tagged changes get their responsive variant
 * prefix, ascending by min-width. The Tailwind counterpart of
 * {@link composeExportCSS}.
 */
export function composeTailwindExport(changes: DiffEntry[]): string {
  const parts: string[] = [];

  const base = changes.filter((c) => !c.breakpoint);
  const baseTw = formatTailwindDiff(base);
  if (baseTw) parts.push(baseTw);

  const bpIds = Array.from(
    new Set(changes.filter((c) => c.breakpoint).map((c) => c.breakpoint!)),
  ).sort((a, b) => bpOrder(a) - bpOrder(b));

  for (const id of bpIds) {
    const group = changes.filter((c) => c.breakpoint === id);
    const tw = formatTailwindDiff(group);
    if (!tw) continue;
    const prefix = tailwindPrefixFor(id);
    parts.push(
      prefix ? tw.split(/\s+/).map((cls) => `${prefix}:${cls}`).join(" ") : tw,
    );
  }
  return parts.join(" ");
}
