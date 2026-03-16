/**
 * Header.tsx — element info + drag handle
 *
 * Shows the selected element's tag, class name, and source file.
 * Doubles as the drag handle for moving the panel.
 */

import { useState, useEffect } from "react";
import { getDisplayClass } from "../util";
import { getReactSource } from "../core/sourcemap";
import type { Scope } from "../core/scope";
import { getReadableName } from "../core/scope";
import { StateSelector } from "./StateSelector";
import { X, ChevronRight, Pin } from "lucide-react";
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
  scope?: Scope;
  onScopeChange?: (scope: Scope, className?: string) => void;
  cssClasses?: string[];
  activeClassName?: string | null;
  state?: string;
  onStateChange?: (state: string) => void;
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
  scope = "element",
  onScopeChange,
  cssClasses = [],
  activeClassName,
  state,
  onStateChange,
  pinned = false,
  onTogglePin,
}: HeaderProps) {
  const [breadcrumbExpanded, setBreadcrumbExpanded] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [pinHovered, setPinHovered] = useState(false);
  const [ellipsisHovered, setEllipsisHovered] = useState(false);
  const [sourceHovered, setSourceHovered] = useState(false);
  const [hoveredBreadcrumbIdx, setHoveredBreadcrumbIdx] = useState<number | null>(null);

  // Reset expanded state when the selected element changes
  useEffect(() => {
    setBreadcrumbExpanded(false);
  }, [element]);

  const tag = element.tagName.toLowerCase();
  const className = getDisplayClass(element);
  const reactSource = getReactSource(element);
  const sourceFile = reactSource?.displayPath ?? null;

  const hasToolbar = (cssClasses.length > 0 && onScopeChange) || (state !== undefined && onStateChange);

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
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: font.mono,
                paddingLeft: 6,
                paddingRight: 6,
                borderRadius: 3,
                lineHeight: "14px",
                minWidth: 18,
                textAlign: "center",
                cursor: "pointer",
                background: primaryAlpha(0.15),
                border: `1px solid ${primaryAlpha(0.2)}`,
                color: primaryAlpha(0.95),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={onShowSession}
              title={sessionOpen && totalChanges === 0 ? "Close session" : `${totalChanges} total change${totalChanges === 1 ? "" : "s"} — click to toggle session`}
            >
              {totalChanges}
            </div>
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
              const file = reactSource!.file;
              const line = reactSource!.line;
              fetch("/__tuner/open-editor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file, line }),
              }).catch(() => {
                console.log(`${file}${line ? `:${line}` : ""}`);
              });
            }}
            onMouseEnter={() => setSourceHovered(true)}
            onMouseLeave={() => setSourceHovered(false)}
          >
            {sourceFile}
          </span>
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

      {/* -- Toolbar: scope pills + state selector on one row -- */}
      {hasToolbar && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 8, flexWrap: "wrap" }}>
          {cssClasses.length > 0 && onScopeChange && (
            <>
              {cssClasses.map((cls) => {
                const readable = getReadableName(cls) ?? cls;
                return (
                  <ScopePill
                    key={cls}
                    label={`.${readable}`}
                    active={scope === "class" && activeClassName === cls}
                    onClick={() => onScopeChange("class", cls)}
                  />
                );
              })}
              <ScopePill
                label="element"
                active={scope === "element"}
                onClick={() => onScopeChange("element")}
              />
            </>
          )}
          {state !== undefined && onStateChange && (
            <>
              {cssClasses.length > 0 && onScopeChange && (
                <div style={{ width: 1, height: 14, marginLeft: 3, marginRight: 3, flexShrink: 0, background: surface.hover }} />
              )}
              <StateSelector value={state} onChange={onStateChange} />
            </>
          )}
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => { setHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
      onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 10,
        fontFamily: font.mono,
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
    </div>
  );
}
