/**
 * BreakpointSelector.tsx — Dropdown for choosing the target responsive breakpoint
 *
 * The "which breakpoint am I editing" indicator + selector for issue #35. While
 * a non-base breakpoint is active, every style edit is keyed to that breakpoint
 * (ADR-0005) and previewed media-gated (breakpointPreview.ts).
 *
 * Mirrors StateSelector: the project's portal-dropdown pattern (usePortalDropdown
 * + createPortal to document.body), inline-styled — no shadcn/Radix. The portal
 * carries `data-tuner-portal` + `zIndex.max` so panel click handlers don't hijack
 * interactions inside the dropdown. Accent text marks a non-base breakpoint,
 * matching the State selector's active indicator.
 */

import { useState, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Monitor } from "lucide-react";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";
import { BREAKPOINTS, BASE_BREAKPOINT_ID } from "../breakpoints";
import { text, color, badge, border, surface, font, shadow, zIndex } from "../theme";

export interface BreakpointSelectorProps {
  value: string;
  onChange: (breakpoint: string) => void;
}

export function BreakpointSelector({ value, onChange }: BreakpointSelectorProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const { dropdownPos, updateDropdownPos, portalRef } = usePortalDropdown({
    open,
    setOpen,
    triggerRef,
    containerRef,
    estimatedHeight: 200,
    estimatedWidth: 160,
  });

  const current = BREAKPOINTS.find((b) => b.id === value) ?? BREAKPOINTS[0];
  const isBase = value === BASE_BREAKPOINT_ID;

  const labels = BREAKPOINTS.map((b) => b.label);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: BREAKPOINTS.length,
    selectedIndex: BREAKPOINTS.findIndex((b) => b.id === value),
    onSelect: (i) => {
      onChange(BREAKPOINTS[i].id);
      setOpen(false);
    },
    labels,
  });

  const handleSelect = (bp: string) => {
    onChange(bp);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        title="Target breakpoint"
        onClick={() => { if (!open) updateDropdownPos(); setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            updateDropdownPos();
          }
          onTriggerKeyDown(e);
        }}
        style={{
          height: 24,
          padding: "0 6px",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "auto",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          cursor: "pointer",
          lineHeight: 1,
          color: isBase ? text.label : badge.action,
        }}
      >
        <Monitor size={12} style={{ flexShrink: 0, opacity: isBase ? 0.6 : 0.9 }} />
        <span>{current.label}</span>
        <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={portalRef}
          data-tuner-portal
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: zIndex.max,
          }}
        >
          <div
            id={`${id}-listbox`}
            role="listbox"
            onKeyDown={onListKeyDown}
            style={{
              minWidth: 160,
              background: color.popover,
              border: `1px solid ${border.default}`,
              borderRadius: 4,
              boxShadow: shadow.dropdown,
              padding: "4px 0",
              overflow: "hidden",
            }}
          >
            {BREAKPOINTS.map((bp, idx) => {
              const isActive = bp.id === value;
              const isHl = idx === highlightedIndex || idx === hoveredIdx;
              return (
                <div
                  key={bp.id}
                  id={`${id}-opt-${idx}`}
                  ref={idx === highlightedIndex ? optionRefCallback : undefined}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(bp.id)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    padding: "6px 32px 6px 8px",
                    fontSize: 11,
                    fontFamily: font.sans,
                    cursor: "pointer",
                    lineHeight: "16px",
                    background: isHl ? surface.hover : "transparent",
                    color: isActive ? badge.action : text.label,
                  }}
                >
                  {bp.label}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
