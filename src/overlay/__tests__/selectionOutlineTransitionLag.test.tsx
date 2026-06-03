// @vitest-environment happy-dom
/**
 * Regression: the selected-element outline lags the content during scroll and
 * lazily catches up to live edits — even after the JS reposition was made
 * synchronous (see elementTrackerScrollLag.test.tsx).
 *
 * Root cause: the outline <div> carries `transition: all <normal> ease-out`.
 * useElementTracker writes its top/left/width/height synchronously on every
 * scroll frame and every panel edit, but the CSS transition then *animates*
 * each of those writes over `normal` ms — so the box perpetually trails the
 * natively-scrolled content (scroll lag) and glides toward each new size on a
 * live edit instead of snapping (the "not updating in real time" feel).
 *
 * BoxModelOverlay already learned this lesson (transition: "none"). The
 * selection outline must do the same: its geometry must NOT be transitioned.
 *
 * This test fails while the outline animates layout properties and passes once
 * the transition no longer covers top/left/width/height/inset.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { SelectionChrome } from "../shell/SelectionChrome";

function Harness() {
  const selectedOutlineRef = useRef<HTMLDivElement | null>(null);
  const ancestorOutlineRef = useRef<HTMLDivElement | null>(null);
  const dimensionsBadgeRef = useRef<HTMLDivElement | null>(null);
  const tagLabelRef = useRef<HTMLDivElement | null>(null);
  const hoverHighlightRef = useRef<HTMLDivElement | null>(null);
  return (
    <SelectionChrome
      selectedOutlineRef={selectedOutlineRef}
      ancestorOutlineRef={ancestorOutlineRef}
      dimensionsBadgeRef={dimensionsBadgeRef}
      tagLabelRef={tagLabelRef}
      hoverHighlightRef={hoverHighlightRef}
    />
  );
}

/** True if a CSS transition string animates any layout/position property. */
function animatesLayout(transition: string): boolean {
  return /\b(all|top|left|right|bottom|width|height|inset)\b/.test(transition);
}

describe("selection outline — no CSS transition lag on scroll / live edits", () => {
  it("does not transition the selected outline's layout properties", () => {
    const { container } = render(<Harness />);
    const outline = container.querySelector(
      ".__tuner-selected-outline",
    ) as HTMLElement | null;
    expect(outline).toBeTruthy();

    const transition = outline!.style.transition || "";
    expect(
      animatesLayout(transition),
      `selected outline transition "${transition}" must not animate layout props ` +
        `(top/left/width/height) — that makes it trail the content on scroll and ` +
        `edits. Mirror BoxModelOverlay's transition: "none".`,
    ).toBe(false);
  });
});
