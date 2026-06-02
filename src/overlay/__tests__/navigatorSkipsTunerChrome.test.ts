// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildFilteredTree,
  shouldSkipEntirely,
  countNodes,
  type TreeNode,
} from "../navigator/navigatorFilter";

beforeEach(() => {
  document.body.innerHTML = "";
});

/** Collect every element in a tree (flattened). */
function allElements(nodes: TreeNode[]): Element[] {
  const out: Element[] = [];
  for (const n of nodes) {
    out.push(n.el);
    out.push(...allElements(n.children));
  }
  return out;
}

describe("navigator skips Redial's own injected chrome", () => {
  it("excludes tuner outline, tuner portal, and framework chrome from the tree", () => {
    // Redial's selection outline (class starts with __tuner-)
    const outline = document.createElement("div");
    outline.className = "__tuner-selected-outline";
    document.body.appendChild(outline);

    // A body-level portal marked with data-tuner-portal
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    portal.style.position = "fixed";
    document.body.appendChild(portal);

    // Next.js framework chrome
    const announcer = document.createElement("next-route-announcer");
    document.body.appendChild(announcer);

    // Real user content
    const app = document.createElement("section");
    app.className = "app";
    app.textContent = "Hello";
    document.body.appendChild(app);

    const tree = buildFilteredTree(document.body);
    const els = allElements(tree);

    // Only the real content node should survive
    expect(els).toContain(app);
    expect(els).not.toContain(outline);
    expect(els).not.toContain(portal);
    expect(els).not.toContain(announcer);
    expect(countNodes(tree)).toBe(1);
  });

  it("skips any element whose class contains __tuner (overlay chrome)", () => {
    const overlay = document.createElement("div");
    overlay.className = "some-prefix __tuner-overlay";
    document.body.appendChild(overlay);
    expect(shouldSkipEntirely(overlay)).toBe(true);
  });

  it("skips a child nested inside tuner chrome via closest()", () => {
    const root = document.createElement("div");
    root.className = "__tuner-overlay";
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);
    expect(shouldSkipEntirely(child)).toBe(true);
  });

  it("skips elements carrying a data-tuner-* attribute", () => {
    const el = document.createElement("div");
    el.setAttribute("data-tuner-foo", "bar");
    document.body.appendChild(el);
    expect(shouldSkipEntirely(el)).toBe(true);
  });

  it("skips next-route-announcer by tag name", () => {
    const el = document.createElement("next-route-announcer");
    document.body.appendChild(el);
    expect(shouldSkipEntirely(el)).toBe(true);
  });

  it("does NOT skip ordinary hyphenated custom elements", () => {
    const el = document.createElement("my-widget");
    document.body.appendChild(el);
    expect(shouldSkipEntirely(el)).toBe(false);
  });

  it("does NOT skip ordinary user content", () => {
    const el = document.createElement("section");
    el.className = "hero";
    document.body.appendChild(el);
    expect(shouldSkipEntirely(el)).toBe(false);
  });
});
