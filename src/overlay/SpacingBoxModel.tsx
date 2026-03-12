/**
 * SpacingBoxModel.tsx — Webflow-style visual box model for margin/padding
 *
 * Renders a dark-themed nested rectangle diagram with SVG trapezoid zones:
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
import { SpacingValuePopover } from "./SpacingValuePopover";
import { beginBatch, endBatch } from "./apply";
import { ms } from "./timing";
import { setScrubGroup } from "./scrubState";
import { stepForUnit, precisionForStep } from "./panelUtils";

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

// ─── Dark Theme Constants ────────────────────────────────────────

const DARK_BG = "#3d3d3d";
const LABEL_COLOR = "rgba(255,255,255,0.53)";
const VALUE_ZERO_COLOR = "#bdbdbd";
const VALUE_ACTIVE_COLOR = "#8fc2fa";
const VALUE_ACTIVE_BG = "rgba(0,125,240,0.2)";
const VALUE_HOVER_BG = "rgba(0,125,240,0.35)";

const SIDES = ["top", "right", "bottom", "left"] as const;

/** Map each side to its axis partner (static, never changes) */
const AXIS_PARTNER: Record<string, string> = {
  top: "bottom", bottom: "top", left: "right", right: "left",
};

/** Positions of each value as percentages of the container (derived from Figma 224x112 layout) */
const VALUE_POS: Record<string, { left: string; top: string }> = {
  "margin-top":     { left: "50%",   top: "9.8%"   },
  "margin-bottom":  { left: "50%",   top: "90.2%"  },
  "margin-left":    { left: "8.3%",  top: "50%"    },
  "margin-right":   { left: "91.7%", top: "50%"    },
  "padding-top":    { left: "50%",   top: "31.25%" },
  "padding-bottom": { left: "50%",   top: "68.75%" },
  "padding-left":   { left: "25%",   top: "50%"    },
  "padding-right":  { left: "75%",   top: "50%"    },
};

/** "margin-top" -> "Edit margin top" */
function propLabel(prop: string): string {
  return `Edit ${prop.replace("-", " ")}`;
}

// ─── Inline SVG Zone Components ─────────────────────────────────

/** Margin zone SVG — trapezoid fills with cutout for padding area */
function MarginZoneSvg({ id }: { id: string }) {
  return (
    <svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 224 112" fill="none" style={{ display: "block" }}>
      <defs>
        <mask id={`${id}-mm`} style={{ maskType: "alpha" } as React.CSSProperties} maskUnits="userSpaceOnUse" x="0" y="0" width="224" height="112">
          <path d="M224 112H0V0H224V112ZM40 22C37.79 22 36 23.79 36 26V86C36 88.21 37.79 90 40 90H184C186.21 90 188 88.21 188 86V26C188 23.79 186.21 22 184 22H40Z" fill="#D9D9D9" />
        </mask>
        <linearGradient id={`${id}-mg0`} x1="143" y1="22" x2="143" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.11" />
          <stop offset="1" stopColor="white" stopOpacity="0.13" />
        </linearGradient>
        <linearGradient id={`${id}-mg1`} x1="218" y1="112" x2="218" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.08" />
          <stop offset="1" stopColor="white" stopOpacity="0.09" />
        </linearGradient>
        <linearGradient id={`${id}-mg2`} x1="6" y1="112" x2="6" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.08" />
          <stop offset="1" stopColor="white" stopOpacity="0.09" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}-mm)`}>
        <path d="M0 0L76 48H148L224 0H0Z" fill={`url(#${id}-mg0)`} />
        <path d="M0 112L76 64H148L224 112H0Z" fill="white" fillOpacity="0.06" />
        <path d="M224 112L148 64V48L224 0V112Z" fill={`url(#${id}-mg1)`} />
        <path d="M0 112L76 64V48L0 0V112Z" fill={`url(#${id}-mg2)`} />
      </g>
    </svg>
  );
}

/** Padding zone SVG — trapezoid fills with cutout for content area */
function PaddingZoneSvg({ id }: { id: string }) {
  return (
    <svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 148 64" fill="none" style={{ display: "block" }}>
      <defs>
        <mask id={`${id}-pm`} style={{ maskType: "alpha" } as React.CSSProperties} maskUnits="userSpaceOnUse" x="0" y="0" width="148" height="64">
          <path d="M146 0C147.1 0 148 .895 148 2V62C148 63.1 147.1 64 146 64H2C.895 64 0 63.1 0 62V2C0 .895.895 0 2 0H146ZM38 22C36.895 22 36 22.895 36 24V40C36 41.1 36.895 42 38 42H110C111.1 42 112 41.1 112 40V24C112 22.895 111.1 22 110 22H38Z" fill="#D9D9D9" />
        </mask>
        <linearGradient id={`${id}-pg0`} x1="94.5" y1="42.5" x2="94.5" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.13" />
          <stop offset="1" stopColor="white" stopOpacity="0.11" />
        </linearGradient>
        <linearGradient id={`${id}-pg1`} x1="145" y1="64" x2="145" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.08" />
          <stop offset="1" stopColor="white" stopOpacity="0.09" />
        </linearGradient>
        <linearGradient id={`${id}-pg2`} x1="3" y1="64" x2="3" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.08" />
          <stop offset="1" stopColor="white" stopOpacity="0.09" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}-pm)`}>
        <path d="M0 0L38 24H110L148 0H0Z" fill="white" fillOpacity="0.06" />
        <path d="M0 64L38 40H110L148 64H0Z" fill={`url(#${id}-pg0)`} />
        <path d="M148 64L110 40V24L148 0V64Z" fill={`url(#${id}-pg1)`} />
        <path d="M0 64L38 40V24L0 0V64Z" fill={`url(#${id}-pg2)`} />
      </g>
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────

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
  const idRef = useRef(`sbm-${Math.random().toString(36).slice(2, 6)}`);

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

  // --- Zone highlight helpers (brightness filter on SVG wrapper) ---
  const highlightZone = useCallback((group: "margin" | "padding") => {
    if (scrubActiveRef.current) return;
    const ref = group === "margin" ? marginZoneRef : paddingZoneRef;
    if (ref.current) ref.current.style.filter = "brightness(1.5)";
  }, []);

  const clearZone = useCallback((group: "margin" | "padding") => {
    if (scrubActiveRef.current) return;
    const ref = group === "margin" ? marginZoneRef : paddingZoneRef;
    if (ref.current) ref.current.style.filter = "brightness(1)";
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
    const pos = VALUE_POS[prop];

    return (
      <div
        key={prop}
        data-spacing-index={tabIndex}
        data-spacing-prop={prop}
        tabIndex={0}
        role="button"
        aria-label={propLabel(prop)}
        style={{
          position: "absolute",
          left: pos.left,
          top: pos.top,
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 16,
          minWidth: nonDefault ? 15 : 10,
          paddingLeft: 1,
          paddingRight: 1,
          borderRadius: 2,
          background: nonDefault ? VALUE_ACTIVE_BG : "transparent",
          color: nonDefault ? VALUE_ACTIVE_COLOR : VALUE_ZERO_COLOR,
          fontSize: "11.5px",
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: "-0.115px",
          lineHeight: "16px",
          textAlign: "center",
          cursor: "ew-resize",
          outline: "none",
          userSelect: "none",
          zIndex: 2,
          transition: `background ${ms("fast")}, color ${ms("fast")}`,
        }}
        // --- Hover: highlight + tooltip ---
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          if (nonDefault) {
            el.style.background = VALUE_HOVER_BG;
          } else {
            el.style.color = "#e0e0e0";
          }
          highlightZone(group);
          setTooltip({ prop, rect: el.getBoundingClientRect() });
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = nonDefault ? VALUE_ACTIVE_BG : "transparent";
          el.style.color = nonDefault ? VALUE_ACTIVE_COLOR : VALUE_ZERO_COLOR;
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

            const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
            const unitStep = stepForUnit(unit);
            const multiplier = ev.shiftKey ? 10 : 1;

            const delta = dx * unitStep * multiplier;
            const raw = startValue + delta;
            const clamped = isMargin ? raw : Math.max(0, raw);
            const snapped = Math.round(clamped / unitStep) * unitStep;
            const precision = precisionForStep(unitStep);
            const rounded = parseFloat(snapped.toFixed(precision));
            const prefix = isMargin ? "margin" : "padding";

            if (ev.shiftKey) {
              const allSides: Record<string, number> = {};
              for (const s of SIDES) allSides[`${prefix}-${s}`] = rounded;
              setScrubValues((prev) => ({ ...prev, ...allSides }));
              for (const s of SIDES) onChangeRef.current(`${prefix}-${s}`, rounded, unit);
            } else if (ev.altKey) {
              const side = prop.split("-")[1];
              const partner = AXIS_PARTNER[side];
              const partnerProp = `${prefix}-${partner}`;
              setScrubValues((prev) => ({ ...prev, [prop]: rounded, [partnerProp]: rounded }));
              onChangeRef.current(prop, rounded, unit);
              onChangeRef.current(partnerProp, rounded, unit);
            } else {
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
              if (marginZoneRef.current) marginZoneRef.current.style.filter = "brightness(1)";
              if (paddingZoneRef.current) paddingZoneRef.current.style.filter = "brightness(1)";
            }
          }

          function handleUp(ev: Event) {
            const wasClick = !isDragging;
            cleanup();

            if (wasClick && ev.type === "pointerup") {
              const pev = ev as PointerEvent;
              if (pev.altKey) {
                const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
                const prefix = isMargin ? "margin" : "padding";
                for (const s of SIDES) onChangeRef.current(`${prefix}-${s}`, value, unit);
              } else {
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPopoverState({ prop, rect });
          }
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(0,125,240,0.3)";
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
      {/* Dark box model container */}
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 1",
          borderRadius: 4,
          overflow: "hidden",
          background: DARK_BG,
          boxShadow: "0 0.5px 1px rgba(0,0,0,0.5)",
        }}
      >
        {/* Margin zone SVG */}
        <div
          ref={marginZoneRef}
          style={{
            position: "absolute",
            inset: 0,
            transition: `filter ${ms("fast")}`,
          }}
        >
          <MarginZoneSvg id={idRef.current} />
        </div>

        {/* Padding zone SVG */}
        <div
          ref={paddingZoneRef}
          style={{
            position: "absolute",
            left: "17%",
            top: "21.4%",
            width: "66%",
            height: "57.1%",
            transition: `filter ${ms("fast")}`,
          }}
        >
          <PaddingZoneSvg id={idRef.current} />
        </div>

        {/* MARGIN label */}
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 5,
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.21px",
            color: LABEL_COLOR,
            fontFamily: "'Inter', system-ui, sans-serif",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          Margin
        </span>

        {/* PADDING label */}
        <span
          style={{
            position: "absolute",
            top: "23.2%",
            left: "19.2%",
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.21px",
            color: LABEL_COLOR,
            fontFamily: "'Inter', system-ui, sans-serif",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          Padding
        </span>

        {/* Margin values */}
        {renderValue("margin-top", margin.top, "margin", 0)}
        {renderValue("margin-right", margin.right, "margin", 1)}
        {renderValue("margin-bottom", margin.bottom, "margin", 2)}
        {renderValue("margin-left", margin.left, "margin", 3)}

        {/* Padding values */}
        {renderValue("padding-top", padding.top, "padding", 4)}
        {renderValue("padding-right", padding.right, "padding", 5)}
        {renderValue("padding-bottom", padding.bottom, "padding", 6)}
        {renderValue("padding-left", padding.left, "padding", 7)}

        {/* Inner shadow overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            boxShadow: "inset 0 0.5px 0.5px rgba(255,255,255,0.1)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
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
              background: "rgba(50, 50, 50, 0.95)",
              color: "#e0e0e0",
              fontSize: "11px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              padding: "4px 10px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 2147483647,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
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
