/**
 * StateSelector.tsx — Dropdown for selecting CSS pseudo-class states
 *
 * Compact trigger shows current state + chevron. Green text when
 * a non-base state is active, matching Webflow's state indicator.
 *
 * Built on the project's portal-dropdown pattern (usePortalDropdown +
 * createPortal to document.body), mirroring UnitSelector — no shadcn/Radix.
 * The portal carries `data-tuner-portal` and `zIndex.max` so panel click
 * handlers don't hijack interactions inside the dropdown.
 */

import { useState, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";
import { text, color, badge, border, surface, font, shadow, zIndex } from "../theme";

export interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
}

interface StateOption {
  value: string;
  label: string;
}

const STATES: StateOption[] = [
  { value: "none", label: "None — base styles" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Focus" },
  { value: "active", label: "Active" },
  { value: "visited", label: "Visited" },
  { value: "focus-within", label: "Focus Within" },
  { value: "focus-visible", label: "Focus Visible" },
];

export function StateSelector({ value, onChange }: StateSelectorProps) {
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
    estimatedWidth: 180,
  });

  const current = STATES.find((s) => s.value === value) ?? STATES[0];
  const isBase = value === "none";

  const labels = STATES.map((s) => s.label);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: STATES.length,
    selectedIndex: STATES.findIndex((s) => s.value === value),
    onSelect: (i) => {
      onChange(STATES[i].value);
      setOpen(false);
    },
    labels,
  });

  const handleSelect = (state: string) => {
    onChange(state);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Compact transparent trigger */}
      <button
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
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
        <span>{isBase ? "State" : current.label}</span>
        <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {/* Dropdown — portaled to document.body to escape scroll overflow */}
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
              minWidth: 180,
              background: color.popover,
              border: `1px solid ${border.default}`,
              borderRadius: 4,
              boxShadow: shadow.dropdown,
              padding: "4px 0",
              overflow: "hidden",
            }}
          >
            {STATES.map((state, idx) => {
              const isActive = state.value === value;
              const isHl = idx === highlightedIndex || idx === hoveredIdx;
              return (
                <div
                  key={state.value}
                  id={`${id}-opt-${idx}`}
                  ref={idx === highlightedIndex ? optionRefCallback : undefined}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(state.value)}
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
                  {state.label}
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
