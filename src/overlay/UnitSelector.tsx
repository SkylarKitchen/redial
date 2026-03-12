/**
 * UnitSelector.tsx — Small dropdown for CSS unit selection
 *
 * Shows the current unit in a pill; click to open a dropdown.
 * Closes on outside click. Keyboard navigation via useDropdownKeyboard.
 * Optional conversion tooltip shows "16px -> 1em (base: 16px)" after unit changes.
 *
 * Uses Tailwind classes instead of inline styles. Keeps custom dropdown
 * structure for special options, variable options, and dividers.
 */

import { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { useDropdownKeyboard } from "./useDropdownKeyboard";
import { cn } from "@/lib/utils";

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

  const hasVariables = variableOptions && variableOptions.length > 0;

  // Track the running flat index for highlight across regular + special options
  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Pill trigger */}
      <button
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "h-[20px] px-1.5 text-[10px] font-mono bg-[var(--input)] border border-[var(--border)] rounded cursor-pointer text-[var(--muted-foreground)] hover:border-[rgba(0,0,0,0.15)] transition-colors",
          "flex items-center justify-center max-w-[36px] leading-none",
          open && "bg-[rgba(217,119,87,0.25)] border-[rgba(217,119,87,0.4)] text-[#D97757]"
        )}
      >
        {value}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-50 top-full mt-0.5 left-0 bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg py-1",
            hasVariables ? "min-w-[120px] max-h-[220px] overflow-y-auto" : "min-w-[42px] overflow-hidden"
          )}
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
                className={cn(
                  "px-2 py-1 text-[11px] font-mono cursor-pointer hover:bg-[var(--accent)]",
                  "leading-4 transition-colors",
                  isActive && "bg-[var(--primary)] text-white",
                  !isActive && isHighlighted && "bg-[var(--accent)]",
                  !isActive && "text-[var(--muted-foreground)]"
                )}
              >
                {unit}
              </div>
            );
          })}
          {specialOptions && specialOptions.length > 0 && (
            <>
              <div className="h-px bg-[var(--border)] my-1" />
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
                    className={cn(
                      "px-2 py-1 text-[11px] font-mono text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--accent)]",
                      "leading-4 transition-colors uppercase tracking-wide",
                      isHighlighted && "bg-[var(--accent)]"
                    )}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </>
          )}
          {hasVariables && (
            <>
              <div className="h-px bg-[var(--border)] my-1" />
              <div className="px-2 py-0.5 text-[9px] text-[rgba(0,0,0,0.25)] uppercase tracking-wider">
                Variables
              </div>
              {variableOptions!.map((v) => {
                const idx = flatIndex++;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={v.name}
                    id={`${id}-opt-${idx}`}
                    ref={idx === highlightedIndex ? optionRefCallback : undefined}
                    role="option"
                    aria-selected={false}
                    onClick={() => { onVariableSelect?.(v.name); setOpen(false); }}
                    className={cn(
                      "flex items-center justify-between gap-1.5 px-2 py-1 text-[10px] font-mono cursor-pointer hover:bg-[var(--accent)]",
                      "leading-4 transition-colors text-[var(--muted-foreground)]",
                      isHighlighted && "bg-[var(--accent)]"
                    )}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {v.name.replace(/^--/, "")}
                    </span>
                    <span className="text-[rgba(0,0,0,0.25)] shrink-0 text-[9px]">
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
          className={cn(
            "absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2",
            "bg-[var(--popover)] border border-[var(--border)] rounded",
            "px-2 py-0.5 text-[10px] font-mono text-[rgba(0,0,0,0.75)]",
            "whitespace-nowrap shadow-md z-[200] pointer-events-none",
            "transition-all duration-300",
            tooltipPhase === "in" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
          )}
        >
          {tooltipText}
          {/* Arrow pointing down */}
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rotate-45 w-1.5 h-1.5 bg-[var(--popover)] border-r border-b border-[var(--border)]"
          />
        </div>
      )}
    </div>
  );
}
