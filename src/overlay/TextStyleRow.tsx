/**
 * TextStyleRow.tsx — Figma-like text style dropdown
 *
 * Shows a searchable dropdown of auto-detected text styles (h1–h6, p, etc.)
 * from the host page. Selecting a style batch-applies all typography props.
 *
 * Uses a fixed-position portal to avoid ScrollArea overflow clipping.
 * The dropdown anchors to the trigger button's bounding rect and auto-flips
 * upward when there isn't enough space below.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { text, blackAlpha, color, border as borderTokens, shadow, surface, focusRing, font, zIndex } from "./theme";
import { ms } from "./timing";
import type { TextStyle } from "./textStyleScanner";

export interface TextStyleRowProps {
  styles: TextStyle[];
  matchedStyle: TextStyle | null;
  onApply: (style: TextStyle) => void;
}

/** Estimated dropdown height: search (28px) + 9 items × 24px + padding */
const DROPDOWN_HEIGHT = 250;

export function TextStyleRow({ styles, matchedStyle, onApply }: TextStyleRowProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calculate position from trigger rect
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const up = spaceBelow < DROPDOWN_HEIGHT;
    setPos({
      top: up ? rect.top : rect.bottom + 2,
      left: rect.left,
      width: rect.width,
      up,
    });
  }, []);

  // Click-outside to close (check both container and portal)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Allow clicks inside the trigger row
      if (containerRef.current?.contains(target)) return;
      // Allow clicks inside the portal dropdown (identified by data attribute)
      const portal = document.querySelector("[data-textstyle-portal]");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const handleOpen = () => {
    if (!open) updatePos();
    setOpen((o) => !o);
  };

  // Format font-size for display: "32px" → "32"
  const formatSize = (fontSize: string) => parseFloat(fontSize) || fontSize;

  const triggerLabel = matchedStyle
    ? `${matchedStyle.name} · ${formatSize(matchedStyle.fontSize)}`
    : "—";

  const dropdown = open && pos && createPortal(
    <div
      data-textstyle-portal
      style={{
        position: "fixed",
        top: pos.up ? undefined : pos.top,
        bottom: pos.up ? window.innerHeight - pos.top + 2 : undefined,
        left: pos.left,
        width: pos.width,
        zIndex: zIndex.max,
      }}
    >
      <Command
        style={{
          minWidth: "100%",
          borderRadius: 4,
          border: `1px solid ${borderTokens.default}`,
          background: color.popover,
          boxShadow: shadow.dropdown,
        }}
        filter={(value, search) => {
          const style = styles.find((s) => s.tag === value);
          if (!style) return 0;
          return style.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}
      >
        <CommandInput
          placeholder="Search styles..."
          className="h-7"
          style={{ fontSize: 11, fontFamily: font.sans }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          autoFocus
        />
        <CommandList className="max-h-[180px]">
          <CommandEmpty
            style={{
              paddingTop: 6,
              paddingBottom: 6,
              textAlign: "center",
              fontSize: 11,
              fontStyle: "italic",
              color: text.label,
            }}
          >
            No matches
          </CommandEmpty>
          {styles.map((style) => {
            const isActive = matchedStyle?.tag === style.tag;
            return (
              <CommandItem
                key={style.tag}
                value={style.tag}
                onSelect={() => {
                  onApply(style);
                  setOpen(false);
                }}
                style={{
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  fontSize: 11,
                  fontFamily: font.mono,
                  cursor: "pointer",
                  lineHeight: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  ...(isActive ? { background: color.primary, color: "#fff" } : {}),
                }}
              >
                <span style={{ fontWeight: style.fontWeight }}>
                  {style.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    marginLeft: 8,
                    flexShrink: 0,
                    color: isActive ? "rgba(255,255,255,0.6)" : text.label,
                  }}
                >
                  {formatSize(style.fontSize)}
                </span>
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </div>,
    document.body,
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 2, paddingBottom: 2 }}>
      <span
        style={{
          fontSize: 11,
          width: 70,
          flexShrink: 0,
          textTransform: "capitalize",
          color: text.label,
        }}
      >
        Style
      </span>
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          ref={triggerRef}
          className="tuner-focusable"
          tabIndex={0}
          aria-expanded={open}
          onClick={handleOpen}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) updatePos();
              setOpen(true);
            }
          }}
          style={{
            width: "100%",
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: open || hovered ? surface.active : color.input,
            border: `1px solid ${borderTokens.default}`,
            borderRadius: 2,
            fontSize: 11,
            fontFamily: font.mono,
            color: text.primary,
            paddingLeft: 6,
            paddingRight: 6,
            cursor: "pointer",
            outline: "none",
            transition: `background-color ${ms("fast")}`,
            boxShadow: focused ? focusRing : "none",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {triggerLabel}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={2}
            style={{ color: text.label, flexShrink: 0, marginLeft: 4 }}
          />
        </button>
        {dropdown}
      </div>
    </div>
  );
}
