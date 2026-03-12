"use client";

import {
  color,
  text,
  border,
  surface,
  font,
  layout,
  shadow,
  indicatorColor,
  spacingZone,
  primaryAlpha,
  blackAlpha,
  focusRing,
  checkerboard,
  filledTrackBg,
} from "@/overlay/theme";
import { timing } from "@/overlay/timing";

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
  { code: "indicatorColor.direct", value: indicatorColor.direct, figma: "colors/indicator/direct" },
  { code: "indicatorColor.inherited", value: indicatorColor.inherited, figma: "colors/indicator/inherited" },
  { code: "indicatorColor.state", value: indicatorColor.state, figma: "colors/indicator/state" },
  { code: "indicatorColor.element", value: indicatorColor.element, figma: "colors/indicator/element" },
  { code: "indicatorColor.variable", value: indicatorColor.variable, figma: "colors/indicator/variable" },
  { code: "spacingZone.marginBase", value: spacingZone.marginBase, figma: "colors/spacing/margin" },
  { code: "spacingZone.marginHover", value: spacingZone.marginHover, figma: "colors/spacing/margin-hover" },
  { code: "spacingZone.paddingBase", value: spacingZone.paddingBase, figma: "colors/spacing/padding" },
  { code: "spacingZone.paddingHover", value: spacingZone.paddingHover, figma: "colors/spacing/padding-hover" },
  { code: "font.sans", value: font.sans, figma: "typography/family/system" },
  { code: "font.mono", value: font.mono, figma: "typography/family/mono" },
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
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: blackAlpha(0.75),
};

const chevronWrapStyle: React.CSSProperties = {
  color: blackAlpha(0.55),
  display: "flex",
  alignItems: "center",
};

const collapsedSectionStyle: React.CSSProperties = {
  borderBottom: `1px solid ${surface.subtle}`,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  padding: layout.rowPadding,
  background: color.background,
  borderRadius: 4,
};

const labelStyle: React.CSSProperties = {
  width: layout.labelWidth,
  fontSize: 11,
  color: blackAlpha(0.7),
  flexShrink: 0,
};

const valueInputStyle: React.CSSProperties = {
  width: layout.inputWidth,
  background: color.input,
  border: `1px solid ${blackAlpha(0.07)}`,
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
};

// ─── Sub-components for DRY rendering ───────────────────────────────────────

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
    }} />
  );
}

function SliderTrack({ pct, hover }: { pct: number; hover?: boolean }) {
  return (
    <div style={{
      flex: 1,
      height: layout.sliderHeight,
      background: hover ? sliderTrackHover(pct) : sliderTrack(pct),
      borderRadius: 2,
      position: "relative",
    }}>
      <SliderThumb pct={pct} />
    </div>
  );
}

function AlignLines() {
  return (
    <>
      <div style={{ width: 8, height: 2, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: 5, height: 2, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: 7, height: 2, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
    </>
  );
}

function AlignCell({ justify, align, active }: { justify: string; align: string; active?: boolean }) {
  return (
    <div style={{
      width: layout.alignCell,
      height: layout.alignCell,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? color.primary : "transparent",
      color: active ? color.primaryForeground : blackAlpha(0.7),
    }}>
      <div style={{
        width: 16,
        height: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify as any,
        alignItems: align as any,
        gap: 1.5,
      }}>
        <AlignLines />
      </div>
    </div>
  );
}

function CollapsedSection({ title, hasIndicator }: { title: string; hasIndicator?: boolean }) {
  return (
    <div style={collapsedSectionStyle}>
      <div style={sectionHeaderStyle}>
        <span style={{ ...sectionTitleStyle, display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {hasIndicator && (
            <span style={{
              display: "inline-block",
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: indicatorColor.direct,
              boxShadow: `0 0 3px ${indicatorColor.direct}`,
            }} />
          )}
        </span>
        <span style={chevronWrapStyle}><ChevronSvg /></span>
      </div>
    </div>
  );
}

function ExpandedSectionHeader({ title, hasIndicator }: { title: string; hasIndicator?: boolean }) {
  return (
    <div style={sectionHeaderStyle}>
      <span style={{ ...sectionTitleStyle, display: "flex", alignItems: "center", gap: 6 }}>
        {title}
        {hasIndicator && (
          <span style={{
            display: "inline-block",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: indicatorColor.direct,
            boxShadow: `0 0 3px ${indicatorColor.direct}`,
          }} />
        )}
      </span>
      <span style={{ ...chevronWrapStyle, transform: "rotate(90deg)" }}><ChevronSvg /></span>
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
      fontSize: 9,
      fontFamily: font.mono,
      color: blackAlpha(0.6),
      background: color.input,
      border: `1px solid ${color.input}`,
      padding: "2px 6px",
      borderRadius: 3,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      lineHeight: "14px",
    }}>{label}</span>
  );
}

function ChangesBadgeCount({ count }: { count: number }) {
  return (
    <div style={{
      background: primaryAlpha(0.15),
      border: `1px solid ${primaryAlpha(0.2)}`,
      borderRadius: 3,
      color: primaryAlpha(0.95),
      fontSize: 9,
      fontWeight: 600,
      fontFamily: font.mono,
      padding: "2px 6px",
      lineHeight: "14px",
      minWidth: 18,
      textAlign: "center",
    }}>{count}</div>
  );
}

function ScopePill({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      padding: "2px 8px",
      fontSize: 10,
      fontFamily: font.mono,
      border: "none",
      borderRadius: 4,
      background: active ? surface.active : "transparent",
      color: active ? blackAlpha(0.87) : blackAlpha(0.7),
      lineHeight: "16px",
    }}>{label}</div>
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
            <div className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor.direct }} /><div className="swatch-name">direct</div><div className="swatch-value">{indicatorColor.direct}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor.inherited }} /><div className="swatch-name">inherited</div><div className="swatch-value">{indicatorColor.inherited}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor.state }} /><div className="swatch-name">state</div><div className="swatch-value">{indicatorColor.state}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor.element }} /><div className="swatch-name">element</div><div className="swatch-value">{indicatorColor.element}</div></div>
            <div className="swatch"><div className="swatch-box" style={{ width: 32, height: 32, background: indicatorColor.variable }} /><div className="swatch-name">variable</div><div className="swatch-value">{indicatorColor.variable}</div></div>
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
              <div>
                <div className="variant-label">Panel Shadow</div>
                <div style={{ width: 200, height: 40, background: color.background, borderRadius: layout.panelRadius, border: `1px solid ${border.default}`, boxShadow: shadow.panel }} />
              </div>
              <div>
                <div className="variant-label">Dropdown Shadow</div>
                <div style={{ width: 200, height: 40, background: color.popover, borderRadius: 4, border: `1px solid ${surface.track}`, boxShadow: shadow.dropdown }} />
              </div>
              <div>
                <div className="variant-label">Picker Shadow</div>
                <div style={{ width: 200, height: 40, background: color.popover, borderRadius: 8, boxShadow: shadow.picker }} />
              </div>
              <div>
                <div className="variant-label">Focus Ring</div>
                <div style={{ width: 200, height: 28, background: color.input, border: `1px solid ${border.default}`, borderRadius: 3, boxShadow: focusRing }} />
              </div>
              <div>
                <div className="variant-label">Separator</div>
                <div style={{ width: 200, height: 1, background: border.subtle }} />
              </div>
            </div>
          </div>

          {/* Timing Tokens */}
          <div className="card" data-component="TimingTokens">
            <div className="card-label">Timing Tokens (from timing.ts)</div>
            <table className="token-table">
              <tbody>
                <tr><th>Key</th><th>Duration</th><th>Usage</th></tr>
                {Object.entries(timing).map(([key, val]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{val}ms</td>
                    <td>{timingDescs[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Visual bars */}
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
      {/* SECTION B -- Atomic Components                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">B — Atomic Components</h1>

        <div className="showcase-grid">

          {/* ─── SliderRow ─────────────────────────────────────────────── */}
          <div className="card" style={{ width: 340 }} data-component="SliderRow">
            <div className="card-label">SliderRow</div>

            <div className="variant-col" data-variant="default">
              <div className="variant-label">Default</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Size</span>
                <SliderTrack pct={40} />
                <div style={valueInputStyle}>16</div>
                <span style={unitLabelStyle}>px</span>
              </div>
            </div>

            <div className="variant-col" data-variant="hover">
              <div className="variant-label">Hover (bright track)</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Size</span>
                <SliderTrack pct={40} hover />
                <div style={valueInputStyle}>16</div>
                <span style={unitLabelStyle}>px</span>
              </div>
            </div>

            <div className="variant-col" data-variant="modified">
              <div className="variant-label">Modified (blue label + indicator)</div>
              <div style={rowStyle}>
                <span style={{ ...labelStyle, color: indicatorColor.direct, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: indicatorColor.direct, boxShadow: `0 0 3px ${indicatorColor.direct}` }} />
                  Size
                </span>
                <SliderTrack pct={65} />
                <div style={valueInputStyle}>24</div>
                <span style={unitLabelStyle}>px</span>
              </div>
            </div>

            <div className="variant-col" data-variant="with-unit-selector">
              <div className="variant-label">With UnitSelector</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Width</span>
                <SliderTrack pct={50} />
                <div style={valueInputStyle}>200</div>
                {/* UnitSelector pill */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 20,
                  padding: "0 4px",
                  border: "1px solid transparent",
                  borderRadius: 3,
                  color: blackAlpha(0.8),
                  fontSize: 10,
                  fontFamily: font.mono,
                  cursor: "pointer",
                }}>px</div>
              </div>
            </div>
          </div>

          {/* ─── SizeInputCell ────────────────────────────────────────── */}
          <div className="card" style={{ width: 260 }} data-component="SizeInputCell">
            <div className="card-label">SizeInputCell</div>

            <div className="variant-col" data-variant="numeric">
              <div className="variant-label">Numeric</div>
              <div style={sizeInputCellBase}>
                <div style={sizeInputLabel}>Width</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                  <span style={sizeInputValue}>200</span>
                </div>
                <div style={{ flexShrink: 0, paddingRight: 3 }}>
                  <span style={sizeInputUnit}>px</span>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="keyword">
              <div className="variant-label">Keyword (&quot;auto&quot;)</div>
              <div style={sizeInputCellBase}>
                <div style={sizeInputLabel}>Width</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                  <span style={{ ...sizeInputValue, textTransform: "capitalize" }}>Auto</span>
                </div>
                <div style={{ flexShrink: 0, paddingRight: 3 }}>
                  <span style={sizeInputUnit}>&ndash;</span>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="variable">
              <div className="variant-label">CSS Variable</div>
              <div style={sizeInputCellBase}>
                <div style={sizeInputLabel}>Width</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2, gap: 4, overflow: "hidden", minWidth: 0 }}>
                  <span style={{ color: indicatorColor.variable, fontSize: 10, fontFamily: font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>container-w</span>
                  <span style={{ color: blackAlpha(0.55), fontSize: 10, fontFamily: font.mono, flexShrink: 0 }}>768</span>
                </div>
                <div style={{ flexShrink: 0, paddingRight: 3 }}>
                  <span style={sizeInputUnit}>VAR</span>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="modified">
              <div className="variant-label">Modified (blue highlight)</div>
              <div style={{ ...sizeInputCellBase, background: primaryAlpha(0.10), border: `1px solid ${primaryAlpha(0.25)}` }}>
                <div style={{ ...sizeInputLabel, color: color.primary }}>Width</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                  <span style={sizeInputValue}>320</span>
                </div>
                <div style={{ flexShrink: 0, paddingRight: 3 }}>
                  <span style={sizeInputUnit}>px</span>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="editing">
              <div className="variant-label">Editing (focus)</div>
              <div style={sizeInputCellBase}>
                <div style={sizeInputLabel}>Width</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                  <div style={{
                    width: 36,
                    background: blackAlpha(0.07),
                    border: `1px solid ${primaryAlpha(0.5)}`,
                    borderRadius: 2,
                    color: blackAlpha(0.8),
                    fontSize: 10,
                    fontFamily: font.mono,
                    textAlign: "right",
                    padding: "1px 3px",
                  }}>200</div>
                </div>
                <div style={{ flexShrink: 0, paddingRight: 3 }}>
                  <span style={sizeInputUnit}>px</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── IconButtonGroup ──────────────────────────────────────── */}
          <div className="card" style={{ width: 340 }} data-component="IconButtonGroup">
            <div className="card-label">IconButtonGroup</div>

            <div className="variant-col" data-variant="single-select">
              <div className="variant-label">Single Select (text-align, &quot;center&quot; active)</div>
              <div style={{ display: "inline-flex" }}>
                <div style={{ ...iconBtnInactive, borderRadius: "4px 0 0 4px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                </div>
                <div style={{ ...iconBtnActive, borderLeft: "none", borderRadius: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
                </div>
                <div style={{ ...iconBtnInactive, borderLeft: "none", borderRadius: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
                </div>
                <div style={{ ...iconBtnInactive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="multi-select">
              <div className="variant-label">Multi Select (text-decoration, &quot;underline&quot; active)</div>
              <div style={{ display: "inline-flex" }}>
                <div style={{ ...iconBtnInactive, borderRadius: "4px 0 0 4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div style={{ ...iconBtnInactive, borderLeft: "none", borderRadius: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
                </div>
                <div style={{ ...iconBtnActive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="direction-icons">
              <div className="variant-label">Direction Icons (row active)</div>
              <div style={{ display: "inline-flex" }}>
                <div style={{ ...iconBtnActive, borderRadius: "4px 0 0 4px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div style={{ ...iconBtnInactive, borderLeft: "none", borderRadius: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                </div>
                <div style={{ ...iconBtnInactive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="10" y2="18"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* ─── AlignBox ────────────────────────────────────────────── */}
          <div className="card" style={{ width: 260 }} data-component="AlignBox">
            <div className="card-label">AlignBox</div>

            <div className="variant-row">
              <div className="variant-col" data-variant="center-center">
                <div className="variant-label">Center/Center active</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(3, ${layout.alignCell}px)`,
                    gridTemplateRows: `repeat(3, ${layout.alignCell}px)`,
                    border: `1px solid ${surface.track}`,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}>
                    {/* 3x3 grid of alignment cells */}
                    {(["flex-start", "center", "flex-end"] as const).map((vAlign) =>
                      (["flex-start", "center", "flex-end"] as const).map((hAlign) => {
                        const isActive = vAlign === "center" && hAlign === "center";
                        const isLastCol = hAlign === "flex-end";
                        const isLastRow = vAlign === "flex-end";
                        return (
                          <div
                            key={`${vAlign}-${hAlign}`}
                            style={{
                              borderRight: isLastCol ? undefined : `1px solid ${blackAlpha(0.07)}`,
                              borderBottom: isLastRow ? undefined : `1px solid ${blackAlpha(0.07)}`,
                            }}
                          >
                            <AlignCell justify={vAlign} align={hAlign} active={isActive} />
                          </div>
                        );
                      })
                    )}
                  </div>
                  {/* Spacing buttons */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {["Between", "Around", "Evenly"].map((label) => (
                      <div key={label} style={{
                        background: "transparent",
                        color: blackAlpha(0.7),
                        border: `1px solid ${surface.active}`,
                        borderRadius: 3,
                        fontSize: 9,
                        fontFamily: font.sans,
                        padding: "2px 6px",
                        lineHeight: "16px",
                      }}>{label}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── UnitSelector ────────────────────────────────────────── */}
          <div className="card" style={{ width: 260 }} data-component="UnitSelector">
            <div className="card-label">UnitSelector</div>

            <div className="variant-row">
              <div className="variant-col" data-variant="closed">
                <div className="variant-label">Closed Pill</div>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 20, padding: "0 4px", border: "1px solid transparent", borderRadius: 3,
                  color: blackAlpha(0.8), fontSize: 10, fontFamily: font.mono, cursor: "pointer",
                }}>px</div>
              </div>
              <div className="variant-col" data-variant="hover">
                <div className="variant-label">Hover</div>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 20, padding: "0 4px", background: surface.hover, border: `1px solid ${surface.track}`,
                  borderRadius: 3, color: blackAlpha(0.8), fontSize: 10, fontFamily: font.mono, cursor: "pointer",
                }}>px</div>
              </div>
              <div className="variant-col" data-variant="open">
                <div className="variant-label">Open</div>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 20, padding: "0 4px", background: primaryAlpha(0.25), border: `1px solid ${primaryAlpha(0.4)}`,
                  borderRadius: 3, color: color.primaryHover, fontSize: 10, fontFamily: font.mono, cursor: "pointer",
                }}>px</div>
              </div>
            </div>

            <div className="variant-col" data-variant="dropdown">
              <div className="variant-label">Open Dropdown</div>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 20, padding: "0 4px", background: primaryAlpha(0.25), border: `1px solid ${primaryAlpha(0.4)}`,
                  borderRadius: 3, color: color.primaryHover, fontSize: 10, fontFamily: font.mono,
                }}>px</div>
                <div style={{
                  position: "absolute", top: "calc(100% + 2px)", left: 0, minWidth: 42,
                  background: color.popover, border: `1px solid ${surface.track}`, borderRadius: 4,
                  boxShadow: shadow.dropdown, zIndex: 100, padding: "2px 0",
                }}>
                  {["px", "%", "em", "rem", "vw", "vh"].map((unit, i) => (
                    <div key={unit} style={{
                      padding: "3px 8px", fontSize: 10, fontFamily: font.mono, lineHeight: "16px",
                      color: i === 0 ? color.primaryForeground : blackAlpha(0.7),
                      background: i === 0 ? color.primary : "transparent",
                    }}>{unit}</div>
                  ))}
                  <div style={{ height: 1, background: blackAlpha(0.07), margin: "2px 0" }} />
                  {["Auto", "None"].map((kw) => (
                    <div key={kw} style={{
                      padding: "3px 8px", fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.7),
                      lineHeight: "16px", textTransform: "uppercase", letterSpacing: "0.03em",
                    }}>{kw}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── SpacingBoxModel ──────────────────────────────────────── */}
          <div className="card" style={{ width: 310 }} data-component="SpacingBoxModel">
            <div className="card-label">SpacingBoxModel</div>

            <div className="variant-col" data-variant="default">
              <div className="variant-label">Default</div>
              <div style={{ padding: 0 }}>
                <div style={{ position: "relative", border: `1px solid ${surface.active}`, borderRadius: 4, background: spacingZone.marginBase }}>
                  <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Margin</span>
                    <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "0 4px" }}>px</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
                    <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.55), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>0</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.55), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>0</span>
                    </div>
                    <div style={{ flex: 1, border: `1px solid ${surface.active}`, borderRadius: 3, background: spacingZone.paddingBase, margin: "2px 0", position: "relative" }}>
                      <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Padding</span>
                        <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "0 4px" }}>px</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
                        <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>16</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                          <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>24</span>
                        </div>
                        <div style={{ flex: 1, height: 14, background: surface.hover, borderRadius: 2, margin: "0 4px" }} />
                        <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                          <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>24</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
                        <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>16</span>
                      </div>
                    </div>
                    <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.55), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>0</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
                    <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.55), padding: "2px 4px", borderRadius: 3, minWidth: 18, textAlign: "center" }}>0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── DisplayTabs ─────────────────────────────────────────── */}
          <div className="card" style={{ width: 340 }} data-component="DisplayTabs">
            <div className="card-label">DisplayTabs</div>
            <div className="variant-row">
              <div className="variant-col" data-variant="block-active">
                <div className="variant-label">&quot;block&quot; active</div>
                <div style={{ display: "inline-flex" }}>
                  <div style={{ ...displayTabActive, borderRadius: "4px 0 0 4px" }}>block</div>
                  <div style={{ ...displayTabInactive, borderLeft: "none" }}>flex</div>
                  <div style={{ ...displayTabInactive, borderLeft: "none" }}>grid</div>
                  <div style={{ ...displayTabInactive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>none</div>
                </div>
              </div>
            </div>
            <div className="variant-col" data-variant="flex-active">
              <div className="variant-label">&quot;flex&quot; active</div>
              <div style={{ display: "inline-flex" }}>
                <div style={{ ...displayTabInactive, borderRadius: "4px 0 0 4px" }}>block</div>
                <div style={{ ...displayTabActive, borderLeft: "none" }}>flex</div>
                <div style={{ ...displayTabInactive, borderLeft: "none" }}>grid</div>
                <div style={{ ...displayTabInactive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>none</div>
              </div>
            </div>
          </div>

          {/* ─── SelectRow ───────────────────────────────────────────── */}
          <div className="card" style={{ width: 320 }} data-component="SelectRow">
            <div className="card-label">SelectRow</div>

            <div className="variant-col" data-variant="closed">
              <div className="variant-label">Closed</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Weight</span>
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{
                    width: "100%", height: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: color.input, border: `1px solid ${surface.active}`, borderRadius: 3,
                    color: blackAlpha(0.7), fontSize: 11, fontFamily: font.mono, padding: "0 6px",
                  }}>
                    <span>400 - Regular</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={border.strong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="variant-col" data-variant="open">
              <div className="variant-label">Open with options</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Weight</span>
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{
                    width: "100%", height: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: blackAlpha(0.07), border: `1px solid ${surface.active}`, borderRadius: 3,
                    color: blackAlpha(0.7), fontSize: 11, fontFamily: font.mono, padding: "0 6px",
                  }}>
                    <span>400 - Regular</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={border.strong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  <div style={{
                    position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
                    minWidth: "100%", maxHeight: 180, overflowY: "auto",
                    background: color.popover, border: `1px solid ${surface.track}`, borderRadius: 4,
                    boxShadow: shadow.dropdown, zIndex: 200, padding: "2px 0",
                  }}>
                    {["300 - Light", "400 - Regular", "500 - Medium", "600 - Semi Bold", "700 - Bold"].map((opt, i) => (
                      <div key={opt} style={{
                        padding: "4px 8px", fontSize: 11, fontFamily: font.mono, lineHeight: "16px",
                        color: i === 1 ? color.primaryForeground : blackAlpha(0.7),
                        background: i === 1 ? color.primary : "transparent",
                      }}>{opt}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── ColorRow ────────────────────────────────────────────── */}
          <div className="card" style={{ width: 320 }} data-component="ColorRow">
            <div className="card-label">ColorRow</div>

            <div className="variant-col" data-variant="default">
              <div className="variant-label">Default (hex)</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Color</span>
                <div style={{ width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4, background: color.primary, border: `1px solid ${surface.track}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.7) }}>{color.primary}</span>
              </div>
            </div>

            <div className="variant-col" data-variant="variable">
              <div className="variant-label">CSS Variable</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Color</span>
                <div style={{ width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4, background: color.primary, border: `2px solid ${primaryAlpha(0.6)}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontFamily: font.mono, color: primaryAlpha(0.8) }}>brand-primary</span>
              </div>
            </div>

            <div className="variant-col" data-variant="transparent">
              <div className="variant-label">Transparent</div>
              <div style={rowStyle}>
                <span style={labelStyle}>BG</span>
                <div style={{ width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4, background: "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px", border: `1px solid ${surface.track}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.7) }}>transparent</span>
              </div>
            </div>
          </div>

          {/* ─── StyleIndicator ──────────────────────────────────────── */}
          <div className="card" style={{ width: 320 }} data-component="StyleIndicator">
            <div className="card-label">StyleIndicator — All 5 Types</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(["direct", "inherited", "state", "element", "variable"] as const).map((type) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "inline-block", width: 4, height: 4, borderRadius: "50%",
                    background: indicatorColor[type], boxShadow: `0 0 3px ${indicatorColor[type]}`,
                  }} />
                  <span style={{ fontSize: 10, color: blackAlpha(0.7) }} className="mono">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Scope Pills ─────────────────────────────────────────── */}
          <div className="card" style={{ width: 280 }} data-component="ScopePills">
            <div className="card-label">Scope Pills</div>
            <div className="variant-col" data-variant="element-active">
              <div className="variant-label">&quot;element&quot; active</div>
              <div style={{ display: "flex", gap: 3 }}>
                <ScopePill label="element" active />
                <ScopePill label=".btnPrimary" />
                <ScopePill label=".flex" />
              </div>
            </div>
            <div className="variant-col" data-variant="class-active">
              <div className="variant-label">&quot;.btnPrimary&quot; active</div>
              <div style={{ display: "flex", gap: 3 }}>
                <ScopePill label="element" />
                <ScopePill label=".btnPrimary" active />
                <ScopePill label=".flex" />
              </div>
            </div>
          </div>

          {/* ─── Footer Buttons ──────────────────────────────────────── */}
          <div className="card" style={{ width: 380 }} data-component="FooterButtons">
            <div className="card-label">Footer Buttons</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <div className="variant-col" data-variant="standard">
                <div className="variant-label">Standard</div>
                <div style={footerBtnStandard}>Copy <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></div>
              </div>
              <div className="variant-col" data-variant="primary">
                <div className="variant-label">Primary (Save)</div>
                <div style={footerBtnPrimary}>Save</div>
              </div>
              <div className="variant-col" data-variant="destructive">
                <div className="variant-label">Destructive (Reset)</div>
                <div style={{
                  padding: "4px 8px", fontSize: 12, fontFamily: font.sans,
                  border: `1px solid rgba(239,68,68,0.15)`, borderRadius: 6,
                  background: surface.hover, color: "rgba(239,68,68,0.8)",
                }}>Reset</div>
              </div>
              <div className="variant-col" data-variant="active">
                <div className="variant-label">Active (Copy open)</div>
                <div style={{
                  padding: "4px 8px", fontSize: 12, fontFamily: font.sans,
                  border: "1px solid rgba(250,204,21,0.4)", borderRadius: 6,
                  background: "rgba(250,204,21,0.12)", color: "rgba(250,204,21,0.9)",
                }}>Copy <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></div>
              </div>
              <div className="variant-col" data-variant="disabled">
                <div className="variant-label">Disabled</div>
                <div style={{ ...footerBtnPrimary, opacity: 0.35 }}>Save</div>
              </div>
            </div>
          </div>

          {/* ─── Section Header ──────────────────────────────────────── */}
          <div className="card" style={{ width: 300 }} data-component="SectionHeader">
            <div className="card-label">Section Header</div>

            <div className="variant-col" data-variant="expanded">
              <div className="variant-label">Expanded</div>
              <div style={{ borderBottom: `1px solid ${color.input}`, background: color.background, borderRadius: 4 }}>
                <ExpandedSectionHeader title="Layout" hasIndicator />
              </div>
            </div>

            <div className="variant-col" data-variant="collapsed">
              <div className="variant-label">Collapsed</div>
              <div style={{ borderBottom: `1px solid ${color.input}`, background: color.background, borderRadius: 4 }}>
                <div style={sectionHeaderStyle}>
                  <span style={sectionTitleStyle}>Typography</span>
                  <span style={chevronWrapStyle}><ChevronSvg /></span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── PresetChips ─────────────────────────────────────────── */}
          <div className="card" style={{ width: 280 }} data-component="PresetChips">
            <div className="card-label">PresetChips</div>
            <div className="variant-col" data-variant="width-presets">
              <div className="variant-label">Width presets</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", padding: "0 12px" }}>
                {["auto", "100%", "fit-content"].map((v) => (
                  <span key={v} style={{ fontSize: 9, fontFamily: font.mono, color: blackAlpha(0.7), background: color.input, padding: "1px 5px", borderRadius: 3 }}>{v}</span>
                ))}
              </div>
            </div>
            <div className="variant-col" data-variant="border-radius-presets">
              <div className="variant-label">Border-radius presets</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", padding: "0 12px" }}>
                {["0", "4", "8", "9999"].map((v) => (
                  <span key={v} style={{ fontSize: 9, fontFamily: font.mono, color: blackAlpha(0.7), background: color.input, padding: "1px 5px", borderRadius: 3 }}>{v}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ─── DragHandle ──────────────────────────────────────────── */}
          <div className="card" style={{ width: 200 }} data-component="DragHandle">
            <div className="card-label">DragHandle</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0", background: color.background, borderRadius: 4 }}>
              <div style={{ width: 28, height: 3, borderRadius: 1.5, background: surface.active }} />
            </div>
          </div>

          {/* ─── Changes Badge ───────────────────────────────────────── */}
          <div className="card" style={{ width: 200 }} data-component="ChangesBadge">
            <div className="card-label">Changes Badge</div>
            <div className="variant-row">
              <div className="variant-col" data-variant="with-count">
                <div className="variant-label">With count</div>
                <ChangesBadgeCount count={5} />
              </div>
              <div className="variant-col" data-variant="breakpoint">
                <div className="variant-label">Breakpoint badge</div>
                <BreakpointBadge label="lg" />
              </div>
            </div>
          </div>

        </div>{/* end showcase-grid */}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION C -- Full Panel Compositions                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">C — Full Panel Compositions</h1>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>

          {/* Panel 1: Expanded */}
          <div data-component="FullPanel" data-variant="expanded">
            <div className="variant-label" style={{ marginBottom: 8 }}>All Sections Expanded</div>
            <div style={panelShell}>
              {/* Header */}
              <PanelHeader
                tag="<button>"
                className=".btnPrimary"
                showSource
                badges={<>
                  <BreakpointBadge label="lg" />
                  <ChangesBadgeCount count={3} />
                </>}
              />
              {/* Scope pills */}
              <div style={{ display: "flex", gap: 3, padding: "6px 12px 8px" }}>
                <ScopePill label="element" active />
                <ScopePill label=".btnPrimary" />
              </div>

              {/* Layout Section (expanded) */}
              <div style={{ borderBottom: `1px solid ${surface.subtle}` }}>
                <ExpandedSectionHeader title="Layout" />
                <div style={{ paddingBottom: layout.sectionBodyPadding }}>
                  {/* Display tabs */}
                  <div style={{ padding: layout.rowPadding }}>
                    <div style={{ display: "inline-flex" }}>
                      <div style={{ ...displayTabInactive, borderRadius: "4px 0 0 4px" }}>block</div>
                      <div style={{ ...displayTabActive, borderLeft: "none" }}>flex</div>
                      <div style={{ ...displayTabInactive, borderLeft: "none" }}>grid</div>
                      <div style={{ ...displayTabInactive, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>none</div>
                    </div>
                  </div>
                  {/* Gap slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: "6px 12px 2px" }}>
                    <span style={labelStyle}>Gap</span>
                    <SliderTrack pct={25} />
                    <div style={valueInputStyle}>12</div>
                    <span style={{ fontSize: 10, fontFamily: font.mono, color: blackAlpha(0.8), padding: "0 4px" }}>px</span>
                  </div>
                </div>
              </div>

              {/* Spacing Section (expanded) */}
              <div style={{ borderBottom: `1px solid ${surface.subtle}` }}>
                <ExpandedSectionHeader title="Spacing" />
                <div style={{ padding: "0 12px 8px" }}>
                  <div style={{ fontSize: 10, color: blackAlpha(0.6), textAlign: "center", padding: 12 }}>[Box Model]</div>
                </div>
              </div>

              {/* Size Section (expanded) */}
              <div style={{ borderBottom: `1px solid ${surface.subtle}` }}>
                <ExpandedSectionHeader title="Size" hasIndicator />
                <div style={{ paddingBottom: layout.sectionBodyPadding }}>
                  <div style={{ display: "flex", gap: layout.controlGap, padding: layout.rowPadding }}>
                    {/* Width cell (modified) */}
                    <div style={{ flex: 1, ...sizeInputCellBase, background: primaryAlpha(0.10), border: `1px solid ${primaryAlpha(0.25)}` }}>
                      <div style={{ ...sizeInputLabel, color: color.primary }}>W</div>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                        <span style={sizeInputValue}>200</span>
                      </div>
                      <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "0 4px" }}>px</span></div>
                    </div>
                    {/* Height cell (auto) */}
                    <div style={{ flex: 1, ...sizeInputCellBase }}>
                      <div style={sizeInputLabel}>H</div>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}>
                        <span style={{ ...sizeInputValue, textTransform: "capitalize" }}>Auto</span>
                      </div>
                      <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "0 4px" }}>&ndash;</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsed sections */}
              <CollapsedSection title="Position" />
              <CollapsedSection title="Typography" />
              <CollapsedSection title="Backgrounds" />
              <CollapsedSection title="Borders" />
              <CollapsedSection title="Effects" />

              {/* Footer */}
              <div style={{ display: "flex", flexDirection: "column", padding: layout.footerPadding, borderTop: `1px solid ${blackAlpha(0.07)}`, gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={footerBtnStandard}>Copy <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></div>
                    <div style={footerBtnStandard}>Paste</div>
                    <div style={footerBtnStandard}>Import</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{
                      padding: "4px 8px", fontSize: 12, fontFamily: font.sans,
                      border: `1px solid rgba(239,68,68,0.15)`, borderRadius: 6,
                      background: surface.hover, color: "rgba(239,68,68,0.8)",
                    }}>Reset</div>
                    <div style={footerBtnPrimary}>Save</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: All Collapsed */}
          <div data-component="FullPanel" data-variant="all-collapsed">
            <div className="variant-label" style={{ marginBottom: 8 }}>All Sections Collapsed</div>
            <div style={panelShell}>
              <PanelHeader tag="<div>" className=".container" />
              <div style={{ height: 8 }} />
              {["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects"].map((s) => (
                <CollapsedSection key={s} title={s} />
              ))}
              {/* Footer (disabled) */}
              <div style={{ display: "flex", padding: layout.footerPadding, borderTop: `1px solid ${blackAlpha(0.07)}`, gap: 6, justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ ...footerBtnStandard, opacity: 0.35 }}>Copy <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>&#9662;</span></div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ ...footerBtnPrimary, opacity: 0.35 }}>Save</div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Search Empty */}
          <div data-component="FullPanel" data-variant="search-empty">
            <div className="variant-label" style={{ marginBottom: 8 }}>Search — No Results</div>
            <div style={panelShell}>
              <PanelHeader tag="<div>" />
              <div style={{ height: 8 }} />
              <div style={{ textAlign: "center", color: blackAlpha(0.55), padding: "40px 20px", fontSize: 12 }}>No matching properties</div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION D -- Overlay Components                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 64 }}>
        <h1 className="section-title">D — Overlay Components (larger scale)</h1>
        <div className="showcase-grid">

          {/* ColorPickerEnhanced */}
          <div className="card" style={{ width: 280 }} data-component="ColorPickerEnhanced">
            <div className="card-label">ColorPickerEnhanced</div>
            <div style={{
              width: 240, background: color.popover, borderRadius: 8, padding: 12,
              boxShadow: shadow.picker, display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* 2D SB canvas */}
              <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: layout.pickerCanvasHeight, borderRadius: 4, overflow: "hidden", cursor: "crosshair" }}>
                <div style={{ position: "absolute", inset: 0, background: "hsl(260, 100%, 50%)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))" }} />
                {/* Handle */}
                <div style={{
                  position: "absolute", left: "75%", top: "25%", width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
                  transform: "translate(-50%, -50%)", background: color.primary,
                }} />
              </div>
              {/* Hue slider */}
              <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6, background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)", cursor: "pointer" }}>
                <div style={{
                  position: "absolute", left: "72%", top: "50%", width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
                  transform: "translate(-50%, -50%)", background: "hsl(260, 100%, 50%)",
                }} />
              </div>
              {/* Opacity slider */}
              <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6, background: "repeating-conic-gradient(#444 0% 25%, #666 0% 50%) 50%/8px 8px", cursor: "pointer", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: `linear-gradient(to right, transparent, ${color.primary})` }} />
                <div style={{
                  position: "absolute", left: "100%", top: "50%", width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
                  transform: "translate(-50%, -50%)", background: color.primary,
                }} />
              </div>
              {/* Mode inputs */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: blackAlpha(0.7), fontFamily: font.mono, cursor: "pointer", minWidth: 22, textTransform: "uppercase", letterSpacing: "0.02em" }}>HEX</span>
                <div style={{
                  flex: 1, background: color.background, border: `1px solid ${blackAlpha(0.07)}`, borderRadius: 4,
                  padding: "3px 6px", fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.7),
                }}>{color.primary}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, color: blackAlpha(0.6), fontFamily: font.mono }}>A</span>
                  <span style={{ fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.8), minWidth: 26, textAlign: "right" }}>100%</span>
                </div>
              </div>
              {/* Swatches */}
              <div style={{ borderTop: `1px solid ${surface.hover}`, paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: blackAlpha(0.6), textTransform: "uppercase", letterSpacing: "0.04em" }}>Swatches</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{
                      background: "none", border: `1px solid ${surface.active}`, borderRadius: 3,
                      color: blackAlpha(0.7), width: 18, height: 18,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, lineHeight: 1,
                    }}>+</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[color.destructive, "#22c55e", color.primary, indicatorColor.inherited, "#06b6d4"].map((c, i) => (
                    <div key={i} style={{
                      width: layout.swatchSizeSaved, height: layout.swatchSizeSaved, borderRadius: 3,
                      border: i === 2 ? `2px solid ${blackAlpha(0.6)}` : `1px solid ${surface.track}`,
                      background: c,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Copy Dropdown Menu */}
          <div className="card" style={{ width: 200 }} data-component="CopyDropdownMenu">
            <div className="card-label">Copy Dropdown</div>
            <div style={{
              background: color.popover, border: `1px solid ${surface.active}`, borderRadius: 6,
              padding: "4px 0", minWidth: 140, boxShadow: shadow.dropdown,
            }}>
              {["CSS", "Tailwind", "CSS Variables", "SCSS (commented)"].map((opt, i) => (
                <div key={opt} style={{
                  display: "block", width: "100%", padding: "6px 12px", fontSize: 12, fontFamily: font.sans,
                  background: i === 1 ? surface.hover : "transparent", color: blackAlpha(0.7), textAlign: "left",
                }}>{opt}</div>
              ))}
            </div>
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
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.value}</td>
                <td>{row.figma}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
