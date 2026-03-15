// @vitest-environment happy-dom
/**
 * AlignBox accessibility tests
 *
 * Each cell in the 3×3 grid must have:
 *   - role="radio" (not "button")
 *   - aria-checked="true" or "false"
 *   - aria-label describing its alignment (e.g., "Align top-left")
 *
 * The grid wrapper must have:
 *   - role="radiogroup"
 *   - aria-label with an accessible name
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AlignBox } from "../sections/AlignBox";

// ─── Helpers ──────────────────────────────────────────────────────────

function render(justify: string, align: string) {
  return renderToString(
    createElement(AlignBox, { justify, align, onChange: vi.fn(), compact: true })
  );
}

// Expected labels for the 3×3 grid (row-major order)
const EXPECTED_LABELS = [
  "Align top-left",
  "Align top-center",
  "Align top-right",
  "Align middle-left",
  "Align middle-center",
  "Align middle-right",
  "Align bottom-left",
  "Align bottom-center",
  "Align bottom-right",
];

// ─── Radiogroup wrapper ──────────────────────────────────────────────

describe("AlignBox radiogroup wrapper", () => {
  it("dot-grid mode has role='radiogroup'", () => {
    const html = render("center", "center");
    expect(html).toContain('role="radiogroup"');
  });

  it("radiogroup has an accessible aria-label", () => {
    const html = render("center", "center");
    expect(html).toContain('aria-label="Alignment"');
  });

  it("bar mode also has role='radiogroup'", () => {
    const html = render("flex-start", "stretch");
    expect(html).toContain('role="radiogroup"');
  });
});

// ─── Radio role on cells ─────────────────────────────────────────────

describe("AlignBox radio cells", () => {
  it("cells use role='radio' instead of role='button'", () => {
    const html = render("flex-start", "flex-start");
    expect(html).not.toContain('role="button"');
    // Should have 9 radio cells in dot-grid mode
    const radioCount = (html.match(/role="radio"/g) || []).length;
    expect(radioCount).toBe(9);
  });

  it("bar mode cells also use role='radio'", () => {
    const html = render("center", "stretch");
    expect(html).not.toContain('role="button"');
    const radioCount = (html.match(/role="radio"/g) || []).length;
    expect(radioCount).toBe(9);
  });
});

// ─── aria-checked ────────────────────────────────────────────────────

describe("AlignBox aria-checked", () => {
  it("active cell has aria-checked='true'", () => {
    // flex-start × flex-start → top-left is active
    const html = render("flex-start", "flex-start");
    expect(html).toContain('aria-checked="true"');
  });

  it("inactive cells have aria-checked='false'", () => {
    // flex-start × flex-start → 1 active, 8 inactive
    const html = render("flex-start", "flex-start");
    const checkedTrue = (html.match(/aria-checked="true"/g) || []).length;
    const checkedFalse = (html.match(/aria-checked="false"/g) || []).length;
    expect(checkedTrue).toBe(1);
    expect(checkedFalse).toBe(8);
  });

  it("center × center has exactly 1 checked cell", () => {
    const html = render("center", "center");
    const checkedTrue = (html.match(/aria-checked="true"/g) || []).length;
    expect(checkedTrue).toBe(1);
  });

  it("space-between × center has 3 checked cells", () => {
    const html = render("space-between", "center");
    const checkedTrue = (html.match(/aria-checked="true"/g) || []).length;
    expect(checkedTrue).toBe(3);
  });
});

// ─── aria-label descriptive names ────────────────────────────────────

describe("AlignBox aria-label", () => {
  it("all 9 cells have descriptive alignment labels", () => {
    const html = render("center", "center");
    for (const label of EXPECTED_LABELS) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });

  it("does NOT use column/row index labels", () => {
    const html = render("center", "center");
    // Old format: "Align column 0 row 0"
    expect(html).not.toMatch(/aria-label="Align column \d+ row \d+"/);
  });

  it("bar mode uses the same descriptive labels", () => {
    const html = render("flex-start", "stretch");
    for (const label of EXPECTED_LABELS) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });
});
