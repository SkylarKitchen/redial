/**
 * controls.tsx — Shared inline-styled UI components
 *
 * Section, ValueInput, SliderRow, SelectRow, ColorRow, TextRow, EditableValue.
 * Extracted from WebflowPanel.tsx and SpacingBoxModel.tsx.
 */

import React, { useState, useCallback, useRef, useEffect, useId, memo } from "react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { ComputedTooltip } from "./ComputedTooltip";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { hexToRgba } from "./colorUtils";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
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
    <div style={{ display: "flex", gap: 3, marginTop: 2, flexWrap: "wrap", padding: "0 12px" }}>
      {presets.map(v => (
        <span
          key={v}
          onClick={() => onSelect(v)}
          style={{
            fontSize: "9px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.06)",
            padding: "1px 5px",
            borderRadius: "3px",
            cursor: "pointer",
            userSelect: "none" as const,
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
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

const FOCUS_RING = "0 0 0 2px rgba(99,102,241,0.3)";
const onFocusRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = FOCUS_RING; };
const onBlurRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; };

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
}: {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
  indicator?: IndicatorType;
  forceOpen?: boolean;
  /** When true, hide the section entirely (used by search filter) */
  hidden?: boolean;
  headerAction?: React.ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(!collapsed);
  const open = forceOpen || ownOpen;

  if (hidden) return null;
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div
        tabIndex={0}
        role="button"
        aria-expanded={open}
        onClick={() => setOwnOpen(!ownOpen)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOwnOpen(!ownOpen); } }}
        onFocus={onFocusRing}
        onBlur={onBlurRing}
        style={{
          padding: "10px 12px 6px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          borderRadius: "2px",
          outline: "none",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "6px" }}>
          {title}
          {indicator && indicator !== "none" && <StyleIndicator type={indicator} />}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {headerAction && (
            <span onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </span>
          )}
          <span style={{
            color: "rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            transition: `transform ${ms("expand")} ease`,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            <ChevronRight size={12} strokeWidth={2} />
          </span>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: `grid-template-rows ${ms("expand")} ease`,
      }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingBottom: "8px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── ValueInput ─────────────────────────────────────────────────────

export function ValueInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, value, onChange);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
  }, [draft, onChange]);

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
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onDoubleClick={selectAllOnDoubleClick}
      style={{
        width: "40px",
        background: "rgba(255,255,255,0.06)",
        border: focused ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "2px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        textAlign: "center",
        padding: "2px",
        outline: "none",
        flexShrink: 0,
        boxShadow: focused ? FOCUS_RING : "none",
      }}
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

  const pct = ((value - min) / (max - min)) * 100;
  const labelContent = (
    <span
      style={{
        width: "64px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
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
      <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }} onContextMenu={onContextMenu}>
        <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onClick={onReset}>
          {computedProp && computedElement ? (
            <ComputedTooltip property={computedProp} element={computedElement}>
              {labelContent}
            </ComputedTooltip>
          ) : labelContent}
        </LabelScrub>
        <input
          type="range"
          className="tuner-focusable"
          tabIndex={0}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(snapValue(parseFloat(e.target.value)))}
          onFocus={onFocusRing}
          onBlur={onBlurRing}
          style={{
            flex: 1,
            height: "3px",
            appearance: "none",
            WebkitAppearance: "none",
            background: `linear-gradient(to right, #6366f1 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
            borderRadius: "2px",
            outline: "none",
            cursor: "pointer",
          }}
        />
        <ValueInput value={value} onChange={onChange} />
        {units && onUnitChange ? (
          <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} />
        ) : unit ? (
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", width: "16px" }}>{unit}</span>
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

  const labelContent = (
    <span
      style={{
        width: "64px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }} onContextMenu={onContextMenu}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          className="tuner-focusable"
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
          onFocus={onFocusRing}
          onBlur={onBlurRing}
          style={{
            width: "100%",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "3px",
            color: "rgba(255,255,255,0.8)",
            fontSize: "11px",
            fontFamily: fontPreview && current ? `${current.value}, ui-monospace, 'SF Mono', monospace` : "ui-monospace, 'SF Mono', monospace",
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            transition: `background ${ms("fast")}, box-shadow ${ms("fast")}`,
          }}
          onMouseEnter={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current?.label ?? value}
          </span>
          <ChevronDown size={10} strokeWidth={2} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0, marginLeft: "4px" }} />
        </button>

        {open && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            onKeyDown={onListKeyDown}
            style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              minWidth: "100%",
              maxHeight: searchable ? "240px" : "180px",
              overflowY: "auto",
              background: "#2a2a2a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              zIndex: 200,
              padding: "2px 0",
            }}
          >
            {/* Search input (when searchable) */}
            {searchable && (
              <div style={{ padding: "4px 6px 4px", position: "sticky", top: 0, background: "#2a2a2a", zIndex: 1 }}>
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
                      // Delegate to list keyboard handler
                      onListKeyDown(e as unknown as React.KeyboardEvent);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "22px",
                    background: "#1e1e1e",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "3px",
                    padding: "0 6px",
                    fontSize: "11px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    color: "rgba(255,255,255,0.85)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.5)"; }}
                  onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ padding: "6px 8px", fontSize: "11px", color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
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
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : "ui-monospace, 'SF Mono', monospace",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                      background: isActive ? "#6366f1" : isHighlighted ? "rgba(255,255,255,0.08)" : "transparent",
                      cursor: "pointer",
                      lineHeight: "16px",
                      transition: `background ${ms("micro")}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = isHighlighted && !isActive ? "rgba(255,255,255,0.08)" : isActive ? "#6366f1" : "transparent";
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
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "color") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const swatchRef = useRef<HTMLDivElement>(null);

  const labelContent = (
    <span
      style={{
        width: "64px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {indicator && <StyleIndicator type={indicator} />}
      {label}
    </span>
  );

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 12px",
        position: "relative",
      }}
    >
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
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
          width: "24px",
          height: "24px",
          borderRadius: "4px",
          background:
            value === "transparent"
              ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px"
              : value,
          border: "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {value}
      </span>
      {pickerOpen && swatchRef.current && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "12px",
            zIndex: 99999,
            marginTop: "4px",
          }}
        >
          <ColorPickerEnhanced
            color={value === "transparent" ? "#000000" : value}
            onChange={(hex, opacity) => {
              onChange(opacity < 1 ? hexToRgba(hex, opacity) : hex);
            }}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── TextRow ────────────────────────────────────────────────────────

export function TextRow({ label, value, placeholder, onChange, onContextMenu }: {
  label: string; value: string; placeholder?: string; onChange: (value: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }} onContextMenu={onContextMenu}>
      <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{label}</span>
      <input
        type="text" className="tuner-focusable" tabIndex={0} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onDoubleClick={selectAllOnDoubleClick}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: "24px", background: "rgba(255,255,255,0.06)",
          border: focused ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "3px", color: "rgba(255,255,255,0.8)", fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace", padding: "0 6px", outline: "none",
          boxShadow: focused ? FOCUS_RING : "none",
        }}
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
            width: "28px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(99, 102, 241, 0.5)",
            borderRadius: "2px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            textAlign: "center",
            padding: "1px 2px",
            outline: "none",
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
        onFocus={onFocusRing}
        onBlur={onBlurRing}
        style={{
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: value !== 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
          cursor: "text",
          padding: "1px 3px",
          borderRadius: "2px",
          minWidth: "16px",
          textAlign: "center",
          outline: "none",
          transition: `background ${ms("normal")}, box-shadow ${ms("fast")}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        {value}
      </span>
    );
  },
);
