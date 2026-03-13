'use client';

import React from 'react';

/* ─── Apple Refined Tokens ─── */
const t = {
  bg: '#FFFFFF',
  text: '#111111',
  label: '#999999',
  hint: '#BBBBBB',
  border: 'rgba(0,0,0,0.08)',
  surface: 'rgba(0,0,0,0.03)',
  surfaceActive: 'rgba(0,0,0,0.06)',
  innerShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,0.08)',
  font: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  mono: 'SF Mono, ui-monospace, monospace',
  panelW: 340,
  rControl: 6,
  rSection: 8,
} as const;

/* ─── Shared inline style helpers ─── */
const font = (
  size: number,
  weight: number | string = 400,
  color: string = t.text,
): React.CSSProperties => ({
  fontFamily: t.font,
  fontSize: size,
  fontWeight: weight as number,
  color,
  letterSpacing: size >= 13 ? -0.2 : -0.1,
  lineHeight: 1,
  margin: 0,
});

/* ─── Icons (inline SVG) ─── */

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    style={{
      transition: 'transform 0.2s ease',
      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
    }}
  >
    <path
      d="M3 4.5L6 7.5L9 4.5"
      stroke={t.label}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlignStartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="2" height="12" rx="1" fill={t.label} />
    <rect x="6" y="4" width="4" height="4" rx="1" fill={t.text} />
    <rect x="6" y="10" width="6" height="3" rx="1" fill={t.text} />
  </svg>
);

const AlignCenterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="7" y="1" width="2" height="14" rx="1" fill={t.label} />
    <rect x="4" y="4" width="8" height="3" rx="1" fill={t.text} />
    <rect x="5" y="9" width="6" height="3" rx="1" fill={t.text} />
  </svg>
);

const AlignEndIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="12" y="2" width="2" height="12" rx="1" fill={t.label} />
    <rect x="6" y="4" width="4" height="4" rx="1" fill={t.text} />
    <rect x="4" y="10" width="6" height="3" rx="1" fill={t.text} />
  </svg>
);

const AlignStretchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="2" height="12" rx="1" fill={t.label} />
    <rect x="12" y="2" width="2" height="12" rx="1" fill={t.label} />
    <rect x="6" y="3" width="4" height="10" rx="1" fill={t.text} />
  </svg>
);

const AlignBaselineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="9" width="12" height="1.5" rx="0.75" fill={t.label} />
    <rect x="3" y="4" width="3" height="8" rx="1" fill={t.text} />
    <rect x="8" y="6" width="5" height="6" rx="1" fill={t.text} />
  </svg>
);

const TextAlignLeft = ({ active }: { active?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill={active ? t.primary : t.text} />
    <rect x="2" y="7" width="8" height="1.5" rx="0.75" fill={active ? t.primary : t.text} />
    <rect x="2" y="11" width="10" height="1.5" rx="0.75" fill={active ? t.primary : t.text} />
  </svg>
);

const TextAlignCenter = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill={t.text} />
    <rect x="4" y="7" width="8" height="1.5" rx="0.75" fill={t.text} />
    <rect x="3" y="11" width="10" height="1.5" rx="0.75" fill={t.text} />
  </svg>
);

const TextAlignRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill={t.text} />
    <rect x="6" y="7" width="8" height="1.5" rx="0.75" fill={t.text} />
    <rect x="4" y="11" width="10" height="1.5" rx="0.75" fill={t.text} />
  </svg>
);

const TextAlignJustify = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill={t.text} />
    <rect x="2" y="7" width="12" height="1.5" rx="0.75" fill={t.text} />
    <rect x="2" y="11" width="12" height="1.5" rx="0.75" fill={t.text} />
  </svg>
);

const alignIcons = [AlignStartIcon, AlignCenterIcon, AlignEndIcon, AlignStretchIcon, AlignBaselineIcon];
const alignLabels = ['Start', 'Center', 'End', 'Stretch', 'Baseline'];
const textAlignIcons = [TextAlignLeft, TextAlignCenter, TextAlignRight, TextAlignJustify];
const textAlignLabels = ['Left', 'Center', 'Right', 'Justify'];

/* ─── Reusable Components ─── */

/** Section wrapper with Apple-style header shadow */
function Section({
  title,
  expanded,
  children,
}: {
  title: string;
  expanded: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${t.border}` }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: expanded ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
        }}
      >
        <span style={font(14, 600)}>{title}</span>
        <ChevronDown open={expanded} />
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: '4px 16px 16px' }}>{children}</div>
      )}
    </div>
  );
}

/** A single property row with label + control */
function Row({
  label,
  children,
  style,
}: {
  label?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 0',
        minHeight: 32,
        gap: 8,
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            ...font(11, 500, t.label),
            width: 72,
            flexShrink: 0,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

/** Pill-shaped segmented control */
function PillSegmented({
  options,
  active,
}: {
  options: { value: string; label: string }[];
  active: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        background: t.surface,
        borderRadius: 999,
        padding: 2,
        boxShadow: t.innerShadow,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <div
            key={opt.value}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 28,
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: isActive ? '#FFFFFF' : 'transparent',
              boxShadow: isActive
                ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)'
                : 'none',
              ...font(12, isActive ? 500 : 400, isActive ? t.text : t.label),
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

/** Large pill button pair */
function PillButtonPair({
  options,
  active,
}: {
  options: { value: string; label: string }[];
  active: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        gap: 6,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <div
            key={opt.value}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: isActive ? t.primaryBg : t.surface,
              boxShadow: isActive ? 'none' : t.innerShadow,
              ...font(12, isActive ? 500 : 400, isActive ? t.primary : t.label),
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

/** Icon button bar in a rounded container */
function IconBar({
  icons,
  labels,
  activeIndex,
}: {
  icons: React.FC<{ active?: boolean }>[];
  labels: string[];
  activeIndex: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        background: t.surface,
        borderRadius: t.rControl,
        padding: 2,
        boxShadow: t.innerShadow,
      }}
    >
      {icons.map((Icon, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={labels[i]}
            title={labels[i]}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              borderRadius: t.rControl - 2,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              background: isActive ? '#FFFFFF' : 'transparent',
              boxShadow: isActive
                ? '0 1px 3px rgba(0,0,0,0.08)'
                : 'none',
            }}
          >
            <Icon active={isActive} />
          </div>
        );
      })}
    </div>
  );
}

/** Rounded inset input */
function InsetInput({
  value,
  suffix,
  width,
  mono,
}: {
  value: string;
  suffix?: string;
  width?: number;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        borderRadius: t.rControl,
        background: t.surface,
        boxShadow: t.innerShadow,
        padding: '0 10px',
        gap: 4,
        width: width ?? 'auto',
        flex: width ? undefined : 1,
      }}
    >
      <span
        style={{
          ...font(13, 400, t.text),
          fontFamily: mono ? t.mono : t.font,
        }}
      >
        {value}
      </span>
      {suffix && (
        <span style={font(11, 400, t.hint)}>{suffix}</span>
      )}
    </div>
  );
}

/** Rounded select-style control */
function RoundedSelect({
  value,
  width,
}: {
  value: string;
  width?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        borderRadius: t.rControl,
        background: t.surface,
        boxShadow: t.innerShadow,
        padding: '0 8px 0 10px',
        cursor: 'pointer',
        flex: width ? undefined : 1,
        width: width ?? 'auto',
      }}
    >
      <span style={font(13, 400, t.text)}>{value}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, flexShrink: 0 }}>
        <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={t.hint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Color swatch (large, rounded) */
function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        background: color,
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
      }}
    />
  );
}

/** Slider with thick track + rounded thumb */
function Slider({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      {/* Track bg */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: t.surface,
          boxShadow: t.innerShadow,
        }}
      />
      {/* Track fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${pct}%`,
          height: 4,
          borderRadius: 2,
          background: t.primary,
        }}
      />
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          left: `${pct}%`,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
}

/* ─── Main Variant Export ─── */

export function VariantE() {
  return (
    <div
      style={{
        width: t.panelW,
        background: t.bg,
        borderRadius: 12,
        boxShadow:
          '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)',
        fontFamily: t.font,
        overflow: 'hidden',
        color: t.text,
      }}
    >
      {/* ─── Header ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              background: t.primaryBg,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke={t.primary} strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <span style={font(13, 600)}>div.hero-section</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={font(11, 400, t.hint)}>body</span>
          <span style={font(11, 400, t.hint)}>/</span>
          <span style={font(11, 400, t.hint)}>main</span>
          <span style={font(11, 400, t.hint)}>/</span>
          <span style={font(11, 400, t.label)}>div</span>
        </div>
      </div>

      {/* ─── Layout Section (expanded) ─── */}
      <Section title="Layout" expanded>
        {/* Display */}
        <Row label="Display">
          <PillSegmented
            options={[
              { value: 'block', label: 'Block' },
              { value: 'flex', label: 'Flex' },
              { value: 'grid', label: 'Grid' },
              { value: 'none', label: 'None' },
            ]}
            active="flex"
          />
        </Row>

        {/* Direction */}
        <Row label="Direction">
          <PillButtonPair
            options={[
              { value: 'row', label: 'Horizontal' },
              { value: 'column', label: 'Vertical' },
            ]}
            active="row"
          />
        </Row>

        {/* Align */}
        <Row label="Align">
          <IconBar icons={alignIcons} labels={alignLabels} activeIndex={3} />
        </Row>

        {/* Gap */}
        <Row label="Gap">
          <Slider value={16} max={64} />
          <InsetInput value="16" suffix="px" width={72} mono />
        </Row>
      </Section>

      {/* ─── Typography Section (expanded) ─── */}
      <Section title="Typography" expanded>
        {/* Font */}
        <Row label="Font">
          <RoundedSelect value="Inter" />
        </Row>

        {/* Weight */}
        <Row label="Weight">
          <RoundedSelect value="Regular" />
        </Row>

        {/* Size + Height side by side */}
        <Row label="Size">
          <InsetInput value="16" suffix="px" mono />
          <span style={font(11, 400, t.hint)}>H</span>
          <InsetInput value="1.5" mono />
        </Row>

        {/* Color */}
        <Row label="Color">
          <ColorSwatch color="#171717" />
          <InsetInput value="#171717" mono />
        </Row>

        {/* Align */}
        <Row label="Align">
          <div
            style={{
              display: 'flex',
              flex: 1,
              background: t.surface,
              borderRadius: 999,
              padding: 2,
              boxShadow: t.innerShadow,
            }}
          >
            {textAlignIcons.map((Icon, i) => {
              const isActive = i === 0;
              return (
                <div
                  key={textAlignLabels[i]}
                  title={textAlignLabels[i]}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 32,
                    borderRadius: 999,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    boxShadow: isActive
                      ? '0 1px 3px rgba(0,0,0,0.08)'
                      : 'none',
                  }}
                >
                  <Icon active={isActive} />
                </div>
              );
            })}
          </div>
        </Row>
      </Section>

      {/* ─── Spacing Section (collapsed) ─── */}
      <Section title="Spacing" expanded={false} />
    </div>
  );
}
