/**
 * useOverlayHotkeys.ts — global keyboard shortcut handling for the overlay
 *
 * Owns the single capture-phase keydown/keyup listener that drives every
 * tuner shortcut (undo/redo, save, copy, paste, CSS import, command palette,
 * search, scope/pin/focus toggles, section jumps, diff peek, arrow-key element
 * navigation, backtick toggle, Escape dismiss, …).
 *
 * Extracted verbatim from Overlay.tsx. Behavior is identical: the handler body
 * is unchanged and the effect's dependency array is preserved exactly (same 16
 * entries, same order). In particular `activeState` / `activeClassName` are
 * read by the CSS-import branch but intentionally remain OUT of the dependency
 * array — exactly as in the original — so the stale-closure characteristics are
 * unchanged. Component-scope state, setters, refs and callbacks are passed in
 * via `deps` so the hook never reaches back into Overlay's scope.
 */

import { useEffect } from "react";
import {
  undo,
  redo,
  overrideCount,
  stripAllOverrides,
  restoreAllOverrides,
  applyInlineStyle,
  reset,
  copyStyles,
  pasteStyles,
  beginBatch,
  endBatch,
} from "../core/apply";
import { undoModeOverride, redoModeOverride } from "../variables/modeOverrides";
import { getStableSelector, isNavigableElement } from "../util";
import { applyClassStyle, type Scope } from "../core/scope";
import { applyStateStyle } from "../core/statePreview";
import { isScrubActive } from "../core/scrubState";
import { parseCSSText } from "../cssImport";
import { SECTION_ORDER } from "../panelUtils";
import type { ActivePanel, ActiveModal } from "../shell/overlayTypes";

export interface OverlayHotkeysDeps {
  // --- Values referenced in the effect (those in the dependency array) ---
  selectedEl: Element | null;
  selecting: boolean;
  diffMode: boolean;
  showSearch: boolean;
  activeModal: ActiveModal;
  scope: Scope;
  cssClasses: string[];
  focusMode: boolean;
  activePanel: ActivePanel;
  expandedSection: string | null;
  // --- Values read but intentionally not in the dependency array ---
  activeState: string;
  activeClassName: string | null;
  // --- Callbacks (in the dependency array) ---
  handleSaveShortcut: () => void;
  handleCopyShortcut: () => void;
  handleScopeChange: (newScope: Scope, cls?: string) => void;
  announce: (message: string) => void;
  handleResetAll: () => void;
  handleCloseAttempt: () => void;
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
    scope,
    cssClasses,
    focusMode,
    activePanel,
    expandedSection,
    activeState,
    activeClassName,
    handleSaveShortcut,
    handleCopyShortcut,
    handleScopeChange,
    announce,
    handleResetAll,
    handleCloseAttempt,
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

      // Cmd+Shift+Z / Ctrl+Shift+Z for redo
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        if (diffMode) return;
        e.preventDefault();
        e.stopPropagation();
        const result = redo();
        if (result) {
          refreshPanel(result.el);
          announce("Redo");
        } else {
          redoModeOverride();
        }
        return;
      }

      // Cmd+Z / Ctrl+Z for undo — must fire even when focus is inside panel inputs
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        if (diffMode) return; // Block undo during diff
        e.preventDefault();
        e.stopPropagation(); // prevent DialKit from processing native undo
        const result = undo();
        if (result) {
          // Re-infer to update panel values
          refreshPanel(result.el);
          announce("Undo");
        } else {
          undoModeOverride();
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
          const declarations = parseCSSText(text);
          if (declarations.length === 0) return;
          beginBatch();
          for (const { prop, value } of declarations) {
            if (activeState !== "none") {
              applyStateStyle(el, activeState, prop, value);
            } else {
              if (scope === "class" && activeClassName) {
                applyClassStyle(activeClassName, prop, value);
              }
              applyInlineStyle(el, prop, value);
            }
          }
          endBatch();
          refreshPanel(el);
          setClipboardMessage(`Imported ${declarations.length} propert${declarations.length === 1 ? "y" : "ies"}`);
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
        const count = pasteStyles(selectedEl);
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

      // Cmd+C for copy CSS — must fire even when focus is inside panel inputs
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "c") {
        // Only intercept if no text is selected (don't break normal copy)
        const selection = window.getSelection();
        if (!selection || selection.toString() === "") {
          e.preventDefault();
          e.stopPropagation();
          if (overrideCount(selectedEl) > 0) {
            handleCopyShortcut();
          }
          return;
        }
      }

      // Cmd+K for command palette
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setActiveModal(prev => prev.type === "commandPalette" ? { type: "none" } : { type: "commandPalette" });
        return;
      }

      // Cmd+F / Ctrl+F to toggle property search (when panel is open)
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "f") {
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
          if (scope === "element") {
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

      // Escape: dismiss modal first, then close search, then close panel
      if (e.key === "Escape" && selectedEl && !selecting) {
        if (activeModal.type !== "none") {
          e.preventDefault();
          setActiveModal({ type: "none" });
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
  }, [selectedEl, selecting, diffMode, showSearch, activeModal, handleSaveShortcut, handleCopyShortcut, scope, cssClasses, handleScopeChange, announce, focusMode, activePanel, expandedSection, handleResetAll, handleCloseAttempt]);
}
