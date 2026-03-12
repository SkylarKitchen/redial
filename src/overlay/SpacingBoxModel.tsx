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
 * - Hover: cursor ew-resize, tooltip "Edit margin left", zone highlight
 * - Click: opens SpacingValuePopover (slider + presets)
 * - Drag-to-scrub with optimistic local state (real-time text updates)
 * - Shift+drag updates all 4 sides uniformly
 * - Alt(Option)+drag updates axis pair (left+right or top+bottom)
 * - Alt+click applies value to all 4 sides
 * - Tab/Shift+Tab navigation in visual order
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UnitSelector } from "./UnitSelector";
import { SpacingValuePopover } from "./SpacingValuePopover";
import { beginBatch, endBatch } from "./apply";
import { ms } from "./timing";
import { setScrubGroup } from "./scrubState";

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

// Zone base/highlight colors (slightly stronger highlight for hover feedback)
const MARGIN_BASE = "rgba(255, 152, 87, 0.08)";
const MARGIN_HIGHLIGHT = "rgba(255, 152, 87, 0.22)";
const PADDING_BASE = "rgba(87, 168, 255, 0.08)";
const PADDING_HIGHLIGHT = "rgba(87, 168, 255, 0.22)";

const SIDES = ["top", "right", "bottom", "left"] as const;

/** Map each side to its axis partner (static, never changes) */
const AXIS_PARTNER: Record<string, string> = {
  top: "bottom", bottom: "top", left: "right", right: "left",
};

/** "margin-top" → "Edit margin top" */
function propLabel(prop: string): string {
  return `Edit ${prop.replace("-", " ")}`;
}

export function SpacingBoxModel({
  margin,
  padding,
  onChange,
  marginUnit,
  paddingUnit,
  marginUnits,
  paddingUnits,
  onMarginUnitChange,
  onPaddingUnitChange,
}: SpacingBoxModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const marginZoneRef = useRef<HTMLDivElement>(null);
  const paddingZoneRef = useRef<HTMLDivElement>(null);

  // --- Optimistic scrub state (local values during drag for real-time display) ---
  const [scrubValues, setScrubValues] = useState<Record<string, number>>({});
  const scrubActiveRef = useRef(false);

  // --- Tooltip state ---
  const [tooltip, setTooltip] = useState<{ prop: string; rect: DOMRect } | null>(null);

  // --- Popover state ---
  const [popoverState, setPopoverState] = useState<{ prop: string; rect: DOMRect } | null>(null);

  // --- Refs to avoid stale closures in pointer handlers ---
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const marginUnitRef = useRef(marginUnit);
  marginUnitRef.current = marginUnit;
  const paddingUnitRef = useRef(paddingUnit);
  paddingUnitRef.current = paddingUnit;
  const shiftHeldRef = useRef(false);
  const altHeldRef = useRef(false);

  // AXIS_PARTNER is hoisted outside the component as a static constant

  // --- Zone highlight helpers (direct DOM, zero re-renders) ---
  const highlightZone = useCallback((group: "margin" | "padding") => {
    if (scrubActiveRef.current) return;
    const ref = group === "margin" ? marginZoneRef : paddingZoneRef;
    const color = group === "margin" ? MARGIN_HIGHLIGHT : PADDING_HIGHLIGHT;
    if (ref.current) ref.current.style.background = color;
  }, []);

  const clearZone = useCallback((group: "margin" | "padding") => {
    if (scrubActiveRef.current) return;
    const ref = group === "margin" ? marginZoneRef : paddingZoneRef;
    const color = group === "margin" ? MARGIN_BASE : PADDING_BASE;
    if (ref.current) ref.current.style.background = color;
  }, []);

  // --- Safety: close undo batch if unmounted mid-scrub ---
  useEffect(() => {
    return () => {
      if (scrubActiveRef.current) {
        scrubActiveRef.current = false;
        endBatch();
      }
    };
  }, []);

  // --- Tab navigation (visual order: mT mR mB mL pT pR pB pL) ---
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

  // --- Get display value: scrub override takes priority over props ---
  const displayVal = useCallback(
    (prop: string, propValue: number): number => {
      return prop in scrubValues ? scrubValues[prop] : propValue;
    },
    [scrubValues],
  );

  // --- Popover handlers ---
  const handlePopoverChange = useCallback(
    (value: number) => {
      if (!popoverState) return;
      const { prop } = popoverState;
      const isMargin = prop.startsWith("margin");
      const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
      onChangeRef.current(prop, value, unit);
    },
    [popoverState],
  );

  const handlePopoverUnitChange = useCallback(
    (unit: string) => {
      if (!popoverState) return;
      if (popoverState.prop.startsWith("margin")) onMarginUnitChange(unit);
      else onPaddingUnitChange(unit);
    },
    [popoverState, onMarginUnitChange, onPaddingUnitChange],
  );

  /** Resolve current value for the active popover */
  const getPopoverValue = (): number => {
    if (!popoverState) return 0;
    const [group, side] = popoverState.prop.split("-");
    const obj = group === "margin" ? margin : padding;
    return obj[side as keyof typeof obj];
  };

  // --- Render a single interactive value cell ---
  const renderValue = (
    prop: string,
    propValue: number,
    group: "margin" | "padding",
    tabIndex: number,
  ) => {
    const isMargin = group === "margin";
    const value = displayVal(prop, propValue);
    const nonDefault = value !== 0;

    return (
      <div
        data-spacing-index={tabIndex}
        data-spacing-prop={prop}
        tabIndex={0}
        role="button"
        aria-label={propLabel(prop)}
        style={{
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: nonDefault ? "rgba(119,166,253,0.95)" : "rgba(255,255,255,0.3)",
          cursor: "ew-resize",
          padding: "2px 4px",
          borderRadius: "3px",
          minWidth: "18px",
          textAlign: "center",
          outline: "none",
          userSelect: "none",
          transition: `background ${ms("fast")}, color ${ms("fast")}`,
          position: "relative",
        }}
        // --- Hover: highlight + tooltip ---
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "rgba(255,255,255,0.12)";
          el.style.color = nonDefault ? "rgba(139,186,255,1)" : "rgba(255,255,255,0.95)";
          highlightZone(group);
          setTooltip({ prop, rect: el.getBoundingClientRect() });
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "transparent";
          el.style.color = nonDefault ? "rgba(119,166,253,0.95)" : "rgba(255,255,255,0.3)";
          clearZone(group);
          setTooltip(null);
        }}
        // --- Pointer: unified click / drag-scrub ---
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();

          const el = e.currentTarget as HTMLElement;
          el.setPointerCapture(e.pointerId);

          shiftHeldRef.current = e.shiftKey;
          altHeldRef.current = e.altKey;
          const startX = e.clientX;
          const startValue = value;
          let isDragging = false;

          const prevSelect = document.body.style.userSelect;
          const prevCursor = document.body.style.cursor;

          function handleMove(ev: PointerEvent) {
            const dx = ev.clientX - startX;

            // Dead zone: distinguish click from drag
            if (!isDragging) {
              if (Math.abs(dx) < 3) return;
              isDragging = true;
              scrubActiveRef.current = true;
              setScrubGroup(isMargin ? "margin" : "padding");
              document.body.style.userSelect = "none";
              document.body.style.cursor = "ew-resize";
              setTooltip(null);
              beginBatch();
            }

            const multiplier = ev.shiftKey ? 10 : 1;

            const delta = dx * multiplier;
            const raw = startValue + delta;
            const clamped = isMargin ? raw : Math.max(0, raw);
            const rounded = parseFloat(clamped.toFixed(0));

            const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
            const prefix = isMargin ? "margin" : "padding";

            // Optimistic local state for instant text update
            if (shiftHeldRef.current) {
              // Shift+drag: all 4 sides
              const allSides: Record<string, number> = {};
              for (const s of SIDES) allSides[`${prefix}-${s}`] = rounded;
              setScrubValues((prev) => ({ ...prev, ...allSides }));
              for (const s of SIDES) onChangeRef.current(`${prefix}-${s}`, rounded, unit);
            } else if (altHeldRef.current) {
              // Alt(Option)+drag: axis pair (left+right or top+bottom)
              const side = prop.split("-")[1];
              const partner = AXIS_PARTNER[side];
              const partnerProp = `${prefix}-${partner}`;
              setScrubValues((prev) => ({ ...prev, [prop]: rounded, [partnerProp]: rounded }));
              onChangeRef.current(prop, rounded, unit);
              onChangeRef.current(partnerProp, rounded, unit);
            } else {
              // Regular drag: single side
              setScrubValues((prev) => ({ ...prev, [prop]: rounded }));
              onChangeRef.current(prop, rounded, unit);
            }
          }

          let cleaned = false;
          function cleanup() {
            if (cleaned) return;
            cleaned = true;
            el.removeEventListener("pointermove", handleMove);
            el.removeEventListener("pointerup", handleUp);
            el.removeEventListener("lostpointercapture", handleUp);
            window.removeEventListener("blur", handleUp);

            if (isDragging) {
              document.body.style.userSelect = prevSelect;
              document.body.style.cursor = prevCursor;
              scrubActiveRef.current = false;
              setScrubGroup(null);
              shiftHeldRef.current = false;
              altHeldRef.current = false;
              endBatch();
              setScrubValues({});
              // Reset zone highlights
              if (marginZoneRef.current) marginZoneRef.current.style.background = MARGIN_BASE;
              if (paddingZoneRef.current) paddingZoneRef.current.style.background = PADDING_BASE;
            }
          }

          function handleUp(ev: Event) {
            const wasClick = !isDragging;
            cleanup();

            if (wasClick && ev.type === "pointerup") {
              const pev = ev as PointerEvent;
              if (pev.altKey) {
                // Alt+click: set all 4 sides to this value
                const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
                const prefix = isMargin ? "margin" : "padding";
                for (const s of SIDES) onChangeRef.current(`${prefix}-${s}`, value, unit);
              } else {
                // Regular click: open popover
                const rect = el.getBoundingClientRect();
                setPopoverState({ prop, rect });
              }
            }
          }

          el.addEventListener("pointermove", handleMove);
          el.addEventListener("pointerup", handleUp);
          el.addEventListener("lostpointercapture", handleUp);
          window.addEventListener("blur", handleUp);
        }}
        // --- Keyboard: Enter opens popover ---
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPopoverState({ prop, rect });
          }
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {value}
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
          <span
            style={{
              fontSize: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.3)",
            }}
          >
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
              <span
                style={{
                  fontSize: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                Padding
              </span>
              <UnitSelector
                value={paddingUnit}
                options={paddingUnits}
                onChange={onPaddingUnitChange}
              />
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

      {/* --- Tooltip (portal) --- */}
      {tooltip &&
        !scrubActiveRef.current &&
        createPortal(
          <div
            data-tuner-portal
            style={{
              position: "fixed",
              left: `${tooltip.rect.left + tooltip.rect.width / 2}px`,
              top: `${tooltip.rect.top - 30}px`,
              transform: "translateX(-50%)",
              background: "rgba(40, 40, 40, 0.95)",
              color: "rgba(255,255,255,0.9)",
              fontSize: "11px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              padding: "4px 10px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 2147483647,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {propLabel(tooltip.prop)}
          </div>,
          document.body,
        )}

      {/* --- Popover (portal via SpacingValuePopover) --- */}
      {popoverState && (
        <SpacingValuePopover
          value={getPopoverValue()}
          onChange={handlePopoverChange}
          unit={popoverState.prop.startsWith("margin") ? marginUnit : paddingUnit}
          units={popoverState.prop.startsWith("margin") ? marginUnits : paddingUnits}
          onUnitChange={handlePopoverUnitChange}
          property={popoverState.prop}
          isMargin={popoverState.prop.startsWith("margin")}
          anchorRect={popoverState.rect}
          onClose={() => setPopoverState(null)}
        />
      )}
    </div>
  );
}
