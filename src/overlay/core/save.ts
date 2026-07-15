/**
 * save.ts — THE save pipeline (ADR-0011).
 *
 * One module owns everything between "here are the diffs the user is saving"
 * and "here is what happened": provenance-driven enrichment, the
 * file-vs-clipboard partition, per-mode transport (the route dispatches the
 * WHOLE request on `body.mode`, so CSS and Tailwind changes travel in
 * separate POSTs), the no-endpoint and unreachable-route clipboard fallbacks,
 * and the post-save breakpoint reconciliation (#53, surgical per ADR-0005).
 *
 * Every save surface — the Footer button, Cmd+S, the command palette, the
 * ChangesDrawer's "Save All" — calls `save(entries)` and renders its own
 * toast from the returned `SaveOutcome`. Selection (WHICH changes to save)
 * stays with the caller; targeting (WHERE each change lands) rides each
 * entry's recorded provenance. There is deliberately no second copy of any
 * of this anywhere else — divergence between save surfaces is the bug class
 * this module exists to kill.
 */

import type { DiffEntry } from "./apply";
import { styleEngine } from "./engine";
import {
  enrichChangesForCommit,
  partitionBreakpointChanges,
  breakpointChangeKey,
  type EnrichedChange,
} from "./commitUtils";
import { getConfig } from "./config";
import { serializeModeOverrides, getModeOverrideCount } from "./modeOverrides";
import { composeExportCSS, serializeElementBreakpointCSS } from "../breakpoints";
import { getSelector } from "../util";
import {
  REDIAL_MARKER_HEADER,
  type CommitResult,
  type TailwindCommitResult,
} from "../../lib/protocol";

/** One element's worth of diffs to save — the caller selects, save targets. */
export type SaveEntry = { el: Element; changes: DiffEntry[] };

/**
 * What the clipboard side-channel did: edits that structurally can't be
 * file-written (mode overrides are clipboard-only; breakpoint edits the
 * enrichment could not bind to a file) get copied, and the UI phrases a
 * "copied, not saved" notice from these counts.
 */
export type SideChannelReport = {
  breakpointCount: number;
  modeCount: number;
  clipboardWritten: boolean;
};

export type SaveOutcome =
  /** Nothing dirty at all — the caller's guard raced a reset. */
  | { kind: "nothing-to-save" }
  /** No commit endpoint configured: everything exported to the clipboard. */
  | {
      kind: "clipboard";
      propertyCount: number;
      modeCount: number;
      clipboardWritten: boolean;
    }
  /** Endpoint configured but nothing file-bound — only side-channel extras. */
  | { kind: "extras-only"; extras: Promise<SideChannelReport> }
  /** The server accepted the batch (possibly with per-item failures). */
  | {
      kind: "saved";
      /** Number of enriched changes sent (the Footer's toast count). */
      savedCount: number;
      written: string[];
      failed: Array<{ reason: string }>;
      /** The side-channel copy runs CONCURRENTLY — the save outcome (and its
       *  toast) must not wait on the clipboard. Subscribe for the follow-up
       *  "copied, not saved" notice. */
      extras: Promise<SideChannelReport>;
    }
  /** The route answered non-2xx. `written` carries any earlier batch's files. */
  | { kind: "http-error"; status: number; detail?: string; written: string[] }
  /** The fetch itself rejected — route unreachable. CSS was best-effort copied. */
  | { kind: "unreachable"; clipboardWritten: boolean; written: string[] };

/**
 * Transport seam. The default adapter is `fetch` against the configured
 * commit endpoint with the marker header (issue #54); round-trip tests
 * inject an adapter that calls the real server handlers with a temp cwd —
 * two adapters, one real seam.
 */
export type SaveTransport = (body: {
  mode?: "tailwind";
  changes: EnrichedChange[];
}) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

let transportOverride: SaveTransport | null = null;

/** Test seam (house pattern — see server/index.ts `__setLaunchEditorForTests`). */
export function __setTransportForTests(t: SaveTransport | null): void {
  transportOverride = t;
}

const fetchTransport: SaveTransport = (body) =>
  fetch(getConfig().commitEndpoint!, {
    method: "POST",
    headers: { "Content-Type": "application/json", [REDIAL_MARKER_HEADER]: "1" },
    body: JSON.stringify(body),
  });

// --- Clean CSS format for clipboard exports (no "was" comments) ---
function formatCleanCSS(el: Element, changes: DiffEntry[]): string {
  const selector = getSelector(el);
  const lines = changes.map((c) => `  ${c.prop}: ${c.to};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Base + `@media` blocks + mode overrides — the full clipboard export. */
function composeFullExport(entries: SaveEntry[]): string {
  const css = composeExportCSS(entries, formatCleanCSS);
  const modeCSS = serializeModeOverrides();
  return modeCSS
    ? css
      ? css + "\n\n/* Mode overrides */\n" + modeCSS
      : modeCSS
    : css;
}

type PerElement = SaveEntry & {
  enriched: EnrichedChange[];
  fileBound: Set<string>;
  clipboardBp: DiffEntry[];
};

/** Copy the side-channel extras (unbindable breakpoint edits + mode overrides). */
async function copySideChannel(perElement: PerElement[]): Promise<SideChannelReport> {
  const parts: string[] = [];
  let breakpointCount = 0;
  for (const { el, clipboardBp } of perElement) {
    if (clipboardBp.length === 0) continue;
    breakpointCount += clipboardBp.filter((c) => c.breakpoint).length;
    const css = serializeElementBreakpointCSS(el, clipboardBp);
    if (css) parts.push(css);
  }
  const modeCSS = serializeModeOverrides();
  if (modeCSS) parts.push(modeCSS);
  const modeCount = getModeOverrideCount();
  const text = parts.join("\n\n");
  if (!text) return { breakpointCount: 0, modeCount, clipboardWritten: false };
  const clipboardWritten = await writeClipboard(text);
  return { breakpointCount, modeCount, clipboardWritten };
}

/**
 * Post-save reconciliation (#53): breakpoint keys are tracked-only (never
 * inline), so a fully successful save IS their catch-up moment — clear each
 * element's file-written breakpoint cells so they stop counting as dirty.
 * Surgical per ADR-0005 (only breakpoints whose EVERY change was file-bound;
 * clipboard leftovers keep their tracking), and only on a batch with zero
 * failures. Base edits clear via HMR redundancy detection instead.
 */
function reconcileBreakpoints(entry: PerElement): void {
  const clearable = new Map<string, boolean>();
  for (const c of entry.changes) {
    if (!c.breakpoint) continue;
    const bound = entry.fileBound.has(breakpointChangeKey(c.breakpoint, c.state, c.prop));
    clearable.set(c.breakpoint, (clearable.get(c.breakpoint) ?? true) && bound);
  }
  for (const [id, allBound] of clearable) {
    if (!allBound) continue;
    styleEngine.resetScope(entry.el, {
      scope: "element",
      activeClassName: null,
      activeState: "none",
      activeBreakpoint: id,
    });
  }
}

/**
 * Save the given entries. Enrichment, partition, transport, fallbacks, and
 * reconciliation all happen here; the caller renders a toast from the
 * outcome and decides nothing about targeting.
 */
export async function save(entries: SaveEntry[]): Promise<SaveOutcome> {
  const nonEmpty = entries.filter((e) => e.changes.length > 0);
  const totalChanges = nonEmpty.reduce((n, e) => n + e.changes.length, 0);
  if (totalChanges === 0 && getModeOverrideCount() === 0) {
    return { kind: "nothing-to-save" };
  }

  const perElement: PerElement[] = nonEmpty.map(({ el, changes }) => {
    const enriched = enrichChangesForCommit(el, changes);
    const { fileBound, clipboard } = partitionBreakpointChanges(changes, enriched);
    return { el, changes, enriched, fileBound, clipboardBp: clipboard };
  });
  const enrichedAll = perElement.flatMap((e) => e.enriched);

  // No commit endpoint configured (and no injected transport): everything —
  // base rules, @media blocks, mode overrides — exports to the clipboard.
  if (!getConfig().commitEndpoint && !transportOverride) {
    const clipboardWritten = await writeClipboard(composeFullExport(nonEmpty));
    return {
      kind: "clipboard",
      propertyCount: totalChanges,
      modeCount: getModeOverrideCount(),
      clipboardWritten,
    };
  }

  // Nothing file-bound (e.g. only clipboard-bound breakpoint edits / mode
  // overrides): skip the pointless empty POST, go straight to the extras.
  if (enrichedAll.length === 0) {
    return { kind: "extras-only", extras: copySideChannel(perElement) };
  }

  // Per-mode batches: the route dispatches the WHOLE request on `body.mode`
  // (server/index.ts), so a mixed Save All must POST css and tailwind
  // separately or the css changes get fed to the Tailwind handler.
  const cssChanges = enrichedAll.filter((c) => c.mode !== "tailwind");
  const twChanges = enrichedAll.filter((c) => c.mode === "tailwind");
  const batches: Array<{ mode?: "tailwind"; changes: EnrichedChange[] }> = [];
  if (cssChanges.length > 0) batches.push({ changes: cssChanges });
  if (twChanges.length > 0) batches.push({ mode: "tailwind", changes: twChanges });

  const transport = transportOverride ?? fetchTransport;
  const written: string[] = [];
  const failed: Array<{ reason: string }> = [];

  for (const batch of batches) {
    let res: Awaited<ReturnType<SaveTransport>>;
    try {
      res = await transport(batch);
    } catch {
      // Fetch REJECTION (not an HTTP error): the route itself is unreachable —
      // dev server down or the catch-all handler isn't mounted. Best-effort
      // copy the full CSS so the edit isn't lost.
      const clipboardWritten = await writeClipboard(composeFullExport(nonEmpty));
      return { kind: "unreachable", clipboardWritten, written };
    }
    if (!res.ok) {
      // Status-aware failure (audit: opaque first-save failures): a 404
      // (route not mounted) and a 500 (server bug) are different problems —
      // carry the HTTP status plus any server-provided error text.
      let detail: string | undefined;
      try {
        const body = (await res.json()) as { error?: unknown } | null;
        if (typeof body?.error === "string" && body.error) detail = body.error;
      } catch {
        // Non-JSON error body (e.g. an HTML 404 page) — status alone.
      }
      return { kind: "http-error", status: res.status, detail, written };
    }
    const result = (await res.json().catch(() => null)) as
      | Partial<CommitResult | TailwindCommitResult>
      | null;
    written.push(...(result?.written ?? []));
    failed.push(...(result?.failed ?? []));
  }

  if (failed.length === 0) {
    for (const entry of perElement) reconcileBreakpoints(entry);
  }
  const extras = copySideChannel(perElement);
  return { kind: "saved", savedCount: enrichedAll.length, written, failed, extras };
}
