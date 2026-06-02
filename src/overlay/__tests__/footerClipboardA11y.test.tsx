// @vitest-environment happy-dom
/**
 * Footer clipboard dropdown — accessibility contract.
 *
 * The clipboard dropdown is a menu. Its trigger button must advertise the
 * popup (aria-haspopup="menu") and its open/closed state (aria-expanded).
 * The dropdown container must have role="menu", and Escape must close it
 * and return focus to the trigger.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Footer } from "../shell/Footer";
import { applyInlineStyle, resetAll } from "../core/apply";

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
  // happy-dom may not implement navigator.clipboard — define a spyable stub.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  resetAll();
});

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "target";
  document.body.appendChild(el);
  // Give the element an override so copy items are enabled.
  applyInlineStyle(el, "color", "red");
  return el;
}

function renderFooter() {
  const el = makeEl();
  render(<Footer element={el} onReset={() => {}} />);
  // The trigger is the "Clipboard" button.
  const trigger = screen.getByTitle("Copy CSS (⌘C)") as HTMLButtonElement;
  return { el, trigger };
}

describe("Footer clipboard dropdown a11y", () => {
  it("trigger has aria-haspopup='menu'", () => {
    const { trigger } = renderFooter();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("trigger aria-expanded reflects the open state", () => {
    const { trigger } = renderFooter();
    // Closed initially.
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Open.
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // Toggle closed.
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("open dropdown exposes role='menu' with role='menuitem' children", () => {
    const { trigger } = renderFooter();
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(menu).toBeTruthy();
    // Each copy/paste option is a menuitem.
    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBeGreaterThanOrEqual(4);
  });

  it("Escape closes the menu and returns focus to the trigger", () => {
    const { trigger } = renderFooter();
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});
