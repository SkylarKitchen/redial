/**
 * layoutPrimitives.tsx — Shared primitive controls extracted from layoutControls.tsx
 *
 * RowLabel, TextToggle, ReverseButton, MiniDropdown.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useCallback, useId } from "react";
import { ChevronDown } from "lucide-react";
import { color, text, border, surface, font, zIndex, shadow, segment, layout, type IndicatorType, indicatorStyle } from "../theme";
import { useResetPopover } from "../controls";
import { ms } from "../timing";
import { ArrowReverseIcon } from "../webflowIcons";
import { useClickOutside } from "../hooks/useClickOutside";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";

// ─── RowLabel ───────────────────────────────────────────────────────

/**
 * Shared label with blue highlight when modified.
 * Left-click on modified label opens a reset popover; Alt+click resets directly.
 */
export function RowLabel({ label, isSet, indicator, onReset }: {
  label: string;
  /** @deprecated Use `indicator` instead */
  isSet?: boolean;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const effectiveIndicator: IndicatorType = indicator ?? (isSet ? "modified" : "none");
  const resetPopover = useResetPopover(effectiveIndicator, onReset);

  return (
    <>
      <span
        ref={resetPopover.anchorRef}
        style={{
          fontSize: 11,
          flexShrink: 0,
          userSelect: "none" as const,
          lineHeight: "16px",
          width: layout.labelWidth,
          fontFamily: font.sans,
          cursor: onReset ? "default" : undefined,
        }}
        onClick={(e) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); return; } resetPopover.triggerOpen(); }}
      >
        <span style={indicatorStyle(effectiveIndicator)}>
          {label}
        </span>
      </span>
      {resetPopover.node}
    </>
  );
}

// ─── TextToggle ─────────────────────────────────────────────────────

/** Segmented text toggle: 2 options as a button pair */
export function TextToggle({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 4, border: `1px solid ${border.input}` }}>
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        const isFirst = i === 0;
        return (
          <TextToggleButton
            key={opt.value}
            opt={opt}
            isActive={isActive}
            isFirst={isFirst}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

function TextToggleButton({ opt, isActive, isFirst, onChange }: {
  opt: { value: string; label: string };
  isActive: boolean;
  isFirst: boolean;
  onChange: (v: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onChange(opt.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 28,
        padding: "0 10px",
        fontSize: 10,
        fontFamily: font.sans,
        cursor: "pointer",
        border: "none",
        outline: "none",
        transition: `color ${ms("fast")} ease, background ${ms("fast")} ease`,
        ...(!isFirst ? { borderLeft: `1px solid ${border.input}` } : {}),
        ...(isActive
          ? { background: surface.active, color: color.foreground, fontWeight: 500 }
          : { background: hovered ? surface.hover : "transparent", color: text.label }),
      }}
    >
      {opt.label}
    </button>
  );
}

// ─── ReverseButton ──────────────────────────────────────────────────

/** Webflow-style icon button for flex-direction reverse / wrap-reverse */
export function ReverseButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      title={active ? "Reverse (active)" : "Reverse"}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        border: "none",
        outline: "none",
        cursor: "pointer",
        flexShrink: 0,
        padding: 4,
        overflow: "hidden",
        transition: `background ${ms("fast")} ease`,
        background: active ? segment.activeBg : segment.bg,
        color: active ? text.primary : text.secondary,
      }}
    >
      <ArrowReverseIcon size={16} />
    </button>
  );
}

// ─── MiniDropdown ───────────────────────────────────────────────────

/** Mini dropdown for X/Y alignment values */
export function MiniDropdown({ value, options, onChange }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const id = useId();
  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, closeDropdown);

  const optionLabels = options.map(o => o.label);
  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: options.length,
    selectedIndex: options.findIndex((o) => o.value === value),
    onSelect: (i) => { onChange(options[i].value); setOpen(false); },
    labels: optionLabels,
  });

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        style={{
          width: "100%",
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 6,
          paddingRight: 6,
          background: color.input,
          border: `1px solid ${border.default}`,
          borderRadius: 3,
          fontSize: 10,
          fontFamily: font.mono,
          cursor: "pointer",
          outline: "none",
          color: text.label,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? value}</span>
        <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: 4, flexShrink: 0, color: text.disabled }} />
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          onKeyDown={onListKeyDown}
          style={{
            position: "absolute",
            zIndex: zIndex.popover,
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            minWidth: 80,
            background: color.popover,
            border: `1px solid ${border.input}`,
            borderRadius: 4,
            boxShadow: shadow.dropdown,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            const isHighlighted = i === highlightedIndex;
            return (
              <MiniDropdownOption
                key={opt.value}
                opt={opt}
                id={`${id}-opt-${i}`}
                active={active}
                isHighlighted={isHighlighted}
                optionRefCallback={i === highlightedIndex ? optionRefCallback : undefined}
                onChange={onChange}
                setOpen={setOpen}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniDropdownOption({ opt, id, active, isHighlighted, optionRefCallback, onChange, setOpen }: {
  opt: { value: string; label: string };
  id: string;
  active: boolean;
  isHighlighted: boolean;
  optionRefCallback?: (el: HTMLElement | null) => void;
  onChange: (v: string) => void;
  setOpen: (v: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      id={id}
      ref={optionRefCallback}
      role="option"
      aria-selected={active}
      onClick={() => { onChange(opt.value); setOpen(false); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        fontSize: 10,
        fontFamily: font.mono,
        cursor: "pointer",
        ...(active
          ? { background: color.primary, color: color.primaryForeground }
          : {
              color: text.label,
              background: isHighlighted || hovered ? surface.hover : "transparent",
            }),
      }}
    >
      {opt.label}
    </div>
  );
}
