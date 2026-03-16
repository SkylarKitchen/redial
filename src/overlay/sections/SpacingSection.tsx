import React, { useState, useCallback, useRef, memo } from "react";
import { Section } from "../controls";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { buildConversionContext, convertUnit } from "../unitConversion";
import { detectUnit, type SectionCtx } from "../panelUtils";
import { getAuthoredValue } from "../getAuthoredValue";
import type { SpacingValues } from "../core/infer";
import { SPACING_UNITS } from "../panelConstants";
interface SpacingSectionProps {
  ctx: SectionCtx;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  onSpacingReset?: (prop: string, value: number) => void;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

export const SpacingSection = memo(function SpacingSection({
  ctx,
  spacing,
  onSpacingChange,
  onSpacingReset,
  forceOpen,
  focusOpen,
  onToggle,
}: SpacingSectionProps) {
  const { element, sectionInd } = ctx;

  const [marginUnit, setMarginUnit] = useState(() => detectUnit(element, "margin-top"));
  const [paddingUnit, setPaddingUnit] = useState(() => detectUnit(element, "padding-top"));
  const marginUnitRef = useRef(marginUnit);
  marginUnitRef.current = marginUnit;
  const paddingUnitRef = useRef(paddingUnit);
  paddingUnitRef.current = paddingUnit;

  // ─── CSS variable state per spacing property ────────────────────
  const extractVar = (prop: string): string | null => {
    const authored = getAuthoredValue(element, prop);
    return authored?.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
  };

  const [spacingVars, setSpacingVars] = useState<Record<string, string | null>>(() => {
    const vars: Record<string, string | null> = {};
    for (const group of ["margin", "padding"]) {
      for (const side of ["top", "right", "bottom", "left"]) {
        vars[`${group}-${side}`] = extractVar(`${group}-${side}`);
      }
    }
    return vars;
  });

  const handleSpacingVarChange = useCallback((prop: string, varName: string | null) => {
    setSpacingVars(prev => ({ ...prev, [prop]: varName }));
    if (varName) {
      ctx.apply(prop, `var(${varName})`);
    } else {
      // Unlink: resolve computed value and apply as numeric
      const computed = parseFloat(getComputedStyle(element).getPropertyValue(prop));
      const isMargin = prop.startsWith("margin");
      const unit = isMargin ? marginUnitRef.current : paddingUnitRef.current;
      onSpacingChange(prop, isNaN(computed) ? 0 : computed, unit);
    }
  }, [element, ctx, onSpacingChange]);

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
        ind={ctx.ind}
        onReset={onSpacingReset}
        isTailwind={ctx.isTailwind}
        cssVars={spacingVars}
        onVarChange={handleSpacingVarChange}
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
