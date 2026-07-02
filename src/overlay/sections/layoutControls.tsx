/**
 * layoutControls.tsx — Sub-components extracted from WebflowPanel.tsx
 *
 * RowLabel, DisplayTabs, FlexDirectionRow, GridTrackRow, MiniDropdown,
 * TypoValueCell.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 *
 * This file is now a thin barrel: the components live in cohesive sibling files
 * (layoutPrimitives, DisplayTabs, DirectionControls, GridControls, layoutMisc).
 * Existing import sites continue to import from "./layoutControls". Re-exports
 * with no remaining call sites (TextToggle, DirectionRow, GapRow, ChildrenRow)
 * were dropped in the issue #92 dead-code sweep.
 */

import { useEffect, useRef } from "react";
import { subscribeChanges } from "../core/apply";

export { RowLabel, MiniDropdown } from "./layoutPrimitives";
export { DisplayTabs } from "./DisplayTabs";
export { FlexDirectionRow } from "./DirectionControls";
export { GridTrackRow } from "./GridControls";
export { TypoValueCell } from "./layoutMisc";

// ─── useAppliedPropSync ───────────────────────────────────────────────
//
// Issue #77: multiple controls can write the same CSS property (e.g. the
// Layout section's AlignBox and the Size section's Children dropdown both
// edit `align-items`), each mirroring it in local state. This hook keeps
// those mirrors in sync by subscribing to the apply engine's change feed:
// whenever ANY control applies `prop` to `element`, `onApplied` receives
// the new value so the section can update its local state.

/** Invoke `onApplied(value)` whenever `prop` is applied to `element` from anywhere. */
export function useAppliedPropSync(
  element: Element,
  prop: string,
  onApplied: (value: string) => void,
): void {
  // Latest-callback ref so callers can pass inline closures without
  // resubscribing every render.
  const callbackRef = useRef(onApplied);
  callbackRef.current = onApplied;
  useEffect(
    () =>
      subscribeChanges((info) => {
        if (info.el === element && info.prop === prop) callbackRef.current(info.to);
      }),
    [element, prop],
  );
}
