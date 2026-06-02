// @vitest-environment happy-dom
/**
 * segmentedControlKeyboard.test.tsx — keyboard accessibility for the
 * (non-Webflow) SegmentedControl.
 *
 * BUG (found 2026-06-02 audit): the arrow-key handler reads the radiogroup's
 * raw `parentElement.children` and maps a sibling index back onto `options`.
 * But when an option is active the component renders an absolute indicator
 * <div> as the FIRST child of the radiogroup, so every button is shifted up by
 * one — `options[siblings.indexOf(next)]` is off-by-one (and wrap-around can
 * call `.focus()` on the non-focusable indicator div). The sibling
 * WebflowSegmentedControl already fixes this by filtering siblings to
 * role="radio"; this test fires real arrow keys to prove SegmentedControl
 * routes selection to the correct adjacent option.
 *
 * Existing segmented tests for this control are source-string only, so they
 * stayed green while the keyboard mapping was wrong.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SegmentedControl } from "../controls/SegmentedControl";

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

/** Stateful harness so the controlled component reflects selection changes
 *  (and so the active-indicator <div> mounts as the first child). */
function Harness({
  initial = "a",
  onChange,
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
      aria-label="Test"
    />
  );
}

function radios() {
  return screen.getAllByRole("radio");
}

describe("SegmentedControl — keyboard navigation (indicator off-by-one)", () => {
  it("ArrowRight from the first option selects the SECOND option, not the third", () => {
    const onChange = vi.fn();
    render(<Harness initial="a" onChange={onChange} />);

    fireEvent.keyDown(radios()[0], { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("b");
    const [first, second] = radios();
    expect(second.getAttribute("aria-checked")).toBe("true");
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(second);
  });

  it("ArrowLeft from the middle option selects the FIRST option", () => {
    const onChange = vi.fn();
    render(<Harness initial="b" onChange={onChange} />);

    fireEvent.keyDown(radios()[1], { key: "ArrowLeft" });

    expect(onChange).toHaveBeenCalledWith("a");
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios()[0]);
  });

  it("ArrowRight wraps from the last option to the first (focuses a real radio, not the indicator)", () => {
    const onChange = vi.fn();
    render(<Harness initial="c" onChange={onChange} />);

    fireEvent.keyDown(radios()[2], { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("a");
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios()[0]);
  });
});
