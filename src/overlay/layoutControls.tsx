/**
 * layoutControls.tsx — Sub-components extracted from WebflowPanel.tsx
 *
 * MiniDropdown, DirectionRow, GapRow, DisplayTabs, TypoValueCell.
 */

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { ChevronDown, Link, Unlink } from "lucide-react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { ValueInput, selectAllOnDoubleClick } from "./controls";
import { evaluateMathExpr } from "./inputMath";

import { useClickOutside } from "./useClickOutside";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { useWheelAdjust } from "./useWheelAdjust";
import { cn } from "@/lib/utils";
import {
  DISPLAY_TABS, DISPLAY_MORE,
  DIRECTION_ICONS_SHORT, DIRECTION_MORE_OPTIONS,
} from "./panelConstants";

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
        className="w-full h-[22px] flex items-center justify-between px-1.5 bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[10px] font-mono text-[rgba(0,0,0,0.7)] cursor-pointer outline-none"
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{current?.label ?? value}</span>
        <ChevronDown size={10} strokeWidth={2} className="text-[rgba(0,0,0,0.35)] ml-1 shrink-0" />
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          className="absolute z-[200] top-[calc(100%+2px)] left-0 right-0 min-w-[80px] bg-[#eae5df] border border-[rgba(0,0,0,0.12)] rounded shadow-[0_4px_12px_rgba(0,0,0,0.12)] py-0.5"
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
                    : isHighlighted
                      ? "bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.6)]"
                      : "text-[rgba(0,0,0,0.6)] hover:bg-[rgba(0,0,0,0.05)]",
                )}
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

// ─── DirectionRow ───────────────────────────────────────────────────

/** Direction row: row/column/wrap icons + dropdown chevron for reverse options */
export function DirectionRow({ direction, wrap, onDirectionChange, onWrapChange }: {
  direction: string;
  wrap: string;
  onDirectionChange: (v: string) => void;
  onWrapChange: (v: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWrap = wrap === "wrap" || wrap === "wrap-reverse";
  const isSet = direction !== "row" || isWrap;
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useClickOutside(containerRef, moreOpen, closeMore);

  return (
    <div className="flex items-center gap-1.5 py-1 px-3">
      <span className={cn(
        "text-[11px] shrink-0",
        isSet
          ? "bg-[rgba(193,122,80,0.15)] text-[rgba(193,122,80,0.9)] rounded-[3px] px-1.5 py-0.5"
          : "text-[var(--muted-foreground)] w-16",
      )}>Direction</span>
      <div ref={containerRef} className="flex relative">
        <div className="inline-flex">
          {DIRECTION_ICONS_SHORT.map((opt, i) => {
            const isFirst = i === 0;
            const isLast = i === DIRECTION_ICONS_SHORT.length - 1;
            const isActive = opt.value === "__wrap__" ? isWrap : opt.value === direction.replace("-reverse", "");
            return (
              <button
                key={opt.value}
                title={opt.title}
                onClick={() => {
                  if (opt.value === "__wrap__") {
                    onWrapChange(isWrap ? "nowrap" : "wrap");
                  } else {
                    onDirectionChange(opt.value);
                  }
                }}
                className={cn(
                  "flex items-center justify-center h-7 min-w-[32px] px-2 cursor-pointer outline-none transition-colors",
                  "border border-[rgba(0,0,0,0.12)]",
                  !isFirst && "border-l-0",
                  isFirst && "rounded-l",
                  isLast && "rounded-r",
                  !isFirst && !isLast && "rounded-none",
                  isActive
                    ? "bg-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.87)] font-medium"
                    : "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "w-5 h-7 flex items-center justify-center border-none cursor-pointer text-[rgba(0,0,0,0.35)] text-[10px] outline-none shrink-0 ml-0.5",
            direction.includes("reverse") ? "bg-[rgba(193,122,80,0.15)]" : "bg-transparent",
          )}
        ><ChevronDown size={10} strokeWidth={2} /></button>
        {moreOpen && (
          <div className="absolute z-[200] top-[calc(100%+2px)] right-0 min-w-[120px] bg-[#eae5df] border border-[rgba(0,0,0,0.12)] rounded shadow-[0_4px_12px_rgba(0,0,0,0.12)] py-0.5">
            {DIRECTION_MORE_OPTIONS.map((opt) => {
              const active = opt.value === direction;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onDirectionChange(opt.value); setMoreOpen(false); }}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono cursor-pointer",
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "text-[rgba(0,0,0,0.6)] hover:bg-[rgba(0,0,0,0.05)]",
                  )}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GapRow ─────────────────────────────────────────────────────────

/** Gap row: color swatch + slider + value input + unit + lock icon */
export function GapRow({ value, unit, onChange, onUnitChange, linked, onLinkedChange }: {
  value: number; unit: string;
  onChange: (v: number) => void; onUnitChange: (u: string) => void;
  linked: boolean; onLinkedChange: (v: boolean) => void;
}) {
  const gapLinked = linked;
  const pct = (value / 200) * 100;
  return (
    <div className="flex items-center gap-1.5 py-0.5 px-3">
      <LabelScrub value={value} onChange={onChange} step={1} min={0} max={200}>
        <span className="w-12 text-[11px] text-[var(--muted-foreground)] shrink-0 cursor-ew-resize">Gap</span>
      </LabelScrub>
      {/* Color swatch indicator */}
      <div className="w-2.5 h-2.5 rounded-sm shrink-0 bg-[rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.12)]" />
      {/* Slider */}
      <input
        type="range" min={0} max={200} step={1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-[3px] outline-none cursor-pointer"
        style={{
          appearance: "none", WebkitAppearance: "none",
          background: `linear-gradient(to right, #c17a50 ${pct}%, rgba(0,0,0,0.08) ${pct}%)`,
          borderRadius: "2px",
        }}
      />
      {/* Value input */}
      <ValueInput value={value} onChange={onChange} />
      {/* Unit label */}
      <span className="text-[9px] text-[rgba(0,0,0,0.4)] w-4 font-mono uppercase">{unit.toUpperCase()}</span>
      {/* Link/lock icon */}
      <button
        onClick={() => onLinkedChange(!gapLinked)}
        title={gapLinked ? "Gap linked (row = column)" : "Gap unlinked"}
        className={cn(
          "w-[18px] h-[18px] flex items-center justify-center bg-transparent border-none cursor-pointer p-0 text-[11px] shrink-0",
          gapLinked ? "text-[rgba(0,0,0,0.4)]" : "text-[rgba(0,0,0,0.2)]",
        )}
      >
        {gapLinked ? <Link size={12} strokeWidth={1.5} /> : <Unlink size={12} strokeWidth={1.5} />}
      </button>
    </div>
  );
}

// ─── DisplayTabs ────────────────────────────────────────────────────

export function DisplayTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useClickOutside(containerRef, moreOpen, closeMore);

  const isTabValue = (DISPLAY_TABS as readonly string[]).includes(value);

  return (
    <div className="flex items-center gap-1.5 py-0.5 px-3">
      <span className={cn(
        "text-[11px] shrink-0",
        value !== "block"
          ? "bg-[rgba(193,122,80,0.15)] text-[rgba(193,122,80,0.9)] rounded-[3px] px-1.5 py-0.5"
          : "text-[var(--muted-foreground)] w-16",
      )}>Display</span>
      <div ref={containerRef} className="flex flex-1 relative">
        <div role="radiogroup" aria-label="Display mode" className="flex flex-1 rounded-[3px] overflow-hidden border border-[var(--border)]">
          {DISPLAY_TABS.map((tab) => {
            const active = value === tab;
            return (
              <button
                key={tab}
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(tab)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const siblings = Array.from(e.currentTarget.parentElement?.children ?? []) as HTMLElement[];
                    const idx = siblings.indexOf(e.currentTarget as HTMLElement);
                    const next = e.key === "ArrowRight"
                      ? siblings[(idx + 1) % siblings.length]
                      : siblings[(idx - 1 + siblings.length) % siblings.length];
                    next.focus();
                    const nextTab = DISPLAY_TABS[siblings.indexOf(next)];
                    if (nextTab != null) onChange(nextTab);
                  }
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(193,122,80,0.3)"; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                className={cn(
                  "flex-1 h-6 text-[10px] font-mono cursor-pointer border-none outline-none transition-colors capitalize",
                  tab !== "none" && "border-r border-r-[rgba(0,0,0,0.06)]",
                  active
                    ? "bg-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.87)] font-medium"
                    : "bg-transparent text-[rgba(0,0,0,0.45)] font-normal hover:bg-[var(--accent)]",
                )}
              >
                {tab === "none" ? "None" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(193,122,80,0.3)"; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          className={cn(
            "w-5 h-6 flex items-center justify-center border-none cursor-pointer text-[rgba(0,0,0,0.35)] text-[10px] outline-none shrink-0 ml-0.5",
            !isTabValue ? "bg-[rgba(193,122,80,0.15)]" : "bg-transparent",
          )}
        >
          <ChevronDown size={10} strokeWidth={2} />
        </button>
        {moreOpen && (
          <div className="absolute z-[200] top-[calc(100%+2px)] right-0 min-w-[120px] bg-[#eae5df] border border-[rgba(0,0,0,0.12)] rounded shadow-[0_4px_12px_rgba(0,0,0,0.12)] py-0.5">
            {DISPLAY_MORE.map((opt) => {
              const active = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setMoreOpen(false); }}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors",
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "text-[rgba(0,0,0,0.6)] hover:bg-[rgba(0,0,0,0.05)]",
                  )}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      className="flex-1 flex items-center h-7 bg-[var(--input)] border border-[var(--border)] rounded overflow-hidden min-w-0"
    >
      {isKeyword ? (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          className="flex-1 text-[11px] font-mono text-[rgba(0,0,0,0.45)] px-1.5 cursor-text outline-none"
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
          className="flex-1 w-0 bg-transparent border-none text-[rgba(0,0,0,0.87)] text-[11px] font-mono px-1.5 outline-none"
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          className="flex-1 text-[11px] font-mono text-[rgba(0,0,0,0.7)] px-1.5 cursor-text outline-none"
        >
          {value}
        </span>
      )}
      {units && onUnitChange ? (
        <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} />
      ) : (
        <span className="text-[9px] text-[rgba(0,0,0,0.4)] uppercase pr-1.5 shrink-0 font-mono">
          {unit}
        </span>
      )}
    </div>
  );
}
