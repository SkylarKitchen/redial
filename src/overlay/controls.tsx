/**
 * controls.tsx — Shared UI components using Tailwind + Shadcn primitives
 *
 * Section, ValueInput, SliderRow, SelectRow, ColorRow, TextRow, EditableValue.
 * Extracted from WebflowPanel.tsx and SpacingBoxModel.tsx.
 */

import React, { useState, useCallback, useRef, useEffect, useId, memo } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { getIndicatorColor, getIndicatorTitle } from "./panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { hexToRgba } from "./colorUtils";
import { parseVarRef, resolveVarColor } from "./colorVariables";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { evaluateMathExpr } from "./inputMath";
import { beginBatch, endBatch } from "./apply";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ms } from "./timing";
import { useWheelAdjust } from "./useWheelAdjust";

// ─── Value Presets ───────────────────────────────────────────────────

export const VALUE_PRESETS: Record<string, string[]> = {
  "width": ["auto", "100%", "fit-content"],
  "height": ["auto", "100%", "fit-content"],
  "max-width": ["none", "100%"],
  "max-height": ["none", "100%"],
  "min-width": ["0", "auto"],
  "min-height": ["0", "auto"],
  "border-radius": ["0", "4", "8", "9999"],
  "gap": ["0", "4", "8", "12", "16"],
  "font-weight": ["400", "500", "600", "700"],
  "opacity": ["0", "0.5", "1"],
};

export function PresetChips({ property, onSelect }: { property: string; onSelect: (v: string) => void }) {
  const presets = VALUE_PRESETS[property];
  if (!presets) return null;
  return (
    <div className="flex gap-0.5 mt-0.5 flex-wrap px-3">
      {presets.map(v => (
        <span
          key={v}
          onClick={() => onSelect(v)}
          className="text-[9px] font-mono text-[var(--muted-foreground)] bg-[var(--input)] px-1.5 py-px rounded cursor-pointer select-none hover:bg-[rgba(255,255,255,0.12)]"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export type SpacingSide = 'top' | 'right' | 'bottom' | 'left';
export type SpacingProperty = `margin-${SpacingSide}` | `padding-${SpacingSide}`;
export type SpacingUnit = 'px' | '%' | 'em' | 'rem' | 'vw' | 'vh';

export interface EditableValueProps {
  value: number;
  onChange: (value: number) => void;
  onAltClick?: () => void;
  'data-spacing-index'?: number;
}

/** Double-click on a value input selects all text for quick replacement. */
export const selectAllOnDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
  e.currentTarget.select();
};

// ─── Section ────────────────────────────────────────────────────────

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
}: {
  title: string;
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
}) {
  const [ownOpen, setOwnOpen] = useState(!collapsed);
  const open = forceOpen || (focusOpen !== undefined ? focusOpen : ownOpen);

  if (hidden) return null;
  return (
    <Collapsible
      open={open}
      onOpenChange={(isOpen) => {
        if (onToggle) onToggle(title);
        else setOwnOpen(isOpen);
      }}
      className="border-b border-[var(--border)]"
    >
      <CollapsibleTrigger asChild>
        <div
          tabIndex={0}
          role="button"
          aria-expanded={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (onToggle) onToggle(title);
              else setOwnOpen(!open);
            }
          }}
          className={cn(
            "flex justify-between items-center cursor-pointer rounded-sm outline-none px-3 pt-2.5 pb-1.5",
            "focus:ring-2 focus:ring-[var(--ring)]",
            open && "sticky top-0 z-[2] bg-[var(--background)]"
          )}
        >
          <span className="text-[13px] font-medium text-[var(--foreground)]/85 flex items-center gap-1.5">
            {title}
            {indicator && indicator !== "none" && <StyleIndicator type={indicator} />}
          </span>
          <div className="flex items-center gap-1.5">
            {headerAction && (
              <span onClick={(e) => e.stopPropagation()}>
                {headerAction}
              </span>
            )}
            <span
              className="text-[var(--muted-foreground)] flex items-center"
              style={{
                transition: `transform ${ms("expand")} ease`,
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              <ChevronRight size={12} strokeWidth={2} />
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── ValueInput ─────────────────────────────────────────────────────

export function ValueInput({ value, onChange, onAltClick, emptyKeyword, onKeywordCommit }: {
  value: number;
  onChange: (v: number) => void;
  /** Called when alt+click is detected (resets value to default) */
  onAltClick?: () => void;
  /** When draft is empty on commit, apply this keyword instead of ignoring */
  emptyKeyword?: string;
  /** Called when the empty keyword is applied (e.g. "auto", "none") */
  onKeywordCommit?: (keyword: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, value, onChange);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    if (draft.trim() === '' && emptyKeyword && onKeywordCommit) {
      onKeywordCommit(emptyKeyword);
      return;
    }
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onChange(mathResult); return; }
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
  }, [draft, value, onChange, emptyKeyword, onKeywordCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setDraft(String(value));
        setFocused(false);
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        onChange(Math.round((value + step) * 10) / 10);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        onChange(Math.round((value - step) * 10) / 10);
      }
    },
    [commit, value, onChange]
  );

  return (
    <input
      ref={inputRef}
      aria-label="Value"
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => { if (e.altKey && onAltClick) { e.preventDefault(); onAltClick(); } }}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onDoubleClick={selectAllOnDoubleClick}
      className={cn(
        "h-[26px] w-10 bg-[var(--input)] border border-[var(--border)] rounded-sm px-1.5 text-[11px] font-mono text-[var(--foreground)] outline-none text-right shrink-0",
        "focus:ring-2 focus:ring-[var(--ring)] focus:border-[rgba(99,102,241,0.5)]"
      )}
    />
  );
}

// ─── SliderRow ──────────────────────────────────────────────────────

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  units,
  onUnitChange,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
  conversionHint,
  snapPoints,
  snapThreshold,
  property,
  onPreset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** If provided, shows a UnitSelector dropdown instead of a static unit label */
  units?: string[];
  onUnitChange?: (unit: string) => void;
  onChange: (value: number) => void;
  /** Called when the label is clicked (not dragged) to reset the property */
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "font-size") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
  /** Conversion tooltip hint shown after unit change */
  conversionHint?: ConversionHint | null;
  /** Magnetic snap values (e.g. [0, 8, 16, 24, 32, 50, 100]) */
  snapPoints?: number[];
  /** Pixel distance for snap activation (default 3) */
  snapThreshold?: number;
  /** CSS property name — enables preset chips when VALUE_PRESETS has entries */
  property?: string;
  /** Called when a preset chip is clicked (for string values like "auto"/"none") */
  onPreset?: (value: string) => void;
}) {
  const snapValue = useCallback((raw: number): number => {
    if (!snapPoints || snapPoints.length === 0) return raw;
    const threshold = snapThreshold ?? 3;
    const range = max - min;
    const valueThreshold = (threshold / 100) * range;

    for (const snap of snapPoints) {
      if (snap >= min && snap <= max && Math.abs(raw - snap) <= valueThreshold) {
        return snap;
      }
    }
    return raw;
  }, [snapPoints, snapThreshold, min, max]);

  const labelColor = indicator ? getIndicatorColor(indicator) : "rgba(255,255,255,0.5)";
  const labelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      title={labelTitle}
      className="text-[11px] w-[70px] shrink-0 capitalize inline-flex items-center gap-1"
      style={{ color: labelColor }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );
  const handlePresetSelect = useCallback((v: string) => {
    if (onPreset) {
      onPreset(v);
    } else {
      const parsed = parseFloat(v);
      if (!isNaN(parsed)) onChange(parsed);
    }
  }, [onPreset, onChange]);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu}>
        <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onAltClick={onReset}>
          {computedProp && computedElement ? (
            <ComputedTooltip property={computedProp} element={computedElement}>
              {labelContent}
            </ComputedTooltip>
          ) : labelContent}
        </LabelScrub>
        <Slider
          className="tuner-focusable flex-1"
          aria-label={`${label}: ${value}${unit}`}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onChange(snapValue(v))}
          onPointerDown={() => beginBatch()}
          onPointerUp={() => endBatch()}
        />
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} />
        {units && onUnitChange ? (
          <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} />
        ) : unit ? (
          <span className="text-[9px] text-[var(--muted-foreground)] w-4">{unit}</span>
        ) : null}
      </div>
      {property && <PresetChips property={property} onSelect={handlePresetSelect} />}
    </>
  );
}

// ─── SelectRow ──────────────────────────────────────────────────────

export function SelectRow({
  label,
  value,
  options,
  onChange,
  onReset,
  indicator,
  searchable,
  fontPreview,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  indicator?: IndicatorType;
  /** Show a search/filter input at the top of the dropdown */
  searchable?: boolean;
  /** Render each option label in its own font-face (for font-family dropdowns) */
  fontPreview?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "font-weight") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
}) {
  const selectLabelColor = indicator ? getIndicatorColor(indicator) : "rgba(255,255,255,0.5)";
  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      onClick={(e) => { if (e.altKey && onReset) onReset(); }}
      title={selectLabelTitle}
      className="text-[11px] w-[70px] shrink-0 capitalize inline-flex items-center gap-1 cursor-default"
      style={{ color: selectLabelColor }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );

  // Use the searchable custom dropdown for searchable/fontPreview cases
  if (searchable || fontPreview) {
    return (
      <SelectRowCustom
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        onReset={onReset}
        indicator={indicator}
        searchable={searchable}
        fontPreview={fontPreview}
        onContextMenu={onContextMenu}
        computedProp={computedProp}
        computedElement={computedElement}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "tuner-focusable flex-1 h-6 bg-[var(--input)] border border-[var(--border)] rounded-sm",
            "text-[11px] font-mono text-[var(--foreground)] px-1.5",
            "focus:ring-2 focus:ring-[var(--ring)]",
            "hover:bg-[rgba(255,255,255,0.1)]"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg z-[200] max-h-[180px]"
        >
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className={cn(
                "text-[11px] font-mono cursor-pointer",
                "focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)]"
              )}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Internal: custom searchable/fontPreview dropdown variant with Tailwind classes */
function SelectRowCustom({
  label,
  value,
  options,
  onChange,
  onReset,
  indicator,
  searchable,
  fontPreview,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  searchable?: boolean;
  fontPreview?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.value === value);
  const id = useId();

  // Filter options when searchable
  const filtered = searchable && searchQuery
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const optionLabels = filtered.map(o => o.label);
  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: filtered.length,
    selectedIndex: filtered.findIndex((o) => o.value === value),
    onSelect: (i) => { onChange(filtered[i].value); setOpen(false); setSearchQuery(""); },
    labels: optionLabels,
  });

  // Clear search when dropdown closes
  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const selectLabelColor = indicator ? getIndicatorColor(indicator) : "rgba(255,255,255,0.5)";
  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      onClick={(e) => { if (e.altKey && onReset) onReset(); }}
      title={selectLabelTitle}
      className="text-[11px] w-[70px] shrink-0 capitalize inline-flex items-center gap-1 cursor-default"
      style={{ color: selectLabelColor }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );

  return (
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div ref={containerRef} className="relative flex-1">
        <button
          className={cn(
            "tuner-focusable w-full h-6 flex items-center justify-between",
            "bg-[var(--input)] border border-[var(--border)] rounded-sm",
            "text-[11px] font-mono text-[var(--foreground)] px-1.5 cursor-pointer outline-none",
            "hover:bg-[rgba(255,255,255,0.1)]",
            "focus:ring-2 focus:ring-[var(--ring)]",
            open && "bg-[rgba(255,255,255,0.1)]"
          )}
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
          style={{
            fontFamily: fontPreview && current ? `${current.value}, ui-monospace, 'SF Mono', monospace` : undefined,
          }}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {current?.label ?? value}
          </span>
          <ChevronDown size={10} strokeWidth={2} className="text-[var(--muted-foreground)] shrink-0 ml-1" />
        </button>

        {open && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            onKeyDown={onListKeyDown}
            className={cn(
              "absolute top-[calc(100%+2px)] left-0 right-0 min-w-full",
              "bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg z-[200] py-0.5",
              searchable ? "max-h-60" : "max-h-[180px]",
              "overflow-y-auto"
            )}
          >
            {/* Search input (when searchable) */}
            {searchable && (
              <div className="px-1.5 pt-1 pb-1 sticky top-0 bg-[var(--popover)] z-[1]">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  placeholder="Search..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setOpen(false);
                    } else if (e.key === "Enter" && filtered.length > 0) {
                      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
                      onChange(filtered[idx].value);
                      setOpen(false);
                      setSearchQuery("");
                    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      onListKeyDown(e as unknown as React.KeyboardEvent);
                    }
                  }}
                  className={cn(
                    "w-full h-[22px] bg-[var(--background)] border border-[var(--border)] rounded-sm",
                    "px-1.5 text-[11px] font-sans text-[var(--foreground)] outline-none box-border",
                    "focus:border-[rgba(99,102,241,0.5)]"
                  )}
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-[var(--muted-foreground)] italic">
                No matches
              </div>
            ) : (
              filtered.map((opt, i) => {
                const isActive = opt.value === value;
                const isHighlighted = i === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    id={`${id}-opt-${i}`}
                    ref={i === highlightedIndex ? optionRefCallback : undefined}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "px-2 py-1 text-[11px] font-mono cursor-pointer leading-4",
                      isActive
                        ? "bg-[var(--primary)] text-white"
                        : isHighlighted
                          ? "bg-[var(--accent)] text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    )}
                    style={{
                      fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : undefined,
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ColorRow ───────────────────────────────────────────────────────

export function ColorRow({
  label,
  value,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "color") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const swatchRef = useRef<HTMLDivElement>(null);

  // Resolve var() references for display
  const varName = parseVarRef(value);
  const resolvedColor = varName ? resolveVarColor(value) : null;
  const displayColor = resolvedColor ?? value;
  const displayLabel = varName ? varName.replace(/^--/, "") : value;
  const pickerColor = resolvedColor ?? (value === "transparent" ? "#000000" : value);

  const colorLabelColor = indicator ? getIndicatorColor(indicator) : "rgba(255,255,255,0.5)";
  const colorLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      onClick={(e) => { if (e.altKey && onReset) onReset(); }}
      title={colorLabelTitle}
      className="text-[11px] w-[70px] shrink-0 capitalize inline-flex items-center gap-1 cursor-default"
      style={{ color: colorLabelColor }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );

  return (
    <div
      onContextMenu={onContextMenu}
      className="flex items-center gap-2 px-3 py-0.5 relative"
    >
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div
        ref={swatchRef}
        className={cn(
          "tuner-focusable w-5 h-5 rounded-sm cursor-pointer shrink-0",
          "focus:ring-2 focus:ring-[var(--ring)]",
          varName ? "border-2 border-[rgba(99,102,241,0.6)]" : "border border-[var(--border)]"
        )}
        tabIndex={0}
        role="button"
        onClick={() => setPickerOpen(!pickerOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPickerOpen(!pickerOpen);
          }
        }}
        style={{
          background:
            displayColor === "transparent"
              ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px"
              : displayColor,
        }}
      />
      <span
        title={varName ? value : undefined}
        className={cn(
          "text-[10px] font-mono overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0",
          varName ? "text-[rgba(99,102,241,0.8)]" : "text-[var(--muted-foreground)]"
        )}
      >
        {displayLabel}
      </span>
      {pickerOpen && swatchRef.current && (
        <div className="absolute top-full left-3 z-[99999] mt-1">
          <ColorPickerEnhanced
            color={pickerColor}
            onChange={(hex, opacity) => {
              onChange(opacity < 1 ? hexToRgba(hex, opacity) : hex);
            }}
            onClose={() => setPickerOpen(false)}
            onSelectVariable={(varExpr) => {
              onChange(varExpr);
            }}
            activeVariable={varName}
          />
        </div>
      )}
    </div>
  );
}

// ─── TextRow ────────────────────────────────────────────────────────

export function TextRow({ label, value, placeholder, onChange, onReset, onContextMenu }: {
  label: string; value: string; placeholder?: string; onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu}>
      <span
        onClick={(e) => { if (e.altKey && onReset) onReset(); }}
        className="text-[11px] text-[var(--muted-foreground)] w-[70px] shrink-0 capitalize cursor-default"
      >{label}</span>
      <input
        type="text"
        className={cn(
          "tuner-focusable flex-1 h-6 bg-[var(--input)] border border-[var(--border)] rounded-sm",
          "text-[var(--foreground)] text-[10px] font-mono px-1.5 outline-none",
          "focus:ring-2 focus:ring-[var(--ring)] focus:border-[rgba(99,102,241,0.5)]"
        )}
        tabIndex={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onDoubleClick={selectAllOnDoubleClick}
      />
    </div>
  );
}

// ─── EditableValue (from SpacingBoxModel) ───────────────────────────

export const EditableValue = memo(
  function EditableValue(props: EditableValueProps) {
    const { value, onChange, onAltClick } = props;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync draft when external value changes
    useEffect(() => {
      if (!editing) setDraft(String(value));
    }, [value, editing]);

    const commit = useCallback(() => {
      setEditing(false);
      const mathResult = evaluateMathExpr(draft, value);
      if (mathResult !== null) { onChange(mathResult); return; }
      const parsed = parseFloat(draft);
      if (!isNaN(parsed) && parsed !== value) {
        onChange(parsed);
      }
    }, [draft, value, onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          commit();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(String(value));
          setEditing(false);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
          const next = Math.round((value + step) * 10) / 10;
          setDraft(String(next));
          onChange(next);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
          const next = Math.round((value - step) * 10) / 10;
          setDraft(String(next));
          onChange(next);
        }
      },
      [commit, value, onChange]
    );

    if (editing) {
      return (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onDoubleClick={selectAllOnDoubleClick}
          autoFocus
          className="w-7 bg-[rgba(255,255,255,0.1)] border border-[rgba(99,102,241,0.5)] rounded-sm text-[var(--foreground)]/90 text-[10px] font-mono text-center py-px px-0.5 outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span
        tabIndex={0}
        data-spacing-index={props['data-spacing-index']}
        onClick={(e) => {
          e.stopPropagation();
          if (e.altKey && onAltClick) {
            onAltClick();
            return;
          }
          setEditing(true);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
        className={cn(
          "text-[10px] font-mono cursor-text py-px px-[3px] rounded-sm min-w-4 text-center outline-none",
          "hover:bg-[rgba(255,255,255,0.08)]",
          "focus:ring-2 focus:ring-[var(--ring)]",
          value !== 0 ? "text-[var(--foreground)]/70" : "text-[var(--foreground)]/30"
        )}
        style={{
          transition: `background ${ms("normal")}, box-shadow ${ms("fast")}`,
        }}
      >
        {value}
      </span>
    );
  },
);
