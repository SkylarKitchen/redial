// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  shouldShowNode,
  shouldSkipEntirely,
  buildFilteredTree,
  flattenTree,
  countNodes,
  getAncestorsInTree,
  type TreeNode,
} from "../navigatorFilter";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Build a nested DOM tree: body > tags[0] > tags[1] > ... and return the deepest element. */
function buildTree(...tags: string[]): HTMLElement {
  let parent: HTMLElement = document.body;
  let last: HTMLElement = parent;
  for (const tag of tags) {
    const el = document.createElement(tag);
    parent.appendChild(el);
    parent = el;
    last = el;
  }
  return last;
}

// ─── shouldShowNode ───────────────────────────────────────────────────

describe("shouldShowNode", () => {
  it("passes semantic elements: main, section, h1, button, p, a, img, form, input, nav, header, footer, article, aside", () => {
    const tags = [
      "main", "section", "h1", "button", "p", "a", "img",
      "form", "input", "nav", "header", "footer", "article", "aside",
    ];
    for (const tag of tags) {
      const el = document.createElement(tag);
      expect(shouldShowNode(el)).toBe(true);
    }
  });

  it("fails bare <div> with no class/id/text/children", () => {
    const el = document.createElement("div");
    expect(shouldShowNode(el)).toBe(false);
  });

  it("passes <div class='hero'> (has class)", () => {
    const el = document.createElement("div");
    el.className = "hero";
    expect(shouldShowNode(el)).toBe(true);
  });

  it("passes <div id='app'> (has id)", () => {
    const el = document.createElement("div");
    el.id = "app";
    expect(shouldShowNode(el)).toBe(true);
  });

  it("passes <div> with direct text content", () => {
    const el = document.createElement("div");
    el.appendChild(document.createTextNode("Hello world"));
    expect(shouldShowNode(el)).toBe(true);
  });

  it("fails <div> with whitespace-only text content", () => {
    const el = document.createElement("div");
    el.appendChild(document.createTextNode("   \n\t  "));
    expect(shouldShowNode(el)).toBe(false);
  });

  it("passes <div> with 2+ child elements", () => {
    const el = document.createElement("div");
    el.appendChild(document.createElement("span"));
    el.appendChild(document.createElement("span"));
    expect(shouldShowNode(el)).toBe(true);
  });

  it("fails <div> with 1 child element (unless other criteria met)", () => {
    const el = document.createElement("div");
    el.appendChild(document.createElement("span"));
    expect(shouldShowNode(el)).toBe(false);
  });

  it("passes <div style='color: red'> (has inline styles)", () => {
    const el = document.createElement("div");
    el.style.color = "red";
    expect(shouldShowNode(el)).toBe(true);
  });

  it("passes <svg> (SVG root)", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(shouldShowNode(el)).toBe(true);
  });
});

// ─── shouldSkipEntirely ───────────────────────────────────────────────

describe("shouldSkipEntirely", () => {
  it("returns true for <script>", () => {
    expect(shouldSkipEntirely(document.createElement("script"))).toBe(true);
  });

  it("returns true for <style>", () => {
    expect(shouldSkipEntirely(document.createElement("style"))).toBe(true);
  });

  it("returns true for <link>", () => {
    expect(shouldSkipEntirely(document.createElement("link"))).toBe(true);
  });

  it("returns true for <meta>", () => {
    expect(shouldSkipEntirely(document.createElement("meta"))).toBe(true);
  });

  it("returns true for <noscript>", () => {
    expect(shouldSkipEntirely(document.createElement("noscript"))).toBe(true);
  });

  it("returns true for <template>", () => {
    expect(shouldSkipEntirely(document.createElement("template"))).toBe(true);
  });

  it("returns true for element with class __tuner-root", () => {
    const root = makeEl("div");
    root.className = "__tuner-root";
    const child = document.createElement("div");
    root.appendChild(child);
    // child.closest(".__tuner-root") should find root
    expect(shouldSkipEntirely(child)).toBe(true);
  });

  it("returns true for element with display: none computed style", () => {
    const el = makeEl("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "none",
      visibility: "visible",
    } as CSSStyleDeclaration);
    expect(shouldSkipEntirely(el)).toBe(true);
  });

  it("returns true for element with visibility: hidden computed style", () => {
    const el = makeEl("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      visibility: "hidden",
    } as CSSStyleDeclaration);
    expect(shouldSkipEntirely(el)).toBe(true);
  });

  it("returns false for a normal visible element", () => {
    const el = makeEl("div");
    expect(shouldSkipEntirely(el)).toBe(false);
  });
});

// ─── buildFilteredTree ────────────────────────────────────────────────

describe("buildFilteredTree", () => {
  it("body > main > h1 produces correct TreeNode structure", () => {
    const main = document.createElement("main");
    const h1 = document.createElement("h1");
    h1.textContent = "Title";
    main.appendChild(h1);
    document.body.appendChild(main);

    const tree = buildFilteredTree(document.body);
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe("main");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].tag).toBe("h1");
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("gap prevention: bare div with multiple visible children gets promoted", () => {
    // body > div (bare) > [section, article]
    const wrapper = document.createElement("div");
    const section = document.createElement("section");
    const article = document.createElement("article");
    wrapper.appendChild(section);
    wrapper.appendChild(article);
    document.body.appendChild(wrapper);

    const tree = buildFilteredTree(document.body);
    // The bare div has 2 visible children, so gap prevention promotes it
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe("div");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].tag).toBe("section");
    expect(tree[0].children[1].tag).toBe("article");
  });

  it("single visible child of hidden parent gets promoted (depth adjusted)", () => {
    // body > div (bare) > section (visible)
    const wrapper = document.createElement("div");
    const section = document.createElement("section");
    wrapper.appendChild(section);
    document.body.appendChild(wrapper);

    const tree = buildFilteredTree(document.body);
    // Bare div has single visible child => section promoted
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe("section");
    // Depth should be adjusted to the wrapper's depth (0)
    expect(tree[0].depth).toBe(0);
  });

  it("script tags are completely excluded (not even walked)", () => {
    const script = document.createElement("script");
    script.textContent = "console.log('hi')";
    const section = document.createElement("section");
    document.body.appendChild(script);
    document.body.appendChild(section);

    const tree = buildFilteredTree(document.body);
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe("section");
    // No script node anywhere in the tree
    const allTags = collectAllTags(tree);
    expect(allTags).not.toContain("script");
  });

  it("empty tree from body with no children", () => {
    const tree = buildFilteredTree(document.body);
    expect(tree).toHaveLength(0);
  });
});

/** Collect all tags in a tree recursively for assertions */
function collectAllTags(nodes: TreeNode[]): string[] {
  const tags: string[] = [];
  for (const node of nodes) {
    tags.push(node.tag);
    tags.push(...collectAllTags(node.children));
  }
  return tags;
}

// ─── flattenTree ──────────────────────────────────────────────────────

describe("flattenTree", () => {
  function makeTreeNode(
    tag: string,
    depth: number,
    children: TreeNode[] = [],
  ): TreeNode {
    const el = document.createElement(tag);
    return { el, tag, displayClass: null, children, depth };
  }

  it("all root nodes appear when no children", () => {
    const a = makeTreeNode("main", 0);
    const b = makeTreeNode("section", 0);

    const flat = flattenTree([a, b], new Set());
    expect(flat).toHaveLength(2);
    expect(flat[0].node.tag).toBe("main");
    expect(flat[1].node.tag).toBe("section");
  });

  it("children of expanded nodes appear", () => {
    const child = makeTreeNode("h1", 1);
    const parent = makeTreeNode("main", 0, [child]);

    const expanded = new Set<Element>([parent.el]);
    const flat = flattenTree([parent], expanded);
    expect(flat).toHaveLength(2);
    expect(flat[0].node.tag).toBe("main");
    expect(flat[1].node.tag).toBe("h1");
  });

  it("children of collapsed nodes don't appear", () => {
    const child = makeTreeNode("h1", 1);
    const parent = makeTreeNode("main", 0, [child]);

    const flat = flattenTree([parent], new Set());
    expect(flat).toHaveLength(1);
    expect(flat[0].node.tag).toBe("main");
  });

  it("nested expansion works correctly", () => {
    const grandchild = makeTreeNode("p", 2);
    const child = makeTreeNode("section", 1, [grandchild]);
    const root = makeTreeNode("main", 0, [child]);

    // Expand both root and child
    const expanded = new Set<Element>([root.el, child.el]);
    const flat = flattenTree([root], expanded);
    expect(flat).toHaveLength(3);
    expect(flat[0].node.tag).toBe("main");
    expect(flat[1].node.tag).toBe("section");
    expect(flat[2].node.tag).toBe("p");
  });

  it("partially expanded tree only shows expanded subtree", () => {
    const grandchild = makeTreeNode("p", 2);
    const child = makeTreeNode("section", 1, [grandchild]);
    const root = makeTreeNode("main", 0, [child]);

    // Only expand root, not child
    const expanded = new Set<Element>([root.el]);
    const flat = flattenTree([root], expanded);
    expect(flat).toHaveLength(2);
    expect(flat[0].node.tag).toBe("main");
    expect(flat[1].node.tag).toBe("section");
  });
});

// ─── countNodes ───────────────────────────────────────────────────────

describe("countNodes", () => {
  function makeTreeNode(
    tag: string,
    children: TreeNode[] = [],
  ): TreeNode {
    const el = document.createElement(tag);
    return { el, tag, displayClass: null, children, depth: 0 };
  }

  it("empty tree = 0", () => {
    expect(countNodes([])).toBe(0);
  });

  it("single node = 1", () => {
    expect(countNodes([makeTreeNode("main")])).toBe(1);
  });

  it("node with 3 children = 4", () => {
    const node = makeTreeNode("main", [
      makeTreeNode("h1"),
      makeTreeNode("p"),
      makeTreeNode("footer"),
    ]);
    expect(countNodes([node])).toBe(4);
  });

  it("nested nodes counted recursively", () => {
    const deepNode = makeTreeNode("main", [
      makeTreeNode("section", [
        makeTreeNode("h1"),
        makeTreeNode("p"),
      ]),
      makeTreeNode("aside"),
    ]);
    // main(1) + section(1) + h1(1) + p(1) + aside(1) = 5
    expect(countNodes([deepNode])).toBe(5);
  });
});

// ─── getAncestorsInTree ──────────────────────────────────────────────

describe("getAncestorsInTree", () => {
  function makeTreeNode(
    el: Element,
    tag: string,
    depth: number,
    children: TreeNode[] = [],
  ): TreeNode {
    return { el, tag, displayClass: null, children, depth };
  }

  it("returns empty for root-level node", () => {
    const el = document.createElement("main");
    const node = makeTreeNode(el, "main", 0);

    const ancestors = getAncestorsInTree([node], el);
    expect(ancestors).toEqual([]);
  });

  it("returns correct ancestor chain for deeply nested node", () => {
    const mainEl = document.createElement("main");
    const sectionEl = document.createElement("section");
    const pEl = document.createElement("p");

    const pNode = makeTreeNode(pEl, "p", 2);
    const sectionNode = makeTreeNode(sectionEl, "section", 1, [pNode]);
    const mainNode = makeTreeNode(mainEl, "main", 0, [sectionNode]);

    const ancestors = getAncestorsInTree([mainNode], pEl);
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0]).toBe(mainEl);
    expect(ancestors[1]).toBe(sectionEl);
  });

  it("returns empty when target not in tree", () => {
    const mainEl = document.createElement("main");
    const notInTree = document.createElement("div");
    const node = makeTreeNode(mainEl, "main", 0);

    const ancestors = getAncestorsInTree([node], notInTree);
    expect(ancestors).toEqual([]);
  });

  it("works with multiple root nodes", () => {
    const navEl = document.createElement("nav");
    const mainEl = document.createElement("main");
    const h1El = document.createElement("h1");

    const h1Node = makeTreeNode(h1El, "h1", 1);
    const navNode = makeTreeNode(navEl, "nav", 0);
    const mainNode = makeTreeNode(mainEl, "main", 0, [h1Node]);

    const ancestors = getAncestorsInTree([navNode, mainNode], h1El);
    expect(ancestors).toHaveLength(1);
    expect(ancestors[0]).toBe(mainEl);
  });
});
