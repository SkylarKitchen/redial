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
    expect(listbox).not.toBeNull();

    // The listbox must have an explicit inline background/backgroundColor
    const inlineStyle = listbox!.getAttribute("style") || "";
    // React can serialize as background-color or backgroundColor
    const hasInlineBackground =
      /background(?:-color)?:/i.test(inlineStyle) || inlineStyle.includes("backgroundColor:");

    expect(
      hasInlineBackground,
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
    expect(listbox).not.toBeNull();

    // The listbox must have an explicit inline background/backgroundColor
    const inlineStyle = listbox!.getAttribute("style") || "";
    const hasInlineBackground =
      inlineStyle.includes("background:") || inlineStyle.includes("backgroundColor:");

    expect(
      hasInlineBackground,
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
    expect(listbox).not.toBeNull();

    // The searchable dropdown uses SearchableMenu which has the background on the
    // outer container wrapping the listbox. Check both listbox and parent.
    const listboxStyle = listbox!.getAttribute("style") || "";
    const parentStyle = listbox!.parentElement?.getAttribute("style") || "";

    const hasInlineBackground =
      /background(?:-color)?:/i.test(listboxStyle) ||
      listboxStyle.includes("backgroundColor:") ||
      /background(?:-color)?:/i.test(parentStyle) ||
      parentStyle.includes("backgroundColor:");

    expect(
      hasInlineBackground,
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
    expect(listbox).not.toBeNull();

    const inlineStyle = listbox!.getAttribute("style") || "";

    // Must not be transparent or none
    expect(inlineStyle).not.toMatch(/background(?:Color)?:\s*(transparent|none)/);
  });
});
