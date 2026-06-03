// @vitest-environment happy-dom
/**
 * shortcutsHelpModal.test.tsx — behavioral guard for ShortcutsHelp after the
 * shadcn/Radix Dialog → inline Modal migration (2026-06-03).
 *
 * Verifies the help panel renders a real [role="dialog"] containing the
 * "Keyboard Shortcuts" title, and that Esc on the dialog closes it (the
 * Modal's focus-trap keydown handler calls onClose).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { ShortcutsHelp } from "../shell/ShortcutsHelp";

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

describe("ShortcutsHelp modal", () => {
  it("renders a [role=dialog] containing the Keyboard Shortcuts title", () => {
    act(() => {
      root.render(createElement(ShortcutsHelp, { onClose: vi.fn() }));
    });
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog, "ShortcutsHelp must render a [role=dialog]").toBeTruthy();
    expect(dialog!.textContent).toContain("Keyboard Shortcuts");
  });

  it("calls onClose when Escape is pressed on the dialog", () => {
    const onClose = vi.fn();
    act(() => {
      root.render(createElement(ShortcutsHelp, { onClose }));
    });
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
