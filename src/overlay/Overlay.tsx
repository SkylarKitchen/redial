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

import { useState, useCallback, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from "react";
import { Selector } from "./Selector";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WebflowPanel } from "./WebflowPanel";
import { SessionDrawer } from "./SessionDrawer";
import { infer, type InferResult } from "./infer";
import { undo, clearRedundantOverrides, resetAll, totalOverrideCount, stripAllOverrides, restoreAllOverrides, overrideCount, restoreSession, applyInlineStyle, diff, reset } from "./apply";
import { buildBreadcrumb } from "./util";
import { ViewportBar } from "./ViewportBar";
import { onHmrUpdate } from "./hmr";
import { getCSSModuleClasses, destroyClassStyles, type Scope } from "./scope";

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
  const [inferResult, setInferResult] = useState<InferResult | null>(null);
  const [panelKey, setPanelKey] = useState(0); // force re-mount on new selection

  // Session-wide state
  const [sessionOpen, setSessionOpen] = useState(false);
  const [dirtyTick, setDirtyTick] = useState(0);

  // Scope toggle
  const [scope, setScope] = useState<Scope>("element");
  const [activeClassName, setActiveClassName] = useState<string | null>(null);
  const cssClasses = selectedEl ? getCSSModuleClasses(selectedEl) : [];

  // State selector
  const [activeState, setActiveState] = useState("none");

  // Diff mode (Phase 1)
  const [diffMode, setDiffMode] = useState(false);
  const diffHoldRef = useRef(false); // distinguishes hold-D from button toggle

  // Viewport preview (Phase 3)
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  // Selected element outline ref (Phase 2)
  const selectedOutlineRef = useRef<HTMLDivElement>(null);

  // Panel position (draggable)
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 16 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // --- Keyboard shortcut helpers ---
  const handleSaveShortcut = useCallback(async () => {
    if (!selectedEl) return;
    const changes = diff(selectedEl);
    if (changes.length === 0) return;
    try {
      const res = await fetch("/api/tuner/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (res.ok) {
        setInferResult(infer(selectedEl));
        setPanelKey((k) => k + 1);
      }
    } catch {}
  }, [selectedEl]);

  const handleCopyShortcut = useCallback(() => {
    if (!selectedEl) return;
    const changes = diff(selectedEl);
    if (changes.length === 0) return;
    const lines = changes.map((c) => `  ${c.prop}: ${c.to};`);
    navigator.clipboard.writeText(`{\n${lines.join("\n")}\n}`);
  }, [selectedEl]);

  // --- Hotkey: backtick toggles selection ---
  // Uses capture phase so Cmd+Z reaches us before DialKit's internal input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target as HTMLElement : null;
      const insidePanel = target?.closest(".__tuner-root");

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
        }
        return;
      }

      // Cmd+S for save — must fire even when focus is inside panel inputs
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
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

      // For all other shortcuts, skip when typing in inputs or inside our panel
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      if (insidePanel) return;

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
        }
        return;
      }

      if (e.key === "`" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelecting((s) => !s);
      }

      // Escape closes panel
      if (e.key === "Escape" && selectedEl && !selecting) {
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

      // Arrow key navigation (Phase 2)
      if (selectedEl && !selecting && !diffMode && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        let next: Element | null = null;

        if (e.key === "ArrowUp") next = selectedEl.parentElement;
        else if (e.key === "ArrowDown") next = selectedEl.firstElementChild;
        else if (e.key === "ArrowLeft") next = selectedEl.previousElementSibling;
        else if (e.key === "ArrowRight") next = selectedEl.nextElementSibling;

        if (!next) return;
        const nextTag = next.tagName.toLowerCase();
        if (nextTag === "body" || nextTag === "html") return;
        if ((next as HTMLElement).closest?.(".__tuner-root")) return;

        setSelectedEl(next);
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
  }, [selectedEl, selecting, diffMode]);

  // --- Element selection ---
  const handleSelect = useCallback((el: Element) => {
    setSelecting(false);
    setSelectedEl(el);
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
    // Reset scope on new selection
    setScope("element");
    setActiveClassName(null);
    // Reset position so panel doesn't appear off-screen
    setPos({ x: window.innerWidth - 340, y: 16 });
  }, []);

  const handleCancel = useCallback(() => {
    setSelecting(false);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedEl(null);
    setInferResult(null);
    setScope("element");
    setActiveClassName(null);
  }, []);

  // --- Re-render after changes (for dirty indicators + session badge) ---
  const handleDirtyChange = useCallback(() => {
    setDirtyTick((t) => t + 1);
  }, []);

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
    setDirtyTick((t) => t + 1);
    if (selectedEl) {
      setInferResult(infer(selectedEl));
      setPanelKey((k) => k + 1);
    }
  }, [selectedEl]);

  const handleScopeChange = useCallback((newScope: Scope, cls?: string) => {
    setScope(newScope);
    setActiveClassName(newScope === "class" ? (cls ?? null) : null);
  }, []);

  const handleToggleSession = useCallback(() => {
    setSessionOpen((s) => !s);
  }, []);

  // --- Spacing box model change handler ---
  const handleSpacingChange = useCallback((prop: string, value: number) => {
    if (!selectedEl) return;
    applyInlineStyle(selectedEl, prop, `${value}px`);
    handleDirtyChange();
  }, [selectedEl, handleDirtyChange]);

  // --- Dragging ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
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
        const x = Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.originX + dx));
        const y = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.originY + dy));
        setPos({ x, y });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pos]
  );

  // --- Diff toggle (button click) ---
  const handleToggleDiff = useCallback(() => {
    if (!selectedEl || overrideCount(selectedEl) === 0) return;
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
    setSelectedEl(el);
    setInferResult(infer(el));
    setPanelKey((k) => k + 1);
  }, []);

  // --- Persistent outline for selected element (Phase 2) ---
  useEffect(() => {
    if (!selectedEl || selecting || !selectedOutlineRef.current) return;

    const outline = selectedOutlineRef.current;
    let rafId: number;

    const updatePosition = () => {
      const rect = selectedEl.getBoundingClientRect();
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.style.display = "block";
      rafId = requestAnimationFrame(updatePosition);
    };

    rafId = requestAnimationFrame(updatePosition);

    return () => {
      cancelAnimationFrame(rafId);
      outline.style.display = "none";
    };
  }, [selectedEl, selecting]);

  // --- Viewport constraint style injection (Phase 3) ---
  useEffect(() => {
    const STYLE_ID = "__tuner-viewport-constraint";

    if (viewportWidth === null) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `body > *:not(.__tuner-root):not(.__tuner-selector-outline):not(.__tuner-selected-outline) { max-width: ${viewportWidth}px !important; margin-left: auto !important; margin-right: auto !important; }`;

    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [viewportWidth]);

  // --- Viewport change: re-infer after width change ---
  const handleViewportChange = useCallback((width: number | null) => {
    setViewportWidth(width);
    if (selectedEl) {
      requestAnimationFrame(() => {
        setInferResult(infer(selectedEl));
        setPanelKey((k) => k + 1);
      });
    }
  }, [selectedEl]);

  // --- Breadcrumb computation (Phase 2) ---
  const breadcrumb = selectedEl ? buildBreadcrumb(selectedEl) : [];

  // --- Restore persisted session on mount ---
  useEffect(() => {
    const restored = restoreSession();
    if (restored > 0) {
      setDirtyTick((t) => t + 1);
    }
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

  // --- HMR auto-reset (Turbopack + Vite + webpack) ---
  useEffect(() => {
    const cleanup = onHmrUpdate(() => {
      const cleared = clearRedundantOverrides();
      if (cleared > 0 && selectedEl) {
        setInferResult(infer(selectedEl));
        setPanelKey((k) => k + 1);
      }
    });
    return cleanup ?? undefined;
  }, [selectedEl]);

  return (
    <>
      {/* Selector overlay (full viewport, invisible until hover) */}
      <Selector
        active={selecting}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />

      {/* Persistent selected-element outline (Phase 2) */}
      {selectedEl && !selecting && (
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
            transition: "all 80ms ease-out",
          }}
        />
      )}

      {/* Panel (only when an element is selected) */}
      {selectedEl && inferResult && (
        <div
          className="__tuner-root"
          style={{
            position: "fixed",
            top: pos.y,
            left: pos.x,
            width: 300,
            maxHeight: "85vh",
            overflowY: "auto",
            overflowX: "hidden",
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
          }}
        >
          <Header
            element={selectedEl}
            onClose={handleClose}
            onDragStart={handleDragStart}
            totalChanges={totalOverrideCount()}
            onShowSession={handleToggleSession}
            breadcrumb={breadcrumb}
            onBreadcrumbClick={handleBreadcrumbClick}
            scope={scope}
            onScopeChange={handleScopeChange}
            cssClasses={cssClasses}
            activeClassName={activeClassName}
            state={activeState}
            onStateChange={setActiveState}
          />
          <ViewportBar
            active={viewportWidth}
            onChange={handleViewportChange}
          />
          <div
            style={{
              padding: "4px 0",
              pointerEvents: diffMode ? "none" : "auto",
              opacity: diffMode ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            <PanelErrorBoundary onError={handleClose}>
              <WebflowPanel
                key={panelKey}
                element={selectedEl}
                spacing={inferResult.spacing}
                onSpacingChange={handleSpacingChange}
                onDirtyChange={handleDirtyChange}
              />
            </PanelErrorBoundary>
          </div>
          <SessionDrawer
            open={sessionOpen}
            onResetAll={handleResetAll}
          />
          <Footer
            element={selectedEl}
            onReset={handleReset}
            diffMode={diffMode}
            onToggleDiff={handleToggleDiff}
            scope={scope}
            activeClassName={activeClassName}
          />
        </div>
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
    </>
  );
}
