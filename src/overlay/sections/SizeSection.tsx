/**
 * SizeSection.tsx — Size section extracted from WebflowPanel.tsx
 *
 * Owns all size-related state: width, height, min/max, overflow,
 * box-sizing, aspect-ratio, object-fit/position.
 */

import React, { useState, useCallback, useMemo, memo } from "react";
import { Section, SelectRow, TextRow } from "../controls";
import { IconButtonGroup } from "../IconButtonGroup";
import { WebflowSegmentedControl } from "../WebflowSegmentedControl";
import { SizeInputCell } from "./SizeInputCell";
import { convertUnit } from "../unitConversion";
import { useConversionHint } from "../hooks/useConversionHint";
import { isDirty, resetProp, resetAndReadNum, resetAndReadStr } from "../core/apply";
import { parseNum } from "../cssParsers";
import { getAuthoredValue, detectUnit, type SectionCtx } from "../panelUtils";
import { isAutoSize } from "../getAuthoredValue";
import { ChevronRight } from "lucide-react";
import { OverflowVisibleIcon, OverflowHiddenIcon, OverflowScrollIcon, MoreDotsIcon, ChevronSmallDownIcon } from "../webflowIcons";
import { ms } from "../timing";
import { text, border, surface, font, layout, indicatorStyle } from "../theme";
import { ROW, LABEL } from "../panelStyles";
import {
  SIZE_UNITS_W, SIZE_UNITS_H,
  CHILDREN_MODE_OPTIONS,
  OBJECT_FIT_OPTIONS, OBJECT_POSITION_OPTIONS,
  BOX_SIZING_OPTIONS,
} from "../panelConstants";
import { discoverLengthVariables } from "../variables/discoverVariables";

// ─── Props ────────────────────────────────────────────────────────────

export interface SizeSectionProps {
  ctx: SectionCtx;
  display: string;
  isMedia: boolean;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export const SizeSection = memo(function SizeSection({ ctx, display, isMedia, forceOpen, focusOpen, onToggle }: SizeSectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu } = ctx;

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));
  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  /** Tailwind-aware step for spacing-scale px properties */
  const twStep = (unit: string) => ctx.isTailwind && unit === "px" ? 4 : 1;

  // ─── CSS variable discovery (length-type only) ─────────────────────

  const varOptions = useMemo(() =>
    discoverLengthVariables(element).map(v => ({ name: v.name, resolvedValue: v.value })),
    [element]
  );

  // ─── Size state ─────────────────────────────────────────────────────

  const [width, setWidth] = useState(() => {
    if (isAutoSize(element, "width")) return 0;
    const authored = getAuthoredValue(element, "width");
    return authored ? parseNum(authored) : parseNum(cs.width);
  });
  const [height, setHeight] = useState(() => {
    if (isAutoSize(element, "height")) return 0;
    const authored = getAuthoredValue(element, "height");
    return authored ? parseNum(authored) : parseNum(cs.height);
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
  const [boxSizing, setBoxSizing] = useState(() => cs.boxSizing || "border-box");
  const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio === "auto" ? "" : cs.aspectRatio);
  const [objectFit, setObjectFit] = useState(() => cs.objectFit);
  const [objectPosition, setObjectPosition] = useState(() => cs.objectPosition);
  const [showMoreSize, setShowMoreSize] = useState(false);

  // Children sizing mode (only relevant for flex/grid containers)
  const [childrenMode, setChildrenMode] = useState<string>(() => {
    const ai = cs.alignItems;
    if (ai === "stretch") return "fill";
    if (ai === "flex-start" || ai === "start") return "fit";
    return "fixed";
  });

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
  const [widthAuto, setWidthAuto] = useState(() => isAutoSize(element, "width"));
  const [heightAuto, setHeightAuto] = useState(() => isAutoSize(element, "height"));
  const [maxWidthNone, setMaxWidthNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-width");
    return !authored || authored === "none";
  });
  const [maxHeightNone, setMaxHeightNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-height");
    return !authored || authored === "none";
  });

  // ─── CSS variable state per property ────────────────────────────────

  const extractVar = (prop: string): string | null => {
    const authored = getAuthoredValue(element, prop);
    return authored?.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
  };

  const [widthVar, setWidthVar] = useState<string | null>(() => extractVar("width"));
  const [heightVar, setHeightVar] = useState<string | null>(() => extractVar("height"));
  const [minWidthVar, setMinWidthVar] = useState<string | null>(() => extractVar("min-width"));
  const [maxWidthVar, setMaxWidthVar] = useState<string | null>(() => extractVar("max-width"));
  const [minHeightVar, setMinHeightVar] = useState<string | null>(() => extractVar("min-height"));
  const [maxHeightVar, setMaxHeightVar] = useState<string | null>(() => extractVar("max-height"));

  const resolveVar = (varName: string | null): string | undefined => {
    if (!varName) return undefined;
    return getComputedStyle(element).getPropertyValue(varName).trim() || undefined;
  };

  // ─── Size handlers ──────────────────────────────────────────────────

  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);
  const handleMinWidthChange = useCallback((v: number) => { setMinWidth(v); apply("min-width", `${v}${minWidthUnit}`); }, [apply, minWidthUnit]);
  const handleMaxWidthChange = useCallback((v: number) => { setMaxWidth(v); apply("max-width", v === 0 ? "none" : `${v}${maxWidthUnit}`); }, [apply, maxWidthUnit]);
  const handleMinHeightChange = useCallback((v: number) => { setMinHeight(v); apply("min-height", `${v}${minHeightUnit}`); }, [apply, minHeightUnit]);
  const handleMaxHeightChange = useCallback((v: number) => { setMaxHeight(v); apply("max-height", v === 0 ? "none" : `${v}${maxHeightUnit}`); }, [apply, maxHeightUnit]);
  const handleOverflowChange = useCallback((v: string) => { setOverflow(v); apply("overflow", v); }, [apply]);
  const handleChildrenModeChange = useCallback((v: string) => {
    setChildrenMode(v);
    if (v === "fill") apply("align-items", "stretch");
    else if (v === "fit") apply("align-items", "flex-start");
    // "fixed" — no-op, children keep explicit sizes
  }, [apply]);
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

  // ─── CSS variable handlers ──────────────────────────────────────────

  const handleWidthVarChange = useCallback((varName: string | null) => {
    setWidthVar(varName);
    if (varName) { setWidthAuto(false); apply("width", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("width")); setWidth(c); apply("width", `${c}${widthUnit}`); }
  }, [apply, element, widthUnit]);

  const handleHeightVarChange = useCallback((varName: string | null) => {
    setHeightVar(varName);
    if (varName) { setHeightAuto(false); apply("height", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("height")); setHeight(c); apply("height", `${c}${heightUnit}`); }
  }, [apply, element, heightUnit]);

  const handleMinWidthVarChange = useCallback((varName: string | null) => {
    setMinWidthVar(varName);
    if (varName) { apply("min-width", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("min-width")); setMinWidth(c); apply("min-width", `${c}${minWidthUnit}`); }
  }, [apply, element, minWidthUnit]);

  const handleMaxWidthVarChange = useCallback((varName: string | null) => {
    setMaxWidthVar(varName);
    if (varName) { setMaxWidthNone(false); apply("max-width", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("max-width")); setMaxWidth(c); apply("max-width", c === 0 ? "none" : `${c}${maxWidthUnit}`); }
  }, [apply, element, maxWidthUnit]);

  const handleMinHeightVarChange = useCallback((varName: string | null) => {
    setMinHeightVar(varName);
    if (varName) { apply("min-height", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("min-height")); setMinHeight(c); apply("min-height", `${c}${minHeightUnit}`); }
  }, [apply, element, minHeightUnit]);

  const handleMaxHeightVarChange = useCallback((varName: string | null) => {
    setMaxHeightVar(varName);
    if (varName) { setMaxHeightNone(false); apply("max-height", `var(${varName})`); }
    else { const c = parseNum(getComputedStyle(element).getPropertyValue("max-height")); setMaxHeight(c); apply("max-height", c === 0 ? "none" : `${c}${maxHeightUnit}`); }
  }, [apply, element, maxHeightUnit]);

  // ─── JSX ────────────────────────────────────────────────────────────

  return (
    <Section title="Size" indicator={sectionInd(["width", "height", "min-width", "max-width", "min-height", "max-height", "overflow", "align-items", "aspect-ratio", "box-sizing", "object-fit", "object-position"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>
      {/* Row 1: Width + Height */}
      <div style={{ ...ROW, gap: layout.compactGap }}>
        <SizeInputCell
          label="Width"
          value={width}
          unit={widthUnit}
          units={SIZE_UNITS_W}
          keyword={widthAuto ? "auto" : null}
          onValueChange={handleWidthChange}
          onUnitChange={(u) => { if (widthVar) setWidthVar(null); const ctx = getConversionCtx(); const c = convertUnit(width, widthUnit, u, ctx, "width"); fireWHint(width, widthUnit, c, u, ctx, "width"); setWidth(c); setWidthUnit(u); apply("width", `${c}${u}`); }}
          onKeywordChange={(k) => { if (widthVar) setWidthVar(null); setWidthAuto(k === "auto"); apply("width", k === "auto" ? "auto" : `${width}${widthUnit}`); }}
          isModified={isDirty(element, "width")}
          supportsAuto
          min={0}
          max={1920}
          step={twStep(widthUnit)}
          conversionHint={wHint}

          cssVar={widthVar}
          cssVarResolved={resolveVar(widthVar)}
          onCssVarChange={handleWidthVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("width", setWidth); setWidthAuto(isAutoSize(element, "width")); setWidthVar(null); }}
        />
        <SizeInputCell
          label="Height"
          value={height}
          unit={heightUnit}
          units={SIZE_UNITS_H}
          keyword={heightAuto ? "auto" : null}
          onValueChange={handleHeightChange}
          onUnitChange={(u) => { if (heightVar) setHeightVar(null); const ctx = getConversionCtx(); const c = convertUnit(height, heightUnit, u, ctx, "height"); fireHHint(height, heightUnit, c, u, ctx, "height"); setHeight(c); setHeightUnit(u); apply("height", `${c}${u}`); }}
          onKeywordChange={(k) => { if (heightVar) setHeightVar(null); setHeightAuto(k === "auto"); apply("height", k === "auto" ? "auto" : `${height}${heightUnit}`); }}
          isModified={isDirty(element, "height")}
          supportsAuto
          min={0}
          max={1200}
          step={twStep(heightUnit)}
          conversionHint={hHint}
          cssVar={heightVar}
          cssVarResolved={resolveVar(heightVar)}
          onCssVarChange={handleHeightVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("height", setHeight); setHeightAuto(isAutoSize(element, "height")); setHeightVar(null); }}
        />
      </div>
      {/* Row 2: Min W + Min H */}
      <div style={{ ...ROW, gap: layout.compactGap }}>
        <SizeInputCell
          label="Min W"
          value={minWidth}
          unit={minWidthUnit}
          units={SIZE_UNITS_W}

          onValueChange={handleMinWidthChange}
          onUnitChange={(u) => { if (minWidthVar) setMinWidthVar(null); const ctx = getConversionCtx(); const c = convertUnit(minWidth, minWidthUnit, u, ctx, "width"); fireMinWHint(minWidth, minWidthUnit, c, u, ctx, "width"); setMinWidth(c); setMinWidthUnit(u); apply("min-width", `${c}${u}`); }}
          isModified={isDirty(element, "min-width")}
          min={0}
          max={1920}
          step={twStep(minWidthUnit)}
          conversionHint={minWHint}
          cssVar={minWidthVar}
          cssVarResolved={resolveVar(minWidthVar)}
          onCssVarChange={handleMinWidthVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("min-width", setMinWidth); setMinWidthVar(null); }}
        />
        <SizeInputCell
          label="Min H"
          value={minHeight}
          unit={minHeightUnit}
          units={SIZE_UNITS_H}

          onValueChange={handleMinHeightChange}
          onUnitChange={(u) => { if (minHeightVar) setMinHeightVar(null); const ctx = getConversionCtx(); const c = convertUnit(minHeight, minHeightUnit, u, ctx, "height"); fireMinHHint(minHeight, minHeightUnit, c, u, ctx, "height"); setMinHeight(c); setMinHeightUnit(u); apply("min-height", `${c}${u}`); }}
          isModified={isDirty(element, "min-height")}
          min={0}
          max={1200}
          step={twStep(minHeightUnit)}
          conversionHint={minHHint}
          cssVar={minHeightVar}
          cssVarResolved={resolveVar(minHeightVar)}
          onCssVarChange={handleMinHeightVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("min-height", setMinHeight); setMinHeightVar(null); }}
        />
      </div>
      {/* Row 3: Max W + Max H */}
      <div style={{ ...ROW, gap: layout.compactGap }}>
        <SizeInputCell
          label="Max W"
          value={maxWidth}
          unit={maxWidthUnit}
          units={SIZE_UNITS_W}
          keyword={maxWidthNone ? "none" : null}
          onValueChange={handleMaxWidthChange}
          onUnitChange={(u) => { if (maxWidthVar) setMaxWidthVar(null); const ctx = getConversionCtx(); const c = convertUnit(maxWidth, maxWidthUnit, u, ctx, "width"); fireMaxWHint(maxWidth, maxWidthUnit, c, u, ctx, "width"); setMaxWidth(c); setMaxWidthUnit(u); apply("max-width", c === 0 ? "none" : `${c}${u}`); }}
          onKeywordChange={(k) => { if (maxWidthVar) setMaxWidthVar(null); setMaxWidthNone(k === "none"); apply("max-width", k === "none" ? "none" : `${maxWidth}${maxWidthUnit}`); }}
          isModified={isDirty(element, "max-width")}
          supportsNone
          min={0}
          max={1920}
          step={twStep(maxWidthUnit)}
          conversionHint={maxWHint}
          cssVar={maxWidthVar}
          cssVarResolved={resolveVar(maxWidthVar)}
          onCssVarChange={handleMaxWidthVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("max-width", setMaxWidth); setMaxWidthNone(true); setMaxWidthVar(null); }}
        />
        <SizeInputCell
          label="Max H"
          value={maxHeight}
          unit={maxHeightUnit}
          units={SIZE_UNITS_H}
          keyword={maxHeightNone ? "none" : null}
          onValueChange={handleMaxHeightChange}
          onUnitChange={(u) => { if (maxHeightVar) setMaxHeightVar(null); const ctx = getConversionCtx(); const c = convertUnit(maxHeight, maxHeightUnit, u, ctx, "height"); fireMaxHHint(maxHeight, maxHeightUnit, c, u, ctx, "height"); setMaxHeight(c); setMaxHeightUnit(u); apply("max-height", c === 0 ? "none" : `${c}${u}`); }}
          onKeywordChange={(k) => { if (maxHeightVar) setMaxHeightVar(null); setMaxHeightNone(k === "none"); apply("max-height", k === "none" ? "none" : `${maxHeight}${maxHeightUnit}`); }}
          isModified={isDirty(element, "max-height")}
          supportsNone
          min={0}
          max={1200}
          step={twStep(maxHeightUnit)}
          conversionHint={maxHHint}
          cssVar={maxHeightVar}
          cssVarResolved={resolveVar(maxHeightVar)}
          onCssVarChange={handleMaxHeightVarChange}
          variableOptions={varOptions}
          onReset={() => { resetCss("max-height", setMaxHeight); setMaxHeightNone(true); setMaxHeightVar(null); }}
        />
      </div>
      {/* Overflow: Webflow segmented control */}
      <div style={ROW}>
        <span style={{ ...LABEL, cursor: "default" }}>
          Overflow
        </span>
        <WebflowSegmentedControl
          options={[
            { value: "visible", icon: <OverflowVisibleIcon size={16} />, title: "Visible" },
            { value: "hidden", icon: <OverflowHiddenIcon size={16} />, title: "Hidden" },
            { value: "scroll", icon: <OverflowScrollIcon size={16} />, title: "Scroll" },
            { value: "auto", label: "Auto", title: "Auto" },
          ]}
          value={overflow}
          onChange={handleOverflowChange}
          aria-label="Overflow"
        />
      </div>
      {/* Children: sizing mode for flex/grid containers */}
      {(display === "flex" || display === "grid" || display === "inline-flex" || display === "inline-grid") && (
        <div style={ROW}>
          <span style={{ ...LABEL, cursor: "default" }}>
            Children
          </span>
          {/* Webflow-style select dropdown */}
          <div
            style={{
              flex: 1,
              position: "relative",
              height: 24,
              background: surface.subtle,
              borderRadius: 4,
            }}
          >
            <select
              value={childrenMode}
              onChange={(e) => handleChildrenModeChange(e.target.value)}
              style={{
                width: "100%",
                height: "100%",
                WebkitAppearance: "none" as any,
                appearance: "none" as any,
                cursor: "pointer",
                background: "transparent",
                fontSize: 11.5,
                letterSpacing: "-0.115px",
                color: text.primary,
                fontFamily: font.sans,
                paddingLeft: 8,
                paddingRight: 24,
                border: "none",
                outline: "none",
                boxShadow: "none",
              }}
            >
              {CHILDREN_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span
              style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: text.label }}
            >
              <ChevronSmallDownIcon size={16} />
            </span>
          </div>
          {/* More options button */}
          <button
            onClick={() => setShowMoreSize(!showMoreSize)}
            title="More size options"
            style={{
              width: 24,
              height: 24,
              background: surface.subtle,
              borderRadius: 4,
              border: "none",
              color: text.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              outline: "none",
            }}
          >
            <MoreDotsIcon size={16} />
          </button>
        </div>
      )}
      <div onClick={() => setShowMoreSize(!showMoreSize)} style={{ padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, borderTop: `1px solid ${border.subtle}` }}>
        <ChevronRight size={9} strokeWidth={2} style={{ color: text.label, transition: `transform ${ms("expand")}`, transform: showMoreSize ? "rotate(90deg)" : "rotate(0deg)" }} />
        <span style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: text.label }}>More size options</span>
      </div>
      {showMoreSize && (
        <>
          <TextRow label="Aspect" value={aspectRatio} placeholder="16 / 9" onChange={handleAspectRatioChange} onContextMenu={ctxMenu("aspect-ratio", aspectRatio || "auto")} computedProp="aspect-ratio" computedElement={element} indicator={ind("aspect-ratio")} onReset={() => resetCssStr("aspect-ratio", setAspectRatio)} />
          <div style={ROW}>
            <span style={{ ...LABEL }}>
              <span style={indicatorStyle(ind("box-sizing"))}>Box Size</span>
            </span>
            <IconButtonGroup
              options={BOX_SIZING_OPTIONS}
              value={boxSizing}
              onChange={handleBoxSizingChange}
            />
          </div>
          {isMedia && (
            <>
              <SelectRow label="Fit" value={objectFit} options={OBJECT_FIT_OPTIONS} onChange={handleObjectFitChange} onContextMenu={ctxMenu("object-fit", objectFit)} computedProp="object-fit" computedElement={element} onReset={() => resetCssStr("object-fit", setObjectFit)} />
              <SelectRow label="Obj Position" value={objectPosition} options={OBJECT_POSITION_OPTIONS} onChange={handleObjectPositionChange} onContextMenu={ctxMenu("object-position", objectPosition)} computedProp="object-position" computedElement={element} onReset={() => resetCssStr("object-position", setObjectPosition)} />
            </>
          )}
        </>
      )}
    </Section>
  );
});
