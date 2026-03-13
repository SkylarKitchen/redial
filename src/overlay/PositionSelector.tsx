/**
 * PositionSelector.tsx — Webflow-style CSS position selector
 *
 * Rich dropdown with icons per position mode and a description area
 * explaining what each mode does. Replaces the plain SelectRow for
 * the `position` CSS property.
 *
 * Portal-based dropdown to avoid clipping in scroll containers.
 * Full keyboard navigation via useDropdownKeyboard hook.
 */

import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import type { IndicatorType } from "./theme";
import { ChevronDown, X, Move, LocateFixed, Pin, StickyNote } from "lucide-react";
import { ms } from "./timing";
import { color, text, border, surface, primaryAlpha, focusRing, font, labelIndicator, labelHighlight, shadow, zIndex } from "./theme";
import { useResetPopover } from "./controls";
import { useDropdownKeyboard } from "./useDropdownKeyboard";

// ─── Icons ──────────────────────────────────────────────────────────

const StaticIcon = () => <X size={16} strokeWidth={1.5} />;
const RelativeIcon = () => <Move size={16} strokeWidth={1.5} />;
const AbsoluteIcon = () => <LocateFixed size={16} strokeWidth={1.5} />;
const FixedIcon = () => <Pin size={16} strokeWidth={1.5} />;
const StickyIcon = () => <StickyNote size={16} strokeWidth={1.5} />;

// ─── Option data ────────────────────────────────────────────────────

interface PositionOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const POSITION_ITEMS: PositionOption[] = [
  {
    value: "static",
    label: "Static",
    icon: <StaticIcon />,
    description: "Static is the default position and displays an element based on styles in the Layout section.",
  },
  {
    value: "relative",
    label: "Relative",
    icon: <RelativeIcon />,
    description: "Relative positions an element relative to its normal position. Offset values shift it from where it would normally be.",
  },
  {
    value: "absolute",
    label: "Absolute",
    icon: <AbsoluteIcon />,
    description: "Absolute removes the element from normal flow and positions it relative to its closest positioned ancestor.",
  },
  {
    value: "fixed",
    label: "Fixed",
    icon: <FixedIcon />,
    description: "Fixed positions an element relative to the viewport. It stays in place when the page scrolls.",
  },
  {
    value: "sticky",
    label: "Sticky",
    icon: <StickyIcon />,
    description: "Sticky toggles between relative and fixed based on scroll position. Set a top offset to define when it sticks.",
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function PositionSelector({
  value,
  onChange,
  indicator,
  onReset,
}: {
  value: string;
  onChange: (value: string) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const id = useId();
  const resetPopover = useResetPopover(indicator, onReset);
  const current = POSITION_ITEMS.find((o) => o.value === value) ?? POSITION_ITEMS[0];

  // Keyboard navigation
  const labels = useMemo(() => POSITION_ITEMS.map((o) => o.label), []);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: POSITION_ITEMS.length,
    selectedIndex: POSITION_ITEMS.findIndex((o) => o.value === value),
    onSelect: (i) => {
      onChange(POSITION_ITEMS[i].value);
      setOpen(false);
    },
    labels,
  });

  // Description shows hovered item, keyboard-highlighted item, or current value
  const highlightedItem = highlightedIndex >= 0 ? POSITION_ITEMS[highlightedIndex] : null;
  const descriptionItem = hoveredValue
    ? POSITION_ITEMS.find((o) => o.value === hoveredValue) ?? current
    : highlightedItem ?? current;

  // Compute dropdown position from trigger rect with flip-above logic
  const DROPDOWN_HEIGHT = 280;
  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < DROPDOWN_HEIGHT ? rect.top - DROPDOWN_HEIGHT - 2 : rect.bottom + 2;
    setDropdownPos({ top, left: rect.left, width: rect.width });
  }, []);

  // Close on outside click (check both container and portal element)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const portal = document.querySelector("[data-position-selector-portal]");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span
        ref={resetPopover.anchorRef}
        style={{
          width: "64px",
          fontSize: "11px",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
        }}
        onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } resetPopover.triggerOpen(); }}
      >
        <span style={{
          ...(indicator && indicator !== "none"
            ? { background: labelIndicator.modified.bg, color: labelIndicator.modified.text, ...labelHighlight }
            : { color: text.label }),
        }}>
          Position
        </span>
      </span>
      {resetPopover.node}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        {/* Trigger button */}
        <button
          ref={triggerRef}
          className="tuner-focusable"
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
          onClick={(e) => {
            if (e.altKey && onReset) { e.preventDefault(); onReset(); return; }
            if (!open) updateDropdownPos();
            setOpen((o) => !o);
          }}
          onKeyDown={onTriggerKeyDown}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
          style={{
            width: "100%",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: open ? border.input : color.input,
            border: `1px solid ${color.border}`,
            borderRadius: 2,
            color: text.secondary,
            fontSize: "11px",
            fontFamily: font.mono,
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            transition: `background ${ms("fast")}, box-shadow ${ms("fast")}`,
          }}
          onMouseEnter={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = border.input;
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = color.input;
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: text.label, display: "flex" }}>{current.icon}</span>
            {current.label}
          </span>
          <ChevronDown size={12} strokeWidth={2} style={{ color: text.disabled, flexShrink: 0, marginLeft: "4px" }} />
        </button>

        {/* Dropdown — portaled to document.body to escape scroll overflow */}
        {open && dropdownPos && createPortal(
          <div
            data-tuner-portal
            data-position-selector-portal
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
                minWidth: Math.max(dropdownPos.width, 200),
                background: color.popover,
                border: `1px solid ${border.hover}`,
                borderRadius: "4px",
                boxShadow: shadow.dropdown,
                overflow: "hidden",
              }}
            >
              {/* Options list */}
              <div style={{ padding: "4px 0" }}>
                {POSITION_ITEMS.map((opt, idx) => {
                  const isActive = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={opt.value}
                      id={`${id}-opt-${idx}`}
                      ref={isHighlighted ? optionRefCallback : undefined}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={(e) => {
                        setHoveredValue(opt.value);
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background = color.input;
                      }}
                      onMouseLeave={(e) => {
                        setHoveredValue(null);
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background = isHighlighted ? surface.hover : "transparent";
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        cursor: "pointer",
                        background: isActive ? primaryAlpha(0.15) : isHighlighted ? surface.hover : "transparent",
                        transition: `background ${ms("micro")}`,
                      }}
                    >
                      {/* Checkmark column */}
                      <span
                        style={{
                          width: "14px",
                          fontSize: "11px",
                          color: isActive ? color.primary : "transparent",
                          flexShrink: 0,
                          textAlign: "center",
                        }}
                      >
                        ✓
                      </span>

                      {/* Icon */}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "20px",
                          height: "20px",
                          color: isActive ? color.foreground : text.label,
                          flexShrink: 0,
                        }}
                      >
                        {opt.icon}
                      </span>

                      {/* Label */}
                      <span
                        style={{
                          fontSize: "12px",
                          color: isActive ? color.foreground : text.label,
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Description area */}
              <div
                style={{
                  borderTop: `1px solid ${surface.hover}`,
                  padding: "10px 12px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    lineHeight: 1.45,
                    color: text.label,
                  }}
                >
                  <strong style={{ color: text.secondary }}>{descriptionItem.label}</strong>{" "}
                  {descriptionItem.description.replace(`${descriptionItem.label} `, "")}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
