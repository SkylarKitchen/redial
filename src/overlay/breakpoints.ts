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
 * The selectable breakpoints. A fixed, conventional viewport list (like the
 * pseudo-state list in StateSelector) — these are standard CSS breakpoints, not
 * fabricated design-system tokens.
 */
export const BREAKPOINTS: Breakpoint[] = [
  { id: BASE_BREAKPOINT_ID, label: "Base" },
  { id: "640", label: "≥ 640", minWidth: 640 },
  { id: "768", label: "≥ 768", minWidth: 768 },
  { id: "1024", label: "≥ 1024", minWidth: 1024 },
  { id: "1280", label: "≥ 1280", minWidth: 1280 },
];

/** Look up a breakpoint by id (undefined if not a known breakpoint). */
export function getBreakpoint(id: string): Breakpoint | undefined {
  return BREAKPOINTS.find((b) => b.id === id);
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
