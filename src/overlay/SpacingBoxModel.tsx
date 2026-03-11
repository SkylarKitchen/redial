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
 * Features:
 * - Drag-to-scrub on values (via LabelScrub composition)
 * - Shift+drag updates all 4 sides uniformly
 * - Alt+click applies value to all 4 sides
 * - Hover zone highlighting (ref-based, zero re-renders)
 * - Tab/Shift+Tab navigation in visual order
 */

import { useCallback, useRef } from "react";
import { EditableValue } from "./controls";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector } from "./UnitSelector";
import { beginBatch, endBatch } from "./apply";

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

// Zone base/highlight colors
const MARGIN_BASE = "rgba(255, 152, 87, 0.08)";
const MARGIN_HIGHLIGHT = "rgba(255, 152, 87, 0.16)";
const PADDING_BASE = "rgba(87, 168, 255, 0.08)";
const PADDING_HIGHLIGHT = "rgba(87, 168, 255, 0.16)";

export function SpacingBoxModel({ margin, padding, onChange, marginUnit, paddingUnit, marginUnits, paddingUnits, onMarginUnitChange, onPaddingUnitChange }: SpacingBoxModelProps) {
  // --- Refs for zone highlighting (direct DOM mutation, zero re-renders) ---
  const marginZoneRef = useRef<HTMLDivElement>(null);
  const paddingZoneRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track if shift was held at drag start (locked for duration)
  const shiftHeldRef = useRef(false);
  const scrubActiveRef = useRef(false);

  // --- Zone highlight helpers ---
  const highlightMargin = useCallback(() => {
    if (!scrubActiveRef.current && marginZoneRef.current)
      marginZoneRef.current.style.background = MARGIN_HIGHLIGHT;
  }, []);
  const clearMargin = useCallback(() => {
    if (!scrubActiveRef.current && marginZoneRef.current)
      marginZoneRef.current.style.background = MARGIN_BASE;
  }, []);
  const highlightPadding = useCallback(() => {
    if (!scrubActiveRef.current && paddingZoneRef.current)
      paddingZoneRef.current.style.background = PADDING_HIGHLIGHT;
  }, []);
  const clearPadding = useCallback(() => {
    if (!scrubActiveRef.current && paddingZoneRef.current)
      paddingZoneRef.current.style.background = PADDING_BASE;
  }, []);

  // --- Shift-aware change handlers ---
  const handleMarginChange = useCallback((prop: string, value: number) => {
    if (shiftHeldRef.current) {
      onChange("margin-top", value, marginUnit);
      onChange("margin-right", value, marginUnit);
      onChange("margin-bottom", value, marginUnit);
      onChange("margin-left", value, marginUnit);
    } else {
      onChange(prop, value, marginUnit);
    }
  }, [onChange, marginUnit]);

  const handlePaddingChange = useCallback((prop: string, value: number) => {
    if (shiftHeldRef.current) {
      onChange("padding-top", value, paddingUnit);
      onChange("padding-right", value, paddingUnit);
      onChange("padding-bottom", value, paddingUnit);
      onChange("padding-left", value, paddingUnit);
    } else {
      onChange(prop, value, paddingUnit);
    }
  }, [onChange, paddingUnit]);

  // --- Scrub start/end (undo batching + shift capture) ---
  const handleScrubStart = useCallback(() => {
    // Begin undo batch for multi-property scrub
    scrubActiveRef.current = true;
    beginBatch();
  }, []);

  const handleScrubEnd = useCallback(() => {
    scrubActiveRef.current = false;
    shiftHeldRef.current = false;
    endBatch();
  }, []);

  // --- Capture shift key on pointer down (before LabelScrub handles it) ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    shiftHeldRef.current = e.shiftKey;
  }, []);

  // --- Alt+Click: set all 4 sides ---
  const setAllMargins = useCallback((value: number) => {
    onChange("margin-top", value, marginUnit);
    onChange("margin-right", value, marginUnit);
    onChange("margin-bottom", value, marginUnit);
    onChange("margin-left", value, marginUnit);
  }, [onChange, marginUnit]);

  const setAllPaddings = useCallback((value: number) => {
    onChange("padding-top", value, paddingUnit);
    onChange("padding-right", value, paddingUnit);
    onChange("padding-bottom", value, paddingUnit);
    onChange("padding-left", value, paddingUnit);
  }, [onChange, paddingUnit]);

  // --- Tab navigation ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const target = e.target as HTMLElement;
    const idx = target.dataset.spacingIndex;
    if (idx === undefined) return;
    e.preventDefault();
    const current = Number(idx);
    const next = e.shiftKey ? (current + 7) % 8 : (current + 1) % 8;
    containerRef.current?.querySelector<HTMLElement>(`[data-spacing-index="${next}"]`)?.focus();
  }, []);

  // --- Render helper for a scrub-wrapped value ---
  const renderValue = (
    prop: string,
    value: number,
    group: "margin" | "padding",
    tabIndex: number,
  ) => {
    const isMargin = group === "margin";
    const unit = isMargin ? marginUnit : paddingUnit;
    const changeHandler = isMargin ? handleMarginChange : handlePaddingChange;
    const highlight = isMargin ? highlightMargin : highlightPadding;
    const clear = isMargin ? clearMargin : clearPadding;
    const setAll = isMargin ? setAllMargins : setAllPaddings;

    return (
      <div
        onPointerDown={handlePointerDown}
        onMouseEnter={highlight}
        onMouseLeave={clear}
      >
        <LabelScrub
          value={value}
          onChange={(v) => changeHandler(prop, v)}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
          min={isMargin ? undefined : 0}
        >
          <EditableValue
            value={value}
            onChange={(v) => onChange(prop, v, unit)}
            onAltClick={() => setAll(value)}
            data-spacing-index={tabIndex}
          />
        </LabelScrub>
      </div>
    );
  };

  return (
    <div style={{ padding: "8px 12px 4px" }} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Margin box (outer) */}
      <div
        ref={marginZoneRef}
        style={{
          position: "relative",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          background: MARGIN_BASE,
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
          {renderValue("margin-top", margin.top, "margin", 0)}
        </div>

        {/* Margin left / Padding box / Margin right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            {renderValue("margin-left", margin.left, "margin", 3)}
          </div>

          {/* Padding box (inner) */}
          <div
            ref={paddingZoneRef}
            style={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "3px",
              background: PADDING_BASE,
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
              {renderValue("padding-top", padding.top, "padding", 4)}
            </div>

            {/* Padding left / content / Padding right */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                {renderValue("padding-left", padding.left, "padding", 7)}
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
                {renderValue("padding-right", padding.right, "padding", 5)}
              </div>
            </div>

            {/* Padding bottom */}
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
              {renderValue("padding-bottom", padding.bottom, "padding", 6)}
            </div>
          </div>

          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            {renderValue("margin-right", margin.right, "margin", 1)}
          </div>
        </div>

        {/* Margin bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          {renderValue("margin-bottom", margin.bottom, "margin", 2)}
        </div>
      </div>
    </div>
  );
}
