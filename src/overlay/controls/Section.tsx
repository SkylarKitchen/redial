/**
 * controls/Section.tsx — Collapsible section component with memory support.
 */

import React, { useState, useContext } from "react";
import { type IndicatorType, indicatorStyle, altClickReset } from "../theme";
import { ms, cssTransition } from "../timing";
import { color, surface } from "../theme";
import { ChevronRight } from "lucide-react";
import { SectionMemoryContext } from "./helpers";

export function Section({
  title,
  collapsed,
  children,
  indicator,
  forceOpen,
  hidden,
  headerAction,
  focusOpen,
  onToggle,
  onReset,
}: {
  title: React.ReactNode;
  collapsed?: boolean;
  children: React.ReactNode;
  indicator?: IndicatorType;
  forceOpen?: boolean;
  /** When true, hide the section entirely (used by search filter) */
  hidden?: boolean;
  headerAction?: React.ReactNode;
  /** In focus mode, externally controlled open state */
  focusOpen?: boolean;
  /** Called when section header is clicked (for focus mode coordination) */
  onToggle?: (title: string) => void;
  /** Alt+click on title resets the section */
  onReset?: () => void;
}) {
  const sectionMemory = useContext(SectionMemoryContext);
  const titleStr = typeof title === "string" ? title : "";
  const memoryOpen = titleStr && sectionMemory ? sectionMemory.memory[titleStr] : undefined;
  const [ownOpen, setOwnOpen] = useState(memoryOpen !== undefined ? memoryOpen : !collapsed);
  const [headerHovered, setHeaderHovered] = useState(false);
  const open = forceOpen || (focusOpen !== undefined ? focusOpen : ownOpen);

  const toggle = () => {
    if (onToggle) onToggle(titleStr);
    else {
      const next = !open;
      setOwnOpen(next);
      if (titleStr && sectionMemory) sectionMemory.update(titleStr, next);
    }
  };

  if (hidden) return null;
  return (
    <div style={{ borderBottom: open ? "1px solid transparent" : `1px solid ${color.border}` }}>
      <div
        tabIndex={0}
        role="button"
        aria-expanded={open}
        onClick={toggle}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          borderRadius: 2,
          outline: "none",
          padding: "10px 12px 6px",
          transition: `background ${ms("fast")}`,
          ...(open
            ? { position: "sticky" as const, top: 0, zIndex: 2, background: color.background }
            : { background: headerHovered ? surface.hover : "transparent" }),
        }}
      >
        <span
          style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, color: color.foreground }}
          onClick={altClickReset(onReset)}
        >
          <span style={indicatorStyle(indicator)}>
            {title}
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {headerAction && (
            <span onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </span>
          )}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              color: color.mutedForeground,
              transition: cssTransition("transform", "expand"),
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            <ChevronRight size={12} strokeWidth={2} />
          </span>
        </div>
      </div>
      {open ? <div style={{ paddingBottom: 8 }}>{children}</div> : null}
    </div>
  );
}
