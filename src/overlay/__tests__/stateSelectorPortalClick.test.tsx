// @vitest-environment happy-dom
/**
 * StateSelector portal-click behavior.
 *
 * Intent (originally a regression for issue #23): opening the State dropdown
 * and interacting with it must NOT be hijacked by the panel's capture-phase
 * page-click handler into reselecting a page element.
 *
 * StateSelector was reimplemented on the project's portal-dropdown pattern
 * (usePortalDropdown + createPortal to document.body). The mechanism that
 * keeps clicks from being hijacked is the `data-tuner-portal` attribute on
 * the portal container — the page-click handler exempts any click whose
 * target is inside `[data-tuner-portal]`. These tests render the real
 * component and verify that contract directly.
 *
 * The Overlay still hosts other Radix/shadcn consumers, so the
 * `data-radix-popper-content-wrapper` guards in usePageInteractions.ts
 * remain necessary — the final block verifies they are still present.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import { StateSelector } from "../shell/StateSelector";

afterEach(() => {
  cleanup();
});

/** Open the dropdown by clicking the combobox trigger. */
function openDropdown() {
  fireEvent.click(screen.getByRole("combobox"));
}

describe("StateSelector — portal markup", () => {
  it("renders the dropdown into document.body inside a [data-tuner-portal] container", () => {
    render(<StateSelector value="none" onChange={() => {}} />);
    openDropdown();

    const portal = document.querySelector("[data-tuner-portal]");
    expect(portal).not.toBeNull();
    // Portaled to body, not nested inside the trigger's inline container.
    expect(portal!.parentElement).toBe(document.body);
    // The options live inside the portal — so any click on them is exempted
    // by the panel's `[data-tuner-portal]` check.
    const listbox = portal!.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox!.querySelectorAll('[role="option"]').length).toBe(7);
  });

  it("does not render any Radix popper-content-wrapper (no shadcn Select)", () => {
    render(<StateSelector value="none" onChange={() => {}} />);
    openDropdown();
    expect(
      document.querySelector("[data-radix-popper-content-wrapper]"),
    ).toBeNull();
  });
});

describe("StateSelector — selection is not hijacked", () => {
  it("clicking an option fires onChange with that state's value", () => {
    const onChange = vi.fn();
    render(<StateSelector value="none" onChange={onChange} />);
    openDropdown();

    fireEvent.click(screen.getByText("Hover"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("hover");
  });

  it("every option resolves to its pseudo-class value", () => {
    const cases: Array<[string, string]> = [
      ["Hover", "hover"],
      ["Focus", "focus"],
      ["Active", "active"],
      ["Visited", "visited"],
      ["Focus Within", "focus-within"],
      ["Focus Visible", "focus-visible"],
    ];
    for (const [label, value] of cases) {
      const onChange = vi.fn();
      const { unmount } = render(<StateSelector value="none" onChange={onChange} />);
      openDropdown();
      fireEvent.click(screen.getByText(label));
      expect(onChange).toHaveBeenCalledWith(value);
      unmount();
    }
  });
});

describe("StateSelector — dismissal", () => {
  it("closes on outside click (usePortalDropdown click-outside)", () => {
    render(<StateSelector value="none" onChange={() => {}} />);
    openDropdown();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    // mousedown outside the trigger + portal closes the dropdown.
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("closes on Escape", () => {
    render(<StateSelector value="none" onChange={() => {}} />);
    openDropdown();
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toBeNull();

    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe("issue #23 — source verification: page-interaction handler keeps Radix guard", () => {
  // The page-click handler lives in hooks/usePageInteractions.ts. StateSelector
  // no longer uses Radix, but other panel consumers still do, so these guards
  // must remain in place.
  const pageInteractionsSrc = readFileSync(
    join(__dirname, "../hooks/usePageInteractions.ts"),
    "utf-8",
  );

  it("checks for an open Radix popper-content-wrapper on pointerdown", () => {
    expect(pageInteractionsSrc).toContain("data-radix-popper-content-wrapper");
  });

  it("uses a pending-dismissal flag to gate the page-click handler", () => {
    expect(pageInteractionsSrc).toMatch(/radixDismissPending/);
  });

  it("exempts tuner-owned clicks via isInsideTunerUI (covers [data-tuner-portal])", () => {
    // The page-click handler delegates portal exemption to isInsideTunerUI,
    // whose selector list includes [data-tuner-portal] (see util.ts). That is
    // what keeps clicks inside StateSelector's portal from reselecting a page
    // element.
    expect(pageInteractionsSrc).toContain("isInsideTunerUI");

    const utilSrc = readFileSync(join(__dirname, "../util.ts"), "utf-8");
    expect(utilSrc).toContain("[data-tuner-portal]");
  });
});
