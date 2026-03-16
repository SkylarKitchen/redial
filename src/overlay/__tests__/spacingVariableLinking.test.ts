// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { getAuthoredValue } from "../getAuthoredValue";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

// ─── extractVar regex (same pattern used in SpacingSection/SizeSection) ──

const extractVar = (authored: string | null): string | null => {
  return authored?.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
};

// ─── Tests ────────────────────────────────────────────────────────────

describe("spacing variable linking — getAuthoredValue detection", () => {
  it("detects var(--name) from inline styles", () => {
    const el = makeEl();
    el.style.setProperty("margin-top", "var(--space-4)");
    const authored = getAuthoredValue(el, "margin-top");
    expect(authored).toBe("var(--space-4)");
  });

  it("returns plain value for non-variable inline styles", () => {
    const el = makeEl();
    el.style.setProperty("padding-left", "16px");
    const authored = getAuthoredValue(el, "padding-left");
    expect(authored).toBe("16px");
  });

  it("returns null when no inline style is set", () => {
    const el = makeEl();
    const authored = getAuthoredValue(el, "margin-bottom");
    expect(authored).toBeNull();
  });
});

describe("spacing variable linking — extractVar regex", () => {
  it("extracts variable name from var(--name)", () => {
    expect(extractVar("var(--space-4)")).toBe("--space-4");
  });

  it("extracts variable name with whitespace: var( --name )", () => {
    expect(extractVar("var( --spacing-lg)")).toBe("--spacing-lg");
  });

  it("extracts variable name with fallback: var(--name, 16px)", () => {
    expect(extractVar("var(--gap-md, 16px)")).toBe("--gap-md");
  });

  it("returns null for plain pixel value", () => {
    expect(extractVar("16px")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractVar(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractVar("")).toBeNull();
  });

  it("handles nested var() — extracts outer variable", () => {
    expect(extractVar("var(--outer, var(--inner))")).toBe("--outer");
  });

  it("handles variable names with numbers and hyphens", () => {
    expect(extractVar("var(--space-2xl-8)")).toBe("--space-2xl-8");
  });
});
