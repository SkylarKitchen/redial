/**
 * TextStyleRow.tsx — Figma-like text style dropdown
 *
 * Shows a searchable dropdown of auto-detected text styles (h1–h6, p, etc.)
 * from the host page. Selecting a style batch-applies all typography props.
 * Follows the SelectRowCustom pattern from controls.tsx.
 *
 * Auto-detects available space below the trigger and flips upward when
 * the panel's ScrollArea would clip the dropdown.
 */

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { text, blackAlpha } from "./theme";
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
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  // Detect direction on open
  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < DROPDOWN_HEIGHT);
    }
    setOpen((o) => !o);
  };

  // Format font-size for display: "32px" → "32"
  const formatSize = (fontSize: string) => parseFloat(fontSize) || fontSize;

  const triggerLabel = matchedStyle
    ? `${matchedStyle.name} · ${formatSize(matchedStyle.fontSize)}`
    : "—";

  const dropdownPosition = openUp
    ? "absolute bottom-[calc(100%+2px)] left-0 right-0"
    : "absolute top-[calc(100%+2px)] left-0 right-0";

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

        {open && (
          <Command
            className={cn(
              dropdownPosition,
              "min-w-full bg-[var(--popover)] border border-[var(--border)] rounded shadow-lg z-[200]",
            )}
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
              <CommandEmpty className="py-1.5 text-center text-[11px] text-[var(--muted-foreground)] italic">
                No matches
              </CommandEmpty>
              {styles.map((style) => (
                <CommandItem
                  key={style.tag}
                  value={style.tag}
                  onSelect={() => {
                    onApply(style);
                    setOpen(false);
                  }}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono cursor-pointer leading-4 flex items-center justify-between",
                    matchedStyle?.tag === style.tag && "bg-[var(--primary)] text-white",
                  )}
                >
                  <span style={{ fontWeight: style.fontWeight }}>
                    {style.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] ml-2 shrink-0",
                      matchedStyle?.tag === style.tag
                        ? "text-white/60"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {formatSize(style.fontSize)}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </div>
    </div>
  );
}
