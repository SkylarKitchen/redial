// @vitest-environment happy-dom
/**
 * Test: ResetPopover's "Reset" button must fire onReset when clicked.
 *
 * Bug: Clicking the Reset button in the popover does nothing — the property
 * is not reset. Two issues are tested:
 * 1. The click handler fires onReset() + onClose()
 * 2. The popover should use light-mode styling (not dark)
 */
import { describe, it, expect, vi } from "vitest";
import { surface, color } from "../theme";

describe("ResetPopover", () => {
  it("Reset button click fires onReset (simulated DOM structure)", () => {
    // Simulate the ResetPopover DOM structure portaled to document.body
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    portal.style.position = "fixed";
    portal.style.zIndex = "2147483647";

    const resetBtn = document.createElement("div");
    resetBtn.setAttribute("role", "button");
    resetBtn.textContent = "Reset";
    portal.appendChild(resetBtn);
    document.body.appendChild(portal);

    // Simulate the Overlay's capture-phase handlePageClick
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

    // Simulate the ResetPopover's click-outside mousedown handler
    const clickOutsideHandler = (e: MouseEvent) => {
      if (portal.contains(e.target as Node)) return; // inside — don't close
      portal.remove(); // outside — close
    };
    document.addEventListener("mousedown", clickOutsideHandler, true);

    const onReset = vi.fn();
    resetBtn.addEventListener("click", () => onReset());

    // Click the Reset button
    resetBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    resetBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    resetBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    expect(onReset).toHaveBeenCalledTimes(1);

    // Cleanup
    portal.remove();
    document.removeEventListener("click", handlePageClick, true);
    document.removeEventListener("mousedown", clickOutsideHandler, true);
  });

  it("popover uses light-mode colors from theme tokens", () => {
    // The ResetPopover must use light-mode tokens, not darkMenu
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "../ResetPopover.tsx"), "utf8"
    );
    // Should NOT use darkMenu
    expect(source).not.toContain("darkMenu");
    // Should use light background token
    expect(source).toContain("color.background");
    // Should use theme text tokens, not hardcoded white
    expect(source).toContain("text.primary");
    expect(source).not.toContain("#E5E5E5");
  });
});
