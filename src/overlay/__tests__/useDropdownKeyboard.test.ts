import { describe, it, expect } from "vitest";
import { computeNextIndex, typeAheadMatch } from "../hooks/useDropdownKeyboard";

describe("computeNextIndex", () => {
  // --- ArrowDown ---
  describe("ArrowDown", () => {
    it("increments from 0 to 1", () => {
      expect(computeNextIndex("ArrowDown", 0, 5)).toBe(1);
    });

    it("increments from middle index", () => {
      expect(computeNextIndex("ArrowDown", 2, 5)).toBe(3);
    });

    it("wraps from last index to 0", () => {
      expect(computeNextIndex("ArrowDown", 4, 5)).toBe(0);
    });

    it("wraps with single option (0 -> 0)", () => {
      expect(computeNextIndex("ArrowDown", 0, 1)).toBe(0);
    });

    it("toggles between two options (0 -> 1)", () => {
      expect(computeNextIndex("ArrowDown", 0, 2)).toBe(1);
    });

    it("toggles between two options (1 -> 0)", () => {
      expect(computeNextIndex("ArrowDown", 1, 2)).toBe(0);
    });
  });

  // --- ArrowUp ---
  describe("ArrowUp", () => {
    it("decrements from 2 to 1", () => {
      expect(computeNextIndex("ArrowUp", 2, 5)).toBe(1);
    });

    it("decrements from 1 to 0", () => {
      expect(computeNextIndex("ArrowUp", 1, 5)).toBe(0);
    });

    it("wraps from 0 to last index", () => {
      expect(computeNextIndex("ArrowUp", 0, 5)).toBe(4);
    });

    it("wraps with single option (0 -> 0)", () => {
      expect(computeNextIndex("ArrowUp", 0, 1)).toBe(0);
    });

    it("toggles between two options (1 -> 0)", () => {
      expect(computeNextIndex("ArrowUp", 1, 2)).toBe(0);
    });

    it("toggles between two options (0 -> 1)", () => {
      expect(computeNextIndex("ArrowUp", 0, 2)).toBe(1);
    });
  });

  // --- Home ---
  describe("Home", () => {
    it("returns 0 from any index", () => {
      expect(computeNextIndex("Home", 3, 5)).toBe(0);
    });

    it("returns 0 when already at 0", () => {
      expect(computeNextIndex("Home", 0, 5)).toBe(0);
    });

    it("returns 0 from last index", () => {
      expect(computeNextIndex("Home", 4, 5)).toBe(0);
    });
  });

  // --- End ---
  describe("End", () => {
    it("returns last index from any position", () => {
      expect(computeNextIndex("End", 1, 5)).toBe(4);
    });

    it("returns last index when already there", () => {
      expect(computeNextIndex("End", 4, 5)).toBe(4);
    });

    it("returns 0 for single option", () => {
      expect(computeNextIndex("End", 0, 1)).toBe(0);
    });
  });
});

describe("typeAheadMatch", () => {
  const labels = ["Apple", "Banana", "Blueberry", "Cherry", "Date"];

  it("matches first label starting with single char", () => {
    expect(typeAheadMatch("a", labels)).toBe(0);
  });

  it("matches second label starting with 'b'", () => {
    expect(typeAheadMatch("b", labels)).toBe(1);
  });

  it("multi-char buffer narrows to later match", () => {
    expect(typeAheadMatch("bl", labels)).toBe(2);
  });

  it("is case insensitive (uppercase buffer)", () => {
    expect(typeAheadMatch("C", labels)).toBe(3);
  });

  it("is case insensitive (mixed case buffer)", () => {
    expect(typeAheadMatch("cH", labels)).toBe(3);
  });

  it("returns -1 when no label matches", () => {
    expect(typeAheadMatch("z", labels)).toBe(-1);
  });

  it("returns -1 for partial mismatch", () => {
    expect(typeAheadMatch("bx", labels)).toBe(-1);
  });

  it("empty buffer matches first label", () => {
    expect(typeAheadMatch("", labels)).toBe(0);
  });

  it("returns -1 for empty labels array", () => {
    expect(typeAheadMatch("a", [])).toBe(-1);
  });

  it("empty buffer with empty labels returns -1", () => {
    expect(typeAheadMatch("", [])).toBe(-1);
  });

  it("matches full label text", () => {
    expect(typeAheadMatch("date", labels)).toBe(4);
  });
});
