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
 * - Alt(Option)+click resets the value (matches the panel-wide reset gesture)
 * - Alt(Option)+click on a corner zone applies value to all 4 sides
 * - Tab/Shift+Tab navigation in visual order
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UnitSelector } from "../controls/UnitSelector";
import { usePortalTarget } from "../hooks/usePortalTarget";
import { SpacingValuePopover } from "./SpacingValuePopover";
import { beginBatch, endBatch, resetAndReadNum } from "../core/apply";
import { ms } from "../timing";
import { setScrubGroup, setHoverGroup } from "../core/scrubState";
import { stepForUnit, precisionForStep } from "../panelUtils";
import type { IndicatorType } from "../theme";
import { spacingZone, surface, font, blackAlpha, color, text, bgAlpha, border, shadow, focusRing, zIndex } from "../theme";

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
  /** Target element — used for alt+click reset */
  element: Element;
  /** Indicator function — returns whether a property has been edited */
  ind: (prop: string) => IndicatorType;
  /** Reset callback — updates parent state without re-applying inline style */
  onReset?: (prop: string, value: number) => void;
  /** True when the element uses Tailwind utility classes */
  isTailwind?: boolean;
  /** Per-property CSS variable name (e.g. { "margin-top": "--space-4" }) */
  cssVars?: Record<string, string | null>;
  /** Called when a variable is linked/unlinked on a spacing property */
  onVarChange?: (prop: string, varName: string | null) => void;
}

// Zone base/highlight colors — neutral grays from theme tokens
const MARGIN_BASE = spacingZone.marginBase;
const MARGIN_HIGHLIGHT = spacingZone.marginHover;
const PADDING_BASE = spacingZone.paddingBase;
const PADDING_HIGHLIGHT = spacingZone.paddingHover;

const SIDES = ["top", "right", "bottom", "left"] as const;

/** Map each side to its axis partner (static, never changes) */
const AXIS_PARTNER: Record<string, string> = {
  top: "bottom", bottom: "top", left: "right", right: "left",
};

/** Map each corner position to the side whose value it uses */
const CORNER_SIDE: Record<string, string> = {
  "top-left": "top",
  "top-right": "right",
  "bottom-right": "bottom",
  "bottom-left": "left",
};

/** Corner position styles (absolute within the box) */
const CORNER_POS: Record<string, React.CSSProperties> = {
  "top-left": { top: 0, left: 0 },
  "top-right": { top: 0, right: 0 },
  "bottom-right": { bottom: 0, right: 0 },
  "bottom-left": { bottom: 0, left: 0 },
};

const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

/** "margin-top" → "Edit margin top" / "Edit margin top · ⌥ click to reset" */
function propLabel(prop: string, isEdited?: boolean): string {
  const base = `Edit ${prop.replace("-", " ")}`;
  return isEdited ? `${base} · ⌥ click to reset` : base;
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
  element,
  ind,
  onReset,
  isTailwind = false,
  cssVars = {},
  onVarChange,
}: SpacingBoxModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const marginZoneRef = useRef<HTMLDivElement>(null);
  const paddingZoneRef = useRef<HTMLDivElement>(null);

  // --- Optimistic scrub state (local values during drag for real-time display) ---
  const [scrubValues, setScrubValues] = useState<Record<string, number>>({});
  const scrubActiveRef = useRef(false);
  const portalTarget = usePortalTarget();

  // --- Tooltip state ---
  const [tooltip, setTooltip] = useState<{ prop: string; rect: DOMRect; isEdited?: boolean } | null>(null);

  // --- Popover state ---
  const [popoverState, setPopoverState] = useState<{ prop: string; rect: DOMRect } | null>(null);

  // --- Refs to avoid stale closures in pointer handlers ---
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
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
    setHoverGroup(group);
  }, []);

  const clearZone = useCallback((group: "margin" | "padding") => {
    if (scrubActiveRef.current) return;
    const ref = group === "margin" ? marginZoneRef : paddingZoneRef;
    const color = group === "margin" ? MARGIN_BASE : PADDING_BASE;
    if (ref.current) ref.current.style.background = color;
    setHoverGroup(null);
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
    const linkedVar = cssVars[prop] ?? null;

    if (linkedVar) {
      return (
        <div
          data-spacing-index={tabIndex}
          data-spacing-prop={prop}
          tabIndex={0}
          role="button"
          aria-label={propLabel(prop)}
          style={{
            fontSize: 9,
            fontFamily: font.mono,
            fontWeight: 500,
            color: color.variable,
            cursor: "pointer",
            padding: "2px 3px",
            borderRadius: 3,
            minWidth: 18,
            textAlign: "center",
            outline: "none",
            userSelect: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 55,
            position: "relative",
          }}
          title={`var(${linkedVar}) — click to edit`}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPopoverState({ prop, rect });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPopoverState({ prop, rect });
            }
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          {linkedVar.replace(/^--/, "")}
        </div>
      );
    }

    const isMargin = group === "margin";
    const value = displayVal(prop, propValue);
    const indicator = ind(prop);
    const isEdited = indicator === "modified";
    const defaultColor = isEdited ? color.primary : (isMargin ? blackAlpha(0.55) : blackAlpha(0.8));
    const hoverColor = isEdited ? color.primaryHover : color.primary;

    return (
      <div
        data-spacing-index={tabIndex}
        data-spacing-prop={prop}
        tabIndex={0}
        role="button"
        aria-label={propLabel(prop)}
        style={{
          fontSize: 10,
          fontFamily: font.mono,
          fontWeight: isEdited ? 600 : 400,
          color: defaultColor,
          cursor: "ew-resize",
          padding: "2px 4px",
          borderRadius: 3,
          minWidth: 18,
          textAlign: "center",
          outline: "none",
          userSelect: "none",
          transition: `color ${ms("fast")}`,
          position: "relative",
        }}
        // --- Hover: highlight + tooltip ---
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = hoverColor;
          highlightZone(group);
          setTooltip({ prop, rect: el.getBoundingClientRect(), isEdited });
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = defaultColor;
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
            // Snap to step grid and use appropriate decimal precision
            const snapped = Math.round(clamped / unitStep) * unitStep;
            const precision = precisionForStep(unitStep);
            const rounded = parseFloat(snapped.toFixed(precision));
            const prefix = isMargin ? "margin" : "padding";

            // Optimistic local state for instant text update
            if (ev.shiftKey) {
              // Shift+drag: all 4 sides
              const allSides: Record<string, number> = {};
              for (const s of SIDES) allSides[`${prefix}-${s}`] = rounded;
              setScrubValues((prev) => ({ ...prev, ...allSides }));
              for (const s of SIDES) onChangeRef.current(`${prefix}-${s}`, rounded, unit);
            } else if (ev.altKey) {
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
                // Alt(Option)+click: reset this property to its authored/inherited
                // value, matching the panel-wide "⌥ click to reset" gesture that
                // every label-based control already uses. resetAndReadNum clears
                // the inline override and returns the resulting computed value so
                // the parent can update its displayed state.
                const resetVal = resetAndReadNum(element, prop);
                onResetRef.current?.(prop, resetVal);
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
          (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {value}
      </div>
    );
  };

  // --- Render corner zones for a box (margin or padding) ---
  const renderCornerZones = (group: "margin" | "padding") => {
    const isMargin = group === "margin";
    const values = isMargin ? margin : padding;
    return CORNERS.map((corner) => {
      const side = CORNER_SIDE[corner]; // e.g. "top"
      const cornerValue = values[side as keyof typeof values]; // value from that side
      const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;

      let downPos: { x: number; y: number } | null = null;

      return (
        <div
          key={`${group}-${corner}`}
          data-spacing-corner={`${group}-${corner}`}
          style={{
            position: "absolute",
            ...CORNER_POS[corner],
            width: 10,
            height: 10,
            cursor: "pointer",
            zIndex: 1,
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            downPos = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!downPos) return;
            const dx = Math.abs(e.clientX - downPos.x);
            const dy = Math.abs(e.clientY - downPos.y);
            downPos = null;
            // Only treat as click if not dragged
            if (dx < 3 && dy < 3 && e.altKey) {
              const prefix = isMargin ? "margin" : "padding";
              for (const s of SIDES) {
                onChangeRef.current(`${prefix}-${s}`, cornerValue, unit);
              }
            }
          }}
        />
      );
    });
  };

  return (
    <div style={{ padding: "8px 12px 4px" }} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Margin box (outer) */}
      <div
        ref={marginZoneRef}
        style={{
          position: "relative",
          border: `1px solid ${surface.active}`,
          borderRadius: 4,
          background: MARGIN_BASE,
          transition: `background ${ms("fast")}`,
        }}
      >
        {/* Corner zones for margin box */}
        {renderCornerZones("margin")}

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
            zIndex: zIndex.above,
          }}
        >
          <span
            style={{
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: blackAlpha(0.55),
            }}
          >
            Margin
          </span>
          <UnitSelector value={marginUnit} options={marginUnits} onChange={onMarginUnitChange} />
        </div>

        {/* Margin top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
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
              border: `1px solid ${surface.active}`,
              borderRadius: 3,
              background: PADDING_BASE,
              margin: "2px 0",
              position: "relative",
              transition: `background ${ms("fast")}`,
            }}
          >
            {/* Corner zones for padding box */}
            {renderCornerZones("padding")}

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
                zIndex: zIndex.above,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: blackAlpha(0.55),
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
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
              {renderValue("padding-top", padding.top, "padding", 4)}
            </div>

            {/* Padding left / content / Padding right */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                {renderValue("padding-left", padding.left, "padding", 7)}
              </div>
              {/* Content placeholder — solid darker fill per spec */}
              <div
                style={{
                  flex: 1,
                  height: 14,
                  background: spacingZone.content,
                  borderRadius: "2px",
                  margin: "0 4px",
                }}
              />
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                {renderValue("padding-right", padding.right, "padding", 5)}
              </div>
            </div>

            {/* Padding bottom */}
            <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
              {renderValue("padding-bottom", padding.bottom, "padding", 6)}
            </div>
          </div>

          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            {renderValue("margin-right", margin.right, "margin", 1)}
          </div>
        </div>

        {/* Margin bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
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
              background: bgAlpha(0.97),
              color: text.secondary,
              fontSize: "11px",
              fontFamily: font.sans,
              padding: "4px 10px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: zIndex.max,
              boxShadow: shadow.dropdown,
              border: `1px solid ${border.subtle}`,
            }}
          >
            {propLabel(tooltip.prop, tooltip.isEdited)}
          </div>,
          portalTarget,
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
          isTailwind={isTailwind}
          element={element}
          activeVariable={cssVars[popoverState.prop] ?? null}
          onSelectVariable={(varExpr) => {
            const varName = varExpr.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
            if (varName && onVarChange) {
              onVarChange(popoverState.prop, varName);
              setPopoverState(null);
            }
          }}
          onUnlink={() => {
            if (onVarChange) {
              onVarChange(popoverState.prop, null);
              setPopoverState(null);
            }
          }}
        />
      )}
    </div>
  );
}
