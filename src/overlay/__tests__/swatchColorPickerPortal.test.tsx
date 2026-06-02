// @vitest-environment happy-dom
/**
 * SwatchColorPicker portal behavior.
 *
 * The shadow/gradient/filter sub-editors used to mount ColorPickerEnhanced as a
 * `position:absolute` child inside the panel, which has `overflow:hidden` — so
 * the ~240px picker got clipped near the panel's right edge and bottom.
 *
 * SwatchColorPicker fixes this by portalling the picker to document.body as a
 * `position:fixed` surface tagged `data-tuner-portal` (mirroring ColorRow /
 * ModeValueCell). These tests render the real control and verify that contract:
 * when opened, the picker is a child of document.body and NOT a descendant of
 * the control's own inline container.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { SwatchColorPicker } from "../controls/SwatchColorPicker";

afterEach(() => {
  cleanup();
});

describe("SwatchColorPicker — portal markup", () => {
  it("does not render the picker until opened", () => {
    render(<SwatchColorPicker value="#3b82f6" onChange={vi.fn()} />);
    expect(document.querySelector("[data-tuner-portal]")).toBeNull();
  });

  it("portals the picker to document.body inside a [data-tuner-portal] container when opened", () => {
    const { container } = render(
      <SwatchColorPicker value="#3b82f6" onChange={vi.fn()} />
    );

    // The control renders inside a wrapping div; the swatch is the button.
    const swatch = container.querySelector("button");
    expect(swatch).not.toBeNull();
    fireEvent.click(swatch!);

    const portal = document.querySelector("[data-tuner-portal]") as HTMLElement;
    expect(portal).not.toBeNull();

    // The portal is a position:fixed surface at the document level.
    expect(portal.style.position).toBe("fixed");

    // It is a child of document.body, NOT a descendant of the control's
    // own inline container (the thing that has overflow:hidden in the panel).
    expect(container.contains(portal)).toBe(false);
    let node: HTMLElement | null = portal;
    while (node && node !== document.body) node = node.parentElement;
    expect(node).toBe(document.body);
  });

  it("closes the portal on Escape", () => {
    const { container } = render(
      <SwatchColorPicker value="#3b82f6" onChange={vi.fn()} />
    );
    fireEvent.click(container.querySelector("button")!);
    expect(document.querySelector("[data-tuner-portal]")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector("[data-tuner-portal]")).toBeNull();
  });
});
