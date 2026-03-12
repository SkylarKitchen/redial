/**
 * ViewportBar.tsx — Responsive viewport width presets
 *
 * Constrains page content to a fixed width to preview
 * how styles behave at different breakpoints.
 */

import { ms } from "./timing";

const PRESETS: Array<{ label: string; width: number | null }> = [
  { label: "375", width: 375 },
  { label: "768", width: 768 },
  { label: "1024", width: 1024 },
  { label: "Full", width: null },
];

interface ViewportBarProps {
  active: number | null;
  onChange: (width: number | null) => void;
}

export function ViewportBar({ active, onChange }: ViewportBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 12px",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "rgba(0,0,0,0.35)",
          fontFamily: "system-ui, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginRight: "4px",
        }}
      >
        Width
      </span>
      {PRESETS.map((preset) => {
        const isActive = active === preset.width;
        return (
          <button
            key={preset.label}
            onClick={() => onChange(preset.width)}
            style={{
              padding: "2px 8px",
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              background: isActive ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)",
              color: isActive ? "rgba(0,0,0,0.87)" : "rgba(0,0,0,0.5)",
              transition: `background ${ms("normal")}, color ${ms("normal")}`,
            }}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
