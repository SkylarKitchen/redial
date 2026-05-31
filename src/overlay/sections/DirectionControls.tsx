/**
 * DirectionControls.tsx — Flex direction rows extracted from layoutControls.tsx
 *
 * DirectionRow (legacy), FlexDirectionRow (Webflow style).
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useCallback } from "react";
import { WrapText } from "lucide-react";
import { text, surface, font, blackAlpha, segment, zIndex, layout, type IndicatorType } from "../theme";
import { ms } from "../timing";
import { SegmentedControl } from "../controls/SegmentedControl";
import { ChevronSmallDownIcon } from "../webflowIcons";
import { useClickOutside } from "../hooks/useClickOutside";
import { DIRECTION_ICONS_SHORT, DIRECTION_MORE_OPTIONS } from "../panelConstants";
import { ROW } from "../panelStyles";
import { RowLabel, ReverseButton } from "./layoutPrimitives";
import { DarkMenuOption } from "./DisplayTabs";

// ─── DirectionRow (legacy) ───────────────────────────────────────────

/** Direction row: Horizontal/Vertical segmented control + reverse button */
export function DirectionRow({ direction, onDirectionChange, onReset, indicator }: {
  direction: string;
  onDirectionChange: (v: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  const isHorizontal = !direction.startsWith("column");
  const isReverse = direction.includes("reverse");
  const isSet = direction !== "row";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
      <RowLabel label="Direction" indicator={indicator} isSet={isSet} onReset={onReset} />
      <SegmentedControl
        options={[
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ]}
        value={isHorizontal ? "horizontal" : "vertical"}
        onChange={(v) => {
          const base = v === "horizontal" ? "row" : "column";
          onDirectionChange(isReverse ? `${base}-reverse` : base);
        }}
        aria-label="Flex direction"
      />
      <ReverseButton
        active={isReverse}
        onClick={() => {
          const base = isHorizontal ? "row" : "column";
          onDirectionChange(isReverse ? base : `${base}-reverse`);
        }}
      />
    </div>
  );
}

// ─── FlexDirectionRow (Webflow-style: icons + wrap toggle + chevron) ─


/** Webflow-style direction row: 2-icon SegmentedControl + wrap toggle + chevron dropdown */
export function FlexDirectionRow({ direction, onDirectionChange, wrap, onWrapChange, onReset, indicator, wrapIndicator }: {
  direction: string;
  onDirectionChange: (v: string) => void;
  wrap: string;
  onWrapChange: (v: string) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  wrapIndicator?: IndicatorType;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

  const isWrap = wrap !== "nowrap";
  const isReverse = direction.includes("reverse");
  const base = direction.replace("-reverse", "") as "row" | "column";

  return (
    <div style={ROW}>
      <RowLabel label="Direction" indicator={indicator} isSet={direction !== "row"} onReset={onReset} />
      {/* Row / Column icon segments */}
      <SegmentedControl
        options={DIRECTION_ICONS_SHORT.slice(0, 2)}
        value={base}
        onChange={(v) => onDirectionChange(isReverse ? `${v}-reverse` : v)}
        aria-label="Flex direction"
      />
      {/* Wrap toggle button — separate from SegmentedControl since it controls a different prop */}
      <button
        title={isWrap ? "Wrap (active)" : "Wrap"}
        onClick={() => onWrapChange(isWrap ? "nowrap" : "wrap")}
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
          background: isWrap ? segment.activeBg : segment.bg,
          color: isWrap ? text.primary : text.secondary,
        }}
      >
        <WrapText size={14} strokeWidth={1.8} />
      </button>
      {/* Chevron dropdown for reverse variants */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title="More direction options"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          style={{
            width: 20,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            border: "none",
            outline: "none",
            cursor: "pointer",
            padding: 0,
            background: isReverse ? segment.activeBg : "transparent",
            color: isReverse ? text.primary : text.hint,
            transition: `background ${ms("fast")} ease`,
          }}
        >
          <ChevronSmallDownIcon size={16} />
        </button>
        {menuOpen && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 180,
              background: surface.darkMenu,
              borderRadius: 8,
              boxShadow: `0 8px 24px ${blackAlpha(0.35)}, 0 2px 8px ${blackAlpha(0.2)}`,
              padding: "6px 0",
              zIndex: zIndex.popover,
            }}
          >
            {DIRECTION_MORE_OPTIONS.map((opt) => {
              const isActive = opt.value === direction;
              return (
                <DarkMenuOption
                  key={opt.value}
                  label={opt.label}
                  isActive={isActive}
                  onClick={() => { onDirectionChange(opt.value); setMenuOpen(false); }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
