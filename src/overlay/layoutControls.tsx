/**
 * layoutControls.tsx — Layout-section sub-components extracted from WebflowPanel.tsx
 *
 * MiniDropdown, DirectionRow, GapRow, DisplayTabs.
 * Pure refactor — no logic changes.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Link, Unlink, ArrowRight, ArrowDown, WrapText } from "lucide-react";
import { LabelScrub } from "./LabelScrub";
import { ValueInput } from "./controls";

// ─── Constants ──────────────────────────────────────────────────────

export const DISPLAY_TABS = ["block", "flex", "grid", "none"] as const;
export const DISPLAY_MORE = [
  { value: "inline-flex", label: "Inline Flex" },
  { value: "inline-grid", label: "Inline Grid" },
  { value: "inline-block", label: "Inline Block" },
  { value: "inline", label: "Inline" },
];

// Direction icons reduced to row + column + wrap, with reverse in dropdown
export const DIRECTION_ICONS_SHORT = [
  { value: "row", title: "Row", icon: <ArrowRight size={14} strokeWidth={1.8} /> },
  { value: "column", title: "Column", icon: <ArrowDown size={14} strokeWidth={1.8} /> },
  { value: "__wrap__", title: "Wrap", icon: <WrapText size={14} strokeWidth={1.8} /> },
];

export const DIRECTION_MORE_OPTIONS = [
  { value: "row-reverse", label: "Row Reverse" },
  { value: "column-reverse", label: "Column Reverse" },
];

// X/Y alignment dropdowns for the Align row
export const JUSTIFY_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
  { value: "space-evenly", label: "Evenly" },
];

export const ALIGN_ITEMS_OPTIONS = [
  { value: "flex-start", label: "Top" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "Bottom" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

// ─── MiniDropdown ───────────────────────────────────────────────────

/** Mini dropdown for X/Y alignment values */
export function MiniDropdown({ value, options, onChange }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", height: "22px", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 6px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "3px", color: "rgba(255,255,255,0.8)", fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace", cursor: "pointer", outline: "none",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? value}</span>
        <ChevronDown size={10} strokeWidth={2} style={{ color: "rgba(255,255,255,0.3)", marginLeft: "4px", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, minWidth: "80px",
          background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 200, padding: "2px 0",
        }}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding: "3px 8px", fontSize: "10px", fontFamily: "ui-monospace, 'SF Mono', monospace",
                  color: active ? "#fff" : "rgba(255,255,255,0.6)",
                  background: active ? "#6366f1" : "transparent", cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DirectionRow ───────────────────────────────────────────────────

/** Direction row: row/column/wrap icons + dropdown chevron for reverse options */
export function DirectionRow({ direction, wrap, onDirectionChange, onWrapChange }: {
  direction: string;
  wrap: string;
  onDirectionChange: (v: string) => void;
  onWrapChange: (v: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWrap = wrap === "wrap" || wrap === "wrap-reverse";
  const isSet = direction !== "row" || isWrap;

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [moreOpen]);

  return (
    <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        fontSize: "11px", flexShrink: 0,
        ...(isSet ? {
          background: "rgba(99,102,241,0.25)", color: "rgba(130,140,255,0.9)",
          borderRadius: "3px", padding: "2px 6px",
        } : {
          color: "rgba(255,255,255,0.5)", width: "64px",
        }),
      }}>Direction</span>
      <div ref={containerRef} style={{ display: "flex", position: "relative" }}>
        <div style={{ display: "inline-flex" }}>
          {DIRECTION_ICONS_SHORT.map((opt, i) => {
            const isFirst = i === 0;
            const isLast = i === DIRECTION_ICONS_SHORT.length - 1;
            const isActive = opt.value === "__wrap__" ? isWrap : opt.value === direction.replace("-reverse", "");
            return (
              <button
                key={opt.value}
                title={opt.title}
                onClick={() => {
                  if (opt.value === "__wrap__") {
                    onWrapChange(isWrap ? "nowrap" : "wrap");
                  } else {
                    onDirectionChange(opt.value);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "28px", minWidth: "32px", padding: "0 8px", cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                  fontWeight: isActive ? 500 : 400,
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderLeft: isFirst ? "1px solid rgba(255,255,255,0.15)" : "none",
                  borderRadius: isFirst ? "4px 0 0 4px" : isLast ? "0 4px 4px 0" : "0",
                  outline: "none", transition: "background 80ms, color 80ms",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(255,255,255,0.12)" : "transparent"; }}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          style={{
            width: "20px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
            background: direction.includes("reverse") ? "rgba(99,102,241,0.2)" : "transparent",
            border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)",
            fontSize: "10px", outline: "none", flexShrink: 0, marginLeft: "2px",
          }}
        ><ChevronDown size={10} strokeWidth={2} /></button>
        {moreOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 2px)", right: 0, minWidth: "120px",
            background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 200, padding: "2px 0",
          }}>
            {DIRECTION_MORE_OPTIONS.map((opt) => {
              const active = opt.value === direction;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onDirectionChange(opt.value); setMoreOpen(false); }}
                  style={{
                    padding: "4px 8px", fontSize: "11px", fontFamily: "ui-monospace, 'SF Mono', monospace",
                    color: active ? "#fff" : "rgba(255,255,255,0.6)",
                    background: active ? "#6366f1" : "transparent", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GapRow ─────────────────────────────────────────────────────────

/** Gap row: color swatch + slider + value input + unit + lock icon */
export function GapRow({ value, unit, onChange, onUnitChange }: {
  value: number; unit: string;
  onChange: (v: number) => void; onUnitChange: (u: string) => void;
}) {
  const [gapLinked, setGapLinked] = useState(true);
  const pct = (value / 200) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <LabelScrub value={value} onChange={onChange} step={1} min={0} max={200}>
        <span style={{ width: "48px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, cursor: "ew-resize" }}>Gap</span>
      </LabelScrub>
      {/* Color swatch indicator */}
      <div style={{
        width: "10px", height: "10px", borderRadius: "2px", flexShrink: 0,
        background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
      }} />
      {/* Slider */}
      <input
        type="range" min={0} max={200} step={1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1, height: "3px", appearance: "none", WebkitAppearance: "none",
          background: `linear-gradient(to right, #6366f1 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
          borderRadius: "2px", outline: "none", cursor: "pointer",
        }}
      />
      {/* Value input */}
      <ValueInput value={value} onChange={onChange} />
      {/* Unit label */}
      <span style={{
        fontSize: "9px", color: "rgba(255,255,255,0.4)", width: "16px",
        fontFamily: "ui-monospace, 'SF Mono', monospace", textTransform: "uppercase",
      }}>{unit.toUpperCase()}</span>
      {/* Link/lock icon */}
      <button
        onClick={() => setGapLinked(!gapLinked)}
        title={gapLinked ? "Gap linked (row = column)" : "Gap unlinked"}
        style={{
          width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", cursor: "pointer", padding: 0,
          color: gapLinked ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
          fontSize: "11px", flexShrink: 0,
        }}
      >
        {gapLinked ? <Link size={12} strokeWidth={1.5} /> : <Unlink size={12} strokeWidth={1.5} />}
      </button>
    </div>
  );
}

// ─── DisplayTabs ────────────────────────────────────────────────────

export function DisplayTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [moreOpen]);

  const isTabValue = (DISPLAY_TABS as readonly string[]).includes(value);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span style={{ fontSize: "11px", flexShrink: 0, ...(value !== "block" ? { background: "rgba(99,102,241,0.25)", color: "rgba(130,140,255,0.9)", borderRadius: "3px", padding: "2px 6px" } : { color: "rgba(255,255,255,0.5)", width: "64px" }) }}>Display</span>
      <div ref={containerRef} style={{ display: "flex", flex: 1, position: "relative" }}>
        <div style={{ display: "flex", flex: 1, borderRadius: "3px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
          {DISPLAY_TABS.map((tab) => {
            const active = value === tab;
            return (
              <button
                key={tab}
                onClick={() => onChange(tab)}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)"; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                style={{
                  flex: 1,
                  height: "24px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  cursor: "pointer",
                  border: "none",
                  borderRight: tab !== "none" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                  fontWeight: active ? 500 : 400,
                  outline: "none",
                  transition: "background 80ms, color 80ms",
                  textTransform: "capitalize",
                }}
                onMouseEnter={(e) => { if (value !== tab) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (value !== tab) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {tab === "none" ? "None" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)"; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          style={{
            width: "20px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: !isTabValue ? "rgba(99,102,241,0.2)" : "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.35)",
            fontSize: "10px",
            outline: "none",
            flexShrink: 0,
            marginLeft: "2px",
          }}
        >
          <ChevronDown size={10} strokeWidth={2} />
        </button>
        {moreOpen && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            right: 0,
            minWidth: "120px",
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            zIndex: 200,
            padding: "2px 0",
          }}>
            {DISPLAY_MORE.map((opt) => {
              const active = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setMoreOpen(false); }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                    color: active ? "#fff" : "rgba(255,255,255,0.6)",
                    background: active ? "#6366f1" : "transparent",
                    cursor: "pointer",
                    transition: "background 60ms",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
