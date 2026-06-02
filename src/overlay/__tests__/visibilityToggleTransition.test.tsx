// @vitest-environment happy-dom
/**
 * VisibilityToggle transition regression (spread-order bug).
 *
 * The button uses `usePressScale`, whose `pressStyle` carries its own
 * `transition` key (the transform spring). It was spread AFTER a standalone
 * `transition: "opacity 80ms ease"` line, so the later spread silently
 * clobbered the opacity transition — the fade never ran.
 *
 * The fix merges both transitions into one value. This test asserts the
 * rendered button's `style.transition` includes BOTH "opacity" and a
 * "transform" transition, proving the opacity fade survives the press spread.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { VisibilityToggle } from "../controls/VisibilityToggle";

describe("VisibilityToggle transition", () => {
  it("renders a button whose transition includes the opacity fade", () => {
    const { container } = render(
      createElement(VisibilityToggle, { visible: true, onToggle: vi.fn() })
    );
    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    const transition = button!.style.transition;
    // The opacity transition must survive the usePressScale spread.
    expect(transition).toContain("opacity");
    // The press transform spring must still be present too.
    expect(transition).toContain("transform");
  });
});
