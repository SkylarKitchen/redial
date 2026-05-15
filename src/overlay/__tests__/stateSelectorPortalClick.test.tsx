// @vitest-environment happy-dom
/**
 * Regression test for issue #23: opening the State dropdown and then
 * dismissing it (Escape, outside click, or picking an item) must NOT change
 * the currently selected element to <html>.
 *
 * Root cause: Radix `Select` dismisses on `pointerdown` (not click). When the
 * user clicks outside the dropdown to dismiss it, the sequence is:
 *
 *   1. pointerdown outside → Radix calls `onDismiss` → portal unmounts
 *   2. mouseup happens after the portal is gone
 *   3. click event fires with `target` set to whatever now occupies the
 *      cursor position — typically `<html>` if the user clicked on empty
 *      space
 *
 * The Overlay's capture-phase click handler (`Overlay.tsx` ~1285-1308) sees
 * `<html>` as the click target and treats it as a fresh page-element
 * selection, silently changing the inspected element. The exemption list
 * (`__tuner-root`, `data-tuner-portal`, `data-radix-portal`, etc.) cannot
 * catch this because the dropdown that owned the click has already been
 * torn down. (Side note: `data-radix-portal` does not exist in Radix; the
 * real portal wrapper is `data-radix-popper-content-wrapper`.)
 *
 * Fix: the click handler must recognize a "Radix-dismissal click" — a click
 * whose preceding pointerdown happened while a Radix popper-content-wrapper
 * was mounted — and skip it.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

/**
 * Mirrors the capture-phase handlers installed by Overlay.tsx (lines
 * 1285-1308). The `radixDismissPending` ref is the fix: pointerdown sets it
 * when a Radix popper is currently mounted; the next click consumes and
 * skips for that reason.
 */
function installPanelHandlers(opts: { withFix: boolean }) {
  const handleSelect = vi.fn();
  let radixDismissPending = false;

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (
      opts.withFix &&
      document.querySelector("[data-radix-popper-content-wrapper]")
    ) {
      radixDismissPending = true;
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (opts.withFix && radixDismissPending) {
      radixDismissPending = false;
      return;
    }
    const target = e.target as Element | null;
    if (!target) return;
    if (target.closest(".__tuner-root")) return;
    if (target.closest(".__tuner-selected-outline")) return;
    if (target.closest("[data-tuner-portal]")) return;
    if (target.closest("[data-radix-portal]")) return;
    if (target.closest("[data-textstyle-portal]")) return;
    handleSelect(target);
  };

  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("click", handleClick, true);
  return {
    handleSelect,
    cleanup: () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
    },
  };
}

/**
 * Mounts a structure that mimics the live DOM when the State dropdown is
 * open: a panel root with `.__tuner-root` (the trigger lives inside this),
 * plus a sibling `[data-radix-popper-content-wrapper]` that Radix Portals
 * to `document.body`. The wrapper itself does NOT have `.__tuner-root` —
 * only its inner Content does, matching what `src/components/ui/select.tsx`
 * actually renders.
 */
function mountOpenDropdown() {
  const panel = document.createElement("div");
  panel.className = "__tuner-root";
  const trigger = document.createElement("button");
  trigger.setAttribute("role", "combobox");
  panel.appendChild(trigger);
  document.body.appendChild(panel);

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-radix-popper-content-wrapper", "");
  const content = document.createElement("div");
  content.className = "__tuner-root";
  content.setAttribute("role", "listbox");
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  return {
    panel,
    trigger,
    wrapper,
    content,
    /** Simulate Radix dismissing the dropdown (portal unmounts). */
    dismiss: () => wrapper.remove(),
    /** Full teardown for the test. */
    teardown: () => {
      panel.remove();
      wrapper.remove();
    },
  };
}

describe("issue #23: State dropdown dismissal must not reselect <html>", () => {
  it("reproduces the bug: outside-click dismissal with no fix selects <html>", () => {
    const dom = mountOpenDropdown();
    const { handleSelect, cleanup: removeHandlers } = installPanelHandlers({
      withFix: false,
    });
    try {
      // Step 1: user pointerdowns outside the dropdown (empty page area
      // resolves to <html>). At this moment the popper is still mounted.
      document.documentElement.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );

      // Step 2: Radix's pointerdown-outside handler synchronously calls
      // onDismiss → portal unmounts.
      dom.dismiss();

      // Step 3: click event fires after the portal is already gone. The
      // browser delivers it with target = <html> because that's what is
      // under the cursor now.
      document.documentElement.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 }),
      );

      // Without the fix this is the bug: <html> becomes the new selection.
      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(document.documentElement);
    } finally {
      removeHandlers();
      dom.teardown();
    }
  });

  it("with fix: outside-click dismissal is suppressed (selection preserved)", () => {
    const dom = mountOpenDropdown();
    const { handleSelect, cleanup: removeHandlers } = installPanelHandlers({
      withFix: true,
    });
    try {
      document.documentElement.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      dom.dismiss();
      document.documentElement.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 }),
      );

      // With the fix: the dismissal click is recognized and skipped, so
      // selection is preserved.
      expect(handleSelect).not.toHaveBeenCalled();
    } finally {
      removeHandlers();
      dom.teardown();
    }
  });

  it("with fix: a normal page click (no popper open) still triggers selection", () => {
    // Set up a panel without any open dropdown.
    const panel = document.createElement("div");
    panel.className = "__tuner-root";
    document.body.appendChild(panel);

    const pageEl = document.createElement("div");
    pageEl.className = "page-content";
    document.body.appendChild(pageEl);

    const { handleSelect, cleanup: removeHandlers } = installPanelHandlers({
      withFix: true,
    });
    try {
      pageEl.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      pageEl.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 }),
      );

      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(pageEl);
    } finally {
      removeHandlers();
      panel.remove();
      pageEl.remove();
    }
  });
});
