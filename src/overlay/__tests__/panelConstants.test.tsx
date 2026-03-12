// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  TEXT_ALIGN_OPTIONS,
  TEXT_DECORATION_OPTIONS,
  CAPITALIZE_OPTIONS,
  ITALIC_OPTIONS,
  DIRECTION_OPTIONS,
  OVERFLOW_ICON_OPTIONS,
  DIRECTION_ICONS_SHORT,
  BOX_SIZING_OPTIONS,
  DISPLAY_TABS,
  DISPLAY_MORE,
  FONT_WEIGHT_OPTIONS,
  WHITE_SPACE_OPTIONS,
  WORD_BREAK_OPTIONS,
  LINE_BREAK_OPTIONS,
  HYPHENS_OPTIONS,
  FLOAT_OPTIONS,
  CLEAR_OPTIONS,
  BORDER_STYLE_OPTIONS,
  BLEND_MODE_OPTIONS,
  CURSOR_OPTIONS,
  POINTER_EVENTS_OPTIONS,
  VISIBILITY_OPTIONS,
  ALIGN_SELF_OPTIONS,
  DIRECTION_MORE_OPTIONS,
  JUSTIFY_OPTIONS,
  ALIGN_ITEMS_OPTIONS,
  BG_CLIP_OPTIONS,
  OBJECT_FIT_OPTIONS,
  OBJECT_POSITION_OPTIONS,
  USER_SELECT_OPTIONS,
  BACKFACE_OPTIONS,
  SIZE_UNITS_W,
  SIZE_UNITS_H,
  POSITION_UNITS,
  TYPO_SIZE_UNITS,
  LAYOUT_UNITS,
  BORDER_UNITS,
  SPACING_UNITS,
  LINE_HEIGHT_UNITS,
  FALLBACK_FONTS,
  EMPTY_KEYWORD_MAP,
  SHORTCUTS,
} from "../panelConstants";

// ─── Helpers ──────────────────────────────────────────────────────────

/** Assert every item in an icon-button array has value, title, and icon. */
function expectIconGroupShape(arr: readonly { value: string; title: string; icon: unknown }[]) {
  for (const item of arr) {
    expect(item).toHaveProperty("value");
    expect(item).toHaveProperty("title");
    expect(item).toHaveProperty("icon");
    expect(typeof item.value).toBe("string");
    expect(typeof item.title).toBe("string");
    expect(item.icon).toBeTruthy();
  }
}

/** Assert every item in a dropdown array has value and label. */
function expectDropdownShape(arr: readonly { value: string; label: string }[]) {
  for (const item of arr) {
    expect(item).toHaveProperty("value");
    expect(item).toHaveProperty("label");
    expect(typeof item.value).toBe("string");
    expect(typeof item.label).toBe("string");
  }
}

/** Assert no duplicate values in an array of objects with a value key. */
function expectNoDuplicateValues(arr: readonly { value: string }[]) {
  const values = arr.map((o) => o.value);
  expect(new Set(values).size).toBe(values.length);
}

/** Assert no duplicates in a plain string array. */
function expectNoDuplicateStrings(arr: readonly string[]) {
  expect(new Set(arr).size).toBe(arr.length);
}

// ─── Icon Button Groups ──────────────────────────────────────────────

describe("Icon button groups — shape & length", () => {
  const groups = [
    { name: "TEXT_ALIGN_OPTIONS", arr: TEXT_ALIGN_OPTIONS, len: 4 },
    { name: "TEXT_DECORATION_OPTIONS", arr: TEXT_DECORATION_OPTIONS, len: 4 },
    { name: "CAPITALIZE_OPTIONS", arr: CAPITALIZE_OPTIONS, len: 4 },
    { name: "ITALIC_OPTIONS", arr: ITALIC_OPTIONS, len: 2 },
    { name: "DIRECTION_OPTIONS", arr: DIRECTION_OPTIONS, len: 2 },
    { name: "OVERFLOW_ICON_OPTIONS", arr: OVERFLOW_ICON_OPTIONS, len: 5 },
    { name: "DIRECTION_ICONS_SHORT", arr: DIRECTION_ICONS_SHORT, len: 3 },
    { name: "BOX_SIZING_OPTIONS", arr: BOX_SIZING_OPTIONS, len: 2 },
  ] as const;

  for (const { name, arr, len } of groups) {
    it(`${name} has ${len} items with value, title, icon`, () => {
      expect(arr).toHaveLength(len);
      expectIconGroupShape(arr as any);
      expectNoDuplicateValues(arr as any);
    });
  }
});

describe("Icon button groups — specific values", () => {
  it("TEXT_ALIGN_OPTIONS covers left/center/right/justify", () => {
    const vals = TEXT_ALIGN_OPTIONS.map((o) => o.value);
    expect(vals).toEqual(["left", "center", "right", "justify"]);
  });

  it("TEXT_DECORATION_OPTIONS includes line-through and underline", () => {
    const vals = TEXT_DECORATION_OPTIONS.map((o) => o.value);
    expect(vals).toContain("line-through");
    expect(vals).toContain("underline");
  });

  it("DIRECTION_ICONS_SHORT includes __wrap__ sentinel", () => {
    const vals = DIRECTION_ICONS_SHORT.map((o) => o.value);
    expect(vals).toContain("__wrap__");
  });
});

// ─── Dropdown Arrays ─────────────────────────────────────────────────

describe("Dropdown arrays — shape & length", () => {
  const dropdowns = [
    { name: "DISPLAY_MORE", arr: DISPLAY_MORE, len: 4 },
    { name: "FONT_WEIGHT_OPTIONS", arr: FONT_WEIGHT_OPTIONS, len: 9 },
    { name: "WHITE_SPACE_OPTIONS", arr: WHITE_SPACE_OPTIONS, len: 6 },
    { name: "WORD_BREAK_OPTIONS", arr: WORD_BREAK_OPTIONS, len: 4 },
    { name: "LINE_BREAK_OPTIONS", arr: LINE_BREAK_OPTIONS, len: 5 },
    { name: "HYPHENS_OPTIONS", arr: HYPHENS_OPTIONS, len: 3 },
    { name: "FLOAT_OPTIONS", arr: FLOAT_OPTIONS, len: 3 },
    { name: "CLEAR_OPTIONS", arr: CLEAR_OPTIONS, len: 4 },
    { name: "BORDER_STYLE_OPTIONS", arr: BORDER_STYLE_OPTIONS, len: 9 },
    { name: "BLEND_MODE_OPTIONS", arr: BLEND_MODE_OPTIONS, len: 16 },
    { name: "CURSOR_OPTIONS", arr: CURSOR_OPTIONS, len: 14 },
    { name: "POINTER_EVENTS_OPTIONS", arr: POINTER_EVENTS_OPTIONS, len: 2 },
    { name: "VISIBILITY_OPTIONS", arr: VISIBILITY_OPTIONS, len: 3 },
    { name: "ALIGN_SELF_OPTIONS", arr: ALIGN_SELF_OPTIONS, len: 6 },
    { name: "DIRECTION_MORE_OPTIONS", arr: DIRECTION_MORE_OPTIONS, len: 2 },
    { name: "JUSTIFY_OPTIONS", arr: JUSTIFY_OPTIONS, len: 6 },
    { name: "ALIGN_ITEMS_OPTIONS", arr: ALIGN_ITEMS_OPTIONS, len: 5 },
    { name: "BG_CLIP_OPTIONS", arr: BG_CLIP_OPTIONS, len: 4 },
    { name: "OBJECT_FIT_OPTIONS", arr: OBJECT_FIT_OPTIONS, len: 5 },
    { name: "OBJECT_POSITION_OPTIONS", arr: OBJECT_POSITION_OPTIONS, len: 9 },
    { name: "USER_SELECT_OPTIONS", arr: USER_SELECT_OPTIONS, len: 4 },
    { name: "BACKFACE_OPTIONS", arr: BACKFACE_OPTIONS, len: 2 },
  ];

  for (const { name, arr, len } of dropdowns) {
    it(`${name} has ${len} items with value+label, no duplicates`, () => {
      expect(arr).toHaveLength(len);
      expectDropdownShape(arr);
      expectNoDuplicateValues(arr);
    });
  }
});

describe("Dropdown arrays — critical entries", () => {
  it("FONT_WEIGHT_OPTIONS covers 100 through 900", () => {
    const vals = FONT_WEIGHT_OPTIONS.map((o) => o.value);
    for (let w = 100; w <= 900; w += 100) {
      expect(vals).toContain(String(w));
    }
  });

  it("BORDER_STYLE_OPTIONS includes solid, dashed, dotted, none", () => {
    const vals = BORDER_STYLE_OPTIONS.map((o) => o.value);
    for (const s of ["solid", "dashed", "dotted", "none"]) {
      expect(vals).toContain(s);
    }
  });

  it("BLEND_MODE_OPTIONS starts with normal and includes multiply/screen", () => {
    expect(BLEND_MODE_OPTIONS[0].value).toBe("normal");
    const vals = BLEND_MODE_OPTIONS.map((o) => o.value);
    expect(vals).toContain("multiply");
    expect(vals).toContain("screen");
  });

  it("CURSOR_OPTIONS includes pointer and not-allowed", () => {
    const vals = CURSOR_OPTIONS.map((o) => o.value);
    expect(vals).toContain("pointer");
    expect(vals).toContain("not-allowed");
  });
});

// ─── DISPLAY_TABS ────────────────────────────────────────────────────

describe("DISPLAY_TABS", () => {
  it("contains block, flex, grid, none in that order", () => {
    expect([...DISPLAY_TABS]).toEqual(["block", "flex", "grid", "none"]);
  });
});

// ─── Unit Arrays ─────────────────────────────────────────────────────

describe("Unit arrays", () => {
  const unitArrays = [
    { name: "SIZE_UNITS_W", arr: SIZE_UNITS_W, len: 6 },
    { name: "SIZE_UNITS_H", arr: SIZE_UNITS_H, len: 5 },
    { name: "POSITION_UNITS", arr: POSITION_UNITS, len: 4 },
    { name: "TYPO_SIZE_UNITS", arr: TYPO_SIZE_UNITS, len: 3 },
    { name: "LAYOUT_UNITS", arr: LAYOUT_UNITS, len: 4 },
    { name: "BORDER_UNITS", arr: BORDER_UNITS, len: 3 },
    { name: "SPACING_UNITS", arr: SPACING_UNITS, len: 4 },
    { name: "LINE_HEIGHT_UNITS", arr: LINE_HEIGHT_UNITS, len: 4 },
  ];

  for (const { name, arr, len } of unitArrays) {
    it(`${name} has ${len} items with no duplicates`, () => {
      expect(arr).toHaveLength(len);
      expectNoDuplicateStrings(arr);
    });
  }

  it("all unit arrays except LINE_HEIGHT_UNITS start with px", () => {
    for (const arr of [SIZE_UNITS_W, SIZE_UNITS_H, POSITION_UNITS, TYPO_SIZE_UNITS, LAYOUT_UNITS, BORDER_UNITS, SPACING_UNITS]) {
      expect(arr[0]).toBe("px");
    }
  });

  it("LINE_HEIGHT_UNITS starts with em-dash (unitless sentinel)", () => {
    expect(LINE_HEIGHT_UNITS[0]).toBe("\u2014");
    expect(LINE_HEIGHT_UNITS).toContain("px");
  });

  it("SIZE_UNITS_W contains vw but not vh", () => {
    expect(SIZE_UNITS_W).toContain("vw");
    expect(SIZE_UNITS_W).not.toContain("vh");
  });

  it("SIZE_UNITS_H contains vh but not vw", () => {
    expect(SIZE_UNITS_H).toContain("vh");
    expect(SIZE_UNITS_H).not.toContain("vw");
  });
});

// ─── FALLBACK_FONTS ──────────────────────────────────────────────────

describe("FALLBACK_FONTS", () => {
  it("has 7 entries with no duplicates", () => {
    expect(FALLBACK_FONTS).toHaveLength(7);
    expectNoDuplicateStrings(FALLBACK_FONTS);
  });

  it("includes system-ui, serif, sans-serif, monospace", () => {
    for (const f of ["system-ui", "serif", "sans-serif", "monospace"]) {
      expect(FALLBACK_FONTS).toContain(f);
    }
  });
});

// ─── EMPTY_KEYWORD_MAP ───────────────────────────────────────────────

describe("EMPTY_KEYWORD_MAP", () => {
  it("maps width and height to auto", () => {
    expect(EMPTY_KEYWORD_MAP["width"]).toBe("auto");
    expect(EMPTY_KEYWORD_MAP["height"]).toBe("auto");
  });

  it("maps max-width and max-height to none", () => {
    expect(EMPTY_KEYWORD_MAP["max-width"]).toBe("none");
    expect(EMPTY_KEYWORD_MAP["max-height"]).toBe("none");
  });

  it("maps min-width and min-height to 0", () => {
    expect(EMPTY_KEYWORD_MAP["min-width"]).toBe("0");
    expect(EMPTY_KEYWORD_MAP["min-height"]).toBe("0");
  });

  it("maps z-index to auto", () => {
    expect(EMPTY_KEYWORD_MAP["z-index"]).toBe("auto");
  });

  it("maps flex-basis to auto", () => {
    expect(EMPTY_KEYWORD_MAP["flex-basis"]).toBe("auto");
  });

  it("has exactly 8 entries", () => {
    expect(Object.keys(EMPTY_KEYWORD_MAP)).toHaveLength(8);
  });
});

// ─── SHORTCUTS ───────────────────────────────────────────────────────

describe("SHORTCUTS", () => {
  it("is a non-empty array", () => {
    expect(SHORTCUTS.length).toBeGreaterThan(0);
  });

  it("every entry has keys, description, and group as strings", () => {
    for (const s of SHORTCUTS) {
      expect(typeof s.keys).toBe("string");
      expect(typeof s.description).toBe("string");
      expect(typeof s.group).toBe("string");
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.group.length).toBeGreaterThan(0);
    }
  });

  it("covers all four groups: Selection, Values, Panel, File", () => {
    const groups = new Set(SHORTCUTS.map((s) => s.group));
    for (const g of ["Selection", "Values", "Panel", "File"]) {
      expect(groups).toContain(g);
    }
  });

  it("includes Cmd+S (save) and Cmd+Z (undo) shortcuts", () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(keys.some((k) => k.includes("Cmd+S"))).toBe(true);
    expect(keys.some((k) => k.includes("Cmd+Z"))).toBe(true);
  });
});
