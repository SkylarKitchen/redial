/**
 * SpacingBoxModel.tsx — Webflow-style visual box model for margin/padding
 *
 * Renders a nested rectangle diagram:
 * ┌─── MARGIN ────────────────────┐
 * │          top                   │
 * │  left ┌─ PADDING ──┐  right   │
 * │       │   top       │          │
 * │       │ l  ████  r  │          │
 * │       │   bottom    │          │
 * │       └─────────────┘          │
 * │          bottom                │
 * └────────────────────────────────┘
 *
 * Each value is click-to-edit with arrow key increment.
 */

import { EditableValue } from "./controls";
import { UnitSelector } from "./UnitSelector";

interface SpacingBoxModelProps {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  onChange: (prop: string, value: number, unit: string) => void;
  marginUnit: string;
  paddingUnit: string;
  marginUnits: string[];
  paddingUnits: string[];
  onMarginUnitChange: (unit: string) => void;
  onPaddingUnitChange: (unit: string) => void;
}

export function SpacingBoxModel({ margin, padding, onChange, marginUnit, paddingUnit, marginUnits, paddingUnits, onMarginUnitChange, onPaddingUnitChange }: SpacingBoxModelProps) {
  return (
    <div style={{ padding: "8px 12px 4px" }}>
      {/* Margin box (outer) */}
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          background: "rgba(255, 152, 87, 0.08)",
          padding: "0",
        }}
      >
        {/* MARGIN label + unit selector */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "6px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            pointerEvents: "auto",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.3)" }}>
            Margin
          </span>
          <UnitSelector value={marginUnit} options={marginUnits} onChange={onMarginUnitChange} />
        </div>

        {/* Margin top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <EditableValue value={margin.top} onChange={(v) => onChange("margin-top", v, marginUnit)} onAltClick={() => { onChange("margin-top", margin.top, marginUnit); onChange("margin-bottom", margin.top, marginUnit); }} />
        </div>

        {/* Margin left / Padding box / Margin right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={margin.left} onChange={(v) => onChange("margin-left", v, marginUnit)} onAltClick={() => { onChange("margin-left", margin.left, marginUnit); onChange("margin-right", margin.left, marginUnit); }} />
          </div>

          {/* Padding box (inner) */}
          <div
            style={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "3px",
              background: "rgba(87, 168, 255, 0.08)",
              margin: "2px 0",
              position: "relative",
            }}
          >
            {/* PADDING label + unit selector */}
            <div
              style={{
                position: "absolute",
                top: "2px",
                left: "6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                pointerEvents: "auto",
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.3)" }}>
                Padding
              </span>
              <UnitSelector value={paddingUnit} options={paddingUnits} onChange={onPaddingUnitChange} />
            </div>

            {/* Padding top */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <EditableValue value={padding.top} onChange={(v) => onChange("padding-top", v, paddingUnit)} onAltClick={() => { onChange("padding-top", padding.top, paddingUnit); onChange("padding-bottom", padding.top, paddingUnit); }} />
            </div>

            {/* Padding left / content / Padding right */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <EditableValue value={padding.left} onChange={(v) => onChange("padding-left", v, paddingUnit)} onAltClick={() => { onChange("padding-left", padding.left, paddingUnit); onChange("padding-right", padding.left, paddingUnit); }} />
              </div>
              {/* Content placeholder */}
              <div
                style={{
                  flex: 1,
                  height: "20px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "2px",
                  margin: "0 4px",
                }}
              />
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <EditableValue value={padding.right} onChange={(v) => onChange("padding-right", v, paddingUnit)} onAltClick={() => { onChange("padding-left", padding.right, paddingUnit); onChange("padding-right", padding.right, paddingUnit); }} />
              </div>
            </div>

            {/* Padding bottom */}
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
              <EditableValue value={padding.bottom} onChange={(v) => onChange("padding-bottom", v, paddingUnit)} onAltClick={() => { onChange("padding-top", padding.bottom, paddingUnit); onChange("padding-bottom", padding.bottom, paddingUnit); }} />
            </div>
          </div>

          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={margin.right} onChange={(v) => onChange("margin-right", v, marginUnit)} onAltClick={() => { onChange("margin-left", margin.right, marginUnit); onChange("margin-right", margin.right, marginUnit); }} />
          </div>
        </div>

        {/* Margin bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <EditableValue value={margin.bottom} onChange={(v) => onChange("margin-bottom", v, marginUnit)} onAltClick={() => { onChange("margin-top", margin.bottom, marginUnit); onChange("margin-bottom", margin.bottom, marginUnit); }} />
        </div>
      </div>
    </div>
  );
}
