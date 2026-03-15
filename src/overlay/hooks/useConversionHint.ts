/**
 * useConversionHint.ts — Hook for generating transient conversion tooltip hints
 *
 * Returns a ConversionHint state and a fire() function.
 * Call fire() after a unit conversion to show a tooltip in UnitSelector.
 * Each call creates a new object reference so UnitSelector can detect changes.
 */

import { useState, useCallback } from "react";
import type { ConversionHint } from "./UnitSelector";
import { conversionBasis, type UnitConversionContext } from "./unitConversion";

/** Pure computation: build a ConversionHint object. Exported for testing. */
export function buildConversionHint(
  oldValue: number,
  oldUnit: string,
  newValue: number,
  newUnit: string,
  ctx?: UnitConversionContext,
  axis?: "width" | "height",
): ConversionHint {
  const basis = ctx ? conversionBasis(newUnit, ctx, axis) : undefined;
  return { oldValue, oldUnit, newValue, newUnit, basis };
}

export function useConversionHint() {
  const [hint, setHint] = useState<ConversionHint | null>(null);

  const fire = useCallback(
    (
      oldValue: number,
      oldUnit: string,
      newValue: number,
      newUnit: string,
      ctx?: UnitConversionContext,
      axis?: "width" | "height"
    ) => {
      // Always create a fresh object so UnitSelector detects the change
      setHint(buildConversionHint(oldValue, oldUnit, newValue, newUnit, ctx, axis));
    },
    []
  );

  return { conversionHint: hint, fireConversionHint: fire } as const;
}
