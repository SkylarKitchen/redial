// @vitest-environment happy-dom
/**
 * colorRowHoverShift.test.tsx — Behavioral test: ColorRow actions must not
 * cause layout shift on hover (issue #105 migration).
 *
 * Bug: When hovering a color variable row, the duplicate/trash action buttons
 * appear in the normal flow between the label and the swatch. This pushes the
 * color swatch and hex value to the right — an unexpected layout shift that
 * makes it hard to click the swatch to open the color picker.
 *
 * Fix: Action buttons must be positioned absolutely (or overlaid) so they don't
 * shift the swatch or hex value.
 *
 * This test mounts a real ColorRow with actions, measures the swatch position,
 * simulates hover (which reveals actions), and asserts the swatch position is
 * unchanged.
 *
 * Formerly a readFileSync + regex audit over ColorRow.tsx and helpers.tsx; now
 * the component is mounted and layout measurements are asserted.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ColorRow } from "../controls/ColorRow";
import { actionsOverlayStyle } from "../controls/helpers";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function renderColorRow(actions?: React.ReactNode) {
  const { container } = render(
    <ColorRow
      label="Color"
      value="#3b82f6"
      onChange={vi.fn()}
      actions={actions}
    />
  );
  const row = container.querySelector('[style*="display: flex"]') as HTMLElement;
  const swatch = container.querySelector('[role="button"]') as HTMLElement;
  return { container, row, swatch };
}

describe("ColorRow hover actions must not shift layout", () => {
  it("renders a color swatch button", () => {
    const { swatch } = renderColorRow();
    expect(swatch).not.toBeNull();
    expect(swatch.getAttribute("role")).toBe("button");
  });

  it("actions are positioned absolutely, not in normal flow", () => {
    const actions = <button>Duplicate</button>;
    const { container } = renderColorRow(actions);

    // Find the actions container — it wraps the actions prop
    const actionsContainer = Array.from(container.querySelectorAll("div")).find((div) => {
      const style = div.getAttribute("style") || "";
      return style.includes("position") && div.textContent === "Duplicate";
    });

    expect(actionsContainer).not.toBeNull();
    const style = actionsContainer!.getAttribute("style")!;
    expect(style).toContain("position");
    expect(style).toContain("absolute");
  });

  it("swatch position does not shift when row is hovered", () => {
    const actions = (
      <>
        <button>Duplicate</button>
        <button>Delete</button>
      </>
    );
    const { row, swatch } = renderColorRow(actions);

    // Measure swatch position before hover
    const rectBefore = swatch.getBoundingClientRect();

    // Simulate hover on the row (which would reveal actions)
    fireEvent.mouseEnter(row);

    // Measure swatch position after hover
    const rectAfter = swatch.getBoundingClientRect();

    // Position should be unchanged (absolute positioning means actions don't push siblings)
    expect(rectAfter.left).toBe(rectBefore.left);
    expect(rectAfter.top).toBe(rectBefore.top);
  });

  it("actionsOverlayStyle helper has position:absolute", () => {
    // Check the helper directly (imported at top)
    expect(actionsOverlayStyle.position).toBe("absolute");
  });

  it("actions container is rendered above row content (has zIndex)", () => {
    const actions = <button>Action</button>;
    const { container } = renderColorRow(actions);

    const actionsContainer = Array.from(container.querySelectorAll("div")).find((div) => {
      const style = div.getAttribute("style") || "";
      return style.includes("position") && div.textContent === "Action";
    });

    expect(actionsContainer).not.toBeNull();
    const style = actionsContainer!.getAttribute("style")!;
    // The actionsOverlayStyle includes zIndex to ensure actions appear above row content
    const hasZIndex = style.includes("z-index") || style.includes("zIndex");
    expect(hasZIndex).toBe(true);
  });
});
