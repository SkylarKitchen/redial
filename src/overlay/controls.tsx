/**
 * controls.tsx — Shared UI components using inline styles + theme tokens
 *
 * Section, ValueInput, SliderRow, SelectRow, ColorRow, TextRow, EditableValue.
 * Extracted from WebflowPanel.tsx and SpacingBoxModel.tsx.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { type IndicatorType, indicatorStyle, altClickReset } from "./theme";
import { ResetPopover } from "./ResetPopover";
import { getIndicatorTitle, convertPresets } from "./panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { hexToRgba } from "./colorUtils";
import { parseVarRef, resolveVarColor } from "./colorVariables";
import { evaluateMathExpr } from "./inputMath";
import { beginBatch, endBatch } from "./apply";
import { ChevronDown, ChevronRight, Link2, Unlink } from "lucide-react";
import { VariablePicker } from "./VariablePicker";
import { ms } from "./timing";
import { color, text, border, surface, font, shadow, layout, blackAlpha, primaryAlpha, presets, presetBaseUnit, checkerboard, labelIndicator, labelHighlight } from "./theme";
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

  return flash ? { backgroundColor: primaryAlpha(0.12), transition: `background-color ${ms("layout")}` } : { transition: `background-color ${ms("layout")}` };
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

// ─── Shared styles ──────────────────────────────────────────────────

const labelStyle = (indicator?: IndicatorType): React.CSSProperties => {
  const isModified = indicator === "modified";
  const li = isModified ? labelIndicator.modified : labelIndicator.none;
  return {
    fontSize: 11,
    width: layout.labelWidth,
    flexShrink: 0,
    textTransform: "capitalize",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    cursor: "default",
    color: li.text,
    ...(isModified ? {
      background: li.bg,
      ...labelHighlight,
    } : {}),
  };
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  padding: "2px 12px",
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
  onReset,
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
  /** Alt+click on title resets the section */
  onReset?: () => void;
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
      style={{ borderBottom: open ? "1px solid transparent" : `1px solid ${color.border}` }}
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            borderRadius: 2,
            outline: "none",
            padding: "10px 12px 6px",
            ...(open ? { position: "sticky" as const, top: 0, zIndex: 2, background: color.background } : {}),
          }}
        >
          <span
            style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, color: color.foreground }}
            onClick={altClickReset(onReset)}
          >
            <span style={indicatorStyle(indicator)}>
              {title}
            </span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {headerAction && (
              <span onClick={(e) => e.stopPropagation()}>
                {headerAction}
              </span>
            )}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                color: color.mutedForeground,
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
        <div style={{ paddingBottom: 8 }}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── ValueInput ─────────────────────────────────────────────────────

export function ValueInput({ value, onChange, onAltClick, emptyKeyword, onKeywordCommit, embedded, step: stepProp }: {
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
  /** Base step for arrow key increments (default 1). Shift multiplies ×10, Alt ×0.1 */
  step?: number;
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
        const base = stepProp ?? 1;
        const inc = e.altKey ? base * 0.1 : e.shiftKey ? base * 10 : base;
        onChange(Math.round((value + inc) * 10) / 10);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const base = stepProp ?? 1;
        const inc = e.altKey ? base * 0.1 : e.shiftKey ? base * 10 : base;
        onChange(Math.round((value - inc) * 10) / 10);
      }
    },
    [commit, value, onChange, stepProp]
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
      className="tuner-focusable"
      style={{
        ...flashStyle,
        width: 0,
        minWidth: 40,
        flex: 1,
        height: 28,
        borderRadius: 2,
        padding: "0 6px",
        fontSize: 11,
        fontFamily: font.mono,
        outline: "none",
        textAlign: "right" as const,
        color: color.foreground,
        ...(embedded ? { backgroundColor: "transparent", border: "none" } : {
          backgroundColor: color.input,
          border: `1px solid ${color.border}`,
        }),
      }}
    />
  );
}

// ─── PresetChips ─────────────────────────────────────────────────────

function PresetChips({ property, onSelect, unit }: {
  property: string;
  onSelect: (value: string | number) => void;
  unit?: string;
}) {
  const raw = presets[property];
  if (!raw || raw.length === 0) return null;
  const base = presetBaseUnit[property];
  const values = (raw && base && unit && unit !== base)
    ? convertPresets(raw, base, unit)
    : raw;

  return (
    <div style={{ display: "flex", gap: 4, padding: "1px 12px 2px 82px" }}>
      {values.map((v) => (
        <button
          key={String(v)}
          onClick={() => onSelect(v)}
          style={{
            fontFamily: font.mono,
            fontSize: 10,
            color: text.label,
            background: "transparent",
            border: `1px solid ${border.default}`,
            borderRadius: 3,
            padding: "1px 6px",
            cursor: "pointer",
            lineHeight: "16px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Reset Popover Hook ─────────────────────────────────────────────

/** Shared hook for the click-on-modified-label reset popover. */
export function useResetPopover(indicator?: IndicatorType, onReset?: () => void) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerOpen = useCallback(() => {
    if (indicator === "modified" && onReset) setOpen(true);
  }, [indicator, onReset]);
  const node = open && anchorRef.current && onReset ? (
    <ResetPopover anchor={anchorRef.current} onReset={onReset} onClose={() => setOpen(false)} />
  ) : null;
  return { anchorRef, triggerOpen, node };
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
  annotation,
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
  /** Key into theme presets (e.g. "opacity", "gap") */
  property?: string;
  /** Called when a string preset is selected (numeric presets use onChange) */
  onPreset?: (value: string | number) => void;
  /** Small hint label shown next to the value input (e.g. Tailwind class name) */
  annotation?: string;
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

  const resetPopover = useResetPopover(indicator, onReset);
  const labelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      title={labelTitle}
      style={labelStyle(indicator)}
    >
      {label}
    </span>
  );
  const handlePresetSelect = useCallback((v: string | number) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!isNaN(n)) onChange(n);
    else if (onPreset) onPreset(v);
  }, [onChange, onPreset]);

  return (
    <>
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
        {computedProp && computedElement ? (
          <ComputedTooltip property={computedProp} element={computedElement}>
            {labelContent}
          </ComputedTooltip>
        ) : labelContent}
      </LabelScrub>
      <Slider
        className="tuner-focusable"
        style={{ flex: 1 }}
        aria-label={`${label}: ${value}${unit}`}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(snapValue(v))}
        onPointerDown={() => beginBatch()}
        onPointerUp={() => endBatch()}
      />
      {annotation && (
        <span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint, flexShrink: 0, whiteSpace: "nowrap" }}>{annotation}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0 }}>
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} embedded step={step} />
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
    {property && <PresetChips property={property} onSelect={handlePresetSelect} unit={unit} />}
    {resetPopover.node}
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
  const resetPopover = useResetPopover(indicator, onReset);
  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={selectLabelTitle}
      style={labelStyle(indicator)}
    >
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
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="tuner-focusable flex-1"
          style={{
            fontFamily: font.mono,
            backgroundColor: color.input,
            border: `1px solid ${color.border}`,
            color: color.foreground,
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="max-h-[180px] rounded"
          style={{
            boxShadow: shadow.dropdown,
            backgroundColor: color.popover,
            border: `1px solid ${color.border}`,
          }}
        >
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {resetPopover.node}
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
  const [btnHovered, setBtnHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const resetPopover = useResetPopover(indicator, onReset);

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

  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={selectLabelTitle}
      style={labelStyle(indicator)}
    >
      {label}
    </span>
  );

  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          className="tuner-focusable"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          style={{
            width: "100%",
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 2,
            fontSize: 11,
            fontFamily: fontPreview && current ? `${current.value}, ui-monospace, 'SF Mono', monospace` : font.mono,
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            backgroundColor: open ? blackAlpha(0.07) : btnHovered ? surface.hover : color.input,
            border: `1px solid ${color.border}`,
            color: color.foreground,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {current?.label ?? value}
          </span>
          <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, marginLeft: 4, color: color.mutedForeground }} />
        </button>

        {open && (
          <Command
            style={{
              position: "absolute" as const,
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              minWidth: "100%",
              borderRadius: 4,
              boxShadow: shadow.dropdown,
              zIndex: 200,
              backgroundColor: color.popover,
              border: `1px solid ${color.border}`,
            }}
            filter={(value, search) => {
              const opt = options.find((o) => o.value === value);
              if (!opt) return 0;
              return opt.label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Search..."
              className="h-7 text-[11px]"
              style={{ fontFamily: font.sans }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              autoFocus
            />
            <CommandList className="max-h-[180px]">
              <CommandEmpty style={{ padding: "6px 0", textAlign: "center" as const, fontSize: 11, fontStyle: "italic", color: color.mutedForeground }}>
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
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : font.mono,
                    cursor: "pointer",
                    lineHeight: "16px",
                    ...(opt.value === value ? { backgroundColor: color.primary, color: "#fff" } : {}),
                  }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </div>
      {resetPopover.node}
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
  compact,
  labelWidth,
  actions,
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
  /** Compact mode: no horizontal padding, narrower label — for sub-layouts */
  compact?: boolean;
  /** Override default label width (e.g. for wider variable names) */
  labelWidth?: number;
  /** Optional action buttons rendered between label and swatch */
  actions?: React.ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const swatchRef = useRef<HTMLDivElement>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const resetPopover = useResetPopover(indicator, onReset);

  // Resolve var() references for display
  const varName = parseVarRef(value);
  const resolvedColor = varName ? resolveVarColor(value) : null;
  const displayColor = resolvedColor ?? value;
  const displayLabel = varName ? varName.replace(/^--/, "") : value;
  const pickerColor = resolvedColor ?? (value === "transparent" ? "#000000" : value);

  const colorLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const compactLabelOverrides: React.CSSProperties = compact ? { width: 44, padding: 0, paddingLeft: 1 } : {};
  const widthOverrides: React.CSSProperties = labelWidth != null
    ? { width: labelWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    : {};
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={colorLabelTitle ?? label}
      style={{ ...labelStyle(indicator), ...compactLabelOverrides, ...widthOverrides }}
    >
      {label}
    </span>
  );

  const compactRowOverrides: React.CSSProperties = compact ? { padding: "2px 0", gap: 4 } : {};
  return (
    <div
      onContextMenu={onContextMenu}
      onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}
      style={{ ...rowStyle, position: "relative", ...compactRowOverrides }}
    >
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      {actions}
      <div
        ref={swatchRef}
        className="tuner-focusable"
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
          width: 20,
          height: 20,
          borderRadius: 2,
          cursor: "pointer",
          flexShrink: 0,
          background:
            displayColor === "transparent"
              ? checkerboard
              : displayColor,
          border: varName ? `2px solid ${primaryAlpha(0.6)}` : `1px solid ${color.border}`,
        }}
      />
      <span
        title={varName ? value : undefined}
        style={{
          fontSize: 10,
          fontFamily: font.mono,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
          flex: 1,
          minWidth: 0,
          color: varName ? primaryAlpha(0.8) : color.mutedForeground,
        }}
      >
        {displayLabel}
      </span>
      {/* Link/Unlink variable button */}
      {varName ? (
        <button
          type="button"
          title="Unlink variable"
          onClick={(e) => {
            e.stopPropagation();
            if (resolvedColor) onChange(resolvedColor);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: primaryAlpha(0.6),
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Unlink size={11} strokeWidth={2} />
        </button>
      ) : (
        <button
          ref={linkBtnRef}
          type="button"
          title="Link to variable"
          onClick={(e) => {
            e.stopPropagation();
            setVarPickerOpen(!varPickerOpen);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: text.hint,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.6,
            transition: `opacity ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
        >
          <Link2 size={11} strokeWidth={2} />
        </button>
      )}
      {varPickerOpen && linkBtnRef.current && (
        <VariablePicker
          anchor={linkBtnRef.current}
          type="color"
          onSelect={(varExpr) => onChange(varExpr)}
          onClose={() => setVarPickerOpen(false)}
          activeVariable={varName}
        />
      )}
      {pickerOpen && swatchRef.current && (() => {
        const pickerWidth = 240 + 24; // width + padding
        const pickerHeight = 300;
        const gap = 4;
        const rect = swatchRef.current!.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeAbove = spaceBelow < pickerHeight + gap;
        const top = placeAbove
          ? rect.top - pickerHeight - gap
          : rect.bottom + gap;
        const left = Math.min(rect.left, window.innerWidth - pickerWidth - gap);
        return createPortal(
          <div style={{ position: "fixed", top, left, zIndex: 2147483647 }}>
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
          </div>,
          document.body
        );
      })()}
      {resetPopover.node}
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
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <span
        onClick={(e) => { if (e.altKey && onReset) onReset(); }}
        style={labelStyle()}
      >
        {label}
      </span>
      <input
        type="text"
        className="tuner-focusable"
        style={{
          flex: 1,
          height: 24,
          borderRadius: 2,
          fontSize: 10,
          fontFamily: font.mono,
          padding: "0 6px",
          outline: "none",
          backgroundColor: color.input,
          border: `1px solid ${color.border}`,
          color: color.foreground,
        }}
        tabIndex={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onDoubleClick={selectAllOnDoubleClick}
      />
    </div>
  );
}

// ─── NumberRow ───────────────────────────────────────────────────────

/** A label + full-width number input + unit suffix. Same width as SelectRow (no slider). */
export function NumberRow({
  label,
  value,
  unit,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
}) {
  const resetPopover = useResetPopover(indicator, onReset);
  const labelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const labelContent = (
    <span ref={resetPopover.anchorRef} title={labelTitle} style={labelStyle(indicator)}>
      {label}
    </span>
  );

  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <LabelScrub value={value} onChange={onChange} step={10} min={0} max={2000} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
        {computedProp && computedElement ? (
          <ComputedTooltip property={computedProp} element={computedElement}>
            {labelContent}
          </ComputedTooltip>
        ) : labelContent}
      </LabelScrub>
      <div style={{ display: "flex", alignItems: "center", flex: 1, height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle }}>
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} embedded />
        <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: text.label }}>{unit}</span>
        </div>
      </div>
      {resetPopover.node}
    </div>
  );
}

// ─── EditableValue (from SpacingBoxModel) ───────────────────────────

export const EditableValue = memo(
  function EditableValue(props: EditableValueProps) {
    const { value, onChange, onAltClick } = props;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const [hovered, setHovered] = useState(false);
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
          style={{
            width: 28,
            borderRadius: 2,
            fontSize: 10,
            fontFamily: font.mono,
            textAlign: "center" as const,
            padding: "1px 2px",
            outline: "none",
            background: blackAlpha(0.07),
            border: `1px solid ${primaryAlpha(0.5)}`,
            color: color.foreground,
          }}
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: 10,
          fontFamily: font.mono,
          cursor: "text",
          padding: "1px 3px",
          borderRadius: 2,
          minWidth: 16,
          textAlign: "center" as const,
          outline: "none",
          background: hovered ? surface.hover : "transparent",
          color: value !== 0 ? color.foreground : color.mutedForeground,
          transition: `background ${ms("normal")}, box-shadow ${ms("fast")}`,
        }}
      >
        {value}
      </span>
    );
  },
);
