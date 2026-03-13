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
  labelIndicator,
  spacingZone,
  primaryAlpha,
  blackAlpha,
  focusRing,
  filledTrackBg,
  destructiveAlpha,
} from "@/overlay/theme";
import { timing } from "@/overlay/timing";

// ─── Page Styles ─────────────────────────────────────────────────────────────

const pageCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #E8E8E8;
    font-family: ${font.sans};
    padding: 48px;
  }
  .mono { font-family: ${font.mono}; }
  .row {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
    margin-bottom: 48px;
    align-items: flex-start;
  }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${blackAlpha(0.5)};
    margin-bottom: 16px;
  }
`;

// ─── Shared Styles ───────────────────────────────────────────────────────────

const panelShell: React.CSSProperties = {
  width: layout.panelWidth,
  background: color.background,
  borderRadius: layout.panelRadius,
  border: `1px solid ${blackAlpha(0.07)}`,
  boxShadow: shadow.panel,
  overflow: "hidden",
};

const sectionHeader: React.CSSProperties = {
  padding: layout.sectionPadding,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: color.foreground,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const chevronStyle: React.CSSProperties = {
  color: blackAlpha(0.55),
  display: "flex",
  alignItems: "center",
};

const rowBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  padding: layout.rowPadding,
};

const labelBase: React.CSSProperties = {
  width: layout.labelWidth,
  fontSize: 11,
  color: text.label,
  flexShrink: 0,
};

const valueInput: React.CSSProperties = {
  width: layout.inputWidth,
  background: color.input,
  border: `1px solid ${border.default}`,
  borderRadius: 2,
  color: blackAlpha(0.7),
  fontSize: 10,
  fontFamily: font.mono,
  textAlign: "center",
  padding: 2,
  height: 20,
};

const unitLabel: React.CSSProperties = {
  fontSize: 9,
  color: blackAlpha(0.55),
  width: 16,
  fontFamily: font.mono,
};

const sizeCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: layout.iconBtnSize,
  background: color.input,
  border: `1px solid ${blackAlpha(0.07)}`,
  borderRadius: 4,
  overflow: "hidden",
  flex: 1,
};

const sizeCellLabel: React.CSSProperties = {
  padding: "0 6px",
  fontSize: 10,
  color: blackAlpha(0.7),
  fontFamily: font.sans,
  lineHeight: `${layout.iconBtnSize}px`,
};

const sizeCellValue: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: blackAlpha(0.7),
  paddingRight: 4,
};

const sizeCellUnit: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: blackAlpha(0.8),
  padding: "0 4px",
};

const iconBtn = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: layout.iconBtnSize,
  minWidth: layout.iconBtnSize,
  padding: "0 6px",
  border: `1px solid ${surface.track}`,
  background: active ? color.primary : "transparent",
  color: active ? color.primaryForeground : blackAlpha(0.7),
  cursor: "pointer",
});

const displayTab = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: layout.iconBtnSize,
  minWidth: 48,
  padding: "0 10px",
  fontSize: 10,
  fontFamily: font.mono,
  border: `1px solid ${surface.track}`,
  background: active ? color.primary : "transparent",
  color: active ? color.primaryForeground : blackAlpha(0.7),
});

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Chevron = ({ open }: { open?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: `transform ${timing.expand}ms` }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);

const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

const RowArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);

const ColArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
);

const WrapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><path d="M3 12h15a3 3 0 1 1 0 6h-4" /><polyline points="16 16 14 18 16 20" /><line x1="3" y1="18" x2="10" y2="18" /></svg>
);

const AlignLeftIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>;
const AlignCenterIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></svg>;
const AlignRightIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></svg>;
const AlignJustifyIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
const LinkIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const EyeIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const SparklesIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>;
const CopyIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>;
const GridIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;

// ─── Reusable Sub-components ─────────────────────────────────────────────────

function DragHandle() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 0" }}>
      <div style={{ width: 28, height: 3, borderRadius: 1.5, background: surface.active }} />
    </div>
  );
}

function Indicator({ type = "modified" }: { type?: string }) {
  const c = indicatorColor[type as keyof typeof indicatorColor] ?? indicatorColor.modified;
  return <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: c, boxShadow: `0 0 3px ${c}` }} />;
}

function SectionDivider() {
  return <div style={{ borderBottom: `1px solid ${border.subtle}` }} />;
}

function SliderTrack({ pct, label, unit = "px", value, modified }: { pct: number; label: string; unit?: string; value: number; modified?: boolean }) {
  return (
    <div style={rowBase}>
      <span style={modified ? { ...labelBase, background: labelIndicator.modified.bg, color: labelIndicator.modified.text, padding: "1px 4px", borderRadius: 3 } : labelBase}>
        {label}
      </span>
      <div style={{ flex: 1, height: layout.sliderHeight, background: filledTrackBg(pct), borderRadius: 2, position: "relative" }}>
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: "50%", background: color.primary,
          border: `2px solid ${color.background}`,
        }} />
      </div>
      <div style={valueInput}>{value}</div>
      <span style={unitLabel}>{unit}</span>
    </div>
  );
}

function SelectRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowBase}>
      <span style={labelBase}>{label}</span>
      <div style={{
        flex: 1, height: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: color.input, border: `1px solid ${border.default}`, borderRadius: 3,
        color: blackAlpha(0.7), fontSize: 11, fontFamily: font.mono, padding: "0 6px",
      }}>
        <span>{value}</span>
        <ChevronDown />
      </div>
    </div>
  );
}

function ColorRow({ label, hex, varName }: { label: string; hex: string; varName?: string }) {
  return (
    <div style={rowBase}>
      <span style={labelBase}>{label}</span>
      <div style={{
        width: layout.colorSwatch, height: layout.colorSwatch, borderRadius: 4,
        background: hex, border: varName ? `2px solid ${primaryAlpha(0.6)}` : `1px solid ${surface.track}`, flexShrink: 0,
      }} />
      <span style={{ fontSize: 10, fontFamily: font.mono, color: varName ? primaryAlpha(0.8) : blackAlpha(0.7) }}>
        {varName ?? hex}
      </span>
    </div>
  );
}

function SectionOpen({ title, indicator, children, headerAction }: { title: string; indicator?: boolean; children: React.ReactNode; headerAction?: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${border.subtle}` }}>
      <div style={sectionHeader}>
        <span style={sectionTitle}>
          {title}
          {indicator && <Indicator />}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {headerAction}
          <span style={chevronStyle}><Chevron open /></span>
        </div>
      </div>
      <div style={{ paddingBottom: layout.sectionBodyPadding }}>{children}</div>
    </div>
  );
}

function SectionClosed({ title, indicator }: { title: string; indicator?: boolean }) {
  return (
    <div style={{ borderBottom: `1px solid ${border.subtle}` }}>
      <div style={sectionHeader}>
        <span style={sectionTitle}>
          {title}
          {indicator && <Indicator />}
        </span>
        <span style={chevronStyle}><Chevron /></span>
      </div>
    </div>
  );
}

function TabBar({ tabs, active }: { tabs: string[]; active: number }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${border.subtle}`, padding: "0 12px" }}>
      {tabs.map((tab, i) => (
        <div key={tab} style={{
          background: "transparent", borderBottom: `2px solid ${i === active ? color.primary : "transparent"}`,
          padding: "7px 10px 5px", fontSize: 11, fontFamily: font.sans,
          fontWeight: i === active ? 600 : 400, color: i === active ? color.foreground : text.label,
        }}>{tab}</div>
      ))}
    </div>
  );
}

function ScopePill({ label, active }: { label: string; active?: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", fontSize: 10, fontFamily: font.mono, borderRadius: 4,
      background: active ? surface.active : "transparent",
      color: active ? text.primary : text.label,
    }}>{label}</span>
  );
}

function FooterBar({ hasChanges }: { hasChanges?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: layout.footerPadding, borderTop: `1px solid ${border.default}` }}>
      <div style={{
        padding: "4px 8px", fontSize: 12, fontFamily: font.sans, border: `1px solid ${border.default}`,
        borderRadius: 6, background: surface.hover, color: text.label, display: "flex", alignItems: "center", gap: 4,
      }}>
        Clipboard <span style={{ opacity: 0.6, fontSize: 9 }}>▾</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{
          padding: "4px 8px", fontSize: 12, fontFamily: font.sans,
          border: `1px solid ${destructiveAlpha(0.15)}`, borderRadius: 6,
          background: surface.hover, color: destructiveAlpha(0.8),
          opacity: hasChanges ? 1 : 0.35,
        }}>Reset</div>
        <div style={{
          padding: "5px 12px", fontSize: 13, fontWeight: 600, fontFamily: font.sans,
          border: "none", borderRadius: 6, background: color.primary, color: color.primaryForeground,
          boxShadow: `0 1px 3px ${primaryAlpha(0.4)}`, opacity: hasChanges ? 1 : 0.35,
        }}>Save</div>
      </div>
    </div>
  );
}

function ChangesBadge({ count }: { count: number }) {
  return (
    <div style={{
      background: primaryAlpha(0.15), border: `1px solid ${primaryAlpha(0.2)}`, borderRadius: 3,
      color: primaryAlpha(0.95), fontSize: 9, fontWeight: 600, fontFamily: font.mono,
      padding: "2px 6px", lineHeight: "14px", minWidth: 18, textAlign: "center",
    }}>{count}</div>
  );
}

function PanelHeaderFull({ tag, className, sourceFile, breadcrumb, scopePills, showState, badge }: {
  tag: string; className?: string; sourceFile?: string;
  breadcrumb?: string[]; scopePills?: string[]; showState?: boolean; badge?: number;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${border.subtle}` }}>
      <DragHandle />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="mono" style={{ color: text.primary, fontSize: 13, fontWeight: 500 }}>{tag}</span>
          {className && <span className="mono" style={{ color: text.label, fontSize: 11 }}>{className}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {badge !== undefined && <ChangesBadge count={badge} />}
          <div style={{ color: text.disabled, padding: 3, lineHeight: 1, display: "flex" }}><CloseIcon /></div>
        </div>
      </div>
      {sourceFile && (
        <div style={{ padding: "2px 12px 0" }}>
          <span className="mono" style={{ color: text.disabled, fontSize: 10 }}>{sourceFile}</span>
        </div>
      )}
      {breadcrumb && breadcrumb.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 12px 0" }}>
          {breadcrumb.map((seg, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {i > 0 && <span style={{ opacity: 0.4 }}><ChevronRight /></span>}
              <span className="mono" style={{ fontSize: 10, color: i === breadcrumb.length - 1 ? text.primary : text.label }}>{seg}</span>
            </span>
          ))}
        </div>
      )}
      {(scopePills || showState) && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "6px 12px 8px", flexWrap: "wrap" }}>
          {scopePills?.map((pill, i) => <ScopePill key={pill} label={pill} active={i === 0} />)}
          {showState && scopePills && <div style={{ width: 1, height: 14, margin: "0 3px", background: surface.hover }} />}
          {showState && (
            <span style={{
              padding: "2px 8px", fontSize: 10, fontFamily: font.sans,
              border: `1px solid ${border.default}`, borderRadius: 4, color: text.label,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              State <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          )}
        </div>
      )}
      {!scopePills && !showState && <div style={{ height: 8 }} />}
    </div>
  );
}

// ─── Spacing Box Model ───────────────────────────────────────────────────────

function SpacingBox() {
  return (
    <div style={{ padding: "0 12px 4px" }}>
      <div style={{
        position: "relative", border: `1px solid ${surface.active}`, borderRadius: 4,
        background: spacingZone.marginBase,
      }}>
        <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Margin</span>
          <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "0 4px" }}>px</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
          <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.55), padding: "2px 4px" }}>0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.55), padding: "2px 4px" }}>0</span>
          </div>
          <div style={{
            flex: 1, border: `1px solid ${surface.active}`, borderRadius: 3,
            background: spacingZone.paddingBase, margin: "2px 0", position: "relative",
          }}>
            <div style={{ position: "absolute", top: 2, left: 6, display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: blackAlpha(0.55) }}>Padding</span>
              <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "0 4px" }}>px</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
              <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "2px 4px" }}>16</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "2px 4px" }}>24</span>
              </div>
              <div style={{ flex: 1, height: 14, background: surface.hover, borderRadius: 2, margin: "0 4px" }} />
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "2px 4px" }}>24</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
              <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "2px 4px" }}>16</span>
            </div>
          </div>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.55), padding: "2px 4px" }}>0</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 6px" }}>
          <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.55), padding: "2px 4px" }}>0</span>
        </div>
      </div>
    </div>
  );
}

// ─── Align Box ───────────────────────────────────────────────────────────────

function AlignBox() {
  const aligns = ["flex-start", "center", "flex-end"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "4px 12px" }}>
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(3, ${layout.alignCell}px)`,
        gridTemplateRows: `repeat(3, ${layout.alignCell}px)`,
        border: `1px solid ${surface.track}`, borderRadius: 4, overflow: "hidden",
      }}>
        {aligns.map((v) => aligns.map((h) => {
          const isActive = v === "center" && h === "center";
          return (
            <div key={`${v}-${h}`} style={{
              width: layout.alignCell, height: layout.alignCell,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isActive ? color.primary : "transparent",
              color: isActive ? color.primaryForeground : blackAlpha(0.7),
              borderRight: h === "flex-end" ? undefined : `1px solid ${blackAlpha(0.07)}`,
              borderBottom: v === "flex-end" ? undefined : `1px solid ${blackAlpha(0.07)}`,
            }}>
              <div style={{ width: 16, height: 16, display: "flex", flexDirection: "column", justifyContent: v as string, alignItems: h as string, gap: 1.5 }}>
                <div style={{ width: 8, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
                <div style={{ width: 5, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
                <div style={{ width: 7, height: 1, borderRadius: 0.5, background: "currentColor", opacity: 0.9 }} />
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}

// ─── Position Offset Diagram ─────────────────────────────────────────────────

function PositionOffsets() {
  const HATCHED = `repeating-linear-gradient(45deg, transparent, transparent 3px, ${primaryAlpha(0.07)} 3px, ${primaryAlpha(0.07)} 4px)`;
  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div style={{ position: "relative", border: `1px solid ${border.default}`, borderRadius: 4, background: HATCHED }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.8), padding: "2px 4px" }}>0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: text.disabled, fontStyle: "italic" }}>Auto</span>
          </div>
          <div style={{ flex: 1, height: 24, background: color.input, borderRadius: 2, border: `1px dashed ${border.input}`, margin: "0 4px" }} />
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: text.disabled, fontStyle: "italic" }}>Auto</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <span style={{ fontSize: 9, color: text.disabled, fontStyle: "italic" }}>Auto</span>
        </div>
      </div>
    </div>
  );
}

// ─── Corner Radius Editor ────────────────────────────────────────────────────

function CornerRadiusBox() {
  const inputStyle: React.CSSProperties = {
    width: 32, height: 22, fontSize: 10, fontFamily: font.mono, textAlign: "center",
    background: color.input, border: `1px solid ${border.input}`, borderRadius: 3,
    color: blackAlpha(0.7), padding: "0 2px",
  };
  return (
    <div style={{ padding: "4px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 100, height: 70, position: "relative",
        border: `1px solid ${border.default}`, borderRadius: 8,
        background: surface.subtle,
      }}>
        <div style={{ position: "absolute", top: -11, left: -11 }}><input readOnly value="8" style={inputStyle} /></div>
        <div style={{ position: "absolute", top: -11, right: -11 }}><input readOnly value="8" style={inputStyle} /></div>
        <div style={{ position: "absolute", bottom: -11, right: -11 }}><input readOnly value="8" style={inputStyle} /></div>
        <div style={{ position: "absolute", bottom: -11, left: -11 }}><input readOnly value="8" style={inputStyle} /></div>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: color.primary }}>
          <LinkIcon />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.55) }}>px</span>
      </div>
    </div>
  );
}

// ─── Shadow Editor Layer ─────────────────────────────────────────────────────

function ShadowLayer({ x, y, blur, spread, clr, inset }: { x: number; y: number; blur: number; spread: number; clr: string; inset?: boolean }) {
  const numInput: React.CSSProperties = {
    width: 28, height: 20, fontSize: 10, fontFamily: font.mono, textAlign: "center",
    background: color.input, border: `1px solid ${border.input}`, borderRadius: 2,
    color: blackAlpha(0.7), padding: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px" }}>
      <div style={{ width: 5, height: 20, cursor: "grab", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1.5 }}>
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
      </div>
      <div style={{
        width: 16, height: 16, borderRadius: 3, background: clr,
        border: `1px solid ${surface.track}`, flexShrink: 0,
      }} />
      <input readOnly value={x} style={numInput} />
      <input readOnly value={y} style={numInput} />
      <input readOnly value={blur} style={numInput} />
      <input readOnly value={spread} style={numInput} />
      {inset && <span className="mono" style={{ fontSize: 8, color: blackAlpha(0.5) }}>inset</span>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ color: blackAlpha(0.4), cursor: "pointer" }}><EyeIcon /></span>
        <span style={{ color: blackAlpha(0.4), cursor: "pointer" }}><CloseIcon /></span>
      </div>
    </div>
  );
}

// ─── Filter Slider Row ───────────────────────────────────────────────────────

function FilterRow({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 12px" }}>
      <div style={{ width: 5, height: 20, cursor: "grab", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1.5 }}>
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
      </div>
      <span style={{ width: 56, fontSize: 10, color: text.label, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: layout.sliderHeight, background: filledTrackBg(pct), borderRadius: 2, position: "relative" }}>
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%", background: color.primary,
          border: `2px solid ${color.background}`,
        }} />
      </div>
      <div style={{ ...valueInput, width: 32 }}>{value}</div>
      <span style={{ ...unitLabel, width: 20 }}>{unit}</span>
      <span style={{ color: blackAlpha(0.4) }}><EyeIcon /></span>
    </div>
  );
}

// ─── Transform Row ───────────────────────────────────────────────────────────

function TransformRow({ label, x, y, unitStr }: { label: string; x: number; y: number; unitStr: string }) {
  const numInput: React.CSSProperties = {
    width: 36, height: 20, fontSize: 10, fontFamily: font.mono, textAlign: "center",
    background: color.input, border: `1px solid ${border.input}`, borderRadius: 2,
    color: blackAlpha(0.7), padding: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px" }}>
      <span style={{ width: 48, fontSize: 10, color: text.label, flexShrink: 0 }}>{label}</span>
      <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.5) }}>X</span>
      <input readOnly value={x} style={numInput} />
      <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.5) }}>Y</span>
      <input readOnly value={y} style={numInput} />
      <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.5) }}>{unitStr}</span>
      <span style={{ marginLeft: "auto", color: blackAlpha(0.4) }}><CloseIcon /></span>
    </div>
  );
}

// ─── Transform Origin Picker ─────────────────────────────────────────────────

function OriginPicker() {
  const positions = ["top left", "top center", "top right", "center left", "center center", "center right", "bottom left", "bottom center", "bottom right"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px" }}>
      <span style={{ fontSize: 10, color: text.label }}>Origin</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 14px)", gridTemplateRows: "repeat(3, 14px)", gap: 2 }}>
        {positions.map((p, i) => (
          <div key={p} style={{
            width: 14, height: 14, borderRadius: 2,
            background: i === 4 ? color.primary : surface.hover,
            border: `1px solid ${i === 4 ? color.primary : border.default}`,
          }} />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.7) }}>center center</span>
    </div>
  );
}

// ─── Gradient Bar ────────────────────────────────────────────────────────────

function GradientBar() {
  const stops = [
    { color: "#3B82F6", position: 0 },
    { color: "#8B5CF6", position: 50 },
    { color: "#EC4899", position: 100 },
  ];
  const grad = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.position}%`).join(", ")})`;
  return (
    <div style={{ padding: "4px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: text.label }}>Type</span>
        <div style={{ display: "inline-flex" }}>
          {["Linear", "Radial", "Conic"].map((t, i) => (
            <div key={t} style={{
              ...displayTab(i === 0),
              minWidth: 36, height: 22, fontSize: 9,
              borderRadius: i === 0 ? "3px 0 0 3px" : i === 2 ? "0 3px 3px 0" : 0,
              borderLeft: i === 0 ? undefined : "none",
            }}>{t}</div>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.7), marginLeft: "auto" }}>90°</span>
      </div>
      <div style={{ position: "relative", height: 16, borderRadius: 4, background: grad, border: `1px solid ${blackAlpha(0.07)}` }}>
        {stops.map((s, i) => (
          <div key={i} style={{
            position: "absolute", left: `${s.position}%`, top: "50%", transform: "translate(-50%, -50%)",
            width: 12, height: 12, borderRadius: "50%", background: s.color,
            border: `2px solid ${color.background}`, boxShadow: `0 0 2px ${blackAlpha(0.4)}`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Color Picker Popover ────────────────────────────────────────────────────

function ColorPickerPopover() {
  const hue = 260;
  const sat = 75;
  const brightness = 75;
  const hslColor = `hsl(${hue}, 100%, 50%)`;
  const pickedColor = `hsl(${hue}, ${sat}%, ${brightness}%)`;

  return (
    <div style={{
      width: 240, background: color.popover, borderRadius: 8, padding: 12,
      boxShadow: shadow.picker, display: "flex", flexDirection: "column", gap: 10,
    }} data-component="ColorPicker">
      {/* 2D canvas */}
      <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: layout.pickerCanvasHeight, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: hslColor }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))" }} />
        <div style={{
          position: "absolute", left: `${sat}%`, top: `${100 - brightness}%`,
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: pickedColor,
        }} />
      </div>
      {/* Hue */}
      <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6, background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
        <div style={{
          position: "absolute", left: `${(hue / 360) * 100}%`, top: "50%",
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: hslColor,
        }} />
      </div>
      {/* Opacity */}
      <div style={{ position: "relative", width: layout.pickerCanvasWidth, height: 12, borderRadius: 6, background: "repeating-conic-gradient(#444 0% 25%, #666 0% 50%) 50%/8px 8px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: `linear-gradient(to right, transparent, ${pickedColor})` }} />
        <div style={{
          position: "absolute", left: "100%", top: "50%",
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color.primaryForeground}`, boxShadow: `0 0 2px ${blackAlpha(0.6)}`,
          transform: "translate(-50%, -50%)", background: pickedColor,
        }} />
      </div>
      {/* Mode */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: blackAlpha(0.7), minWidth: 22 }}>HEX</span>
        <div style={{ flex: 1, background: color.background, border: `1px solid ${blackAlpha(0.07)}`, borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.7) }}>
          #7C3AED
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.6) }}>A</span>
          <span className="mono" style={{ fontSize: 11, color: blackAlpha(0.8) }}>100%</span>
        </div>
      </div>
      {/* Swatches */}
      <div style={{ borderTop: `1px solid ${surface.hover}`, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: blackAlpha(0.6), textTransform: "uppercase", letterSpacing: "0.04em" }}>Swatches</span>
          <div style={{ background: "none", border: `1px solid ${surface.active}`, borderRadius: 3, color: blackAlpha(0.7), width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1 }}>+</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[color.destructive, "#22c55e", color.primary, indicatorColor.modified, "#06b6d4"].map((c, i) => (
            <div key={i} style={{ width: layout.swatchSizeSaved, height: layout.swatchSizeSaved, borderRadius: 3, border: `1px solid ${surface.track}`, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clipboard Dropdown ──────────────────────────────────────────────────────

function ClipboardDropdown() {
  return (
    <div style={{
      background: color.popover, border: `1px solid ${surface.active}`, borderRadius: 6,
      padding: "4px 0", minWidth: 160, boxShadow: shadow.dropdown,
    }} data-component="ClipboardDropdown">
      <div style={{ padding: "4px 12px 2px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label }}>Copy as</div>
      {["CSS", "Tailwind", "CSS Variables", "SCSS (commented)"].map(f => (
        <div key={f} style={{ padding: "6px 12px", fontSize: 12, color: color.foreground }}>{f}</div>
      ))}
      <div style={{ height: 1, background: border.subtle, margin: "4px 0" }} />
      <div style={{ padding: "6px 12px", fontSize: 12, color: color.foreground, display: "flex", justifyContent: "space-between" }}>
        <span>Paste Styles</span>
        <span className="mono" style={{ fontSize: 10, color: text.disabled }}>⌥⌘V</span>
      </div>
      <div style={{ padding: "6px 12px", fontSize: 12, color: color.foreground, display: "flex", justifyContent: "space-between" }}>
        <span>Import CSS</span>
        <span className="mono" style={{ fontSize: 10, color: text.disabled }}>⇧⌘V</span>
      </div>
    </div>
  );
}

// ─── Command Palette ─────────────────────────────────────────────────────────

function CommandPaletteUI() {
  return (
    <div style={{
      width: 420, background: color.background, borderRadius: 12, border: `1px solid ${border.default}`,
      boxShadow: "0 16px 64px rgba(0,0,0,0.18)", overflow: "hidden",
    }} data-component="CommandPalette">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${border.subtle}` }}>
        <span style={{ color: blackAlpha(0.4) }}><SearchIcon /></span>
        <span style={{ fontSize: 14, color: text.hint }}>Search properties, elements, actions...</span>
      </div>
      <div style={{ padding: "8px 0" }}>
        <div style={{ padding: "4px 16px 2px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label }}>Properties</div>
        {["font-size → Typography", "background-color → Backgrounds", "border-radius → Borders"].map((item, i) => (
          <div key={item} style={{
            padding: "8px 16px", fontSize: 13, color: color.foreground,
            background: i === 0 ? primaryAlpha(0.06) : "transparent",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>{item.split(" → ")[0]}</span>
            <span style={{ fontSize: 10, color: text.disabled }}>{item.split(" → ")[1]}</span>
          </div>
        ))}
        <div style={{ padding: "4px 16px 2px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label, marginTop: 4 }}>Actions</div>
        {["Save", "Reset", "Copy CSS"].map(a => (
          <div key={a} style={{ padding: "8px 16px", fontSize: 13, color: color.foreground }}>{a}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Search Bar ──────────────────────────────────────────────────────────────

function SearchBar() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 12px", margin: "0 8px 2px", borderRadius: 6,
      background: color.input, border: `1px solid ${border.input}`,
    }}>
      <span style={{ color: blackAlpha(0.35) }}><SearchIcon /></span>
      <span style={{ fontSize: 12, color: text.hint }}>Filter properties...</span>
      <span style={{ marginLeft: "auto", fontSize: 9, color: blackAlpha(0.35), fontFamily: font.mono }}>⌘F</span>
    </div>
  );
}

// ─── Prompt Panel Content ────────────────────────────────────────────────────

function PromptPanelContent() {
  return (
    <div style={{ padding: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 4px" }}>
        <span style={{ color: primaryAlpha(0.6) }}><SparklesIcon /></span>
        <span className="mono" style={{ fontSize: 11, color: text.secondary }}>&lt;button&gt;</span>
        <span className="mono" style={{ fontSize: 10, color: text.disabled }}>.btnPrimary</span>
      </div>
      <div style={{
        width: "100%", minHeight: 80, background: color.input, border: `1px solid ${border.input}`,
        borderRadius: 6, padding: "8px 10px", fontSize: 12, color: text.hint,
        fontFamily: font.sans, lineHeight: 1.5,
      }}>
        Describe what you want to change...
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
        <div style={{
          padding: "5px 10px", fontSize: 12, fontFamily: font.sans,
          border: `1px solid ${border.default}`, borderRadius: 6,
          background: surface.hover, color: text.label, display: "flex", alignItems: "center", gap: 4,
        }}>
          <CopyIcon /> Copy <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.35) }}>⌘↵</span>
        </div>
      </div>
    </div>
  );
}

// ─── Background Layer List ───────────────────────────────────────────────────

function BgLayerRow({ type, preview, label }: { type: string; preview: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px" }}>
      <div style={{ width: 5, height: 20, cursor: "grab", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1.5 }}>
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
        <div style={{ width: 4, height: 1, background: blackAlpha(0.25), borderRadius: 0.5 }} />
      </div>
      <div style={{ width: 24, height: 24, borderRadius: 4, background: preview, border: `1px solid ${surface.track}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div className="mono" style={{ fontSize: 9, color: text.disabled }}>{type}</div>
      </div>
      <span style={{ color: blackAlpha(0.4) }}><EyeIcon /></span>
      <span style={{ color: blackAlpha(0.4) }}><CloseIcon /></span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function FigmaPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageCSS }} />

      {/* ── 1. Full Panel — Custom Tab (all sections open) ── */}
      <div className="section-label">Full Panel — Custom Tab</div>
      <div className="row">
        <div data-component="FullPanel-Custom">
          <div style={panelShell}>
            <PanelHeaderFull
              tag="<button>"
              className=".btnPrimary"
              sourceFile="src/components/Button.tsx"
              breadcrumb={["div.page", "main", "button.btnPrimary"]}
              scopePills={["element", ".btnPrimary"]}
              showState
              badge={5}
            />
            <TabBar tabs={["Common", "Custom", "Prompt"]} active={1} />
            <SearchBar />

            <SectionOpen title="Layout" indicator>
              <div style={{ padding: layout.rowPadding }}>
                <div style={{ display: "inline-flex" }}>
                  {["block", "flex", "grid", "none"].map((d, i) => (
                    <div key={d} style={{
                      ...displayTab(i === 1),
                      borderLeft: i === 0 ? undefined : "none",
                      borderRadius: i === 0 ? "4px 0 0 4px" : i === 3 ? "0 4px 4px 0" : 0,
                    }}>{d}</div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "4px 12px" }}>
                <div style={{ display: "inline-flex" }}>
                  {[<RowArrow key="r" />, <ColArrow key="c" />, <WrapIcon key="w" />].map((icon, i) => (
                    <div key={i} style={{
                      ...iconBtn(i === 0),
                      borderLeft: i === 0 ? undefined : "none",
                      borderRadius: i === 0 ? "4px 0 0 4px" : i === 2 ? "0 4px 4px 0" : 0,
                    }}>{icon}</div>
                  ))}
                </div>
              </div>
              <AlignBox />
              <SliderTrack pct={25} label="Gap" value={12} modified />
            </SectionOpen>

            <SectionOpen title="Spacing">
              <SpacingBox />
            </SectionOpen>

            <SectionOpen title="Size" indicator>
              <div style={{ display: "flex", gap: layout.controlGap, padding: layout.rowPadding }}>
                <div style={{ ...sizeCell, background: primaryAlpha(0.06), border: `1px solid ${primaryAlpha(0.25)}` }}>
                  <div style={{ ...sizeCellLabel, color: color.primary }}>W</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={sizeCellValue}>200</span></div>
                  <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={sizeCellUnit}>px</span></div>
                </div>
                <div style={sizeCell}>
                  <div style={sizeCellLabel}>H</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeCellValue, textTransform: "capitalize" }}>Auto</span></div>
                  <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={sizeCellUnit}>–</span></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: layout.controlGap, padding: layout.rowPadding }}>
                <div style={sizeCell}><div style={sizeCellLabel}>Min W</div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeCellValue, textTransform: "capitalize" }}>None</span></div></div>
                <div style={sizeCell}><div style={sizeCellLabel}>Max W</div><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeCellValue, textTransform: "capitalize" }}>None</span></div></div>
              </div>
              <SelectRow label="Overflow" value="visible" />
            </SectionOpen>

            <SectionOpen title="Position">
              <div style={{ padding: layout.rowPadding }}>
                <div style={{ display: "inline-flex" }}>
                  {["static", "relative", "absolute", "fixed", "sticky"].map((p, i) => (
                    <div key={p} style={{
                      ...displayTab(i === 1),
                      borderLeft: i === 0 ? undefined : "none",
                      borderRadius: i === 0 ? "4px 0 0 4px" : i === 4 ? "0 4px 4px 0" : 0,
                      minWidth: 40, fontSize: 9,
                    }}>{p}</div>
                  ))}
                </div>
              </div>
              <PositionOffsets />
              <SliderTrack pct={50} label="Z-Index" value={1} unit="" />
            </SectionOpen>

            <SectionOpen title="Typography">
              <SelectRow label="Family" value="Inter" />
              <SelectRow label="Weight" value="400 - Regular" />
              <SliderTrack pct={33} label="Size" value={16} />
              <SliderTrack pct={50} label="Height" value={1.5} unit="em" />
              <SliderTrack pct={10} label="Spacing" value={0} unit="em" />
              <div style={{ padding: "4px 12px" }}>
                <div style={{ display: "inline-flex" }}>
                  {[<AlignLeftIcon key="l" />, <AlignCenterIcon key="c" />, <AlignRightIcon key="r" />, <AlignJustifyIcon key="j" />].map((icon, i) => (
                    <div key={i} style={{
                      ...iconBtn(i === 0),
                      borderLeft: i === 0 ? undefined : "none",
                      borderRadius: i === 0 ? "4px 0 0 4px" : i === 3 ? "0 4px 4px 0" : 0,
                    }}>{icon}</div>
                  ))}
                </div>
              </div>
              <ColorRow label="Color" hex="#171717" />
            </SectionOpen>

            <SectionOpen title="Backgrounds">
              <ColorRow label="Color" hex={color.primary} />
              <BgLayerRow type="linear-gradient" preview="linear-gradient(135deg, #3B82F6, #8B5CF6)" label="linear-gradient(135deg, ...)" />
            </SectionOpen>

            <SectionOpen title="Borders">
              <CornerRadiusBox />
              <SliderTrack pct={10} label="Width" value={1} />
              <ColorRow label="Color" hex={border.strong} />
              <SelectRow label="Style" value="solid" />
            </SectionOpen>

            <SectionOpen title="Effects">
              <SliderTrack pct={100} label="Opacity" value={100} unit="%" />
              {/* Shadows sub-section */}
              <div style={{ padding: "4px 12px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: text.secondary }}>Box Shadows</span>
                <span style={{ fontSize: 10, color: color.primary, cursor: "pointer" }}>+ Add</span>
              </div>
              <ShadowLayer x={0} y={2} blur={4} spread={0} clr="rgba(0,0,0,0.1)" />
              <ShadowLayer x={0} y={8} blur={32} spread={0} clr="rgba(0,0,0,0.12)" />
              {/* Transforms */}
              <div style={{ padding: "8px 12px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: text.secondary }}>Transform</span>
                <span style={{ fontSize: 10, color: color.primary, cursor: "pointer" }}>+ Add</span>
              </div>
              <TransformRow label="Move" x={0} y={-2} unitStr="px" />
              <OriginPicker />
              {/* Filters */}
              <div style={{ padding: "8px 12px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: text.secondary }}>Filters</span>
                <span style={{ fontSize: 10, color: color.primary, cursor: "pointer" }}>+ Add</span>
              </div>
              <FilterRow label="Blur" value={0} max={50} unit="px" />
              <FilterRow label="Brightness" value={100} max={200} unit="%" />
              {/* Transition */}
              <SelectRow label="Cursor" value="pointer" />
            </SectionOpen>

            <FooterBar hasChanges />
          </div>
        </div>

        {/* ── 2. Full Panel — All Collapsed ── */}
        <div data-component="FullPanel-Collapsed">
          <div style={panelShell}>
            <PanelHeaderFull tag="<div>" className=".container" />
            <TabBar tabs={["Common", "Custom", "Prompt"]} active={1} />
            {["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects"].map(s => (
              <SectionClosed key={s} title={s} indicator={s === "Layout" || s === "Size"} />
            ))}
            <FooterBar />
          </div>
        </div>

        {/* ── 3. Full Panel — Common Tab ── */}
        <div data-component="FullPanel-Common">
          <div style={panelShell}>
            <PanelHeaderFull tag="<div>" className=".card" sourceFile="src/Card.tsx" />
            <TabBar tabs={["Common", "Custom", "Prompt"]} active={0} />
            {/* Flat groups like CommonPanel */}
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "0 12px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label }}>Style</div>
              <ColorRow label="BG" hex="#FFFFFF" />
              <SliderTrack pct={100} label="Opacity" value={100} unit="%" />
              <SliderTrack pct={20} label="Radius" value={8} />
            </div>
            <SectionDivider />
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "0 12px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label }}>Margin</div>
              <SpacingBox />
            </div>
            <SectionDivider />
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "0 12px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: text.label }}>Size</div>
              <div style={{ display: "flex", gap: layout.controlGap, padding: layout.rowPadding }}>
                <div style={sizeCell}>
                  <div style={sizeCellLabel}>W</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeCellValue, textTransform: "capitalize" }}>Auto</span></div>
                  <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={sizeCellUnit}>–</span></div>
                </div>
                <div style={sizeCell}>
                  <div style={sizeCellLabel}>H</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 2 }}><span style={{ ...sizeCellValue, textTransform: "capitalize" }}>Auto</span></div>
                  <div style={{ flexShrink: 0, paddingRight: 3 }}><span className="mono" style={sizeCellUnit}>–</span></div>
                </div>
              </div>
            </div>
            <FooterBar />
          </div>
        </div>
      </div>

      {/* ── 4. Full Panel — Prompt Tab ── */}
      <div className="section-label">Full Panel — Prompt Tab</div>
      <div className="row">
        <div data-component="FullPanel-Prompt">
          <div style={panelShell}>
            <PanelHeaderFull tag="<button>" className=".btnPrimary" sourceFile="src/components/Button.tsx" />
            <TabBar tabs={["Common", "Custom", "Prompt"]} active={2} />
            <PromptPanelContent />
            <FooterBar />
          </div>
        </div>

        {/* ── 5. Search — No Results ── */}
        <div data-component="FullPanel-NoResults">
          <div style={panelShell}>
            <PanelHeaderFull tag="<div>" />
            <SearchBar />
            <div style={{ textAlign: "center", color: blackAlpha(0.25), padding: "40px 20px", fontSize: 12 }}>No matching properties</div>
          </div>
        </div>
      </div>

      {/* ── 6. Popover Components ── */}
      <div className="section-label">Popovers &amp; Overlays</div>
      <div className="row">
        <ColorPickerPopover />
        <ClipboardDropdown />
        <CommandPaletteUI />
      </div>

      {/* ── 7. Specialty Editors ── */}
      <div className="section-label">Specialty Editors (in context)</div>
      <div className="row">
        {/* Shadow editor standalone */}
        <div data-component="ShadowEditor" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: text.primary }}>Box Shadows</span>
            <span style={{ fontSize: 10, color: color.primary }}>+ Add</span>
          </div>
          <ShadowLayer x={0} y={2} blur={4} spread={0} clr="rgba(0,0,0,0.1)" />
          <ShadowLayer x={0} y={8} blur={32} spread={0} clr="rgba(0,0,0,0.12)" />
          <ShadowLayer x={0} y={0} blur={0} spread={1} clr="rgba(0,0,0,0.04)" inset />
        </div>

        {/* Gradient editor standalone */}
        <div data-component="GradientEditor" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 500, color: text.primary }}>Gradient</div>
          <GradientBar />
        </div>

        {/* Filter editor standalone */}
        <div data-component="FilterEditor" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: text.primary }}>Filters</span>
            <span style={{ fontSize: 10, color: color.primary }}>+ Add</span>
          </div>
          <FilterRow label="Blur" value={2} max={50} unit="px" />
          <FilterRow label="Brightness" value={100} max={200} unit="%" />
          <FilterRow label="Contrast" value={110} max={200} unit="%" />
          <FilterRow label="Saturate" value={120} max={200} unit="%" />
        </div>

        {/* Transform editor standalone */}
        <div data-component="TransformEditor" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: text.primary }}>Transform</span>
            <span style={{ fontSize: 10, color: color.primary }}>+ Add</span>
          </div>
          <TransformRow label="Move" x={10} y={-5} unitStr="px" />
          <TransformRow label="Scale" x={1} y={1} unitStr="" />
          <TransformRow label="Rotate" x={15} y={0} unitStr="deg" />
          <OriginPicker />
        </div>
      </div>

      {/* ── 8. Corner Radius + Position Offsets ── */}
      <div className="section-label">Specialty Controls</div>
      <div className="row">
        <div data-component="CornerRadiusEditor" style={{ ...panelShell, width: 200, padding: "12px 0" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 12, fontWeight: 500, color: text.primary }}>Corner Radius</div>
          <CornerRadiusBox />
        </div>

        <div data-component="PositionOffsetDiagram" style={{ ...panelShell, width: layout.panelWidth, padding: "12px 0" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 12, fontWeight: 500, color: text.primary }}>Position Offsets</div>
          <PositionOffsets />
        </div>

        <div data-component="AlignBox" style={{ ...panelShell, width: 160, padding: "12px 0" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 12, fontWeight: 500, color: text.primary }}>Alignment</div>
          <AlignBox />
        </div>

        <div data-component="SpacingBoxModel" style={{ ...panelShell, width: layout.panelWidth, padding: "12px 0" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 12, fontWeight: 500, color: text.primary }}>Spacing Box Model</div>
          <SpacingBox />
        </div>
      </div>

      {/* ── 9. Header Variations ── */}
      <div className="section-label">Header Variations</div>
      <div className="row">
        <div data-component="Header-Minimal" style={{ ...panelShell, width: layout.panelWidth }}>
          <PanelHeaderFull tag="<div>" />
        </div>
        <div data-component="Header-WithSource" style={{ ...panelShell, width: layout.panelWidth }}>
          <PanelHeaderFull tag="<img>" className=".hero-image" sourceFile="src/pages/Home.tsx" />
        </div>
        <div data-component="Header-Full" style={{ ...panelShell, width: layout.panelWidth }}>
          <PanelHeaderFull
            tag="<button>"
            className=".btnPrimary"
            sourceFile="src/components/Button.tsx"
            breadcrumb={["body", "div.app", "main", "section.hero", "button.btnPrimary"]}
            scopePills={["element", ".btnPrimary", ".flex"]}
            showState
            badge={12}
          />
        </div>
      </div>

      {/* ── 10. Label Indicator States ── */}
      <div className="section-label">Label Indicator States</div>
      <div className="row">
        <div data-component="LabelIndicators" style={{ ...panelShell, width: layout.panelWidth, padding: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["modified", "none"] as const).map((type) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontFamily: font.sans, minWidth: layout.labelWidth,
                  background: labelIndicator[type].bg, color: labelIndicator[type].text,
                  padding: "1px 6px", borderRadius: 3,
                }}>
                  {type === "modified" ? "Width" : "Height"}
                </span>
                <span className="mono" style={{ fontSize: 9, color: blackAlpha(0.55), textTransform: "uppercase" }}>{type}</span>
                {type !== "none" && <Indicator type={type} />}
              </div>
            ))}
          </div>
        </div>

        {/* Footer variations */}
        <div data-component="Footer-HasChanges" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", fontSize: 10, color: text.disabled }}>With changes</div>
          <FooterBar hasChanges />
        </div>
        <div data-component="Footer-NoChanges" style={{ ...panelShell, width: layout.panelWidth }}>
          <div style={{ padding: "8px 12px", fontSize: 10, color: text.disabled }}>No changes (disabled)</div>
          <FooterBar />
        </div>
      </div>
    </>
  );
}
