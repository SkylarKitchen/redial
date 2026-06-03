// @vitest-environment happy-dom
/**
 * modal.test.tsx — guards the inline Modal that replaced the Radix Dialog in
 * ShortcutsHelp + CommandPalette (shadcn migration, 2026-06-03).
 *
 * Covers the a11y machinery the Dialog gave us implicitly: portal contract,
 * Esc-to-close, backdrop-click-to-close, and the focus trap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { Modal } from "../shell/Modal";

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

function dialog(): HTMLElement {
  const el = document.body.querySelector('[role="dialog"]');
  expect(el, "Modal must render a [role=dialog]").toBeTruthy();
  return el as HTMLElement;
}

describe("inline Modal", () => {
  it("portals to body with the panel portal contract", () => {
    act(() => {
      root.render(
        createElement(Modal, { onClose: vi.fn(), ariaLabel: "Test" }, createElement("p", null, "hi")),
      );
    });
    const backdrop = document.body.querySelector("[data-tuner-modal]") as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.getAttribute("data-tuner-portal")).not.toBeNull();
    expect(backdrop.classList.contains("__tuner-root")).toBe(true);
    expect(backdrop.style.zIndex).toBe("2147483647");
    const d = dialog();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.getAttribute("aria-label")).toBe("Test");
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    act(() => {
      root.render(createElement(Modal, { onClose }, createElement("button", null, "ok")));
    });
    act(() => {
      fireEvent.keyDown(dialog(), { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not on content click", () => {
    const onClose = vi.fn();
    act(() => {
      root.render(createElement(Modal, { onClose }, createElement("button", null, "ok")));
    });
    // Click content -> no close
    act(() => {
      fireEvent.mouseDown(dialog());
    });
    expect(onClose).not.toHaveBeenCalled();
    // Click backdrop itself -> close
    const backdrop = document.body.querySelector("[data-tuner-modal]") as HTMLElement;
    act(() => {
      fireEvent.mouseDown(backdrop);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the modal (first focusable) on open", () => {
    act(() => {
      root.render(
        createElement(
          Modal,
          { onClose: vi.fn() },
          createElement("input", { "data-testid": "first" }),
          createElement("button", null, "second"),
        ),
      );
    });
    const input = document.body.querySelector('[data-testid="first"]');
    expect(document.activeElement).toBe(input);
  });

  it("traps Tab: wraps from last to first and first to last", () => {
    act(() => {
      root.render(
        createElement(
          Modal,
          { onClose: vi.fn() },
          createElement("button", { "data-testid": "a" }, "a"),
          createElement("button", { "data-testid": "b" }, "b"),
        ),
      );
    });
    const a = document.body.querySelector('[data-testid="a"]') as HTMLElement;
    const b = document.body.querySelector('[data-testid="b"]') as HTMLElement;
    // Tab from last -> first
    act(() => {
      b.focus();
      fireEvent.keyDown(dialog(), { key: "Tab" });
    });
    expect(document.activeElement).toBe(a);
    // Shift+Tab from first -> last
    act(() => {
      a.focus();
      fireEvent.keyDown(dialog(), { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(b);
  });

  it("restores focus to the previously-focused element on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);
    act(() => {
      root.render(createElement(Modal, { onClose: vi.fn() }, createElement("button", null, "x")));
    });
    expect(document.activeElement).not.toBe(opener); // focus moved into modal
    act(() => root.unmount());
    expect(document.activeElement).toBe(opener); // restored
    opener.remove();
  });

  it("does not import shadcn/Radix", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "../shell/Modal.tsx"), "utf-8");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui/);
    expect(src).not.toMatch(/from\s+["']@?radix-ui/);
  });
});
