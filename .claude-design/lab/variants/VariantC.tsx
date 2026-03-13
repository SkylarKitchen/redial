'use client';

import React from 'react';

// ─── Tokens ────────────────────────────────────────────────────

const t = {
  bg: '#FFFFFF',
  text: '#171717',
  textSecondary: '#404040',
  textLabel: '#525252',
  textHint: '#A3A3A3',
  border: 'rgba(0,0,0,0.10)',
  borderThin: 'rgba(0,0,0,0.08)',
  surfaceHeader: 'rgba(0,0,0,0.03)',
  surfaceSubtle: 'rgba(0,0,0,0.04)',
  primary: '#3B82F6',
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', monospace",
  panelWidth: 340,
  rowHeight: 24,
  vGap: 2,
} as const;

// ─── Icons (inline SVG) ────────────────────────────────────────

function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <path d="M3.75 2.5L6.25 5L3.75 7.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlex({ active }: { active?: boolean }) {
  const c = active ? t.primary : t.textHint;
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="4" height="8" rx="1" stroke={c} strokeWidth="1" />
      <rect x="6" y="3" width="4" height="8" rx="1" stroke={c} strokeWidth="1" />
      <rect x="11" y="3" width="2" height="8" rx="1" stroke={c} strokeWidth="0.8" opacity={0.4} />
    </svg>
  );
}

function IconBlock() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke={t.textHint} strokeWidth="1" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke={t.textHint} strokeWidth="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" stroke={t.textHint} strokeWidth="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" stroke={t.textHint} strokeWidth="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" stroke={t.textHint} strokeWidth="1" />
    </svg>
  );
}

function IconInline() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="4" width="5" height="6" rx="1" stroke={t.textHint} strokeWidth="1" />
      <rect x="8" y="4" width="5" height="6" rx="1" stroke={t.textHint} strokeWidth="1" />
    </svg>
  );
}

function IconRow() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M2 6H10" stroke={t.primary} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 3.5L9.5 6L7 8.5" stroke={t.primary} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconColumn() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M6 2V10" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.5 7L6 9.5L8.5 7" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWrap() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3H10.5" stroke={t.primary} strokeWidth="1" strokeLinecap="round" />
      <path d="M1.5 6H8.5C9.5 6 10.5 6.5 10.5 7.5C10.5 8.5 9.5 9 8.5 9H6" stroke={t.primary} strokeWidth="1" strokeLinecap="round" />
      <path d="M7 7.5L5.5 9L7 10.5" stroke={t.primary} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconNoWrap() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6H10.5" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
      <path d="M8 4L10.5 6L8 8" stroke={t.textHint} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBold() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M3.5 2H7C8.1 2 9 2.9 9 4C9 5.1 8.1 6 7 6H3.5V2Z" stroke={t.textHint} strokeWidth="1.2" />
      <path d="M3.5 6H7.5C8.6 6 9.5 6.9 9.5 8C9.5 9.1 8.6 10 7.5 10H3.5V6Z" stroke={t.textHint} strokeWidth="1.2" />
    </svg>
  );
}

function IconItalic() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M7.5 2L4.5 10" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 2H9" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
      <path d="M3 10H7" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function IconUnderline() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M3 2V6.5C3 8.15 4.34 9.5 6 9.5C7.66 9.5 9 8.15 9 6.5V2" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 11H9.5" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function IconStrikethrough() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6H10.5" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
      <path d="M8.5 3.5C8.5 2.67 7.38 2 6 2C4.62 2 3.5 2.67 3.5 3.5C3.5 4.33 4.62 5 6 5" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
      <path d="M3.5 8.5C3.5 9.33 4.62 10 6 10C7.38 10 8.5 9.33 8.5 8.5C8.5 7.67 7.38 7 6 7" stroke={t.textHint} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// ─── Align icons ───────────────────────────────────────────────

function AlignLeft() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3H8.5" stroke={t.primary} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 6H6" stroke={t.primary} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 9H7.5" stroke={t.primary} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AlignCenter() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M2 3H10" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.5 6H8.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 9H9.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AlignRight() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M3.5 3H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 6H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 9H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AlignJustify() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 6H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 9H10.5" stroke={t.textHint} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Small reusable components ─────────────────────────────────

function SectionHeader({
  label,
  expanded,
  dot,
}: {
  label: string;
  expanded: boolean;
  dot?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 22,
        padding: '0 10px',
        background: t.surfaceHeader,
        borderBottom: `0.5px solid ${t.borderThin}`,
        cursor: 'pointer',
        userSelect: 'none',
        gap: 5,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', width: 10 }}>
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </span>
      <span
        style={{
          fontSize: 10,
          fontFamily: t.fontSans,
          fontWeight: 600,
          color: t.textSecondary,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: t.primary,
            marginLeft: 2,
          }}
        />
      )}
      <span style={{ flex: 1 }} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: t.fontSans,
        color: t.textLabel,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function ValueText({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: mono ? t.fontMono : t.fontSans,
        color: t.text,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 8,
        fontFamily: t.fontSans,
        color: t.textHint,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: t.rowHeight,
        padding: '0 10px',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GroupedContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        height: 22,
      }}
    >
      {children}
    </div>
  );
}

function GroupedCell({
  children,
  divider,
  flex,
}: {
  children: React.ReactNode;
  divider?: boolean;
  flex?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6px',
        flex: flex ?? 1,
        borderRight: divider ? `0.5px solid ${t.borderThin}` : undefined,
        background: t.surfaceSubtle,
        gap: 3,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function MiniSelect({ value, width }: { value: string; width?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 22,
        padding: '0 6px',
        background: t.surfaceSubtle,
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        gap: 3,
        cursor: 'pointer',
        width: width,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: t.fontSans,
          color: t.text,
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {value}
      </span>
      <ChevronDown size={8} />
    </div>
  );
}

function SegmentedControl({
  items,
  activeIndex,
}: {
  items: React.ReactNode[];
  activeIndex: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 22,
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            background: i === activeIndex ? t.primary : t.surfaceSubtle,
            borderRight: i < items.length - 1 ? `0.5px solid ${t.borderThin}` : undefined,
            cursor: 'pointer',
          }}
        >
          <span style={{ opacity: i === activeIndex ? 1 : 0.6 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function MiniInput({ value, unit, width }: { value: string; unit?: string; width?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 22,
        padding: '0 5px',
        background: t.surfaceSubtle,
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        gap: 2,
        width,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: t.fontMono,
          color: t.text,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {unit && <Hint>{unit}</Hint>}
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        background: color,
        border: `0.5px solid ${t.border}`,
        flexShrink: 0,
      }}
    />
  );
}

// ─── AlignBox (compact 3x3 dot grid) ──────────────────────────

function AlignBox({ activeRow, activeCol }: { activeRow: number; activeCol: number }) {
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const active = r === activeRow && c === activeCol;
      dots.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: active ? 5 : 3,
            height: active ? 5 : 3,
            borderRadius: '50%',
            background: active ? t.primary : t.textHint,
            opacity: active ? 1 : 0.4,
            gridRow: r + 1,
            gridColumn: c + 1,
          }}
        />
      );
    }
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(3, 1fr)',
        gridTemplateColumns: 'repeat(3, 1fr)',
        width: 28,
        height: 28,
        placeItems: 'center',
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        background: t.surfaceSubtle,
        flexShrink: 0,
      }}
    >
      {dots}
    </div>
  );
}

// ─── Main Variant ──────────────────────────────────────────────

export function VariantC() {
  return (
    <div
      style={{
        width: t.panelWidth,
        fontFamily: t.fontSans,
        background: t.bg,
        borderRadius: 8,
        border: `0.5px solid ${t.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── Header bar ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '0 10px',
          borderBottom: `0.5px solid ${t.border}`,
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.text,
            fontFamily: t.fontSans,
          }}
        >
          .hero-card
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: t.fontMono,
            color: t.textHint,
            background: t.surfaceSubtle,
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          div
        </span>
        <span style={{ flex: 1 }} />
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="2" r="1" fill={t.textHint} />
          <circle cx="5" cy="5" r="1" fill={t.textHint} />
          <circle cx="5" cy="8" r="1" fill={t.textHint} />
        </svg>
      </div>

      {/* ══════════════════════════════════════════════
          LAYOUT SECTION (expanded)
          ══════════════════════════════════════════════ */}
      <SectionHeader label="Layout" expanded dot />

      <div style={{ display: 'flex', flexDirection: 'column', gap: t.vGap, padding: '4px 0' }}>
        {/* Display — icon-only segmented control */}
        <Row>
          <Label>Display</Label>
          <span style={{ flex: 1 }} />
          <SegmentedControl
            items={[
              <IconBlock key="b" />,
              <IconFlex active key="f" />,
              <IconGrid key="g" />,
              <IconInline key="i" />,
            ]}
            activeIndex={1}
          />
        </Row>

        {/* Direction + Wrap on same row */}
        <Row>
          <Label>Direction</Label>
          <span style={{ flex: 1 }} />
          <SegmentedControl
            items={[<IconRow key="r" />, <IconColumn key="c" />]}
            activeIndex={0}
          />
          <span style={{ width: 4 }} />
          <SegmentedControl
            items={[<IconNoWrap key="nw" />, <IconWrap key="w" />]}
            activeIndex={1}
          />
        </Row>

        {/* Align + Justify with AlignBox */}
        <Row style={{ height: 34 }}>
          <Label>Align</Label>
          <span style={{ flex: 1 }} />
          <AlignBox activeRow={0} activeCol={0} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginLeft: 4 }}>
            <Hint>justify: start</Hint>
            <Hint>align: start</Hint>
          </div>
        </Row>

        {/* Gap — grouped container with row + col */}
        <Row>
          <Label>Gap</Label>
          <span style={{ flex: 1 }} />
          <GroupedContainer>
            <GroupedCell divider>
              <Hint>R</Hint>
              <ValueText mono>16</ValueText>
            </GroupedCell>
            <GroupedCell>
              <Hint>C</Hint>
              <ValueText mono>12</ValueText>
            </GroupedCell>
          </GroupedContainer>
          <Hint>px</Hint>
        </Row>
      </div>

      {/* ══════════════════════════════════════════════
          TYPOGRAPHY SECTION (expanded)
          ══════════════════════════════════════════════ */}
      <SectionHeader label="Typography" expanded />

      <div style={{ display: 'flex', flexDirection: 'column', gap: t.vGap, padding: '4px 0' }}>
        {/* Font + Weight on single row */}
        <Row>
          <Label>Font</Label>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 3, minWidth: 0 }}>
            <MiniSelect value="Inter" width={100} />
            <MiniSelect value="Medium" width={72} />
          </div>
        </Row>

        {/* Size + Height + Spacing — grouped */}
        <Row>
          <Label>Size</Label>
          <span style={{ flex: 1 }} />
          <GroupedContainer>
            <GroupedCell divider>
              <ValueText mono>16</ValueText>
              <Hint>sz</Hint>
            </GroupedCell>
            <GroupedCell divider>
              <ValueText mono>1.5</ValueText>
              <Hint>lh</Hint>
            </GroupedCell>
            <GroupedCell>
              <ValueText mono>0</ValueText>
              <Hint>ls</Hint>
            </GroupedCell>
          </GroupedContainer>
        </Row>

        {/* Color */}
        <Row>
          <Label>Color</Label>
          <span style={{ flex: 1 }} />
          <ColorSwatch color="#171717" />
          <ValueText mono>#171717</ValueText>
          <Hint>100%</Hint>
        </Row>

        {/* Text align + style on same row */}
        <Row>
          <Label>Align</Label>
          <span style={{ flex: 1 }} />
          <SegmentedControl
            items={[
              <AlignLeft key="l" />,
              <AlignCenter key="c" />,
              <AlignRight key="r" />,
              <AlignJustify key="j" />,
            ]}
            activeIndex={0}
          />
          <span style={{ width: 4 }} />
          <SegmentedControl
            items={[
              <IconItalic key="i" />,
              <IconUnderline key="u" />,
              <IconStrikethrough key="s" />,
            ]}
            activeIndex={-1}
          />
        </Row>

        {/* Decoration hint row */}
        <Row style={{ height: 18 }}>
          <span style={{ flex: 1 }} />
          <Hint>text-decoration: none</Hint>
        </Row>
      </div>

      {/* ══════════════════════════════════════════════
          SPACING SECTION (collapsed)
          ══════════════════════════════════════════════ */}
      <SectionHeader label="Spacing" expanded={false} />

      {/* ── Footer / status bar ────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 22,
          padding: '0 10px',
          borderTop: `0.5px solid ${t.borderThin}`,
          gap: 6,
        }}
      >
        <Hint>3 sections</Hint>
        <span style={{ flex: 1 }} />
        <Hint>Dense Figma</Hint>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22c55e',
          }}
        />
      </div>
    </div>
  );
}
