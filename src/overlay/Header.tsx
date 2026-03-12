/**
 * Header.tsx — element info + drag handle
 *
 * Shows the selected element's tag, class name, and source file.
 * Doubles as the drag handle for moving the panel.
 */

import { useState, useEffect } from "react";
import { getDisplayClass } from "./util";
import { getReactSource } from "./sourcemap";
import type { Scope } from "./scope";
import { getReadableName } from "./scope";
import { StateSelector } from "./StateSelector";
import { X, ChevronRight, GripVertical } from "lucide-react";

type BreadcrumbSegment = { el: Element; tag: string; className: string | null };

interface HeaderProps {
  element: Element;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  totalChanges?: number;
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
}

export function Header({
  element,
  onClose,
  onDragStart,
  totalChanges = 0,
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
}: HeaderProps) {
  const [breadcrumbExpanded, setBreadcrumbExpanded] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 0);

  // Track viewport width
  useEffect(() => {
    const handler = () => setVw(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Reset expanded state when the selected element changes
  useEffect(() => {
    setBreadcrumbExpanded(false);
  }, [element]);

  const tier = vw >= 1280 ? "xl" : vw >= 1024 ? "lg" : vw >= 768 ? "md" : vw >= 640 ? "sm" : "xs";

  const tag = element.tagName.toLowerCase();
  const className = getDisplayClass(element);
  const reactSource = getReactSource(element);
  const sourceFile = reactSource?.displayPath ?? null;

  return (
    <div
      className="__tuner-header"
      onMouseDown={onDragStart}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <GripVertical
            size={12}
            strokeWidth={2.5}
            style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginLeft: "-2px" }}
          />
          <span
            style={{
              color: "#fff",
              fontSize: "13px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}
          >
            {"<"}{tag}{">"}
          </span>
          {className && (
            <span
              style={{
                color: "rgba(255, 255, 255, 0.6)",
                fontSize: "11px",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
              }}
            >
              .{className}
            </span>
          )}
        </div>
        {sourceFile && (
          <span
            style={{
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}
          >
            {sourceFile}
          </span>
        )}
        {breadcrumb && breadcrumb.length > 1 && (() => {
          // If 4+ items and not expanded: show first > "..." > last 2
          const shouldCollapse = breadcrumb.length >= 4 && !breadcrumbExpanded;
          const visibleSegments = shouldCollapse
            ? [breadcrumb[0], ...breadcrumb.slice(-2)]
            : breadcrumb;
          const ellipsisAfterFirst = shouldCollapse;

          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "11px",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                color: "rgba(255, 255, 255, 0.4)",
                marginTop: "2px",
                overflow: "hidden",
              }}
            >
              {visibleSegments.map((seg, i) => {
                const isLast = i === visibleSegments.length - 1;
                const label = seg.className ? `${seg.tag}.${seg.className}` : seg.tag;
                return (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                    {i === 1 && ellipsisAfterFirst && (
                      <>
                        <ChevronRight size={10} strokeWidth={2} style={{ opacity: 0.4 }} />
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setBreadcrumbExpanded(true);
                          }}
                          style={{
                            cursor: "pointer",
                            padding: "0 2px",
                            borderRadius: "2px",
                            color: "rgba(255, 255, 255, 0.4)",
                            transition: "color 100ms, background 100ms",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                          title="Show full breadcrumb"
                        >
                          ...
                        </span>
                      </>
                    )}
                    {i > 0 && <ChevronRight size={10} strokeWidth={2} style={{ opacity: 0.4 }} />}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLast) onBreadcrumbClick?.(seg.el);
                      }}
                      onMouseEnter={() => {
                        if (!isLast) onBreadcrumbHover?.(seg.el);
                      }}
                      onMouseLeave={() => {
                        if (!isLast) onBreadcrumbHover?.(null);
                      }}
                      style={{
                        color: isLast ? "#fff" : "rgba(255, 255, 255, 0.4)",
                        cursor: isLast ? "default" : "pointer",
                        whiteSpace: "nowrap",
                        borderRadius: "2px",
                        padding: isLast ? undefined : "0 2px",
                        transition: "color 100ms, background 100ms",
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
        {cssClasses.length > 0 && onScopeChange && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "4px",
              flexWrap: "wrap",
            }}
          >
            <ScopePill
              label="element"
              active={scope === "element"}
              onClick={() => onScopeChange("element")}
            />
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
          </div>
        )}
        {state !== undefined && onStateChange && (
          <StateSelector value={state} onChange={onStateChange} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          title={`${vw}px viewport · ${tier} breakpoint`}
          style={{
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.06)",
            padding: "1px 5px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            cursor: "default",
          }}
        >
          {tier}
        </span>
        {totalChanges > 0 && (
          <button
            onClick={onShowSession}
            title={`${totalChanges} total change${totalChanges === 1 ? "" : "s"} — click to view session`}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 600,
              padding: "1px 7px",
              cursor: "pointer",
              lineHeight: "16px",
              minWidth: "20px",
              textAlign: "center",
            }}
          >
            {totalChanges}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255, 255, 255, 0.4)",
            cursor: "pointer",
            padding: "4px",
            fontSize: "14px",
            lineHeight: 1,
          }}
          title="Close (Esc)"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// --- Scope pill ---

function ScopePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: "2px 8px",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        border: active
          ? "1px solid rgba(255, 255, 255, 0.3)"
          : "1px solid rgba(255,255,255,0.15)",
        borderRadius: "8px",
        cursor: "pointer",
        background: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
        color: active ? "#fff" : "rgba(255, 255, 255, 0.6)",
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
