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
import { infer, type InferResult } from "../core/infer";
import { clearRedundantOverrides, stripAllOverrides, restoreAllOverrides, overrideCount, restoreSession, diff, reset, copyStyles, hasClipboardStyles, subscribeOverrides, getOverrideSnapshot, subscribeChanges } from "../core/apply";
import { styleEngine, resolveTarget } from "../core/engine";
import { buildBreadcrumb, getSelector, formatCSSDiff, isNavigableElement } from "../util";

import { onHmrUpdate } from "../core/hmr";
import { getCSSModuleClasses, type Scope } from "../core/scope";
import { diffState, syncWithApplyUndoRedo } from "../core/statePreview";
import { enrichChangesForCommit } from "../core/commitUtils";
import { Toolbar } from "./Toolbar";
import { GlobalVariablesPanel } from "../variables/GlobalVariablesPanel";
import { getVariablesPanelWidth } from "../variables/panelWidth";
import { ms, setReducedMotion, springConfig } from "../timing";
import { AnimatePresence, motion } from "motion/react";
import { isScrubActive } from "../core/scrubState";
import { PropertySearch } from "./PropertySearch";
import { parseCSSText } from "../cssImport";
import { formatTailwindDiff } from "../tailwind";
import { NavigatorPanel } from "../navigator/NavigatorPanel";
import { OverlayScrollbarStyles, ReducedMotionStyles } from "./OverlayStyles";
import { SelectionChrome } from "./SelectionChrome";
import { VisualOverlays } from "./VisualOverlays";
import { OverlayModals } from "./OverlayModals";
import { InspectorTabBar } from "./InspectorTabBar";
import { CloseWarningBar } from "./CloseWarningBar";
import { HintBar } from "./HintBar";
import { useOverlayDrag } from "../hooks/useOverlayDrag";
import { useStyleHandlers } from "../hooks/useStyleHandlers";
import { useElementSelection } from "../hooks/useElementSelection";
import { useInjectedStyles } from "../hooks/useInjectedStyles";
import { startBreakpointPreview, destroyBreakpointPreview } from "../breakpointPreview";
import { useOverlayHotkeys } from "../hooks/useOverlayHotkeys";
import { usePageInteractions } from "../hooks/usePageInteractions";
import { useSelectionOutline } from "../hooks/useSelectionOutline";
import { getConfig } from "../core/config";
import { color, text, border, surface, font, shadow, blackAlpha, warningAlpha, layout, zIndex } from "../theme";

// --- Panel State Types (canonical defs in ./overlayTypes) ---
import type { ActivePanel, ActiveModal } from "./overlayTypes";
export type { ActivePanel, ActiveModal } from "./overlayTypes";

// --- Action identifiers (typed dispatch maps below) ---
type CommandAction = "Save" | "Reset" | "Copy CSS" | "Copy Tailwind" | "Paste Styles" | "Toggle Diff";
type ContextAction = "copy-styles" | "paste-styles" | "copy-css" | "copy-tailwind" | "select-parent" | "reset-styles";

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

  /**
   * Re-infer `el` and force a panel remount — the canonical "refresh the panel
   * from this element" op shared by every handler/hook that mutates styles.
   */
  const refreshPanel = useCallback((el: Element) => {
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
  }, [setPanelKey]);

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

  // Breakpoint selector (#35). "base" = un-mediated; "768" = ≥768px, etc.
  // Edits made while a non-base breakpoint is active are keyed to it (ADR-0005)
  // and rendered media-gated by breakpointPreview.ts.
  const [activeBreakpoint, setActiveBreakpoint] = useState("base");
  const handleBreakpointChange = useCallback((bp: string) => {
    if (isScrubActive()) return;
    setActiveBreakpoint(bp);
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
        refreshPanel(currentEl);
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

  // --- Style-mutation handlers (reset / paste / undo-to-index / spacing) ---
  // Must be before the hotkey useEffect that references handleResetAll.
  const {
    handleResetAll,
    handlePasteStyles,
    handleReset,
    handleUndoToIndex,
    handleSpacingChange,
    handleSpacingReset,
  } = useStyleHandlers({
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
  });

  // --- Element selection / close lifecycle handlers ---
  // Must be before the hotkey useEffect (depends on handleCloseAttempt) and
  // the tuner:select / click-to-switch effects (depend on handleSelect).
  const {
    handleSelect,
    handleCancel,
    handleBreadcrumbClick,
    handleClose,
    handleCloseAttempt,
  } = useElementSelection({
    selectedElRef,
    selectedSelectorRef,
    pendingTabRef,
    announce,
    setSelecting,
    setSelectedEl,
    setPinned,
    setInferResult,
    refreshPanel,
    setScope,
    setActiveClassName,
    setActiveState,
    setActivePanel,
    setActiveModal,
    setShowNavigator,
    setShowGridOverlay,
    setShowBoxModel,
    setExpandedSection,
    setChangesDrawerOpen,
    setShowSearch,
    setSearchQuery,
    setCloseWarning,
    setHoveredAncestor,
    setPos,
    setAnchor,
  });

  // --- Global keyboard shortcuts (capture-phase keydown/keyup listener) ---
  useOverlayHotkeys({
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
  });

  // --- Clipboard message auto-clear ---
  useEffect(() => {
    if (!clipboardMessage) return;
    const timer = setTimeout(() => setClipboardMessage(null), 1500);
    return () => clearTimeout(timer);
  }, [clipboardMessage]);

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

  const handleTogglePin = useCallback(() => setPinned(p => !p), []);

  const handleToggleSession = useCallback(() => {
    setSelecting(false);
    setChangesDrawerTab("pending");
    setChangesDrawerOpen((v) => !v);
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

  // --- Selected-element outline + badge + tag label + ancestor-hover tracking ---
  useSelectionOutline({
    selectedEl,
    selecting,
    hoveredAncestor,
    panelKey,
    selectedOutlineRef,
    dimensionsBadgeRef,
    tagLabelRef,
    ancestorOutlineRef,
  });

  // --- Breadcrumb computation (Phase 2) ---
  const breadcrumb = useMemo(() => selectedEl ? buildBreadcrumb(selectedEl) : [], [selectedEl]);

  // --- Restore persisted session on mount ---
  useEffect(() => {
    restoreSession();
  }, []);

  // --- One-time global <style> injection (Next.js z-index fix + focus ring) ---
  useInjectedStyles();

  // --- Breakpoint live preview (#35): keep the media-gated <style> in sync with
  //     breakpoint edits/undo/reset for the whole session. ---
  useEffect(() => {
    startBreakpointPreview();
    return () => destroyBreakpointPreview();
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
          refreshPanel(resolved);
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
        refreshPanel(selectedEl);
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

  // --- Page-level pointer interactions (click-to-switch, hover highlight, context menu) ---
  usePageInteractions({
    selectedEl,
    selecting,
    pinned,
    handleSelect,
    hoverHighlightRef,
    setActiveModal,
  });


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
        styleEngine.apply(resolveTarget(el, { scope, activeClassName, activeState, activeBreakpoint }), prop, value);
      }

      // Re-infer to update panel
      refreshPanel(el);
      setClipboardMessage(`Imported ${declarations.length} propert${declarations.length === 1 ? "y" : "ies"}`);
    } catch {
      setClipboardMessage("Clipboard access denied");
    }
  }, [diffMode, activeState, scope, activeClassName, activeBreakpoint]);

  // --- Command Palette action handler (typed dispatch map, no inline branching) ---
  const handleCommandAction = useCallback((action: string) => {
    const el = selectedEl;
    if (!el) return;
    const dispatch: Record<CommandAction, () => void> = {
      "Save": () => handleSaveShortcut(),
      "Reset": () => {
        if (overrideCount(el) > 0) {
          reset(el);
          refreshPanel(el);
        }
      },
      "Copy CSS": () => handleCopyShortcut(),
      "Copy Tailwind": () => {
        const changes = diff(el);
        if (changes.length > 0) {
          navigator.clipboard.writeText(formatTailwindDiff(changes)).catch(() => {});
        }
      },
      "Paste Styles": () => handlePasteStyles(),
      "Toggle Diff": () => handleToggleDiff(),
    };
    dispatch[action as CommandAction]?.();
  }, [selectedEl, handleSaveShortcut, handleCopyShortcut, handlePasteStyles, handleToggleDiff]);

  // --- Context Menu action handler (typed dispatch map, no inline branching) ---
  const handleContextAction = useCallback((action: string) => {
    const el = selectedEl;
    if (!el) return;
    const dispatch: Record<ContextAction, () => void> = {
      "copy-styles": () => {
        const count = copyStyles(el);
        if (count > 0) setClipboardMessage(`${count} style${count === 1 ? "" : "s"} copied`);
      },
      "paste-styles": () => handlePasteStyles(),
      "copy-css": () => handleCopyShortcut(),
      "copy-tailwind": () => {
        const changes = diff(el);
        if (changes.length > 0) {
          navigator.clipboard.writeText(formatTailwindDiff(changes)).catch(() => {});
        }
      },
      "select-parent": () => {
        const parent = el.parentElement;
        if (parent && isNavigableElement(parent)) {
          handleSelect(parent);
        }
      },
      "reset-styles": () => {
        if (overrideCount(el) > 0) {
          reset(el);
          refreshPanel(el);
        }
      },
    };
    dispatch[action as ContextAction]?.();
  }, [selectedEl, handlePasteStyles, handleCopyShortcut, handleSelect]);

  return (
    <>
      {/* Scoped scrollbar + slider styles for the tuner panel */}
      <OverlayScrollbarStyles />

      {/* Selector overlay (full viewport, invisible until hover) */}
      <Selector
        active={selecting}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />

      {/* Persistent selected-element outline + chrome (Phase 2) */}
      {selectedEl && !selecting && (
        <SelectionChrome
          selectedOutlineRef={selectedOutlineRef}
          ancestorOutlineRef={ancestorOutlineRef}
          dimensionsBadgeRef={dimensionsBadgeRef}
          tagLabelRef={tagLabelRef}
          hoverHighlightRef={hoverHighlightRef}
        />
      )}

      {/* On-page measurement overlays (grid / box model / spacing / flex gap) */}
      {selectedEl && !selecting && (
        <VisualOverlays
          element={selectedEl}
          isGridContainer={isGridContainer}
          isFlexContainer={isFlexContainer}
          showGridOverlay={showGridOverlay}
          showBoxModel={showBoxModel}
        />
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
            border: diffMode ? `1px solid ${warningAlpha(0.3)}` : `1px solid ${blackAlpha(0.07)}`,
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
          {reducedMotion && <ReducedMotionStyles />}

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
                breakpoint={activeBreakpoint}
                onBreakpointChange={handleBreakpointChange}
                pinned={pinned}
                onTogglePin={handleTogglePin}
              />
              <InspectorTabBar
                activePanel={activePanel}
                onSelectTab={(tab) => setActivePanel({ type: "inspector", tab })}
                focusMode={focusMode}
                onExitFocus={() => setFocusMode(false)}
              />
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
                        activeBreakpoint={activeBreakpoint}
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
                activeBreakpoint={activeBreakpoint}
                clipboardMessage={clipboardMessage}
                hasClipboard={hasClipboardStyles()}
                onPasteStyles={handlePasteStyles}
              />
              <CloseWarningBar
                open={closeWarning}
                selectedElRef={selectedElRef}
                onDiscard={() => { handleClose(); setCloseWarning(false); }}
                onKeepEditing={() => setCloseWarning(false)}
              />
              {/* First-use hint bar */}
              <HintBar
                show={showHintBar}
                onDismiss={() => {
                  setShowHintBar(false);
                  try { localStorage.setItem("redial:hintDismissed", "true"); } catch {}
                }}
              />
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

      {/* Transient modals (command palette / context menu / shortcuts help) */}
      <OverlayModals
        activeModal={activeModal}
        selectedEl={selectedEl}
        setActiveModal={setActiveModal}
        onSelectElement={handleSelect}
        setShowSearch={setShowSearch}
        setSearchQuery={setSearchQuery}
        onCommandAction={handleCommandAction}
        onContextAction={handleContextAction}
      />

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
