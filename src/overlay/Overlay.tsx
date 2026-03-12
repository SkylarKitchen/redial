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
import { CommonPanel } from "./CommonPanel";
import { SessionDrawer } from "./SessionDrawer";
import { GridOverlay } from "./GridOverlay";
import { BoxModelOverlay } from "./BoxModelOverlay";
import { infer, type InferResult } from "./infer";
import { undo, redo, clearRedundantOverrides, resetAll, stripAllOverrides, restoreAllOverrides, overrideCount, restoreSession, applyInlineStyle, diff, reset, copyStyles, pasteStyles, hasClipboardStyles, subscribeOverrides, getOverrideSnapshot, beginBatch, endBatch, subscribeChanges } from "./apply";
import { buildBreadcrumb, getStableSelector, getSelector, formatCSSDiff, isNavigableElement } from "./util";

import { onHmrUpdate } from "./hmr";
import { getCSSModuleClasses, destroyClassStyles, type Scope } from "./scope";
import { Plus } from "lucide-react";
import { ms, setReducedMotion } from "./timing";
import { isScrubActive } from "./scrubState";
import { PropertySearch } from "./PropertySearch";
import { CommandPalette } from "./CommandPalette";
import { ContextMenu } from "./ContextMenu";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { parseCSSText } from "./cssImport";
import { formatTailwindDiff } from "./tailwind";
import { HistoryDrawer, type HistoryEntry } from "./HistoryDrawer";

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
        <div style={{ padding: "12px", color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
          <div style={{ marginBottom: "6px" }}>Panel crashed — try selecting a different element.</div>
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onError?.();
            }}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
            }}
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
  const selectedElRef = useRef(selectedEl);
  useEffect(() => { selectedElRef.current = selectedEl; }, [selectedEl]);
  const [inferResult, setInferResult] = useState<InferResult | null>(null);
  const [panelKey, setPanelKeyRaw] = useState(0); // force re-mount on new selection
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  /** Wrapper that saves scroll position before triggering a remount */
  const setPanelKey: typeof setPanelKeyRaw = useCallback((v) => {
    if (panelScrollRef.current) {
      savedScrollRef.current = panelScrollRef.current.scrollTop;
    }
    setPanelKeyRaw(v);
  }, []);

  // Tab state: "common" (flat simplified view) or "custom" (full WebflowPanel)
  const [activeTab, setActiveTab] = useState<"common" | "custom">("common");

  // Session-wide state
  const [sessionOpen, setSessionOpen] = useState(false);
  const totalChanges = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);

  // Scope toggle
  const [scope, setScope] = useState<Scope>("element");
  const [activeClassName, setActiveClassName] = useState<string | null>(null);
  const cssClasses = useMemo(() => selectedEl ? getCSSModuleClasses(selectedEl) : [], [selectedEl]);

  // State selector
  const [activeState, setActiveState] = useState("none");

  // Grid overlay toggle
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  // Box model overlay toggle
  const [showBoxModel, setShowBoxModel] = useState(false);
  const isGridContainer = useMemo(() => {
    if (!selectedEl) return false;
    const d = getComputedStyle(selectedEl).display;
    return d === "grid" || d === "inline-grid";
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

  // History drawer
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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

  // Diff mode (Phase 1)
  const [diffMode, setDiffMode] = useState(false);
  const diffHoldRef = useRef(false); // distinguishes hold-D from button toggle

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

  // Dimensions badge + tag label refs
  const dimensionsBadgeRef = useRef<HTMLDivElement>(null);
  const tagLabelRef = useRef<HTMLDivElement>(null);

  // Stable selector for re-resolving after HMR
  const selectedSelectorRef = useRef<string | null>(null);

  // Save-in-flight guard to prevent double-save
  const savingRef = useRef(false);

  // Panel position (draggable)
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 16 });
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScopeChange = useCallback((newScope: Scope, cls?: string) => {
    setScope(newScope);
    setActiveClassName(newScope === "class" ? (cls ?? null) : null);
  }, []);

  // --- Keyboard shortcut helpers ---
  const handleSaveShortcut = useCallback(async () => {
    const el = selectedElRef.current;
    if (!el || savingRef.current) return;
    const changes = diff(el);
    if (changes.length === 0) return;
    savingRef.current = true;
    try {
      const res = await fetch("/api/tuner/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
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
  }, [announce]);

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
            applyInlineStyle(el, prop, value);
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

      // For all other shortcuts, skip when typing in inputs or inside our panel
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      if (insidePanel) return;

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

      // M to toggle box model overlay
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setShowBoxModel((v) => !v);
        return;
      }

      // H to toggle history drawer
      if (e.key === "h" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
        e.preventDefault();
        setShowHistory((v) => !v);
        return;
      }

      if (e.key === "`" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelecting((s) => !s);
      }

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
        setSelectedEl(null);
        setInferResult(null);
      }

      // D for diff peek (hold) / toggle (handled by button)
      if (e.key === "d" && !e.repeat && selectedEl && !selecting && !e.metaKey && !e.ctrlKey) {
        if (overrideCount(selectedEl) === 0) return;
        diffHoldRef.current = true;
        stripAllOverrides();
        setDiffMode(true);
      }

      // Arrow key element navigation: ↑ parent, ↓ first visible child, ←/→ siblings
      if (selectedEl && !selecting && !diffMode && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
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
        restoreAllOverrides();
        setDiffMode(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true); // capture phase
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedEl, selecting, diffMode, showSearch, activeModal, handleSaveShortcut, handleCopyShortcut, scope, cssClasses, handleScopeChange, announce]);

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
    selectedSelectorRef.current = getStableSelector(el);
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
    // Reset scope, tab, overlays, search, and modals on new selection
    setScope("element");
    setActiveClassName(null);
    setActiveTab("common");
    setShowGridOverlay(false);
    setShowBoxModel(false);
    setShowHistory(false);
    setShowSearch(false);
    setSearchQuery("");
    setActiveModal({ type: "none" });
    // Screen reader announcement
    const tag = el.tagName.toLowerCase();
    const cls = el.classList.length > 0 ? el.classList[0] : "";
    announce(`Selected ${tag}${cls ? `.${cls}` : ""}`);
    // Reset position so panel doesn't appear off-screen
    setPos({ x: window.innerWidth - 340, y: 16 });
  }, []);

  const handleCancel = useCallback(() => {
    setSelecting(false);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedEl(null);
    selectedSelectorRef.current = null;
    setInferResult(null);
    setScope("element");
    setActiveClassName(null);
    setShowSearch(false);
    setSearchQuery("");
    setActiveModal({ type: "none" });
    announce("Element deselected");
  }, [announce]);


  // --- Reset handler: re-infer to get fresh values ---
  const handleReset = useCallback(() => {
    if (selectedEl) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
    }
  }, [selectedEl]);

  // --- Session-wide reset ---
  const handleResetAll = useCallback(() => {
    resetAll();
    destroyClassStyles();
    if (selectedEl) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
    }
  }, [selectedEl]);

  const handleToggleSession = useCallback(() => {
    setSessionOpen((s) => !s);
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
    applyInlineStyle(selectedEl, prop, `${value}${unit}`);
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
  }, [selectedEl]);

  // --- Dragging ---
  const SNAP_THRESHOLD = 20;
  const SNAP_MARGIN = 16;
  const PANEL_WIDTH = 300;
  const PANEL_HEIGHT_ESTIMATE = 500;

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Clear any pending snap timer when starting a new drag
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current = null;
      }
      setSnapping(false);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        // Clamp to viewport so panel can't drift off-screen
        const x = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, dragRef.current.originX + dx));
        const y = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.originY + dy));
        setPos({ x, y });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Snap to nearest edge if within threshold
        setPos((current) => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          let x = current.x;
          let y = current.y;
          let didSnap = false;

          // Horizontal snap
          if (x <= SNAP_THRESHOLD) {
            x = SNAP_MARGIN;
            didSnap = true;
          } else if (x >= vw - PANEL_WIDTH - SNAP_THRESHOLD) {
            x = vw - PANEL_WIDTH - SNAP_MARGIN;
            didSnap = true;
          }

          // Vertical snap
          if (y <= SNAP_THRESHOLD) {
            y = SNAP_MARGIN;
            didSnap = true;
          } else if (y >= vh - PANEL_HEIGHT_ESTIMATE - SNAP_THRESHOLD) {
            y = vh - PANEL_HEIGHT_ESTIMATE - SNAP_MARGIN;
            didSnap = true;
          }

          if (didSnap) {
            setSnapping(true);
            snapTimerRef.current = setTimeout(() => {
              setSnapping(false);
              snapTimerRef.current = null;
            }, 150);
          }

          return { x, y };
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pos]
  );

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
  useEffect(() => {
    if (!selectedEl || selecting || !selectedOutlineRef.current) return;

    const outline = selectedOutlineRef.current;
    const badge = dimensionsBadgeRef.current;
    const tagEl = tagLabelRef.current;
    let rafId: number;
    let cancelled = false;

    // Build tag label text: "div.hero" or just "div"
    const elTag = selectedEl.tagName.toLowerCase();
    const firstClass = selectedEl.classList.length > 0 ? selectedEl.classList[0] : null;
    const tagText = firstClass ? `${elTag}.${firstClass}` : elTag;
    if (tagEl) tagEl.textContent = tagText;

    const updatePosition = () => {
      if (cancelled) return;
      // If the element was removed from the DOM (HMR, navigation), stop tracking
      if (!selectedEl.isConnected) {
        outline.style.display = "none";
        if (badge) badge.style.display = "none";
        if (tagEl) tagEl.style.display = "none";
        return;
      }
      const rect = selectedEl.getBoundingClientRect();
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.style.display = "block";

      // Dimensions badge: below bottom-right corner
      if (badge) {
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        badge.textContent = `${w} × ${h}`;
        badge.style.top = `${rect.bottom + 4}px`;
        badge.style.left = `${rect.right}px`;
        badge.style.transform = "translateX(-100%)";
        badge.style.display = "block";
      }

      // Tag label: above top-left corner
      if (tagEl) {
        tagEl.style.top = `${rect.top - 4}px`;
        tagEl.style.left = `${rect.left}px`;
        tagEl.style.transform = "translateY(-100%)";
        tagEl.style.display = "block";
      }

      rafId = requestAnimationFrame(updatePosition);
    };

    rafId = requestAnimationFrame(updatePosition);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      outline.style.display = "none";
      if (badge) badge.style.display = "none";
      if (tagEl) tagEl.style.display = "none";
    };
  }, [selectedEl, selecting]);

  // --- Breadcrumb ancestor hover outline ---
  useEffect(() => {
    if (!hoveredAncestor || !ancestorOutlineRef.current) return;
    const outline = ancestorOutlineRef.current;
    let rafId: number;
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const r = hoveredAncestor.getBoundingClientRect();
      outline.style.display = "block";
      outline.style.top = `${r.top}px`;
      outline.style.left = `${r.left}px`;
      outline.style.width = `${r.width}px`;
      outline.style.height = `${r.height}px`;
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      outline.style.display = "none";
    };
  }, [hoveredAncestor]);

  // --- Breadcrumb computation (Phase 2) ---
  const breadcrumb = useMemo(() => selectedEl ? buildBreadcrumb(selectedEl) : [], [selectedEl]);

  // --- Restore persisted session on mount ---
  useEffect(() => {
    restoreSession();
  }, []);

  // --- Clamp panel position on window resize ---
  useEffect(() => {
    const handleResize = () => {
      setPos((p) => ({
        x: Math.max(0, Math.min(window.innerWidth - 300, p.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, p.y)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    style.textContent = ".__tuner-root *:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.3); } .__tuner-root *:focus:not(:focus-visible) { outline: none; } .__tuner-root *:hover > .__tuner-drag-handle { opacity: 0.4; }";
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
    const el = panelScrollRef.current;
    if (el && savedScrollRef.current > 0) {
      el.scrollTop = savedScrollRef.current;
    }
  }, [panelKey]);

  // --- Auto-hiding scrollbar ---
  useEffect(() => {
    const el = panelScrollRef.current;
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
  }, [selectedEl]);

  // --- Click-to-switch: clicking a page element while panel is open re-selects ---
  useEffect(() => {
    if (!selectedEl || selecting) return;

    const handlePageClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left clicks
      const target = e.target as Element;
      if (target.closest(".__tuner-root")) return;
      if (target.closest(".__tuner-selected-outline")) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".__tuner-root")) return;

      e.preventDefault();
      e.stopPropagation();
      handleSelect(el);
    };

    document.addEventListener("click", handlePageClick, true);
    return () => document.removeEventListener("click", handlePageClick, true);
  }, [selectedEl, selecting, handleSelect]);

  // --- Right-click context menu on page elements ---
  useEffect(() => {
    if (!selectedEl || selecting) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest(".__tuner-root")) return;

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
        applyInlineStyle(el, prop, value);
      }

      // Re-infer to update panel
      setInferResult(infer(el));
      setPanelKey((k) => k + 1);
      setClipboardMessage(`Imported ${declarations.length} propert${declarations.length === 1 ? "y" : "ies"}`);
    } catch {
      setClipboardMessage("Clipboard access denied");
    }
  }, [diffMode]);

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
          width: 5px;
          height: 5px;
        }
        .__tuner-root::-webkit-scrollbar-track,
        .__tuner-root *::-webkit-scrollbar-track {
          background: transparent;
        }
        .__tuner-root::-webkit-scrollbar-thumb,
        .__tuner-root *::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0);
          border-radius: 4px;
          transition: background ${ms("slow")};
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb,
        .__tuner-root:hover::-webkit-scrollbar-thumb,
        .__tuner-root *:hover::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb:hover,
        .__tuner-root:hover::-webkit-scrollbar-thumb:hover,
        .__tuner-root *:hover::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
        .__tuner-root, .__tuner-root * {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .__tuner-root.is-scrolling,
        .__tuner-root:hover,
        .__tuner-root *:hover {
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        @keyframes tuner-enter {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .__tuner-enter { animation: tuner-enter ${ms("expand")} ease-out both; }

        /* Slider thumb styling — replaces browser defaults with dark-theme matching thumb */
        .__tuner-root input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .__tuner-root input[type="range"]::-webkit-slider-runnable-track {
          height: 3px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 3px rgba(0,0,0,0.4);
          margin-top: -4.5px;
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.25);
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.1);
          background: #818cf8;
        }
        .__tuner-root input[type="range"]::-moz-range-track {
          height: 3px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
        }
        .__tuner-root input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 3px rgba(0,0,0,0.4);
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.25);
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.1);
          background: #818cf8;
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
            style={{
              position: "fixed",
              display: "none",
              pointerEvents: "none",
              zIndex: 2147483646,
              border: "1.5px solid #6366f1",
              borderRadius: "2px",
              transition: `all ${ms("fast")} ease-out`,
            }}
          />
          {/* Breadcrumb ancestor hover outline */}
          <div
            ref={ancestorOutlineRef}
            style={{
              position: "fixed",
              display: "none",
              pointerEvents: "none",
              zIndex: 2147483645,
              border: "1.5px dashed rgba(99,102,241,0.5)",
              borderRadius: "2px",
              background: "rgba(99,102,241,0.04)",
            }}
          />
          {/* Dimensions badge: W x H below bottom-right */}
          <div
            ref={dimensionsBadgeRef}
            style={{
              position: "fixed",
              display: "none",
              pointerEvents: "none",
              zIndex: 2147483646,
              background: "rgba(30,30,30,0.9)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "rgba(255,255,255,0.8)",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              padding: "2px 6px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
            }}
          />
          {/* Tag label: tag.class above top-left */}
          <div
            ref={tagLabelRef}
            style={{
              position: "fixed",
              display: "none",
              pointerEvents: "none",
              zIndex: 2147483646,
              background: "rgba(30,30,30,0.9)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "rgba(255,255,255,0.8)",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              padding: "2px 6px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          />
        </>
      )}

      {/* Grid overlay (only when selected element is a grid container and overlay is enabled) */}
      {selectedEl && isGridContainer && showGridOverlay && !selecting && (
        <GridOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Box model overlay (margin/padding/content colored rectangles) */}
      {showBoxModel && selectedEl && !selecting && (
        <BoxModelOverlay element={selectedEl} refreshKey={panelKey} />
      )}

      {/* Panel (only when an element is selected) */}
      {selectedEl && inferResult && (
        <div
          className="__tuner-root __tuner-enter"
          style={{
            position: "fixed",
            top: pos.y,
            left: pos.x,
            width: 300,
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 2147483647,
            background: "#1e1e1e",
            borderRadius: "10px",
            border: diffMode
              ? "1px solid rgba(250, 204, 21, 0.3)"
              : "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            pointerEvents: selecting ? "none" : "auto",
            ...(snapping ? { transition: `top ${ms("expand")} ease, left ${ms("expand")} ease` } : {}),
          }}
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

          {/* Screen reader live region for announcements */}
          <div
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {announcement}
          </div>

          <Header
            element={selectedEl}
            onClose={handleClose}
            onDragStart={handleDragStart}
            totalChanges={totalChanges}
            onShowSession={handleToggleSession}
            breadcrumb={breadcrumb}
            onBreadcrumbClick={handleBreadcrumbClick}
            onBreadcrumbHover={setHoveredAncestor}
            scope={scope}
            onScopeChange={handleScopeChange}
            cssClasses={cssClasses}
            activeClassName={activeClassName}
            state={activeState}
            onStateChange={setActiveState}
          />
          {focusMode && (
            <div style={{
              display: "flex", justifyContent: "center", padding: "2px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <span
                onClick={() => setFocusMode(false)}
                style={{
                  fontSize: "9px", fontWeight: 600, color: "#6366f1",
                  background: "rgba(99,102,241,0.15)", padding: "1px 8px",
                  borderRadius: "9px", cursor: "pointer", userSelect: "none",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}
              >
                Focus Mode
              </span>
            </div>
          )}
          {/* ── Common / Custom tab bar ──────────────── */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "0 12px",
              flexShrink: 0,
            }}
          >
            {(["common", "custom"] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: "none",
                    borderWidth: 0,
                    borderStyle: "none",
                    borderColor: "transparent",
                    borderBottom: isActive ? "2px solid #c45d35" : "2px solid transparent",
                    padding: "7px 10px 5px",
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    transition: "color 100ms, border-color 100ms",
                    fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
                  }}
                >
                  {tab === "common" ? "Common" : "Custom"}
                </button>
              );
            })}
          </div>
          <div
            ref={panelScrollRef}
            className="__tuner-root"
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              minHeight: 0,
            }}
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
                padding: "4px 0",
                pointerEvents: diffMode ? "none" : "auto",
                opacity: diffMode ? 0.6 : 1,
                transition: `opacity ${ms("expand")}`,
              }}
            >
              <PanelErrorBoundary onError={handleClose}>
                {activeTab === "common" ? (
                  <CommonPanel
                    key={panelKey}
                    element={selectedEl}
                    spacing={inferResult.spacing}
                    onSpacingChange={handleSpacingChange}
                  />
                ) : (
                  <WebflowPanel
                    key={panelKey}
                    element={selectedEl}
                    spacing={inferResult.spacing}
                    onSpacingChange={handleSpacingChange}
                    showGridOverlay={showGridOverlay}
                    onToggleGridOverlay={() => setShowGridOverlay((v) => !v)}
                    showBoxModel={showBoxModel}
                    onToggleBoxModel={() => setShowBoxModel((v) => !v)}
                    searchQuery={searchQuery}
                    focusMode={focusMode}
                  />
                )}
              </PanelErrorBoundary>
            </div>
            <SessionDrawer
              open={sessionOpen}
              onResetAll={handleResetAll}
            />
            {showHistory && (
              <HistoryDrawer
                entries={historyEntries}
                onUndoToIndex={handleUndoToIndex}
                onClose={() => setShowHistory(false)}
              />
            )}
          </div>
          <Footer
            element={selectedEl}
            onReset={handleReset}
            onCSSImport={handleCSSImport}
            scope={scope}
            activeClassName={activeClassName}
            clipboardMessage={clipboardMessage}
            hasClipboard={hasClipboardStyles()}
            onPasteStyles={handlePasteStyles}
          />
        </div>
      )}

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
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483647,
            background: "#fff",
            color: "#1e1e1e",
            padding: "6px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
            boxShadow: "none",
            pointerEvents: "none",
          }}
        >
          Click an element to inspect • Esc to cancel
        </div>
      )}

      {/* Floating action button — bottom-right activation trigger */}
      <div
        className="__tuner-root"
        onClick={() => {
          if (selectedEl) {
            // If panel is open, close it
            handleClose();
          } else {
            // Toggle selection mode
            setSelecting((s) => !s);
          }
        }}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2147483647,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#1e1e1e",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: selecting || selectedEl
            ? "0 0 0 1px rgba(99,102,241,0.4), 0 4px 20px rgba(0,0,0,0.5)"
            : "0 4px 20px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: `box-shadow ${ms("layout")} ease, border-color ${ms("layout")} ease`,
          ...(selecting || selectedEl ? { borderColor: "rgba(99,102,241,0.4)" } : {}),
        }}
        title={selectedEl ? "Close panel" : selecting ? "Cancel selection" : "Select an element"}
      >
        <Plus
          size={20}
          strokeWidth={1.5}
          color="rgba(255,255,255,0.8)"
          style={{
            transition: `transform ${ms("layout")} ease`,
            transform: selecting || selectedEl ? "rotate(45deg)" : "rotate(0deg)",
          }}
        />
      </div>
    </>
  );
}
