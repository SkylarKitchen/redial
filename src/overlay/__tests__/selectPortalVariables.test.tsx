// @vitest-environment happy-dom
/**
 * Test: the plain SelectRow dropdown portal must have a concrete (opaque)
 * background.
 *
 * History: the old shadcn Radix Select portalled its <SelectContent> to
 * document.body, outside `.__tuner-root`, so `bg-popover` → `var(--popover)`
 * resolved to nothing and the dropdown rendered transparent. That class of bug
 * cannot recur: SelectRow now portals an inline-styled listbox that reads a
 * LITERAL color value from theme tokens (color.popover), not a CSS variable.
 *
 * This is now a behavioral test — render a plain (non-searchable) SelectRow,
 * open it, and assert the portaled [role="listbox"] carries a real background
 * color (color.popover) rather than an empty/transparent style.
 */
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SelectRow } from "../controls/SelectRow";
import { color } from "../theme";

// React's act() requires this global flag in test environments.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  // Clean any portaled dropdown left on body.
  document.body.querySelectorAll("[data-select-portal]").forEach((n) => n.remove());
});

function renderRow() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <SelectRow label="Display" value="block" options={OPTIONS} onChange={() => {}} />,
    );
  });
}

describe("SelectRow plain dropdown background", () => {
  it("portals an opaque listbox with a concrete popover background", () => {
    renderRow();

    // Open the dropdown via the combobox trigger.
    const trigger = container!.querySelector('[role="combobox"]') as HTMLElement | null;
    expect(trigger).toBeTruthy();
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Dropdown is portaled to document.body.
    const listbox = document.body.querySelector('[role="listbox"]') as HTMLElement | null;
    expect(listbox).toBeTruthy();

    // The background must be a real color value (color.popover from theme),
    // not empty/transparent. color.popover is a literal hex, not var(--x).
    const bg = listbox!.style.backgroundColor;
    expect(bg).toBeTruthy();
    expect(bg.toLowerCase()).toContain(color.popover.toLowerCase());
    expect(bg).not.toContain("var(");
  });
});
