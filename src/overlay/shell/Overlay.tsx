/**
 * Overlay.tsx — Main Tuner overlay
 *
 * Manages the full lifecycle:
 * 1. Hotkey toggles selection mode
 * 2. Selector captures an element
 * 3. WebflowPanel renders CSS property sections
 * 4. Header/Footer provide chrome
 *
 * The overlay is a fixed-position container at max z-index.
 */

import { useState, useCallback, useEffect, useRef, useMemo, useSyncExternalStore, Component, type ReactNode, type ErrorInfo } from "react";
import { Selector } from "./Selector";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WebflowPanel } from "./WebflowPanel";

import { PromptPanel } from "./PromptPanel";
import { ChangesDrawer, type HistoryEntry, type ChangesTab } from "./ChangesDrawer";
import { GridOverlay } from "../overlays/GridOverlay";
import { BoxModelOverlay } from "../overlays/BoxModelOverlay";
import { SECTION_ORDER } from "../panelUtils";
import { FlexGapOverlay } from "../overlays/FlexGapOverlay";
import { SpacingGuidesOverlay } from "../overlays/SpacingGuidesOverlay";
import { SpacingPreviewOverlay } from "../overlays/SpacingPreviewOverlay";
import { infer, type InferResult } from "../core/infer";
import { undo, redo, clearRedundantOverrides, resetAll, stripAllOverrides, restoreAllOverrides, overrideCount, restoreSession, applyInlineStyle, diff, reset, copyStyles, pasteStyles, hasClipboardStyles, subscribeOverrides, getOverrideSnapshot, beginBatch, endBatch, subscribeChanges } from "../core/apply";
import { undoModeOverride, redoModeOverride } from "../variables/modeOverrides";
import { buildBreadcrumb, getStableSelector, getSelector, formatCSSDiff, isNavigableElement } from "../util";

import { onHmrUpdate } from "../core/hmr";
import { getCSSModuleClasses, destroyClassStyles, applyClassStyle, type Scope } from "../core/scope";
import { applyStateStyle, diffState, destroyStateStyles, syncWithApplyUndoRedo } from "../core/statePreview";
import { enrichChangesForCommit } from "../core/commitUtils";
import { Toolbar } from "./Toolbar";
import { GlobalVariablesPanel } from "../variables/GlobalVariablesPanel";
import { getVariablesPanelWidth } from "../variables/panelWidth";
import { timing, ms, setReducedMotion, springConfig } from "../timing";
import { AnimatePresence, motion } from "motion/react";
import { isScrubActive } from "../core/scrubState";
import { PropertySearch } from "./PropertySearch";
import { CommandPalette } from "./CommandPalette";
import { ContextMenu } from "./ContextMenu";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { parseCSSText } from "../cssImport";
import { formatTailwindDiff } from "../tailwind";
import { NavigatorPanel } from "../navigator/NavigatorPanel";
import { useElementTracker } from "../hooks/useElementTracker";
import { useOverlayDrag } from "../hooks/useOverlayDrag";
import { getConfig } from "../core/config";
import { color, text, border, surface, font, shadow, blackAlpha, bgAlpha, primaryAlpha, destructiveAlpha, layout, zIndex } from "../theme";

// --- Panel State Type ---

export type ActivePanel =
  | { type: "none" }
  | { type: "inspector"; tab: "custom" | "prompt" }
  | { type: "variables" };

// --- Error Boundary for Panel resilience ---
class PanelErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[Tuner] Panel error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, fontSize: 11, color: text.disabled }}>
          <div style={{ marginBottom: 6 }}>Panel crashed — try selecting a different element.</div>
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onError?.();
            }}
            style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, fontSize: 11, borderRadius: 4, cursor: "pointer", border: `1px solid ${blackAlpha(0.07)}`, background: surface.hover, color: text.label }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Overlay() {
  const [selecting, setSelecting] = useState(false);
  const [selectedEl, setSelectedEl] = useState<Element | null>(null);
  const [pinned, setPinned] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const selectedElRef = useRef(selectedEl);
  useEffect(() => { selectedElRef.current = selectedEl; }, [selectedEl]);
  const [inferResult, setInferResult] = useState<InferResult | null>(null);
  const [panelKey, setPanelKeyRaw] = useState(0); // force re-mount on new selection
  const [sectionMemory, setSectionMemory] = useState<Record<string, boolean>>({}); // collapse memory across re-mounts
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  /** Helper to get the scrollable viewport element */
  const getScrollViewport = useCallback(() => {
    return panelScrollRef.current;
  }, []);
  /** Wrapper that saves scroll position before triggering a remount */
  const setPanelKey: typeof setPanelKeyRaw = useCallback((v) => {
    const viewport = getScrollViewport();
    if (viewport) {
      savedScrollRef.current = viewport.scrollTop;
    }
    setPanelKeyRaw(v);
  }, [getScrollViewport]);

  // Unified panel state — discriminated union prevents impossible states
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: "none" });
  const [variablesModeCount, setVariablesModeCount] = useState(0);
  const totalChanges = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);

  // Scope toggle
  const [scope, setScope] = useState<Scope>("element");
  const [activeClassName, setActiveClassName] = useState<string | null>(null);
  const cssClasses = useMemo(() => selectedEl ? getCSSModuleClasses(selectedEl) : [], [selectedEl]);

  // State selector
  const [activeState, setActiveState] = useState("none");

  // Guarded state change — refuse mid-drag to avoid race conditions
  const handleStateChange = useCallback((newState: string) => {
    if (isScrubActive()) return;
    setActiveState(newState);
  }, []);

  // Grid overlay toggle
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  // Box model overlay toggle
  const [showBoxModel, setShowBoxModel] = useState(false);

  // Lifted section expansion state (for keyboard navigation)
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const isGridContainer = useMemo(() => {
    if (!selectedEl) return false;
    const d = getComputedStyle(selectedEl).display;
    return d === "grid" || d === "inline-grid";
  }, [selectedEl, panelKey]);

  const isFlexContainer = useMemo(() => {
    if (!selectedEl) return false;
    const d = getComputedStyle(selectedEl).display;
    return d === "flex" || d === "inline-flex";
  }, [selectedEl, panelKey]);

  // Property search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state (discriminated union — only one modal open at a time)
  type ActiveModal =
    | { type: "none" }
    | { type: "commandPalette" }
    | { type: "shortcutsHelp" }
    | { type: "contextMenu"; x: number; y: number };
  const [activeModal, setActiveModal] = useState<ActiveModal>({ type: "none" });

  // Style clipboard message
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);

  // Focus mode: one section open at a time (Phase K)
  const [focusMode, setFocusMode] = useState(false);

  // Unsaved changes warning
  const [closeWarning, setCloseWarning] = useState(false);

  // First-use hint bar (dismissed after 5s or interaction, never shows again)
  const [showHintBar, setShowHintBar] = useState(() => {
    try { return localStorage.getItem("redial:hintDismissed") !== "true"; } catch { return true; }
  });
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Changes drawer (unified pending + history)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [changesDrawerOpen, setChangesDrawerOpen] = useState(false);
  const [changesDrawerTab, setChangesDrawerTab] = useState<ChangesTab>("pending");

  // Subscribe to property changes for history tracking (debounced to avoid flooding during drags)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHistoryRef = useRef<HistoryEntry | null>(null);
  useEffect(() => {
    const unsub = subscribeChanges((info) => {
      const entry: HistoryEntry = {
        timestamp: Date.now(),
        property: info.prop,
        from: info.from,
        to: info.to,
        selector: getSelector(info.el),
      };
      // Debounce: coalesce rapid changes to the same prop on the same element
      if (
        pendingHistoryRef.current &&
        pendingHistoryRef.current.property === entry.property &&
        pendingHistoryRef.current.selector === entry.selector
      ) {
        // Update the pending entry's "to" value
        pendingHistoryRef.current.to = entry.to;
        pendingHistoryRef.current.timestamp = entry.timestamp;
        return;
      }
      // Flush previous pending entry
      if (pendingHistoryRef.current) {
        const pending = pendingHistoryRef.current;
        setHistoryEntries((prev) => [...prev, pending]);
      }
      pendingHistoryRef.current = entry;
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      historyTimerRef.current = setTimeout(() => {
        if (pendingHistoryRef.current) {
          const pending = pendingHistoryRef.current;
          setHistoryEntries((prev) => [...prev, pending]);
          pendingHistoryRef.current = null;
        }
      }, 300);
    });
    return () => {
      unsub();
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      // Flush on unmount
      if (pendingHistoryRef.current) {
        pendingHistoryRef.current = null;
      }
    };
  }, []);

  // Sync statePreview.ts <style> tag with apply.ts undo/redo
  useEffect(() => syncWithApplyUndoRedo(), []);

  // Auto-dismiss hint bar after 5 seconds
  useEffect(() => {
    if (!showHintBar || !selectedEl) return;
    hintTimerRef.current = setTimeout(() => {
      setShowHintBar(false);
      try { localStorage.setItem("redial:hintDismissed", "true"); } catch {}
    }, 5000);
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [showHintBar, selectedEl]);

  // Diff mode (Phase 1)
  const [diffMode, setDiffMode] = useState(false);
  const diffHoldRef = useRef(false); // distinguishes hold-D from button toggle
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce timer for diff peek

  // ─── Accessibility: prefers-reduced-motion (Item 59) ───────────────
  const [reducedMotion, setReducedMotionState] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const v = mq.matches;
      setReducedMotionState(v);
      setReducedMotion(v);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ─── Accessibility: screen reader announcements (Item 60) ──────────
  const [announcement, setAnnouncement] = useState("");
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((message: string) => {
    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    setAnnouncement(message);
    announcementTimerRef.current = setTimeout(() => setAnnouncement(""), 1000);
  }, []);

  // Selected element outline ref (Phase 2)
  const selectedOutlineRef = useRef<HTMLDivElement>(null);

  // Breadcrumb hover ancestor highlight
  const [hoveredAncestor, setHoveredAncestor] = useState<Element | null>(null);
  const ancestorOutlineRef = useRef<HTMLDivElement>(null);

  // Hover highlight ref (shows preview when hovering a different element while panel is open)
  const hoverHighlightRef = useRef<HTMLDivElement>(null);

  // Dimensions badge + tag label refs
  const dimensionsBadgeRef = useRef<HTMLDivElement>(null);
  const tagLabelRef = useRef<HTMLDivElement>(null);

  // Stable selector for re-resolving after HMR
  const selectedSelectorRef = useRef<string | null>(null);

  // Save-in-flight guard to prevent double-save
  const savingRef = useRef(false);

  // Queued tab to open after selector picks an element (e.g. AI button clicked with no selection)
  const pendingTabRef = useRef<"prompt" | null>(null);

  // Panel position (draggable) — owns pos/anchor/snap state + drag interaction
  const { pos, setPos, anchor, setAnchor, snapping, panelDragging, handleDragStart } =
    useOverlayDrag(activePanel.type, variablesModeCount);

  const handleScopeChange = useCallback((newScope: Scope, cls?: string) => {
    setScope(newScope);
    setActiveClassName(newScope === "class" ? (cls ?? null) : null);
  }, []);

  // --- Keyboard shortcut helpers ---
  const handleSaveShortcut = useCallback(async () => {
    const el = selectedElRef.current;
    if (!el || savingRef.current) return;

    // Use state-specific diff when a pseudo-class state is active
    const isStateActive = activeState !== "none";
    const changes = isStateActive ? diffState(el, activeState) : diff(el);
    if (changes.length === 0) return;

    const enriched = enrichChangesForCommit(el, changes, { scope, activeClassName, activeState });

    savingRef.current = true;
    try {
      const res = await fetch(getConfig().commitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(enriched[0]?.mode ? { mode: enriched[0].mode } : {}),
          changes: enriched,
        }),
      });
      // Re-read ref after await — selectedEl may have changed during the fetch
      const currentEl = selectedElRef.current;
      if (res.ok && currentEl) {
        setInferResult(infer(currentEl));
        setPanelKey((k) => k + 1);
        announce("Saved");
      } else if (!res.ok) {
        console.warn("[Tuner] Save failed:", res.status, res.statusText);
      }
    } catch (err) {
      console.warn("[Tuner] Save error:", err);
    } finally {
      savingRef.current = false;
    }
  }, [announce, activeState, scope, activeClassName]);

  const handleCopyShortcut = useCallback(() => {
    if (!selectedEl) return;
    const changes = diff(selectedEl);
    if (changes.length === 0) return;
    navigator.clipboard.writeText(formatCSSDiff(selectedEl, changes)).then(() => {
      announce("Copied CSS");
    }).catch(() => {
      // Clipboard API unavailable (non-HTTPS or permission denied) — silent fallback
    });
  }, [selectedEl, announce]);

  // --- Session-wide reset (must be before hotkey useEffect that references it) ---
  const handleResetAll = useCallback(() => {
    resetAll();
    destroyClassStyles();
    destroyStateStyles();
    if (selectedEl) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
    }
  }, [selectedEl]);

  // --- Close handlers (must be before hotkey useEffect that references them) ---
  const handleClose = useCallback(() => {
    setSelectedEl(null);
    selectedSelectorRef.current = null;
    setInferResult(null);
    setScope("element");
    setActiveClassName(null);
    setActiveState("none");
    setShowSearch(false);
    setSearchQuery("");
    setActivePanel({ type: "none" });
    setActiveModal({ type: "none" });
    setCloseWarning(false);
    setShowNavigator(false);
    announce("Element deselected");
  }, [announce]);

  const handleCloseAttempt = useCallback(() => {
    if (selectedElRef.current && overrideCount(selectedElRef.current) > 0) {
      setCloseWarning(true);
    } else {
      handleClose();
    }
  }, [handleClose]);

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
          setInferResult(infer(result.el));
          setPanelKey((k) => k + 1);
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
          setInferResult(infer(result.el));
          setPanelKey((k) => k + 1);
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
          setInferResult(infer(el));
          setPanelKey((k) => k + 1);
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
          setInferResult(infer(selectedEl));
          setPanelKey((k) => k + 1);
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
          setInferResult(infer(selectedEl));
          setPanelKey((k) => k + 1);
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
        setInferResult(infer(next));
        setPanelKey((k) => k + 1);
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

  // --- Clipboard message auto-clear ---
  useEffect(() => {
    if (!clipboardMessage) return;
    const timer = setTimeout(() => setClipboardMessage(null), 1500);
    return () => clearTimeout(timer);
  }, [clipboardMessage]);

  // --- Paste handler for Footer ---
  const handlePasteStyles = useCallback(() => {
    if (!selectedEl || diffMode) return;
    const count = pasteStyles(selectedEl);
    if (count > 0) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
      setClipboardMessage(`${count} style${count === 1 ? "" : "s"} pasted`);
    }
  }, [selectedEl, diffMode]);

  // --- Element selection ---
  const handleSelect = useCallback((el: Element) => {
    setSelecting(false);
    setSelectedEl(el);
    setPinned(false);
    selectedSelectorRef.current = getStableSelector(el);
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
    // Default to class scope when classes detected, element otherwise
    const classes = getCSSModuleClasses(el);
    if (classes.length > 0) {
      setScope("class");
      setActiveClassName(classes[0]);
    } else {
      setScope("element");
      setActiveClassName(null);
    }
    const queuedTab = pendingTabRef.current;
    pendingTabRef.current = null;
    setActivePanel({ type: "inspector", tab: queuedTab ?? "custom" });
    setShowNavigator(true);
    setShowGridOverlay(false);
    setShowBoxModel(false);
    setExpandedSection(null);
    setChangesDrawerOpen(false);
    setShowSearch(false);
    setSearchQuery("");
    setActiveModal({ type: "none" });
    setCloseWarning(false);
    // Screen reader announcement
    const tag = el.tagName.toLowerCase();
    const cls = el.classList.length > 0 ? el.classList[0] : "";
    announce(`Selected ${tag}${cls ? `.${cls}` : ""}`);
    // Reset position to top-right default
    setPos({ x: window.innerWidth - 300 - 16, y: 16 });
    setAnchor("right");
  }, []);

  // --- Programmatic selection via custom event ---
  // Allows external code (e.g. demo pages) to select an element:
  //   document.dispatchEvent(new CustomEvent('tuner:select', { detail: el }))
  useEffect(() => {
    const handler = (e: Event) => {
      const el = (e as CustomEvent<Element>).detail;
      if (el instanceof Element) handleSelect(el);
    };
    document.addEventListener("tuner:select", handler);
    return () => document.removeEventListener("tuner:select", handler);
  }, [handleSelect]);

  const handleCancel = useCallback(() => {
    setSelecting(false);
    pendingTabRef.current = null;
  }, []);

  const handleTogglePin = useCallback(() => setPinned(p => !p), []);

  // --- Reset handler: re-infer to get fresh values ---
  const handleReset = useCallback(() => {
    if (selectedEl) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
    }
  }, [selectedEl]);


  const handleToggleSession = useCallback(() => {
    setSelecting(false);
    setChangesDrawerTab("pending");
    setChangesDrawerOpen((v) => !v);
  }, []);

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
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
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
    setInferResult((prev) => {
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
    });
  }, [selectedEl, scope, activeClassName, activeState]);

  // --- Spacing reset handler (alt+click) ---
  // Only updates inferResult state without re-applying inline styles.
  // The actual DOM reset was already done by resetAndReadNum in SpacingBoxModel.
  const handleSpacingReset = useCallback((prop: string, value: number) => {
    setInferResult((prev) => {
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
    });
  }, []);

  // --- Diff toggle (button click) ---
  const handleToggleDiff = useCallback(() => {
    if (!selectedEl || overrideCount(selectedEl) === 0) return;
    // Don't toggle via button while keyboard hold is active
    if (diffHoldRef.current) return;
    setDiffMode((prev) => {
      if (prev) {
        restoreAllOverrides();
        return false;
      } else {
        stripAllOverrides();
        return true;
      }
    });
  }, [selectedEl]);

  // --- Cleanup: restore overrides if component unmounts during diff ---
  useEffect(() => {
    return () => {
      if (diffTimerRef.current !== null) {
        clearTimeout(diffTimerRef.current);
        diffTimerRef.current = null;
      }
      if (diffMode) {
        restoreAllOverrides();
      }
    };
  }, [diffMode]);

  // --- Breadcrumb click handler (Phase 2) ---
  const handleBreadcrumbClick = useCallback((el: Element) => {
    setHoveredAncestor(null);
    setSelectedEl(el);
    selectedSelectorRef.current = getStableSelector(el);
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
  }, []);

  // --- Persistent outline for selected element (Phase 2) ---
  // Event-driven tracking via ResizeObserver + scroll/resize listeners
  // (replaces infinite RAF loop — only recalculates when something changes)

  // Build tag label text when element changes
  useEffect(() => {
    if (!selectedEl || selecting || !tagLabelRef.current) return;
    const elTag = selectedEl.tagName.toLowerCase();
    const firstClass = selectedEl.classList.length > 0 ? selectedEl.classList[0] : null;
    tagLabelRef.current.textContent = firstClass ? `${elTag}.${firstClass}` : elTag;
  }, [selectedEl, selecting]);

  useElementTracker(
    selectedEl,
    !selecting && !!selectedOutlineRef.current,
    useCallback((rect: DOMRect) => {
      const outline = selectedOutlineRef.current;
      if (!outline) return;
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.style.display = "block";

      const badge = dimensionsBadgeRef.current;
      if (badge) {
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        badge.textContent = `${w} × ${h}`;
        badge.style.top = `${rect.bottom + 4}px`;
        badge.style.left = `${rect.right}px`;
        badge.style.transform = "translateX(-100%)";
        badge.style.display = "block";
      }

      const tagEl = tagLabelRef.current;
      if (tagEl) {
        tagEl.style.top = `${rect.top - 4}px`;
        tagEl.style.left = `${rect.left}px`;
        tagEl.style.transform = "translateY(-100%)";
        tagEl.style.display = "block";
      }
    }, []),
    useCallback(() => {
      // Element disconnected (HMR, navigation)
      const outline = selectedOutlineRef.current;
      if (outline) outline.style.display = "none";
      if (dimensionsBadgeRef.current) dimensionsBadgeRef.current.style.display = "none";
      if (tagLabelRef.current) tagLabelRef.current.style.display = "none";
    }, []),
  );

  // --- Outline pulse on new element selection ---
  useEffect(() => {
    const outline = selectedOutlineRef.current;
    if (!outline || !selectedEl || selecting) return;
    outline.classList.remove("--pulse");
    // Force reflow so re-adding triggers animation restart
    void outline.offsetWidth;
    outline.classList.add("--pulse");
    const timer = setTimeout(() => outline.classList.remove("--pulse"), timing.toolbar);
    return () => { clearTimeout(timer); outline.classList.remove("--pulse"); };
  }, [panelKey, selectedEl, selecting]);

  // --- Breadcrumb ancestor hover outline ---
  // Event-driven tracking (replaces infinite RAF loop)
  useElementTracker(
    hoveredAncestor,
    !!ancestorOutlineRef.current,
    useCallback((rect: DOMRect) => {
      const outline = ancestorOutlineRef.current;
      if (!outline) return;
      outline.style.display = "block";
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
    }, []),
    useCallback(() => {
      if (ancestorOutlineRef.current) ancestorOutlineRef.current.style.display = "none";
    }, []),
  );

  // --- Breadcrumb computation (Phase 2) ---
  const breadcrumb = useMemo(() => selectedEl ? buildBreadcrumb(selectedEl) : [], [selectedEl]);

  // --- Restore persisted session on mount ---
  useEffect(() => {
    restoreSession();
  }, []);

  // --- Tame Next.js dev overlay z-index so it doesn't cover the panel ---
  useEffect(() => {
    const STYLE_ID = "__tuner-nextjs-fix";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `nextjs-portal { z-index: 2147483640 !important; }`;
    document.head.appendChild(style);

    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  // --- Focus ring styles (global, scoped to tuner root) ---
  useEffect(() => {
    const STYLE_ID = "__tuner-focus-ring";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".__tuner-root *:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.3); } .__tuner-root *:focus:not(:focus-visible) { outline: none; } .__tuner-root *:hover > .__tuner-drag-handle { opacity: 0.4; } @keyframes tuner-outline-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,119,87,0.4); } 50% { box-shadow: 0 0 0 4px rgba(217,119,87,0.15); } 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0); } } .__tuner-selected-outline.--pulse { animation: tuner-outline-pulse 400ms ease-out; }";
    document.head.appendChild(style);

    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  // --- HMR auto-reset (Turbopack + Vite + webpack) ---
  useEffect(() => {
    const cleanup = onHmrUpdate(() => {
      const cleared = clearRedundantOverrides();

      // Re-resolve the selected element if it was detached by HMR
      if (selectedEl && !selectedEl.isConnected && selectedSelectorRef.current) {
        const resolved = document.querySelector(selectedSelectorRef.current);
        if (resolved) {
          setSelectedEl(resolved);
          setInferResult(infer(resolved));
          setPanelKey((k) => k + 1);
          return;
        } else {
          // Element no longer exists after HMR — close panel
          setSelectedEl(null);
          selectedSelectorRef.current = null;
          setInferResult(null);
          return;
        }
      }

      if (cleared > 0 && selectedEl) {
        setInferResult(infer(selectedEl));
        setPanelKey((k) => k + 1);
      }
    });
    return cleanup ?? undefined;
  }, [selectedEl]);

  // --- Scroll position preservation across panelKey remounts ---
  useEffect(() => {
    const el = getScrollViewport();
    if (el && savedScrollRef.current > 0) {
      el.scrollTop = savedScrollRef.current;
    }
  }, [panelKey, getScrollViewport]);

  // --- Auto-hiding scrollbar ---
  useEffect(() => {
    const el = getScrollViewport();
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      el.classList.add("is-scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("is-scrolling"), 800);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [selectedEl, getScrollViewport]);

  // --- Click-to-switch: clicking a page element while panel is open re-selects ---
  useEffect(() => {
    if (!selectedEl || selecting || pinned) return;

    // Issue #23: Radix Select / Popover dismiss on pointerdown, then unmount
    // the portal synchronously. The follow-up click is delivered to <html>
    // (or whatever is now under the cursor), which would otherwise be picked
    // up here as a fresh element selection. Mirror Radix's own pattern:
    // remember when pointerdown happened while a popper was open, and skip
    // the immediately-following click.
    let radixDismissPending = false;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        radixDismissPending = true;
      }
    };

    const handlePageClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left clicks
      if (radixDismissPending) {
        // This click closes a Radix popper that was open at pointerdown
        // time — not a fresh page selection.
        radixDismissPending = false;
        return;
      }
      // Issue #23 (follow-up): Radix opens its popper synchronously *during*
      // the trigger's pointerdown (between capture and bubble phases). The
      // capture-phase pointerdown listener above sees `radixPopperMounted=false`
      // and never sets the flag, but by the time `click` fires the popper is
      // mounted AND Radix has retargeted the click event to <html> via its
      // pointer-capture release. If any Radix popper is currently mounted at
      // click time, this click is part of a Radix interaction — never a fresh
      // page selection.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        return;
      }
      const target = e.target as Element;
      if (target.closest(".__tuner-root")) return;
      if (target.closest(".__tuner-selected-outline")) return;
      if (target.closest("[data-tuner-portal]")) return;
      if (target.closest("[data-radix-portal]")) return;
      if (target.closest("[data-textstyle-portal]")) return;
      if (target.closest("[data-feedback-toolbar]")) return;
      if (target.closest("[data-annotation-marker]")) return;
      if (target.closest("[data-annotation-popup]")) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".__tuner-root") || el.closest("[data-tuner-portal]") || el.closest("[data-radix-portal]") || el.closest("[data-textstyle-portal]")) return;
      if (el.closest("[data-feedback-toolbar]") || el.closest("[data-annotation-marker]") || el.closest("[data-annotation-popup]")) return;

      e.preventDefault();
      e.stopPropagation();
      handleSelect(el);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handlePageClick, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handlePageClick, true);
    };
  }, [selectedEl, selecting, pinned, handleSelect]);

  // --- Hover highlight: preview which element you'd re-select on click ---
  useEffect(() => {
    if (!selectedEl || selecting || pinned || !hoverHighlightRef.current) return;
    const highlight = hoverHighlightRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (
        !el ||
        el === selectedEl ||
        el.contains(selectedEl) ||
        selectedEl.contains(el) ||
        el.closest(".__tuner-root") ||
        el.closest(".__tuner-selected-outline") ||
        el.closest("[data-tuner-portal]") ||
        el.closest("[data-radix-portal]") ||
        el.closest("[data-feedback-toolbar]") ||
        el.closest("[data-annotation-marker]")
      ) {
        highlight.style.display = "none";
        return;
      }
      const rect = el.getBoundingClientRect();
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.display = "block";
    };

    const handleMouseLeave = () => {
      highlight.style.display = "none";
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseleave", handleMouseLeave);
      highlight.style.display = "none";
    };
  }, [selectedEl, selecting, pinned]);

  // --- Right-click context menu on page elements ---
  useEffect(() => {
    if (!selectedEl || selecting) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest(".__tuner-root")) return;
      if (target.closest("[data-tuner-portal]")) return;
      if (target.closest("[data-radix-portal]")) return;
      if (target.closest("[data-feedback-toolbar]")) return;

      e.preventDefault();
      setActiveModal({ type: "contextMenu", x: e.clientX, y: e.clientY });
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    return () => document.removeEventListener("contextmenu", handleContextMenu, true);
  }, [selectedEl, selecting]);


  // --- CSS Import handler (paste CSS text from clipboard) ---
  const handleCSSImport = useCallback(async () => {
    if (!selectedElRef.current || diffMode) return;
    try {
      const text = await navigator.clipboard.readText();
      // Re-read ref after await — selectedEl may have changed during clipboard read
      const el = selectedElRef.current;
      if (!el) return;
      const declarations = parseCSSText(text);
      if (declarations.length === 0) return;

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

      // Re-infer to update panel
      setInferResult(infer(el));
      setPanelKey((k) => k + 1);
      setClipboardMessage(`Imported ${declarations.length} propert${declarations.length === 1 ? "y" : "ies"}`);
    } catch {
      setClipboardMessage("Clipboard access denied");
    }
  }, [diffMode, activeState, scope, activeClassName]);

  // --- Command Palette action handler ---
  const handleCommandAction = useCallback((action: string) => {
    if (!selectedEl) return;
    switch (action) {
      case "Save":
        handleSaveShortcut();
        break;
      case "Reset":
        if (overrideCount(selectedEl) > 0) {
          reset(selectedEl);
          setInferResult(infer(selectedEl));
          setPanelKey((k) => k + 1);
        }
        break;
      case "Copy CSS":
        handleCopyShortcut();
        break;
      case "Copy Tailwind": {
        const changes = diff(selectedEl);
        if (changes.length > 0) {
          navigator.clipboard.writeText(formatTailwindDiff(changes)).catch(() => {});
        }
        break;
      }
      case "Paste Styles":
        handlePasteStyles();
        break;
      case "Toggle Diff":
        handleToggleDiff();
        break;
    }
  }, [selectedEl, handleSaveShortcut, handleCopyShortcut, handlePasteStyles, handleToggleDiff]);

  // --- Context Menu action handler ---
  const handleContextAction = useCallback((action: string) => {
    if (!selectedEl) return;
    switch (action) {
      case "copy-styles": {
        const count = copyStyles(selectedEl);
        if (count > 0) setClipboardMessage(`${count} style${count === 1 ? "" : "s"} copied`);
        break;
      }
      case "paste-styles":
        handlePasteStyles();
        break;
      case "copy-css":
        handleCopyShortcut();
        break;
      case "copy-tailwind": {
        const changes = diff(selectedEl);
        if (changes.length > 0) {
          navigator.clipboard.writeText(formatTailwindDiff(changes)).catch(() => {});
        }
        break;
      }
      case "select-parent": {
        const parent = selectedEl.parentElement;
        if (parent && isNavigableElement(parent)) {
          handleSelect(parent);
        }
        break;
      }
      case "reset-styles":
        if (overrideCount(selectedEl) > 0) {
          reset(selectedEl);
          setInferResult(infer(selectedEl));
          setPanelKey((k) => k + 1);
        }
        break;
    }
  }, [selectedEl, handlePasteStyles, handleCopyShortcut, handleSelect]);

  return (
    <>
      {/* Scoped scrollbar styles for the tuner panel */}
      <style dangerouslySetInnerHTML={{ __html: `
        .__tuner-root::-webkit-scrollbar,
        .__tuner-root *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .__tuner-root::-webkit-scrollbar-track,
        .__tuner-root *::-webkit-scrollbar-track {
          background: transparent;
        }
        .__tuner-root::-webkit-scrollbar-thumb,
        .__tuner-root *::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0);
          border-radius: 4px;
          transition: background ${ms("slow")};
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb,
        .__tuner-root:hover::-webkit-scrollbar-thumb,
        .__tuner-root *:hover::-webkit-scrollbar-thumb {
          background: ${surface.track};
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb:hover,
        .__tuner-root:hover::-webkit-scrollbar-thumb:hover,
        .__tuner-root *:hover::-webkit-scrollbar-thumb:hover {
          background: ${blackAlpha(0.2)};
        }
        .__tuner-root,
        .__tuner-root *:not([data-radix-scroll-area-viewport]) {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .__tuner-root.is-scrolling,
        .__tuner-root:hover,
        .__tuner-root *:not([data-radix-scroll-area-viewport]):hover {
          scrollbar-color: ${surface.track} transparent;
        }
        /* Slider thumb styling — replaces browser defaults with light-theme matching thumb */
        .__tuner-root input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .__tuner-root input[type="range"]::-webkit-slider-runnable-track {
          height: 3px;
          background: rgba(0,0,0,0.08);
          border-radius: 2px;
          transition: background ${ms("expand")};
        }
        .__tuner-root input[type="range"]:hover::-webkit-slider-runnable-track {
          background: rgba(0,0,0,0.15);
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid ${color.background};
          box-shadow: 0 0 3px rgba(0,0,0,0.15);
          margin-top: -4.5px;
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px ${primaryAlpha(0.25)};
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.1);
          background: ${color.primaryActive};
        }
        .__tuner-root input[type="range"]::-moz-range-track {
          height: 3px;
          background: rgba(0,0,0,0.08);
          border-radius: 2px;
          transition: background ${ms("expand")};
        }
        .__tuner-root input[type="range"]:hover::-moz-range-track {
          background: rgba(0,0,0,0.15);
        }
        .__tuner-root input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid ${color.background};
          box-shadow: 0 0 3px rgba(0,0,0,0.15);
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px ${primaryAlpha(0.25)};
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.1);
          background: ${color.primaryActive};
        }
      `}} />

      {/* Selector overlay (full viewport, invisible until hover) */}
      <Selector
        active={selecting}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />

      {/* Persistent selected-element outline (Phase 2) */}
      {selectedEl && !selecting && (
        <>
          <div
            ref={selectedOutlineRef}
            className="__tuner-selected-outline"
            style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, border: `1.5px solid ${color.primary}`, borderRadius: 2, transition: `all ${ms("normal")} ease-out` }}
          />
          {/* Breadcrumb ancestor hover outline */}
          <div
            ref={ancestorOutlineRef}
            style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.guide, border: `1.5px dashed ${primaryAlpha(0.5)}`, borderRadius: 2, background: primaryAlpha(0.04) }}
          />
          {/* Dimensions badge: W x H below bottom-right */}
          <div
            ref={dimensionsBadgeRef}
            style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, fontSize: 10, fontFamily: font.mono, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3, whiteSpace: "nowrap", background: color.primary, color: color.primaryForeground }}
          />
          {/* Tag label: tag.class above top-left */}
          <div
            ref={tagLabelRef}
            style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, fontSize: 10, fontFamily: font.mono, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3, whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", background: color.primary, color: color.primaryForeground }}
          />
          {/* Hover highlight: subtle preview when hovering a different element */}
          <div
            ref={hoverHighlightRef}
            style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.backdrop, borderRadius: 2, transition: `all ${ms("fast")} ease-out`, background: primaryAlpha(0.06), border: `1px solid ${primaryAlpha(0.2)}` }}
          />
        </>
      )}

      {/* Grid overlay (only when selected element is a grid container and overlay is enabled) */}
      {selectedEl && isGridContainer && showGridOverlay && !selecting && (
        <GridOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Box model overlay (M key) */}
      {selectedEl && showBoxModel && !selecting && (
        <BoxModelOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Ghosted margin + padding preview — always visible on selection */}
      {selectedEl && !selecting && (
        <SpacingPreviewOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Flex gap overlay — pink dashed hatching between flex children */}
      {selectedEl && isFlexContainer && !selecting && (
        <FlexGapOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Spacing guides overlay — full intensity during active scrubbing */}
      {selectedEl && !selecting && (
        <SpacingGuidesOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Panel (inspector or global variables) */}
      <AnimatePresence>
      {((selectedEl && inferResult && activePanel.type === "inspector") || activePanel.type === "variables") && (
        <motion.div
          key="tuner-panel"
          className="__tuner-root"
          style={{
            position: "fixed",
            zIndex: zIndex.max,
            width: activePanel.type === "variables" ? getVariablesPanelWidth(variablesModeCount) : 300,
            height: "85vh",
            maxHeight: "85vh",
            background: color.background,
            borderRadius: layout.panelRadius,
            boxShadow: panelDragging ? shadow.panelDrag : shadow.panel,
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: diffMode ? "1px solid rgba(250,204,21,0.3)" : `1px solid ${blackAlpha(0.07)}`,
            pointerEvents: selecting ? "none" : ((selectedEl || activePanel.type === "variables") ? undefined : "none"),
            top: pos.y,
            left: pos.x,
            transformOrigin: "bottom right",
            transition: snapping
              ? `top ${ms("expand")} ease, left ${ms("expand")} ease, width ${ms("expand")} ease, box-shadow ${ms("expand")}`
              : `width ${ms("expand")} ease, box-shadow ${ms("expand")}`,
          }}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: springConfig("panelOpen") }}
          exit={{ opacity: 0, scale: 0.97, y: 4, transition: springConfig("panelClose") }}
        >
          {/* Reduced motion: disable transitions/animations when user prefers */}
          {reducedMotion && (
            <style dangerouslySetInnerHTML={{ __html: `
              .__tuner-root *, .__tuner-root *::before, .__tuner-root *::after {
                transition-duration: 0s !important;
                animation-duration: 0s !important;
              }
            `}} />
          )}

          {activePanel.type === "inspector" && selectedEl && inferResult && (
            <>
              {/* Screen reader live region for announcements */}
              <div
                role="status"
                aria-live="assertive"
                aria-atomic="true"
                style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
              >
                {announcement}
              </div>

              <Header
                element={selectedEl}
                onClose={handleCloseAttempt}
                onDragStart={handleDragStart}
                totalChanges={totalChanges}
                sessionOpen={changesDrawerOpen}
                onShowSession={handleToggleSession}
                breadcrumb={breadcrumb}
                onBreadcrumbClick={handleBreadcrumbClick}
                onBreadcrumbHover={setHoveredAncestor}
                scope={scope}
                onScopeChange={handleScopeChange}
                cssClasses={cssClasses}
                activeClassName={activeClassName}
                state={activeState}
                onStateChange={handleStateChange}
                pinned={pinned}
                onTogglePin={handleTogglePin}
              />
              {focusMode && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 2, paddingBottom: 2, borderBottom: `1px solid ${border.subtle}` }}>
                  <span
                    onClick={() => setFocusMode(false)}
                    style={{ fontSize: 9, fontWeight: 600, paddingLeft: 8, paddingRight: 8, paddingTop: 1, paddingBottom: 1, borderRadius: 9999, cursor: "pointer", userSelect: "none", letterSpacing: "0.04em", textTransform: "uppercase" as const, color: color.primary, background: primaryAlpha(0.15) }}
                  >
                    Focus Mode
                  </span>
                </div>
              )}
              {/* -- Style / AI tab bar -- */}
              <div style={{ display: "flex", borderBottom: `1px solid ${border.subtle}`, paddingLeft: 12, paddingRight: 12, flexShrink: 0 }}>
                {(["custom", "prompt"] as const).map((tab) => {
                  const isActive = activePanel.type === "inspector" && activePanel.tab === tab;
                  const label = tab === "custom" ? "Style" : "AI";
                  return (
                    <button
                      key={tab}
                      onClick={() => setActivePanel({ type: "inspector", tab })}
                      style={{
                        background: "transparent",
                        borderTop: "none",
                        borderLeft: "none",
                        borderRight: "none",
                        borderBottom: `2px solid ${isActive ? color.primary : "transparent"}`,
                        paddingLeft: 10,
                        paddingRight: 10,
                        paddingTop: 7,
                        paddingBottom: 5,
                        fontSize: 11,
                        fontFamily: font.sans,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        color: isActive ? text.primary : text.label,
                        transition: `color ${ms("normal")}, border-color ${ms("normal")}`,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div
                ref={panelScrollRef}
                className="__tuner-root"
                style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}
              >
                {showSearch && (
                  <PropertySearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClose={() => { setSearchQuery(""); setShowSearch(false); }}
                  />
                )}
                <div
                  style={{
                    paddingBottom: 4,
                    transition: `opacity ${ms("normal")}`,
                    pointerEvents: diffMode ? "none" : "auto",
                    opacity: diffMode ? 0.6 : 1,
                  }}
                >
                  <PanelErrorBoundary onError={handleClose}>
                    {activePanel.tab === "custom" ? (
                      <WebflowPanel
                        key={panelKey}
                        element={selectedEl}
                        spacing={inferResult.spacing}
                        onSpacingChange={handleSpacingChange}
                        onSpacingReset={handleSpacingReset}
                        showGridOverlay={showGridOverlay}
                        onToggleGridOverlay={() => setShowGridOverlay((v) => !v)}
                        searchQuery={searchQuery}
                        focusMode={focusMode}
                        scope={scope}
                        activeClassName={activeClassName}
                        activeState={activeState}
                        expandedSection={expandedSection}
                        onExpandSection={setExpandedSection}
                        sectionMemory={sectionMemory}
                        onSectionMemoryChange={setSectionMemory}
                      />
                    ) : (
                      <PromptPanel
                        key={panelKey}
                        element={selectedEl}
                      />
                    )}
                  </PanelErrorBoundary>
                </div>
              </div>
              <ChangesDrawer
                open={changesDrawerOpen}
                tab={changesDrawerTab}
                onTabChange={setChangesDrawerTab}
                onResetAll={handleResetAll}
                entries={historyEntries}
                onUndoToIndex={handleUndoToIndex}
                onClose={() => setChangesDrawerOpen(false)}
              />
              <Footer
                element={selectedEl}
                onReset={handleReset}
                onCSSImport={handleCSSImport}
                scope={scope}
                activeClassName={activeClassName}
                activeState={activeState}
                clipboardMessage={clipboardMessage}
                hasClipboard={hasClipboardStyles()}
                onPasteStyles={handlePasteStyles}
              />
              <AnimatePresence>
                {closeWarning && (() => {
                  const count = selectedElRef.current ? overrideCount(selectedElRef.current) : 0;
                  return (
                    <motion.div
                      key="close-warning"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        background: destructiveAlpha(0.08),
                        fontSize: 12,
                        fontFamily: font.sans,
                        color: text.label,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderTop: `1px solid ${border.default}`,
                        overflow: "hidden",
                      }}
                    >
                      <span>{count} unsaved change{count === 1 ? "" : "s"}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => { handleClose(); setCloseWarning(false); }}
                          style={{
                            background: surface.hover,
                            border: `1px solid ${border.default}`,
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontFamily: font.sans,
                            color: text.label,
                            cursor: "pointer",
                          }}
                        >
                          Discard
                        </button>
                        <button
                          onClick={() => setCloseWarning(false)}
                          style={{
                            background: surface.hover,
                            border: `1px solid ${border.default}`,
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontFamily: font.sans,
                            color: text.label,
                            cursor: "pointer",
                          }}
                        >
                          Keep Editing
                        </button>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
              {/* First-use hint bar */}
              <AnimatePresence>
                {showHintBar && (
                  <motion.div
                    key="hint-bar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      setShowHintBar(false);
                      try { localStorage.setItem("redial:hintDismissed", "true"); } catch {}
                    }}
                    style={{
                      fontSize: 10,
                      fontFamily: font.sans,
                      color: text.disabled,
                      background: surface.subtle,
                      textAlign: "center",
                      padding: "5px 12px",
                      borderTop: `1px solid ${border.subtle}`,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {"\u2318S save \u00b7 \u2318Z undo \u00b7 ? all shortcuts"}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {activePanel.type === "variables" && (
            <GlobalVariablesPanel
              onClose={() => setActivePanel({ type: "none" })}
              onModeCount={setVariablesModeCount}
            />
          )}

        </motion.div>
      )}
      </AnimatePresence>

      {/* Navigator panel (independent lifecycle — can coexist with inspector) */}
      <AnimatePresence>
        {showNavigator && (
          <NavigatorPanel
            key="navigator-panel"
            selectedEl={selectedEl}
            onSelectElement={handleSelect}
            onClose={() => setShowNavigator(false)}
          />
        )}
      </AnimatePresence>

      {/* Command Palette modal */}
      {activeModal.type === "commandPalette" && selectedEl && (
        <CommandPalette
          onSelectElement={(el) => { handleSelect(el); setActiveModal({ type: "none" }); }}
          onScrollToSection={(section) => {
            setShowSearch(true);
            setSearchQuery(section);
            setActiveModal({ type: "none" });
          }}
          onAction={(action) => { handleCommandAction(action); setActiveModal({ type: "none" }); }}
          onClose={() => setActiveModal({ type: "none" })}
        />
      )}

      {/* Context Menu */}
      {activeModal.type === "contextMenu" && selectedEl && (
        <ContextMenu
          x={activeModal.x}
          y={activeModal.y}
          element={selectedEl}
          onAction={handleContextAction}
          onClose={() => setActiveModal({ type: "none" })}
        />
      )}

      {/* Shortcuts Help modal */}
      {activeModal.type === "shortcutsHelp" && (
        <ShortcutsHelp onClose={() => setActiveModal({ type: "none" })} />
      )}

      {/* Selection mode indicator */}
      {selecting && (
        <div style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: zIndex.max,
          background: color.background,
          color: text.primary,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: 8,
          fontSize: 13,
          fontFamily: font.sans,
          boxShadow: `0 2px 8px ${blackAlpha(0.08)}`,
          pointerEvents: "none",
        }}>
          Click an element to inspect • Esc to cancel
        </div>
      )}

      {/* Expandable toolbar — replaces single-purpose FAB */}
      <Toolbar
        selecting={selecting}
        hasSelectedEl={!!selectedEl}
        activePanel={activePanel}
        changesOpen={changesDrawerOpen}
        onToggleSelecting={() => {
          setSelecting((s) => {
            if (!s) {
              setActivePanel((prev) =>
                prev.type === "variables" ? { type: "none" } : prev
              );
            }
            return !s;
          });
        }}
        onOpenVariables={() => {
          setSelecting(false);
          setActivePanel({ type: "variables" });
        }}
        onOpenPrompt={() => {
          if (selectedEl) {
            setSelecting(false);
            setActivePanel({ type: "inspector", tab: "prompt" });
          } else {
            pendingTabRef.current = "prompt";
            setSelecting(true);
          }
        }}
        onToggleSession={handleToggleSession}
        onClose={handleClose}
      />
    </>
  );
}
