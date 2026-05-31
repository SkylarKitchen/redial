// @vitest-environment happy-dom
/**
 * Alt-key (Option) additive selection path.
 *
 * Webflow keeps element selection always-live. Redial's modal `Selector`
 * is normally only active when `active` is true (entered via the `+` FAB).
 * This test pins down an ADDITIVE behavior: while Alt is held, the Selector
 * also activates — showing the inspect outline and selecting on click —
 * regardless of `active`, even when the panel is pinned and no modal
 * selecting mode is running.
 *
 * Requirements verified here:
 *   (a) Alt+click on a page element calls onSelect with that element.
 *   (b) A normal (non-Alt) click while `active=false` (i.e. pinned panel)
 *       does NOT trigger Alt-selection.
 *   (c) Alt+click on tuner UI (.__tuner-root) does nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { Selector } from "../shell/Selector";

// Drive document-level capture listeners the way the real Selector registers them.
function dispatchKey(type: "keydown" | "keyup", key: string) {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true })
    );
  });
}

function dispatchMouse(type: "mousemove" | "click", target: Element) {
  // Selector uses document.elementFromPoint(); stub it to return our target.
  const orig = document.elementFromPoint;
  document.elementFromPoint = () => target;
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX: 5, clientY: 5 })
    );
  });
  document.elementFromPoint = orig;
}

describe("Alt-key additive selection", () => {
  let pageEl: HTMLElement;
  let tunerEl: HTMLElement;

  beforeEach(() => {
    pageEl = document.createElement("div");
    pageEl.className = "app-card";
    document.body.appendChild(pageEl);

    tunerEl = document.createElement("div");
    tunerEl.className = "__tuner-root";
    document.body.appendChild(tunerEl);
  });

  afterEach(() => {
    cleanup();
    pageEl.remove();
    tunerEl.remove();
    vi.restoreAllMocks();
  });

  it("(a) Alt+click on a page element calls onSelect", () => {
    const onSelect = vi.fn();
    // active=false simulates the pinned / not-in-modal-selecting scenario.
    render(<Selector active={false} onSelect={onSelect} onCancel={vi.fn()} />);

    dispatchKey("keydown", "Alt");
    dispatchMouse("mousemove", pageEl);
    dispatchMouse("click", pageEl);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(pageEl);
  });

  it("(b) a normal click while pinned (no Alt) does NOT select", () => {
    const onSelect = vi.fn();
    render(<Selector active={false} onSelect={onSelect} onCancel={vi.fn()} />);

    // No Alt keydown — just a plain click on the page.
    dispatchMouse("click", pageEl);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("(c) Alt+click on tuner UI does nothing", () => {
    const onSelect = vi.fn();
    render(<Selector active={false} onSelect={onSelect} onCancel={vi.fn()} />);

    dispatchKey("keydown", "Alt");
    dispatchMouse("click", tunerEl);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("releasing Alt stops additive selection", () => {
    const onSelect = vi.fn();
    render(<Selector active={false} onSelect={onSelect} onCancel={vi.fn()} />);

    dispatchKey("keydown", "Alt");
    dispatchKey("keyup", "Alt");
    dispatchMouse("click", pageEl);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
