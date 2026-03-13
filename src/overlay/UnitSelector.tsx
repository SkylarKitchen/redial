/**
 * UnitSelector.tsx — Small dropdown for CSS unit selection
 *
 * Shows the current unit in a pill; click to open a dropdown.
 * Closes on outside click. Keyboard navigation via useDropdownKeyboard.
 * Optional conversion tooltip shows "16px -> 1em (base: 16px)" after unit changes.
 *
 * All styles use inline React styles referencing theme.ts tokens.
 */

import { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { color, text, border, surface, font, shadow, primaryAlpha, zIndex } from "./theme";
import { ms, timing } from "./timing";

export interface SpecialOption {
  value: string;
  label: string;
}

/** Describes a unit conversion that just occurred, used to show a tooltip. */
export interface ConversionHint {
  oldValue: number;
  oldUnit: string;
  newValue: number;
  newUnit: string;
  /** Human-readable context, e.g. "base: 16px" or "parent: 400px" */
  basis?: string;
}

export interface VariableOption {
  name: string;
  resolvedValue: string;
}

export interface UnitSelectorProps {
  value: string;
  options?: string[];
  onChange: (unit: string) => void;
  /** Keyword items (AUTO, NONE) rendered below a divider at the bottom of the dropdown */
  specialOptions?: SpecialOption[];
  /** Called when a special option is selected */
  onSpecialSelect?: (value: string) => void;
  /** When set, shows a transient tooltip describing the conversion. Auto-dismissed after 2s. */
  conversionHint?: ConversionHint | null;
  /** CSS variable items rendered below special options with a divider */
  variableOptions?: VariableOption[];
  /** Called when a variable is selected */
  onVariableSelect?: (name: string) => void;
  /** When true, renders without own bg/border (for use inside bordered containers like SizeInputCell) */
  embedded?: boolean;
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh"];

/** Format a conversion hint into tooltip text, e.g. "16px -> 1em (base: 16px)" */
function formatHint(h: ConversionHint): string {
  const from = `${h.oldValue}${h.oldUnit}`;
  const to = `${h.newValue}${h.newUnit}`;
  return h.basis ? `${from} \u2192 ${to} (${h.basis})` : `${from} \u2192 ${to}`;
}

export function UnitSelector({ value, options = DEFAULT_UNITS, onChange, specialOptions, onSpecialSelect, conversionHint, variableOptions, onVariableSelect, embedded }: UnitSelectorProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  // ─── Conversion tooltip state ──────────────────────────────────────
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipPhase, setTooltipPhase] = useState<"in" | "out" | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevHintRef = useRef<ConversionHint | null | undefined>(undefined);

  useEffect(() => {
    // Only trigger when conversionHint transitions to a new non-null value
    if (conversionHint && conversionHint !== prevHintRef.current) {
      // Clear any existing timers
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);

      // Compute tooltip position from trigger rect
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTooltipPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
      }
      setTooltipText(formatHint(conversionHint));
      setTooltipPhase("in");

      // Auto-dismiss: start fade-out after dismissal delay, remove after slow fade
      tooltipTimer.current = setTimeout(() => {
        setTooltipPhase("out");
        fadeTimer.current = setTimeout(() => {
          setTooltipText(null);
          setTooltipPhase(null);
        }, timing.slow);
      }, timing.dismissal);
    }
    prevHintRef.current = conversionHint;
  }, [conversionHint]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  // Reset hover when dropdown closes
  useEffect(() => {
    if (!open) setHoveredIdx(null);
  }, [open]);

  // Build a flat list of all items for keyboard navigation
  const allItems = useMemo(() => {
    const items: Array<{ value: string; isSpecial: boolean; isVariable: boolean }> = options.map((u) => ({ value: u, isSpecial: false, isVariable: false }));
    if (specialOptions) {
      for (const opt of specialOptions) {
        items.push({ value: opt.value, isSpecial: true, isVariable: false });
      }
    }
    if (variableOptions) {
      for (const v of variableOptions) {
        items.push({ value: v.name, isSpecial: false, isVariable: true });
      }
    }
    return items;
  }, [options, specialOptions, variableOptions]);

  const labels = useMemo(() => allItems.map(item => item.value), [allItems]);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: allItems.length,
    selectedIndex: allItems.findIndex((item) => item.value === value),
    onSelect: (i) => {
      const item = allItems[i];
      if (item.isVariable) {
        onVariableSelect?.(item.value);
      } else if (item.isSpecial) {
        onSpecialSelect?.(item.value);
      } else {
        onChange(item.value);
      }
      setOpen(false);
    },
    labels,
  });

  // Compute dropdown position from trigger rect
  const DROPDOWN_HEIGHT = 150;
  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < DROPDOWN_HEIGHT ? rect.top - DROPDOWN_HEIGHT - 2 : rect.bottom + 2;
    setDropdownPos({ top, left: rect.left });
    // Tooltip sits above the trigger
    setTooltipPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
  }, []);

  // Close on outside click (works with portal — check both container and portal element)
  useEffect(() => {
    if (!open) return;

    function handleDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const portal = document.querySelector("[data-unit-selector-portal]");
      if (portal?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleDown, true);
    return () => document.removeEventListener("mousedown", handleDown, true);
  }, [open]);

  const handleSelect = useCallback(
    (unit: string) => {
      onChange(unit);
      setOpen(false);
    },
    [onChange]
  );

  const hasVariables = variableOptions && variableOptions.length > 0;

  // Compute trigger styles from theme tokens
  const triggerBg = open ? primaryAlpha(0.25) : embedded ? "transparent" : color.input;
  const triggerColor = open ? color.primary : (embedded && triggerHovered) ? text.primary : text.label;
  const triggerBorder = open
    ? (embedded ? "none" : `1px solid ${primaryAlpha(0.4)}`)
    : embedded
      ? "none"
      : `1px solid ${triggerHovered ? border.hover : border.default}`;

  // Track the running flat index for highlight across regular + special options
  let flatIndex = 0;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Pill trigger */}
      <button
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => { if (!open) updateDropdownPos(); setOpen((o) => !o); }}
        onKeyDown={onTriggerKeyDown}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        style={{
          height: 20,
          padding: "0 6px",
          fontSize: 10,
          fontFamily: font.mono,
          cursor: "pointer",
          transition: `background-color ${ms("expand")}, color ${ms("expand")}, border-color ${ms("expand")}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: 36,
          lineHeight: 1,
          borderRadius: embedded ? 2 : 4,
          background: triggerBg,
          border: triggerBorder,
          color: triggerColor,
        }}
      >
        {value}
      </button>

      {/* Dropdown — portaled to document.body to escape scroll overflow */}
      {open && dropdownPos && createPortal(
        <div
          data-tuner-portal
          data-unit-selector-portal
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
              background: color.popover,
              border: `1px solid ${border.default}`,
              borderRadius: 4,
              boxShadow: shadow.dropdown,
              padding: "4px 0",
              ...(hasVariables
                ? { minWidth: 120, maxHeight: 220, overflowY: "auto" as const }
                : { minWidth: 42, overflow: "hidden" as const }
              ),
            }}
          >
            {options.map((unit) => {
              const isActive = unit === value;
              const idx = flatIndex++;
              const isHl = idx === highlightedIndex || idx === hoveredIdx;
              return (
                <div
                  key={unit}
                  id={`${id}-opt-${idx}`}
                  ref={idx === highlightedIndex ? optionRefCallback : undefined}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(unit)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    fontFamily: font.mono,
                    cursor: "pointer",
                    lineHeight: "16px",
                    transition: `background-color ${ms("expand")}, color ${ms("expand")}`,
                    background: isActive ? color.primary : isHl ? surface.hover : "transparent",
                    color: isActive ? color.primaryForeground : text.label,
                  }}
                >
                  {unit}
                </div>
              );
            })}
            {specialOptions && specialOptions.length > 0 && (
              <>
                <div style={{ height: 1, background: border.default, margin: "4px 0" }} />
                {specialOptions.map((opt) => {
                  const idx = flatIndex++;
                  const isHl = idx === highlightedIndex || idx === hoveredIdx;
                  return (
                    <div
                      key={opt.value}
                      id={`${id}-opt-${idx}`}
                      ref={idx === highlightedIndex ? optionRefCallback : undefined}
                      role="option"
                      aria-selected={false}
                      onClick={() => { onSpecialSelect?.(opt.value); setOpen(false); }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        fontFamily: font.mono,
                        color: text.label,
                        cursor: "pointer",
                        lineHeight: "16px",
                        transition: `background-color ${ms("expand")}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        background: isHl ? surface.hover : "transparent",
                      }}
                    >
                      {opt.label}
                    </div>
                  );
                })}
              </>
            )}
            {hasVariables && (
              <>
                <div style={{ height: 1, background: border.default, margin: "4px 0" }} />
                <div style={{ padding: "2px 8px", fontSize: 9, color: text.hint, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Variables
                </div>
                {variableOptions!.map((v) => {
                  const idx = flatIndex++;
                  const isHl = idx === highlightedIndex || idx === hoveredIdx;
                  return (
                    <div
                      key={v.name}
                      id={`${id}-opt-${idx}`}
                      ref={idx === highlightedIndex ? optionRefCallback : undefined}
                      role="option"
                      aria-selected={false}
                      onClick={() => { onVariableSelect?.(v.name); setOpen(false); }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontFamily: font.mono,
                        cursor: "pointer",
                        lineHeight: "16px",
                        transition: `background-color ${ms("expand")}`,
                        color: text.label,
                        background: isHl ? surface.hover : "transparent",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.name.replace(/^--/, "")}
                      </span>
                      <span style={{ color: text.hint, flexShrink: 0, fontSize: 9 }}>
                        {v.resolvedValue}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Conversion tooltip — portaled to document.body to escape scroll overflow */}
      {tooltipText && tooltipPhase && (() => {
        // Compute tooltip position from trigger rect (or use cached tooltipPos)
        const tp = tooltipPos ?? (() => {
          if (!triggerRef.current) return { top: 0, left: 0 };
          const rect = triggerRef.current.getBoundingClientRect();
          return { top: rect.top - 6, left: rect.left + rect.width / 2 };
        })();
        return createPortal(
          <div
            data-tuner-portal
            style={{
              position: "fixed",
              top: tp.top,
              left: tp.left,
              transform: `translateX(-50%) translateY(-100%) translateY(${tooltipPhase === "in" ? 0 : 4}px)`,
              background: color.popover,
              border: `1px solid ${border.default}`,
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 10,
              fontFamily: font.mono,
              color: text.secondary,
              whiteSpace: "nowrap",
              boxShadow: shadow.dropdown,
              zIndex: zIndex.max,
              pointerEvents: "none",
              transition: `all ${ms("slow")}`,
              opacity: tooltipPhase === "in" ? 1 : 0,
            }}
          >
            {tooltipText}
            {/* Arrow pointing down */}
            <div
              style={{
                position: "absolute",
                bottom: -4,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 6,
                height: 6,
                background: color.popover,
                borderRight: `1px solid ${border.default}`,
                borderBottom: `1px solid ${border.default}`,
              }}
            />
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
