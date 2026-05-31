/**
 * InspectorTabBar.tsx — the inspector's sub-header: the optional "Focus Mode"
 * pill and the Style / AI tab switcher.
 *
 * Extracted verbatim from Overlay.tsx. Pure presentational; the caller owns the
 * activePanel state and decides what selecting a tab / exiting focus mode does.
 */

import { ms } from "../timing";
import { color, text, border, font, primaryAlpha } from "../theme";
import type { ActivePanel } from "./overlayTypes";

export interface InspectorTabBarProps {
  activePanel: ActivePanel;
  onSelectTab: (tab: "custom" | "prompt") => void;
  focusMode: boolean;
  onExitFocus: () => void;
}

export function InspectorTabBar({ activePanel, onSelectTab, focusMode, onExitFocus }: InspectorTabBarProps) {
  return (
    <>
      {focusMode && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 2, paddingBottom: 2, borderBottom: `1px solid ${border.subtle}` }}>
          <span
            onClick={onExitFocus}
            style={{ fontSize: 9, fontWeight: 600, paddingLeft: 8, paddingRight: 8, paddingTop: 1, paddingBottom: 1, borderRadius: 9999, cursor: "pointer", userSelect: "none", letterSpacing: "0.04em", textTransform: "uppercase" as const, color: color.primary, background: primaryAlpha(0.15) }}
          >
            Focus Mode
          </span>
        </div>
      )}
      {/* -- Style / AI tab bar -- */}
      <div style={{ display: "flex", borderBottom: `1px solid ${border.subtle}`, paddingLeft: 12, paddingRight: 12, flexShrink: 0 }}>
        {(["custom", "prompt"] as const).map((tab) => {
          const isActive = activePanel.type === "inspector" && activePanel.tab === tab;
          const label = tab === "custom" ? "Style" : "AI";
          return (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              style={{
                background: "transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                borderBottom: `2px solid ${isActive ? color.primary : "transparent"}`,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 5,
                fontSize: 11,
                fontFamily: font.sans,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                color: isActive ? text.primary : text.label,
                transition: `color ${ms("normal")}, border-color ${ms("normal")}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
