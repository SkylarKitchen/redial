// @vitest-environment happy-dom
/**
 * commandPaletteKeyboard.test.tsx — behavioral guard for the inline CommandPalette
 * that replaced cmdk + Radix Dialog (shadcn migration, 2026-06-03).
 *
 * The pre-existing commandPalette.test.ts is source-text only; this exercises the
 * real render: combobox ARIA, keyboard highlight (aria-activedescendant), and
 * Enter running the highlighted result's action then closing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { CommandPalette } from "../shell/CommandPalette";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderPalette() {
  const props = {
    onSelectElement: vi.fn(),
    onScrollToSection: vi.fn(),
    onExecuteCommand: vi.fn(),
    onClose: vi.fn(),
  };
  act(() => {
    root.render(createElement(CommandPalette, props));
  });
  return props;
}

function input(): HTMLInputElement {
  return document.body.querySelector('input[role="combobox"]') as HTMLInputElement;
}
function options(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('[role="option"]'));
}

describe("CommandPalette keyboard + ARIA", () => {
  it("renders a combobox input wired to the listbox", () => {
    renderPalette();
    const inp = input();
    expect(inp).toBeTruthy();
    expect(inp.getAttribute("aria-controls")).toBe("tuner-cmdk-listbox");
    expect(document.body.querySelector("#tuner-cmdk-listbox")).toBeTruthy();
  });

  it("typing a query surfaces results and auto-highlights the first via aria-activedescendant", () => {
    renderPalette();
    act(() => {
      fireEvent.change(input(), { target: { value: "Save" } }); // matches the 'Save' Action
    });
    const opts = options();
    expect(opts.length).toBeGreaterThan(0);
    // first result highlighted
    expect(input().getAttribute("aria-activedescendant")).toBe("tuner-cmdk-opt-0");
    expect(opts[0].getAttribute("aria-selected")).toBe("true");
    expect(opts[0].id).toBe("tuner-cmdk-opt-0");
  });

  it("Enter runs the highlighted result's action then closes", () => {
    const props = renderPalette();
    act(() => {
      fireEvent.change(input(), { target: { value: "Save" } });
    });
    act(() => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });
    expect(props.onExecuteCommand).toHaveBeenCalledWith("save"); // command id is "save"
    expect(props.onClose).toHaveBeenCalled();
  });
});
