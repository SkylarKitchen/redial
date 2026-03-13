/**
 * CommonPanel.tsx — Simplified flat-group CSS panel
 *
 * Shows only the most commonly needed controls for the selected element,
 * organized in flat (non-collapsible) groups: Style, Margin, Size,
 * Position (when non-static), and Typography (for text elements).
 */

import { useState, useCallback, useMemo } from "react";
import { ColorRow, SliderRow } from "./controls";
import { SizeInputCell } from "./SizeInputCell";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { applyInlineStyle, beginBatch, endBatch, isDirty } from "./apply";
import { applyClassStyle, type Scope } from "./scope";
import { applyStateStyle } from "./statePreview";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { isAutoSize } from "./getAuthoredValue";
import { detectUnit, isTextBearing, getIndicatorType } from "./panelUtils";
import { parseNum } from "./cssParsers";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";
import { scanTextStyles, matchTextStyle, type TextStyle } from "./textStyleScanner";
import { TextStyleRow } from "./TextStyleRow";
import { SIZE_UNITS_W, SIZE_UNITS_H, POSITION_UNITS, TYPO_SIZE_UNITS, BORDER_UNITS } from "./panelConstants";
import { convertUnit, buildConversionContext } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import type { SpacingValues } from "./infer";

// ─── Props ───────────────────────────────────────────────────────────

export interface CommonPanelProps {
  element: Element;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  onDirtyChange?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
  /** Active pseudo-class state ("none" = base, "hover", "focus", etc.) */
  activeState?: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const SP_UNITS = ["px", "%", "em", "rem", "vw", "vh"];

// ─── FlatGroup ───────────────────────────────────────────────────────

function FlatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="text-[10px] font-semibold text-[var(--muted-foreground)] tracking-wider uppercase mb-2 px-3">
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function CommonPanel({ element, spacing, onSpacingChange, onDirtyChange, scope = "element", activeClassName, activeState = "none" }: CommonPanelProps) {
  const cs = getComputedStyle(element);
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);
  const ind = useCallback((prop: string) => getIndicatorType(element, prop, cs), [element, cs]);

  // --- Style group state ---
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [opacity, setOpacity] = useState(() => Math.round(parseNum(cs.opacity) * 100));
  const [borderRadius, setBorderRadius] = useState(() => parseNum(cs.borderRadius));
  const [radiusUnit, setRadiusUnit] = useState(() => detectUnit(element, "border-radius"));
  const { conversionHint: radiusHint, fireConversionHint: fireRadiusHint } = useConversionHint();

  // --- Contextual visibility: only show rows with non-default values ---
  const showBg = bgColor !== "transparent";
  const showOpacity = opacity < 100;
  const showRadius = borderRadius > 0;
  const showStyle = showBg || showOpacity || showRadius;

  const isDiv = element.tagName.toLowerCase() === "div";
  const hasSpacing =
    isDiv ||
    spacing.margin.top !== 0 || spacing.margin.right !== 0 ||
    spacing.margin.bottom !== 0 || spacing.margin.left !== 0 ||
    spacing.padding.top !== 0 || spacing.padding.right !== 0 ||
    spacing.padding.bottom !== 0 || spacing.padding.left !== 0;

  // --- Size group state ---
  const [width, setWidth] = useState(() => isAutoSize(element, "width") ? 0 : parseNum(cs.width));
  const [height, setHeight] = useState(() => isAutoSize(element, "height") ? 0 : parseNum(cs.height));
  const [widthAuto, setWidthAuto] = useState(() => isAutoSize(element, "width"));
  const [heightAuto, setHeightAuto] = useState(() => isAutoSize(element, "height"));
  const [widthUnit, setWidthUnit] = useState(() => detectUnit(element, "width"));
  const [heightUnit, setHeightUnit] = useState(() => detectUnit(element, "height"));
  const { conversionHint: wHint, fireConversionHint: fireWHint } = useConversionHint();
  const { conversionHint: hHint, fireConversionHint: fireHHint } = useConversionHint();
  const showSize = !widthAuto || !heightAuto;

  // --- Position group state ---
  const position = cs.position;
  const showPosition = position !== "static";
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));
  const [topUnit, setTopUnit] = useState(() => detectUnit(element, "top"));
  const [leftUnit, setLeftUnit] = useState(() => detectUnit(element, "left"));
  const [rightUnit, setRightUnit] = useState(() => detectUnit(element, "right"));
  const [bottomUnit, setBottomUnit] = useState(() => detectUnit(element, "bottom"));
  const { conversionHint: topHint, fireConversionHint: fireTopHint } = useConversionHint();
  const { conversionHint: leftHint, fireConversionHint: fireLeftHint } = useConversionHint();
  const { conversionHint: rightHint, fireConversionHint: fireRightHint } = useConversionHint();
  const { conversionHint: bottomHint, fireConversionHint: fireBottomHint } = useConversionHint();

  // --- Typography group state ---
  const showTypo = isTextBearing(element);
  const [fontSize, setFontSize] = useState(() => parseNum(cs.fontSize));
  const [fontColor, setFontColor] = useState(() => rgbToHex(cs.color));
  const [fontWeight, setFontWeight] = useState(() => parseNum(cs.fontWeight));
  const [fontSizeUnit, setFontSizeUnit] = useState(() => detectUnit(element, "font-size"));
  const { conversionHint: fontSizeHint, fireConversionHint: fireFontSizeHint } = useConversionHint();

  // --- Text style scanning ---
  const textStyles = useMemo(() => scanTextStyles(), []);
  const matchedTextStyle = useMemo(
    () => matchTextStyle(element, cs, textStyles),
    [element, cs, textStyles],
  );

  // --- Spacing units ---
  const [marginUnit, setMarginUnit] = useState("px");
  const [paddingUnit, setPaddingUnit] = useState("px");

  // --- Wrappers ---
  const apply = useCallback(
    (prop: string, value: string) => {
      if (activeState !== "none") {
        applyStateStyle(element, activeState, prop, value);
        onDirtyChange?.();
        return;
      }
      if (scope === "class" && activeClassName) {
        applyClassStyle(activeClassName, prop, value);
      }
      applyInlineStyle(element, prop, value);
      onDirtyChange?.();
    },
    [element, onDirtyChange, scope, activeClassName, activeState],
  );

  // --- Size handlers ---
  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);

  // --- Position handlers ---
  const handleTopChange = useCallback((v: number) => { setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);

  const handleTextStyleApply = useCallback((style: TextStyle) => {
    beginBatch();
    apply("font-family", style.fontFamily);
    apply("font-weight", style.fontWeight);
    apply("font-size", style.fontSize);
    apply("line-height", style.lineHeight);
    apply("letter-spacing", style.letterSpacing);
    apply("color", style.color);
    apply("text-transform", style.textTransform);
    endBatch();

    setFontSize(parseNum(style.fontSize));
    setFontColor(rgbToHex(style.color));
    setFontWeight(parseNum(style.fontWeight));
  }, [apply]);

  return (
    <div>
      {/* ── Style (only if any row has a non-default value) ── */}
      {showStyle && (
        <FlatGroup title="Style">
          {showBg && (
            <div className="mb-1">
              <ColorRow
                label="Bg"
                value={bgColor}
                computedProp="background-color"
                computedElement={element}
                onChange={(v) => {
                  setBgColor(v);
                  apply("background-color", v);
                }}
              />
            </div>
          )}
          {showOpacity && (
            <SliderRow
              label="Opacity"
              value={opacity}
              min={0}
              max={100}
              step={1}
              unit="%"
              computedProp="opacity"
              computedElement={element}
              onChange={(v) => {
                setOpacity(v);
                apply("opacity", String(v / 100));
              }}
            />
          )}
          {showRadius && (
            <SliderRow
              label="Radius"
              value={borderRadius}
              min={0}
              max={100}
              step={4}
              unit={radiusUnit}
              units={BORDER_UNITS}
              onUnitChange={(u) => {
                const ctx = getConversionCtx();
                const c = convertUnit(borderRadius, radiusUnit, u, ctx, "width");
                fireRadiusHint(borderRadius, radiusUnit, c, u, ctx, "width");
                setBorderRadius(c);
                setRadiusUnit(u);
                apply("border-radius", `${c}${u}`);
              }}
              conversionHint={radiusHint}
              computedProp="border-radius"
              computedElement={element}
              onChange={(v) => {
                setBorderRadius(v);
                apply("border-radius", `${v}${radiusUnit}`);
              }}
            />
          )}
        </FlatGroup>
      )}

      {showStyle && <div className="border-b border-[var(--border)]" />}

      {/* ── Spacing (only if any margin/padding is non-zero) ── */}
      {hasSpacing && (
        <FlatGroup title="Spacing">
          <div className="px-3">
          <SpacingBoxModel
            margin={spacing.margin}
            padding={spacing.padding}
            onChange={onSpacingChange}
            marginUnit={marginUnit}
            paddingUnit={paddingUnit}
            marginUnits={SP_UNITS}
            paddingUnits={SP_UNITS}
            onMarginUnitChange={setMarginUnit}
            onPaddingUnitChange={setPaddingUnit}
            element={element}
            ind={ind}
          />
          </div>
        </FlatGroup>
      )}

      {hasSpacing && <div className="border-b border-[var(--border)]" />}

      {/* ── Size (only if explicit dimensions are set) ──────── */}
      {showSize && (
        <FlatGroup title="Size">
          <div className="flex gap-1 px-3">
            <SizeInputCell
              label="W"
              value={width}
              unit={widthUnit}
              units={SIZE_UNITS_W}
              keyword={widthAuto ? "auto" : null}
              onValueChange={handleWidthChange}
              onUnitChange={(u) => {
                const ctx = getConversionCtx();
                const c = convertUnit(width, widthUnit, u, ctx, "width");
                fireWHint(width, widthUnit, c, u, ctx, "width");
                setWidth(c); setWidthUnit(u);
                apply("width", `${c}${u}`);
              }}
              onKeywordChange={(k) => {
                setWidthAuto(k === "auto");
                apply("width", k === "auto" ? "auto" : `${width}${widthUnit}`);
              }}
              isModified={isDirty(element, "width")}
              supportsAuto
              min={0}
              max={1920}
              conversionHint={wHint}
            />
            <SizeInputCell
              label="H"
              value={height}
              unit={heightUnit}
              units={SIZE_UNITS_H}
              keyword={heightAuto ? "auto" : null}
              onValueChange={handleHeightChange}
              onUnitChange={(u) => {
                const ctx = getConversionCtx();
                const c = convertUnit(height, heightUnit, u, ctx, "height");
                fireHHint(height, heightUnit, c, u, ctx, "height");
                setHeight(c); setHeightUnit(u);
                apply("height", `${c}${u}`);
              }}
              onKeywordChange={(k) => {
                setHeightAuto(k === "auto");
                apply("height", k === "auto" ? "auto" : `${height}${heightUnit}`);
              }}
              isModified={isDirty(element, "height")}
              supportsAuto
              min={0}
              max={1200}
              conversionHint={hHint}
            />
          </div>
        </FlatGroup>
      )}

      {/* ── Position (conditional) ────────────────── */}
      {showPosition && (
        <>
          <div className="border-b border-[var(--border)]" />
          <FlatGroup title="Position">
            <div className="flex gap-1 px-3 py-0.5">
              <SizeInputCell
                label="Top"
                value={top}
                unit={topUnit}
                units={POSITION_UNITS}

                onValueChange={handleTopChange}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(top, topUnit, u, ctx, "height");
                  fireTopHint(top, topUnit, c, u, ctx, "height");
                  setTop(c); setTopUnit(u);
                  apply("top", `${c}${u}`);
                }}

                isModified={isDirty(element, "top")}
                min={-9999}
                max={9999}
                conversionHint={topHint}
              />
              <SizeInputCell
                label="Right"
                value={right}
                unit={rightUnit}
                units={POSITION_UNITS}

                onValueChange={handleRightChange}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(right, rightUnit, u, ctx, "width");
                  fireRightHint(right, rightUnit, c, u, ctx, "width");
                  setRight(c); setRightUnit(u);
                  apply("right", `${c}${u}`);
                }}

                isModified={isDirty(element, "right")}
                min={-9999}
                max={9999}
                conversionHint={rightHint}
              />
            </div>
            <div className="flex gap-1 px-3 py-0.5">
              <SizeInputCell
                label="Bottom"
                value={bottom}
                unit={bottomUnit}
                units={POSITION_UNITS}

                onValueChange={handleBottomChange}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(bottom, bottomUnit, u, ctx, "height");
                  fireBottomHint(bottom, bottomUnit, c, u, ctx, "height");
                  setBottom(c); setBottomUnit(u);
                  apply("bottom", `${c}${u}`);
                }}

                isModified={isDirty(element, "bottom")}
                min={-9999}
                max={9999}
                conversionHint={bottomHint}
              />
              <SizeInputCell
                label="Left"
                value={left}
                unit={leftUnit}
                units={POSITION_UNITS}

                onValueChange={handleLeftChange}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(left, leftUnit, u, ctx, "width");
                  fireLeftHint(left, leftUnit, c, u, ctx, "width");
                  setLeft(c); setLeftUnit(u);
                  apply("left", `${c}${u}`);
                }}

                isModified={isDirty(element, "left")}
                min={-9999}
                max={9999}
                conversionHint={leftHint}
              />
            </div>
          </FlatGroup>
        </>
      )}

      {/* ── Typography (conditional) ──────────────── */}
      {showTypo && (
        <>
          <div className="border-b border-[var(--border)]" />
          <FlatGroup title="Typography">
            <TextStyleRow styles={textStyles} matchedStyle={matchedTextStyle} onApply={handleTextStyleApply} />
            <SliderRow
              label="Size"
              value={fontSize}
              min={0}
              max={120}
              step={1}
              unit={fontSizeUnit}
              units={TYPO_SIZE_UNITS}
              onUnitChange={(u) => {
                const ctx = getConversionCtx();
                const c = convertUnit(fontSize, fontSizeUnit, u, ctx, "width");
                fireFontSizeHint(fontSize, fontSizeUnit, c, u, ctx, "width");
                setFontSize(c);
                setFontSizeUnit(u);
                apply("font-size", `${c}${u}`);
              }}
              conversionHint={fontSizeHint}
              computedProp="font-size"
              computedElement={element}
              onChange={(v) => {
                setFontSize(v);
                apply("font-size", `${v}${fontSizeUnit}`);
              }}
            />
            <ColorRow
              label="Color"
              value={fontColor}
              computedProp="color"
              computedElement={element}
              onChange={(v) => {
                setFontColor(v);
                apply("color", v);
              }}
            />
            <SliderRow
              label="Weight"
              value={fontWeight}
              min={100}
              max={900}
              step={100}
              unit=""
              computedProp="font-weight"
              computedElement={element}
              onChange={(v) => {
                setFontWeight(v);
                apply("font-weight", String(v));
              }}
            />
          </FlatGroup>
        </>
      )}
    </div>
  );
}
