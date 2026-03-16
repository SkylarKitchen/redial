import { describe, it, expect } from "vitest";
import { filterItemsToCSS } from "../cssParsers";
import type { FilterItem } from "../sections/FilterSliders";

describe("backdrop-filter remove via ×", () => {
  it("filterItemsToCSS returns 'none' for empty array", () => {
    expect(filterItemsToCSS([])).toBe("none");
  });

  it("filterItemsToCSS returns 'none' when all items hidden", () => {
    const items: FilterItem[] = [
      { type: "blur", values: [5], visible: false, expanded: false },
    ];
    expect(filterItemsToCSS(items)).toBe("none");
  });

  it("filterItemsToCSS includes only visible items", () => {
    const items: FilterItem[] = [
      { type: "blur", values: [5], visible: true, expanded: false },
      { type: "contrast", values: [80], visible: false, expanded: false },
    ];
    expect(filterItemsToCSS(items)).toBe("blur(5px)");
  });
});
