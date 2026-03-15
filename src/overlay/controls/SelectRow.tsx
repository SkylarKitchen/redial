/**
 * controls/SelectRow.tsx — Dropdown select row with optional searchable/font-preview mode.
 */

import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { type IndicatorType } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "../ComputedTooltip";
import { ChevronDown } from "lucide-react";
import { color, font, shadow, surface, blackAlpha, zIndex } from "../theme";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="tuner-focusable flex-1"
          style={{
            fontFamily: font.mono,
            backgroundColor: color.input,
            border: `1px solid ${color.border}`,
            color: color.foreground,
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="max-h-[180px] rounded"
          style={{
            boxShadow: shadow.dropdown,
            backgroundColor: color.popover,
            border: `1px solid ${color.border}`,
          }}
        >
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                fontWeight: weightPreview ? opt.value : undefined,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {resetPopover.node}
    </div>
  );
}

/** Internal: searchable/fontPreview dropdown using shadcn Command (cmdk) */
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
            <Command
              style={{
                minWidth: Math.max(dropdownPos.width, 200),
                borderRadius: 4,
                boxShadow: shadow.dropdown,
                backgroundColor: color.popover,
                border: `1px solid ${color.border}`,
              }}
              filter={(value, search) => {
                const opt = options.find((o) => o.value === value);
                if (!opt) return 0;
                return opt.label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput
                placeholder="Search..."
                className="h-7 text-[11px]"
                style={{ fontFamily: font.sans }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                autoFocus
              />
              <CommandList className="max-h-[180px]">
                <CommandEmpty style={{ padding: "6px 0", textAlign: "center" as const, fontSize: 11, fontStyle: "italic", color: color.mutedForeground }}>
                  No matches
                </CommandEmpty>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      fontFamily: fontPreview ? `${opt.value}, ui-monospace, 'SF Mono', monospace` : font.mono,
                      cursor: "pointer",
                      lineHeight: "16px",
                      ...(opt.value === value ? { backgroundColor: color.primary, color: "#fff" } : {}),
                    }}
                  >
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>,
          document.body
        )}
      </div>
      {resetPopover.node}
    </div>
  );
}
