/**
 * UnitSelector.tsx — Small dropdown for CSS unit selection
 *
 * Shows the current unit in a pill; click to open a dropdown.
 * Closes on outside click. Keyboard navigation via useDropdownKeyboard.
 * Optional conversion tooltip shows "16px -> 1em (base: 16px)" after unit changes.
 */

import { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { ms } from "./timing";

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
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh"];

/** Format a conversion hint into tooltip text, e.g. "16px -> 1em (base: 16px)" */
function formatHint(h: ConversionHint): string {
  const from = `${h.oldValue}${h.oldUnit}`;
  const to = `${h.newValue}${h.newUnit}`;
  return h.basis ? `${from} \u2192 ${to} (${h.basis})` : `${from} \u2192 ${to}`;
}

export function UnitSelector({ value, options = DEFAULT_UNITS, onChange, specialOptions, onSpecialSelect, conversionHint, variableOptions, onVariableSelect }: UnitSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

      setTooltipText(formatHint(conversionHint));
      setTooltipPhase("in");

      // Auto-dismiss: start fade-out after 1.7s, remove after 2s
      tooltipTimer.current = setTimeout(() => {
        setTooltipPhase("out");
        fadeTimer.current = setTimeout(() => {
          setTooltipText(null);
          setTooltipPhase(null);
        }, 300);
      }, 1700);
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // Track the running flat index for highlight across regular + special options
  let flatIndex = 0;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Pill */}
      <button
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "36px",
          height: "20px",
          padding: "0 4px",
          background: open ? "rgba(99,102,241,0.25)" : "transparent",
          border: open ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
          borderRadius: "3px",
          color: open ? "#a5b4fc" : "rgba(255,255,255,0.7)",
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          cursor: "pointer",
          lineHeight: 1,
          transition: `background ${ms("fast")}, color ${ms("fast")}, border-color ${ms("fast")}`,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }
        }}
      >
        {value}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            minWidth: variableOptions && variableOptions.length > 0 ? "120px" : "42px",
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            zIndex: 100,
            padding: "2px 0",
            maxHeight: variableOptions && variableOptions.length > 0 ? "220px" : undefined,
            overflowY: variableOptions && variableOptions.length > 0 ? "auto" : "hidden",
          }}
        >
          {options.map((unit) => {
            const isActive = unit === value;
            const idx = flatIndex++;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={unit}
                id={`${id}-opt-${idx}`}
                ref={idx === highlightedIndex ? optionRefCallback : undefined}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(unit)}
                style={{
                  padding: "3px 8px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
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
                {unit}
              </div>
            );
          })}
          {specialOptions && specialOptions.length > 0 && (
            <>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "2px 0" }} />
              {specialOptions.map((opt) => {
                const idx = flatIndex++;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    id={`${id}-opt-${idx}`}
                    ref={idx === highlightedIndex ? optionRefCallback : undefined}
                    role="option"
                    aria-selected={false}
                    onClick={() => { onSpecialSelect?.(opt.value); setOpen(false); }}
                    style={{
                      padding: "3px 8px",
                      fontSize: "10px",
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                      color: "rgba(255,255,255,0.6)",
                      background: isHighlighted ? "rgba(255,255,255,0.08)" : "transparent",
                      cursor: "pointer",
                      lineHeight: "16px",
                      transition: `background ${ms("micro")}`,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isHighlighted ? "rgba(255,255,255,0.08)" : "transparent"; }}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </>
          )}
          {variableOptions && variableOptions.length > 0 && (
            <>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "2px 0" }} />
              <div style={{ padding: "2px 8px 1px", fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Variables
              </div>
              {variableOptions.map((v) => {
                const idx = flatIndex++;
                const isHighlighted = idx === highlightedIndex;
                const isActive = value === "VAR" && false; // Variables are not "selected" like units
                return (
                  <div
                    key={v.name}
                    id={`${id}-opt-${idx}`}
                    ref={idx === highlightedIndex ? optionRefCallback : undefined}
                    role="option"
                    aria-selected={false}
                    onClick={() => { onVariableSelect?.(v.name); setOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      padding: "3px 8px",
                      fontSize: "10px",
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                      color: "rgba(255,255,255,0.7)",
                      background: isHighlighted ? "rgba(255,255,255,0.08)" : "transparent",
                      cursor: "pointer",
                      lineHeight: "16px",
                      transition: `background ${ms("micro")}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isHighlighted ? "rgba(255,255,255,0.08)" : "transparent"; }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.name.replace(/^--/, "")}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, fontSize: "9px" }}>
                      {v.resolvedValue}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Conversion tooltip */}
      {tooltipText && tooltipPhase && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: `translateX(-50%) translateY(${tooltipPhase === "in" ? "0px" : "4px"})`,
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "rgba(255,255,255,0.85)",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            zIndex: 200,
            pointerEvents: "none",
            opacity: tooltipPhase === "in" ? 1 : 0,
            transition: `opacity ${ms("slow")}, transform ${ms("slow")}`,
          }}
        >
          {tooltipText}
          {/* Arrow pointing down */}
          <div
            style={{
              position: "absolute",
              bottom: "-4px",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: "6px",
              height: "6px",
              background: "#2a2a2a",
              borderRight: "1px solid rgba(255,255,255,0.12)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          />
        </div>
      )}
    </div>
  );
}
