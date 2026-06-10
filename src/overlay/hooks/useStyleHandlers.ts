/**
 * useStyleHandlers.ts — style-mutation callbacks for the overlay
 *
 * Bundles the cluster of Overlay callbacks that mutate styles and/or re-infer
 * the panel: session-wide reset, paste, per-element reset, undo-to-history-index,
 * and the spacing box-model change/reset handlers.
 *
 * Scope-routing dispatch (element / class / state) and the session-wide reset
 * go through `styleEngine` (RFC #14) rather than calling apply.ts/scope.ts/
 * statePreview.ts directly — so the routing rule lives in exactly one place and
 * cannot drift. (`handleUndoToIndex` still calls apply.ts's `undo` directly: the
 * undo stacks were unified in Increment 4a, so it now also steps mode/dom-move
 * entries — which return the `document.body` sentinel and so don't halt the loop,
 * exactly as dom-move already did. Migrating this to `styleEngine.undo` with
 * history-row-aware scrub semantics is Increment 4b of #14.)
 *
 * Extracted from Overlay.tsx. The hook receives the values/setters each
 * callback closes over so nothing reaches back into Overlay's scope via
 * globals. Scoping arrives as Overlay's ONE memoized `scopeCtx` (scope, class,
 * state, breakpoint) so this hook never enumerates the dimensions by hand —
 * the hand-rolled triple here is how spacing drags at a breakpoint silently
 * wrote to base.
 */

import { useCallback } from "react";
import { infer, type InferResult } from "../core/infer";
import { pasteStyles, undo } from "../core/apply";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import type { HistoryEntry } from "../shell/ChangesDrawer";

/**
 * Merge a single margin/padding side value into inferResult.spacing,
 * returning a new InferResult (or the input unchanged for non-spacing props).
 * Pure — shared by the spacing change + reset handlers.
 */
function applySpacingValue(
  prev: InferResult | null,
  prop: string,
  value: number,
): InferResult | null {
  if (!prev) return prev;
  const [group, side] = prop.split("-") as [string, string];
  if ((group === "margin" || group === "padding") && side) {
    return {
      ...prev,
      spacing: {
        ...prev.spacing,
        [group]: { ...prev.spacing[group], [side]: value },
      },
    };
  }
  return prev;
}

export interface StyleHandlersDeps {
  selectedEl: Element | null;
  /** Overlay's ONE memoized scoping bundle (scope ▸ class ▸ state ▸ breakpoint). */
  scopeCtx: ScopeContext;
  diffMode: boolean;
  historyEntries: HistoryEntry[];
  setInferResult: React.Dispatch<React.SetStateAction<InferResult | null>>;
  /** Re-infer the selected element and remount the panel. */
  refreshPanel: (el: Element) => void;
  setClipboardMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setHistoryEntries: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
}

export interface StyleHandlers {
  handleResetAll: () => void;
  handlePasteStyles: () => void;
  handleReset: () => void;
  handleUndoToIndex: (targetIndex: number) => void;
  handleSpacingChange: (prop: string, value: number, unit: string) => void;
  handleSpacingReset: (prop: string, value: number) => void;
}

export function useStyleHandlers({
  selectedEl,
  scopeCtx,
  diffMode,
  historyEntries,
  setInferResult,
  refreshPanel,
  setClipboardMessage,
  setHistoryEntries,
}: StyleHandlersDeps): StyleHandlers {
  // --- Session-wide reset ---
  const handleResetAll = useCallback(() => {
    styleEngine.resetAll();
    if (selectedEl) {
      refreshPanel(selectedEl);
    }
  }, [selectedEl]);

  // --- Paste handler for Footer ---
  const handlePasteStyles = useCallback(() => {
    if (!selectedEl || diffMode) return;
    // Paste lands at the ACTIVE breakpoint (ADR-0005) — base by default.
    const count = pasteStyles(selectedEl, scopeCtx.activeBreakpoint);
    if (count > 0) {
      refreshPanel(selectedEl);
      setClipboardMessage(`${count} style${count === 1 ? "" : "s"} pasted`);
    }
  }, [selectedEl, diffMode, scopeCtx]);

  // --- Reset handler: re-infer to get fresh values ---
  const handleReset = useCallback(() => {
    if (selectedEl) {
      refreshPanel(selectedEl);
    }
  }, [selectedEl]);

  // --- History: undo to a specific index ---
  const handleUndoToIndex = useCallback((targetIndex: number) => {
    // Undo repeatedly until we've removed all entries after targetIndex
    const count = historyEntries.length - 1 - targetIndex;
    for (let i = 0; i < count; i++) {
      const result = undo();
      if (!result) break;
    }
    // Truncate history to targetIndex + 1
    setHistoryEntries((prev) => prev.slice(0, targetIndex + 1));
    // Re-infer if we have a selected element
    if (selectedEl) {
      refreshPanel(selectedEl);
    }
  }, [historyEntries.length, selectedEl]);

  // --- Spacing box model change handler ---
  // Routes through styleEngine (same dispatch as every other panel edit) so the
  // change lands in the DOM AND is tracked for diff/undo/save. Previously this
  // re-implemented the routing inline, and its state branch skipped the
  // composite-key mirror — so pseudo-state spacing edits were silently lost on
  // save and un-undoable (RFC #14, crux #1). Also updates inferResult.spacing so
  // the panel re-renders with fresh values during drag-scrub.
  const handleSpacingChange = useCallback((prop: string, value: number, unit: string) => {
    if (!selectedEl) return;
    const cssValue = `${value}${unit}`;
    // The full scopeCtx (NOT a hand-built subset) so the active breakpoint
    // rides along — omitting it sent breakpoint spacing drags to base.
    const target = resolveTarget(selectedEl, scopeCtx);
    styleEngine.apply(target, prop, cssValue);
    // Update inferResult.spacing so the panel receives fresh prop values
    setInferResult((prev) => applySpacingValue(prev, prop, value));
  }, [selectedEl, scopeCtx]);

  // --- Spacing reset handler (alt+click) ---
  // Only updates inferResult state without re-applying inline styles.
  // The actual DOM reset was already done by resetAndReadNum in SpacingBoxModel.
  const handleSpacingReset = useCallback((prop: string, value: number) => {
    setInferResult((prev) => applySpacingValue(prev, prop, value));
  }, []);

  return {
    handleResetAll,
    handlePasteStyles,
    handleReset,
    handleUndoToIndex,
    handleSpacingChange,
    handleSpacingReset,
  };
}
