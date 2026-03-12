// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

/**
 * useClickOutside relies on `ref.current.contains(e.target)`.
 * Since we can't render the React hook without React Testing Library,
 * we test the core contains-based logic directly with DOM nodes.
 */
describe("useClickOutside — contains logic", () => {
  function setup() {
    const container = document.createElement("div");
    const child = document.createElement("span");
    const sibling = document.createElement("div");
    container.appendChild(child);
    document.body.appendChild(container);
    document.body.appendChild(sibling);
    return { container, child, sibling, cleanup: () => { container.remove(); sibling.remove(); } };
  }

  it("child click is inside — contains returns true", () => {
    const { container, child, cleanup } = setup();
    expect(container.contains(child)).toBe(true);
    cleanup();
  });

  it("sibling click is outside — contains returns false", () => {
    const { container, sibling, cleanup } = setup();
    expect(container.contains(sibling)).toBe(false);
    cleanup();
  });

  it("exact container click is inside — contains returns true", () => {
    const { container, cleanup } = setup();
    expect(container.contains(container)).toBe(true);
    cleanup();
  });

  it("deeply nested child is inside", () => {
    const { container, child, cleanup } = setup();
    const grandchild = document.createElement("em");
    child.appendChild(grandchild);
    expect(container.contains(grandchild)).toBe(true);
    cleanup();
  });

  it("null target is not inside", () => {
    const { container, cleanup } = setup();
    expect(container.contains(null)).toBe(false);
    cleanup();
  });
});
