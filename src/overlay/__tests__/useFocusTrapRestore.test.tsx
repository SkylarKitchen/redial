// @vitest-environment happy-dom
/**
 * useFocusTrapRestore.test.tsx — Issue #86.
 *
 * useFocusTrap must behave like shell/Modal.tsx's trap:
 *   - save document.activeElement on activation and restore it on close
 *   - exclude disabled controls from the tab cycle (focus() on a disabled
 *     control no-ops, which breaks the wrap)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

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
  document.body.querySelectorAll("button").forEach((b) => b.remove());
});

/** Minimal consumer mirroring PropertyContextMenu / EffectsSection usage. */
function TrapConsumer({ isOpen, children }: { isOpen: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isOpen);
  return createElement("div", { ref, "data-trap": true }, children);
}

function pressTab(target: HTMLElement, shiftKey = false) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }),
  );
}

describe("useFocusTrap focus restore (issue #86)", () => {
  it("restores focus to the previously-focused element when the trap deactivates", () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    act(() => {
      root.render(
        createElement(TrapConsumer, { isOpen: true }, createElement("button", null, "inside")),
      );
    });
    // Trap steals focus into the container on open.
    expect((document.activeElement as HTMLElement)?.textContent).toBe("inside");

    act(() => {
      root.render(
        createElement(TrapConsumer, { isOpen: false }, createElement("button", null, "inside")),
      );
    });
    expect(document.activeElement).toBe(outside);
  });

  it("restores focus to the previously-focused element on unmount", () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();

    act(() => {
      root.render(
        createElement(TrapConsumer, { isOpen: true }, createElement("button", null, "inside")),
      );
    });
    expect((document.activeElement as HTMLElement)?.textContent).toBe("inside");

    act(() => root.render(null));
    expect(document.activeElement).toBe(outside);
  });
});

describe("useFocusTrap disabled-control exclusion (issue #86)", () => {
  it("excludes a disabled button from the tab cycle — Tab on the last enabled control wraps focus to the first", () => {
    act(() => {
      root.render(
        createElement(
          TrapConsumer,
          { isOpen: true },
          createElement("button", { key: "a" }, "A"),
          createElement("button", { key: "b" }, "B"),
          createElement("button", { key: "c", disabled: true }, "C-disabled"),
        ),
      );
    });
    const trap = document.querySelector("[data-trap]") as HTMLElement;
    const [a, b] = Array.from(trap.querySelectorAll("button"));

    // B is the last *enabled* control; Tab from it must wrap to A,
    // not target the disabled C (whose focus() no-ops).
    b.focus();
    expect(document.activeElement).toBe(b);
    pressTab(b);
    expect(document.activeElement).toBe(a);
  });

  it("excludes a disabled button from the tab cycle — Shift+Tab on the first enabled control wraps focus to the last enabled one", () => {
    act(() => {
      root.render(
        createElement(
          TrapConsumer,
          { isOpen: true },
          createElement("button", { key: "a", disabled: true }, "A-disabled"),
          createElement("button", { key: "b" }, "B"),
          createElement("button", { key: "c" }, "C"),
        ),
      );
    });
    const trap = document.querySelector("[data-trap]") as HTMLElement;
    const buttons = Array.from(trap.querySelectorAll("button"));
    const b = buttons[1];
    const c = buttons[2];

    // B is the first *enabled* control; Shift+Tab from it must wrap to C.
    b.focus();
    pressTab(b, true);
    expect(document.activeElement).toBe(c);
  });

  it("moves initial focus to the first enabled control, skipping a disabled first element", () => {
    act(() => {
      root.render(
        createElement(
          TrapConsumer,
          { isOpen: true },
          createElement("button", { key: "a", disabled: true }, "A-disabled"),
          createElement("button", { key: "b" }, "B"),
        ),
      );
    });
    expect((document.activeElement as HTMLElement)?.textContent).toBe("B");
  });
});
