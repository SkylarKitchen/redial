// @vitest-environment happy-dom
/**
 * dropdownOpaqueBackground.test.tsx — Behavioral test: every dropdown/popover
 * must have an opaque background (issue #105 migration).
 *
 * Bug: Dropdowns that rely on Tailwind's `bg-popover` class for their background
 * color can appear transparent/see-through when portaled outside of `.__tuner-root`
 * scope, because Tailwind v4 CSS variable resolution may fail in that context.
 *
 * Fix: All dropdowns must use an explicit inline `background` or `backgroundColor`
 * with an opaque value (from theme.ts), never relying solely on Tailwind classes.
 *
 * This test mounts real dropdown components, opens them, and asserts the portaled
 * dropdown container has an explicit inline background/backgroundColor style
 * attribute (not relying on CSS classes).
 *
 * Formerly a readFileSync + regex audit over SelectRow.tsx and
 * PortalListboxSelect.tsx; now the components are mounted and their inline
 * styles are inspected.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SelectRow } from "../controls/SelectRow";
import { StateSelector } from "../shell/StateSelector";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const SELECT_OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

function getListbox(): HTMLElement | null {
  return document.querySelector('[role="listbox"]');
}

function hasInlineBackground(element: HTMLElement): boolean {
  const style = element.getAttribute("style") || "";
  const parentStyle = element.parentElement?.getAttribute("style") || "";
  return (
    /background(?:-color)?:/i.test(style) ||
    style.includes("backgroundColor:") ||
    /background(?:-color)?:/i.test(parentStyle) ||
    parentStyle.includes("backgroundColor:")
  );
}

describe("Dropdown opaque background (behavioral)", () => {
  it("SelectRow dropdown listbox has an explicit inline background", () => {
    const { container } = render(
      <SelectRow
        label="Test"
        value="a"
        options={SELECT_OPTIONS}
        onChange={vi.fn()}
      />
    );
    const trigger = container.querySelector("button") as HTMLElement;
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).toBeTruthy();

    expect(
      hasInlineBackground(listbox!),
      "SelectRow: portaled listbox must have inline background/backgroundColor, " +
      "not relying on CSS classes (which may not resolve in portal context)"
    ).toBe(true);
  });

  it("StateSelector dropdown listbox has an explicit inline background", () => {
    const { container } = render(
      <StateSelector value="none" onChange={vi.fn()} />
    );
    const trigger = container.querySelector("button") as HTMLElement;
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).toBeTruthy();

    expect(
      hasInlineBackground(listbox!),
      "StateSelector (PortalListboxSelect): portaled listbox must have inline " +
      "background/backgroundColor, not relying on CSS classes"
    ).toBe(true);
  });

  it("SelectRow searchable dropdown has an explicit inline background", () => {
    const { container } = render(
      <SelectRow
        label="Test"
        value="a"
        options={SELECT_OPTIONS}
        onChange={vi.fn()}
        searchable
      />
    );
    const trigger = container.querySelector("button") as HTMLElement;
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).toBeTruthy();

    expect(
      hasInlineBackground(listbox!),
      "SelectRow searchable: portaled dropdown must have inline background/backgroundColor " +
      "(on listbox or its parent container)"
    ).toBe(true);
  });

  it("dropdown backgrounds are not transparent", () => {
    const { container } = render(
      <SelectRow
        label="Test"
        value="a"
        options={SELECT_OPTIONS}
        onChange={vi.fn()}
      />
    );
    const trigger = container.querySelector("button") as HTMLElement;
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).toBeTruthy();

    const inlineStyle = listbox!.getAttribute("style") || "";
    expect(inlineStyle).not.toMatch(/background(?:Color)?:\s*(transparent|none)/);
  });
});
