// @vitest-environment happy-dom
/**
 * sectionToggle.test.tsx — Behavioral test for the Section collapsible.
 *
 * After migrating off Radix Collapsible, the inner header div must supply its
 * own onClick to toggle open/closed. This test renders a Section, clicks the
 * header (role="button"), and asserts the child content appears/disappears.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { Section } from "../controls";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function renderSection() {
  act(() => {
    root.render(
      createElement(
        Section,
        { title: "Layout" },
        createElement("div", null, "child-content"),
      ),
    );
  });
}

function getHeader(): HTMLElement {
  const header = container.querySelector('[role="button"]');
  if (!header) throw new Error("header not found");
  return header as HTMLElement;
}

describe("Section toggle behavior", () => {
  it("opens by default and toggles closed/open on header click", () => {
    renderSection();

    // Open by default (collapsed is falsy) → child is present
    expect(container.textContent).toContain("child-content");

    const header = getHeader();
    expect(header.getAttribute("aria-expanded")).toBe("true");

    // Click header → collapses
    act(() => { header.click(); });
    expect(container.textContent).not.toContain("child-content");
    expect(getHeader().getAttribute("aria-expanded")).toBe("false");

    // Click again → expands
    act(() => { getHeader().click(); });
    expect(container.textContent).toContain("child-content");
    expect(getHeader().getAttribute("aria-expanded")).toBe("true");
  });
});
