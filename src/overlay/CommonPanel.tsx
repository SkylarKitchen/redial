/**
 * CommonPanel.tsx — Simplified flat-group CSS panel
 *
 * Shows only the most commonly needed controls for the selected element,
 * organized in flat (non-collapsible) groups: Style, Margin, Size,
 * Position (when non-static), and Typography (for text elements).
 */

import { useState, useCallback } from "react";
import { ColorRow, SliderRow, ValueInput } from "./controls";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { applyInlineStyle } from "./apply";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { isAutoSize } from "./getAuthoredValue";
import type { SpacingValues } from "./infer";

// ─── Props ───────────────────────────────────────────────────────────

export interface CommonPanelProps {
  element: Element;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  onDirtyChange?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "label",
  "button", "li", "td", "th", "input", "textarea", "strong", "em",
  "b", "i", "small", "blockquote",
]);

function isTextBearing(el: Element): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  if (el.matches("[role=button], [role=heading], [contenteditable]")) return true;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }
  return false;
}

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ─── FlatGroup ───────────────────────────────────────────────────────

function FlatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2 px-3">
      <div className="text-[10px] font-semibold text-[rgba(0,0,0,0.4)] tracking-wider uppercase mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Value Cell (compact labeled input) ──────────────────────────────

function ValueCell({
  label,
  value,
  onChange,
  keyword,
  onClearKeyword,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  keyword?: string;
  onClearKeyword?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-[rgba(0,0,0,0.35)] w-3.5 text-center shrink-0">
        {label}
      </span>
      {keyword ? (
        <div
          onClick={onClearKeyword}
          className="flex-1 h-[22px] flex items-center justify-center text-[11px] font-mono text-[rgba(0,0,0,0.3)] bg-[rgba(0,0,0,0.03)] rounded-[3px] cursor-pointer select-none"
        >
          {keyword}
        </div>
      ) : (
        <ValueInput value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function CommonPanel({ element, spacing, onSpacingChange, onDirtyChange }: CommonPanelProps) {
  const cs = getComputedStyle(element);

  // --- Style group state ---
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [opacity, setOpacity] = useState(() => Math.round(parseNum(cs.opacity) * 100));
  const [borderRadius, setBorderRadius] = useState(() => parseNum(cs.borderRadius));

  // --- Size group state ---
  const [width, setWidth] = useState(() => parseNum(cs.width));
  const [height, setHeight] = useState(() => parseNum(cs.height));
  const [widthAuto, setWidthAuto] = useState(() => isAutoSize(element, "width"));
  const [heightAuto, setHeightAuto] = useState(() => isAutoSize(element, "height"));

  // --- Position group state ---
  const position = cs.position;
  const showPosition = position !== "static";
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));

  // --- Typography group state ---
  const showTypo = isTextBearing(element);
  const [fontSize, setFontSize] = useState(() => parseNum(cs.fontSize));
  const [fontColor, setFontColor] = useState(() => rgbToHex(cs.color));
  const [fontWeight, setFontWeight] = useState(() => parseNum(cs.fontWeight));

  // --- Spacing units ---
  const SPACING_UNITS = ["px", "%", "em", "rem", "vw", "vh"];
  const [marginUnit, setMarginUnit] = useState("px");
  const [paddingUnit, setPaddingUnit] = useState("px");

  // --- Wrappers ---
  const apply = useCallback(
    (prop: string, value: string) => {
      applyInlineStyle(element, prop, value);
      onDirtyChange?.();
    },
    [element, onDirtyChange],
  );

  return (
    <div>
      {/* ── Style ────────────────────────────────── */}
      <FlatGroup title="Style">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1">
            <ColorRow
              label="Bg"
              value={bgColor}
              onChange={(v) => {
                setBgColor(v);
                apply("background-color", v);
              }}
            />
          </div>
        </div>
        <SliderRow
          label="Opacity"
          value={opacity}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => {
            setOpacity(v);
            apply("opacity", String(v / 100));
          }}
        />
        <SliderRow
          label="Radius"
          value={borderRadius}
          min={0}
          max={100}
          step={1}
          unit="px"
          onChange={(v) => {
            setBorderRadius(v);
            apply("border-radius", `${v}px`);
          }}
        />
      </FlatGroup>

      <div className="border-b border-[rgba(0,0,0,0.04)]" />

      {/* ── Spacing (Webflow box-model diagram) ─── */}
      <FlatGroup title="Spacing">
        <SpacingBoxModel
          margin={spacing.margin}
          padding={spacing.padding}
          onChange={onSpacingChange}
          marginUnit={marginUnit}
          paddingUnit={paddingUnit}
          marginUnits={SPACING_UNITS}
          paddingUnits={SPACING_UNITS}
          onMarginUnitChange={setMarginUnit}
          onPaddingUnitChange={setPaddingUnit}
        />
      </FlatGroup>

      <div className="border-b border-[rgba(0,0,0,0.04)]" />

      {/* ── Size ─────────────────────────────────── */}
      <FlatGroup title="Size">
        <div className="grid grid-cols-2 gap-1.5">
          <ValueCell
            label="W"
            value={width}
            keyword={widthAuto ? "auto" : undefined}
            onClearKeyword={() => {
              setWidthAuto(false);
            }}
            onChange={(v) => {
              setWidth(v);
              setWidthAuto(false);
              apply("width", `${v}px`);
            }}
          />
          <ValueCell
            label="H"
            value={height}
            keyword={heightAuto ? "auto" : undefined}
            onClearKeyword={() => {
              setHeightAuto(false);
            }}
            onChange={(v) => {
              setHeight(v);
              setHeightAuto(false);
              apply("height", `${v}px`);
            }}
          />
        </div>
      </FlatGroup>

      {/* ── Position (conditional) ────────────────── */}
      {showPosition && (
        <>
          <div className="border-b border-[rgba(0,0,0,0.04)]" />
          <FlatGroup title="Position">
            <div className="grid grid-cols-2 gap-1.5">
              <ValueCell
                label="T"
                value={top}
                onChange={(v) => {
                  setTop(v);
                  apply("top", `${v}px`);
                }}
              />
              <ValueCell
                label="R"
                value={right}
                onChange={(v) => {
                  setRight(v);
                  apply("right", `${v}px`);
                }}
              />
              <ValueCell
                label="B"
                value={bottom}
                onChange={(v) => {
                  setBottom(v);
                  apply("bottom", `${v}px`);
                }}
              />
              <ValueCell
                label="L"
                value={left}
                onChange={(v) => {
                  setLeft(v);
                  apply("left", `${v}px`);
                }}
              />
            </div>
          </FlatGroup>
        </>
      )}

      {/* ── Typography (conditional) ──────────────── */}
      {showTypo && (
        <>
          <div className="border-b border-[rgba(0,0,0,0.04)]" />
          <FlatGroup title="Typography">
            <SliderRow
              label="Size"
              value={fontSize}
              min={0}
              max={120}
              step={1}
              unit="px"
              onChange={(v) => {
                setFontSize(v);
                apply("font-size", `${v}px`);
              }}
            />
            <ColorRow
              label="Color"
              value={fontColor}
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
