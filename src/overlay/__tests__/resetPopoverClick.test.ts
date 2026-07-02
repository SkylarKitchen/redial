// @vitest-environment happy-dom
/**
 * Test: ResetPopover's "Reset" button must fire onReset when clicked.
 *
 * Bug: Clicking the Reset button in the popover does nothing — the property
 * is not reset. Two issues are tested:
 * 1. The click handler fires onReset() + onClose()
 * 2. The popover should use light-mode styling (not dark)
 *
 * CONVERTED (issue #105): previously test 1 clicked a hand-built fake DOM
 * (never mounting ResetPopover) and test 2 grepped ResetPopover.tsx source
 * for token names. Now both render the REAL component:
 *  - invariant 1 (click fires onReset+onClose) is exercised against the real
 *    portal, WITH the Overlay's capture-phase page-click handler installed —
 *    this also pins that the portal carries data-tuner-portal so the Overlay
 *    doesn't swallow the click (the original fake-DOM test's actual purpose);
 *  - invariant 2 (light-mode styling) asserts the rendered inline styles:
 *    background === theme color.background and text uses text.primary —
 *    the same tokens the old source-grep looked for, now checked where they
 *    actually land.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ResetPopover } from "../controls/ResetPopover";
import { color, text } from "../theme";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** Mount the real ResetPopover portaled to document.body. */
function renderPopover(onReset = vi.fn(), onClose = vi.fn()) {
  const anchor = document.createElement("span");
  document.body.appendChild(anchor);
  render(createElement(ResetPopover, { anchor, onReset, onClose }));
  const portal = document.querySelector("[data-tuner-portal]") as HTMLElement;
  return { portal, onReset, onClose };
}

describe("ResetPopover", () => {
  it("Reset button click fires onReset + onClose through the Overlay's capture-phase page-click handler", () => {
    const { portal, onReset, onClose } = renderPopover();
    expect(portal, "ResetPopover must render a [data-tuner-portal] portal").toBeTruthy();

    // Install the Overlay's capture-phase handlePageClick — the original bug
    // class: portals without data-tuner-portal get their clicks swallowed.
    const handlePageClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (target.closest(".__tuner-root")) return;
      if (target.closest("[data-tuner-portal]")) return;
      if (target.closest("[data-radix-portal]")) return;
      if (target.closest("[data-textstyle-portal]")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", handlePageClick, true);

    try {
      const resetRow = portal.querySelector('[role="button"]') as HTMLElement;
      expect(resetRow).toBeTruthy();
      expect(resetRow.textContent).toContain("Reset");

      fireEvent.mouseDown(resetRow, { button: 0 });
      fireEvent.mouseUp(resetRow, { button: 0 });
      fireEvent.click(resetRow, { button: 0 });

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("click", handlePageClick, true);
    }
  });

  it("Enter on the (auto-focused) Reset row fires onReset — keyboard path", () => {
    const { portal, onReset, onClose } = renderPopover();
    const resetRow = portal.querySelector('[role="button"]') as HTMLElement;
    // The row receives focus on open (issue #85)
    expect(document.activeElement).toBe(resetRow);
    fireEvent.keyDown(resetRow, { key: "Enter" });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("popover uses light-mode colors from theme tokens (rendered styles, not source text)", () => {
    const { portal } = renderPopover();

    // Light background token from theme.ts — not a dark menu background
    expect(portal.style.background).toBe(color.background);
    expect(portal.style.background).not.toBe("#E5E5E5");

    // The "Reset" label uses text.primary (light-mode text token)
    const label = Array.from(portal.querySelectorAll("span")).find((s) =>
      s.textContent?.trim().startsWith("Reset"),
    ) as HTMLElement;
    expect(label).toBeTruthy();
    expect(label.style.color).toBe(text.primary);
  });
});
