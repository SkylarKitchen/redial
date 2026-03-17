"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  color,
  text,
  border,
  surface,
  font,
  layout,
  shadow,
  indicatorColor,
  labelIndicator,
  spacingZone,
  primaryAlpha,
  variableAlpha,
  blackAlpha,
  focusRing,
  checkerboard,
  filledTrackBg,
  darkToolbar,
  bgAlpha,
} from "@/overlay/theme";
import { timing } from "@/overlay/timing";
import { WebflowPanel } from "@/overlay/shell/WebflowPanel";

// ─── Reusable SVGs ──────────────────────────────────────────────────────────

const ChevronSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);

const CloseSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

// ─── Page-level CSS (token-driven) ──────────────────────────────────────────

const pageStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${color.background};
    color: ${blackAlpha(0.92)};
    font-family: ${font.sans};
    padding: 48px;
  }
  .mono { font-family: ${font.mono}; }
  .showcase-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;
    margin-bottom: 64px;
  }
  .section-title {
    font-size: 24px;
    font-weight: 600;
    color: ${blackAlpha(0.9)};
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid ${blackAlpha(0.07)};
  }
  .section-subtitle {
    font-size: 14px;
    color: ${blackAlpha(0.8)};
    margin-bottom: 16px;
    font-weight: 400;
  }
  .card {
    background: ${color.popover};
    border: 1px solid ${surface.hover};
    border-radius: 8px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card-label {
    font-size: 11px;
    font-weight: 600;
    color: ${blackAlpha(0.7)};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .variant-label {
    font-size: 9px;
    color: ${blackAlpha(0.65)};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }
  .variant-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .variant-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .swatch-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .swatch-box {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    border: 1px solid ${blackAlpha(0.07)};
  }
  .swatch-name {
    font-size: 9px;
    color: ${blackAlpha(0.7)};
    font-family: ${font.mono};
    text-align: center;
    max-width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .swatch-value {
    font-size: 8px;
    color: ${blackAlpha(0.7)};
    font-family: ${font.mono};
  }
  .token-table {
    border-collapse: collapse;
    font-size: 11px;
    font-family: ${font.mono};
  }
  .token-table td, .token-table th {
    padding: 6px 12px;
    border-bottom: 1px solid ${color.input};
    text-align: left;
  }
  .token-table th {
    color: ${blackAlpha(0.8)};
    font-weight: 500;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .token-table td:first-child { color: ${blackAlpha(0.8)}; }
  .token-table td:nth-child(2) { color: ${blackAlpha(0.7)}; }
  .token-table td:nth-child(3) { color: ${color.primary}; }
`;

// ─── Token Mapping Table Data (generated from actual objects) ────────────────

const tokenRows: { code: string; value: string; figma: string }[] = [
  { code: "color.background", value: color.background, figma: "colors/surface/panel" },
  { code: "color.foreground", value: color.foreground, figma: "colors/text/primary" },
  { code: "color.primary", value: color.primary, figma: "colors/accent/default" },
  { code: "color.primaryHover", value: color.primaryHover, figma: "colors/accent/hover" },
  { code: "color.primaryForeground", value: color.primaryForeground, figma: "colors/accent/foreground" },
  { code: "color.popover", value: color.popover, figma: "colors/surface/dropdown" },
  { code: "color.muted", value: color.muted, figma: "colors/surface/muted" },
  { code: "color.mutedForeground", value: color.mutedForeground, figma: "colors/text/tertiary" },
  { code: "color.input", value: color.input, figma: "colors/surface/input" },
  { code: "color.border", value: color.border, figma: "colors/border/default" },
  { code: "color.ring", value: color.ring, figma: "colors/accent/focus" },
  { code: "color.destructive", value: color.destructive, figma: "colors/danger/default" },
  { code: "text.secondary", value: text.secondary, figma: "colors/text/secondary" },
  { code: "text.label", value: text.label, figma: "colors/text/label" },
  { code: "text.disabled", value: text.disabled, figma: "colors/text/disabled" },
  { code: "text.hint", value: text.hint, figma: "colors/text/faint" },
  { code: "border.subtle", value: border.subtle, figma: "colors/border/separator" },
  { code: "border.hover", value: border.hover, figma: "colors/border/hover" },
  { code: "border.strong", value: border.strong, figma: "colors/border/strong" },
  { code: "surface.hover", value: surface.hover, figma: "colors/surface/hover" },
  { code: "surface.active", value: surface.active, figma: "colors/surface/active" },
  { code: "surface.track", value: surface.track, figma: "colors/surface/track" },
  { code: "indicatorColor.modified", value: indicatorColor.modified, figma: "colors/indicator/modified" },
  { code: "indicatorColor.none", value: indicatorColor.none, figma: "colors/indicator/none" },
  { code: "spacingZone.marginBase", value: spacingZone.marginBase, figma: "colors/spacing/margin" },
  { code: "spacingZone.marginHover", value: spacingZone.marginHover, figma: "colors/spacing/margin-hover" },
  { code: "spacingZone.paddingBase", value: spacingZone.paddingBase, figma: "colors/spacing/padding" },
  { code: "spacingZone.paddingHover", value: spacingZone.paddingHover, figma: "colors/spacing/padding-hover" },
  { code: "font.sans", value: font.sans, figma: "typography/family/system" },
  { code: "font.mono", value: font.mono, figma: "typography/family/mono" },
  { code: "labelIndicator.modified.bg", value: labelIndicator.modified.bg, figma: "colors/label/modified-bg" },
  { code: "labelIndicator.modified.text", value: labelIndicator.modified.text, figma: "colors/label/modified-text" },
  { code: "shadow.panel", value: shadow.panel, figma: "effects/shadow/panel" },
  { code: "shadow.dropdown", value: shadow.dropdown, figma: "effects/shadow/dropdown" },
  { code: "shadow.picker", value: shadow.picker, figma: "effects/shadow/picker" },
  ...Object.entries(timing).map(([key, val]) => ({
    code: `timing.${key}`,
    value: `${val}ms`,
    figma: `timing/${key}`,
  })),
];

// ─── Timing descriptions for the table ──────────────────────────────────────

const timingDescs: Record<string, string> = {
  instant: "selector highlight",
  micro: "dropdown option hover",
  fast: "button/control hover bg",
  normal: "text feedback, state transitions",
  expand: "section collapse/expand, chevron",
  layout: "drag displacement, focus ring",
  slow: "scrollbar fade, complex anims",
};

// ─── Helper: slider track at percentage ─────────────────────────────────────

const sliderTrack = (pct: number) =>
  `linear-gradient(to right, ${color.primary} ${pct}%, ${surface.track} ${pct}%)`;

const sliderTrackHover = (pct: number) =>
  `linear-gradient(to right, ${color.primary} ${pct}%, ${blackAlpha(0.2)} ${pct}%)`;

// ─── Shared inline-style fragments ─────────────────────────────────────────

const iconBtnBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: layout.iconBtnSize,
  minWidth: layout.iconBtnSize,
  padding: "0 6px",
  border: `1px solid ${surface.track}`,
  cursor: "pointer",
  userSelect: "none",
};

const iconBtnInactive: React.CSSProperties = {
  ...iconBtnBase,
  background: "transparent",
  color: blackAlpha(0.7),
};

const iconBtnActive: React.CSSProperties = {
  ...iconBtnBase,
  background: color.primary,
  color: color.primaryForeground,
};

const displayTabBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: layout.iconBtnSize,
  minWidth: 48,
  padding: "0 10px",
  fontSize: 10,
  fontFamily: font.mono,
  border: `1px solid ${surface.track}`,
  cursor: "pointer",
  userSelect: "none",
};

const displayTabInactive: React.CSSProperties = {
  ...displayTabBase,
  background: "transparent",
  color: blackAlpha(0.7),
};

const displayTabActive: React.CSSProperties = {
  ...displayTabBase,
  background: color.primary,
  color: color.primaryForeground,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: layout.sectionPadding,
  display: "flex",
  justifyContent: "space-between",
  cursor: "pointer",
  userSelect: "none",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: color.foreground,
};

const chevronWrapStyle: React.CSSProperties = {
  color: blackAlpha(0.55),
  display: "flex",
  alignItems: "center",
  transition: `transform ${timing.expand}ms ease`,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  padding: layout.rowPadding,
  borderRadius: 4,
};

const labelStyle: React.CSSProperties = {
  width: layout.labelWidth,
  fontSize: 11,
  color: text.label,
  flexShrink: 0,
};

const valueInputStyle: React.CSSProperties = {
  width: layout.inputWidth,
  background: color.input,
  border: `1px solid ${border.default}`,
  borderRadius: 2,
  color: blackAlpha(0.7),
  fontSize: 10,
  fontFamily: font.mono,
  textAlign: "center" as const,
  padding: 2,
};

const unitLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: blackAlpha(0.55),
  width: 16,
  fontFamily: font.mono,
};

const sizeInputCellBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: layout.iconBtnSize,
  background: color.input,
  border: `1px solid ${blackAlpha(0.07)}`,
  borderRadius: 4,
  overflow: "hidden",
};

const sizeInputLabel: React.CSSProperties = {
  padding: "0 6px",
  fontSize: 10,
  color: blackAlpha(0.7),
  fontFamily: font.sans,
  lineHeight: `${layout.iconBtnSize}px`,
};

const sizeInputValue: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: blackAlpha(0.7),
  paddingRight: 4,
};

const sizeInputUnit: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: blackAlpha(0.8),
  padding: "0 4px",
};

const panelShell: React.CSSProperties = {
  width: layout.panelWidth,
  background: color.background,
  borderRadius: layout.panelRadius,
  border: `1px solid ${blackAlpha(0.07)}`,
  boxShadow: shadow.panel,
  overflow: "hidden",
  color: blackAlpha(0.87),
};

const footerBtnStandard: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  fontFamily: font.sans,
  border: `1px solid ${blackAlpha(0.07)}`,
  borderRadius: 6,
  background: surface.hover,
  color: blackAlpha(0.8),
  cursor: "pointer",
  userSelect: "none",
};

const footerBtnPrimary: React.CSSProperties = {
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: font.sans,
  border: "none",
  borderRadius: 6,
  background: color.primary,
  color: color.primaryForeground,
  boxShadow: `0 1px 3px ${primaryAlpha(0.4)}`,
  cursor: "pointer",
  userSelect: "none",
};

// ─── Interactive Sub-components ─────────────────────────────────────────────

function SliderThumb({ pct }: { pct: number }) {
  return (
    <div style={{
      position: "absolute",
      left: `${pct}%`,
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: color.primary,
      border: `2px solid ${color.background}`,
      pointerEvents: "none",
    }} />
  );
}

function AlignLines() {
  return (
    <>
      <div style={{ width: 8, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: 5, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: 7, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
    </>
  );
}

function AlignCell({ justify, align, active, onClick }: { justify: string; align: string; active?: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        width: layout.alignCell,
        height: layout.alignCell,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? color.primary : hovered ? surface.hover : "transparent",
        color: active ? color.primaryForeground : blackAlpha(0.7),
        cursor: "pointer",
        transition: `background ${timing.fast}ms ease`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 16, height: 16, display: "flex", flexDirection: "column",
        justifyContent: justify as any, alignItems: align as any, gap: 1.5,
      }}>
        <AlignLines />
      </div>
    </div>
  );
}

function DragHandleBar() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0" }}>
      <div style={{ width: 28, height: 3, borderRadius: 1.5, background: surface.active }} />
    </div>
  );
}

function PanelHeader({ tag, className, badges, showSource }: {
  tag: string;
  className?: string;
  badges?: React.ReactNode;
  showSource?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", borderBottom: `1px solid ${surface.hover}`, cursor: "grab", userSelect: "none" }}>
      <DragHandleBar />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="mono" style={{ color: blackAlpha(0.87), fontSize: 13, fontWeight: 500 }}>{tag}</span>
          {className && <span className="mono" style={{ color: blackAlpha(0.7), fontSize: 11 }}>{className}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {badges}
          <div style={{ color: blackAlpha(0.55), padding: 3, lineHeight: 1, display: "flex", alignItems: "center", borderRadius: 3 }}>
            <CloseSvg />
          </div>
        </div>
      </div>
      {showSource && (
        <div style={{ padding: "2px 12px 0" }}>
          <span className="mono" style={{ color: blackAlpha(0.55), fontSize: 10 }}>src/components/Button.tsx</span>
        </div>
      )}
    </div>
  );
}

function BreakpointBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: font.mono, color: blackAlpha(0.6),
      background: color.input, border: `1px solid ${color.input}`,
      padding: "2px 6px", borderRadius: 3, letterSpacing: 0.5,
      textTransform: "uppercase", lineHeight: "14px",
    }}>{label}</span>
  );
}

function ChangesBadgeCount({ count }: { count: number }) {
  return (
    <div style={{
      background: primaryAlpha(0.15), border: `1px solid ${primaryAlpha(0.2)}`,
      borderRadius: 3, color: primaryAlpha(0.95), fontSize: 9, fontWeight: 600,
      fontFamily: font.mono, padding: "2px 6px", lineHeight: "14px",
      minWidth: 18, textAlign: "center",
    }}>{count}</div>
  );
}

// ─── Interactive Slider ─────────────────────────────────────────────────────

function InteractiveSlider({
  label, initialPct = 40, maxVal = 100, unit = "px", modified,
}: {
  label: string; initialPct?: number; maxVal?: number; unit?: string; modified?: boolean;
}) {
  const [pct, setPct] = useState(initialPct);
  const [hovered, setHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromMouse = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    setPct(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    updateFromMouse(e.clientX);
    const onMove = (ev: MouseEvent) => updateFromMouse(ev.clientX);
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [updateFromMouse]);

  const displayValue = Math.round((pct / 100) * maxVal);

  return (
    <div style={rowStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {label && (
        <span style={modified ? {
          ...labelStyle, color: indicatorColor.modified, display: "inline-flex", alignItems: "center", gap: 4,
        } : labelStyle}>
          {modified && <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: indicatorColor.modified, boxShadow: `0 0 3px ${indicatorColor.modified}` }} />}
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1, height: layout.sliderHeight,
          background: hovered ? sliderTrackHover(pct) : sliderTrack(pct),
          borderRadius: 2, position: "relative", cursor: "pointer",
          transition: `background ${timing.fast}ms ease`,
        }}
      >
        <SliderThumb pct={pct} />
      </div>
      <div style={valueInputStyle}>{displayValue}</div>
      <span style={unitLabelStyle}>{unit}</span>
    </div>
  );
}

// ─── Dropdown Item (with hover) ─────────────────────────────────────────────

function DropdownItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "3px 8px", fontSize: 10, fontFamily: font.mono, lineHeight: "16px",
        color: active ? color.primaryForeground : blackAlpha(0.7),
        background: active ? color.primary : hovered ? surface.hover : "transparent",
        cursor: "pointer", transition: `background ${timing.micro}ms ease`,
      }}
    >{label}</div>
  );
}

// ─── Interactive Unit Selector ──────────────────────────────────────────────

function InteractiveUnitSelector({ initialUnit = "px" }: { initialUnit?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialUnit);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: 20, padding: "0 4px",
          background: open ? primaryAlpha(0.25) : hovered ? surface.hover : "transparent",
          border: open ? `1px solid ${primaryAlpha(0.4)}` : hovered ? `1px solid ${surface.track}` : "1px solid transparent",
          borderRadius: 3, color: open ? color.primaryHover : blackAlpha(0.8),
          fontSize: 10, fontFamily: font.mono, cursor: "pointer",
          transition: `all ${timing.fast}ms ease`,
        }}
      >{selected}</div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, minWidth: 42,
          background: color.popover, border: `1px solid ${surface.track}`, borderRadius: 4,
          boxShadow: shadow.dropdown, zIndex: 100, padding: "2px 0",
        }}>
          {["px", "%", "em", "rem", "vw", "vh"].map((u) => (
            <DropdownItem key={u} label={u} active={u === selected} onClick={() => { setSelected(u); setOpen(false); }} />
          ))}
          <div style={{ height: 1, background: blackAlpha(0.07), margin: "2px 0" }} />
          {["auto", "none"].map((kw) => (
            <DropdownItem key={kw} label={kw} active={kw === selected} onClick={() => { setSelected(kw); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Interactive Select Row ─────────────────────────────────────────────────

function InteractiveSelect({ label, options, initialIndex = 1 }: { label: string; options: string[]; initialIndex?: number }) {
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(initialIndex);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div style={rowStyle} ref={ref}>
      <span style={labelStyle}>{label}</span>
      <div style={{ flex: 1, position: "relative" }}>
        <div
          onClick={() => setOpen(!open)}
          style={{
            width: "100%", height: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
            background: open ? blackAlpha(0.07) : color.input,
            border: `1px solid ${open ? primaryAlpha(0.4) : surface.active}`, borderRadius: 3,
            color: blackAlpha(0.7), fontSize: 11, fontFamily: font.mono, padding: "0 6px",
            cursor: "pointer", transition: `border-color ${timing.fast}ms ease`,
          }}
        >
          <span>{options[selectedIdx]}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={border.strong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
            minWidth: "100%", maxHeight: 180, overflowY: "auto",
            background: color.popover, border: `1px solid ${surface.track}`, borderRadius: 4,
            boxShadow: shadow.dropdown, zIndex: 200, padding: "2px 0",
          }}>
            {options.map((opt, i) => (
              <DropdownItem key={opt} label={opt} active={i === selectedIdx} onClick={() => { setSelectedIdx(i); setOpen(false); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Interactive Toggle Section ─────────────────────────────────────────────

function ToggleSection({ title, hasIndicator, defaultOpen = false, children }: {
  title: string; hasIndicator?: boolean; defaultOpen?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${surface.subtle}` }}>
      <div
        style={{
          ...sectionHeaderStyle,
          background: hovered ? surface.hover : "transparent",
          transition: `background ${timing.fast}ms ease`,
        }}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ ...sectionTitleStyle, display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {hasIndicator && (
            <span style={{
              display: "inline-block", width: 4, height: 4, borderRadius: "50%",
              background: indicatorColor.modified, boxShadow: `0 0 3px ${indicatorColor.modified}`,
            }} />
          )}
        </span>
        <span style={{ ...chevronWrapStyle, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
          <ChevronSvg />
        </span>
      </div>
      {open && children && (
        <div style={{ paddingBottom: layout.sectionBodyPadding, overflow: "hidden" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Interactive Display Tabs ───────────────────────────────────────────────

function InteractiveDisplayTabs({ options, initialActive = 0 }: { options: string[]; initialActive?: number }) {
  const [active, setActive] = useState(initialActive);
  return (
    <div style={{ display: "inline-flex" }}>
      {options.map((opt, i) => (
        <div
          key={opt}
          onClick={() => setActive(i)}
          style={{
            ...(i === active ? displayTabActive : displayTabInactive),
            borderLeft: i === 0 ? undefined : "none",
            borderRadius: i === 0 ? "4px 0 0 4px" : i === options.length - 1 ? "0 4px 4px 0" : 0,
            transition: `all ${timing.fast}ms ease`,
          }}
        >{opt}</div>
      ))}
    </div>
  );
}

// ─── Interactive Icon Button Group ──────────────────────────────────────────

function InteractiveIconGroup({ icons, initialActive = 1, multiSelect = false }: {
  icons: React.ReactNode[]; initialActive?: number | number[]; multiSelect?: boolean;
}) {
  const [active, setActive] = useState<Set<number>>(
    new Set(Array.isArray(initialActive) ? initialActive : [initialActive])
  );

  const toggle = (i: number) => {
    if (multiSelect) {
      setActive((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
    } else {
      setActive(new Set([i]));
    }
  };

  return (
    <div style={{ display: "inline-flex" }}>
      {icons.map((icon, i) => (
        <div
          key={i}
          onClick={() => toggle(i)}
          style={{
            ...(active.has(i) ? iconBtnActive : iconBtnInactive),
            borderLeft: i === 0 ? undefined : "none",
            borderRadius: i === 0 ? "4px 0 0 4px" : i === icons.length - 1 ? "0 4px 4px 0" : 0,
            transition: `all ${timing.fast}ms ease`,
          }}
        >{icon}</div>
      ))}
    </div>
  );
}

// ─── Interactive Scope Pills ────────────────────────────────────────────────

function InteractiveScopePills({ labels, initialActive = 0 }: { labels: string[]; initialActive?: number }) {
  const [active, setActive] = useState(initialActive);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {labels.map((label, i) => (
        <div
          key={label}
          onClick={() => setActive(i)}
          style={{
            padding: "2px 8px", fontSize: 10, fontFamily: font.mono,
            border: "none", borderRadius: 4,
            background: i === active ? surface.active : "transparent",
            color: i === active ? blackAlpha(0.87) : blackAlpha(0.7),
            lineHeight: "16px", cursor: "pointer", userSelect: "none",
            transition: `all ${timing.fast}ms ease`,
          }}
        >{label}</div>
      ))}
    </div>
  );
}

// ─── Interactive Align Box ──────────────────────────────────────────────────

function InteractiveAlignBox() {
  const [activeV, setActiveV] = useState("center");
  const [activeH, setActiveH] = useState("center");
  const [spacingMode, setSpacingMode] = useState<string | null>(null);
  const aligns = ["flex-start", "center", "flex-end"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(3, ${layout.alignCell}px)`,
        gridTemplateRows: `repeat(3, ${layout.alignCell}px)`,
        border: `1px solid ${surface.track}`, borderRadius: 4, overflow: "hidden",
      }}>
        {aligns.map((vAlign) =>
          aligns.map((hAlign) => (
            <div key={`${vAlign}-${hAlign}`} style={{
              borderRight: hAlign === "flex-end" ? undefined : `1px solid ${blackAlpha(0.07)}`,
              borderBottom: vAlign === "flex-end" ? undefined : `1px solid ${blackAlpha(0.07)}`,
            }}>
              <AlignCell justify={vAlign} align={hAlign}
                active={vAlign === activeV && hAlign === activeH}
                onClick={() => { setActiveV(vAlign); setActiveH(hAlign); }}
              />
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {["Between", "Around", "Evenly"].map((label) => {
          const isActive = spacingMode === label;
          return (
            <div key={label}
              onClick={() => setSpacingMode(isActive ? null : label)}
              style={{
                background: isActive ? color.primary : "transparent",
                color: isActive ? color.primaryForeground : blackAlpha(0.7),
                border: `1px solid ${isActive ? color.primary : surface.active}`,
                borderRadius: 3, fontSize: 9, fontFamily: font.sans,
                padding: "2px 6px", lineHeight: "16px",
                cursor: "pointer", userSelect: "none", transition: `all ${timing.fast}ms ease`,
              }}
            >{label}</div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hover Button ───────────────────────────────────────────────────────────

function HoverButton({ children, style: baseStyle, hoverStyle, onClick, disabled }: {
  children: React.ReactNode; style: React.CSSProperties; hoverStyle?: React.CSSProperties;
  onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...baseStyle,
        ...(hovered && !disabled ? (hoverStyle ?? { filter: "brightness(0.92)" }) : {}),
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: `all ${timing.fast}ms ease`,
      }}
    >{children}</div>
  );
}

// ─── Interactive Preset Chips ───────────────────────────────────────────────

function InteractivePresetChips({ values }: { values: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", padding: "0 12px" }}>
      {values.map((v) => {
        const isActive = v === active;
        return (
          <span key={v}
            onClick={() => setActive(isActive ? null : v)}
            style={{
              fontSize: 9, fontFamily: font.mono,
              color: isActive ? color.primaryForeground : blackAlpha(0.7),
              background: isActive ? color.primary : color.input,
              padding: "1px 5px", borderRadius: 3,
              cursor: "pointer", userSelect: "none", transition: `all ${timing.fast}ms ease`,
            }}
          >{v}</span>
        );
      })}
    </div>
  );
}

// ─── Interactive Tab Bar (Common / Custom / Prompt) ─────────────────────────

function InteractiveTabBar({ tabs, initialActive = 0 }: { tabs: string[]; initialActive?: number }) {
  const [active, setActive] = useState(initialActive);
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${border.subtle}`, padding: "0 12px" }}>
      {tabs.map((tab, i) => {
        const isActive = i === active;
        return (
          <button
            key={tab}
            onClick={() => setActive(i)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? color.primary : "transparent"}`,
              padding: "7px 10px 5px",
              fontSize: 11,
              fontFamily: font.sans,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? color.foreground : text.label,
              cursor: "pointer",
              transition: `all ${timing.fast}ms ease`,
            }}
          >{tab}</button>
        );
      })}
    </div>
  );
}

// ─── Interactive State Selector ─────────────────────────────────────────────

function InteractiveStateSelector({ initialState = "default" }: { initialState?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialState);
  const ref = useRef<HTMLDivElement>(null);
  const states = ["default", ":hover", ":active", ":focus", ":visited", ":focus-visible"];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 8px", fontSize: 10, fontFamily: font.sans,
          border: `1px solid ${open ? primaryAlpha(0.4) : border.default}`,
          borderRadius: 4, background: open ? primaryAlpha(0.06) : "transparent",
          color: selected !== "default" ? color.primary : text.label,
          cursor: "pointer", transition: `all ${timing.fast}ms ease`,
        }}
      >
        State
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, minWidth: 120,
          background: color.popover, border: `1px solid ${surface.track}`, borderRadius: 4,
          boxShadow: shadow.dropdown, zIndex: 200, padding: "2px 0",
        }}>
          {states.map((s) => (
            <DropdownItem key={s} label={s} active={s === selected} onClick={() => { setSelected(s); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Interactive Spacing Box Model ──────────────────────────────────────────

function SpacingValue({ value, zone, hoverZone, setHoverZone, onChange }: {
  value: number; zone: string; hoverZone: string | null;
  setHoverZone: (z: string | null) => void; onChange: (v: number) => void;
}) {
  const isMargin = zone.startsWith("m");
  const isHovered = hoverZone === zone;

  return (
    <span
      onMouseEnter={() => setHoverZone(zone)}
      onMouseLeave={() => setHoverZone(null)}
      style={{
        fontSize: 10, fontFamily: font.mono,
        color: isHovered ? color.primary : (isMargin ? blackAlpha(0.55) : blackAlpha(0.8)),
        padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center",
        cursor: "ew-resize", userSelect: "none",
        transition: `color ${timing.fast}ms ease`,
      }}
    >{value}</span>
  );
}

function UnitPill({ unit }: { unit: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 20, padding: "0 6px",
      fontSize: 10, fontFamily: font.mono,
      background: color.input, border: `1px solid ${color.border}`,
      borderRadius: 4, color: blackAlpha(0.55),
      cursor: "pointer", maxWidth: 36, lineHeight: 1,
    }}>{unit}</span>
  );
}

function InteractiveSpacingBox() {
  const [margin, setMargin] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [padding, setPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [hoverZone, setHoverZone] = useState<string | null>(null);

  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div style={{
        position: "relative", border: `1px solid ${surface.active}`, borderRadius: 4,
        background: hoverZone?.startsWith("m") ? spacingZone.marginHover : spacingZone.marginBase,
        transition: `background ${timing.fast}ms ease`,
      }}>
        <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3, zIndex: 1 }}>
          <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Margin</span>
          <UnitPill unit="px" />
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
          <SpacingValue value={margin.top} zone="m-top" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setMargin((p) => ({ ...p, top: v }))} />
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <SpacingValue value={margin.left} zone="m-left" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setMargin((p) => ({ ...p, left: v }))} />
          </div>
          <div style={{
            flex: 1, border: `1px solid ${surface.active}`, borderRadius: 3,
            background: hoverZone?.startsWith("p") ? spacingZone.paddingHover : spacingZone.paddingBase,
            margin: "2px 0", position: "relative", transition: `background ${timing.fast}ms ease`,
          }}>
            <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3, zIndex: 1 }}>
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Padding</span>
              <UnitPill unit="px" />
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
              <SpacingValue value={padding.top} zone="p-top" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setPadding((p) => ({ ...p, top: v }))} />
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <SpacingValue value={padding.left} zone="p-left" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setPadding((p) => ({ ...p, left: v }))} />
              </div>
              <div style={{ flex: 1, height: 14, background: surface.hover, borderRadius: 2, margin: "0 4px" }} />
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <SpacingValue value={padding.right} zone="p-right" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setPadding((p) => ({ ...p, right: v }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
              <SpacingValue value={padding.bottom} zone="p-bottom" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setPadding((p) => ({ ...p, bottom: v }))} />
            </div>
          </div>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <SpacingValue value={margin.right} zone="m-right" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setMargin((p) => ({ ...p, right: v }))} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
          <SpacingValue value={margin.bottom} zone="m-bottom" hoverZone={hoverZone} setHoverZone={setHoverZone} onChange={(v) => setMargin((p) => ({ ...p, bottom: v }))} />
        </div>
      </div>
    </div>
  );
}

// ─── Interactive Color Picker ───────────────────────────────────────────────

function InteractiveColorPicker() {
  const [hue, setHue] = useState(260);
  const [sat, setSat] = useState(75);
  const [brightness, setBrightness] = useState(75);
  const [opacity, setOpacity] = useState(100);
  const [mode, setMode] = useState<"HEX" | "RGB" | "HSL">("HEX");
  const canvasRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const opacityRef = useRef<HTMLDivElement>(null);

  const hslColor = `hsl(${hue}, 100%, 50%)`;
  const pickedColor = `hsl(${hue}, ${sat}%, ${brightness}%)`;

  const useDrag = (ref: React.RefObject<HTMLDivElement | null>, onUpdate: (x: number, y?: number) => void) =>
    useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      const update = (clientX: number, clientY: number) => {
        const rect = ref.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        onUpdate(x, y);
      };
      update(e.clientX, e.clientY);
      const onMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
      const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }, [ref, onUpdate]);

  const handleCanvasDown = useDrag(canvasRef, useCallback((x: number, y?: number) => {
    setSat(Math.round(x * 100));
    setBrightness(Math.round((1 - (y ?? 0)) * 100));
  }, []));

  const handleHueDown = useDrag(hueRef, useCallback((x: number) => {
    setHue(Math.round(x * 360));
  }, []));

  const handleOpacityDown = useDrag(opacityRef, useCallback((x: number) => {
    setOpacity(Math.round(x * 100));
  }, []));

  const modes = ["HEX", "RGB", "HSL"] as const;

  return (
    <div style={{
      width: 240, background: color.popover, borderRadius: 8, padding: 12,
      boxShadow: shadow.picker, display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* 2D canvas */}
      <div ref={canvasRef} onMouseDown={handleCanvasDown} style={{
        position: "relative", width: layout.pickerCanvasWidth, height: layout.pickerCanvasHeight,
        borderRadius: 4, overflow: "hidden", cursor: "crosshair",
      }}>
        <div style={{ position: "absolute", inset: 0, background: hslColor }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))" }} />
        <div style={{
          position: "absolute", left: `${sat}%`, top: `${100 - brightness}%`,
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: pickedColor, pointerEvents: "none",
        }} />
      </div>

      {/* Hue slider */}
      <div ref={hueRef} onMouseDown={handleHueDown} style={{
        position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6,
        background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)", cursor: "pointer",
      }}>
        <div style={{
          position: "absolute", left: `${(hue / 360) * 100}%`, top: "50%",
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: hslColor, pointerEvents: "none",
        }} />
      </div>

      {/* Opacity slider */}
      <div ref={opacityRef} onMouseDown={handleOpacityDown} style={{
        position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6,
        background: "repeating-conic-gradient(#444 0% 25%, #666 0% 50%) 50%/8px 8px",
        cursor: "pointer", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: `linear-gradient(to right, transparent, ${pickedColor})` }} />
        <div style={{
          position: "absolute", left: `${opacity}%`, top: "50%",
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: pickedColor, pointerEvents: "none",
        }} />
      </div>

      {/* Mode inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span onClick={() => setMode(modes[(modes.indexOf(mode) + 1) % modes.length])} style={{
          fontSize: 10, color: blackAlpha(0.7), fontFamily: font.mono, cursor: "pointer",
          minWidth: 22, textTransform: "uppercase", letterSpacing: "0.02em", userSelect: "none",
        }}>{mode}</span>
        <div style={{
          flex: 1, background: color.background, border: `1px solid ${blackAlpha(0.07)}`, borderRadius: 4,
          padding: "3px 6px", fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.7),
        }}>
          {mode === "HSL" ? `hsl(${hue},${sat}%,${brightness}%)` : mode === "RGB" ? `${hue},${sat},${brightness}` : pickedColor}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: blackAlpha(0.6), fontFamily: font.mono }}>A</span>
          <span style={{ fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.8), minWidth: 26, textAlign: "right" }}>{opacity}%</span>
        </div>
      </div>

      {/* Swatches */}
      <div style={{ borderTop: `1px solid ${surface.hover}`, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: blackAlpha(0.6), textTransform: "uppercase", letterSpacing: "0.04em" }}>Swatches</span>
          <div style={{
            background: "none", border: `1px solid ${surface.active}`, borderRadius: 3,
            color: blackAlpha(0.7), width: 18, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, lineHeight: 1, cursor: "pointer",
          }}>+</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[color.destructive, "#22c55e", color.primary, indicatorColor.modified, "#06b6d4"].map((c, i) => (
            <div key={i} style={{
              width: layout.swatchSizeSaved, height: layout.swatchSizeSaved, borderRadius: 3,
              border: `1px solid ${surface.track}`, background: c, cursor: "pointer",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Interactive Copy Dropdown ──────────────────────────────────────────────

function InteractiveCopyDropdown({ formats }: { formats: string[] }) {
  return (
    <div style={{
      background: color.popover, border: `1px solid ${surface.active}`, borderRadius: 6,
      padding: "4px 0", minWidth: 140, boxShadow: shadow.dropdown,
    }}>
      {formats.map((opt) => (
        <DropdownItem key={opt} label={opt} onClick={() => {}} />
      ))}
    </div>
  );
}

// ─── Icon SVGs for button groups ────────────────────────────────────────────

const AlignLeftIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>;
const AlignCenterIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>;
const AlignRightIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>;
const AlignJustifyIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const StrikeIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const BoldIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>;
const UnderlineIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>;
const RowIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const ColIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>;
const WrapIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="10" y2="18"/></svg>;

// ─── Live Panel (renders real WebflowPanel against a styled element) ─────────

function ShowcaseLivePanel() {
  const targetRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // All sections open by default
  const sectionMemory = useMemo(() => ({
    Layout: true, Spacing: true, Size: true, Position: true,
    Typography: true, Backgrounds: true, Borders: true, Effects: true,
  }), []);

  const spacing = useMemo(() => ({
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 12, right: 24, bottom: 12, left: 24 },
  }), []);

  useEffect(() => { if (targetRef.current) setReady(true); }, []);

  const noop = useCallback(() => {}, []);

  return (
    <div>
      {/* Hidden target element — WebflowPanel reads getComputedStyle from this */}
      <div
        ref={targetRef}
        data-showcase-target
        style={{
          position: "fixed", left: -9999, top: 0, width: 200, height: 48,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 24px", margin: 0,
          fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 600,
          lineHeight: 1.5, letterSpacing: "normal", color: "#ffffff",
          backgroundColor: "#3B82F6", borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          opacity: 1, cursor: "pointer",
          overflow: "visible", textAlign: "center" as const,
        }}
      >
        Button
      </div>
      {ready && targetRef.current && (
        <div style={panelShell}>
          <PanelHeader tag="<button>" className=".btnPrimary" showSource badges={<><ChangesBadgeCount count={9} /></>} />
          <WebflowPanel
            element={targetRef.current}
            spacing={spacing}
            onSpacingChange={noop as any}
            sectionMemory={sectionMemory}
            onSectionMemoryChange={noop as any}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function ShowcasePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION A -- Design Tokens Reference                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }} data-component="DesignTokens">
        <h1 className="section-title">A — Design Tokens</h1>

        {/* Colors */}
        <div className="card" style={{ marginBottom: 24, maxWidth: 900 }} data-component="ColorTokens">
          <div className="card-label">Colors — Semantic Palette</div>
          <div className="swatch-grid">
            <div className="swatch"><div className="swatch-box" style={{ background: color.background }} /><div className="swatch-name">panel-bg</div><div className="swatch-value">{color.background}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.background }} /><div className="swatch-name">page-bg</div><div className="swatch-value">{color.background}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.popover }} /><div className="swatch-name">dropdown-bg</div><div className="swatch-value">{color.popover}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.popover }} /><div className="swatch-name">card-bg</div><div className="swatch-value">{color.popover}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.primary }} /><div className="swatch-name">accent</div><div className="swatch-value">{color.primary}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.primaryHover }} /><div className="swatch-name">accent-hover</div><div className="swatch-value">{color.primaryHover}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.foreground, borderColor: blackAlpha(0.15) }} /><div className="swatch-name">text-primary</div><div className="swatch-value">{color.foreground}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: text.secondary, borderColor: blackAlpha(0.15) }} /><div className="swatch-name">text-secondary</div><div className="swatch-value">{text.secondary}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: text.label, borderColor: blackAlpha(0.15) }} /><div className="swatch-name">text-tertiary</div><div className="swatch-value">{text.label}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: text.hint }} /><div className="swatch-name">text-faint</div><div className="swatch-value">{text.hint}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.input }} /><div className="swatch-name">input-bg</div><div className="swatch-value">{color.input}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: border.default }} /><div className="swatch-name">border</div><div className="swatch-value">{border.default}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: border.subtle }} /><div className="swatch-name">separator</div><div className="swatch-value">{border.subtle}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.ring }} /><div className="swatch-name">focus-ring</div><div className="swatch-value">clay/0.3</div></div>
            <div className="swatch"><div className="swatch-box" style={{ background: color.destructive }} /><div className="swatch-name">destructive</div><div className="swatch-value">{color.destructive}</div></div>
          </div>

          <div className="card-label" style={{ marginTop: 12 }}>Indicator Colors</div>
          <div className="swatch-grid">
            {(["modified", "none"] as const).map((type) => (
              <div key={type} className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor[type] }} /><div className="swatch-name">{type}</div><div className="swatch-value">{indicatorColor[type]}</div></div>
            ))}
          </div>

          <div className="card-label" style={{ marginTop: 12 }}>Spacing Zone Colors</div>
          <div className="swatch-grid">
            <div className="swatch"><div className="swatch-box" style={{ width: 48, height: 32, background: spacingZone.marginBase }} /><div className="swatch-name">margin-base</div><div className="swatch-value">orange/0.08</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 48, height: 32, background: spacingZone.marginHover }} /><div className="swatch-name">margin-hover</div><div className="swatch-value">orange/0.22</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 48, height: 32, background: spacingZone.paddingBase }} /><div className="swatch-name">padding-base</div><div className="swatch-value">blue/0.08</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 48, height: 32, background: spacingZone.paddingHover }} /><div className="swatch-name">padding-hover</div><div className="swatch-value">blue/0.22</div></div>
          </div>
        </div>

        {/* Typography */}
        <div className="card" style={{ marginBottom: 24, maxWidth: 700 }} data-component="TypographyTokens">
          <div className="card-label">Typography</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { size: 8, sansText: "System — MARGIN / PADDING labels", monoText: "Mono — unit labels" },
              { size: 9, sansText: "System — preset chips, swatches header", monoText: "Mono — unit pill, breakpoint badge" },
              { size: 10, sansText: "System — SizeInputCell label, scope pills", monoText: "Mono — values, inputs, hex codes" },
              { size: 11, sansText: "System — slider labels, dropdown items", monoText: "Mono — breadcrumb, source path, select value" },
              { size: 12, sansText: "System — action buttons, dropdown items" },
              { size: 13, sansText: "System — section titles, primary button", monoText: "Mono — element tag", bold: true },
            ].map(({ size, sansText, monoText, bold }) => (
              <div key={size} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ width: 60, fontSize: 9, color: blackAlpha(0.55) }} className="mono">{size}px</span>
                <span style={{ fontSize: size, fontFamily: font.sans, fontWeight: bold ? 500 : undefined, color: blackAlpha(bold ? 0.75 : 0.8) }}>{sansText}</span>
                {monoText && <span style={{ fontSize: size, fontWeight: bold ? 500 : undefined }} className="mono">{monoText}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Spacing, Borders & Shadows, Timing */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
          <div className="card" data-component="SpacingTokens">
            <div className="card-label">Spacing / Dimensions</div>
            <table className="token-table">
              <tbody>
                <tr><th>Token</th><th>Value</th></tr>
                <tr><td>panel-width</td><td>{layout.panelWidth}px</td></tr>
                <tr><td>panel-radius</td><td>{layout.panelRadius}px</td></tr>
                <tr><td>section-padding</td><td>{layout.sectionPadding} (header) / {layout.sectionBodyPadding}px (body)</td></tr>
                <tr><td>row-padding</td><td>{layout.rowPadding}</td></tr>
                <tr><td>footer-padding</td><td>{layout.footerPadding}</td></tr>
                <tr><td>label-width</td><td>{layout.labelWidth}px</td></tr>
                <tr><td>control-gap</td><td>{layout.controlGap}px</td></tr>
                <tr><td>input-width</td><td>{layout.inputWidth}px (ValueInput)</td></tr>
                <tr><td>swatch-size</td><td>{layout.swatchSizeSaved}px (saved) / {layout.swatchSizeRecent}px (recent)</td></tr>
                <tr><td>icon-btn-size</td><td>{layout.iconBtnSize}px</td></tr>
                <tr><td>align-cell</td><td>{layout.alignCell}px</td></tr>
                <tr><td>color-swatch</td><td>{layout.colorSwatch}px</td></tr>
                <tr><td>slider-height</td><td>{layout.sliderHeight}px</td></tr>
                <tr><td>picker-canvas</td><td>{layout.pickerCanvasWidth} x {layout.pickerCanvasHeight}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card" data-component="BorderTokens">
            <div className="card-label">Borders &amp; Shadows</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><div className="variant-label">Panel Shadow</div><div style={{ width: 200, height: 40, background: color.background, borderRadius: layout.panelRadius, border: `1px solid ${border.default}`, boxShadow: shadow.panel }} /></div>
              <div><div className="variant-label">Dropdown Shadow</div><div style={{ width: 200, height: 40, background: color.popover, borderRadius: 4, border: `1px solid ${surface.track}`, boxShadow: shadow.dropdown }} /></div>
              <div><div className="variant-label">Picker Shadow</div><div style={{ width: 200, height: 40, background: color.popover, borderRadius: 8, boxShadow: shadow.picker }} /></div>
              <div><div className="variant-label">Focus Ring</div><div style={{ width: 200, height: 28, background: color.input, border: `1px solid ${border.default}`, borderRadius: 3, boxShadow: focusRing }} /></div>
              <div><div className="variant-label">Separator</div><div style={{ width: 200, height: 1, background: border.subtle }} /></div>
            </div>
          </div>

          <div className="card" data-component="TimingTokens">
            <div className="card-label">Timing Tokens (from timing.ts)</div>
            <table className="token-table">
              <tbody>
                <tr><th>Key</th><th>Duration</th><th>Usage</th></tr>
                {Object.entries(timing).map(([key, val]) => (
                  <tr key={key}><td>{key}</td><td>{val}ms</td><td>{timingDescs[key]}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {Object.entries(timing).map(([key, val]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: Math.round(val / 3), height: 6, background: color.primary, borderRadius: 2 }} />
                  <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.6) }}>{val}ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION B -- Atomic Components (Interactive)                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">B — Atomic Components</h1>
        <div className="showcase-grid">

          {/* SliderRow */}
          <div className="card" style={{ width: 340 }} data-component="SliderRow">
            <div className="card-label">SliderRow — Drag to adjust</div>
            <div className="variant-col"><div className="variant-label">Default (drag me)</div><InteractiveSlider label="Size" initialPct={40} maxVal={48} /></div>
            <div className="variant-col"><div className="variant-label">Modified (blue label)</div><InteractiveSlider label="Size" initialPct={65} maxVal={48} modified /></div>
            <div className="variant-col">
              <div className="variant-label">With UnitSelector (click unit)</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Width</span>
                <div style={{ flex: 1 }}><InteractiveSlider label="" initialPct={50} maxVal={400} /></div>
                <InteractiveUnitSelector />
              </div>
            </div>
          </div>

          {/* SizeInputCell */}
          <div className="card" style={{ width: 260 }} data-component="SizeInputCell">
            <div className="card-label">SizeInputCell</div>
            <div className="variant-col"><div className="variant-label">Numeric</div>
              <div style={sizeInputCellBase}><div style={sizeInputLabel}>Width</div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={sizeInputValue}>200</span></div><div style={{ flexShrink: 0, paddingRight: 3 }}><span style={sizeInputUnit}>px</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Keyword (&quot;auto&quot;)</div>
              <div style={sizeInputCellBase}><div style={sizeInputLabel}>Width</div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeInputValue, textTransform: "capitalize" }}>Auto</span></div><div style={{ flexShrink: 0, paddingRight: 3 }}><span style={sizeInputUnit}>&ndash;</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Linked Variable (purple pill)</div>
              <div style={sizeInputCellBase}><div style={sizeInputLabel}>Width</div><div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.15), border: `1px solid ${variableAlpha(0.3)}`, height: 22, minWidth: 0, overflow: "hidden" }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>container-w</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Modified (blue highlight)</div>
              <div style={{ ...sizeInputCellBase, background: primaryAlpha(0.06), border: `1px solid ${primaryAlpha(0.25)}` }}><div style={{ ...sizeInputLabel, color: color.primary }}>Width</div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={sizeInputValue}>320</span></div><div style={{ flexShrink: 0, paddingRight: 3 }}><span style={sizeInputUnit}>px</span></div></div>
            </div>
          </div>

          {/* IconButtonGroup */}
          <div className="card" style={{ width: 340 }} data-component="IconButtonGroup">
            <div className="card-label">IconButtonGroup — Click to select</div>
            <div className="variant-col"><div className="variant-label">Single Select (text-align)</div>
              <InteractiveIconGroup icons={[<AlignLeftIcon key="l" />, <AlignCenterIcon key="c" />, <AlignRightIcon key="r" />, <AlignJustifyIcon key="j" />]} initialActive={1} />
            </div>
            <div className="variant-col"><div className="variant-label">Multi Select (text-decoration)</div>
              <InteractiveIconGroup icons={[<StrikeIcon key="s" />, <BoldIcon key="b" />, <UnderlineIcon key="u" />]} initialActive={[2]} multiSelect />
            </div>
            <div className="variant-col"><div className="variant-label">Direction Icons</div>
              <InteractiveIconGroup icons={[<RowIcon key="row" />, <ColIcon key="col" />, <WrapIcon key="wrap" />]} initialActive={0} />
            </div>
          </div>

          {/* AlignBox */}
          <div className="card" style={{ width: 260 }} data-component="AlignBox">
            <div className="card-label">AlignBox — Click cells &amp; spacing</div>
            <InteractiveAlignBox />
          </div>

          {/* UnitSelector */}
          <div className="card" style={{ width: 260 }} data-component="UnitSelector">
            <div className="card-label">UnitSelector — Click to open</div>
            <div className="variant-row">
              <div className="variant-col"><div className="variant-label">Click the pill</div><InteractiveUnitSelector initialUnit="px" /></div>
              <div className="variant-col"><div className="variant-label">Another instance</div><InteractiveUnitSelector initialUnit="rem" /></div>
            </div>
          </div>

          {/* SpacingBoxModel */}
          <div className="card" style={{ width: 310 }} data-component="SpacingBoxModel">
            <div className="card-label">SpacingBoxModel — Click values to edit</div>
            <InteractiveSpacingBox />
          </div>

          {/* DisplayTabs */}
          <div className="card" style={{ width: 340 }} data-component="DisplayTabs">
            <div className="card-label">DisplayTabs — Click to switch</div>
            <div className="variant-col"><div className="variant-label">Layout display</div><InteractiveDisplayTabs options={["block", "flex", "grid", "none"]} initialActive={0} /></div>
            <div className="variant-col"><div className="variant-label">Position</div><InteractiveDisplayTabs options={["static", "relative", "absolute", "fixed", "sticky"]} initialActive={0} /></div>
          </div>

          {/* SelectRow */}
          <div className="card" style={{ width: 320 }} data-component="SelectRow">
            <div className="card-label">SelectRow — Click to open dropdown</div>
            <InteractiveSelect label="Weight" options={["300 - Light", "400 - Regular", "500 - Medium", "600 - Semi Bold", "700 - Bold"]} initialIndex={1} />
            <InteractiveSelect label="Family" options={["Inter", "SF Pro", "Roboto", "Helvetica", "Georgia", "Menlo"]} initialIndex={0} />
          </div>

          {/* ColorRow */}
          <div className="card" style={{ width: 320 }} data-component="ColorRow">
            <div className="card-label">ColorRow</div>
            <div className="variant-col"><div className="variant-label">Default (hex)</div>
              <div style={rowStyle}><span style={labelStyle}>Color</span><div style={{ width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4, background: color.primary, border: `1px solid ${surface.track}`, flexShrink: 0 }} /><span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.7) }}>{color.primary}</span></div>
            </div>
            <div className="variant-col"><div className="variant-label">Linked Variable (purple pill)</div>
              <div style={rowStyle}><span style={labelStyle}>Color</span><div style={{ display: "flex", alignItems: "center", padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.15), border: `1px solid ${variableAlpha(0.3)}`, height: 22, minWidth: 0, overflow: "hidden" }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>brand-primary</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Transparent</div>
              <div style={rowStyle}><span style={labelStyle}>BG</span><div style={{ width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4, background: "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px", border: `1px solid ${surface.track}`, flexShrink: 0 }} /><span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.7) }}>transparent</span></div>
            </div>
          </div>

          {/* VariableField */}
          <div className="card" style={{ width: 320 }} data-component="VariableField">
            <div className="card-label">VariableField — Purple Pill</div>
            <div className="variant-col"><div className="variant-label">Default (linked)</div>
              <div style={rowStyle}><span style={labelStyle}>Gap</span><div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden", height: 26, padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.15), border: `1px solid ${variableAlpha(0.3)}`, cursor: "pointer" }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>space-4</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Hovered (with pencil)</div>
              <div style={rowStyle}><span style={labelStyle}>Gap</span><div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden", height: 26, padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.22), border: `1px solid ${variableAlpha(0.3)}`, cursor: "pointer", gap: 4 }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>space-4</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color.variable} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Long name (truncated)</div>
              <div style={rowStyle}><span style={labelStyle}>Height</span><div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden", height: 26, padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.15), border: `1px solid ${variableAlpha(0.3)}`, cursor: "pointer" }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>border-width-medium</span></div></div>
            </div>
            <div className="variant-col"><div className="variant-label">Color (compact)</div>
              <div style={rowStyle}><span style={labelStyle}>Color</span><div style={{ display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden", height: 26, padding: "0 6px", borderRadius: layout.pillRadius, background: variableAlpha(0.15), border: `1px solid ${variableAlpha(0.3)}`, cursor: "pointer" }}><span style={{ color: color.variable, fontSize: 11, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>color-amber-300</span></div></div>
            </div>
          </div>

          {/* ConnectPicker */}
          <div className="card" style={{ width: 240 }} data-component="ConnectPicker">
            <div className="card-label">Connect Picker</div>
            <div style={{ background: color.background, border: `1px solid ${border.default}`, borderRadius: 6, boxShadow: shadow.dropdown, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 4px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: text.primary }}>Connect</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={text.hint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>
              </div>
              <div style={{ padding: "6px 6px 4px", borderBottom: `1px solid ${border.subtle}` }}>
                <div style={{ height: 24, background: surface.subtle, border: `1px solid ${border.default}`, borderRadius: 4, padding: "0 6px", fontSize: 10, fontFamily: font.mono, color: text.hint, display: "flex", alignItems: "center" }}>Search variables...</div>
              </div>
              <div style={{ padding: "2px 0" }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: text.disabled, padding: "6px 8px 2px" }}>SPACING</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 3, background: primaryAlpha(0.1) }}><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint, width: 14, textAlign: "center" }}>px</span><span style={{ fontSize: 10, fontFamily: font.mono, color: color.primary, flex: 1 }}>space-4</span><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint }}>16px</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint, width: 14, textAlign: "center" }}>px</span><span style={{ fontSize: 10, fontFamily: font.mono, color: text.primary, flex: 1 }}>space-8</span><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint }}>32px</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint, width: 14, textAlign: "center" }}>px</span><span style={{ fontSize: 10, fontFamily: font.mono, color: text.primary, flex: 1 }}>space-12</span><span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint }}>48px</span></div>
              </div>
            </div>
          </div>

          {/* EditVariablePopover */}
          <div className="card" style={{ width: 260 }} data-component="EditVariablePopover">
            <div className="card-label">Edit Variable Popover</div>
            <div style={{ background: color.background, border: `1px solid ${border.default}`, borderRadius: 6, boxShadow: shadow.dropdown, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: text.primary }}>Edit variable</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label }}>Name</span>
                <div style={{ height: 28, background: surface.subtle, border: `1px solid ${border.default}`, borderRadius: 4, padding: "0 8px", fontSize: 11, fontFamily: font.mono, color: text.primary, display: "flex", alignItems: "center" }}>space-4</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label }}>Value</span>
                <div style={{ height: 28, background: surface.subtle, border: `1px solid ${border.default}`, borderRadius: 4, padding: "0 8px", fontSize: 11, fontFamily: font.mono, color: text.primary, display: "flex", alignItems: "center" }}>16px</div>
              </div>
            </div>
          </div>

          {/* StyleIndicator */}
          <div className="card" style={{ width: 320 }} data-component="StyleIndicator">
            <div className="card-label">StyleIndicator — All 5 Types</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(["direct", "inherited", "state", "element", "variable"] as const).map((type) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: indicatorColor[type], boxShadow: `0 0 3px ${indicatorColor[type]}` }} />
                  <span style={{ fontSize: 10, color: blackAlpha(0.7) }} className="mono">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Pills */}
          <div className="card" style={{ width: 280 }} data-component="ScopePills">
            <div className="card-label">Scope Pills — Click to switch</div>
            <InteractiveScopePills labels={["element", ".btnPrimary", ".flex"]} initialActive={0} />
          </div>

          {/* Footer Buttons */}
          <div className="card" style={{ width: 380 }} data-component="FooterButtons">
            <div className="card-label">Footer Buttons — Hover &amp; click</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <div className="variant-col"><div className="variant-label">Standard</div><HoverButton style={footerBtnStandard} hoverStyle={{ background: surface.active }}>Clipboard <span style={{ fontSize: 11, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></HoverButton></div>
              <div className="variant-col"><div className="variant-label">Primary (Save)</div><HoverButton style={footerBtnPrimary} hoverStyle={{ background: color.primaryHover }}>Save</HoverButton></div>
              <div className="variant-col"><div className="variant-label">Destructive</div><HoverButton style={{ padding: "4px 8px", fontSize: 12, fontFamily: font.sans, borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(239,68,68,0.15)", borderRadius: 6, background: surface.hover, color: "rgba(239,68,68,0.8)", cursor: "pointer" }} hoverStyle={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }}>Reset</HoverButton></div>
              <div className="variant-col"><div className="variant-label">Disabled</div><HoverButton style={footerBtnPrimary} disabled>Save</HoverButton></div>
            </div>
          </div>

          {/* Section Header */}
          <div className="card" style={{ width: 300 }} data-component="SectionHeader">
            <div className="card-label">Section Header — Click to toggle</div>
            <ToggleSection title="Layout" hasIndicator defaultOpen><div style={{ padding: "4px 12px", fontSize: 11, color: blackAlpha(0.6) }}>Section content shown when expanded...</div></ToggleSection>
            <ToggleSection title="Typography"><div style={{ padding: "4px 12px", fontSize: 11, color: blackAlpha(0.6) }}>Typography section content...</div></ToggleSection>
            <ToggleSection title="Backgrounds"><div style={{ padding: "4px 12px", fontSize: 11, color: blackAlpha(0.6) }}>Backgrounds section content...</div></ToggleSection>
          </div>

          {/* PresetChips */}
          <div className="card" style={{ width: 280 }} data-component="PresetChips">
            <div className="card-label">PresetChips — Click to select</div>
            <div className="variant-col"><div className="variant-label">Width presets</div><InteractivePresetChips values={["auto", "100%", "fit-content"]} /></div>
            <div className="variant-col"><div className="variant-label">Border-radius presets</div><InteractivePresetChips values={["0", "4", "8", "9999"]} /></div>
          </div>

          {/* DragHandle */}
          <div className="card" style={{ width: 200 }} data-component="DragHandle">
            <div className="card-label">DragHandle</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0", background: color.background, borderRadius: 4, cursor: "grab" }}>
              <div style={{ width: 28, height: 3, borderRadius: 1.5, background: surface.active }} />
            </div>
          </div>

          {/* Changes Badge */}
          <div className="card" style={{ width: 200 }} data-component="ChangesBadge">
            <div className="card-label">Changes Badge</div>
            <div className="variant-row">
              <div className="variant-col"><div className="variant-label">With count</div><ChangesBadgeCount count={5} /></div>
              <div className="variant-col"><div className="variant-label">Breakpoint badge</div><BreakpointBadge label="lg" /></div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="card" style={{ width: 340 }} data-component="TabBar">
            <div className="card-label">TabBar — Click to switch</div>
            <div className="variant-col">
              <div className="variant-label">Panel tabs</div>
              <div style={{ background: color.background, borderRadius: 6, overflow: "hidden", border: `1px solid ${blackAlpha(0.07)}` }}>
                <InteractiveTabBar tabs={["Common", "Custom", "Prompt"]} initialActive={1} />
              </div>
            </div>
            <div className="variant-col">
              <div className="variant-label">Custom tab set</div>
              <div style={{ background: color.background, borderRadius: 6, overflow: "hidden", border: `1px solid ${blackAlpha(0.07)}` }}>
                <InteractiveTabBar tabs={["Styles", "Computed", "Variables"]} initialActive={0} />
              </div>
            </div>
          </div>

          {/* Label Indicator Styles */}
          <div className="card" style={{ width: 340 }} data-component="LabelIndicator">
            <div className="card-label">Label Indicator — Webflow-style</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(["modified", "none"] as const).map((type) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontFamily: font.sans,
                    background: labelIndicator[type].bg,
                    color: labelIndicator[type].text,
                    padding: "1px 6px", borderRadius: 3,
                    minWidth: layout.labelWidth,
                  }}>
                    {type === "modified" ? "Width" : "Height"}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: font.mono, color: blackAlpha(0.55), textTransform: "uppercase" }}>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* State Selector */}
          <div className="card" style={{ width: 260 }} data-component="StateSelector">
            <div className="card-label">StateSelector — Click to open</div>
            <div className="variant-row">
              <div className="variant-col">
                <div className="variant-label">Default state</div>
                <InteractiveStateSelector />
              </div>
              <div className="variant-col">
                <div className="variant-label">Hover state</div>
                <InteractiveStateSelector initialState=":hover" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION C -- Full Panel Compositions (Interactive)                */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">C — Full Panel Compositions</h1>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>

          {/* Panel 1: Live Panel (real WebflowPanel against styled element) */}
          <div data-component="FullPanel" data-variant="live">
            <div className="variant-label" style={{ marginBottom: 8 }}>Live Panel — real components, real computed styles</div>
            <ShowcaseLivePanel />
          </div>

          {/* Panel 2: All Collapsed */}
          <div data-component="FullPanel" data-variant="all-collapsed">
            <div className="variant-label" style={{ marginBottom: 8 }}>All Sections Collapsed</div>
            <div style={panelShell}>
              <PanelHeader tag="<div>" className=".container" />
              <InteractiveTabBar tabs={["Common", "Custom", "Prompt"]} initialActive={0} />
              {["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects"].map((s) => (
                <ToggleSection key={s} title={s} />
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: layout.footerPadding, borderTop: `1px solid ${blackAlpha(0.07)}` }}>
                <HoverButton style={footerBtnStandard} disabled>Clipboard <span style={{ fontSize: 11, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></HoverButton>
                <div style={{ display: "flex", gap: 6 }}><HoverButton style={footerBtnPrimary} disabled>Save</HoverButton></div>
              </div>
            </div>
          </div>

          {/* Panel 3: Variables Panel */}
          <div data-component="VariablesPanel">
            <div className="variant-label" style={{ marginBottom: 8 }}>Variables Panel — Master-Detail</div>
            <div style={{ ...panelShell, width: 716, display: "flex" }}>
              {/* Left Sidebar */}
              <div style={{ width: 170, borderRight: `1px solid ${border.subtle}`, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "8px 8px 6px", borderBottom: `1px solid ${border.subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, fontFamily: font.sans, color: text.primary }}>Variables</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ fontSize: 14, color: text.label, cursor: "pointer" }}>+</span>
                    <span style={{ fontSize: 14, color: text.label, cursor: "pointer" }}>‹</span>
                  </div>
                </div>
                <div style={{ padding: "4px 0", flex: 1 }}>
                  {["Border", "Color", "Container", "Font", "Interactive", "Letter", "Line", "Radius", "Shadow", "Space", "Status", "Surface", "Text"].map((name) => {
                    const isSelected = name === "Border";
                    return (
                      <div key={name} style={{
                        padding: "4px 8px", margin: "0 4px", borderRadius: 3,
                        fontSize: 11, fontFamily: font.sans, color: text.primary,
                        background: isSelected ? surface.hover : "transparent",
                        borderLeft: isSelected ? `2px solid ${color.primary}` : "2px solid transparent",
                        lineHeight: "20px", cursor: "pointer",
                        display: "flex", justifyContent: "space-between",
                      }}>
                        <span>{name}</span>
                        <span style={{ fontSize: 9, color: text.hint }}>auto</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Right Detail */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {/* Detail Header */}
                <div style={{ padding: "10px 12px 6px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font.sans, color: text.primary, marginBottom: 6 }}>Border</div>
                  {/* Column headers — multi-mode */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 14, flexShrink: 0 }} />
                    <div style={{ width: 100, flexShrink: 0, fontSize: 10, fontWeight: 500, fontFamily: font.sans, color: text.hint, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Name</div>
                    <div style={{ flex: 1, minWidth: 120, fontSize: 10, fontWeight: 500, fontFamily: font.sans, color: text.hint, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Base</div>
                    <div style={{ flex: 1, minWidth: 120, fontSize: 10, fontWeight: 500, fontFamily: font.sans, color: text.hint, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Dark</div>
                    <div style={{ width: 38, flexShrink: 0 }} />
                  </div>
                </div>
                {/* Subgroup header */}
                <div style={{ padding: "6px 12px 2px", fontSize: 11, fontWeight: 600, fontFamily: font.sans, color: text.label }}>border</div>
                {/* Variable rows */}
                <div style={{ flex: 1, overflowY: "auto" as const, padding: "4px 0" }}>
                  {([
                    { name: "accent", colorValue: color.primary, base: "color-brand-...", dark: "color-brand-...", hasDark: true },
                    { name: "default", colorValue: blackAlpha(0.15), base: "color-neutra...", dark: "color-neutra...", hasDark: true },
                    { name: "error", colorValue: color.destructive, base: "color-red-500", dark: null, hasDark: false },
                    { name: "strong", colorValue: blackAlpha(0.35), base: "color-neutra...", dark: "color-neutra...", hasDark: true },
                    { name: "subtle", colorValue: blackAlpha(0.08), base: "color-neutra...", dark: "color-neutra...", hasDark: true },
                    { name: "success", colorValue: color.success, base: "color-green-...", dark: null, hasDark: false },
                    { name: "warning", colorValue: "#F59E0B", base: "color-amber-...", dark: null, hasDark: false },
                  ] as const).map((v) => (
                    <div key={v.name} style={{ display: "flex", gap: 6, padding: "8px 12px", minHeight: 26, alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, flexShrink: 0 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: v.colorValue, border: `1px solid ${blackAlpha(0.1)}` }} />
                      </span>
                      <span className="mono" style={{ width: 100, flexShrink: 0, fontSize: 11, color: text.primary }}>{v.name}</span>
                      {/* Base mode — purple pill */}
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: font.mono,
                          background: variableAlpha(0.15), color: color.variable, border: `1px solid ${variableAlpha(0.3)}`,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "100%",
                        }}>{v.base}</span>
                      </div>
                      {/* Dark mode — purple pill or + */}
                      <div style={{ flex: 1, minWidth: 120 }}>
                        {v.hasDark ? (
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: font.mono,
                            background: variableAlpha(0.15), color: color.variable, border: `1px solid ${variableAlpha(0.3)}`,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "100%",
                          }}>{v.dark}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: text.hint, cursor: "pointer" }}>+</span>
                        )}
                      </div>
                      <div style={{ width: 38, flexShrink: 0 }} />
                    </div>
                  ))}
                  {/* Length variables (non-color) */}
                  {[
                    { name: "width-medium", value: "2px" },
                    { name: "width-thick", value: "4px" },
                    { name: "width-thin", value: "1px" },
                  ].map((v) => (
                    <div key={v.name} style={{ display: "flex", gap: 6, padding: "8px 12px", minHeight: 26, alignItems: "center" }}>
                      <span style={{ width: 14, flexShrink: 0, fontSize: 10, fontFamily: font.mono, color: text.hint, textAlign: "center" as const, lineHeight: 1 }}>↗</span>
                      <span className="mono" style={{ width: 100, flexShrink: 0, fontSize: 11, color: text.primary }}>{v.name}</span>
                      <span className="mono" style={{ flex: 1, minWidth: 120, fontSize: 11, color: blackAlpha(0.7) }}>{v.value}</span>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <span style={{ fontSize: 12, color: text.hint, cursor: "pointer" }}>+</span>
                      </div>
                      <div style={{ width: 38, flexShrink: 0 }} />
                    </div>
                  ))}
                  {/* New variable button */}
                  <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: text.hint, cursor: "pointer" }}>
                    <span>+</span> <span>New variable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 4: Navigator Panel */}
          <div data-component="NavigatorPanel">
            <div className="variant-label" style={{ marginBottom: 8 }}>Navigator Panel — DOM Tree</div>
            <div style={{ ...panelShell, width: 300 }}>
              {/* Navigator header */}
              <div style={{ height: 36, display: "flex", alignItems: "center", padding: "0 8px", borderBottom: `1px solid ${border.subtle}`, userSelect: "none" as const }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: font.sans, color: text.primary, marginRight: 6 }}>Navigator</span>
                <span style={{ fontSize: 10, fontFamily: font.sans, color: text.hint }}>134 elements</span>
                <div style={{ flex: 1 }} />
                <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: text.label, borderRadius: 4, cursor: "pointer" }}>‹</div>
              </div>
              {/* Tree rows */}
              <div style={{ padding: "2px 0" }}>
                {[
                  { tag: "html", cls: null, depth: 0, expanded: true, selected: false },
                  { tag: "body", cls: null, depth: 1, expanded: true, selected: false },
                  { tag: "div", cls: "page", depth: 2, expanded: true, selected: false },
                  { tag: "main", cls: "layout", depth: 3, expanded: true, selected: false },
                  { tag: "section", cls: "hero", depth: 4, expanded: true, selected: true },
                  { tag: "h1", cls: "title", depth: 5, expanded: false, selected: false, leaf: true },
                  { tag: "p", cls: "subtitle", depth: 5, expanded: false, selected: false, leaf: true },
                  { tag: "div", cls: "cta", depth: 5, expanded: false, selected: false },
                  { tag: "a", cls: "btn", depth: 6, expanded: false, selected: false, leaf: true },
                  { tag: "section", cls: "features", depth: 4, expanded: false, selected: false },
                  { tag: "section", cls: "pricing", depth: 4, expanded: false, selected: false },
                  { tag: "section", cls: "testimonials", depth: 4, expanded: false, selected: false },
                  { tag: "footer", cls: "footer", depth: 3, expanded: false, selected: false },
                ].map((node, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", height: 26,
                    paddingLeft: node.depth * 16 + 4, paddingRight: 8,
                    fontSize: 11, fontFamily: font.mono, cursor: "pointer",
                    color: node.selected ? color.primary : text.primary,
                    background: node.selected ? primaryAlpha(0.08) : "transparent",
                    borderLeft: node.selected ? `2px solid ${color.primary}` : "2px solid transparent",
                  }}>
                    {/* Expand chevron */}
                    <span style={{
                      width: 16, flexShrink: 0, fontSize: 9,
                      color: node.leaf ? "transparent" : text.label,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transform: node.expanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}>▶</span>
                    <span style={{ color: node.selected ? color.primary : text.secondary }}>{node.tag}</span>
                    {node.cls && <span style={{ color: node.selected ? primaryAlpha(0.7) : text.hint }}>.{node.cls}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel 5: Toolbar (Expanded) */}
          <div data-component="Toolbar">
            <div className="variant-label" style={{ marginBottom: 8 }}>Toolbar — Expanded Pill</div>
            <div style={{
              height: 48, borderRadius: 24, display: "inline-flex", alignItems: "center",
              background: surface.darkToolbar,
              border: `1px solid ${darkToolbar.border}`,
              boxShadow: `0 4px 20px ${blackAlpha(0.25)}, 0 0 0 0.5px ${bgAlpha(0.06)}`,
              padding: "0 8px", gap: 2,
            }}>
              {[
                { label: "Select", active: true },
                { label: "Variables", active: false },
                { label: "AI", active: false },
                { label: "Changes", active: false },
              ].map((btn) => (
                <div key={btn.label} style={{
                  height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  paddingLeft: 10, paddingRight: 10,
                  fontSize: 12, fontWeight: btn.active ? 500 : 400, fontFamily: font.sans,
                  color: btn.active ? darkToolbar.text : darkToolbar.textMuted,
                  background: btn.active ? darkToolbar.active : "transparent",
                  cursor: "pointer", whiteSpace: "nowrap" as const,
                }}>{btn.label}</div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION D -- Overlay Components (Interactive)                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">D — Overlay Components</h1>
        <div className="showcase-grid">
          <div className="card" style={{ width: 280 }} data-component="ColorPickerEnhanced">
            <div className="card-label">ColorPickerEnhanced — Drag handles</div>
            <InteractiveColorPicker />
          </div>
          <div className="card" style={{ width: 200 }} data-component="CopyDropdownMenu">
            <div className="card-label">Copy Dropdown — Hover items</div>
            <InteractiveCopyDropdown formats={["CSS", "Tailwind", "CSS Variables", "SCSS (commented)"]} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TOKEN MAPPING REFERENCE TABLE                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }} data-component="TokenMapping">
        <h1 className="section-title">Figma Token Mapping Reference</h1>
        <p className="section-subtitle">After import, create Figma Variables from this table so edits propagate globally.</p>
        <table className="token-table" style={{ width: "100%", maxWidth: 700 }}>
          <tbody>
            <tr><th>Code Token</th><th>Value</th><th>Figma Variable Name</th></tr>
            {tokenRows.map((row) => (
              <tr key={row.code}><td>{row.code}</td><td>{row.value}</td><td>{row.figma}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
