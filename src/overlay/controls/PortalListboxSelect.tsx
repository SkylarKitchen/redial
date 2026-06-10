/**
 * PortalListboxSelect.tsx — Shared portal-dropdown combobox for header selectors.
 *
 * Extracted from StateSelector + BreakpointSelector (#code-review step 8).
 * Both are ~95% identical: same portal/keyboard/trigger/listbox wiring; the only
 * deltas are the options array, optional leading icon, trigger label logic, widths,
 * and an optional button title.
 *
 * Portal carries `data-tuner-portal` + zIndex.max so panel click handlers don't
 * hijack interactions inside the dropdown (project convention).
 */

import { useState, useRef, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";
import { text, color, badge, border, surface, font, shadow, zIndex } from "../theme";

export interface PortalListboxOption {
  id: string;
  label: string;
}

export interface PortalListboxSelectProps {
  /** Currently selected option id. */
  value: string;
  /** Called with the selected option id when the user picks an item. */
  onChange: (id: string) => void;
  /** The full options list. */
  options: PortalListboxOption[];
  /** Id of the "base" / default option — triggers the inactive color on the trigger. */
  baseId: string;
  /**
   * Text shown on the trigger when the base option is selected.
   * When undefined, the current option's label is always shown.
   */
  baseTriggerLabel?: string;
  /**
   * Optional leading icon rendered before the label inside the trigger button.
   * May be a ReactNode (static) or a render function receiving `isBase`
   * (useful when the icon's visual state depends on whether the base option
   * is active, e.g. opacity changes).
   */
  leadingIcon?: ReactNode | ((isBase: boolean) => ReactNode);
  /** Estimated dropdown width in px (used for portal positioning). Default 180. */
  estimatedWidth?: number;
  /** Min-width of the rendered listbox in px. Default mirrors estimatedWidth. */
  listboxMinWidth?: number;
  /** Optional `title` attribute on the trigger button. */
  triggerTitle?: string;
}

export function PortalListboxSelect({
  value,
  onChange,
  options,
  baseId,
  baseTriggerLabel,
  leadingIcon,
  estimatedWidth = 180,
  listboxMinWidth,
  triggerTitle,
}: PortalListboxSelectProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const resolvedListboxMinWidth = listboxMinWidth ?? estimatedWidth;

  const { dropdownPos, updateDropdownPos, portalRef } = usePortalDropdown({
    open,
    setOpen,
    triggerRef,
    containerRef,
    estimatedHeight: 200,
    estimatedWidth,
  });

  const current = options.find((o) => o.id === value) ?? options[0];
  const isBase = value === baseId;

  const labels = options.map((o) => o.label);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: options.length,
    selectedIndex: options.findIndex((o) => o.id === value),
    onSelect: (i) => {
      onChange(options[i].id);
      setOpen(false);
    },
    labels,
  });

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setOpen(false);
  };

  const triggerLabel = isBase && baseTriggerLabel != null ? baseTriggerLabel : current.label;
  const resolvedLeadingIcon = typeof leadingIcon === "function" ? leadingIcon(isBase) : leadingIcon;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        title={triggerTitle}
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
        {resolvedLeadingIcon}
        <span>{triggerLabel}</span>
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
              minWidth: resolvedListboxMinWidth,
              background: color.popover,
              border: `1px solid ${border.default}`,
              borderRadius: 4,
              boxShadow: shadow.dropdown,
              padding: "4px 0",
              overflow: "hidden",
            }}
          >
            {options.map((option, idx) => {
              const isActive = option.id === value;
              const isHl = idx === highlightedIndex || idx === hoveredIdx;
              return (
                <div
                  key={option.id}
                  id={`${id}-opt-${idx}`}
                  ref={idx === highlightedIndex ? optionRefCallback : undefined}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(option.id)}
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
                  {option.label}
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
