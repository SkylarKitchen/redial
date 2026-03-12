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
import { cn } from "@/lib/utils";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { text, blackAlpha, color, border as borderTokens, shadow } from "./theme";
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
        zIndex: 99999,
      }}
    >
      <Command
        className={cn(
          "min-w-full rounded border",
        )}
        style={{
          background: color.popover,
          borderColor: borderTokens.default,
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
          className="h-7 text-[11px] font-sans"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          autoFocus
        />
        <CommandList className="max-h-[180px]">
          <CommandEmpty className="py-1.5 text-center text-[11px] italic" style={{ color: text.label }}>
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
                className={cn(
                  "px-2 py-1 text-[11px] font-mono cursor-pointer leading-4 flex items-center justify-between",
                )}
                style={isActive ? { background: color.primary, color: "#fff" } : undefined}
              >
                <span style={{ fontWeight: style.fontWeight }}>
                  {style.name}
                </span>
                <span
                  className="text-[10px] ml-2 shrink-0"
                  style={{ color: isActive ? "rgba(255,255,255,0.6)" : text.label }}
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
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span
        className="text-[11px] w-[70px] shrink-0 capitalize"
        style={{ color: text.label }}
      >
        Style
      </span>
      <div ref={containerRef} className="relative flex-1">
        <button
          ref={triggerRef}
          className={cn(
            "tuner-focusable w-full h-6 flex items-center justify-between",
            "bg-[var(--input)] border border-[var(--border)] rounded-sm",
            "text-[11px] font-mono text-[var(--foreground)] px-1.5 cursor-pointer outline-none",
            "hover:bg-[rgba(0,0,0,0.07)]",
            "focus:ring-2 focus:ring-[var(--ring)]",
          )}
          tabIndex={0}
          aria-expanded={open}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) updatePos();
              setOpen(true);
            }
          }}
          style={open ? { background: blackAlpha(0.07) } : undefined}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {triggerLabel}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="text-[var(--muted-foreground)] shrink-0 ml-1" />
        </button>
        {dropdown}
      </div>
    </div>
  );
}
