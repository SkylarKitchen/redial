// @vitest-environment happy-dom
/**
 * webflowSegmentedKeyboard.test.tsx — keyboard accessibility for
 * WebflowSegmentedControl.
 *
 * The control is a role="radiogroup" of role="radio" buttons. It must support
 * roving-tabindex keyboard navigation like a native radio group:
 *   - exactly one radio is in the tab order (tabIndex 0); the rest are -1
 *   - ArrowRight/ArrowDown moves selection to the next radio (wrapping)
 *   - ArrowLeft/ArrowUp moves selection to the previous radio (wrapping)
 *   - the newly-selected radio receives DOM focus
 *   - selection routes through the same onChange the click path uses
 *
 * Since the component is controlled, these tests wrap it in a stateful harness
 * so aria-checked / tabIndex actually update after onChange fires.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WebflowSegmentedControl } from "../controls/WebflowSegmentedControl";

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
];

/** Stateful harness so the controlled component reflects selection changes. */
function Harness({
  initial = "visible",
  onChange,
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <WebflowSegmentedControl
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
      aria-label="Overflow"
    />
  );
}

function radios() {
  return screen.getAllByRole("radio");
}

describe("WebflowSegmentedControl — keyboard navigation", () => {
  it("places only the checked radio in the tab order (roving tabindex)", () => {
    render(<Harness initial="visible" />);
    const [first, second, third] = radios();

    expect(first).toHaveProperty("tabIndex", 0);
    expect(second).toHaveProperty("tabIndex", -1);
    expect(third).toHaveProperty("tabIndex", -1);

    // aria-checked mirrors the same single-selection
    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(second.getAttribute("aria-checked")).toBe("false");
    expect(third.getAttribute("aria-checked")).toBe("false");
  });

  it("ArrowRight moves the checked radio to the next option", () => {
    const onChange = vi.fn();
    render(<Harness initial="visible" onChange={onChange} />);

    fireEvent.keyDown(radios()[0], { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("hidden");
    const [first, second] = radios();
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(second.getAttribute("aria-checked")).toBe("true");
    // roving tabindex follows the new selection
    expect(second).toHaveProperty("tabIndex", 0);
    expect(first).toHaveProperty("tabIndex", -1);
    // and the newly-selected radio is focused
    expect(document.activeElement).toBe(second);
  });

  it("ArrowDown also advances to the next option", () => {
    const onChange = vi.fn();
    render(<Harness initial="visible" onChange={onChange} />);

    fireEvent.keyDown(radios()[0], { key: "ArrowDown" });

    expect(onChange).toHaveBeenCalledWith("hidden");
    expect(radios()[1].getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowLeft/ArrowUp moves to the previous option", () => {
    render(<Harness initial="hidden" />);

    fireEvent.keyDown(radios()[1], { key: "ArrowLeft" });
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios()[0]);

    fireEvent.keyDown(radios()[0], { key: "ArrowUp" });
    // wraps from first to last
    expect(radios()[2].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios()[2]);
  });

  it("ArrowRight wraps from the last option back to the first", () => {
    render(<Harness initial="scroll" />);

    fireEvent.keyDown(radios()[2], { key: "ArrowRight" });

    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios()[0]);
  });
});
