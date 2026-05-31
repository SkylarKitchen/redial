// @vitest-environment happy-dom
/**
 * Header class reuse-count tests
 *
 * The scope pills surface a Webflow-style "used by N elements" signal:
 *   - a `title` tooltip on every class pill (singular/plural aware)
 *   - a faint "· N" suffix inside the pill when N > 1
 *
 * The count is computed from the live DOM via
 * `document.querySelectorAll("." + CSS.escape(cls))`, keyed on the actual DOM
 * class token (not the readable display name), so the test plants real
 * elements carrying those classes before rendering the Header.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { createElement } from "react";
import { Header } from "../shell/Header";

afterEach(cleanup);

function plant(className: string, n: number) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = className;
    document.body.appendChild(el);
  }
}

function renderHeader(cssClasses: string[], selected: Element) {
  return render(
    createElement(Header, {
      element: selected,
      onClose: vi.fn(),
      onDragStart: vi.fn(),
      scope: "class",
      activeClassName: cssClasses[0] ?? null,
      onScopeChange: vi.fn(),
      cssClasses,
    })
  );
}

describe("Header class reuse count", () => {
  it("shows '· N' suffix and plural tooltip when a class is used by 3 elements", () => {
    plant("card", 3); // three elements share .card
    const selected = document.querySelector(".card")!;

    const { container } = renderHeader(["card"], selected);

    // The pill carries a plural tooltip reporting the count.
    const pill = within(container as HTMLElement).getByTitle("used by 3 elements");
    expect(pill).toBeTruthy();
    // And renders the faint "· 3" suffix inside the pill.
    expect(pill.textContent).toContain("· 3");
    expect(pill.textContent).toContain(".card");
  });

  it("uses singular tooltip and hides the suffix when a class is used by exactly 1 element", () => {
    plant("solo", 1);
    const selected = document.querySelector(".solo")!;

    const { container } = renderHeader(["solo"], selected);

    const pill = within(container as HTMLElement).getByTitle("used by 1 element");
    expect(pill).toBeTruthy();
    // No "·" suffix when the class is unique.
    expect(pill.textContent).not.toContain("·");
  });

  it("escapes class tokens with special characters (Tailwind/CSS-module style)", () => {
    // Tailwind-style tokens contain characters that must be CSS.escape()'d.
    plant("md:gap-2", 2);
    const selected = document.querySelector('[class="md:gap-2"]')!;

    const { container } = renderHeader(["md:gap-2"], selected);

    const pill = within(container as HTMLElement).getByTitle("used by 2 elements");
    expect(pill.textContent).toContain("· 2");
  });

  it("does not put a reuse count on the 'element' pill", () => {
    plant("foo", 2);
    const selected = document.querySelector(".foo")!;

    const { container } = renderHeader(["foo"], selected);

    // The element pill has no count tooltip and no "·" suffix.
    const elementPill = within(container as HTMLElement).getByText("element");
    expect(elementPill.getAttribute("title")).toBeNull();
    expect(elementPill.textContent).not.toContain("·");
  });
});
