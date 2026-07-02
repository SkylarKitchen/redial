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
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useRef } from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { StateSelector } from "../shell/StateSelector";
import { usePageInteractions } from "../hooks/usePageInteractions";

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
    // 6 options — none/hover/focus/active/focus-within/focus-visible.
    // ":visited" is not offered (browser privacy restrictions make it
    // unpreviewable — no getComputedStyle diff, no forced rendering).
    expect(listbox!.querySelectorAll('[role="option"]').length).toBe(6);
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
    // No "Visited": browsers block :visited previewing for privacy (history
    // sniffing), so the option was removed from the selector.
    const cases: Array<[string, string]> = [
      ["Hover", "hover"],
      ["Focus", "focus"],
      ["Active", "active"],
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

  // NOTE: the portal-exemption contract (clicks inside [data-tuner-portal] not
  // hijacked) is now covered BEHAVIORALLY below — see "page-click handler …".
  // A source `.toContain("isInsideTunerUI")` scan stayed green even after BOTH
  // real guards (usePageInteractions.ts:76,79) were deleted (the import line
  // alone satisfied it), so it could never catch a regression of issue #23.
});

// ── Behavioral coverage for the page-click portal exemption (issue #23) ──────
//
// Mounts the REAL usePageInteractions hook and dispatches real clicks. This is
// the test the source-scan above could not be: deleting either guard
// (usePageInteractions.ts:76 target / :79 resolved-element) makes a case below
// fail, because elementFromPoint is stubbed to a NON-tuner element so only the
// isInsideTunerUI guards stand between a portal click and handleSelect.

function PageInteractionsHarness({
  selectedEl,
  handleSelect,
}: {
  selectedEl: Element;
  handleSelect: (el: Element) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePageInteractions({
    selectedEl,
    selecting: false,
    pinned: false,
    handleSelect,
    hoverHighlightRef: ref,
    setActiveModal: () => {},
  });
  return <div ref={ref} />;
}

describe("page-click handler exempts tuner-owned portals (issue #23, behavioral)", () => {
  let selectedDiv: HTMLDivElement;
  let pageTarget: HTMLDivElement;
  let portal: HTMLDivElement;
  let portalChild: HTMLButtonElement;

  beforeEach(() => {
    selectedDiv = document.createElement("div");
    pageTarget = document.createElement("div");
    portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    portalChild = document.createElement("button");
    portal.appendChild(portalChild);
    document.body.append(selectedDiv, pageTarget, portal);
  });

  afterEach(() => {
    [selectedDiv, pageTarget, portal].forEach((n) => n.remove());
    vi.restoreAllMocks();
  });

  it("re-selects when a normal page element is clicked (handler is live)", () => {
    document.elementFromPoint = vi.fn(() => pageTarget);
    const handleSelect = vi.fn();
    render(<PageInteractionsHarness selectedEl={selectedDiv} handleSelect={handleSelect} />);

    fireEvent.click(pageTarget);
    expect(handleSelect).toHaveBeenCalledWith(pageTarget);
  });

  it("does NOT re-select when the click TARGET is inside a [data-tuner-portal]", () => {
    // elementFromPoint resolves to a non-tuner element on purpose: only the
    // target guard (line 76) can prevent the hijack here.
    document.elementFromPoint = vi.fn(() => pageTarget);
    const handleSelect = vi.fn();
    render(<PageInteractionsHarness selectedEl={selectedDiv} handleSelect={handleSelect} />);

    fireEvent.click(portalChild);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("does NOT re-select when elementFromPoint resolves inside a tuner portal", () => {
    // Target is a normal element (passes line 76); only the resolved-element
    // guard (line 79) can prevent the hijack here.
    document.elementFromPoint = vi.fn(() => portalChild);
    const handleSelect = vi.fn();
    render(<PageInteractionsHarness selectedEl={selectedDiv} handleSelect={handleSelect} />);

    fireEvent.click(pageTarget);
    expect(handleSelect).not.toHaveBeenCalled();
  });
});
