'use client';

import React from 'react';

// ─── Tokens (Strict Token Grid) ─────────────────────────────────────────────

const T = {
  bg: '#FFFFFF',
  text: '#171717',
  label: '#525252',
  hint: '#A3A3A3',
  border: 'rgba(0,0,0,0.10)',
  surfaceSubtle: 'rgba(0,0,0,0.04)',
  surfaceHover: 'rgba(0,0,0,0.05)',
  surfaceActive: 'rgba(0,0,0,0.08)',
  primary: '#3B82F6',
  primaryAlpha30: 'rgba(59,130,246,0.3)',
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', monospace",
  panelWidth: 340,
  labelWidth: 64,
  rowPadding: '2px 12px',
  sectionPadding: '10px 12px 6px',
  controlGap: 6,
  iconBtnSize: 28,
  sliderHeight: 3,
  rowHeight: 28,
  borderRadius: 4,
} as const;

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      style={{
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 120ms ease',
        flexShrink: 0,
      }}
    >
      <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke={T.label} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlignStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
      <rect x="5" y="4" width="4" height="3" rx="0.5" fill="currentColor" />
      <rect x="5" y="8.5" width="6" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="7" y="1" width="10" height="1.2" rx="0.5" fill="currentColor" transform="rotate(90 7 1)" />
      <rect x="3.5" y="3" width="7" height="3" rx="0.5" fill="currentColor" />
      <rect x="2" y="7.5" width="10" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function AlignEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="11" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
      <rect x="5" y="4" width="4" height="3" rx="0.5" fill="currentColor" />
      <rect x="3" y="8.5" width="6" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function AlignStretchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="1.5" height="10" rx="0.5" fill="currentColor" />
      <rect x="11.5" y="2" width="1.5" height="10" rx="0.5" fill="currentColor" />
      <rect x="4" y="3" width="6" height="3" rx="0.5" fill="currentColor" />
      <rect x="4" y="8" width="6" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function AlignBaselineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="8" width="12" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2.5" y="3" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="5" width="3" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function JustifyStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="1.5" rx="0.5" fill="currentColor" />
      <rect x="4" y="4" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="4" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function JustifyCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2.5" y="3" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="3" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function JustifyEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="11.5" width="10" height="1.5" rx="0.5" fill="currentColor" />
      <rect x="4" y="7" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="7" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function JustifySpaceBetweenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="11.8" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="4" y="4.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="6.5" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function JustifySpaceAroundIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="1.2" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="2" y="11.8" width="10" height="1.2" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="3" y="4" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="8" y="7" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function TextAlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="5.5" width="7" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="8.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="11.5" width="5" height="1.2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function TextAlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="3.5" y="5.5" width="7" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="8.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="11.5" width="5" height="1.2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function TextAlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="5" y="5.5" width="7" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="8.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="7" y="11.5" width="5" height="1.2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function TextAlignJustifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="5.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="8.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
      <rect x="2" y="11.5" width="10" height="1.2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const styles = {
  panel: {
    width: T.panelWidth,
    background: T.bg,
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
    fontFamily: T.fontSans,
    color: T.text,
    overflow: 'hidden',
    userSelect: 'none' as const,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: T.sectionPadding,
    cursor: 'pointer',
    height: 32,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: T.text,
    lineHeight: '16px',
    flex: 1,
  },

  sectionBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: T.controlGap,
    padding: '0 12px 10px',
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: T.controlGap,
    padding: T.rowPadding,
    minHeight: T.rowHeight,
  },

  label: {
    fontSize: 11,
    color: T.label,
    width: T.labelWidth,
    flexShrink: 0,
    lineHeight: '14px',
    fontFamily: T.fontSans,
  },

  control: {
    border: `1px solid ${T.border}`,
    borderRadius: T.borderRadius,
    background: T.surfaceSubtle,
    height: T.rowHeight,
    fontSize: 11,
    color: T.text,
    fontFamily: T.fontSans,
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    flex: 1,
    minWidth: 0,
  },

  controlCompact: {
    border: `1px solid ${T.border}`,
    borderRadius: T.borderRadius,
    background: T.surfaceSubtle,
    height: T.rowHeight,
    fontSize: 11,
    color: T.text,
    fontFamily: T.fontSans,
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    padding: '0 6px',
    width: 52,
    flexShrink: 0,
  },

  unitBadge: {
    border: `1px solid ${T.border}`,
    borderRadius: T.borderRadius,
    background: T.surfaceSubtle,
    height: T.rowHeight,
    fontSize: 9,
    color: T.hint,
    fontFamily: T.fontMono,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    padding: '0 6px',
    width: 32,
    flexShrink: 0,
    letterSpacing: '0.02em',
  },

  iconBtn: (active: boolean) => ({
    width: T.iconBtnSize,
    height: T.iconBtnSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    border: `1px solid ${active ? T.primary : T.border}`,
    borderRadius: T.borderRadius,
    background: active ? T.primaryAlpha30 : T.surfaceSubtle,
    color: active ? T.primary : T.label,
    cursor: 'pointer',
    flexShrink: 0,
  }),

  segmentGroup: {
    display: 'flex',
    flex: 1,
    border: `1px solid ${T.border}`,
    borderRadius: T.borderRadius,
    overflow: 'hidden' as const,
    height: T.rowHeight,
  },

  segmentBtn: (active: boolean) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    fontSize: 11,
    fontFamily: T.fontSans,
    color: active ? T.primary : T.label,
    background: active ? T.primaryAlpha30 : T.surfaceSubtle,
    border: 'none',
    borderRight: `1px solid ${T.border}`,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    height: '100%',
    padding: '0 2px',
  }),

  tabGroup: {
    display: 'flex',
    gap: 0,
    border: `1px solid ${T.border}`,
    borderRadius: T.borderRadius,
    overflow: 'hidden' as const,
    height: T.rowHeight,
  },

  tabBtn: (active: boolean) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    fontSize: 11,
    fontFamily: T.fontSans,
    color: active ? T.bg : T.label,
    background: active ? T.primary : T.surfaceSubtle,
    border: 'none',
    borderRight: `1px solid ${T.border}`,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    height: '100%',
    padding: '0 8px',
  }),

  iconBtnGroup: {
    display: 'flex',
    gap: 2,
    flex: 1,
  },

  divider: {
    height: 1,
    background: T.border,
    margin: '0',
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.primary,
    flexShrink: 0,
  },

  sliderTrack: {
    flex: 1,
    height: T.sliderHeight,
    borderRadius: T.sliderHeight,
    background: `linear-gradient(to right, ${T.primary} 50%, rgba(0,0,0,0.12) 50%)`,
    position: 'relative' as const,
  },

  sliderThumb: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: T.bg,
    border: `2px solid ${T.primary}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },

  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: T.borderRadius,
    border: `1px solid ${T.border}`,
    flexShrink: 0,
  },

  hint: {
    fontSize: 9,
    color: T.hint,
    fontFamily: T.fontSans,
    lineHeight: '12px',
  },

  dropdownChevron: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: T.hint,
  },
} as const;

// ─── Section Components ──────────────────────────────────────────────────────

function SectionHeader({ title, open, hasIndicator }: { title: string; open: boolean; hasIndicator?: boolean }) {
  return (
    <div style={styles.sectionHeader}>
      <ChevronDown open={open} />
      <span style={styles.sectionTitle}>{title}</span>
      {hasIndicator && <div style={styles.dot} />}
    </div>
  );
}

function DropdownChevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={styles.dropdownChevron}>
      <path d="M2 3L4 5.5L6 3" stroke={T.hint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Layout Section ──────────────────────────────────────────────────────────

function LayoutSection() {
  return (
    <div>
      <SectionHeader title="Layout" open={true} hasIndicator={true} />
      <div style={styles.sectionBody}>
        {/* Display tabs */}
        <div style={styles.row}>
          <span style={styles.label}>Display</span>
          <div style={{ ...styles.tabGroup, flex: 1 }}>
            <div style={styles.tabBtn(false)}>Block</div>
            <div style={styles.tabBtn(true)}>Flex</div>
            <div style={{ ...styles.tabBtn(false), borderRight: 'none' }}>Grid</div>
          </div>
        </div>

        {/* Direction */}
        <div style={styles.row}>
          <span style={styles.label}>Direction</span>
          <div style={{ ...styles.segmentGroup }}>
            <div style={styles.segmentBtn(true)}>Horizontal</div>
            <div style={{ ...styles.segmentBtn(false), borderRight: 'none' }}>Vertical</div>
          </div>
        </div>

        {/* Align */}
        <div style={styles.row}>
          <span style={styles.label}>Align</span>
          <div style={styles.iconBtnGroup}>
            <div style={styles.iconBtn(false)}><AlignStartIcon /></div>
            <div style={styles.iconBtn(true)}><AlignCenterIcon /></div>
            <div style={styles.iconBtn(false)}><AlignEndIcon /></div>
            <div style={styles.iconBtn(false)}><AlignStretchIcon /></div>
            <div style={styles.iconBtn(false)}><AlignBaselineIcon /></div>
          </div>
        </div>

        {/* Justify */}
        <div style={styles.row}>
          <span style={styles.label}>Justify</span>
          <div style={styles.iconBtnGroup}>
            <div style={styles.iconBtn(true)}><JustifyStartIcon /></div>
            <div style={styles.iconBtn(false)}><JustifyCenterIcon /></div>
            <div style={styles.iconBtn(false)}><JustifyEndIcon /></div>
            <div style={styles.iconBtn(false)}><JustifySpaceBetweenIcon /></div>
            <div style={styles.iconBtn(false)}><JustifySpaceAroundIcon /></div>
          </div>
        </div>

        {/* Gap */}
        <div style={styles.row}>
          <span style={styles.label}>Gap</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: T.controlGap }}>
            <div style={styles.sliderTrack}>
              <div style={styles.sliderThumb} />
            </div>
            <div style={styles.controlCompact}>
              <span style={{ fontFamily: T.fontMono, fontSize: 11 }}>16</span>
            </div>
            <div style={styles.unitBadge}>px</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Typography Section ──────────────────────────────────────────────────────

function TypographySection() {
  return (
    <div>
      <SectionHeader title="Typography" open={true} hasIndicator={false} />
      <div style={styles.sectionBody}>
        {/* Font family */}
        <div style={styles.row}>
          <span style={styles.label}>Font</span>
          <div style={{ ...styles.control, justifyContent: 'space-between' }}>
            <span>Inter</span>
            <DropdownChevron />
          </div>
        </div>

        {/* Weight */}
        <div style={styles.row}>
          <span style={styles.label}>Weight</span>
          <div style={{ ...styles.control, justifyContent: 'space-between' }}>
            <span>Regular (400)</span>
            <DropdownChevron />
          </div>
        </div>

        {/* Size + Line Height side by side */}
        <div style={styles.row}>
          <span style={styles.label}>Size</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: T.controlGap }}>
            <div style={styles.controlCompact}>
              <span style={{ fontFamily: T.fontMono, fontSize: 11 }}>16</span>
            </div>
            <div style={styles.unitBadge}>px</div>
            <span style={{ ...styles.label, width: 'auto', marginLeft: 4 }}>H</span>
            <div style={styles.controlCompact}>
              <span style={{ fontFamily: T.fontMono, fontSize: 11 }}>1.5</span>
            </div>
            <div style={styles.unitBadge}>em</div>
          </div>
        </div>

        {/* Color */}
        <div style={styles.row}>
          <span style={styles.label}>Color</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: T.controlGap }}>
            <div style={{ ...styles.colorSwatch, background: '#171717' }} />
            <div style={{ ...styles.control, fontFamily: T.fontMono, fontSize: 11, flex: 1 }}>
              <span style={{ color: T.hint, marginRight: 2 }}>#</span>
              <span>171717</span>
            </div>
          </div>
        </div>

        {/* Text Align */}
        <div style={styles.row}>
          <span style={styles.label}>Align</span>
          <div style={styles.iconBtnGroup}>
            <div style={styles.iconBtn(true)}><TextAlignLeftIcon /></div>
            <div style={styles.iconBtn(false)}><TextAlignCenterIcon /></div>
            <div style={styles.iconBtn(false)}><TextAlignRightIcon /></div>
            <div style={styles.iconBtn(false)}><TextAlignJustifyIcon /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spacing Section (Collapsed) ─────────────────────────────────────────────

function SpacingSection() {
  return (
    <div>
      <SectionHeader title="Spacing" open={false} hasIndicator={false} />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VariantA() {
  return (
    <div style={styles.panel}>
      <LayoutSection />
      <div style={styles.divider} />
      <TypographySection />
      <div style={styles.divider} />
      <SpacingSection />
    </div>
  );
}
