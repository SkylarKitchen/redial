/**
 * PositionOffsetDiagram.tsx — Visual box diagram for position offsets (top/right/bottom/left)
 * Single-layer version of SpacingBoxModel for position offsets.
 */

import { useState, useCallback, useEffect } from "react";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { ms } from "./timing";
import { color, text, border, surface, primaryAlpha, blackAlpha, gridAlpha, font } from "./theme";

interface PositionOffsetDiagramProps {
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (prop: string, value: number) => void;
  units: { top: string; right: string; bottom: string; left: string };
  availableUnits: string[];
  onUnitChange: (prop: string, unit: string) => void;
  /** Conversion tooltip hint passed through to the shared UnitSelector */
  conversionHint?: ConversionHint | null;
  /** Which offsets are currently "auto" (no explicit authored value) */
  autoStates?: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  /** Called when user clicks an "Auto" label to switch to editable mode */
  onAutoDisable?: (prop: string) => void;
  /** Called on Option+Click (Alt+Click) to reset a property to its default */
  onReset?: (prop: string) => void;
  /** True when the element uses Tailwind utility classes */
  isTailwind?: boolean;
}

/** Diagonal crosshatch pattern matching Webflow's offset diagram background */
const HATCHED_BG = [
  `repeating-linear-gradient(`,
  `45deg,`,
  `transparent,`,
  `transparent 3px,`,
  `${primaryAlpha(0.07)} 3px,`,
  `${primaryAlpha(0.07)} 4px`,
  `)`,
].join(" ");

export function PositionOffsetDiagram({ top, right, bottom, left, onChange, units, availableUnits, onUnitChange, conversionHint, autoStates, onAutoDisable, onReset, isTailwind = false }: PositionOffsetDiagramProps) {
  const auto = autoStates ?? { top: false, right: false, bottom: false, left: false };
  const stepFor = (side: "top" | "right" | "bottom" | "left") =>
    isTailwind && units[side] === "px" ? 4 : 1;

  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div
        style={{
          position: "relative",
          border: `1px solid ${color.border}`,
          borderRadius: "4px",
          background: HATCHED_BG,
          padding: "0",
        }}
      >
        {/* Top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          {auto.top ? (
            <AutoLabel onClick={() => onAutoDisable?.("top")} />
          ) : (
            <EditableValue value={top} onChange={(v) => onChange("top", v)} suffix={units.top} onReset={() => onReset?.("top")} step={stepFor("top")} />
          )}
        </div>

        {/* Left / element / Right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            {auto.left ? (
              <AutoLabel onClick={() => onAutoDisable?.("left")} />
            ) : (
              <EditableValue value={left} onChange={(v) => onChange("left", v)} suffix={units.left} onReset={() => onReset?.("left")} step={stepFor("left")} />
            )}
          </div>
          {/* Element placeholder */}
          <div
            style={{
              flex: 1,
              height: "24px",
              background: color.input,
              borderRadius: "2px",
              border: `1px dashed ${border.input}`,
              margin: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "8px", color: text.disabled, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              element
            </span>
          </div>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            {auto.right ? (
              <AutoLabel onClick={() => onAutoDisable?.("right")} />
            ) : (
              <EditableValue value={right} onChange={(v) => onChange("right", v)} suffix={units.right} onReset={() => onReset?.("right")} step={stepFor("right")} />
            )}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          {auto.bottom ? (
            <AutoLabel onClick={() => onAutoDisable?.("bottom")} />
          ) : (
            <EditableValue value={bottom} onChange={(v) => onChange("bottom", v)} suffix={units.bottom} onReset={() => onReset?.("bottom")} step={stepFor("bottom")} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Auto keyword label ---

function AutoLabel({ onClick }: { onClick: () => void }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        fontSize: "10px",
        fontFamily: font.mono,
        color: text.hint,
        cursor: "text",
        padding: "1px 3px",
        borderRadius: "2px",
        minWidth: "16px",
        textAlign: "center" as const,
        transition: `background ${ms("normal")}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = surface.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      Auto
    </span>
  );
}

// --- Editable inline value (same pattern as SpacingBoxModel) ---

function EditableValue({
  value,
  onChange,
  suffix,
  onReset,
  step: stepProp = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  onReset?: () => void;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

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
        setDraft(String(value));
        setEditing(false);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.altKey ? stepProp * 0.1 : e.shiftKey ? stepProp * 10 : stepProp;
        const direction = e.key === "ArrowUp" ? 1 : -1;
        const next = Math.round((value + step * direction) * 10) / 10;
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          width: "32px",
          background: blackAlpha(0.07),
          border: `1px solid ${gridAlpha(0.5)}`,
          borderRadius: "2px",
          color: text.primary,
          fontSize: "10px",
          fontFamily: font.mono,
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
      onClick={(e) => {
        e.stopPropagation();
        if (e.altKey && onReset) { onReset(); return; }
        setEditing(true);
      }}
      style={{
        fontSize: "10px",
        fontFamily: font.mono,
        color: value !== 0 ? text.secondary : text.hint,
        cursor: "text",
        padding: "1px 3px",
        borderRadius: "2px",
        minWidth: "16px",
        textAlign: "center",
        transition: `background ${ms("normal")}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = surface.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {value}
      {suffix && (
        <span style={{ fontSize: "8px", color: text.hint, marginLeft: "1px" }}>
          {suffix}
        </span>
      )}
    </span>
  );
}
