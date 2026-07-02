/**
 * useOverlayHotkeys.ts — global keyboard shortcut handling for the overlay
 *
 * Owns the single capture-phase keydown/keyup listener that drives every
 * tuner shortcut (undo/redo, save, copy, paste, CSS import, command palette,
 * search, scope/pin/focus toggles, section jumps, diff peek, arrow-key element
 * navigation, backtick toggle, Escape dismiss, …).
 *
 * Extracted from Overlay.tsx. Component-scope state, setters, refs and
 * callbacks are passed in via `deps` so the hook never reaches back into
 * Overlay's scope. Scoping arrives as Overlay's ONE memoized `scopeCtx`
 * (scope ▸ class ▸ state ▸ breakpoint) — this module never enumerates the
 * dimensions by hand (the hand-built triple in the paste/import branches is
 * how breakpoint edits silently landed on base). `scopeCtx` sits in the
 * dependency array, so the old deliberate stale-closure quirk (activeState /
 * activeClassName outside the array) is gone with the flat fields.
 */

import { useEffect } from "react";
import {
  overrideCount,
  stripAllOverrides,
  restoreAllOverrides,
  reset,
  copyStyles,
  pasteStyles,
} from "../core/apply";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import { getStableSelector, isNavigableElement } from "../util";
import { type Scope } from "../core/scope";
import { isScrubActive } from "../core/scrubState";
import { parseCSSText } from "../cssImport";
import { SECTION_ORDER } from "../panelUtils";
import type { ActivePanel, ActiveModal } from "../shell/overlayTypes";

/**
 * True when `target` is a text control (input/textarea) holding a RANGE
 * selection. `window.getSelection()` reads empty inside text controls in some
 * engines, so Cmd+C must consult selectionStart/End before claiming the combo.
 */
function hasTextControlSelection(target: Element | null): boolean {
  if (
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement)
  ) {
    return false;
  }
  try {
    return (
      target.selectionStart !== null &&
      target.selectionEnd !== null &&
      target.selectionStart !== target.selectionEnd
    );
  } catch {
    return false; // input types without a selection API (e.g. number/email)
  }
}

/**
 * THE CSS-import implementation (issue #87): parse a CSS blob and apply every
 * declaration through the engine at the panel's current scope, wrapped in ONE
 * beginBatch/endBatch so a multi-property import is a SINGLE undo step (this
 * repo's rule: batching via beginBatch/endBatch only, never time-based).
 *
 * Both triggers route through here — the Cmd+Shift+V hotkey below and the
 * Footer's Clipboard ▸ Import CSS menu item. There is deliberately no second
 * copy of this loop: the legacy Footer path (Overlay's handleCSSImport)
 * pushed N separate undo entries, so reverting one paste took N undos.
 *
 * Returns the number of declarations applied (0 = nothing parseable).
 */
export function importCSSText(
  el: Element,
  scopeCtx: ScopeContext,
  text: string,
): number {
  const declarations = parseCSSText(text);
  if (declarations.length === 0) return 0;
  styleEngine.beginBatch();
  try {
    for (const { prop, value } of declarations) {
      // The whole scopeCtx — never a hand-built subset (ADR-0005): the
      // active breakpoint must ride along or imports flatten to base.
      styleEngine.apply(resolveTarget(el, scopeCtx), prop, value);
    }
  } finally {
    styleEngine.endBatch();
  }
  return declarations.length;
}

export interface OverlayHotkeysDeps {
  // --- Values referenced in the effect (those in the dependency array) ---
  selectedEl: Element | null;
  selecting: boolean;
  diffMode: boolean;
  showSearch: boolean;
  activeModal: ActiveModal;
  /** Overlay's ONE memoized scoping bundle (scope ▸ class ▸ state ▸ breakpoint). */
  scopeCtx: ScopeContext;
  cssClasses: string[];
  focusMode: boolean;
  activePanel: ActivePanel;
  expandedSection: string | null;
  // --- Callbacks (in the dependency array) ---
  handleSaveShortcut: () => void;
  handleCopyShortcut: () => void;
  handleScopeChange: (newScope: Scope, cls?: string) => void;
  announce: (message: string) => void;
  handleResetAll: () => void;
  handleCloseAttempt: () => void;
  /**
   * Unsaved-changes bar visibility. While the bar is showing, Escape must act
   * as its "Keep Editing" dismissal — re-running handleCloseAttempt would just
   * re-assert the bar (overrideCount is still > 0), so Escape appeared dead.
   */
  closeWarning: boolean;
  /** Re-infer the selected element and remount the panel. */
  refreshPanel: (el: Element) => void;
  // --- Refs ---
  selectedElRef: React.MutableRefObject<Element | null>;
  selectedSelectorRef: React.MutableRefObject<string | null>;
  diffHoldRef: React.MutableRefObject<boolean>;
  diffTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  // --- Setters ---
  setClipboardMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setSelecting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedEl: React.Dispatch<React.SetStateAction<Element | null>>;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  setCloseWarning: React.Dispatch<React.SetStateAction<boolean>>;
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
  setChangesDrawerTab: React.Dispatch<React.SetStateAction<"pending" | "history">>;
  setChangesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBoxModel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGridOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setActivePanel: React.Dispatch<React.SetStateAction<ActivePanel>>;
  setExpandedSection: React.Dispatch<React.SetStateAction<string | null>>;
  setDiffMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useOverlayHotkeys(deps: OverlayHotkeysDeps) {
  const {
    selectedEl,
    selecting,
    diffMode,
    showSearch,
    activeModal,
    scopeCtx,
    cssClasses,
    focusMode,
    activePanel,
    expandedSection,
    handleSaveShortcut,
    handleCopyShortcut,
    handleScopeChange,
    announce,
    handleResetAll,
    handleCloseAttempt,
    closeWarning,
    refreshPanel,
    selectedElRef,
    selectedSelectorRef,
    diffHoldRef,
    diffTimerRef,
    setClipboardMessage,
    setSelecting,
    setSelectedEl,
    setShowNavigator,
    setShowSearch,
    setSearchQuery,
    setActiveModal,
    setCloseWarning,
    setFocusMode,
    setPinned,
    setChangesDrawerTab,
    setChangesDrawerOpen,
    setShowBoxModel,
    setShowGridOverlay,
    setActivePanel,
    setExpandedSection,
    setDiffMode,
  } = deps;

  // --- Hotkey: backtick toggles selection ---
  // Uses capture phase so Cmd+Z reaches us before DialKit's internal input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target as HTMLElement : null;
      const insidePanel = target?.closest(".__tuner-root");

      // Block all shortcuts while a LabelScrub drag is active
      if (isScrubActive()) return;

      // Interaction context for the modifier combos (audit issue 10: hotkey
      // hijacking). A combo may only be claimed when the user is actually
      // interacting with the overlay — or when the overlay legitimately owns
      // it globally (Cmd+S, and the overlay-specific Alt/Shift chords).
      // NOTE: the plain-key guard further down keeps its own `tag`/`isTyping`
      // locals — its position after the modifier branches is pinned by tests.
      const insideTunerUI =
        !!insidePanel || !!target?.closest("[data-tuner-portal]");
      const targetTag = target?.tagName?.toLowerCase();
      const isEditableTarget =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        !!target?.isContentEditable;
      // A text-entry surface that belongs to the HOST PAGE (not the tuner):
      // its native undo/copy/find must always win over overlay shortcuts.
      const isHostEditingContext = isEditableTarget && !insideTunerUI;

      // Cmd+Shift+Z / Ctrl+Shift+Z for redo — same undo-focus gate as Cmd+Z:
      // fires inside the tuner UI (even in panel inputs); host text fields keep
      // their native redo; on the page it claims only when the engine actually
      // replays an overlay step. styleEngine.redo() steps the ONE unified
      // temporal stack (RFC #14 4a).
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        if (diffMode) return;
        if (isHostEditingContext) return;
        const result = styleEngine.redo();
        if (!result && !insideTunerUI) return;
        e.preventDefault();
        e.stopPropagation();
        if (result) {
          refreshPanel(result.el);
          announce("Redo");
        }
        return;
      }

      // Cmd+Z / Ctrl+Z for undo — claimed only with overlay undo focus: it
      // must fire even in panel inputs, but host text fields keep their native
      // undo, and on the page it claims only when the engine actually reverts
      // an overlay step (styleEngine.undo() steps the ONE unified temporal
      // stack, RFC #14 4a) — otherwise the host app keeps its own undo.
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        if (diffMode) return; // Block undo during diff
        if (isHostEditingContext) return;
        const result = styleEngine.undo();
        if (!result && !insideTunerUI) return;
        e.preventDefault();
        e.stopPropagation(); // prevent DialKit from processing native undo
        if (result) {
          // Re-infer to update panel values
          refreshPanel(result.el);
          announce("Undo");
        }
        return;
      }

      // Cmd+Alt+C for copy styles to clipboard
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.altKey && e.key === "c") {
        e.preventDefault();
        e.stopPropagation();
        const count = copyStyles(selectedEl);
        if (count > 0) {
          setClipboardMessage(`${count} style${count === 1 ? "" : "s"} copied`);
        }
        return;
      }

      // Cmd+Shift+V for CSS import from clipboard
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "v") {
        if (diffMode) return;
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.readText().then((text) => {
          const el = selectedElRef.current;
          if (!el) return;
          // The ONE batched import implementation (issue #87) — shared with
          // the Footer's Clipboard ▸ Import CSS menu item.
          const count = importCSSText(el, scopeCtx, text);
          if (count === 0) return;
          refreshPanel(el);
          setClipboardMessage(`Imported ${count} propert${count === 1 ? "y" : "ies"}`);
        }).catch(() => {
          setClipboardMessage("Clipboard access denied");
        });
        return;
      }

      // Cmd+Alt+V for paste styles from clipboard
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.altKey && e.key === "v") {
        if (diffMode) return;
        e.preventDefault();
        e.stopPropagation();
        // Paste lands at the ACTIVE breakpoint (ADR-0005) — base by default.
        const count = pasteStyles(selectedEl, scopeCtx.activeBreakpoint);
        if (count > 0) {
          refreshPanel(selectedEl);
          setClipboardMessage(`${count} style${count === 1 ? "" : "s"} pasted`);
        }
        return;
      }

      // Cmd+S for save — must fire even when focus is inside panel inputs
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (diffMode) return; // Block save during diff peek (overrides are stripped)
        if (overrideCount(selectedEl) > 0) {
          handleSaveShortcut();
        }
        return;
      }

      // Never steal a real copy (audit issue 10): pass through on a page text
      // selection, on a text-control range selection (window.getSelection()
      // reads empty inside text controls), and in host editing surfaces.
      // Cmd+C for copy CSS — must fire even when focus is inside panel inputs
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "c") {
        // Only intercept if no text is selected (don't break normal copy)
        const selection = window.getSelection();
        const skip = (!!selection && selection.toString() !== "") ||
          isHostEditingContext || hasTextControlSelection(target);
        if (!skip) {
          e.preventDefault();
          e.stopPropagation();
          if (overrideCount(selectedEl) > 0) {
            handleCopyShortcut();
          }
          return;
        }
      }

      // Cmd+K for command palette — claimed only while focus is in the tuner
      // UI, so host command palettes keep working on the page
      if (selectedEl && insideTunerUI && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setActiveModal(prev => prev.type === "commandPalette" ? { type: "none" } : { type: "commandPalette" });
        return;
      }

      // Cmd+F / Ctrl+F to toggle property search — claimed only while focus is
      // in the tuner UI (browser find-in-page owns Cmd+F on the page)
      if (selectedEl && insideTunerUI && (e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch((v) => {
          if (v) {
            // Closing: clear query too
            setSearchQuery("");
            return false;
          }
          return true;
        });
        return;
      }

      // For all other shortcuts, skip when typing in inputs or inside our panel/portals
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      const isInsideTunerUI = insidePanel || !!target?.closest("[data-tuner-portal]");
      if (isTyping || isInsideTunerUI) return;

      // N to toggle navigator (no modifier, no selectedEl required)
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !selecting) {
        e.preventDefault();
        setShowNavigator((v) => !v);
        return;
      }

      // / to open property search (when not in input/textarea)
      if (e.key === "/" && selectedEl && !selecting) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // ? to toggle keyboard help modal / shortcuts help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveModal(prev => prev.type === "shortcutsHelp" ? { type: "none" } : { type: "shortcutsHelp" });
        return;
      }

      // Alt+Shift+S to toggle focus mode
      if (e.key === "S" && e.altKey && e.shiftKey && selectedEl) {
        e.preventDefault();
        setFocusMode(prev => !prev);
        return;
      }

      // S to cycle scope
      if (e.key === "s" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        // cycle between "element" and "class" scope
        // Only cycle if there are CSS classes available
        if (cssClasses.length > 0) {
          if (scopeCtx.scope === "element") {
            handleScopeChange("class", cssClasses[0]);
          } else {
            handleScopeChange("element");
          }
        }
        return;
      }

      // P to toggle pin
      if (e.key === "p" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setPinned(p => !p);
        return;
      }

      // Shift+R to reset ALL elements
      if (e.key === "R" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedEl && !selecting && !diffMode) {
        e.preventDefault();
        handleResetAll();
        announce("Reset all");
        return;
      }

      // R to reset
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting && !diffMode) {
        e.preventDefault();
        if (overrideCount(selectedEl) > 0) {
          reset(selectedEl);
          refreshPanel(selectedEl);
          announce("Reset");
        }
        return;
      }

      // H to toggle changes drawer (history tab)
      if (e.key === "h" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setChangesDrawerTab("history");
        setChangesDrawerOpen((v) => !v);
        return;
      }

      // M to toggle box model overlay
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setShowBoxModel((v) => !v);
        return;
      }

      // G to toggle grid overlay
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setShowGridOverlay((v) => !v);
        return;
      }

      // T to toggle Style / AI tab
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setActivePanel((prev) =>
          prev.type === "inspector" && prev.tab === "custom"
            ? { type: "inspector", tab: "prompt" }
            : { type: "inspector", tab: "custom" }
        );
        return;
      }

      // 1-8: jump to section (auto-enables focus mode)
      if (selectedEl && !selecting && e.key >= "1" && e.key <= "8" && !e.metaKey && !e.ctrlKey) {
        const idx = parseInt(e.key) - 1;
        if (idx < SECTION_ORDER.length) {
          e.preventDefault();
          if (!focusMode) setFocusMode(true);
          setExpandedSection(SECTION_ORDER[idx]);
          // Ensure we're on the Style tab
          if (!(activePanel.type === "inspector" && activePanel.tab === "custom")) setActivePanel({ type: "inspector", tab: "custom" });
          return;
        }
      }

      // [ / ] to cycle sections in focus mode
      if ((e.key === "[" || e.key === "]") && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        if (!focusMode) setFocusMode(true);
        if (!(activePanel.type === "inspector" && activePanel.tab === "custom")) setActivePanel({ type: "inspector", tab: "custom" });
        const currentIdx = expandedSection ? SECTION_ORDER.indexOf(expandedSection as typeof SECTION_ORDER[number]) : -1;
        let nextIdx: number;
        if (e.key === "]") {
          nextIdx = currentIdx < SECTION_ORDER.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : SECTION_ORDER.length - 1;
        }
        setExpandedSection(SECTION_ORDER[nextIdx]);
        return;
      }

      if (e.key === "`" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedEl && !selecting) {
          // Closing the panel — check for unsaved changes
          handleCloseAttempt();
        } else {
          setSelecting((s) => !s);
        }
      }

      // N to toggle navigator — moved below input guard (line ~498)
      // so it doesn't fire while typing in text fields

      // Escape: dismiss modal first, then the unsaved-changes bar, then close
      // search, then close panel
      if (e.key === "Escape" && selectedEl && !selecting) {
        if (activeModal.type !== "none") {
          e.preventDefault();
          setActiveModal({ type: "none" });
          return;
        }
        if (closeWarning) {
          // The bar is the pending question — Escape answers it with "Keep
          // Editing" (dismiss only). NOT the discard, and NOT another
          // handleCloseAttempt: that would just re-set closeWarning to true
          // (overrides are still unsaved), leaving Escape apparently dead.
          e.preventDefault();
          setCloseWarning(false);
          return;
        }
        if (showSearch) {
          e.preventDefault();
          setSearchQuery("");
          setShowSearch(false);
          return;
        }
        handleCloseAttempt();
      }

      // D for diff peek (hold) / toggle (handled by button)
      // Uses a debounce to prevent visual flash on quick taps (<150ms)
      if (e.key === "d" && !e.repeat && selectedEl && !selecting && !e.metaKey && !e.ctrlKey) {
        if (overrideCount(selectedEl) === 0) return;
        diffHoldRef.current = true;
        diffTimerRef.current = setTimeout(() => {
          diffTimerRef.current = null;
          stripAllOverrides();
          setDiffMode(true);
        }, 150);
      }

      // Arrow key element navigation: ↑ parent, ↓ first visible child, ←/→ siblings
      // Skip when focus is inside the panel (lets dropdown comboboxes handle arrow keys)
      if (selectedEl && !selecting && !diffMode && !insidePanel && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        let next: Element | null = null;

        if (e.key === "ArrowUp") {
          next = selectedEl.parentElement;
        } else if (e.key === "ArrowDown") {
          let child = selectedEl.firstElementChild;
          while (child && !isNavigableElement(child)) child = child.nextElementSibling;
          next = child;
        } else if (e.key === "ArrowLeft") {
          let sib = selectedEl.previousElementSibling;
          while (sib && !isNavigableElement(sib)) sib = sib.previousElementSibling;
          next = sib;
        } else if (e.key === "ArrowRight") {
          let sib = selectedEl.nextElementSibling;
          while (sib && !isNavigableElement(sib)) sib = sib.nextElementSibling;
          next = sib;
        }

        if (!next || !isNavigableElement(next)) return;

        e.preventDefault();
        setSelectedEl(next);
        selectedSelectorRef.current = getStableSelector(next);
        refreshPanel(next);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Restore overrides when D is released (hold-to-peek)
      if (e.key === "d" && diffHoldRef.current) {
        diffHoldRef.current = false;
        if (diffTimerRef.current !== null) {
          // Released before debounce fired — cancel timer, no visual change (prevents flash)
          clearTimeout(diffTimerRef.current);
          diffTimerRef.current = null;
        } else {
          // Released after debounce — restore overrides
          restoreAllOverrides();
          setDiffMode(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true); // capture phase
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedEl, selecting, diffMode, showSearch, activeModal, closeWarning, handleSaveShortcut, handleCopyShortcut, scopeCtx, cssClasses, handleScopeChange, announce, focusMode, activePanel, expandedSection, handleResetAll, handleCloseAttempt]);
}
