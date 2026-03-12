/**
 * IconButtonGroup.tsx — Radio-style icon button group
 *
 * Used for text-align, text-decoration, text-transform, etc.
 * Supports single-select (radio) and multi-select (toggle) modes.
 * Built on Shadcn ToggleGroup primitives with dark theme styling.
 */

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface IconButtonGroupProps {
  options: Array<{ value: string; icon: React.ReactNode; title?: string; label?: string }>;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
  onReset?: () => void;
  "aria-label"?: string;
}

export function IconButtonGroup({ options, value, onChange, multi = false, onReset, "aria-label": ariaLabel }: IconButtonGroupProps) {
  const activeValues = multi ? new Set(value.split(" ").filter(Boolean)) : new Set([value]);

  const handleClick = useCallback(
    (optValue: string) => {
      if (multi) {
        // "none" is a reset value — clicking it clears everything
        if (optValue === "none") {
          onChange("none");
          return;
        }
        const current = new Set(value.split(" ").filter(Boolean));
        current.delete("none"); // remove "none" when toggling a real value
        if (current.has(optValue)) {
          current.delete(optValue);
        } else {
          current.add(optValue);
        }
        const result = Array.from(current).join(" ");
        onChange(result || "none");
      } else {
        // Toggle-deselect: clicking active option returns to "none"
        onChange(optValue === value ? "none" : optValue);
      }
    },
    [value, onChange, multi]
  );

  const items = options.map((opt, i) => {
    const isActive = activeValues.has(opt.value);
    const isFirst = i === 0;
    const isLast = i === options.length - 1;

    return (
      <ToggleGroupItem
        key={opt.value}
        value={opt.value}
        role={multi ? undefined : "radio"}
        aria-checked={multi ? undefined : isActive}
        aria-pressed={multi ? isActive : undefined}
        aria-label={opt.label ?? opt.title ?? opt.value}
        tabIndex={isActive ? 0 : -1}
        title={opt.title ?? opt.value}
        onClick={(e) => {
          e.preventDefault();
          if (e.altKey && onReset) { onReset(); return; }
          handleClick(opt.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const siblings = Array.from(e.currentTarget.parentElement?.children ?? []) as HTMLElement[];
            const idx = siblings.indexOf(e.currentTarget as HTMLElement);
            const next = e.key === "ArrowRight"
              ? siblings[(idx + 1) % siblings.length]
              : siblings[(idx - 1 + siblings.length) % siblings.length];
            next.focus();
            const nextOpt = options[siblings.indexOf(next)];
            if (nextOpt != null) handleClick(nextOpt.value);
          }
        }}
        className={cn(
          "flex items-center justify-center h-7 min-w-7 px-1.5 cursor-pointer",
          "border border-[var(--border)] outline-none",
          "text-[13px] leading-none font-sans",
          "transition-colors duration-75",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          // Active state
          isActive
            ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]"
            : "bg-transparent text-[var(--muted-foreground)] hover:bg-[rgba(0,0,0,0.05)]",
          // Border radius: first/last rounded, middle flat
          isFirst && "rounded-l rounded-r-none",
          isLast && "rounded-r rounded-l-none",
          !isFirst && !isLast && "rounded-none",
          // Collapse left border for non-first items
          !isFirst && "border-l-0"
        )}
      >
        {opt.icon}
      </ToggleGroupItem>
    );
  });

  // Radix ToggleGroup requires separate JSX for single vs multiple
  // to satisfy the discriminated union types
  if (multi) {
    return (
      <ToggleGroup
        type="multiple"
        value={value.split(" ").filter(Boolean)}
        onValueChange={() => { /* handled via onClick */ }}
        aria-label={ariaLabel}
        className="inline-flex gap-0"
      >
        {items}
      </ToggleGroup>
    );
  }

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={() => { /* handled via onClick */ }}
      aria-label={ariaLabel}
      className="inline-flex gap-0"
    >
      {items}
    </ToggleGroup>
  );
}
