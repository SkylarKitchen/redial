'use client';

import React, { useState } from 'react';

/* ── Tokens ── */
const t = {
  bg: '#FFFFFF',
  text: '#171717',
  label: 'rgba(0,0,0,0.4)',
  hint: '#A3A3A3',
  divider: 'rgba(0,0,0,0.06)',
  hover: 'rgba(0,0,0,0.05)',
  primary: '#3B82F6',
  primary12: 'rgba(59,130,246,0.12)',
  primary8: 'rgba(59,130,246,0.08)',
  font: 'system-ui, sans-serif',
  panelW: 340,
  sectionPad: 12,
  controlGap: 6,
  radius: 6,
  radiusPill: 100,
};

/* ── Tiny icons (inline SVG) ── */

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      style={{
        transition: 'transform 150ms ease',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        flexShrink: 0,
      }}
    >
      <path
        d="M2.5 3.75L5 6.25L7.5 3.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="8" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="7" width="5" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="11" width="10" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconAlignCenter() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="3" width="8" height="2" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="7" width="5" height="2" rx="0.5" fill="currentColor" />
      <rect x="2" y="11" width="10" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconAlignRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="5" y="3" width="8" height="2" rx="0.5" fill="currentColor" />
      <rect x="8" y="7" width="5" height="2" rx="0.5" fill="currentColor" />
      <rect x="3" y="11" width="10" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconAlignJustify() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="7" width="12" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="11" width="12" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconAlignStart() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="3" height="4" rx="0.5" fill="currentColor" />
      <rect x="7" y="2" width="3" height="6" rx="0.5" fill="currentColor" />
      <line x1="1" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconAlignMiddle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="3" width="3" height="4" rx="0.5" fill="currentColor" />
      <rect x="7" y="2" width="3" height="6" rx="0.5" fill="currentColor" />
      <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function IconAlignEnd() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
      <rect x="7" y="6" width="3" height="6" rx="0.5" fill="currentColor" />
      <line x1="1" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconSpaceBetween() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="4" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="8" y="4" width="3" height="6" rx="0.5" fill="currentColor" />
      <line x1="1" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.2" />
      <line x1="13" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* ── Hoverable wrapper ── */

function Hoverable({
  children,
  style,
  activeStyle,
  active = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  activeStyle?: React.CSSProperties;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    background: 'transparent',
    borderRadius: t.radius,
    transition: 'background 120ms ease',
    cursor: 'pointer',
    ...style,
  };

  const hoverBg = active
    ? (activeStyle?.background ?? t.primary12)
    : hovered
      ? t.hover
      : 'transparent';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        background: active ? (activeStyle?.background ?? t.primary12) : hoverBg,
        color: active ? (activeStyle?.color ?? t.primary) : (style?.color ?? t.text),
        ...(active ? activeStyle : {}),
      }}
    >
      {children}
    </div>
  );
}

/* ── Ghost icon button ── */

function GhostIcon({
  children,
  active = false,
  size = 28,
}: {
  children: React.ReactNode;
  active?: boolean;
  size?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius,
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
        background: active ? t.primary12 : hovered ? t.hover : 'transparent',
        color: active ? t.primary : t.label,
      }}
    >
      {children}
    </div>
  );
}

/* ── Section header ── */

function SectionHeader({
  label,
  open,
  onToggle,
  dot = false,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  dot?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        cursor: 'pointer',
        userSelect: 'none',
        borderRadius: t.radius,
        transition: 'opacity 120ms ease',
        opacity: hovered ? 0.7 : 1,
      }}
    >
      <ChevronDown open={open} />
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: t.text,
          letterSpacing: '0.01em',
          fontFamily: t.font,
        }}
      >
        {label}
      </span>
      {dot && (
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: t.primary,
            marginLeft: 2,
          }}
        />
      )}
    </div>
  );
}

/* ── Borderless select ── */

function BorderlessSelect({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${t.controlGap}px 0`,
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: t.label,
          fontFamily: t.font,
          flexShrink: 0,
          width: 56,
        }}
      >
        {label}
      </span>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          borderRadius: t.radius,
          cursor: 'pointer',
          transition: 'background 120ms ease',
          background: hovered ? t.hover : 'transparent',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: t.text,
            fontFamily: t.font,
            fontWeight: 400,
          }}
        >
          {value}
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: hovered ? 0.5 : 0.25 }}>
          <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/* ── Borderless compact input ── */

function CompactInput({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span
        style={{
          fontSize: 10,
          color: t.label,
          fontFamily: t.font,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '4px 0',
          borderBottom: focused
            ? `1.5px solid ${t.primary}`
            : hovered
              ? `1px solid rgba(0,0,0,0.12)`
              : '1px solid transparent',
          transition: 'border-color 120ms ease',
        }}
      >
        <input
          value={value}
          readOnly
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            color: t.text,
            fontFamily: t.font,
            width: '100%',
            padding: 0,
          }}
        />
        {unit && (
          <span style={{ fontSize: 10, color: t.hint, fontFamily: t.font, flexShrink: 0 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Slider (borderless track) ── */

function BorderlessSlider({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: `${t.controlGap}px 0`,
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: t.label,
          fontFamily: t.font,
          width: 56,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {/* Track background */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 3,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.06)',
            transition: 'background 120ms ease',
          }}
        />
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${pct}%`,
            height: 3,
            borderRadius: 2,
            background: t.primary,
            opacity: hovered ? 1 : 0.7,
            transition: 'opacity 120ms ease',
          }}
        />
        {/* Thumb */}
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 0.5px 2px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.08)',
            transform: 'translateX(-50%)',
            transition: 'box-shadow 120ms ease, transform 120ms ease',
            ...(hovered
              ? { boxShadow: '0 0.5px 3px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.1)', transform: 'translateX(-50%) scale(1.15)' }
              : {}),
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: t.text,
          fontFamily: t.font,
          width: 36,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}{unit ?? ''}
      </span>
    </div>
  );
}

/* ── Pill selector ── */

function PillGroup({
  options,
  active,
}: {
  options: string[];
  active: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: `${t.controlGap}px 0`,
      }}
    >
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <Hoverable
            key={opt}
            active={isActive}
            style={{
              padding: '4px 12px',
              borderRadius: t.radiusPill,
              fontSize: 11.5,
              fontFamily: t.font,
              fontWeight: isActive ? 500 : 400,
              textAlign: 'center' as const,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeStyle={{
              background: t.primary8,
              color: t.primary,
            }}
          >
            {opt}
          </Hoverable>
        );
      })}
    </div>
  );
}

/* ── Ghost text button ── */

function GhostButton({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: '5px 0',
        textAlign: 'center',
        fontSize: 11.5,
        fontFamily: t.font,
        fontWeight: active ? 500 : 400,
        color: active ? t.primary : t.label,
        borderRadius: t.radius,
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
        background: active ? t.primary8 : hovered ? t.hover : 'transparent',
      }}
    >
      {label}
    </div>
  );
}

/* ── Color swatch row ── */

function ColorRow({
  label,
  hex,
  color,
}: {
  label: string;
  hex: string;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${t.controlGap}px 0`,
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: t.label,
          fontFamily: t.font,
          width: 56,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: t.radius,
          cursor: 'pointer',
          transition: 'background 120ms ease',
          background: hovered ? t.hover : 'transparent',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: color,
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: t.text,
            fontFamily: t.font,
            fontWeight: 400,
          }}
        >
          {hex}
        </span>
      </div>
    </div>
  );
}

/* ── Section divider ── */

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: t.divider,
        margin: `${t.sectionPad / 2}px 0`,
      }}
    />
  );
}

/* ── Row wrapper for labeled controls ── */

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${t.controlGap}px 0`,
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: t.label,
          fontFamily: t.font,
          width: 56,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Variant B: Borderless Webflow
   ════════════════════════════════════════════ */

export function VariantB() {
  const [layoutOpen, setLayoutOpen] = useState(true);
  const [typoOpen, setTypoOpen] = useState(true);
  const [spacingOpen, setSpacingOpen] = useState(false);

  return (
    <div
      style={{
        width: t.panelW,
        background: t.bg,
        borderRadius: 10,
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.06)',
        fontFamily: t.font,
        color: t.text,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── Panel title bar ── */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Style
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 10,
              color: t.hint,
              background: t.hover,
              padding: '2px 6px',
              borderRadius: t.radiusPill,
            }}
          >
            .hero-title
          </span>
        </div>
      </div>

      <Divider />

      {/* ── Content area ── */}
      <div style={{ padding: '0 16px' }}>
        {/* ════ LAYOUT SECTION ════ */}
        <SectionHeader
          label="Layout"
          open={layoutOpen}
          onToggle={() => setLayoutOpen(!layoutOpen)}
          dot
        />

        {layoutOpen && (
          <div style={{ paddingBottom: t.sectionPad }}>
            {/* Display — pill selector */}
            <ControlRow label="Display">
              <PillGroup
                options={['Block', 'Flex', 'Grid', 'None']}
                active="Flex"
              />
            </ControlRow>

            {/* Direction — ghost buttons */}
            <ControlRow label="Direction">
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <GhostButton label="Horizontal" active />
                <GhostButton label="Vertical" />
              </div>
            </ControlRow>

            {/* Align — icon buttons */}
            <ControlRow label="Align">
              <div style={{ display: 'flex', gap: 1 }}>
                <GhostIcon active><IconAlignStart /></GhostIcon>
                <GhostIcon><IconAlignMiddle /></GhostIcon>
                <GhostIcon><IconAlignEnd /></GhostIcon>
                <GhostIcon><IconSpaceBetween /></GhostIcon>
              </div>
            </ControlRow>

            {/* Gap — borderless slider */}
            <BorderlessSlider label="Gap" value={40} unit="px" />
          </div>
        )}

        <Divider />

        {/* ════ TYPOGRAPHY SECTION ════ */}
        <SectionHeader
          label="Typography"
          open={typoOpen}
          onToggle={() => setTypoOpen(!typoOpen)}
          dot
        />

        {typoOpen && (
          <div style={{ paddingBottom: t.sectionPad }}>
            {/* Font */}
            <BorderlessSelect label="Font" value="Inter" />

            {/* Weight */}
            <BorderlessSelect label="Weight" value="Semi Bold (600)" />

            {/* Size + Line Height — compact borderless inputs */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: `${t.controlGap}px 0`,
              }}
            >
              <div style={{ width: 56, flexShrink: 0 }} />
              <CompactInput label="Size" value="48" unit="px" />
              <CompactInput label="Height" value="56" unit="px" />
            </div>

            {/* Letter spacing + inputs */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: `${t.controlGap}px 0`,
              }}
            >
              <div style={{ width: 56, flexShrink: 0 }} />
              <CompactInput label="Spacing" value="-0.02" unit="em" />
              <CompactInput label="Indent" value="0" unit="px" />
            </div>

            {/* Color */}
            <ColorRow label="Color" hex="#171717" color="#171717" />

            {/* Text align — ghost icon buttons */}
            <ControlRow label="Align">
              <div style={{ display: 'flex', gap: 1 }}>
                <GhostIcon active><IconAlignLeft /></GhostIcon>
                <GhostIcon><IconAlignCenter /></GhostIcon>
                <GhostIcon><IconAlignRight /></GhostIcon>
                <GhostIcon><IconAlignJustify /></GhostIcon>
              </div>
            </ControlRow>
          </div>
        )}

        <Divider />

        {/* ════ SPACING SECTION (collapsed) ════ */}
        <SectionHeader
          label="Spacing"
          open={spacingOpen}
          onToggle={() => setSpacingOpen(!spacingOpen)}
        />

        {spacingOpen && (
          <div style={{ paddingBottom: t.sectionPad }}>
            <BorderlessSlider label="Top" value={24} unit="px" />
            <BorderlessSlider label="Right" value={0} unit="px" />
            <BorderlessSlider label="Bottom" value={24} unit="px" />
            <BorderlessSlider label="Left" value={0} unit="px" />
          </div>
        )}
      </div>

      {/* ── Bottom padding ── */}
      <div style={{ height: 8 }} />
    </div>
  );
}
