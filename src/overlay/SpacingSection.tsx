import React, { useState, memo } from "react";
import { Section } from "./controls";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { buildConversionContext, convertUnit } from "./unitConversion";
import { detectUnit, type SectionCtx } from "./panelUtils";
import type { SpacingValues } from "./infer";
import { SPACING_UNITS } from "./panelConstants";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className={cn(
        "flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-mono rounded-[3px] cursor-pointer outline-none",
        showBoxModel
          ? "bg-[rgba(59,130,246,0.2)] border border-[rgba(59,130,246,0.4)] text-[rgba(59,130,246,0.9)]"
          : "bg-[var(--input)] border border-[var(--border)] text-[var(--muted-foreground)]",
      )}
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
