/**
 * SizeSection.tsx — Size section extracted from WebflowPanel.tsx
 *
 * Owns all size-related state: width, height, min/max, overflow,
 * box-sizing, aspect-ratio, object-fit/position.
 */

import React, { useState, useCallback, memo } from "react";
import { Section, SliderRow, SelectRow, TextRow } from "./controls";
import { IconButtonGroup } from "./IconButtonGroup";
import { SizeInputCell } from "./SizeInputCell";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { isDirty, resetProp } from "./apply";
import { parseNum } from "./cssParsers";
import { getAuthoredValue, detectUnit, type SectionCtx } from "./panelUtils";
import { ChevronRight, Link } from "lucide-react";
import { ms } from "./timing";
import {
  SIZE_UNITS_W, SIZE_UNITS_H,
  OVERFLOW_ICON_OPTIONS,
  OBJECT_FIT_OPTIONS, OBJECT_POSITION_OPTIONS,
  BOX_SIZING_OPTIONS,
} from "./panelConstants";

// ─── Props ────────────────────────────────────────────────────────────

export interface SizeSectionProps {
  ctx: SectionCtx;
  display: string;
  isMedia: boolean;
  forceOpen?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────

export const SizeSection = memo(function SizeSection({ ctx, display, isMedia, forceOpen }: SizeSectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu } = ctx;

  // ─── resetCss helper ────────────────────────────────────────────────
  const resetCss = useCallback(
    (prop: string, setter: (v: number) => void) => {
      resetProp(element, prop);
      const fresh = getComputedStyle(element).getPropertyValue(prop).trim();
      setter(parseFloat(fresh) || 0);
    },
    [element],
  );

  // ─── Size state ─────────────────────────────────────────────────────

  const [width, setWidth] = useState(() => {
    const authored = getAuthoredValue(element, "width");
    return (!authored || authored === "auto") ? 0 : parseNum(cs.width);
  });
  const [height, setHeight] = useState(() => {
    const authored = getAuthoredValue(element, "height");
    return (!authored || authored === "auto") ? 0 : parseNum(cs.height);
  });
  const [minWidth, setMinWidth] = useState(() => {
    const authored = getAuthoredValue(element, "min-width");
    return authored ? parseNum(authored) : 0;
  });
  const [maxWidth, setMaxWidth] = useState(() => {
    const authored = getAuthoredValue(element, "max-width");
    return (!authored || authored === "none") ? 0 : parseNum(authored);
  });
  const [minHeight, setMinHeight] = useState(() => {
    const authored = getAuthoredValue(element, "min-height");
    return authored ? parseNum(authored) : 0;
  });
  const [maxHeight, setMaxHeight] = useState(() => {
    const authored = getAuthoredValue(element, "max-height");
    return (!authored || authored === "none") ? 0 : parseNum(authored);
  });

  const [overflow, setOverflow] = useState(() => cs.overflow.split(" ")[0] || "visible");
  const [overflowLocked, setOverflowLocked] = useState(true);
  const [overflowX, setOverflowX] = useState(() => cs.overflowX || "visible");
  const [overflowY, setOverflowY] = useState(() => cs.overflowY || "visible");
  const [boxSizing, setBoxSizing] = useState(() => cs.boxSizing || "border-box");
  const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio === "auto" ? "" : cs.aspectRatio);
  const [objectFit, setObjectFit] = useState(() => cs.objectFit);
  const [objectPosition, setObjectPosition] = useState(() => cs.objectPosition);
  const [showMoreSize, setShowMoreSize] = useState(false);

  // Size units
  const [widthUnit, setWidthUnit] = useState(() => detectUnit(element, "width"));
  const [heightUnit, setHeightUnit] = useState(() => detectUnit(element, "height"));
  const [minWidthUnit, setMinWidthUnit] = useState(() => detectUnit(element, "min-width"));
  const [maxWidthUnit, setMaxWidthUnit] = useState(() => detectUnit(element, "max-width"));
  const [minHeightUnit, setMinHeightUnit] = useState(() => detectUnit(element, "min-height"));
  const [maxHeightUnit, setMaxHeightUnit] = useState(() => detectUnit(element, "max-height"));

  // Conversion hints
  const { conversionHint: wHint, fireConversionHint: fireWHint } = useConversionHint();
  const { conversionHint: hHint, fireConversionHint: fireHHint } = useConversionHint();
  const { conversionHint: minWHint, fireConversionHint: fireMinWHint } = useConversionHint();
  const { conversionHint: minHHint, fireConversionHint: fireMinHHint } = useConversionHint();
  const { conversionHint: maxWHint, fireConversionHint: fireMaxWHint } = useConversionHint();
  const { conversionHint: maxHHint, fireConversionHint: fireMaxHHint } = useConversionHint();

  // Size keyword toggles
  const [widthAuto, setWidthAuto] = useState(() => {
    const authored = getAuthoredValue(element, "width");
    return !authored || authored === "auto";
  });
  const [heightAuto, setHeightAuto] = useState(() => {
    const authored = getAuthoredValue(element, "height");
    return !authored || authored === "auto";
  });
  const [maxWidthNone, setMaxWidthNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-width");
    return !authored || authored === "none";
  });
  const [maxHeightNone, setMaxHeightNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-height");
    return !authored || authored === "none";
  });

  // ─── Size handlers ──────────────────────────────────────────────────

  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);
  const handleMinWidthChange = useCallback((v: number) => { setMinWidth(v); apply("min-width", `${v}${minWidthUnit}`); }, [apply, minWidthUnit]);
  const handleMaxWidthChange = useCallback((v: number) => { setMaxWidth(v); apply("max-width", v === 0 ? "none" : `${v}${maxWidthUnit}`); }, [apply, maxWidthUnit]);
  const handleMinHeightChange = useCallback((v: number) => { setMinHeight(v); apply("min-height", `${v}${minHeightUnit}`); }, [apply, minHeightUnit]);
  const handleMaxHeightChange = useCallback((v: number) => { setMaxHeight(v); apply("max-height", v === 0 ? "none" : `${v}${maxHeightUnit}`); }, [apply, maxHeightUnit]);
  const handleOverflowChange = useCallback((v: string) => { setOverflow(v); apply("overflow", v); }, [apply]);
  const handleOverflowXChange = useCallback((v: string) => { setOverflowX(v); apply("overflow-x", v); }, [apply]);
  const handleOverflowYChange = useCallback((v: string) => { setOverflowY(v); apply("overflow-y", v); }, [apply]);
  const handleOverflowLockToggle = useCallback(() => {
    setOverflowLocked(prev => {
      if (!prev) { setOverflowX(overflow); setOverflowY(overflow); apply("overflow-x", overflow); apply("overflow-y", overflow); }
      return !prev;
    });
  }, [overflow, apply]);
  const handleBoxSizingChange = useCallback((v: string) => { setBoxSizing(v); apply("box-sizing", v); }, [apply]);
  const handleAspectRatioChange = useCallback((v: string) => { setAspectRatio(v); apply("aspect-ratio", v || "auto"); }, [apply]);
  const handleObjectFitChange = useCallback((v: string) => { setObjectFit(v); apply("object-fit", v); }, [apply]);
  const handleObjectPositionChange = useCallback((v: string) => { setObjectPosition(v); apply("object-position", v); }, [apply]);

  // Size keyword toggles
  const handleWidthAutoToggle = useCallback(() => {
    const next = !widthAuto;
    setWidthAuto(next);
    apply("width", next ? "auto" : `${width}${widthUnit}`);
  }, [widthAuto, width, widthUnit, apply]);

  const handleHeightAutoToggle = useCallback(() => {
    const next = !heightAuto;
    setHeightAuto(next);
    apply("height", next ? "auto" : `${height}${heightUnit}`);
  }, [heightAuto, height, heightUnit, apply]);

  const handleMaxWidthNoneToggle = useCallback(() => {
    const next = !maxWidthNone;
    setMaxWidthNone(next);
    apply("max-width", next ? "none" : `${maxWidth}${maxWidthUnit}`);
  }, [maxWidthNone, maxWidth, maxWidthUnit, apply]);

  const handleMaxHeightNoneToggle = useCallback(() => {
    const next = !maxHeightNone;
    setMaxHeightNone(next);
    apply("max-height", next ? "none" : `${maxHeight}${maxHeightUnit}`);
  }, [maxHeightNone, maxHeight, maxHeightUnit, apply]);

  // ─── JSX ────────────────────────────────────────────────────────────

  return (
    <Section title="Size" indicator={sectionInd(["width", "height", "min-width", "max-width", "min-height", "max-height", "overflow", "aspect-ratio", "object-fit", "object-position"])} forceOpen={forceOpen}>
      {/* Row 1: Width + Height */}
      <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
        <SizeInputCell
          label="Width"
          value={width}
          unit={widthUnit}
          units={SIZE_UNITS_W}
          keyword={widthAuto ? "auto" : null}
          onValueChange={handleWidthChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(width, widthUnit, u, ctx, "width"); fireWHint(width, widthUnit, c, u, ctx, "width"); setWidth(c); setWidthUnit(u); apply("width", `${c}${u}`); }}
          onKeywordChange={(k) => { setWidthAuto(k === "auto"); apply("width", k === "auto" ? "auto" : `${width}${widthUnit}`); }}
          isModified={isDirty(element, "width")}
          supportsAuto
          min={0}
          max={1920}
          conversionHint={wHint}
        />
        <SizeInputCell
          label="Height"
          value={height}
          unit={heightUnit}
          units={SIZE_UNITS_H}
          keyword={heightAuto ? "auto" : null}
          onValueChange={handleHeightChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(height, heightUnit, u, ctx, "height"); fireHHint(height, heightUnit, c, u, ctx, "height"); setHeight(c); setHeightUnit(u); apply("height", `${c}${u}`); }}
          onKeywordChange={(k) => { setHeightAuto(k === "auto"); apply("height", k === "auto" ? "auto" : `${height}${heightUnit}`); }}
          isModified={isDirty(element, "height")}
          supportsAuto
          min={0}
          max={1200}
          conversionHint={hHint}
        />
      </div>
      {/* Row 2: Min W + Min H */}
      <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
        <SizeInputCell
          label="Min W"
          value={minWidth}
          unit={minWidthUnit}
          units={SIZE_UNITS_W}
          keyword={null}
          onValueChange={handleMinWidthChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(minWidth, minWidthUnit, u, ctx, "width"); fireMinWHint(minWidth, minWidthUnit, c, u, ctx, "width"); setMinWidth(c); setMinWidthUnit(u); apply("min-width", `${c}${u}`); }}
          onKeywordChange={() => {}}
          isModified={isDirty(element, "min-width")}
          min={0}
          max={1920}
          conversionHint={minWHint}
        />
        <SizeInputCell
          label="Min H"
          value={minHeight}
          unit={minHeightUnit}
          units={SIZE_UNITS_H}
          keyword={null}
          onValueChange={handleMinHeightChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(minHeight, minHeightUnit, u, ctx, "height"); fireMinHHint(minHeight, minHeightUnit, c, u, ctx, "height"); setMinHeight(c); setMinHeightUnit(u); apply("min-height", `${c}${u}`); }}
          onKeywordChange={() => {}}
          isModified={isDirty(element, "min-height")}
          min={0}
          max={1200}
          conversionHint={minHHint}
        />
      </div>
      {/* Row 3: Max W + Max H */}
      <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
        <SizeInputCell
          label="Max W"
          value={maxWidth}
          unit={maxWidthUnit}
          units={SIZE_UNITS_W}
          keyword={maxWidthNone ? "none" : null}
          onValueChange={handleMaxWidthChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(maxWidth, maxWidthUnit, u, ctx, "width"); fireMaxWHint(maxWidth, maxWidthUnit, c, u, ctx, "width"); setMaxWidth(c); setMaxWidthUnit(u); apply("max-width", c === 0 ? "none" : `${c}${u}`); }}
          onKeywordChange={(k) => { setMaxWidthNone(k === "none"); apply("max-width", k === "none" ? "none" : `${maxWidth}${maxWidthUnit}`); }}
          isModified={isDirty(element, "max-width")}
          supportsNone
          min={0}
          max={1920}
          conversionHint={maxWHint}
        />
        <SizeInputCell
          label="Max H"
          value={maxHeight}
          unit={maxHeightUnit}
          units={SIZE_UNITS_H}
          keyword={maxHeightNone ? "none" : null}
          onValueChange={handleMaxHeightChange}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(maxHeight, maxHeightUnit, u, ctx, "height"); fireMaxHHint(maxHeight, maxHeightUnit, c, u, ctx, "height"); setMaxHeight(c); setMaxHeightUnit(u); apply("max-height", c === 0 ? "none" : `${c}${u}`); }}
          onKeywordChange={(k) => { setMaxHeightNone(k === "none"); apply("max-height", k === "none" ? "none" : `${maxHeight}${maxHeightUnit}`); }}
          isModified={isDirty(element, "max-height")}
          supportsNone
          min={0}
          max={1200}
          conversionHint={maxHHint}
        />
      </div>
      {/* Overflow: icon button row */}
      {overflowLocked ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Overflow</span>
          <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflow} onChange={handleOverflowChange} />
          <button onClick={handleOverflowLockToggle} title="Per-axis overflow" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "10px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Over X</span>
            <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflowX} onChange={handleOverflowXChange} />
            <button onClick={handleOverflowLockToggle} title="Lock overflow" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "10px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Over Y</span>
            <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflowY} onChange={handleOverflowYChange} />
          </div>
        </>
      )}
      <div onClick={() => setShowMoreSize(!showMoreSize)} style={{ padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <ChevronRight size={9} strokeWidth={2} style={{ color: "rgba(255,255,255,0.35)", transition: `transform ${ms("expand")}`, transform: showMoreSize ? "rotate(90deg)" : "rotate(0deg)" }} />
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>More size options</span>
      </div>
      {showMoreSize && (
        <>
          <TextRow label="Ratio" value={aspectRatio} placeholder="16 / 9" onChange={handleAspectRatioChange} />
          <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Box Size</span>
            <IconButtonGroup
              options={BOX_SIZING_OPTIONS}
              value={boxSizing}
              onChange={handleBoxSizingChange}
            />
          </div>
          {isMedia && (
            <>
              <SelectRow label="Fit" value={objectFit} options={OBJECT_FIT_OPTIONS} onChange={handleObjectFitChange} />
              <SelectRow label="Obj Pos" value={objectPosition} options={OBJECT_POSITION_OPTIONS} onChange={handleObjectPositionChange} />
            </>
          )}
        </>
      )}
    </Section>
  );
});
