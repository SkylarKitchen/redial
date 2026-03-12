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

  const hasToolbar = (cssClasses.length > 0 && onScopeChange) || (state !== undefined && onStateChange);

  return (
    <div
      className="__tuner-header"
      onMouseDown={onDragStart}
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      {/* ── Drag handle indicator ── */}
      <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0" }}>
        <div style={{
          width: 28,
          height: 3,
          borderRadius: 1.5,
          background: "rgba(255,255,255,0.12)",
        }} />
      </div>

      {/* ── Main row: tag + class | badges + close ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px 0",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{
            color: "#fff",
            fontSize: 13,
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {"<"}{tag}{">"}
          </span>
          {className && (
            <span style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              .{className}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span
            title={`${vw}px viewport · ${tier} breakpoint`}
            style={{
              fontSize: 9,
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "2px 6px",
              borderRadius: 3,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              cursor: "default",
              lineHeight: "14px",
            }}
          >
            {tier}
          </span>
          {totalChanges > 0 && (
            <button
              onClick={onShowSession}
              title={`${totalChanges} total change${totalChanges === 1 ? "" : "s"} — click to view session`}
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 3,
                color: "rgba(129,140,248,0.95)",
                fontSize: 9,
                fontWeight: 600,
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                padding: "2px 6px",
                cursor: "pointer",
                lineHeight: "14px",
                minWidth: 18,
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
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              padding: 3,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              borderRadius: 3,
              transition: "color 100ms, background 100ms",
            }}
            title="Close (Esc)"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)";
              (e.currentTarget as HTMLElement).style.background = "none";
            }}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Source file ── */}
      {sourceFile && (
        <div style={{ padding: "2px 12px 0" }}>
          <span style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 10,
            fontFamily: "ui-monospace, 'SF Mono', monospace",
          }}>
            {sourceFile}
          </span>
        </div>
      )}

      {/* ── Breadcrumb ── */}
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
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "rgba(255,255,255,0.35)",
            padding: "3px 12px 0",
            overflow: "hidden",
          }}>
            {visibleSegments.map((seg, i) => {
              const isLast = i === visibleSegments.length - 1;
              const label = seg.className ? `${seg.tag}.${seg.className}` : seg.tag;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {i === 1 && ellipsisAfterFirst && (
                    <>
                      <ChevronRight size={10} strokeWidth={2} style={{ opacity: 0.4 }} />
                      <span
                        onClick={(e) => { e.stopPropagation(); setBreadcrumbExpanded(true); }}
                        style={{
                          cursor: "pointer",
                          padding: "0 2px",
                          borderRadius: 2,
                          color: "rgba(255,255,255,0.4)",
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
                    onClick={(e) => { e.stopPropagation(); if (!isLast) onBreadcrumbClick?.(seg.el); }}
                    onMouseEnter={() => { if (!isLast) onBreadcrumbHover?.(seg.el); }}
                    onMouseLeave={() => { if (!isLast) onBreadcrumbHover?.(null); }}
                    style={{
                      color: isLast ? "#fff" : "rgba(255,255,255,0.35)",
                      cursor: isLast ? "default" : "pointer",
                      whiteSpace: "nowrap",
                      borderRadius: 2,
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

      {/* ── Toolbar: scope pills + state selector on one row ── */}
      {hasToolbar && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          padding: "6px 12px 8px",
          flexWrap: "wrap",
        }}>
          {cssClasses.length > 0 && onScopeChange && (
            <>
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
            </>
          )}
          {state !== undefined && onStateChange && (
            <>
              {cssClasses.length > 0 && onScopeChange && (
                <div style={{
                  width: 1,
                  height: 14,
                  background: "rgba(255,255,255,0.08)",
                  margin: "0 3px",
                  flexShrink: 0,
                }} />
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

// ── Scope pill ──────────────────────────────────────────────

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
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: "2px 8px",
        fontSize: 10,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.45)",
        lineHeight: "16px",
        whiteSpace: "nowrap",
        transition: "background 100ms, color 100ms",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
        }
      }}
    >
      {label}
    </button>
  );
}
