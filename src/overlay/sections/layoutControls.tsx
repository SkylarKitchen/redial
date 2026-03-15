/**
 * layoutControls.tsx — Sub-components extracted from WebflowPanel.tsx
 *
 * RowLabel, TextToggle, ReverseButton, DisplayTabs, DirectionRow, GapRow, ChildrenRow,
 * MiniDropdown, TypoValueCell.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { ChevronDown, Link, Unlink, WrapText, Settings } from "lucide-react";
import { GridSettingsPopup } from "../GridSettingsPopup";
import { LabelScrub } from "../controls/LabelScrub";
import { UnitSelector, type ConversionHint } from "../controls/UnitSelector";
import { ValueInput, selectAllOnDoubleClick, useValueFlash } from "../controls";
import { evaluateMathExpr } from "../inputMath";
import { color, text, border, surface, font, blackAlpha, primaryAlpha, bgAlpha, segment, shadow, zIndex, layout, darkToolbar, type IndicatorType, indicatorStyle, altClickReset } from "../theme";
import { useResetPopover } from "../controls";
import { ms } from "../timing";
import { SegmentedControl } from "../controls/SegmentedControl";
import {
  ArrowReverseIcon, UnlockIcon, LockIcon,
  DisplayInlineBlockIcon, DisplayFlexIcon, DisplayGridIcon,
  DisplayInlineIcon, DisplayHideIcon, ChevronSmallDownIcon,
} from "../webflowIcons";

import { useClickOutside } from "../hooks/useClickOutside";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";
import { useWheelAdjust } from "../hooks/useWheelAdjust";
import { LAYOUT_UNITS, DIRECTION_ICONS_SHORT, DIRECTION_MORE_OPTIONS } from "../panelConstants";
import { ROW } from "../panelStyles";

// ─── RowLabel ───────────────────────────────────────────────────────

/**
 * Shared label with blue highlight when modified.
 * Left-click on modified label opens a reset popover; Alt+click resets directly.
 */
export function RowLabel({ label, isSet, indicator, onReset }: {
  label: string;
  /** @deprecated Use `indicator` instead */
  isSet?: boolean;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const effectiveIndicator: IndicatorType = indicator ?? (isSet ? "modified" : "none");
  const resetPopover = useResetPopover(effectiveIndicator, onReset);

  return (
    <>
      <span
        ref={resetPopover.anchorRef}
        style={{
          fontSize: 11,
          flexShrink: 0,
          userSelect: "none" as const,
          lineHeight: "16px",
          width: layout.labelWidth,
          fontFamily: font.sans,
          cursor: onReset ? "default" : undefined,
        }}
        onClick={(e) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); return; } resetPopover.triggerOpen(); }}
      >
        <span style={indicatorStyle(effectiveIndicator)}>
          {label}
        </span>
      </span>
      {resetPopover.node}
    </>
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
    <div style={{ display: "inline-flex", borderRadius: 4, border: `1px solid ${border.input}` }}>
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        const isFirst = i === 0;
        return (
          <TextToggleButton
            key={opt.value}
            opt={opt}
            isActive={isActive}
            isFirst={isFirst}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

function TextToggleButton({ opt, isActive, isFirst, onChange }: {
  opt: { value: string; label: string };
  isActive: boolean;
  isFirst: boolean;
  onChange: (v: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onChange(opt.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 28,
        padding: "0 10px",
        fontSize: 10,
        fontFamily: font.sans,
        cursor: "pointer",
        border: "none",
        outline: "none",
        transition: `color ${ms("fast")} ease, background ${ms("fast")} ease`,
        ...(!isFirst ? { borderLeft: `1px solid ${border.input}` } : {}),
        ...(isActive
          ? { background: surface.active, color: color.foreground, fontWeight: 500 }
          : { background: hovered ? surface.hover : "transparent", color: text.label }),
      }}
    >
      {opt.label}
    </button>
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
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        style={{
          width: "100%",
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 6,
          paddingRight: 6,
          background: color.input,
          border: `1px solid ${border.default}`,
          borderRadius: 3,
          fontSize: 10,
          fontFamily: font.mono,
          cursor: "pointer",
          outline: "none",
          color: text.label,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? value}</span>
        <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: 4, flexShrink: 0, color: text.disabled }} />
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          style={{
            position: "absolute",
            zIndex: zIndex.popover,
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            minWidth: 80,
            background: color.popover,
            border: `1px solid ${border.input}`,
            borderRadius: 4,
            boxShadow: shadow.dropdown,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            const isHighlighted = i === highlightedIndex;
            return (
              <MiniDropdownOption
                key={opt.value}
                opt={opt}
                id={`${id}-opt-${i}`}
                active={active}
                isHighlighted={isHighlighted}
                optionRefCallback={i === highlightedIndex ? optionRefCallback : undefined}
                onChange={onChange}
                setOpen={setOpen}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniDropdownOption({ opt, id, active, isHighlighted, optionRefCallback, onChange, setOpen }: {
  opt: { value: string; label: string };
  id: string;
  active: boolean;
  isHighlighted: boolean;
  optionRefCallback?: (el: HTMLElement | null) => void;
  onChange: (v: string) => void;
  setOpen: (v: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      id={id}
      ref={optionRefCallback}
      role="option"
      aria-selected={active}
      onClick={() => { onChange(opt.value); setOpen(false); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        fontSize: 10,
        fontFamily: font.mono,
        cursor: "pointer",
        ...(active
          ? { background: color.primary, color: color.primaryForeground }
          : {
              color: text.label,
              background: isHighlighted || hovered ? surface.hover : "transparent",
            }),
      }}
    >
      {opt.label}
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
function DarkMenuOption({ label, icon, isActive, onClick }: {
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
    <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
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
    <div style={ROW}>
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
              boxShadow: `0 8px 24px ${blackAlpha(0.35)}, 0 2px 8px ${blackAlpha(0.2)}`,
              padding: "6px 0",
              zIndex: zIndex.popover,
            }}
          >
            {DIRECTION_MORE_OPTIONS.map((opt) => {
              const isActive = opt.value === direction;
              return (
                <DarkMenuOption
                  key={opt.value}
                  label={opt.label}
                  isActive={isActive}
                  onClick={() => { onDirectionChange(opt.value); setMenuOpen(false); }}
                />
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
  const flashStyle = useValueFlash(value);

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
        ...flashStyle,
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
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding, marginTop: 4 }}>
        <span style={{ width: layout.labelWidth, flexShrink: 0 }} />
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
  const flashStyle = useValueFlash(value);

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
      ...flashStyle,
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
            padding: layout.rowPadding,
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

/** Grid track row: dual count inputs for Columns/Rows + link toggle + settings gear (Webflow-style) */
export function GridTrackRow({ columns, rows, onColumnsChange, onRowsChange,
                               linked, onLinkedChange, onReset, indicator,
                               gridCols, gridRows, onGridColsChange, onGridRowsChange }: {
  columns: number;
  rows: number;
  onColumnsChange: (v: number) => void;
  onRowsChange: (v: number) => void;
  linked: boolean;
  onLinkedChange: (v: boolean) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  gridCols?: string;
  gridRows?: string;
  onGridColsChange?: (css: string) => void;
  onGridRowsChange?: (css: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  const handleGearClick = () => {
    if (gearRef.current) {
      setSettingsAnchor(gearRef.current.getBoundingClientRect());
    }
    setSettingsOpen(o => !o);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
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
            borderRadius: 3,
            flexShrink: 0,
            color: text.disabled,
          }}
        >
          {linked ? <Link size={12} strokeWidth={1.5} /> : <Link size={12} strokeWidth={1.5} style={{ opacity: 0.4 }} />}
        </button>
        {/* Grid settings gear icon */}
        {onGridColsChange && onGridRowsChange && (
          <button
            ref={gearRef}
            onClick={handleGearClick}
            title="Grid settings"
            style={{
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: settingsOpen ? primaryAlpha(0.12) : "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: 3,
              flexShrink: 0,
              color: settingsOpen ? color.primary : text.disabled,
              transition: `background ${ms("fast")}, color ${ms("fast")}`,
            }}
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {/* Sub-labels: Columns / Rows */}
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding, marginTop: 2 }}>
        <span style={{ width: layout.labelWidth, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Columns</span>
        </span>
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Rows</span>
        </span>
        <span style={{ width: 44, flexShrink: 0 }} />
      </div>
      {/* Grid settings popup */}
      {settingsOpen && settingsAnchor && gridCols != null && gridRows != null && onGridColsChange && onGridRowsChange && (
        <GridSettingsPopup
          gridCols={gridCols}
          gridRows={gridRows}
          onGridColsChange={onGridColsChange}
          onGridRowsChange={onGridRowsChange}
          anchorRect={settingsAnchor}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
    <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: "0 12px" }}>
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
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        borderRadius: 4,
        minWidth: 0,
        height: 28,
        border: `1px solid ${border.default}`,
        background: surface.subtle,
        ...flashStyle,
      }}
    >
      {isKeyword ? (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            cursor: "text",
            outline: "none",
            color: text.label,
          }}
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
          style={{
            flex: 1,
            width: 0,
            background: "transparent",
            border: "none",
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            outline: "none",
            color: color.foreground,
          }}
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            cursor: "text",
            outline: "none",
            color: text.label,
          }}
        >
          {value}
        </span>
      )}
      <div style={{
        flexShrink: 0,
        paddingRight: 3,
        borderLeft: `1px solid ${blackAlpha(0.07)}`,
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
      }}>
        {units && onUnitChange ? (
          <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} embedded />
        ) : (
          <span style={{
            fontSize: 9,
            textTransform: "uppercase",
            paddingRight: 4,
            flexShrink: 0,
            fontFamily: font.mono,
            color: text.disabled,
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
