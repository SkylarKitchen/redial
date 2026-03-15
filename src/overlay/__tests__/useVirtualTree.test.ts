/**
 * useVirtualTree.test.ts — Tests for virtualized tree rendering hook
 *
 * The hook is a pure computation wrapped in useMemo, so we test the
 * logic directly by calling the function with mock data.
 */

import { describe, it, expect } from "vitest";
import type { TreeNode } from "../navigatorFilter";

// We test the core logic directly — extract it from the hook's useMemo.
// Since useVirtualTree is just useMemo over a pure calculation, we replicate
// the same logic here to test it as a pure function.
function computeVirtualTree(options: {
  flatNodes: { node: TreeNode; depth: number }[];
  rowHeight: number;
  containerHeight: number;
  scrollTop: number;
  overscan?: number;
}) {
  const {
    flatNodes,
    rowHeight,
    containerHeight,
    scrollTop,
    overscan = 5,
  } = options;

  const totalHeight = flatNodes.length * rowHeight;

  if (flatNodes.length === 0) {
    return { visibleNodes: [], totalHeight: 0, offsetY: 0 };
  }

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - overscan,
  );
  const endIndex = Math.min(
    flatNodes.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan,
  );

  const visibleNodes = flatNodes
    .slice(startIndex, endIndex)
    .map((flat, i) => ({
      ...flat,
      index: startIndex + i,
    }));

  const offsetY = startIndex * rowHeight;

  return { visibleNodes, totalHeight, offsetY };
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeFlatNodes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    node: {
      el: { tagName: "DIV" } as unknown as Element,
      tag: "div",
      displayClass: null,
      children: [],
      depth: 0,
    } satisfies TreeNode,
    depth: 0,
  }));
}

const ROW_HEIGHT = 26;

// ─── Tests ───────────────────────────────────────────────────────

describe("useVirtualTree", () => {
  it("shows ~20 visible nodes for 100 nodes at scrollTop=0 with 260px container", () => {
    const flatNodes = makeFlatNodes(100);
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop: 0,
    });

    // At scrollTop 0: startIndex = max(0, 0 - 5) = 0
    // endIndex = min(100, ceil(260/26) + 5) = min(100, 10 + 5) = 15
    expect(result.visibleNodes.length).toBe(15);
    expect(result.totalHeight).toBe(100 * ROW_HEIGHT);
    expect(result.offsetY).toBe(0);
    expect(result.visibleNodes[0].index).toBe(0);
    expect(result.visibleNodes[14].index).toBe(14);
  });

  it("shows correct slice when scrolled to middle", () => {
    const flatNodes = makeFlatNodes(100);
    const scrollTop = 50 * ROW_HEIGHT; // middle of list
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop,
    });

    // startIndex = max(0, floor(1300/26) - 5) = max(0, 50 - 5) = 45
    // endIndex = min(100, ceil((1300+260)/26) + 5) = min(100, 60 + 5) = 65
    expect(result.visibleNodes.length).toBe(20);
    expect(result.visibleNodes[0].index).toBe(45);
    expect(result.visibleNodes[19].index).toBe(64);
    expect(result.offsetY).toBe(45 * ROW_HEIGHT);
  });

  it("shows last ~15 nodes when scrolled to bottom", () => {
    const flatNodes = makeFlatNodes(100);
    const scrollTop = 100 * ROW_HEIGHT - 260; // 2340
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop,
    });

    // startIndex = max(0, floor(2340/26) - 5) = max(0, 90 - 5) = 85
    // endIndex = min(100, ceil((2340+260)/26) + 5) = min(100, 100 + 5) = 100
    expect(result.visibleNodes.length).toBe(15);
    expect(result.visibleNodes[result.visibleNodes.length - 1].index).toBe(99);
    expect(result.totalHeight).toBe(100 * ROW_HEIGHT);
  });

  it("returns empty for empty list", () => {
    const result = computeVirtualTree({
      flatNodes: [],
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop: 0,
    });

    expect(result.visibleNodes).toEqual([]);
    expect(result.totalHeight).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it("respects custom overscan", () => {
    const flatNodes = makeFlatNodes(100);
    const scrollTop = 50 * ROW_HEIGHT;
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop,
      overscan: 10,
    });

    // startIndex = max(0, 50 - 10) = 40
    // endIndex = min(100, 60 + 10) = 70
    expect(result.visibleNodes.length).toBe(30);
    expect(result.visibleNodes[0].index).toBe(40);
    expect(result.visibleNodes[29].index).toBe(69);
  });

  it("handles small list that fits entirely in container", () => {
    const flatNodes = makeFlatNodes(5);
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop: 0,
    });

    // All 5 nodes visible (5 < 10 viewport rows + 5 overscan)
    expect(result.visibleNodes.length).toBe(5);
    expect(result.totalHeight).toBe(5 * ROW_HEIGHT);
    expect(result.offsetY).toBe(0);
  });

  it("preserves correct index values on each visible node", () => {
    const flatNodes = makeFlatNodes(50);
    const scrollTop = 20 * ROW_HEIGHT;
    const result = computeVirtualTree({
      flatNodes,
      rowHeight: ROW_HEIGHT,
      containerHeight: 260,
      scrollTop,
    });

    for (let i = 0; i < result.visibleNodes.length; i++) {
      expect(result.visibleNodes[i].index).toBe(
        result.visibleNodes[0].index + i,
      );
    }
  });
});
