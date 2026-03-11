/**
 * CommonPanel.tsx — Simplified flat-group CSS panel
 *
 * Shows only the most commonly needed controls for the selected element,
 * organized in flat (non-collapsible) groups: Style, Margin, Size,
 * Position (when non-static), and Typography (for text elements).
 */

import { useState, useCallback, useEffect } from "react";
import { ColorRow, SliderRow, ValueInput } from "./controls";
import { applyInlineStyle } from "./apply";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { hexToRgba } from "./colorUtils";
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
    <div style={{ padding: "8px 12px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.05em",
          textTransform: "uppercase" as const,
          marginBottom: 8,
        }}
      >
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          width: 14,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <ValueInput value={value} onChange={onChange} />
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

  // --- Margin state (from spacing prop) ---
  const [mt, setMt] = useState(spacing.margin.top);
  const [mr, setMr] = useState(spacing.margin.right);
  const [mb, setMb] = useState(spacing.margin.bottom);
  const [ml, setMl] = useState(spacing.margin.left);

  // --- Padding state ---
  const [pt, setPt] = useState(spacing.padding.top);
  const [pr, setPr] = useState(spacing.padding.right);
  const [pb, setPb] = useState(spacing.padding.bottom);
  const [pl, setPl] = useState(spacing.padding.left);

  // Sync spacing from props on re-mount
  useEffect(() => {
    setMt(spacing.margin.top);
    setMr(spacing.margin.right);
    setMb(spacing.margin.bottom);
    setMl(spacing.margin.left);
    setPt(spacing.padding.top);
    setPr(spacing.padding.right);
    setPb(spacing.padding.bottom);
    setPl(spacing.padding.left);
  }, [spacing]);

  // --- Wrappers ---
  const apply = useCallback(
    (prop: string, value: string) => {
      applyInlineStyle(element, prop, value);
      onDirtyChange?.();
    },
    [element, onDirtyChange],
  );

  const applySpacing = useCallback(
    (prop: string, value: number) => {
      onSpacingChange(prop, value, "px");
    },
    [onSpacingChange],
  );

  return (
    <div>
      {/* ── Style ────────────────────────────────── */}
      <FlatGroup title="Style">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
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

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ── Margin ───────────────────────────────── */}
      <FlatGroup title="Margin">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          <ValueCell
            label="T"
            value={mt}
            onChange={(v) => {
              setMt(v);
              applySpacing("margin-top", v);
            }}
          />
          <ValueCell
            label="R"
            value={mr}
            onChange={(v) => {
              setMr(v);
              applySpacing("margin-right", v);
            }}
          />
          <ValueCell
            label="B"
            value={mb}
            onChange={(v) => {
              setMb(v);
              applySpacing("margin-bottom", v);
            }}
          />
          <ValueCell
            label="L"
            value={ml}
            onChange={(v) => {
              setMl(v);
              applySpacing("margin-left", v);
            }}
          />
        </div>
      </FlatGroup>

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ── Padding ──────────────────────────────── */}
      <FlatGroup title="Padding">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          <ValueCell
            label="T"
            value={pt}
            onChange={(v) => {
              setPt(v);
              applySpacing("padding-top", v);
            }}
          />
          <ValueCell
            label="R"
            value={pr}
            onChange={(v) => {
              setPr(v);
              applySpacing("padding-right", v);
            }}
          />
          <ValueCell
            label="B"
            value={pb}
            onChange={(v) => {
              setPb(v);
              applySpacing("padding-bottom", v);
            }}
          />
          <ValueCell
            label="L"
            value={pl}
            onChange={(v) => {
              setPl(v);
              applySpacing("padding-left", v);
            }}
          />
        </div>
      </FlatGroup>

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ── Size ─────────────────────────────────── */}
      <FlatGroup title="Size">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          <ValueCell
            label="W"
            value={width}
            onChange={(v) => {
              setWidth(v);
              apply("width", `${v}px`);
            }}
          />
          <ValueCell
            label="H"
            value={height}
            onChange={(v) => {
              setHeight(v);
              apply("height", `${v}px`);
            }}
          />
        </div>
      </FlatGroup>

      {/* ── Position (conditional) ────────────────── */}
      {showPosition && (
        <>
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} />
          <FlatGroup title="Position">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
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
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} />
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
