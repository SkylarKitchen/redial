import React, { useState, memo } from "react";
import { Section } from "./controls";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { buildConversionContext, convertUnit } from "./unitConversion";
import { detectUnit, type SectionCtx } from "./panelUtils";
import type { SpacingValues } from "./infer";
import { SPACING_UNITS } from "./panelConstants";
import { Box } from "lucide-react";

interface SpacingSectionProps {
  ctx: SectionCtx;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  showBoxModel?: boolean;
  onToggleBoxModel?: () => void;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

export const SpacingSection = memo(function SpacingSection({
  ctx,
  spacing,
  onSpacingChange,
  showBoxModel,
  onToggleBoxModel,
  forceOpen,
  focusOpen,
  onToggle,
}: SpacingSectionProps) {
  const { element, sectionInd } = ctx;

  const [marginUnit, setMarginUnit] = useState(() => detectUnit(element, "margin-top"));
  const [paddingUnit, setPaddingUnit] = useState(() => detectUnit(element, "padding-top"));

  const boxModelToggle = onToggleBoxModel ? (
    <button
      onClick={onToggleBoxModel}
      title={showBoxModel ? "Hide box model overlay (M)" : "Show box model overlay (M)"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 6px",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        background: showBoxModel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
        border: showBoxModel ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "3px",
        color: showBoxModel ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        outline: "none",
      }}
    >
      <Box size={11} strokeWidth={1.5} />
    </button>
  ) : undefined;

  return (
    <Section
      title="Spacing"
      indicator={sectionInd([
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
      ])}
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
      headerAction={boxModelToggle}
    >
      <SpacingBoxModel
        margin={spacing.margin}
        padding={spacing.padding}
        onChange={onSpacingChange}
        marginUnit={marginUnit}
        paddingUnit={paddingUnit}
        marginUnits={SPACING_UNITS}
        paddingUnits={SPACING_UNITS}
        element={element}
        onMarginUnitChange={(u) => {
          const ctx = buildConversionContext(element);
          const sides = ["top", "right", "bottom", "left"] as const;
          for (const s of sides) {
            const converted = convertUnit(spacing.margin[s], marginUnit, u, ctx);
            onSpacingChange(`margin-${s}`, converted, u);
          }
          setMarginUnit(u);
        }}
        onPaddingUnitChange={(u) => {
          const ctx = buildConversionContext(element);
          const sides = ["top", "right", "bottom", "left"] as const;
          for (const s of sides) {
            const converted = convertUnit(spacing.padding[s], paddingUnit, u, ctx);
            onSpacingChange(`padding-${s}`, converted, u);
          }
          setPaddingUnit(u);
        }}
      />
    </Section>
  );
});
