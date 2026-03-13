/**
 * ComputedTooltip.tsx — Passthrough wrapper (tooltip behavior removed)
 *
 * Previously showed computed CSS values on hover. Now just renders children.
 * Kept as a passthrough so callers don't need updating.
 */

import React from "react";

export interface ComputedTooltipProps {
  property: string;
  element: Element;
  displayValue?: string;
  children: React.ReactNode;
}

export function ComputedTooltip({ children }: ComputedTooltipProps) {
  return <>{children}</>;
}
