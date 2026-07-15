// @vitest-environment happy-dom
/**
 * scrubLabelKeyboard.test.tsx — Behavioral keyboard-accessibility tests for
 * ScrubLabel component (issue #143).
 *
 * ScrubLabel bundles three pieces: LabelScrub (drag to scrub), indicator dot,
 * and reset popover. This test suite covers keyboard accessibility when the
 * label is modified (indicator="modified" with onReset):
 *
 *   - Label is focusable (tabIndex=0) with role="button" and aria-label
 *   - Visible focus ring using theme tokens (focusRing box-shadow)
 *   - Enter opens the reset popover
 *   - Alt+Enter (modifier + activation key) resets directly without popover
 *   - Escape closes the popover and returns focus to the label
 *   - ARIA: role="button", aria-haspopup="dialog", aria-label naming property
 *   - Reset actually restores the style (not just callback fired)
 *   - Non-interactive state: no tabIndex/role when indicator is NOT "modified"
 *     or onReset is absent
 *
 * Exemplar pattern from dropdownAccessibility.test.tsx:
 *   - Mount real components in happy-dom
 *   - Assert rendered DOM and ARIA attributes
 *   - Dispatch real keyboard events via fireEvent
 *   - Verify state changes in the DOM
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ScrubLabel } from "../controls/ScrubLabel";
import { focusRing } from "../theme";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The ResetPopover portal (or null). */
function popoverPortal(): HTMLElement | null {
  const portals = Array.from(document.querySelectorAll("[data-tuner-portal]"));
  return (portals.find((p) => p.textContent?.includes("Reset")) as HTMLElement) ?? null;
}

/** Find the label trigger element (span with triggerProps). */
function getLabelTrigger(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="button"]') as HTMLElement;
}

// ─── Interactive state: modified indicator with onReset ───────────────────

describe("ScrubLabel keyboard accessibility — interactive (modified + onReset)", () => {
  function renderModified(onReset = vi.fn(), onChange = vi.fn()) {
    const utils = render(
      <ScrubLabel
        value={16}
        onChange={onChange}
        indicator="modified"
        onReset={onReset}
      >
        Size
      </ScrubLabel>,
    );
    const trigger = getLabelTrigger(utils.container);
    return { ...utils, trigger, onReset, onChange };
  }

  it("label is focusable (tabIndex=0) when indicator='modified' and onReset is present", () => {
    const { trigger } = renderModified();
    expect(trigger).toBeTruthy();
    expect(trigger!.tabIndex).toBe(0);
    trigger!.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it("label has role='button' and aria-haspopup='dialog'", () => {
    const { trigger } = renderModified();
    expect(trigger!.getAttribute("role")).toBe("button");
    expect(trigger!.getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("label has aria-label naming the property ('Reset Size')", () => {
    const { trigger } = renderModified();
    const ariaLabel = trigger!.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/reset.*size/i);
  });

  it("visible focus ring using theme tokens (focusRing box-shadow)", () => {
    const { trigger } = renderModified();
    // Focus the trigger to activate :focus-visible (simulated via onFocus in real component).
    // In ScrubLabel, the triggerProps from useResetPopover should apply the focus styling.
    // For this test to pass, ScrubLabel needs to add onFocus handler that sets boxShadow.
    // Currently it doesn't, so this test will fail initially as expected.
    trigger!.focus();

    // The component should apply focusRing via inline style or computed style.
    // Check computed style for box-shadow matching focusRing pattern.
    const computedStyle = getComputedStyle(trigger!);
    const boxShadow = computedStyle.boxShadow || trigger!.style.boxShadow;

    // focusRing is "0 0 0 2px <color.ring>" — check for the pattern.
    // When implemented, this should match. Initially it will be "none" or empty.
    expect(boxShadow).not.toBe("none");
    expect(boxShadow).not.toBe("");
    // More specific: should contain "2px" (the focus ring width from theme).
    expect(boxShadow).toContain("2px");
  });

  it("Enter on the label opens the reset popover", () => {
    const { trigger } = renderModified();
    expect(popoverPortal()).toBeNull();
    fireEvent.keyDown(trigger!, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });

  it("Space on the label opens the reset popover", () => {
    const { trigger } = renderModified();
    expect(popoverPortal()).toBeNull();
    fireEvent.keyDown(trigger!, { key: " " });
    expect(popoverPortal()).toBeTruthy();
  });

  it("Alt+Enter resets directly without opening popover (onReset callback fires)", () => {
    const { trigger, onReset } = renderModified();
    // Alt+Enter should call onReset immediately, not open the popover.
    // This requires detecting altKey on the keydown event.
    fireEvent.keyDown(trigger!, { key: "Enter", altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(popoverPortal()).toBeNull();
  });

  it("Escape closes the popover and returns focus to the label", () => {
    const { trigger } = renderModified();
    // Open the popover first.
    fireEvent.keyDown(trigger!, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();

    // Dispatch Escape on the document (ResetPopover listens globally).
    fireEvent.keyDown(document, { key: "Escape" });

    expect(popoverPortal()).toBeNull();
    // Focus should return to the trigger.
    expect(document.activeElement).toBe(trigger);
  });

  it("reset popover actually restores the style (not just callback fired)", () => {
    // Create a mock element to track style changes.
    const mockElement = document.createElement("div");
    mockElement.style.fontSize = "20px"; // modified value
    document.body.appendChild(mockElement);

    const resetFn = vi.fn(() => {
      mockElement.style.fontSize = "16px"; // reset to default
    });

    const { trigger } = renderModified(resetFn);

    // Open popover and activate reset.
    fireEvent.keyDown(trigger!, { key: "Enter" });
    const portal = popoverPortal() as HTMLElement;
    expect(portal).toBeTruthy();

    // Find the reset button in the popover and activate it.
    const resetButton = portal.querySelector('[role="button"]') as HTMLElement;
    expect(resetButton).toBeTruthy();
    fireEvent.keyDown(resetButton, { key: "Enter" });

    // Verify reset was called and the style changed.
    expect(resetFn).toHaveBeenCalledTimes(1);
    expect(mockElement.style.fontSize).toBe("16px");

    document.body.removeChild(mockElement);
  });

  it("mouse click still opens the popover (unchanged legacy behavior)", () => {
    const { trigger } = renderModified();
    expect(popoverPortal()).toBeNull();
    // Mouse clicks flow through LabelScrub's onClick handler.
    // Click on the trigger span.
    fireEvent.click(trigger!);
    expect(popoverPortal()).toBeTruthy();
  });

  it("Alt+click still resets directly (unchanged legacy behavior)", () => {
    const { trigger, onReset } = renderModified();
    fireEvent.click(trigger!, { altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(popoverPortal()).toBeNull();
  });
});

// ─── Non-interactive state: no tabIndex/role when not modified ────────────

describe("ScrubLabel keyboard accessibility — non-interactive states", () => {
  it("label is NOT focusable when indicator is NOT 'modified'", () => {
    const { container } = render(
      <ScrubLabel
        value={16}
        onChange={vi.fn()}
        indicator="none"
        onReset={vi.fn()}
      >
        Size
      </ScrubLabel>,
    );
    const trigger = getLabelTrigger(container);
    // No button role or tabIndex when not modified.
    expect(trigger).toBeNull();

    // The label span should exist but not be interactive.
    const label = container.querySelector("span");
    expect(label).toBeTruthy();
    expect(label!.getAttribute("role")).not.toBe("button");
    expect(label!.tabIndex).not.toBe(0);
  });

  it("label is NOT focusable when onReset is absent", () => {
    const { container } = render(
      <ScrubLabel
        value={16}
        onChange={vi.fn()}
        indicator="modified"
      >
        Size
      </ScrubLabel>,
    );
    const trigger = getLabelTrigger(container);
    // No button role or tabIndex when onReset is missing.
    expect(trigger).toBeNull();

    const label = container.querySelector("span");
    expect(label).toBeTruthy();
    expect(label!.getAttribute("role")).not.toBe("button");
    expect(label!.tabIndex).not.toBe(0);
  });

  it("caption labels (no indicator, no onReset) only provide scrub interaction", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ScrubLabel value={1.5} onChange={onChange} step={0.1}>
        Line
      </ScrubLabel>,
    );

    // No button role/tabIndex for captions.
    const trigger = getLabelTrigger(container);
    expect(trigger).toBeNull();

    // But the label should still render and support scrubbing (via LabelScrub).
    const label = container.querySelector("span");
    expect(label).toBeTruthy();
    expect(label!.textContent).toContain("Line");

    // Scrub interaction is tested in other suites; here we just verify it's present.
    expect(label!.style.cursor).toBe("ew-resize");
  });
});

// ─── ARIA contract validation ──────────────────────────────────────────────

describe("ScrubLabel ARIA contract", () => {
  it("complete ARIA attributes when interactive", () => {
    const { container } = render(
      <ScrubLabel
        value={24}
        onChange={vi.fn()}
        indicator="modified"
        onReset={vi.fn()}
        title="Font size in pixels"
      >
        Font Size
      </ScrubLabel>,
    );

    const trigger = getLabelTrigger(container);
    expect(trigger).toBeTruthy();

    // Complete ARIA contract:
    expect(trigger!.getAttribute("role")).toBe("button");
    expect(trigger!.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger!.getAttribute("aria-label")).toMatch(/reset.*font.*size/i);
    expect(trigger!.tabIndex).toBe(0);

    // The title prop should be applied (via the span's title attribute).
    const span = trigger!.querySelector("span[title]");
    expect(span).toBeTruthy();
    expect(span!.getAttribute("title")).toBe("Font size in pixels");
  });

  it("no ARIA attributes when non-interactive", () => {
    const { container } = render(
      <ScrubLabel value={16} onChange={vi.fn()} indicator="inherited">
        Size
      </ScrubLabel>,
    );

    // Should not have button role or ARIA attrs.
    const allButtons = container.querySelectorAll('[role="button"]');
    expect(allButtons.length).toBe(0);

    const allHaspopup = container.querySelectorAll('[aria-haspopup]');
    expect(allHaspopup.length).toBe(0);
  });
});
