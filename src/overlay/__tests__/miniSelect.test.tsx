// @vitest-environment happy-dom
/**
 * miniSelect.test.tsx — behavioral contract for the shared MiniSelect control.
 *
 * MiniSelect consolidates the styled native <select> + caret SVG data-URI that
 * was pasted twice in TransitionEditor (SelectDropdown + EasingSelect). It must
 * support a flat `options` array (the common case) and arbitrary `children`
 * (optgroups / sentinel options), and route selection through onChange.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MiniSelect, MINI_SELECT_CARET } from "../controls/MiniSelect";

afterEach(() => {
  cleanup();
});

describe("MiniSelect", () => {
  it("renders options from a flat string array and fires onChange with the value", () => {
    const onChange = vi.fn();
    render(<MiniSelect value="a" onChange={onChange} options={["a", "b", "c"]} aria-label="pick" />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.querySelectorAll("option")).toHaveLength(3);

    fireEvent.change(select, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("supports {value,label} option objects", () => {
    const onChange = vi.fn();
    render(
      <MiniSelect
        value="x"
        onChange={onChange}
        options={[{ value: "x", label: "X label" }, { value: "y", label: "Y label" }]}
      />,
    );
    expect(screen.getByText("X label")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledWith("y");
  });

  it("renders arbitrary children (optgroups) when no options array is given", () => {
    render(
      <MiniSelect value="g1" onChange={() => {}}>
        <optgroup label="Group">
          <option value="g1">One</option>
          <option value="g2">Two</option>
        </optgroup>
      </MiniSelect>,
    );
    const select = screen.getByRole("combobox");
    expect(select.querySelector("optgroup")).toBeTruthy();
    expect(select.querySelectorAll("option")).toHaveLength(2);
  });

  it("draws a custom caret arrow (appearance:none + positioned background)", () => {
    // The caret is a percent-encoded SVG data-URI; happy-dom's CSS parser can't
    // round-trip the data-URI value itself, so we assert the const plus the
    // caret-positioning scaffolding (the rendered image is verified in-browser).
    render(<MiniSelect value="a" onChange={() => {}} options={["a"]} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(MINI_SELECT_CARET).toContain("data:image/svg+xml");
    expect(select.style.appearance).toBe("none");
    expect(select.style.backgroundPosition).toBe("right 4px center");
  });
});
