'use client';

import React, { useState } from 'react';

/* ── Tokens ── */
const t = {
  bg: '#FFFFFF',
  text: '#171717',
  label: '#525252',
  hint: '#A3A3A3',
  disabled: '#737373',
  border: 'rgba(0,0,0,0.10)',
  borderSubtle: 'rgba(0,0,0,0.06)',
  surfaceSubtle: 'rgba(0,0,0,0.04)',
  primary: '#3B82F6',
  primaryFaint: 'rgba(59,130,246,0.15)',
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', monospace",
  panelWidth: 340,
};

/* ── Inline SVG Icons ── */

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{
        transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 200ms ease',
        flexShrink: 0,
      }}
    >
      <path
        d="M5.25 3.5L8.75 7L5.25 10.5"
        stroke={t.hint}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="1" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function TypeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3H11M7 3V11M5 11H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpacingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 5V2H5M9 2H12V5M12 9V12H9M5 12H2V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PositionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 1V4M7 10V13M1 7H4M10 7H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Shared small components ── */

function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontFamily: t.fontSans,
        fontWeight: active ? 600 : 400,
        color: active ? t.primary : t.label,
        background: active ? t.primaryFaint : t.surfaceSubtle,
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

function MiniInput({ value, label, width = 56 }: { value: string; label: string; width?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div
        style={{
          width,
          height: 28,
          background: t.surfaceSubtle,
          borderRadius: 5,
          border: `1px solid ${t.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontFamily: t.fontMono,
          color: t.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AlignButton({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <button
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? t.primaryFaint : 'transparent',
        border: `1px solid ${active ? 'transparent' : t.borderSubtle}`,
        borderRadius: 5,
        cursor: 'pointer',
        color: active ? t.primary : t.label,
      }}
    >
      {icon}
    </button>
  );
}

/* ── Align/Justify mini icons ── */

function AlignStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="4" width="6" height="2.5" rx="0.75" fill="currentColor" />
      <rect x="4" y="7.5" width="4" height="2.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 1.5" />
      <rect x="3" y="4" width="8" height="2.5" rx="0.75" fill="currentColor" />
      <rect x="4" y="7.5" width="6" height="2.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function AlignEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="4" width="6" height="2.5" rx="0.75" fill="currentColor" />
      <rect x="6" y="7.5" width="4" height="2.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function JustifyStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="5" width="3" height="4" rx="0.75" fill="currentColor" />
      <rect x="8" y="5" width="3" height="4" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function JustifySpaceBetweenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3.5" y="5" width="3" height="4" rx="0.75" fill="currentColor" />
      <rect x="7.5" y="5" width="3" height="4" rx="0.75" fill="currentColor" />
    </svg>
  );
}

/* ── Section Definitions ── */

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
  summary: string;
  content: React.ReactNode;
}

function LayoutContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 4px' }}>
      {/* Display mode pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Display</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="Block" />
          <Pill label="Flex" active />
          <Pill label="Grid" />
          <Pill label="Inline" />
          <Pill label="None" />
        </div>
      </div>

      {/* Direction */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Direction</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="Row" active />
          <Pill label="Column" />
          <Pill label="Row Rev" />
          <Pill label="Col Rev" />
        </div>
      </div>

      {/* Align Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Align</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <AlignButton icon={<AlignStartIcon />} active />
          <AlignButton icon={<AlignCenterIcon />} />
          <AlignButton icon={<AlignEndIcon />} />
        </div>
      </div>

      {/* Justify Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Justify</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <AlignButton icon={<JustifyStartIcon />} active />
          <AlignButton icon={<JustifySpaceBetweenIcon />} />
          <AlignButton icon={<AlignCenterIcon />} />
          <AlignButton icon={<AlignEndIcon />} />
        </div>
      </div>

      {/* Gap */}
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="16" label="Gap" width={64} />
        <MiniInput value="16" label="Row Gap" width={64} />
        <MiniInput value="16" label="Col Gap" width={64} />
      </div>

      {/* Wrap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wrap</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="No Wrap" active />
          <Pill label="Wrap" />
        </div>
      </div>
    </div>
  );
}

function TypographyContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 4px' }}>
      {/* Font Family */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Family</span>
        <div
          style={{
            height: 30,
            background: t.surfaceSubtle,
            borderRadius: 5,
            border: `1px solid ${t.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: 12,
            fontFamily: t.fontSans,
            color: t.text,
          }}
        >
          Inter
        </div>
      </div>

      {/* Weight + Size row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="400" label="Weight" width={64} />
        <MiniInput value="16px" label="Size" width={64} />
        <MiniInput value="1.5" label="Line H" width={56} />
      </div>

      {/* Letter spacing + Color */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <MiniInput value="0" label="Spacing" width={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Color</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 5, background: '#171717', border: `1px solid ${t.borderSubtle}` }} />
            <span style={{ fontSize: 12, fontFamily: t.fontMono, color: t.label }}>#171717</span>
          </div>
        </div>
      </div>

      {/* Text Align */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Align</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="Left" active />
          <Pill label="Center" />
          <Pill label="Right" />
          <Pill label="Justify" />
        </div>
      </div>
    </div>
  );
}

function SpacingContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 4px' }}>
      {/* Margin */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margin</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <MiniInput value="0" label="Top" />
          <MiniInput value="0" label="Right" />
          <MiniInput value="24" label="Bottom" />
          <MiniInput value="0" label="Left" />
        </div>
      </div>

      {/* Padding */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Padding</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <MiniInput value="32" label="Top" />
          <MiniInput value="40" label="Right" />
          <MiniInput value="32" label="Bottom" />
          <MiniInput value="40" label="Left" />
        </div>
      </div>
    </div>
  );
}

function SizeContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 4px' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="auto" label="Width" width={80} />
        <MiniInput value="auto" label="Height" width={80} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="none" label="Min W" width={80} />
        <MiniInput value="none" label="Max W" width={80} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="none" label="Min H" width={80} />
        <MiniInput value="none" label="Max H" width={80} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overflow</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="Visible" active />
          <Pill label="Hidden" />
          <Pill label="Scroll" />
          <Pill label="Auto" />
        </div>
      </div>
    </div>
  );
}

function PositionContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 4px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontFamily: t.fontSans, color: t.hint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Position</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill label="Static" active />
          <Pill label="Relative" />
          <Pill label="Absolute" />
          <Pill label="Fixed" />
          <Pill label="Sticky" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <MiniInput value="auto" label="Top" />
        <MiniInput value="auto" label="Right" />
        <MiniInput value="auto" label="Bottom" />
        <MiniInput value="auto" label="Left" />
      </div>
      <MiniInput value="auto" label="Z-Index" width={64} />
    </div>
  );
}

/* ── Section Header ── */

function SectionHeader({
  section,
  expanded,
  onClick,
}: {
  section: Section;
  expanded: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px 9px 10px',
        background: hovered ? t.surfaceSubtle : 'transparent',
        border: 'none',
        borderLeft: expanded ? `2px solid ${t.primary}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 200ms ease',
      }}
    >
      <ChevronIcon rotated={expanded} />

      <span style={{ color: expanded ? t.text : t.label, display: 'flex', alignItems: 'center', gap: 5 }}>
        {section.icon}
      </span>

      <span
        style={{
          fontSize: 12,
          fontFamily: t.fontSans,
          fontWeight: expanded ? 600 : 500,
          color: expanded ? t.text : t.text,
          whiteSpace: 'nowrap',
        }}
      >
        {section.label}
      </span>

      {/* Summary values — only visible when collapsed */}
      {!expanded && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontFamily: t.fontMono,
            color: t.hint,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {section.summary}
        </span>
      )}

      {/* Preview dot on expanded header */}
      {expanded && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontFamily: t.fontMono,
            color: t.disabled,
            whiteSpace: 'nowrap',
          }}
        >
          {section.summary}
        </span>
      )}
    </button>
  );
}

/* ── Main Component ── */

export function VariantD() {
  const [expandedId, setExpandedId] = useState<string>('layout');

  const sections: Section[] = [
    {
      id: 'layout',
      label: 'Layout',
      icon: <LayoutIcon />,
      summary: 'flex \u00B7 row \u00B7 gap 16px',
      content: <LayoutContent />,
    },
    {
      id: 'typography',
      label: 'Typography',
      icon: <TypeIcon />,
      summary: 'Inter \u00B7 400 \u00B7 16px / 1.5 \u00B7 #171717',
      content: <TypographyContent />,
    },
    {
      id: 'spacing',
      label: 'Spacing',
      icon: <SpacingIcon />,
      summary: 'mb 24 \u00B7 p 32 40',
      content: <SpacingContent />,
    },
    {
      id: 'size',
      label: 'Size',
      icon: <SizeIcon />,
      summary: 'auto \u00D7 auto',
      content: <SizeContent />,
    },
    {
      id: 'position',
      label: 'Position',
      icon: <PositionIcon />,
      summary: 'static',
      content: <PositionContent />,
    },
  ];

  const toggle = (id: string) => {
    setExpandedId(prev => (prev === id ? '' : id));
  };

  return (
    <div
      style={{
        width: t.panelWidth,
        background: t.bg,
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        fontFamily: t.fontSans,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Style</span>
        <span style={{ fontSize: 11, fontFamily: t.fontMono, color: t.hint }}>div.container</span>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sections.map((section, i) => {
          const isExpanded = expandedId === section.id;
          return (
            <div key={section.id}>
              {i > 0 && (
                <div style={{ height: 1, background: t.borderSubtle, marginLeft: 12, marginRight: 12 }} />
              )}

              <SectionHeader
                section={section}
                expanded={isExpanded}
                onClick={() => toggle(section.id)}
              />

              {/* Expandable content area */}
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isExpanded ? 500 : 0,
                  opacity: isExpanded ? 1 : 0,
                  transition: 'max-height 250ms ease, opacity 200ms ease',
                  paddingLeft: 24,
                  paddingRight: 14,
                  borderLeft: isExpanded ? `2px solid ${t.primaryFaint}` : '2px solid transparent',
                }}
              >
                {section.content}
                <div style={{ height: 8 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderTop: `1px solid ${t.border}`,
          background: t.surfaceSubtle,
        }}
      >
        <span style={{ fontSize: 10, fontFamily: t.fontMono, color: t.hint }}>5 sections</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              fontFamily: t.fontSans,
              fontWeight: 500,
              color: t.label,
              background: 'transparent',
              border: `1px solid ${t.borderSubtle}`,
              borderRadius: 5,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            style={{
              fontSize: 11,
              fontFamily: t.fontSans,
              fontWeight: 600,
              color: '#fff',
              background: t.primary,
              border: 'none',
              borderRadius: 5,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
