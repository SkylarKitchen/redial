/**
 * ViewportBar.tsx — Responsive viewport width presets
 *
 * Constrains page content to a fixed width to preview
 * how styles behave at different breakpoints.
 */

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
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.4)",
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
              background: isActive ? "rgba(232, 118, 75, 0.15)" : "rgba(255,255,255,0.08)",
              color: isActive ? "#E8764B" : "rgba(255, 255, 255, 0.6)",
              transition: "background 100ms, color 100ms",
            }}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
