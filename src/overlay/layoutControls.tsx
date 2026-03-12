/**
 * layoutControls.tsx — Sub-components extracted from WebflowPanel.tsx
 *
 * RowLabel, TextToggle, ReverseButton, DisplayTabs, DirectionRow, GapRow, ChildrenRow,
 * MiniDropdown, TypoValueCell.
 */

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { ChevronDown, Link, Unlink, ArrowLeftRight } from "lucide-react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { ValueInput, selectAllOnDoubleClick, useValueFlash } from "./controls";
import { evaluateMathExpr } from "./inputMath";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";

import { useClickOutside } from "./useClickOutside";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { useWheelAdjust } from "./useWheelAdjust";
import { cn } from "@/lib/utils";
import { LAYOUT_UNITS } from "./panelConstants";

// ─── RowLabel ───────────────────────────────────────────────────────

/** Shared label pattern: highlighted when modified, alt+click to reset */
export function RowLabel({ label, isSet, onReset }: {
  label: string;
  isSet?: boolean;
  onReset?: () => void;
}) {
  return (
    <span
      className={cn(
        "text-[11px] shrink-0 select-none",
        isSet
          ? "rounded-[3px] px-1.5 py-0.5"
          : "text-[var(--muted-foreground)] w-16",
      )}
      style={isSet ? { background: primaryAlpha(0.25), color: primaryAlpha(0.9) } : undefined}
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

/** Small icon toggle for flex-direction reverse / wrap-reverse */
function ReverseButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      title={active ? "Reverse (active)" : "Reverse"}
      onClick={onClick}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded cursor-pointer outline-none transition-colors border-none shrink-0",
        active
          ? "font-medium"
          : "bg-transparent hover:bg-[var(--accent)]",
      )}
      style={active
        ? { background: primaryAlpha(0.2), color: primaryAlpha(0.9) }
        : { color: text.disabled }
      }
    >
      <ArrowLeftRight size={13} strokeWidth={1.5} />
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
          className="absolute z-[200] top-[calc(100%+2px)] left-0 right-0 min-w-[80px] bg-[#F5F4ED] border rounded shadow-[0_4px_12px_rgba(0,0,0,0.1)] py-0.5"
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

// ─── DisplayTabs (Text-based) ───────────────────────────────────────

const DISPLAY_OPTIONS = [
  { value: "block", label: "block" },
  { value: "flex", label: "flex" },
  { value: "grid", label: "grid" },
  { value: "none", label: "none" },
];

/** Display row: 4 text tabs for display modes */
export function DisplayTabs({ value, onChange, onReset }: {
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 px-3">
      <RowLabel label="Display" isSet={value !== "block"} onReset={onReset} />
      <TextToggle options={DISPLAY_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}

// ─── DirectionRow ───────────────────────────────────────────────────

/** Direction row: Horizontal/Vertical text toggle + reverse button */
export function DirectionRow({ direction, onDirectionChange, onReset }: {
  direction: string;
  onDirectionChange: (v: string) => void;
  onReset?: () => void;
}) {
  const isHorizontal = !direction.startsWith("column");
  const isReverse = direction.includes("reverse");
  const isSet = direction !== "row";

  return (
    <div className="flex items-center gap-1.5 py-0.5 px-3">
      <RowLabel label="Direction" isSet={isSet} onReset={onReset} />
      <TextToggle
        options={[
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ]}
        value={isHorizontal ? "horizontal" : "vertical"}
        onChange={(v) => {
          const base = v === "horizontal" ? "row" : "column";
          onDirectionChange(isReverse ? `${base}-reverse` : base);
        }}
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

// ─── GapRow (Dual Inputs) ───────────────────────────────────────────

/** Gap row: dual number inputs (column + row) with link toggle */
export function GapRow({ columnGap, rowGap, columnUnit, rowUnit, onColumnChange, onRowChange,
                          onColumnUnitChange, onRowUnitChange, linked, onLinkedChange, onReset }: {
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
}) {
  const isSet = columnGap !== 0 || rowGap !== 0;
  return (
    <div>
      <div className="flex items-center gap-1 py-0.5 px-3">
        <RowLabel label="Gap" isSet={isSet} onReset={onReset} />
        {/* Column gap input */}
        <ValueInput value={columnGap} onChange={(v) => {
          onColumnChange(v);
          if (linked) onRowChange(v);
        }} />
        <UnitSelector value={columnUnit} options={LAYOUT_UNITS} onChange={onColumnUnitChange} />
        {/* Link toggle */}
        <button
          onClick={() => onLinkedChange(!linked)}
          title={linked ? "Gap linked (column = row)" : "Gap unlinked"}
          className="w-6 h-6 flex items-center justify-center bg-transparent border-none cursor-pointer p-0 shrink-0 rounded transition-colors"
          style={{ color: linked ? color.primary : text.hint }}
        >
          {linked ? <Link size={13} strokeWidth={1.5} /> : <Unlink size={13} strokeWidth={1.5} />}
        </button>
        {/* Row gap input */}
        <ValueInput value={rowGap} onChange={(v) => {
          onRowChange(v);
          if (linked) onColumnChange(v);
        }} />
        <UnitSelector value={rowUnit} options={LAYOUT_UNITS} onChange={onRowUnitChange} />
      </div>
      {/* Sub-labels */}
      <div className="flex px-3 mt-0.5" style={{ paddingLeft: "calc(64px + 6px)" }}>
        <span className="text-[9px] flex-1 text-center" style={{ color: text.hint }}>Column</span>
        <span className="w-6 shrink-0" /> {/* Spacer for link button */}
        <span className="text-[9px] flex-1 text-center" style={{ color: text.hint }}>Row</span>
      </div>
    </div>
  );
}

// ─── ChildrenRow ────────────────────────────────────────────────────

/** Children row: Don't wrap / Wrap text toggle + reverse button */
export function ChildrenRow({ wrap, onWrapChange }: {
  wrap: string;
  onWrapChange: (v: string) => void;
}) {
  const isWrap = wrap === "wrap" || wrap === "wrap-reverse";
  const isReverse = wrap === "wrap-reverse";

  return (
    <div className="flex items-center gap-1.5 py-0.5 px-3">
      <RowLabel label="Children" isSet={isWrap} />
      <TextToggle
        options={[
          { value: "nowrap", label: "Don't wrap" },
          { value: "wrap", label: "Wrap" },
        ]}
        value={isWrap ? "wrap" : "nowrap"}
        onChange={(v) => onWrapChange(v === "wrap" ? "wrap" : "nowrap")}
      />
      {isWrap && (
        <ReverseButton
          active={isReverse}
          onClick={() => onWrapChange(isReverse ? "wrap" : "wrap-reverse")}
        />
      )}
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
      className="flex-1 flex items-center h-7 bg-[var(--input)] border border-[var(--border)] rounded min-w-0"
      style={flashStyle}
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
      {units && onUnitChange ? (
        <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} />
      ) : (
        <span className="text-[9px] uppercase pr-1.5 shrink-0 font-mono" style={{ color: text.disabled }}>
          {unit}
        </span>
      )}
    </div>
  );
}
