/**
 * UnitSelector.tsx — Small dropdown for CSS unit selection
 *
 * Shows the current unit in a pill; click to open a dropdown.
 * Closes on outside click.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDropdownKeyboard } from "./useDropdownKeyboard";

export interface SpecialOption {
  value: string;
  label: string;
}

export interface UnitSelectorProps {
  value: string;
  options?: string[];
  onChange: (unit: string) => void;
  /** Keyword items (AUTO, NONE) rendered below a divider at the bottom of the dropdown */
  specialOptions?: SpecialOption[];
  /** Called when a special option is selected */
  onSpecialSelect?: (value: string) => void;
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh"];

export function UnitSelector({ value, options = DEFAULT_UNITS, onChange, specialOptions, onSpecialSelect }: UnitSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a flat list of all items for keyboard navigation
  const allItems = useMemo(() => {
    const items: Array<{ value: string; isSpecial: boolean }> = options.map((u) => ({ value: u, isSpecial: false }));
    if (specialOptions) {
      for (const opt of specialOptions) {
        items.push({ value: opt.value, isSpecial: true });
      }
    }
    return items;
  }, [options, specialOptions]);

  const { highlightedIndex, onTriggerKeyDown, onListKeyDown } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: allItems.length,
    selectedIndex: allItems.findIndex((item) => item.value === value),
    onSelect: (i) => {
      const item = allItems[i];
      if (item.isSpecial) {
        onSpecialSelect?.(item.value);
      } else {
        onChange(item.value);
      }
      setOpen(false);
    },
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
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "28px",
          height: "20px",
          padding: "0 4px",
          background: open ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "3px",
          color: open ? "#a5b4fc" : "rgba(255,255,255,0.5)",
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          cursor: "pointer",
          lineHeight: 1,
          transition: "background 80ms, color 80ms",
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
      >
        {value}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          onKeyDown={onListKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            minWidth: "42px",
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            zIndex: 100,
            padding: "2px 0",
            overflow: "hidden",
          }}
        >
          {options.map((unit) => {
            const isActive = unit === value;
            const idx = flatIndex++;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={unit}
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
                  transition: "background 60ms",
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
                      transition: "background 60ms",
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
        </div>
      )}
    </div>
  );
}
