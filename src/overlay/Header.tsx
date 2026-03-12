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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";

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
      className="__tuner-header flex flex-col border-b cursor-grab select-none"
      style={{ borderColor: border.subtle }}
      onMouseDown={onDragStart}
    >
      {/* -- Drag handle indicator -- */}
      <div className="flex justify-center pt-[5px]">
        <div className="w-7 h-[3px] rounded-full" style={{ background: surface.active }} />
      </div>

      {/* -- Main row: tag + class | badges + close -- */}
      <div className="flex items-center justify-between px-3 pt-1.5">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-black text-[13px] font-mono font-medium shrink-0">
            {"<"}{tag}{">"}
          </span>
          {className && (
            <span className="text-[11px] font-mono overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: text.label }}>
              .{className}
            </span>
          )}
        </div>
        <div className="flex items-center gap-[5px] shrink-0">
          <Badge
            variant="outline"
            className="text-[9px] font-mono px-1.5 py-0 rounded-[3px] tracking-wider uppercase cursor-default leading-[14px]"
            style={{ color: text.disabled, background: surface.subtle, borderColor: border.subtle }}
            title={`${vw}px viewport \u00b7 ${tier} breakpoint`}
          >
            {tier}
          </Badge>
          {totalChanges > 0 && (
            <Badge
              className="bg-[#D97757]/[0.15] border-[#D97757]/[0.2] text-[#D97757]/95 text-[9px] font-semibold font-mono px-1.5 py-0 rounded-[3px] leading-[14px] min-w-[18px] text-center cursor-pointer hover:bg-[#D97757]/[0.2]"
              onClick={onShowSession}
              title={`${totalChanges} total change${totalChanges === 1 ? "" : "s"} \u2014 click to view session`}
            >
              {totalChanges}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-[18px] w-[18px] p-0 rounded-[3px] transition-colors duration-100 hover:bg-[rgba(0,0,0,0.05)] hover:text-[rgba(0,0,0,0.7)]"
            style={{ color: text.disabled }}
            title="Close (Esc)"
          >
            <X size={12} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* -- Source file -- */}
      {sourceFile && (
        <div className="px-3 pt-0.5">
          <span className="text-[10px] font-mono" style={{ color: text.disabled }}>
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
          <div className="flex items-center gap-0.5 text-[11px] font-mono px-3 pt-[3px] overflow-hidden" style={{ color: text.label }}>
            {visibleSegments.map((seg, i) => {
              const isLast = i === visibleSegments.length - 1;
              const label = seg.className ? `${seg.tag}.${seg.className}` : seg.tag;
              return (
                <span key={i} className="flex items-center gap-0.5">
                  {i === 1 && ellipsisAfterFirst && (
                    <>
                      <ChevronRight size={10} strokeWidth={2} className="opacity-40" />
                      <span
                        onClick={(e) => { e.stopPropagation(); setBreadcrumbExpanded(true); }}
                        className="cursor-pointer px-0.5 rounded-sm transition-colors duration-100 hover:text-[rgba(0,0,0,0.7)] hover:bg-[rgba(0,0,0,0.05)]"
                        style={{ color: text.disabled }}
                        title="Show full breadcrumb"
                      >
                        ...
                      </span>
                    </>
                  )}
                  {i > 0 && <ChevronRight size={10} strokeWidth={2} className="opacity-40" />}
                  <span
                    onClick={(e) => { e.stopPropagation(); if (!isLast) onBreadcrumbClick?.(seg.el); }}
                    onMouseEnter={() => { if (!isLast) onBreadcrumbHover?.(seg.el); }}
                    onMouseLeave={() => { if (!isLast) onBreadcrumbHover?.(null); }}
                    className={cn(
                      "whitespace-nowrap rounded-sm transition-colors duration-100",
                      isLast
                        ? "text-black cursor-default"
                        : "cursor-pointer px-0.5 hover:text-[rgba(0,0,0,0.7)] hover:bg-[rgba(0,0,0,0.05)]",
                    )}
                    style={isLast ? undefined : { color: text.label }}
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
        <div className="flex items-center gap-[3px] px-3 pt-1.5 pb-2 flex-wrap">
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
                <div className="w-px h-3.5 mx-[3px] shrink-0" style={{ background: surface.hover }} />
              )}
              <StateSelector value={state} onChange={onStateChange} />
            </>
          )}
        </div>
      )}

      {/* Bottom spacing when no toolbar present */}
      {!hasToolbar && <div className="h-2" />}
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
  return (
    <Badge
      variant="outline"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "px-2 py-0 text-[10px] font-mono border-none rounded cursor-pointer leading-4 whitespace-nowrap transition-colors duration-100 hover:bg-[rgba(0,0,0,0.04)] hover:text-[rgba(0,0,0,0.6)]",
        active
          ? "text-black hover:bg-[rgba(0,0,0,0.08)] hover:text-black"
          : "bg-transparent",
      )}
      style={active ? { background: surface.active } : { color: text.label }}
    >
      {label}
    </Badge>
  );
}
