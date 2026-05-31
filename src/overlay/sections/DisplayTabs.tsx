/**
 * DisplayTabs.tsx — Display mode row extracted from layoutControls.tsx
 *
 * DisplayTabs + DarkMenuOption (shared with FlexDirectionRow).
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useCallback } from "react";
import { text, surface, font, blackAlpha, bgAlpha, segment, zIndex, darkToolbar, type IndicatorType } from "../theme";
import { ms } from "../timing";
import { SegmentedControl } from "../controls/SegmentedControl";
import {
  DisplayInlineBlockIcon, DisplayFlexIcon, DisplayGridIcon,
  DisplayInlineIcon, DisplayHideIcon, ChevronSmallDownIcon,
} from "../webflowIcons";
import { useClickOutside } from "../hooks/useClickOutside";
import { ROW } from "../panelStyles";
import { RowLabel } from "./layoutPrimitives";

// ─── DisplayTabs (Text segments + overflow dropdown, Webflow style) ─

/** Primary display modes shown as text segments */
const DISPLAY_PRIMARY = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
  { value: "grid", label: "Grid" },
  { value: "none", label: "None" },
];

/** Overflow display modes shown in the chevron dropdown */
const DISPLAY_OVERFLOW = [
  { value: "inline-block", label: "Inline-block", icon: <DisplayInlineBlockIcon size={16} /> },
  { value: "inline-flex", label: "Inline-flex", icon: <DisplayFlexIcon size={16} /> },
  { value: "inline-grid", label: "Inline-grid", icon: <DisplayGridIcon size={16} /> },
  { value: "inline", label: "Inline", icon: <DisplayInlineIcon size={16} /> },
  { value: "none", label: "None", icon: <DisplayHideIcon size={16} /> },
];

const PRIMARY_VALUES = new Set(DISPLAY_PRIMARY.map((o) => o.value));

/** Display row: 4 text segments + chevron overflow dropdown (matches Webflow) */
export function DisplayTabs({ value, onChange, onReset, indicator }: {
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, closeDropdown);

  // If current value is an overflow item, don't highlight any primary segment
  const segmentValue = PRIMARY_VALUES.has(value) ? value : "";
  const isOverflowActive = !PRIMARY_VALUES.has(value);

  return (
    <div style={ROW}>
      <RowLabel label="Display" indicator={indicator} isSet={value !== "block"} onReset={onReset} />
      <SegmentedControl
        options={DISPLAY_PRIMARY}
        value={segmentValue}
        onChange={onChange}
        aria-label="Display mode"
      />
      {/* Chevron overflow trigger */}
      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          title="More display options"
          aria-expanded={open}
          aria-haspopup="listbox"
          style={{
            width: 20,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            border: "none",
            outline: "none",
            cursor: "pointer",
            padding: 0,
            background: isOverflowActive ? segment.activeBg : "transparent",
            color: isOverflowActive ? text.primary : text.hint,
            transition: `background ${ms("fast")} ease`,
          }}
        >
          <ChevronSmallDownIcon size={16} />
        </button>
        {open && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 180,
              background: surface.darkMenu,
              borderRadius: 8,
              boxShadow: `0 8px 24px ${blackAlpha(0.35)}, 0 2px 8px ${blackAlpha(0.2)}`,
              padding: "6px 0",
              zIndex: zIndex.popover,
            }}
          >
            {DISPLAY_OVERFLOW.map((opt) => {
              const isActive = opt.value === value;
              return (
                <DarkMenuOption
                  key={opt.value}
                  label={opt.label}
                  icon={opt.icon}
                  isActive={isActive}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shared dark menu option for DisplayTabs and FlexDirectionRow dropdowns */
export function DarkMenuOption({ label, icon, isActive, onClick }: {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const activeBg = bgAlpha(0.08);

  return (
    <button
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "7px 12px",
        background: isActive || hovered ? activeBg : "transparent",
        border: "none",
        outline: "none",
        cursor: "pointer",
        color: darkToolbar.text,
        fontSize: 13,
        fontFamily: font.sans,
        letterSpacing: -0.1,
        textAlign: "left",
      }}
    >
      {icon && (
        <span style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {isActive && (
        <span style={{ opacity: 0.5, fontSize: 14 }}>✓</span>
      )}
    </button>
  );
}
