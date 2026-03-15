// @vitest-environment happy-dom
/**
 * Breadcrumb tests — collapse, expand, click, and hover behavior.
 *
 * The Header component renders a breadcrumb bar from an array of ancestor
 * segments. When there are ≥4 segments it collapses to:
 *   first > ... > last-2 > last-1 > current
 * Clicking "..." expands the full chain. Clicking an ancestor fires
 * onBreadcrumbClick; hovering fires onBreadcrumbHover.
 *
 * We test via renderToString for structural assertions and via JSDOM
 * rendering for interactive behavior (click/hover).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { buildBreadcrumb } from "../util";

// ─── Helpers ──────────────────────────────────────────────────────────

type BreadcrumbSegment = { el: Element; tag: string; className: string | null };

function makeBreadcrumb(count: number): BreadcrumbSegment[] {
  const tags = ["div", "main", "section", "article", "ul", "li", "span", "p"];
  return Array.from({ length: count }, (_, i) => ({
    el: document.createElement(tags[i % tags.length]),
    tag: tags[i % tags.length],
    className: i === 0 ? "root" : null,
  }));
}

/** Render Header via renderToString and return the HTML. */
async function renderHeader(props: Record<string, unknown>) {
  const { Header } = await import("../shell/Header");
  const el = document.createElement("div");
  el.className = "test-element";
  const defaultProps = {
    element: el,
    onClose: vi.fn(),
    onDragStart: vi.fn(),
  };
  return renderToString(createElement(Header as any, { ...defaultProps, ...props }));
}

// ─── buildBreadcrumb (pure function) ──────────────────────────────────

describe("buildBreadcrumb collapse data", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns fewer than 4 segments unchanged for a shallow tree", () => {
    let parent: HTMLElement = document.body;
    const chain: HTMLElement[] = [];
    for (const tag of ["div", "span"]) {
      const el = document.createElement(tag);
      parent.appendChild(el);
      parent = el;
      chain.push(el);
    }
    const crumbs = buildBreadcrumb(chain[chain.length - 1]);
    expect(crumbs.map((c) => c.tag)).toEqual(["div", "span"]);
  });

  it("truncates to maxDepth when tree is deeper", () => {
    let parent: HTMLElement = document.body;
    for (const tag of ["div", "main", "section", "article", "ul", "li"]) {
      const el = document.createElement(tag);
      parent.appendChild(el);
      parent = el;
    }
    const crumbs = buildBreadcrumb(parent, 4);
    expect(crumbs).toHaveLength(4);
    expect(crumbs.map((c) => c.tag)).toEqual(["section", "article", "ul", "li"]);
  });
});

// ─── Breadcrumb rendering (collapse / expand) ─────────────────────────

describe("Breadcrumb collapse rendering", () => {
  it("shows all segments when fewer than 4", async () => {
    const bc = makeBreadcrumb(3);
    const html = await renderHeader({ breadcrumb: bc });
    // All 3 tags should appear
    expect(html).toContain("div.root");
    expect(html).toContain("main");
    expect(html).toContain("section");
    // No ellipsis
    expect(html).not.toContain("...");
  });

  it("collapses to first ... last-2 > last-1 > current when ≥4 ancestors", async () => {
    // 5 segments: div.root, main, section, article, ul
    const bc = makeBreadcrumb(5);
    const html = await renderHeader({ breadcrumb: bc });

    // First segment visible
    expect(html).toContain("div.root");
    // Ellipsis present
    expect(html).toContain("...");
    // Last two segments visible (article = index 3, ul = index 4)
    expect(html).toContain("article");
    expect(html).toContain("ul");
    // Middle segments hidden
    expect(html).not.toContain(">main<");
    expect(html).not.toContain(">section<");
  });

  it("exactly 4 segments still collapses", async () => {
    // 4 segments: div.root, main, section, article
    const bc = makeBreadcrumb(4);
    const html = await renderHeader({ breadcrumb: bc });
    expect(html).toContain("...");
    // first (div.root) + last 2 (section, article) = 3 visible
    expect(html).toContain("div.root");
    expect(html).toContain("section");
    expect(html).toContain("article");
  });
});

// ─── Interactive: expand, click ancestor, hover ───────────────────────

describe("Breadcrumb interactive behavior", () => {
  // For interactive tests we need a real DOM. We'll use dynamic import
  // of react-dom/client for rendering into a container.

  async function mountHeader(props: Record<string, unknown>) {
    const { Header } = await import("../shell/Header");
    const ReactDOM = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);

    const el = document.createElement("div");
    el.className = "test-element";

    const defaultProps = {
      element: el,
      onClose: vi.fn(),
      onDragStart: vi.fn(),
    };

    let root: any;
    await new Promise<void>((resolve) => {
      // flushSync to ensure synchronous rendering
      const { flushSync } = require("react-dom");
      root = ReactDOM.createRoot(container);
      flushSync(() => {
        root.render(createElement(Header as any, { ...defaultProps, ...props }));
      });
      resolve();
    });

    return { container, root };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicking '...' expands full breadcrumb chain", async () => {
    const bc = makeBreadcrumb(5);
    const { container, root } = await mountHeader({ breadcrumb: bc });

    // Initially collapsed — ellipsis is present
    const ellipsis = container.querySelector('[title="Show full breadcrumb"]');
    expect(ellipsis).toBeTruthy();

    // Click the ellipsis
    ellipsis!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // After expansion all segments should be visible and ellipsis gone
    const expandedEllipsis = container.querySelector('[title="Show full breadcrumb"]');
    expect(expandedEllipsis).toBeNull();

    // All 5 tags should now be in the DOM
    const text = container.textContent!;
    expect(text).toContain("div.root");
    expect(text).toContain("main");
    expect(text).toContain("section");
    expect(text).toContain("article");
    expect(text).toContain("ul");

    root.unmount();
  });

  it("clicking an ancestor segment fires onBreadcrumbClick with correct element", async () => {
    const bc = makeBreadcrumb(3); // no collapse, 3 segments
    const clickHandler = vi.fn();
    const { container, root } = await mountHeader({
      breadcrumb: bc,
      onBreadcrumbClick: clickHandler,
    });

    // Find ancestor segments (non-last items with role="button")
    const ancestors = container.querySelectorAll('[data-breadcrumb-ancestor]');
    expect(ancestors.length).toBeGreaterThanOrEqual(1);

    // Click the first ancestor
    ancestors[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(clickHandler).toHaveBeenCalledWith(bc[0].el);

    // Click the second ancestor
    if (ancestors.length > 1) {
      ancestors[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(clickHandler).toHaveBeenCalledTimes(2);
      expect(clickHandler).toHaveBeenCalledWith(bc[1].el);
    }

    root.unmount();
  });

  it("hovering an ancestor fires onBreadcrumbHover with element, leaving fires with null", async () => {
    const bc = makeBreadcrumb(3);
    const hoverHandler = vi.fn();
    const { container, root } = await mountHeader({
      breadcrumb: bc,
      onBreadcrumbHover: hoverHandler,
    });

    const ancestors = container.querySelectorAll('[data-breadcrumb-ancestor]');
    expect(ancestors.length).toBeGreaterThanOrEqual(1);

    // Hover enter
    ancestors[0].dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(hoverHandler).toHaveBeenCalledWith(bc[0].el);

    // Hover leave
    ancestors[0].dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(hoverHandler).toHaveBeenCalledWith(null);

    root.unmount();
  });
});
