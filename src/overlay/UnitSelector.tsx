/**
 * UnitSelector.tsx — Small dropdown for CSS unit selection
 *
 * Shows the current unit in a pill; click to open a dropdown.
 * Closes on outside click.
 */

import { useState, useRef, useEffect, useCallback } from "react";

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

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Pill */}
      <button
        onClick={() => setOpen((o) => !o)}
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
            return (
              <div
                key={unit}
                onClick={() => handleSelect(unit)}
                style={{
                  padding: "3px 8px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  background: isActive ? "#6366f1" : "transparent",
                  cursor: "pointer",
                  lineHeight: "16px",
                  transition: "background 60ms",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {unit}
              </div>
            );
          })}
          {specialOptions && specialOptions.length > 0 && (
            <>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "2px 0" }} />
              {specialOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { onSpecialSelect?.(opt.value); setOpen(false); }}
                  style={{
                    padding: "3px 8px",
                    fontSize: "10px",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                    color: "rgba(255,255,255,0.6)",
                    background: "transparent",
                    cursor: "pointer",
                    lineHeight: "16px",
                    transition: "background 60ms",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {opt.label}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
