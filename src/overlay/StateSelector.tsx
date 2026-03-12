/**
 * StateSelector.tsx — Dropdown for selecting CSS pseudo-class states
 *
 * Compact trigger shows current state + chevron. Green text when
 * a non-base state is active, matching Webflow's state indicator.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { ms } from "./timing";

export interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
}

interface StateOption {
  value: string;
  label: string;
}

const STATES: StateOption[] = [
  { value: "none", label: "None \u2014 base styles" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Focus" },
  { value: "active", label: "Active" },
  { value: "visited", label: "Visited" },
  { value: "focus-within", label: "Focus Within" },
  { value: "focus-visible", label: "Focus Visible" },
  { value: "first-child", label: "First Child" },
  { value: "last-child", label: "Last Child" },
];

export function StateSelector({ value, onChange }: StateSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = STATES.find((s) => s.value === value) ?? STATES[0];
  const isBase = value === "none";

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
    (state: string) => {
      onChange(state);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          height: "28px",
          padding: "0 8px",
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          cursor: "pointer",
          transition: `background ${ms("fast")}`,
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontFamily: "system-ui, sans-serif",
            color: isBase ? "rgba(255,255,255,0.4)" : "#22c55e",
            lineHeight: 1,
          }}
        >
          {isBase ? "State" : current.label}
        </span>
        <ChevronDown size={10} strokeWidth={2} style={{ color: "rgba(255,255,255,0.35)" }} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            minWidth: "180px",
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            zIndex: 100,
            padding: "2px 0",
            overflow: "hidden",
          }}
        >
          {STATES.map((state) => {
            const isActive = state.value === value;
            return (
              <div
                key={state.value}
                onClick={() => handleSelect(state.value)}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontFamily: "system-ui, sans-serif",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  background: isActive ? "#6366f1" : "transparent",
                  cursor: "pointer",
                  lineHeight: "16px",
                  transition: `background ${ms("micro")}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {state.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
