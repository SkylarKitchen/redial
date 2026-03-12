import { describe, it, expect } from "vitest";
import { computeOverIndex, computeItemShift } from "../useDragReorder";

// Uniform layout: 4 items, each 50px tall, stacked at y=0,50,100,150
const TOPS_4 = [0, 50, 100, 150];
const HEIGHTS_4 = [50, 50, 50, 50];

// Variable-height layout: 4 items with heights 30, 60, 40, 50
const TOPS_VAR = [0, 30, 90, 130];
const HEIGHTS_VAR = [30, 60, 40, 50];

describe("computeOverIndex", () => {
  it("returns dragIdx when offset is 0 (no movement)", () => {
    expect(computeOverIndex(1, 0, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("stays in place with small offset that does not cross a center", () => {
    // Item 1 center = 75, item 2 center = 125. Moving 20px down → 95, still closer to 75
    expect(computeOverIndex(1, 20, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("dragging down past one item returns next index", () => {
    // Item 0 center = 25. Offset +50 → dragCenter = 75, which is item 1's center
    expect(computeOverIndex(0, 50, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("dragging up past one item returns previous index", () => {
    // Item 2 center = 125. Offset -50 → dragCenter = 75, which is item 1's center
    expect(computeOverIndex(2, -50, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("dragging down past multiple items skips to correct target", () => {
    // Item 0 center = 25. Offset +100 → dragCenter = 125, which is item 2's center
    expect(computeOverIndex(0, 100, TOPS_4, HEIGHTS_4)).toBe(2);
  });

  it("dragging up past multiple items skips to correct target", () => {
    // Item 3 center = 175. Offset -100 → dragCenter = 75, item 1 center
    expect(computeOverIndex(3, -100, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("dragging first item all the way to last position", () => {
    // Item 0 center = 25. Offset +150 → dragCenter = 175, item 3 center
    expect(computeOverIndex(0, 150, TOPS_4, HEIGHTS_4)).toBe(3);
  });

  it("dragging last item all the way to first position", () => {
    // Item 3 center = 175. Offset -150 → dragCenter = 25, item 0 center
    expect(computeOverIndex(3, -150, TOPS_4, HEIGHTS_4)).toBe(0);
  });

  it("single item always returns 0", () => {
    expect(computeOverIndex(0, 0, [0], [50])).toBe(0);
    expect(computeOverIndex(0, 100, [0], [50])).toBe(0);
    expect(computeOverIndex(0, -100, [0], [50])).toBe(0);
  });

  it("works with variable-height items (drag down)", () => {
    // Item 0 center = 15. Offset +45 → dragCenter = 60, item 1 center = 60
    expect(computeOverIndex(0, 45, TOPS_VAR, HEIGHTS_VAR)).toBe(1);
  });

  it("works with variable-height items (drag across multiple)", () => {
    // Item 0 center = 15. Offset +95 → dragCenter = 110, item 2 center = 110
    expect(computeOverIndex(0, 95, TOPS_VAR, HEIGHTS_VAR)).toBe(2);
  });

  it("picks the closer item when between two centers", () => {
    // Item 0 center = 25. Offset +30 → dragCenter = 55, closer to item 1 center (75) than item 0 (25)
    expect(computeOverIndex(0, 30, TOPS_4, HEIGHTS_4)).toBe(1);
  });

  it("picks the earlier item on exact tie (first-wins)", () => {
    // Two items at 0 and 100, both 50px: centers at 25 and 125. DragCenter = 75 is equidistant.
    // The algorithm iterates in order and uses strict <, so first match (i=0) wins.
    expect(computeOverIndex(0, 50, [0, 100], [50, 50])).toBe(0);
  });
});

describe("computeItemShift", () => {
  const H = 50; // dragHeight for uniform items

  describe("dragging down (dragIndex < overIndex)", () => {
    // drag=0, over=2: items 1 and 2 shift up, others stay
    it("shifts items in range (dragIndex, overIndex] up by -dragHeight", () => {
      expect(computeItemShift(1, 0, 2, H)).toBe(-H);
      expect(computeItemShift(2, 0, 2, H)).toBe(-H);
    });

    it("does not shift items outside the range", () => {
      expect(computeItemShift(0, 0, 2, H)).toBe(0); // the dragged item itself
      expect(computeItemShift(3, 0, 2, H)).toBe(0); // item after overIndex
    });

    it("shifts only the adjacent item when dragging down by one", () => {
      // drag=1, over=2
      expect(computeItemShift(0, 1, 2, H)).toBe(0);
      expect(computeItemShift(1, 1, 2, H)).toBe(0); // dragged item
      expect(computeItemShift(2, 1, 2, H)).toBe(-H);
      expect(computeItemShift(3, 1, 2, H)).toBe(0);
    });
  });

  describe("dragging up (dragIndex > overIndex)", () => {
    // drag=3, over=1: items 1 and 2 shift down, others stay
    it("shifts items in range [overIndex, dragIndex) down by +dragHeight", () => {
      expect(computeItemShift(1, 3, 1, H)).toBe(H);
      expect(computeItemShift(2, 3, 1, H)).toBe(H);
    });

    it("does not shift items outside the range", () => {
      expect(computeItemShift(0, 3, 1, H)).toBe(0); // before overIndex
      expect(computeItemShift(3, 3, 1, H)).toBe(0); // the dragged item itself
    });

    it("shifts only the adjacent item when dragging up by one", () => {
      // drag=2, over=1
      expect(computeItemShift(0, 2, 1, H)).toBe(0);
      expect(computeItemShift(1, 2, 1, H)).toBe(H);
      expect(computeItemShift(2, 2, 1, H)).toBe(0); // dragged item
      expect(computeItemShift(3, 2, 1, H)).toBe(0);
    });
  });

  describe("same position (dragIndex === overIndex)", () => {
    it("returns 0 for all items", () => {
      expect(computeItemShift(0, 1, 1, H)).toBe(0);
      expect(computeItemShift(1, 1, 1, H)).toBe(0);
      expect(computeItemShift(2, 1, 1, H)).toBe(0);
      expect(computeItemShift(3, 1, 1, H)).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("first to last: all intermediate items shift up", () => {
      // drag=0, over=3: items 1, 2, 3 shift up
      expect(computeItemShift(0, 0, 3, H)).toBe(0);
      expect(computeItemShift(1, 0, 3, H)).toBe(-H);
      expect(computeItemShift(2, 0, 3, H)).toBe(-H);
      expect(computeItemShift(3, 0, 3, H)).toBe(-H);
    });

    it("last to first: all intermediate items shift down", () => {
      // drag=3, over=0: items 0, 1, 2 shift down
      expect(computeItemShift(0, 3, 0, H)).toBe(H);
      expect(computeItemShift(1, 3, 0, H)).toBe(H);
      expect(computeItemShift(2, 3, 0, H)).toBe(H);
      expect(computeItemShift(3, 3, 0, H)).toBe(0);
    });

    it("uses the actual dragHeight (variable-height items)", () => {
      const dragH = 80;
      // drag=0, over=2: items 1, 2 shift by -80
      expect(computeItemShift(1, 0, 2, dragH)).toBe(-80);
      expect(computeItemShift(2, 0, 2, dragH)).toBe(-80);
    });
  });
});
