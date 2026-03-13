/**
 * IconButtonGroup.tsx — Radio-style icon button group
 *
 * Used for text-align, text-decoration, text-transform, etc.
 * Supports single-select (radio) and multi-select (toggle) modes.
 * Pure inline styles with theme.ts tokens.
 */

import { useState, useCallback } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { color, surface, text, border as borderTokens, focusRing, primaryAlpha } from "./theme";
import { ms } from "./timing";

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
      <IconButtonItem
        key={opt.value}
        opt={opt}
        isActive={isActive}
        isFirst={isFirst}
        isLast={isLast}
        multi={multi}
        onReset={onReset}
        handleClick={handleClick}
        options={options}
      />
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
        style={{ flex: 1 }}
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
      style={{ flex: 1 }}
    >
      {items}
    </ToggleGroup>
  );
}

/** Individual button item with hover tracking */
function IconButtonItem({ opt, isActive, isFirst, isLast, multi, onReset, handleClick, options }: {
  opt: { value: string; icon: React.ReactNode; title?: string; label?: string };
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  multi: boolean;
  onReset?: () => void;
  handleClick: (v: string) => void;
  options: Array<{ value: string; icon: React.ReactNode; title?: string; label?: string }>;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <ToggleGroupItem
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "h-7 min-w-7 px-1.5 text-[13px] leading-none rounded-none",
        isFirst && !isLast && "rounded-l",
        isLast && !isFirst && "rounded-r",
        isFirst && isLast && "rounded",
        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
      )}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: `1px solid ${borderTokens.default}`,
        outline: "none",
        transition: `color ${ms("fast")} ease, background ${ms("fast")} ease`,
        borderLeftWidth: isFirst ? 1 : 0,
        backgroundColor: !isActive && hovered ? surface.hover : undefined,
        color: !isActive ? color.mutedForeground : undefined,
        fontWeight: isActive ? 500 : 400,
        boxShadow: focused ? focusRing : "none",
      }}
    >
      {opt.icon}
    </ToggleGroupItem>
  );
}
