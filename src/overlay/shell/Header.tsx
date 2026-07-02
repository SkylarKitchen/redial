/**
 * Header.tsx — element info + drag handle
 *
 * Shows the selected element's tag, class name, and source file.
 * Doubles as the drag handle for moving the panel.
 */

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { getDisplayClass } from "../util";
import { getReactSource } from "../core/sourcemap";
import { getConfig } from "../core/config";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";
import type { Scope } from "../core/scope";
import type { ScopeContext } from "../core/engine";
import {
  getReadableName,
  attachClassToElement,
  getSessionAttachedClasses,
  subscribeAttachedClasses,
  getAttachedClassesVersion,
  collectPageClassSuggestions,
} from "../core/scope";
import { StateSelector } from "./StateSelector";
import { BreakpointSelector } from "./BreakpointSelector";
import { X, ChevronRight, Pin, Plus } from "lucide-react";
import { color, text, border, surface, font, layout, blackAlpha, primaryAlpha, focusRing } from "../theme";
import { ms, cssTransition } from "../timing";

type BreadcrumbSegment = { el: Element; tag: string; className: string | null };

interface HeaderProps {
  element: Element;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  totalChanges?: number;
  sessionOpen?: boolean;
  onShowSession?: () => void;
  breadcrumb?: BreadcrumbSegment[];
  onBreadcrumbClick?: (el: Element) => void;
  onBreadcrumbHover?: (el: Element | null) => void;
  /** The panel's active scoping bundle (scope ▸ class ▸ state ▸ breakpoint) —
   *  Overlay's ONE memoized `scopeCtx`, never drilled per-dimension. */
  scopeCtx?: ScopeContext;
  onScopeChange?: (scope: Scope, className?: string) => void;
  cssClasses?: string[];
  onStateChange?: (state: string) => void;
  onBreakpointChange?: (breakpoint: string) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

export function Header({
  element,
  onClose,
  onDragStart,
  totalChanges = 0,
  sessionOpen = false,
  onShowSession,
  breadcrumb,
  onBreadcrumbClick,
  onBreadcrumbHover,
  scopeCtx,
  onScopeChange,
  cssClasses = [],
  onStateChange,
  onBreakpointChange,
  pinned = false,
  onTogglePin,
}: HeaderProps) {
  // Destructure the bundle once; the selector children keep their plain
  // value + onChange contracts (StateSelector / BreakpointSelector unchanged).
  const scope = scopeCtx?.scope ?? "element";
  const activeClassName = scopeCtx?.activeClassName;
  const state = scopeCtx?.activeState;
  const breakpoint = scopeCtx?.activeBreakpoint;
  const [breadcrumbExpanded, setBreadcrumbExpanded] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [pinHovered, setPinHovered] = useState(false);
  const [ellipsisHovered, setEllipsisHovered] = useState(false);
  const [sourceHovered, setSourceHovered] = useState(false);
  const [hoveredBreadcrumbIdx, setHoveredBreadcrumbIdx] = useState<number | null>(null);
  // Transient status for the source-file link (issue #82) — e.g. when the
  // open-editor request fails and we fall back to copying the path.
  const [sourceStatus, setSourceStatus] = useState<string | null>(null);
  const sourceStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset expanded state when the selected element changes
  useEffect(() => {
    setBreadcrumbExpanded(false);
  }, [element]);

  // Clear any pending source-status timeout on unmount
  useEffect(() => {
    return () => {
      if (sourceStatusTimer.current !== null) clearTimeout(sourceStatusTimer.current);
    };
  }, []);

  const showSourceStatus = (msg: string) => {
    setSourceStatus(msg);
    if (sourceStatusTimer.current !== null) clearTimeout(sourceStatusTimer.current);
    sourceStatusTimer.current = setTimeout(() => setSourceStatus(null), 3000);
  };

  /** Failure fallback: copy `file:line` to the clipboard and say so visibly. */
  const copyPathFallback = (file: string, line: number | undefined) => {
    const path = `${file}${line ? `:${line}` : ""}`;
    const copied = navigator.clipboard?.writeText(path);
    if (copied) {
      copied.then(
        () => showSourceStatus("Couldn't open editor — path copied"),
        () => showSourceStatus("Couldn't open editor")
      );
    } else {
      showSourceStatus("Couldn't open editor");
    }
  };

  /**
   * Open the source file in the developer's editor via the open-editor
   * sibling of the configured commit endpoint (served by the same catch-all
   * route.ts mount — issue #82). Failures degrade to copy-path + visible
   * status instead of a silent swallow.
   */
  const openInEditor = (file: string, line: number | undefined) => {
    const commitEndpoint = getConfig().commitEndpoint;
    if (!commitEndpoint || !commitEndpoint.includes("/")) {
      copyPathFallback(file, line);
      return;
    }
    const endpoint = commitEndpoint.replace(/\/[^/]*$/, "/open-editor");
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", [REDIAL_MARKER_HEADER]: "1" },
      body: JSON.stringify({ file, line }),
    })
      .then((res) => {
        // fetch resolves on 4xx/5xx — check ok explicitly (the old code's
        // .catch never fired on the dead route's 404).
        if (!res.ok) copyPathFallback(file, line);
      })
      .catch(() => copyPathFallback(file, line));
  };

  const tag = element.tagName.toLowerCase();
  const className = getDisplayClass(element);
  const reactSource = getReactSource(element);
  const sourceFile = reactSource?.displayPath ?? null;

  // ─── "+ class" — class creation / attach-existing (audit 05) ───
  // Session-attached classes render as scope pills next to the CSS-module
  // classes; the registry lives in scope.ts and this subscription keeps the
  // pill row live (attach, Discard-detach).
  const attachedVersion = useSyncExternalStore(
    subscribeAttachedClasses,
    getAttachedClassesVersion,
    getAttachedClassesVersion
  );
  const attachedClasses = useMemo(
    () => getSessionAttachedClasses(element),
    // attachedVersion invalidates the memo whenever the registry changes.
    [element, attachedVersion]
  );
  const pillClasses = useMemo(
    () => [...cssClasses, ...attachedClasses.filter((c) => !cssClasses.includes(c))],
    [cssClasses, attachedClasses]
  );
  const [addingClass, setAddingClass] = useState(false);
  const [classDraft, setClassDraft] = useState("");
  const [classError, setClassError] = useState<string | null>(null);

  // Close the class input when the selection moves to another element.
  useEffect(() => {
    setAddingClass(false);
    setClassDraft("");
    setClassError(null);
  }, [element]);

  const suggestions = useMemo(
    () => (addingClass ? collectPageClassSuggestions(element, classDraft) : []),
    // attachedVersion: an attach changes what's "already on the element".
    [element, addingClass, classDraft, attachedVersion]
  );

  /** Validate + attach the draft (or a clicked suggestion) and scope to it. */
  const commitClassDraft = (raw: string) => {
    const name = raw.trim().replace(/^\./, "");
    if (!name) {
      setAddingClass(false);
      setClassError(null);
      return;
    }
    // A module class's READABLE name refers to the same source class — typing
    // it again would create a shadowing duplicate, so treat it as "already on".
    const readableDup = cssClasses.some((cls) => (getReadableName(cls) ?? cls) === name);
    if (readableDup) {
      setClassError(`.${name} is already on this element`);
      return;
    }
    const res = attachClassToElement(element, name);
    if (!res.ok) {
      setClassError(res.reason);
      return;
    }
    onScopeChange?.("class", name);
    setAddingClass(false);
    setClassDraft("");
    setClassError(null);
  };

  const hasToolbar = !!onScopeChange || (state !== undefined && onStateChange) || (breakpoint !== undefined && onBreakpointChange);

  // How many elements on the page use each class — surfaced as a Webflow-style
  // "used by N elements" reuse signal on the class scope pills. Keyed on the
  // DOM class token (not the readable display name).
  const classReuseCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const cls of pillClasses) {
      try {
        counts[cls] = document.querySelectorAll(`.${CSS.escape(cls)}`).length;
      } catch {
        counts[cls] = 0;
      }
    }
    return counts;
    // `element` is included so the count refreshes when selection changes.
  }, [element, pillClasses]);

  return (
    <div
      className="__tuner-header"
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: `1px solid ${border.subtle}`,
        cursor: "grab",
        userSelect: "none",
      }}
      onMouseDown={onDragStart}
    >
      {/* -- Drag handle indicator -- */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 5 }}>
        <div style={{ width: 28, height: 3, borderRadius: 9999, background: surface.active }} />
      </div>

      {/* -- Main row: tag + class | badges + close -- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingRight: 12, paddingTop: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontFamily: font.mono, fontWeight: 500, flexShrink: 0, color: text.primary }}>
            {"<"}{tag}{">"}
          </span>
          {className && (
            <span style={{ fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: text.label }}>
              .{className}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {(totalChanges > 0 || sessionOpen) && (
            <button
              aria-label={
                sessionOpen && totalChanges === 0
                  ? "Close changes drawer"
                  : `${totalChanges} unsaved change${totalChanges === 1 ? "" : "s"} — open changes drawer`
              }
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: font.mono,
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 6,
                paddingRight: 6,
                borderRadius: 3,
                lineHeight: "14px",
                minWidth: 18,
                textAlign: "center",
                cursor: "pointer",
                outline: "none",
                background: primaryAlpha(0.15),
                border: `1px solid ${primaryAlpha(0.2)}`,
                color: primaryAlpha(0.95),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={onShowSession}
              onKeyDown={(e) => {
                // Explicit Enter/Space handling (preventDefault suppresses the
                // native button activation, so this fires exactly once).
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onShowSession?.();
                }
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              title={sessionOpen && totalChanges === 0 ? "Close session" : `${totalChanges} total change${totalChanges === 1 ? "" : "s"} — click to toggle session`}
            >
              {totalChanges}
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              onMouseEnter={() => setPinHovered(true)}
              onMouseLeave={(e) => { setPinHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              title="Pin element (P)"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 20,
                width: 20,
                padding: 0,
                borderRadius: 3,
                border: "none",
                outline: "none",
                background: pinned ? primaryAlpha(0.15) : (pinHovered ? surface.hover : "transparent"),
                color: pinned ? primaryAlpha(0.95) : (pinHovered ? blackAlpha(0.7) : text.disabled),
                cursor: "pointer",
                transition: `color ${ms("normal")}, background ${ms("normal")}, ${cssTransition("transform", "release")}`,
              }}
            >
              <Pin size={12} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={(e) => { setCloseHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            title="Close (Esc)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 20,
              width: 20,
              padding: 0,
              borderRadius: 3,
              border: "none",
              outline: "none",
              background: closeHovered ? surface.hover : "transparent",
              color: closeHovered ? blackAlpha(0.7) : text.disabled,
              cursor: "pointer",
              transition: `color ${ms("normal")}, background ${ms("normal")}, ${cssTransition("transform", "release")}`,
            }}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* -- Source file (click to open in editor) -- */}
      {sourceFile && (
        <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 2 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: font.mono,
              color: text.disabled,
              cursor: "pointer",
              textDecoration: sourceHovered ? "underline" : "none",
              transition: `color ${ms("normal")}`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openInEditor(reactSource!.file, reactSource!.line);
            }}
            onMouseEnter={() => setSourceHovered(true)}
            onMouseLeave={() => setSourceHovered(false)}
            title="Open in editor"
          >
            {sourceFile}
          </span>
          {sourceStatus && (
            <span
              role="status"
              aria-live="polite"
              style={{
                fontSize: 10,
                fontFamily: font.mono,
                marginLeft: 6,
                color: color.destructive,
              }}
            >
              {sourceStatus}
            </span>
          )}
        </div>
      )}

      {/* -- Breadcrumb -- */}
      {breadcrumb && breadcrumb.length > 1 && (() => {
        const shouldCollapse = breadcrumb.length >= 4 && !breadcrumbExpanded;
        const visibleSegments = shouldCollapse
          ? [breadcrumb[0], ...breadcrumb.slice(-2)]
          : breadcrumb;
        const ellipsisAfterFirst = shouldCollapse;

        return (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 3,
            overflowX: "auto",
            color: text.label,
            scrollbarWidth: "none" as const,
          }}>
            {visibleSegments.map((seg, i) => {
              const isLast = i === visibleSegments.length - 1;
              const label = seg.className ? `${seg.tag}.${seg.className}` : seg.tag;
              const isBreadcrumbHovered = hoveredBreadcrumbIdx === i && !isLast;
              const isEllipsis = i === 1 && ellipsisAfterFirst;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {isEllipsis && (
                    <>
                      <ChevronRight size={10} strokeWidth={2} style={{ color: text.disabled }} />
                      <span
                        tabIndex={0}
                        role="button"
                        aria-label="Show full breadcrumb"
                        onClick={(e) => { e.stopPropagation(); setBreadcrumbExpanded(true); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBreadcrumbExpanded(true); } }}
                        onMouseEnter={() => setEllipsisHovered(true)}
                        onMouseLeave={() => setEllipsisHovered(false)}
                        onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
                        onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                        style={{
                          cursor: "pointer",
                          paddingLeft: 2,
                          paddingRight: 2,
                          borderRadius: 2,
                          outline: "none",
                          color: ellipsisHovered ? blackAlpha(0.7) : text.disabled,
                          background: ellipsisHovered ? surface.hover : "transparent",
                          transition: `color ${ms("normal")}, background ${ms("normal")}`,
                        }}
                        title="Show full breadcrumb"
                      >
                        ...
                      </span>
                    </>
                  )}
                  {i > 0 && <ChevronRight size={10} strokeWidth={2} style={{ color: text.disabled }} />}
                  <span
                    tabIndex={isLast ? undefined : 0}
                    role={isLast ? undefined : "button"}
                    aria-label={isLast ? undefined : `Select parent <${seg.tag}>`}
                    onClick={(e) => { e.stopPropagation(); if (!isLast) onBreadcrumbClick?.(seg.el); }}
                    onKeyDown={isLast ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBreadcrumbClick?.(seg.el); } }}
                    onMouseEnter={(e) => { if (!isLast) { setHoveredBreadcrumbIdx(i); onBreadcrumbHover?.(seg.el); (e.currentTarget as HTMLElement).style.borderColor = blackAlpha(0.2); } }}
                    onMouseLeave={(e) => { if (!isLast) { setHoveredBreadcrumbIdx(null); onBreadcrumbHover?.(null); (e.currentTarget as HTMLElement).style.borderColor = "transparent"; } }}
                    onFocus={isLast ? undefined : (e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
                    onBlur={isLast ? undefined : (e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                    style={{
                      whiteSpace: "nowrap",
                      borderRadius: 2,
                      outline: "none",
                      transition: `color ${ms("normal")}, background ${ms("normal")}, border-color ${ms("normal")}`,
                      ...(isLast
                        ? { cursor: "default", color: text.primary }
                        : {
                            cursor: "pointer",
                            paddingLeft: 2,
                            paddingRight: 2,
                            borderBottom: "1px solid transparent",
                            color: isBreadcrumbHovered ? blackAlpha(0.7) : text.label,
                            background: isBreadcrumbHovered ? surface.hover : "transparent",
                          }),
                    }}
                    data-breadcrumb-ancestor={!isLast ? "" : undefined}
                  >
                    {label}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* -- Toolbar: scope pills + "+ class" + state selector on one row -- */}
      {hasToolbar && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 8, flexWrap: "wrap" }}>
          {pillClasses.length > 0 && onScopeChange && (
            // Single-select group → radiogroup semantics; display:contents keeps
            // the pills participating in the toolbar's flex row unchanged.
            <div role="radiogroup" aria-label="Style scope" style={{ display: "contents" }}>
              {pillClasses.map((cls) => {
                const readable = getReadableName(cls) ?? cls;
                return (
                  <ScopePill
                    key={cls}
                    label={`.${readable}`}
                    active={scope === "class" && activeClassName === cls}
                    onClick={() => onScopeChange("class", cls)}
                    count={classReuseCounts[cls]}
                  />
                );
              })}
              <ScopePill
                label="element"
                active={scope === "element"}
                onClick={() => onScopeChange("element")}
              />
            </div>
          )}
          {onScopeChange && (
            addingClass ? (
              <input
                autoFocus
                value={classDraft}
                placeholder="class name"
                aria-label="New class name"
                spellCheck={false}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => { setClassDraft(e.target.value); setClassError(null); }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitClassDraft(classDraft);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setAddingClass(false);
                    setClassDraft("");
                    setClassError(null);
                  }
                }}
                style={{
                  width: 96,
                  height: 16,
                  fontSize: 10,
                  fontFamily: font.mono,
                  paddingLeft: 6,
                  paddingRight: 6,
                  borderRadius: layout.pillRadius,
                  border: `1px solid ${classError ? color.destructive : border.hover}`,
                  outline: "none",
                  background: surface.subtle,
                  color: text.primary,
                }}
              />
            ) : (
              <button
                aria-label="Add class"
                title="Add class"
                onClick={(e) => { e.stopPropagation(); setAddingClass(true); }}
                onKeyDown={(e) => {
                  // Explicit Enter/Space handling (preventDefault suppresses the
                  // native button activation, so this fires exactly once).
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setAddingClass(true);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 16,
                  paddingLeft: 6,
                  paddingRight: 6,
                  fontSize: 10,
                  fontFamily: font.mono,
                  borderRadius: layout.pillRadius,
                  border: `1px dashed ${border.hover}`,
                  outline: "none",
                  background: "transparent",
                  color: text.label,
                  cursor: "pointer",
                  transition: `color ${ms("normal")}, background ${ms("normal")}`,
                }}
              >
                <Plus size={9} strokeWidth={2} style={{ marginRight: 2 }} />
                class
              </button>
            )
          )}
          {state !== undefined && onStateChange && (
            <>
              {onScopeChange && (
                <div style={{ width: 1, height: 14, marginLeft: 3, marginRight: 3, flexShrink: 0, background: surface.hover }} />
              )}
              <StateSelector value={state} onChange={onStateChange} />
            </>
          )}
          {breakpoint !== undefined && onBreakpointChange && (
            <>
              {(onScopeChange || (state !== undefined && onStateChange)) && (
                <div style={{ width: 1, height: 14, marginLeft: 3, marginRight: 3, flexShrink: 0, background: surface.hover }} />
              )}
              <BreakpointSelector value={breakpoint} onChange={onBreakpointChange} />
            </>
          )}
        </div>
      )}

      {/* -- Class-input feedback: validation error or existing-class suggestions -- */}
      {addingClass && classError && (
        <div
          role="alert"
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingBottom: 6,
            fontSize: 10,
            fontFamily: font.mono,
            color: color.destructive,
          }}
        >
          {classError}
        </div>
      )}
      {addingClass && !classError && suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              data-class-suggestion={s}
              title={`Attach existing class .${s}`}
              onClick={(e) => { e.stopPropagation(); commitClassDraft(s); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                paddingLeft: 6,
                paddingRight: 6,
                height: 16,
                fontSize: 10,
                fontFamily: font.mono,
                borderRadius: layout.pillRadius,
                border: "none",
                background: surface.subtle,
                color: text.label,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: `color ${ms("normal")}, background ${ms("normal")}`,
              }}
            >
              .{s}
            </button>
          ))}
        </div>
      )}

      {/* Bottom spacing when no toolbar present */}
      {!hasToolbar && <div style={{ height: 8 }} />}
    </div>
  );
}

// -- Scope pill --

function ScopePill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  const [hovered, setHovered] = useState(false);
  // Webflow-style reuse signal: tooltip always reports the count, and when the
  // class is shared by more than one element we show a faint "· N" suffix.
  const hasCount = typeof count === "number";
  const tooltip = hasCount
    ? `used by ${count} element${count === 1 ? "" : "s"}`
    : undefined;
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => {
        // Explicit Enter/Space handling (preventDefault suppresses the native
        // button activation, so this fires exactly once).
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => { setHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
      onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      title={tooltip}
      style={{
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 10,
        fontFamily: font.mono,
        border: "none",
        outline: "none",
        borderRadius: layout.pillRadius,
        cursor: "pointer",
        lineHeight: "16px",
        whiteSpace: "nowrap",
        transition: `color ${ms("normal")}, background ${ms("normal")}, ${cssTransition("transform", "release")}`,
        background: active
          ? (hovered ? blackAlpha(0.1) : surface.active)
          : (hovered ? surface.subtle : "transparent"),
        color: active
          ? text.primary
          : (hovered ? blackAlpha(0.6) : text.label),
      }}
    >
      {label}
      {hasCount && count > 1 && (
        <span style={{ marginLeft: 4, color: text.disabled }}>· {count}</span>
      )}
    </button>
  );
}
