/**
 * controls/SelectRow.tsx — Dropdown select row with optional searchable/font-preview mode.
 */

import React, { useState, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { type IndicatorType } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { ChevronDown } from "lucide-react";
import { color, font, shadow, surface, blackAlpha, zIndex } from "../theme";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
import { useDropdownKeyboard } from "../hooks/useDropdownKeyboard";
import { usePortalTarget } from "../hooks/usePortalTarget";
import { SearchableMenu } from "./SearchableMenu";
import { labelStyle, rowStyle, useResetPopover } from "./helpers";

export function SelectRow({
  label,
  value,
  options,
  onChange,
  onReset,
  indicator,
  searchable,
  fontPreview,
  weightPreview,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  indicator?: IndicatorType;
  /** Show a search/filter input at the top of the dropdown */
  searchable?: boolean;
  /** Render each option label in its own font-face (for font-family dropdowns) */
  fontPreview?: boolean;
  /** Render each option at its actual CSS font-weight (for font-weight dropdowns) */
  weightPreview?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "font-weight") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
}) {
  const [open, setOpen] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const portalTarget = usePortalTarget();

  const { dropdownPos, updateDropdownPos, portalRef } = usePortalDropdown({
    open,
    setOpen,
    triggerRef,
    containerRef,
    estimatedHeight: 200,
  });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback } = useDropdownKeyboard({
    open,
    setOpen,
    optionCount: options.length,
    selectedIndex,
    onSelect: (i) => {
      onChange(options[i].value);
      setOpen(false);
    },
    labels: options.map((o) => o.label),
  });

  const resetPopover = useResetPopover(indicator, onReset);
  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : label;
  const current = options.find((o) => o.value === value);
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={selectLabelTitle}
      style={labelStyle(indicator)}
    >
      {label}
    </span>
  );

  // Use the searchable custom dropdown for searchable/fontPreview cases
  if (searchable || fontPreview) {
    return (
      <SelectRowCustom
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        onReset={onReset}
        indicator={indicator}
        fontPreview={fontPreview}
        onContextMenu={onContextMenu}
        computedProp={computedProp}
        computedElement={computedElement}
      />
    );
  }

  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          ref={triggerRef}
          className="tuner-focusable"
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
          onClick={() => {
            if (!open) updateDropdownPos();
            setOpen((o) => !o);
          }}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              updateDropdownPos();
            }
            onTriggerKeyDown(e);
          }}
          style={{
            width: "100%",
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 2,
            fontSize: 11,
            fontFamily: font.mono,
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            backgroundColor: open ? blackAlpha(0.07) : btnHovered ? surface.hover : color.input,
            border: `1px solid ${color.border}`,
            color: color.foreground,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {current?.label ?? value}
          </span>
          <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, marginLeft: 4, color: color.mutedForeground }} />
        </button>

        {open && dropdownPos && createPortal(
          <div
            ref={portalRef}
            data-tuner-portal
            data-select-portal
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: zIndex.max,
            }}
          >
            <div
              id={`${id}-listbox`}
              role="listbox"
              onKeyDown={onListKeyDown}
              style={{
                minWidth: Math.max(dropdownPos.width, 80),
                backgroundColor: color.popover,
                border: `1px solid ${color.border}`,
                borderRadius: 4,
                boxShadow: shadow.dropdown,
                maxHeight: 180,
                overflowY: "auto" as const,
              }}
            >
              {options.map((opt, idx) => {
                const isActive = opt.value === value;
                const isHl = idx === highlightedIndex || idx === hoveredIdx;
                return (
                  <div
                    key={opt.value}
                    id={`${id}-opt-${idx}`}
                    ref={idx === highlightedIndex ? optionRefCallback : undefined}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      fontFamily: font.mono,
                      fontWeight: weightPreview ? opt.value : undefined,
                      cursor: "pointer",
                      lineHeight: "16px",
                      backgroundColor: isActive ? color.primary : isHl ? surface.hover : "transparent",
                      color: isActive ? color.primaryForeground : color.foreground,
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </div>
          </div>,
          portalTarget
        )}
      </div>
      {resetPopover.node}
    </div>
  );
}

/** Internal: searchable/fontPreview dropdown using inline SearchableMenu */
function SelectRowCustom({
  label,
  value,
  options,
  onChange,
  onReset,
  indicator,
  fontPreview,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  fontPreview?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
}) {
  const [open, setOpen] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalTarget = usePortalTarget();
  const { dropdownPos, updateDropdownPos, portalRef } = usePortalDropdown({
    open,
    setOpen,
    triggerRef,
    containerRef,
    estimatedHeight: 220,
  });
  const current = options.find((o) => o.value === value);
  const resetPopover = useResetPopover(indicator, onReset);

  const selectLabelTitle = indicator ? getIndicatorTitle(indicator) : label;
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={selectLabelTitle}
      style={labelStyle(indicator)}
    >
      {label}
    </span>
  );

  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          ref={triggerRef}
          className="tuner-focusable"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => {
            if (!open) updateDropdownPos();
            setOpen((o) => !o);
          }}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) updateDropdownPos();
              setOpen(true);
            }
          }}
          style={{
            width: "100%",
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 2,
            fontSize: 11,
            fontFamily: fontPreview && current ? `${current.value}, ui-monospace, 'SF Mono', monospace` : font.mono,
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            backgroundColor: open ? blackAlpha(0.07) : btnHovered ? surface.hover : color.input,
            border: `1px solid ${color.border}`,
            color: color.foreground,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {current?.label ?? value}
          </span>
          <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, marginLeft: 4, color: color.mutedForeground }} />
        </button>

        {open && dropdownPos && createPortal(
          <div
            ref={portalRef}
            data-tuner-portal
            data-select-custom-portal
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: zIndex.max,
            }}
          >
            <SearchableMenu
              items={options}
              getKey={(o) => o.value}
              getSearchText={(o) => o.label}
              activeKey={value}
              onSelect={(o) => {
                onChange(o.value);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
              style={{ minWidth: Math.max(dropdownPos.width, 200) }}
              renderItem={(opt, state) => (
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    lineHeight: "16px",
                    fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : font.mono,
                    color: state.active ? color.primaryForeground : color.foreground,
                  }}
                >
                  {opt.label}
                </div>
              )}
            />
          </div>,
          portalTarget
        )}
      </div>
      {resetPopover.node}
    </div>
  );
}
