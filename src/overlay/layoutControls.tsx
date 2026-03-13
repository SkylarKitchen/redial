/**
 * layoutControls.tsx — Sub-components extracted from WebflowPanel.tsx
 *
 * RowLabel, TextToggle, ReverseButton, DisplayTabs, DirectionRow, GapRow, ChildrenRow,
 * MiniDropdown, TypoValueCell.
 */

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { ChevronDown, Link, Unlink, WrapText } from "lucide-react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { ValueInput, selectAllOnDoubleClick, useValueFlash } from "./controls";
import { evaluateMathExpr } from "./inputMath";
import { color, text, border, surface, font, blackAlpha, primaryAlpha, labelIndicator, segment } from "./theme";
import { ms } from "./timing";
import type { IndicatorType } from "./StyleIndicator";
import { SegmentedControl } from "./SegmentedControl";
import {
  ArrowReverseIcon, UnlockIcon, LockIcon,
  DisplayInlineBlockIcon, DisplayFlexIcon, DisplayGridIcon,
  DisplayInlineIcon, DisplayHideIcon, ChevronSmallDownIcon,
} from "./webflowIcons";

import { useClickOutside } from "./useClickOutside";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { useWheelAdjust } from "./useWheelAdjust";
import { cn } from "@/lib/utils";
import { LAYOUT_UNITS } from "./panelConstants";

// ─── RowLabel ───────────────────────────────────────────────────────

/**
 * Shared label with blue highlight when modified. Alt+click resets.
 */
export function RowLabel({ label, isSet, indicator, onReset }: {
  label: string;
  /** @deprecated Use `indicator` instead */
  isSet?: boolean;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const effectiveIndicator: IndicatorType = indicator ?? (isSet ? "modified" : "none");
  const colors = labelIndicator[effectiveIndicator] ?? labelIndicator.none;
  const hasHighlight = effectiveIndicator !== "none";

  return (
    <span
      className="text-[11.5px] shrink-0 select-none rounded-[2px] px-[1px] leading-[16px]"
      style={{
        width: hasHighlight ? undefined : 49,
        background: colors.bg,
        color: colors.text,
        fontFamily: font.sans,
        letterSpacing: -0.115,
        cursor: onReset ? "default" : undefined,
      }}
      onClick={(e) => { if (e.altKey && onReset) onReset(); }}
    >
      {label}
    </span>
  );
}

// ─── TextToggle ─────────────────────────────────────────────────────

/** Segmented text toggle: 2 options as a button pair */
export function TextToggle({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded border" style={{ borderColor: surface.track }}>
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        const isFirst = i === 0;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 px-2.5 text-[10px] font-sans cursor-pointer border-none outline-none transition-colors",
              !isFirst && "border-l",
              isActive ? "font-medium" : "bg-transparent hover:bg-[var(--accent)]",
            )}
            style={{
              ...(!isFirst ? { borderLeftColor: surface.track } : {}),
              ...(isActive
                ? { background: surface.active, color: color.foreground }
                : { color: text.label }),
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── ReverseButton ──────────────────────────────────────────────────

/** Webflow-style icon button for flex-direction reverse / wrap-reverse */
function ReverseButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      title={active ? "Reverse (active)" : "Reverse"}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        border: "none",
        outline: "none",
        cursor: "pointer",
        flexShrink: 0,
        padding: 4,
        overflow: "hidden",
        transition: `background ${ms("fast")} ease`,
        background: active ? segment.activeBg : segment.bg,
        color: active ? text.primary : text.secondary,
      }}
    >
      <ArrowReverseIcon size={16} />
    </button>
  );
}

// ─── MiniDropdown ───────────────────────────────────────────────────

/** Mini dropdown for X/Y alignment values */
export function MiniDropdown({ value, options, onChange }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const id = useId();
  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, closeDropdown);

  const optionLabels = options.map(o => o.label);
  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: options.length,
    selectedIndex: options.findIndex((o) => o.value === value),
    onSelect: (i) => { onChange(options[i].value); setOpen(false); },
    labels: optionLabels,
  });

  return (
    <div ref={ref} className="relative flex-1">
      <button
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="w-full h-[22px] flex items-center justify-between px-1.5 bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[10px] font-mono cursor-pointer outline-none"
        style={{ color: text.label }}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{current?.label ?? value}</span>
        <ChevronDown size={12} strokeWidth={2} className="ml-1 shrink-0" style={{ color: text.disabled }} />
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          className="absolute z-[200] top-[calc(100%+2px)] left-0 right-0 min-w-[80px] bg-[#F5F5F5] border rounded shadow-[0_4px_12px_rgba(0,0,0,0.1)] py-0.5"
          style={{ borderColor: surface.track }}
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            const isHighlighted = i === highlightedIndex;
            return (
              <div
                key={opt.value}
                id={`${id}-opt-${i}`}
                ref={i === highlightedIndex ? optionRefCallback : undefined}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "px-2 py-[3px] text-[10px] font-mono cursor-pointer",
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "hover:bg-[rgba(0,0,0,0.05)]",
                )}
                style={!active ? {
                  color: text.label,
                  ...(isHighlighted ? { background: surface.hover } : {}),
                } : undefined}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
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
              boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
              padding: "6px 0",
              zIndex: 200,
            }}
          >
            {DISPLAY_OVERFLOW.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "7px 12px",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    color: "#e8e8e8",
                    fontSize: 13,
                    fontFamily: font.sans,
                    letterSpacing: -0.1,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent"; }}
                >
                  <span style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
                    {opt.icon}
                  </span>
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {isActive && (
                    <span style={{ opacity: 0.5, fontSize: 14 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DirectionRow (legacy) ───────────────────────────────────────────

/** Direction row: Horizontal/Vertical segmented control + reverse button */
export function DirectionRow({ direction, onDirectionChange, onReset, indicator }: {
  direction: string;
  onDirectionChange: (v: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  const isHorizontal = !direction.startsWith("column");
  const isReverse = direction.includes("reverse");
  const isSet = direction !== "row";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
      <RowLabel label="Direction" indicator={indicator} isSet={isSet} onReset={onReset} />
      <SegmentedControl
        options={[
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ]}
        value={isHorizontal ? "horizontal" : "vertical"}
        onChange={(v) => {
          const base = v === "horizontal" ? "row" : "column";
          onDirectionChange(isReverse ? `${base}-reverse` : base);
        }}
        aria-label="Flex direction"
      />
      <ReverseButton
        active={isReverse}
        onClick={() => {
          const base = isHorizontal ? "row" : "column";
          onDirectionChange(isReverse ? base : `${base}-reverse`);
        }}
      />
    </div>
  );
}

// ─── FlexDirectionRow (Webflow-style: icons + wrap toggle + chevron) ─

import { DIRECTION_ICONS_SHORT, DIRECTION_MORE_OPTIONS } from "./panelConstants";

/** Webflow-style direction row: 2-icon SegmentedControl + wrap toggle + chevron dropdown */
export function FlexDirectionRow({ direction, onDirectionChange, wrap, onWrapChange, onReset, indicator, wrapIndicator }: {
  direction: string;
  onDirectionChange: (v: string) => void;
  wrap: string;
  onWrapChange: (v: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  wrapIndicator?: IndicatorType;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

  const isWrap = wrap !== "nowrap";
  const isReverse = direction.includes("reverse");
  const base = direction.replace("-reverse", "") as "row" | "column";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
      <RowLabel label="Direction" indicator={indicator} isSet={direction !== "row"} onReset={onReset} />
      {/* Row / Column icon segments */}
      <SegmentedControl
        options={DIRECTION_ICONS_SHORT.slice(0, 2)}
        value={base}
        onChange={(v) => onDirectionChange(isReverse ? `${v}-reverse` : v)}
        aria-label="Flex direction"
      />
      {/* Wrap toggle button — separate from SegmentedControl since it controls a different prop */}
      <button
        title={isWrap ? "Wrap (active)" : "Wrap"}
        onClick={() => onWrapChange(isWrap ? "nowrap" : "wrap")}
        style={{
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          border: "none",
          outline: "none",
          cursor: "pointer",
          flexShrink: 0,
          padding: 4,
          overflow: "hidden",
          transition: `background ${ms("fast")} ease`,
          background: isWrap ? segment.activeBg : segment.bg,
          color: isWrap ? text.primary : text.secondary,
        }}
      >
        <WrapText size={14} strokeWidth={1.8} />
      </button>
      {/* Chevron dropdown for reverse variants */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title="More direction options"
          aria-expanded={menuOpen}
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
            background: isReverse ? segment.activeBg : "transparent",
            color: isReverse ? text.primary : text.hint,
            transition: `background ${ms("fast")} ease`,
          }}
        >
          <ChevronSmallDownIcon size={16} />
        </button>
        {menuOpen && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 180,
              background: surface.darkMenu,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
              padding: "6px 0",
              zIndex: 200,
            }}
          >
            {DIRECTION_MORE_OPTIONS.map((opt) => {
              const isActive = opt.value === direction;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onDirectionChange(opt.value); setMenuOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "7px 12px",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    color: "#e8e8e8",
                    fontSize: 13,
                    fontFamily: font.sans,
                    letterSpacing: -0.1,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent"; }}
                >
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {isActive && <span style={{ opacity: 0.5, fontSize: 14 }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GapRow (Dual Inputs) ───────────────────────────────────────────

/** Webflow-style gap input: bordered field with integrated unit suffix */
function GapInput({ value, unit, onChange }: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value * 100) / 100));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onChange(mathResult); return; }
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onChange(value + (e.shiftKey ? 10 : 1)); }
    else if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - (e.shiftKey ? 10 : 1))); }
  };

  return (
    <div style={{
      display: "flex",
      flex: 1,
      minWidth: 0,
      height: 24,
      borderRadius: segment.radius,
      border: `1px solid ${border.default}`,
      overflow: "hidden",
      background: color.background,
    }}>
      {/* Value area */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: 4,
        gap: 2,
        background: segment.hoverBg,
        overflow: "hidden",
      }}>
        {editing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 11.5,
              fontFamily: font.sans,
              letterSpacing: -0.115,
              color: text.primary,
              lineHeight: "16px",
            }}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
            style={{
              fontSize: 11.5,
              fontFamily: font.sans,
              letterSpacing: -0.115,
              color: text.primary,
              lineHeight: "16px",
              cursor: "text",
              outline: "none",
            }}
          >
            {value}
          </span>
        )}
      </div>
      {/* Unit suffix */}
      <div style={{
        width: 16,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: segment.activeBg,
        fontSize: 8,
        fontFamily: font.sans,
        fontWeight: 600,
        color: text.secondary,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        flexShrink: 0,
      }}>
        {unit}
      </div>
    </div>
  );
}

/** Gap row: dual Webflow-style inputs (column + row) with link toggle */
export function GapRow({ columnGap, rowGap, columnUnit, rowUnit, onColumnChange, onRowChange,
                          onColumnUnitChange, onRowUnitChange, linked, onLinkedChange, onReset,
                          indicator }: {
  columnGap: number;
  rowGap: number;
  columnUnit: string;
  rowUnit: string;
  onColumnChange: (v: number) => void;
  onRowChange: (v: number) => void;
  onColumnUnitChange: (u: string) => void;
  onRowUnitChange: (u: string) => void;
  linked: boolean;
  onLinkedChange: (v: boolean) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  const isSet = columnGap !== 0 || rowGap !== 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
        <RowLabel label="Gap" indicator={indicator} isSet={isSet} onReset={onReset} />
        {/* Column gap input */}
        <GapInput value={columnGap} unit={columnUnit} onChange={(v) => {
          onColumnChange(v);
          if (linked) onRowChange(v);
        }} />
        {/* Link/unlock toggle */}
        <button
          onClick={() => onLinkedChange(!linked)}
          title={linked ? "Gap linked (column = row)" : "Gap unlinked"}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
            borderRadius: 4,
            color: text.secondary,
          }}
        >
          {linked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
        {/* Row gap input */}
        <GapInput value={rowGap} unit={rowUnit} onChange={(v) => {
          onRowChange(v);
          if (linked) onColumnChange(v);
        }} />
      </div>
      {/* Sub-labels: Columns / Rows — positioned under their respective inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", marginTop: 4 }}>
        <span style={{ width: 49, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <RowLabel label="Columns" indicator={isSet ? "modified" : "none"} />
        </span>
        <span style={{ width: 24, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <RowLabel label="Rows" indicator={isSet ? "modified" : "none"} />
        </span>
      </div>
    </div>
  );
}

// ─── GridTrackRow ───────────────────────────────────────────────────

/** Numeric stepper input for grid column/row count (Webflow-style dark bg) */
function TrackCountInput({ value, onChange }: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 1 && n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onChange(value + 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, value - 1)); }
  };

  return (
    <div style={{
      display: "flex",
      flex: 1,
      minWidth: 0,
      height: 28,
      borderRadius: segment.radius,
      border: `1px solid ${border.default}`,
      overflow: "hidden",
      background: segment.hoverBg,
      alignItems: "center",
    }}>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            fontFamily: font.sans,
            color: color.foreground,
            textAlign: "center",
            padding: "0 8px",
          }}
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: font.sans,
            color: color.foreground,
            textAlign: "center",
            cursor: "text",
            outline: "none",
            lineHeight: "28px",
          }}
        >
          {value}
        </span>
      )}
      {/* Stepper arrows */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: 14,
        flexShrink: 0,
        marginRight: 2,
      }}>
        <button
          tabIndex={-1}
          onClick={() => onChange(value + 1)}
          style={{
            height: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: text.label,
            fontSize: 8,
          }}
        >▲</button>
        <button
          tabIndex={-1}
          onClick={() => onChange(Math.max(1, value - 1))}
          style={{
            height: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: text.label,
            fontSize: 8,
          }}
        >▼</button>
      </div>
    </div>
  );
}

/** Grid track row: dual count inputs for Columns/Rows + link toggle (Webflow-style) */
export function GridTrackRow({ columns, rows, onColumnsChange, onRowsChange,
                               linked, onLinkedChange, onReset, indicator }: {
  columns: number;
  rows: number;
  onColumnsChange: (v: number) => void;
  onRowsChange: (v: number) => void;
  linked: boolean;
  onLinkedChange: (v: boolean) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
        <RowLabel label="Grid" indicator={indicator} onReset={onReset} />
        <TrackCountInput value={columns} onChange={(v) => {
          onColumnsChange(v);
          if (linked) onRowsChange(v);
        }} />
        <TrackCountInput value={rows} onChange={(v) => {
          onRowsChange(v);
          if (linked) onColumnsChange(v);
        }} />
        <button
          onClick={() => onLinkedChange(!linked)}
          title={linked ? "Columns/rows linked" : "Columns/rows independent"}
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            marginRight: 8,
            borderRadius: 3,
            flexShrink: 0,
            color: text.disabled,
          }}
        >
          {linked ? <Link size={12} strokeWidth={1.5} /> : <Link size={12} strokeWidth={1.5} style={{ opacity: 0.4 }} />}
        </button>
      </div>
      {/* Sub-labels: Columns / Rows */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", marginTop: 2 }}>
        <span style={{ width: 49, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Columns</span>
        </span>
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Rows</span>
        </span>
        <span style={{ width: 24, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ─── ChildrenRow ────────────────────────────────────────────────────

/** Children row: Don't wrap / Wrap segmented control + reverse button */
export function ChildrenRow({ wrap, onWrapChange, indicator, onReset }: {
  wrap: string;
  onWrapChange: (v: string) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const isWrap = wrap === "wrap" || wrap === "wrap-reverse";
  const isReverse = wrap === "wrap-reverse";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
      <RowLabel label="Children" indicator={indicator} isSet={isWrap} onReset={onReset} />
      <SegmentedControl
        options={[
          { value: "nowrap", label: "Don\u2019t wrap" },
          { value: "wrap", label: "Wrap" },
        ]}
        value={isWrap ? "wrap" : "nowrap"}
        onChange={(v) => onWrapChange(v === "wrap" ? "wrap" : "nowrap")}
        aria-label="Flex wrap"
      />
      <ReverseButton
        active={isReverse}
        onClick={() => onWrapChange(isReverse ? "wrap" : "wrap-reverse")}
      />
    </div>
  );
}

// ─── TypoValueCell ──────────────────────────────────────────────────

/** Compact bordered input cell for typography properties (Size, Height, etc.) */
export function TypoValueCell({
  value,
  onChange,
  unit,
  onUnitChange,
  units,
  step = 1,
  keyword,
  conversionHint,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  onUnitChange?: (u: string) => void;
  units?: string[];
  step?: number;
  keyword?: string | null;
  /** Conversion tooltip hint passed through to UnitSelector */
  conversionHint?: ConversionHint | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const cellRef = useRef<HTMLDivElement>(null);
  const flashStyle = useValueFlash(value);
  useWheelAdjust(cellRef, value, onChange, { step, disabled: keyword != null });

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value * 100) / 100));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onChange(mathResult); return; }
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
      const next = Math.round((value + s) * 100) / 100;
      setDraft(String(next));
      onChange(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
      const next = Math.round((value - s) * 100) / 100;
      setDraft(String(next));
      onChange(next);
    }
  };

  const isKeyword = keyword != null;

  return (
    <div
      ref={cellRef}
      className="flex flex-1 items-center rounded min-w-0"
      style={{
        height: 28,
        border: `1px solid ${blackAlpha(0.07)}`,
        background: surface.subtle,
        ...flashStyle,
      }}
    >
      {isKeyword ? (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          className="flex-1 text-[11px] font-mono px-1.5 cursor-text outline-none"
          style={{ color: text.label }}
        >
          {keyword}
        </span>
      ) : editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onDoubleClick={selectAllOnDoubleClick}
          autoFocus
          className="flex-1 w-0 bg-transparent border-none text-[11px] font-mono px-1.5 outline-none"
          style={{ color: color.foreground }}
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          className="flex-1 text-[11px] font-mono px-1.5 cursor-text outline-none"
          style={{ color: text.label }}
        >
          {value}
        </span>
      )}
      <div className="shrink-0 pr-[3px]" style={{ borderLeft: `1px solid ${blackAlpha(0.07)}`, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
        {units && onUnitChange ? (
          <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} embedded />
        ) : (
          <span className="text-[9px] uppercase pr-1 shrink-0 font-mono" style={{ color: text.disabled }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
