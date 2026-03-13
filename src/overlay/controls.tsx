/**
 * controls.tsx — Shared UI components using Tailwind + Shadcn primitives
 *
 * Section, ValueInput, SliderRow, SelectRow, ColorRow, TextRow, EditableValue.
 * Extracted from WebflowPanel.tsx and SpacingBoxModel.tsx.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { getIndicatorColor, getIndicatorTitle } from "./panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { hexToRgba } from "./colorUtils";
import { parseVarRef, resolveVarColor } from "./colorVariables";
import { evaluateMathExpr } from "./inputMath";
import { beginBatch, endBatch } from "./apply";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ms } from "./timing";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";
import { useWheelAdjust } from "./useWheelAdjust";

// ─── Value Flash Hook ────────────────────────────────────────────────

/** Brief background flash when a numeric value changes — confirms the change registered. */
export function useValueFlash(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 200);
    }
    return () => clearTimeout(timer.current);
  }, [value]);

  return flash ? { backgroundColor: primaryAlpha(0.12), transition: "background-color 200ms" } : { transition: "background-color 200ms" };
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
      className={cn("border-b border-[var(--border)]", open && "border-transparent")}
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
            "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            open && "sticky top-0 z-[2] bg-white"
          )}
        >
          <span className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
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

export function ValueInput({ value, onChange, onAltClick, emptyKeyword, onKeywordCommit, embedded }: {
  value: number;
  onChange: (v: number) => void;
  /** Called when alt+click is detected (resets value to default) */
  onAltClick?: () => void;
  /** When draft is empty on commit, apply this keyword instead of ignoring */
  emptyKeyword?: string;
  /** Called when the empty keyword is applied (e.g. "auto", "none") */
  onKeywordCommit?: (keyword: string) => void;
  /** When true, renders without own bg/border (for use inside styled containers) */
  embedded?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashStyle = useValueFlash(value);
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
      style={flashStyle}
      className={cn(
        "h-[26px] w-10 rounded-sm px-1.5 text-[11px] font-mono text-[var(--foreground)] outline-none text-right shrink-0",
        embedded
          ? "bg-transparent border-none"
          : "bg-[var(--input)] border border-[var(--border)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[rgba(59,130,246,0.5)]"
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

  const labelColor = indicator ? getIndicatorColor(indicator) : text.label;
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
  return (
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
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
      <div style={{ display: "flex", alignItems: "center", height: 26, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0, overflow: "hidden" }}>
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} embedded />
        {units && onUnitChange ? (
          <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
            <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} embedded />
          </div>
        ) : unit ? (
          <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: text.label }}>{unit}</span>
          </div>
        ) : null}
      </div>
    </div>
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
  const selectLabelColor = indicator ? getIndicatorColor(indicator) : text.label;
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
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
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
            "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            "hover:bg-[rgba(0,0,0,0.07)]"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg max-h-[180px]"
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

/** Internal: searchable/fontPreview dropdown using shadcn Command (cmdk) */
function SelectRowCustom({
  label,
  value,
  options,
  onChange,
  onReset,
  indicator,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Click-outside to close
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

  const selectLabelColor = indicator ? getIndicatorColor(indicator) : text.label;
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
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
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
            "hover:bg-[rgba(0,0,0,0.07)]",
            "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          )}
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          style={{
            fontFamily: fontPreview && current ? `${current.value}, ui-monospace, 'SF Mono', monospace` : undefined,
            ...(open ? { background: blackAlpha(0.07) } : {}),
          }}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {current?.label ?? value}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="text-[var(--muted-foreground)] shrink-0 ml-1" />
        </button>

        {open && (
          <Command
            className="absolute top-[calc(100%+2px)] left-0 right-0 min-w-full bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg z-[200]"
            filter={(value, search) => {
              const opt = options.find((o) => o.value === value);
              if (!opt) return 0;
              return opt.label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Search..."
              className="h-7 text-[11px] font-sans"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              autoFocus
            />
            <CommandList className="max-h-[180px]">
              <CommandEmpty className="py-1.5 text-center text-[11px] text-[var(--muted-foreground)] italic">
                No matches
              </CommandEmpty>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono cursor-pointer leading-4",
                    opt.value === value && "bg-[var(--primary)] text-white"
                  )}
                  style={{
                    fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : undefined,
                  }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
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

  const colorLabelColor = indicator ? getIndicatorColor(indicator) : text.label;
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
      onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}
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
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          varName ? "border-2" : "border border-[var(--border)]"
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
          ...(varName ? { borderColor: primaryAlpha(0.6) } : {}),
        }}
      />
      <span
        title={varName ? value : undefined}
        className={cn(
          "text-[10px] font-mono overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0",
          !varName && "text-[var(--muted-foreground)]"
        )}
        style={varName ? { color: primaryAlpha(0.8) } : undefined}
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

export function TextRow({ label, value, placeholder, onChange, onReset, onContextMenu, computedProp, computedElement }: {
  label: string; value: string; placeholder?: string; onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5" onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <span
        onClick={(e) => { if (e.altKey && onReset) onReset(); }}
        className="text-[11px] w-[70px] shrink-0 capitalize inline-flex items-center gap-1 cursor-default"
        style={{ color: text.label }}
      >
        {label}
      </span>
      <input
        type="text"
        className={cn(
          "tuner-focusable flex-1 h-6 bg-[var(--input)] border border-[var(--border)] rounded-sm",
          "text-[var(--foreground)] text-[10px] font-mono px-1.5 outline-none",
          "focus:ring-2 focus:ring-[var(--ring)] focus:border-[rgba(59,130,246,0.5)]"
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
          className="w-7 border rounded-sm text-[var(--foreground)] text-[10px] font-mono text-center py-px px-0.5 outline-none"
          style={{ background: blackAlpha(0.07), borderColor: primaryAlpha(0.5) }}
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
          "hover:bg-[rgba(0,0,0,0.05)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          value !== 0 ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
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
