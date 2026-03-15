// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { canDrag, canDrop, executeDrop, type DropTarget } from "../navigatorDrag";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
});

// ─── canDrag ──────────────────────────────────────────────────────────

describe("canDrag", () => {
  it("returns false for body", () => {
    expect(canDrag(document.body)).toBe(false);
  });

  it("returns false for html", () => {
    expect(canDrag(document.documentElement)).toBe(false);
  });

  it("returns false for head", () => {
    expect(canDrag(document.head)).toBe(false);
  });

  it("returns true for a normal div", () => {
    const el = document.createElement("div");
    expect(canDrag(el)).toBe(true);
  });

  it("returns true for a section", () => {
    const el = document.createElement("section");
    expect(canDrag(el)).toBe(true);
  });

  it("returns true for a span", () => {
    const el = document.createElement("span");
    expect(canDrag(el)).toBe(true);
  });
});

// ─── canDrop ──────────────────────────────────────────────────────────

describe("canDrop", () => {
  it("rejects drop into void elements (img)", () => {
    const dragged = document.createElement("div");
    const target: DropTarget = { type: "into", container: document.createElement("img") };
    expect(canDrop(dragged, target)).toBe(false);
  });

  it("rejects drop into void elements (input)", () => {
    const dragged = document.createElement("div");
    const target: DropTarget = { type: "into", container: document.createElement("input") };
    expect(canDrop(dragged, target)).toBe(false);
  });

  it("rejects drop into void elements (br)", () => {
    const dragged = document.createElement("div");
    const target: DropTarget = { type: "into", container: document.createElement("br") };
    expect(canDrop(dragged, target)).toBe(false);
  });

  it("rejects self-drop (into)", () => {
    const el = document.createElement("div");
    const target: DropTarget = { type: "into", container: el };
    expect(canDrop(el, target)).toBe(false);
  });

  it("rejects descendant-drop (into)", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    const target: DropTarget = { type: "into", container: child };
    expect(canDrop(parent, target)).toBe(false);
  });

  it("rejects self-drop (between)", () => {
    const el = document.createElement("div");
    const target: DropTarget = { type: "between", parent: el, before: null };
    expect(canDrop(el, target)).toBe(false);
  });

  it("rejects descendant-drop (between)", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    const target: DropTarget = { type: "between", parent: child, before: null };
    expect(canDrop(parent, target)).toBe(false);
  });

  it("rejects drop into __tuner-root", () => {
    const dragged = document.createElement("div");
    const tunerRoot = document.createElement("div");
    tunerRoot.className = "__tuner-root";
    const container = document.createElement("div");
    tunerRoot.appendChild(container);
    document.body.appendChild(tunerRoot);

    const target: DropTarget = { type: "into", container };
    expect(canDrop(dragged, target)).toBe(false);
  });

  it("rejects drop between inside __tuner-root", () => {
    const dragged = document.createElement("div");
    const tunerRoot = document.createElement("div");
    tunerRoot.className = "__tuner-root";
    const parentEl = document.createElement("div");
    tunerRoot.appendChild(parentEl);
    document.body.appendChild(tunerRoot);

    const target: DropTarget = { type: "between", parent: parentEl, before: null };
    expect(canDrop(dragged, target)).toBe(false);
  });

  it("allows valid drop into a container", () => {
    const dragged = document.createElement("div");
    const container = document.createElement("section");
    document.body.appendChild(container);
    const target: DropTarget = { type: "into", container };
    expect(canDrop(dragged, target)).toBe(true);
  });

  it("allows valid drop between siblings", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    const b = document.createElement("div");
    const dragged = document.createElement("div");
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(dragged);
    document.body.appendChild(parent);

    const target: DropTarget = { type: "between", parent, before: b };
    expect(canDrop(dragged, target)).toBe(true);
  });
});

// ─── executeDrop ──────────────────────────────────────────────────────

describe("executeDrop", () => {
  it("moves element between siblings (before)", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    a.id = "a";
    const b = document.createElement("div");
    b.id = "b";
    const c = document.createElement("div");
    c.id = "c";
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(c);
    document.body.appendChild(parent);

    // Move c before a
    const target: DropTarget = { type: "between", parent, before: a };
    executeDrop(c, target);

    const children = Array.from(parent.children);
    expect(children[0].id).toBe("c");
    expect(children[1].id).toBe("a");
    expect(children[2].id).toBe("b");
  });

  it("moves element into a container (append)", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    child.id = "child";
    parent.appendChild(child);
    document.body.appendChild(parent);

    const container = document.createElement("section");
    container.id = "container";
    document.body.appendChild(container);

    const target: DropTarget = { type: "into", container };
    executeDrop(child, target);

    expect(container.children.length).toBe(1);
    expect(container.children[0].id).toBe("child");
    expect(parent.children.length).toBe(0);
  });

  it("undo restores original position", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    a.id = "a";
    const b = document.createElement("div");
    b.id = "b";
    const c = document.createElement("div");
    c.id = "c";
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(c);
    document.body.appendChild(parent);

    // Move c before a
    const target: DropTarget = { type: "between", parent, before: a };
    const result = executeDrop(c, target);

    // Verify moved
    expect(Array.from(parent.children).map((e) => e.id)).toEqual(["c", "a", "b"]);

    // Undo
    result.undo();
    expect(Array.from(parent.children).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("redo re-applies the move", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    a.id = "a";
    const b = document.createElement("div");
    b.id = "b";
    const c = document.createElement("div");
    c.id = "c";
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(c);
    document.body.appendChild(parent);

    // Move c before a
    const target: DropTarget = { type: "between", parent, before: a };
    const result = executeDrop(c, target);

    // Undo
    result.undo();
    expect(Array.from(parent.children).map((e) => e.id)).toEqual(["a", "b", "c"]);

    // Redo
    result.redo();
    expect(Array.from(parent.children).map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("undo restores element appended to end of parent", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    a.id = "a";
    const b = document.createElement("div");
    b.id = "b";
    parent.appendChild(a);
    parent.appendChild(b);
    document.body.appendChild(parent);

    const otherParent = document.createElement("div");
    document.body.appendChild(otherParent);

    // Move b into otherParent
    const target: DropTarget = { type: "into", container: otherParent };
    const result = executeDrop(b, target);

    expect(otherParent.children.length).toBe(1);
    expect(parent.children.length).toBe(1);

    // Undo — b should go back to end of parent (after a)
    result.undo();
    expect(parent.children.length).toBe(2);
    expect(Array.from(parent.children).map((e) => e.id)).toEqual(["a", "b"]);
    expect(otherParent.children.length).toBe(0);
  });

  it("between with before=null appends to parent", () => {
    const parent = document.createElement("div");
    const a = document.createElement("div");
    a.id = "a";
    const b = document.createElement("div");
    b.id = "b";
    parent.appendChild(a);
    document.body.appendChild(parent);

    const otherParent = document.createElement("div");
    otherParent.appendChild(b);
    document.body.appendChild(otherParent);

    // Move b to end of parent (before=null means append)
    const target: DropTarget = { type: "between", parent, before: null };
    executeDrop(b, target);

    expect(parent.children.length).toBe(2);
    expect(parent.children[1].id).toBe("b");
  });
});
