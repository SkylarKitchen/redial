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
import { ms } from "./timing";
import { X, ChevronRight } from "lucide-react";

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

  // Reset expanded state when the selected element changes
  useEffect(() => {
    setBreadcrumbExpanded(false);
  }, [element]);

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
        {breadcrumb && breadcrumb.length > 1 && (
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
            {breadcrumb.length > 4 && (
              <span style={{ opacity: 0.5 }}>...</span>
            )}
            {breadcrumb.map((seg, i) => {
              const isLast = i === breadcrumb.length - 1;
              const label = seg.className ? `${seg.tag}.${seg.className}` : seg.tag;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
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
        )}
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
        fontFamily: "monospace",
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
