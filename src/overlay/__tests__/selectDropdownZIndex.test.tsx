// @vitest-environment happy-dom
/**
 * selectDropdownZIndex.test.tsx — Behavioral test: SelectRow's dropdown must
 * render above the panel (issue #105 migration).
 *
 * History: the old shadcn-Select path passed `z-[200]` to <SelectContent>, which
 * tailwind-merge deduplicated against the Shadcn default `z-[2147483647]`,
 * dropping the dropdown behind the panel. That path is gone — SelectRow now
 * renders an inline portaled listbox styled with theme tokens.
 *
 * The intent survives: the dropdown portal must sit at zIndex.max
 * (2147483647), never behind the panel, and must not hardcode any lower
 * z-index value.
 *
 * This test mounts a real SelectRow, opens the dropdown, and asserts the
 * portaled listbox has zIndex.max in its computed or inline styles.
 *
 * Formerly a readFileSync + regex audit over SelectRow.tsx; now the component
 * is mounted and styles are asserted from the rendered DOM.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SelectRow } from "../controls/SelectRow";
import { zIndex } from "../theme";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

function renderSelectRow() {
  const { container } = render(
    <SelectRow
      label="Test"
      value="a"
      options={OPTIONS}
      onChange={vi.fn()}
    />
  );
  const trigger = container.querySelector("button") as HTMLElement;
  return { container, trigger };
}

function getListbox(): HTMLElement | null {
  return document.querySelector('[role="listbox"]');
}

describe("SelectRow dropdown z-index must render above the panel", () => {
  it("dropdown opens and renders a portaled listbox", () => {
    const { trigger } = renderSelectRow();
    expect(getListbox()).toBeNull();

    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    expect(listbox!.closest("[data-tuner-portal]")).not.toBeNull();
  });

  it("portaled listbox has zIndex.max in its inline styles", () => {
    const { trigger } = renderSelectRow();
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).not.toBeNull();

    // The listbox or its parent portal container should have zIndex.max
    const style = listbox!.getAttribute("style") || "";
    const parentStyle = listbox!.parentElement?.getAttribute("style") || "";

    // zIndex.max is 2147483647 (max safe 32-bit int)
    const hasMaxZIndex =
      style.includes(`z-index: ${zIndex.max}`) ||
      style.includes(`zIndex: ${zIndex.max}`) ||
      parentStyle.includes(`z-index: ${zIndex.max}`) ||
      parentStyle.includes(`zIndex: ${zIndex.max}`);

    expect(hasMaxZIndex).toBe(true);
  });

  it("does not hardcode a lower z-index value", () => {
    const { trigger } = renderSelectRow();
    fireEvent.click(trigger);

    const listbox = getListbox();
    expect(listbox).not.toBeNull();

    const style = listbox!.getAttribute("style") || "";
    const parentStyle = listbox!.parentElement?.getAttribute("style") || "";
    const combined = style + " " + parentStyle;

    // Must not use the old buggy value (200) or any other lower value
    expect(combined).not.toContain("z-index: 200");
    expect(combined).not.toContain("zIndex: 200");

    // If a numeric z-index is present, it should be zIndex.max (2147483647)
    const zIndexMatch = combined.match(/z-?[iI]ndex:\s*(\d+)/);
    if (zIndexMatch) {
      const value = parseInt(zIndexMatch[1], 10);
      expect(value).toBe(zIndex.max);
    }
  });

  it("zIndex.max theme token is 2147483647", () => {
    // Verify the theme constant is set correctly
    expect(zIndex.max).toBe(2147483647);
  });
});
