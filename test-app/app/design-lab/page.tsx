"use client";

/**
 * Design Lab — 5 panel consistency variations
 *
 * Each variant applies a unified style system to the same set of controls:
 * Section header, slider row, select dropdown, color input, icon buttons, sub-section.
 * Compare side-by-side to evaluate which approach feels most cohesive.
 */

import React, { useState } from "react";

// ─── Shared Types ──────────────────────────────────────────────────

interface VariantProps {
  name: string;
  description: string;
}

// ─── Tokens (imported from Redial's actual theme.ts values) ────────

const T = {
  bg: "#FFFFFF",
  fg: "#171717",
  fgSecondary: "#404040",
  fgLabel: "#525252",
  fgDisabled: "#737373",
  fgHint: "#A3A3A3",
  primary: "#3B82F6",
  primaryHover: "#2563EB",
  destructive: "#ef4444",
  popover: "#F5F5F5",
  borderDefault: "rgba(0,0,0,0.10)",
  borderSubtle: "rgba(0,0,0,0.06)",
  borderHover: "rgba(0,0,0,0.18)",
  borderStrong: "rgba(0,0,0,0.30)",
  surfaceHover: "rgba(0,0,0,0.05)",
  surfaceActive: "rgba(0,0,0,0.08)",
  surfaceSubtle: "rgba(0,0,0,0.04)",
  surfaceTrack: "rgba(0,0,0,0.12)",
  inputBg: "rgba(0,0,0,0.04)",
  ring: "rgba(59,130,246,0.3)",
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', monospace",
  shadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)",
} as const;

// ─── Chevron Icon ──────────────────────────────────────────────────

function Chevron({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 150ms ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Indicator Dot ─────────────────────────────────────────────────

function Dot({ color, size = 5 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Mini Slider ───────────────────────────────────────────────────

function MiniSlider({
  value,
  trackColor = T.surfaceTrack,
  fillColor = T.primary,
  height = 3,
  borderRadius = 1.5,
}: {
  value: number;
  trackColor?: string;
  fillColor?: string;
  height?: number;
  borderRadius?: number;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      style={{
        flex: 1,
        height,
        borderRadius,
        background: `linear-gradient(to right, ${fillColor} ${pct}%, ${trackColor} ${pct}%)`,
        cursor: "ew-resize",
      }}
    />
  );
}

// ─── Icon Button ───────────────────────────────────────────────────

function IconBtn({
  active,
  children,
  size = 28,
  borderRadius = 4,
  bgActive = T.surfaceActive,
  colorActive = T.primary,
  colorDefault = T.fgDisabled,
  hoverBg = T.surfaceHover,
}: {
  active?: boolean;
  children: React.ReactNode;
  size?: number;
  borderRadius?: number;
  bgActive?: string;
  colorActive?: string;
  colorDefault?: string;
  hoverBg?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius,
        cursor: "pointer",
        background: active ? bgActive : hovered ? hoverBg : "transparent",
        color: active ? colorActive : hovered ? T.fgLabel : colorDefault,
        transition: "background 80ms, color 80ms",
        padding: 0,
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

// ─── Color Swatch ──────────────────────────────────────────────────

function ColorSwatch({
  color,
  size = 24,
  borderRadius = 4,
}: {
  color: string;
  size?: number;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: color,
        border: `1px solid ${T.borderDefault}`,
        cursor: "pointer",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Value Input ───────────────────────────────────────────────────

function ValueInput({
  value,
  unit,
  width = 40,
  fontSize = 11,
  fontFamily = T.fontMono,
  bg = T.inputBg,
  border = T.borderDefault,
  borderRadius = 4,
  height = 24,
  textAlign = "center" as const,
}: {
  value: string;
  unit?: string;
  width?: number;
  fontSize?: number;
  fontFamily?: string;
  bg?: string;
  border?: string;
  borderRadius?: number;
  height?: number;
  textAlign?: "center" | "left" | "right";
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      <input
        readOnly
        value={value}
        style={{
          width,
          height,
          fontSize,
          fontFamily,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: unit ? `${borderRadius}px 0 0 ${borderRadius}px` : borderRadius,
          textAlign,
          color: T.fg,
          outline: "none",
          padding: "0 4px",
          WebkitFontSmoothing: "antialiased",
        }}
      />
      {unit && (
        <span
          style={{
            height,
            display: "flex",
            alignItems: "center",
            padding: "0 5px",
            fontSize: 9,
            fontFamily: T.fontMono,
            color: T.fgHint,
            background: bg,
            border: `1px solid ${border}`,
            borderLeft: "none",
            borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

// ─── Select ────────────────────────────────────────────────────────

function MiniSelect({
  value,
  width,
  fontSize = 11,
  bg = T.inputBg,
  border = T.borderDefault,
  borderRadius = 4,
  height = 24,
}: {
  value: string;
  width?: number;
  fontSize?: number;
  bg?: string;
  border?: string;
  borderRadius?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 6px",
        fontSize,
        fontFamily: T.fontSans,
        color: T.fg,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius,
        cursor: "pointer",
        minWidth: width || "auto",
        flex: width ? undefined : 1,
        gap: 4,
        userSelect: "none",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={T.fgHint} strokeWidth={2.5} strokeLinecap="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT 1: Strict Token Grid
// Every value from theme.ts, all inline styles, precise pixel grid.
// ═══════════════════════════════════════════════════════════════════

function Variant1() {
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);

  const label: React.CSSProperties = {
    width: 64,
    fontSize: 11,
    fontFamily: T.fontSans,
    color: T.fgLabel,
    flexShrink: 0,
    userSelect: "none",
    cursor: "ew-resize",
    lineHeight: "24px",
    WebkitFontSmoothing: "antialiased",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 12px",
    minHeight: 28,
  };

  return (
    <div style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg, WebkitFontSmoothing: "antialiased" }}>
      {/* Section header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "10px 12px 6px",
          position: "sticky",
          top: 0,
          background: T.bg,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          Typography
          <Dot color={T.primary} />
        </span>
        <span style={{ color: T.fgHint }}><Chevron open={open} /></span>
      </div>

      {open && (
        <div style={{ paddingBottom: 8 }}>
          {/* Font family row */}
          <div style={row}>
            <span style={label}>Font</span>
            <MiniSelect value="Inter" />
          </div>

          {/* Weight row */}
          <div style={row}>
            <span style={label}>Weight</span>
            <MiniSelect value="Medium · 500" width={120} />
          </div>

          {/* Size / Height row */}
          <div style={row}>
            <span style={label}>Size</span>
            <ValueInput value="16" unit="px" />
            <span style={{ ...label, width: "auto", marginLeft: 4 }}>Height</span>
            <ValueInput value="1.5" unit="—" />
          </div>

          {/* Color row */}
          <div style={row}>
            <span style={label}>Color</span>
            <ColorSwatch color="#171717" />
            <ValueInput value="#171717" width={64} />
          </div>

          {/* Alignment icons */}
          <div style={row}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 1, background: T.surfaceSubtle, borderRadius: 4, padding: 1 }}>
              <IconBtn active>L</IconBtn>
              <IconBtn>C</IconBtn>
              <IconBtn>R</IconBtn>
              <IconBtn>J</IconBtn>
            </div>
          </div>

          {/* Decoration icons */}
          <div style={row}>
            <span style={label}>Decor</span>
            <div style={{ display: "flex", gap: 1 }}>
              <IconBtn>U</IconBtn>
              <IconBtn>S</IconBtn>
              <IconBtn active>—</IconBtn>
            </div>
          </div>

          {/* Slider — Opacity */}
          <div style={row}>
            <span style={label}>Spacing</span>
            <MiniSlider value={20} />
            <ValueInput value="0.2" unit="em" />
          </div>

          {/* Sub-section: More type options */}
          <div
            onClick={() => setSubOpen(!subOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px 4px",
              cursor: "pointer",
              background: T.bg,
            }}
          >
            <span style={{ fontSize: 11, color: T.fgSecondary, fontWeight: 500 }}>More type options</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ color: T.fgHint }}><Chevron open={subOpen} size={10} /></span>
            </div>
          </div>

          {subOpen && (
            <>
              <div style={row}>
                <span style={label}>Indent</span>
                <ValueInput value="0" unit="px" />
              </div>
              <div style={row}>
                <span style={label}>Columns</span>
                <ValueInput value="1" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Section divider */}
      <div style={{ height: 1, background: T.borderSubtle, margin: "0 12px" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT 2: Webflow Exact
// Measured from actual Webflow. Thinner borders, specific padding.
// ═══════════════════════════════════════════════════════════════════

function Variant2() {
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);

  // Webflow uses slightly different metrics
  const label: React.CSSProperties = {
    width: 72,
    fontSize: 11,
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    color: "#999",
    flexShrink: 0,
    userSelect: "none",
    cursor: "ew-resize",
    lineHeight: "22px",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 16px",
    minHeight: 26,
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", fontSize: 12, color: "#333" }}>
      {/* Webflow section header — all caps, smaller */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "12px 16px 8px",
          borderBottom: open ? "none" : "1px solid #eee",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
          Typography
          <Dot color="#4353FF" size={4} />
        </span>
        <span style={{ color: "#bbb" }}><Chevron open={open} /></span>
      </div>

      {open && (
        <div style={{ paddingBottom: 6 }}>
          <div style={row}>
            <span style={label}>Font</span>
            <MiniSelect value="Inter" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} fontSize={11} />
          </div>

          <div style={row}>
            <span style={label}>Weight</span>
            <MiniSelect value="Medium · 500" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} fontSize={11} width={120} />
          </div>

          <div style={row}>
            <span style={label}>Size</span>
            <ValueInput value="16" unit="px" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
            <span style={{ ...label, width: "auto" }}>Height</span>
            <ValueInput value="1.5" unit="—" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
          </div>

          <div style={row}>
            <span style={label}>Color</span>
            <ColorSwatch color="#171717" size={20} borderRadius={3} />
            <ValueInput value="#171717" width={60} bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
          </div>

          <div style={row}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 0, border: "1px solid #e5e5e5", borderRadius: 3, overflow: "hidden" }}>
              <IconBtn active size={22} borderRadius={0} bgActive="#4353FF" colorActive="#fff">L</IconBtn>
              <IconBtn size={22} borderRadius={0} colorDefault="#bbb">C</IconBtn>
              <IconBtn size={22} borderRadius={0} colorDefault="#bbb">R</IconBtn>
              <IconBtn size={22} borderRadius={0} colorDefault="#bbb">J</IconBtn>
            </div>
          </div>

          <div style={row}>
            <span style={label}>Decor</span>
            <div style={{ display: "flex", gap: 0, border: "1px solid #e5e5e5", borderRadius: 3, overflow: "hidden" }}>
              <IconBtn size={22} borderRadius={0} colorDefault="#bbb">U</IconBtn>
              <IconBtn size={22} borderRadius={0} colorDefault="#bbb">S</IconBtn>
              <IconBtn active size={22} borderRadius={0} bgActive="#4353FF" colorActive="#fff">—</IconBtn>
            </div>
          </div>

          <div style={row}>
            <span style={label}>Spacing</span>
            <MiniSlider value={20} fillColor="#4353FF" height={2} borderRadius={1} />
            <ValueInput value="0.2" unit="em" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
          </div>

          {/* Sub-section: Webflow uses simple text toggle */}
          <div
            onClick={() => setSubOpen(!subOpen)}
            style={{
              padding: "8px 16px 4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ color: "#bbb", display: "flex" }}><Chevron open={subOpen} size={10} /></span>
            <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>More type options</span>
          </div>

          {subOpen && (
            <>
              <div style={row}>
                <span style={label}>Indent</span>
                <ValueInput value="0" unit="px" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
              </div>
              <div style={row}>
                <span style={label}>Columns</span>
                <ValueInput value="1" bg="transparent" border="#e5e5e5" borderRadius={3} height={22} />
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ height: 1, background: "#eee" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT 3: Minimal Breathing
// Fewer borders, more whitespace, relies on alignment over decoration.
// ═══════════════════════════════════════════════════════════════════

function Variant3() {
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);

  const label: React.CSSProperties = {
    width: 56,
    fontSize: 11,
    fontFamily: T.fontSans,
    color: T.fgHint,
    flexShrink: 0,
    userSelect: "none",
    cursor: "ew-resize",
    lineHeight: "28px",
    WebkitFontSmoothing: "antialiased",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 16px",
    minHeight: 32,
  };

  return (
    <div style={{ fontFamily: T.fontSans, fontSize: 13, color: T.fg, WebkitFontSmoothing: "antialiased" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "14px 16px 8px",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.fgSecondary, display: "flex", alignItems: "center", gap: 8 }}>
          Typography
          <Dot color={T.primary} />
        </span>
        <span style={{ color: T.fgHint }}><Chevron open={open} /></span>
      </div>

      {open && (
        <div style={{ paddingBottom: 12 }}>
          <div style={row}>
            <span style={label}>Font</span>
            <MiniSelect value="Inter" bg="transparent" border="transparent" fontSize={12} height={28} />
          </div>

          <div style={row}>
            <span style={label}>Weight</span>
            <MiniSelect value="Medium · 500" bg="transparent" border="transparent" fontSize={12} height={28} width={120} />
          </div>

          <div style={row}>
            <span style={label}>Size</span>
            <ValueInput value="16" unit="px" bg="transparent" border="transparent" height={28} />
            <span style={{ ...label, width: "auto" }}>Height</span>
            <ValueInput value="1.5" unit="—" bg="transparent" border="transparent" height={28} />
          </div>

          <div style={row}>
            <span style={label}>Color</span>
            <ColorSwatch color="#171717" size={22} borderRadius={6} />
            <span style={{ fontSize: 11, fontFamily: T.fontMono, color: T.fgSecondary }}>#171717</span>
          </div>

          <div style={row}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 2 }}>
              <IconBtn active size={28} borderRadius={6} bgActive={T.surfaceActive} colorActive={T.fg}>L</IconBtn>
              <IconBtn size={28} borderRadius={6}>C</IconBtn>
              <IconBtn size={28} borderRadius={6}>R</IconBtn>
              <IconBtn size={28} borderRadius={6}>J</IconBtn>
            </div>
          </div>

          <div style={row}>
            <span style={label}>Decor</span>
            <div style={{ display: "flex", gap: 2 }}>
              <IconBtn size={28} borderRadius={6}>U</IconBtn>
              <IconBtn size={28} borderRadius={6}>S</IconBtn>
              <IconBtn active size={28} borderRadius={6} bgActive={T.surfaceActive} colorActive={T.fg}>—</IconBtn>
            </div>
          </div>

          <div style={row}>
            <span style={label}>Spacing</span>
            <MiniSlider value={20} height={2} borderRadius={1} fillColor={T.fgLabel} trackColor={T.surfaceSubtle} />
            <ValueInput value="0.2" unit="em" bg="transparent" border="transparent" height={28} />
          </div>

          {/* Sub-section — just indented, no border */}
          <div
            onClick={() => setSubOpen(!subOpen)}
            style={{
              padding: "10px 16px 4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: T.fgHint, fontWeight: 500 }}>More type options</span>
            <span style={{ color: T.fgHint }}><Chevron open={subOpen} size={9} /></span>
          </div>

          {subOpen && (
            <>
              <div style={row}>
                <span style={label}>Indent</span>
                <ValueInput value="0" unit="px" bg="transparent" border="transparent" height={28} />
              </div>
              <div style={row}>
                <span style={label}>Columns</span>
                <ValueInput value="1" bg="transparent" border="transparent" height={28} />
              </div>
            </>
          )}
        </div>
      )}

      {/* No divider — whitespace does the work */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT 4: Dense Grid (Figma-inspired)
// Information-dense, tight spacing, borderless inputs, monospaced values.
// ═══════════════════════════════════════════════════════════════════

function Variant4() {
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);

  const label: React.CSSProperties = {
    width: 52,
    fontSize: 10,
    fontFamily: T.fontSans,
    color: T.fgHint,
    flexShrink: 0,
    userSelect: "none",
    cursor: "ew-resize",
    lineHeight: "20px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    WebkitFontSmoothing: "antialiased",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "1px 10px",
    minHeight: 24,
  };

  return (
    <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.fg, WebkitFontSmoothing: "antialiased" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "8px 10px 4px",
          borderBottom: open ? "none" : `1px solid ${T.borderSubtle}`,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          Typography
          <Dot color={T.primary} size={4} />
        </span>
        <span style={{ color: T.fgHint }}><Chevron open={open} size={10} /></span>
      </div>

      {open && (
        <div style={{ paddingBottom: 4 }}>
          <div style={row}>
            <span style={label}>Font</span>
            <MiniSelect value="Inter" bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
          </div>

          <div style={row}>
            <span style={label}>Weight</span>
            <MiniSelect value="Medium" bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} width={72} />
            <ValueInput value="500" width={32} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
          </div>

          {/* Figma-style: Size + Height on same row, very compact */}
          <div style={row}>
            <span style={label}>Size</span>
            <ValueInput value="16" width={32} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
            <span style={{ fontSize: 9, color: T.fgHint }}>H</span>
            <ValueInput value="1.5" width={32} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
          </div>

          <div style={row}>
            <span style={label}>Color</span>
            <ColorSwatch color="#171717" size={16} borderRadius={3} />
            <span style={{ fontSize: 10, fontFamily: T.fontMono, color: T.fgSecondary }}>171717</span>
            <span style={{ fontSize: 9, color: T.fgHint, marginLeft: "auto" }}>100%</span>
          </div>

          <div style={row}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 0 }}>
              {["L", "C", "R", "J"].map((a, i) => (
                <IconBtn key={a} active={i === 0} size={20} borderRadius={2} bgActive={T.primary} colorActive="#fff" colorDefault={T.fgHint}>{a}</IconBtn>
              ))}
            </div>
            <div style={{ width: 1, height: 12, background: T.borderSubtle, margin: "0 4px" }} />
            <div style={{ display: "flex", gap: 0 }}>
              {["U", "S", "—"].map((d, i) => (
                <IconBtn key={d} active={i === 2} size={20} borderRadius={2} bgActive={T.primary} colorActive="#fff" colorDefault={T.fgHint}>{d}</IconBtn>
              ))}
            </div>
          </div>

          <div style={row}>
            <span style={label}>L·Sp</span>
            <MiniSlider value={20} height={1.5} borderRadius={0.75} />
            <ValueInput value="0.2" width={32} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
          </div>

          {/* Dense sub-section */}
          <div
            onClick={() => setSubOpen(!subOpen)}
            style={{
              padding: "6px 10px 2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span style={{ color: T.fgHint, display: "flex" }}><Chevron open={subOpen} size={8} /></span>
            <span style={{ fontSize: 10, color: T.fgHint }}>More</span>
          </div>

          {subOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 8px", padding: "0 10px" }}>
              <div style={{ ...row, padding: "1px 0" }}>
                <span style={label}>Indent</span>
                <ValueInput value="0" width={28} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
              </div>
              <div style={{ ...row, padding: "1px 0" }}>
                <span style={label}>Cols</span>
                <ValueInput value="1" width={28} bg={T.surfaceSubtle} border="transparent" borderRadius={3} height={20} fontSize={10} />
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 1, background: T.borderSubtle }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VARIANT 5: Soft Modern (Linear/Notion-inspired)
// Rounded, warm, gentle contrast. Grouped rows with subtle cards.
// ═══════════════════════════════════════════════════════════════════

function Variant5() {
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);

  const label: React.CSSProperties = {
    width: 60,
    fontSize: 11,
    fontFamily: T.fontSans,
    color: "#9CA3AF",
    flexShrink: 0,
    userSelect: "none",
    cursor: "ew-resize",
    lineHeight: "26px",
    WebkitFontSmoothing: "antialiased",
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 14px",
    minHeight: 30,
  };

  const groupCard: React.CSSProperties = {
    background: "rgba(0,0,0,0.02)",
    borderRadius: 8,
    margin: "4px 10px",
    padding: "4px 0",
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, color: "#1F2937", WebkitFontSmoothing: "antialiased" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "12px 14px 6px",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
          Typography
          <span style={{
            width: 16, height: 16, borderRadius: 4, background: "rgba(59,130,246,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: T.primary, fontWeight: 700,
          }}>
            M
          </span>
        </span>
        <span style={{ color: "#D1D5DB" }}><Chevron open={open} /></span>
      </div>

      {open && (
        <div style={{ paddingBottom: 8 }}>
          {/* Font + Weight group */}
          <div style={groupCard}>
            <div style={{ ...row, padding: "2px 8px" }}>
              <span style={label}>Font</span>
              <MiniSelect value="Inter" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} fontSize={11} />
            </div>
            <div style={{ ...row, padding: "2px 8px" }}>
              <span style={label}>Weight</span>
              <MiniSelect value="Medium · 500" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} fontSize={11} width={120} />
            </div>
          </div>

          {/* Size + Height group */}
          <div style={groupCard}>
            <div style={{ ...row, padding: "2px 8px" }}>
              <span style={label}>Size</span>
              <ValueInput value="16" unit="px" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
              <span style={{ ...label, width: "auto" }}>Height</span>
              <ValueInput value="1.5" unit="—" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
            </div>
            <div style={{ ...row, padding: "2px 8px" }}>
              <span style={label}>Spacing</span>
              <MiniSlider value={20} height={3} borderRadius={1.5} fillColor="#6366F1" trackColor="rgba(0,0,0,0.06)" />
              <ValueInput value="0.2" unit="em" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
            </div>
          </div>

          {/* Color */}
          <div style={row}>
            <span style={label}>Color</span>
            <ColorSwatch color="#171717" size={22} borderRadius={6} />
            <ValueInput value="#171717" width={64} bg="rgba(0,0,0,0.02)" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
          </div>

          {/* Align + Decor */}
          <div style={row}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 2 }}>
              <IconBtn active size={26} borderRadius={6} bgActive="white" colorActive="#374151">L</IconBtn>
              <IconBtn size={26} borderRadius={6} colorDefault="#CBD5E1">C</IconBtn>
              <IconBtn size={26} borderRadius={6} colorDefault="#CBD5E1">R</IconBtn>
              <IconBtn size={26} borderRadius={6} colorDefault="#CBD5E1">J</IconBtn>
            </div>
          </div>

          <div style={row}>
            <span style={label}>Decor</span>
            <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 2 }}>
              <IconBtn size={26} borderRadius={6} colorDefault="#CBD5E1">U</IconBtn>
              <IconBtn size={26} borderRadius={6} colorDefault="#CBD5E1">S</IconBtn>
              <IconBtn active size={26} borderRadius={6} bgActive="white" colorActive="#374151">—</IconBtn>
            </div>
          </div>

          {/* Sub-section */}
          <div
            onClick={() => setSubOpen(!subOpen)}
            style={{
              margin: "6px 10px 2px",
              padding: "8px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0,0,0,0.02)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>More type options</span>
            <span style={{ color: "#D1D5DB" }}><Chevron open={subOpen} size={10} /></span>
          </div>

          {subOpen && (
            <div style={groupCard}>
              <div style={{ ...row, padding: "2px 8px" }}>
                <span style={label}>Indent</span>
                <ValueInput value="0" unit="px" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
              </div>
              <div style={{ ...row, padding: "2px 8px" }}>
                <span style={label}>Columns</span>
                <ValueInput value="1" bg="white" border="rgba(0,0,0,0.06)" borderRadius={6} height={26} />
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 14px" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page Layout
// ═══════════════════════════════════════════════════════════════════

const variants: Array<{ Component: React.FC; name: string; description: string; tags: string[] }> = [
  {
    Component: Variant1,
    name: "Strict Token Grid",
    description: "Every value from theme.ts. All inline styles. Precise 64px label column, 6px gaps, 12px horizontal padding. The current system formalized and enforced.",
    tags: ["theme.ts native", "inline only", "current direction"],
  },
  {
    Component: Variant2,
    name: "Webflow Exact",
    description: "Measured from real Webflow. UPPERCASE headers, 16px padding, transparent inputs with thin borders, Webflow's indigo accent (#4353FF), tighter 22px controls.",
    tags: ["webflow parity", "uppercase headers", "indigo accent"],
  },
  {
    Component: Variant3,
    name: "Minimal Breathing",
    description: "Fewer borders, more whitespace, borderless inputs. Labels pushed lighter. Alignment and whitespace do the grouping work instead of lines and backgrounds.",
    tags: ["borderless", "spacious", "quiet"],
  },
  {
    Component: Variant4,
    name: "Dense Grid",
    description: "Figma-inspired. 20px controls, uppercase 10px labels, 2-column sub-sections, filled backgrounds instead of borders. Maximum information density.",
    tags: ["compact", "figma-like", "dense"],
  },
  {
    Component: Variant5,
    name: "Soft Modern",
    description: "Linear/Notion-inspired. Grouped card rows, rounded 8px corners, warm gray palette, white inputs on subtle bg. Active states use raised card (white on gray).",
    tags: ["cards", "rounded", "warm"],
  },
];

export default function DesignLabPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8F8F8",
      fontFamily: "system-ui, sans-serif",
      padding: "40px 24px 80px",
    }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 4 }}>
            Design Lab — Panel Consistency
          </h1>
          <p style={{ fontSize: 14, color: "#666", maxWidth: 600 }}>
            5 approaches to making the Redial panel consistent across sections.
            Each variant applies the same style rules to section headers, labels, inputs, sliders, icon buttons, color swatches, and sub-sections.
          </p>
        </div>

        {/* Grid of variants */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}>
          {variants.map(({ Component, name, description, tags }, i) => (
            <div key={i} style={{
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}>
              {/* Variant header */}
              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color: "#fff",
                    background: "#111",
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{name}</span>
                </div>
                <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5, margin: 0 }}>{description}</p>
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10,
                      color: "#666",
                      background: "rgba(0,0,0,0.04)",
                      borderRadius: 4,
                      padding: "2px 6px",
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Variant panel preview */}
              <div style={{
                flex: 1,
                background: "#fff",
                minWidth: 300,
              }}>
                <Component />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
