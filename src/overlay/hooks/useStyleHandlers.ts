/**
 * useStyleHandlers.ts — style-mutation callbacks for the overlay
 *
 * Bundles the cluster of Overlay callbacks that mutate styles (via
 * core/apply.ts) and/or re-infer the panel: session-wide reset, paste,
 * per-element reset, undo-to-history-index, and the spacing box-model
 * change/reset handlers.
 *
 * Extracted verbatim from Overlay.tsx — behavior and dependency arrays are
 * preserved exactly. The hook receives the values/setters each callback
 * closes over so nothing reaches back into Overlay's scope via globals.
 */

import { useCallback } from "react";
import { infer, type InferResult } from "../core/infer";
import {
  resetAll,
  pasteStyles,
  applyInlineStyle,
  undo,
} from "../core/apply";
import { destroyClassStyles, applyClassStyle } from "../core/scope";
import { applyStateStyle, destroyStateStyles } from "../core/statePreview";
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
  scope: string;
  activeClassName: string | null;
  activeState: string;
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
  scope,
  activeClassName,
  activeState,
  diffMode,
  historyEntries,
  setInferResult,
  refreshPanel,
  setClipboardMessage,
  setHistoryEntries,
}: StyleHandlersDeps): StyleHandlers {
  // --- Session-wide reset ---
  const handleResetAll = useCallback(() => {
    resetAll();
    destroyClassStyles();
    destroyStateStyles();
    if (selectedEl) {
      refreshPanel(selectedEl);
    }
  }, [selectedEl]);

  // --- Paste handler for Footer ---
  const handlePasteStyles = useCallback(() => {
    if (!selectedEl || diffMode) return;
    const count = pasteStyles(selectedEl);
    if (count > 0) {
      refreshPanel(selectedEl);
      setClipboardMessage(`${count} style${count === 1 ? "" : "s"} pasted`);
    }
  }, [selectedEl, diffMode]);

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
  // Updates both the DOM (via applyInlineStyle) and the inferResult.spacing
  // so the panel re-renders with fresh values during drag-scrub.
  const handleSpacingChange = useCallback((prop: string, value: number, unit: string) => {
    if (!selectedEl) return;
    const cssValue = `${value}${unit}`;
    if (activeState !== "none") {
      applyStateStyle(selectedEl, activeState, prop, cssValue);
    } else {
      if (scope === "class" && activeClassName) {
        applyClassStyle(activeClassName, prop, cssValue);
      }
      applyInlineStyle(selectedEl, prop, cssValue);
    }
    // Update inferResult.spacing so the panel receives fresh prop values
    setInferResult((prev) => applySpacingValue(prev, prop, value));
  }, [selectedEl, scope, activeClassName, activeState]);

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
