// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { applyInlineStyle, diff, resetAll, isDirty, getInitial } from "../core/apply";
import { parseVarRef } from "../colorVariables";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

// ─── Variable linking through applyInlineStyle ───────────────────────

describe("variable linking via applyInlineStyle", () => {
  it("stores var() expression, not the resolved color", () => {
    const el = makeEl();
    // Simulate: user picks a variable swatch → onChange("var(--primary-500)")
    applyInlineStyle(el, "background-color", "var(--primary-500)");

    // The inline style must contain the var() reference, not a resolved hex
    const applied = el.style.getPropertyValue("background-color");
    expect(applied).toBe("var(--primary-500)");
  });

  it("diff shows var() as the target value", () => {
    const el = makeEl();
    // Set an initial plain color, then switch to a variable
    el.style.setProperty("background-color", "#ff0000");
    applyInlineStyle(el, "background-color", "var(--primary-500)");

    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].to).toBe("var(--primary-500)");
    expect(changes[0].prop).toBe("background-color");
  });

  it("marks property as dirty when switching from hex to var()", () => {
    const el = makeEl();
    el.style.setProperty("color", "#333333");
    applyInlineStyle(el, "color", "var(--text-primary)");

    expect(isDirty(el, "color")).toBe(true);
  });

  it("unlinking replaces var() with resolved color value", () => {
    const el = makeEl();
    // First link to a variable
    applyInlineStyle(el, "color", "var(--brand)");
    expect(el.style.getPropertyValue("color")).toBe("var(--brand)");

    // Then unlink (simulates clicking unlink → onChange(resolvedColor))
    applyInlineStyle(el, "color", "#3b82f6");
    expect(el.style.getPropertyValue("color")).toBe("#3b82f6");

    // parseVarRef should see no variable in the new value
    expect(parseVarRef("#3b82f6")).toBeNull();
  });

  it("switching between variables updates the var() reference", () => {
    const el = makeEl();
    applyInlineStyle(el, "background-color", "var(--blue-500)");
    expect(el.style.getPropertyValue("background-color")).toBe("var(--blue-500)");

    // Switch to a different variable
    applyInlineStyle(el, "background-color", "var(--green-500)");
    expect(el.style.getPropertyValue("background-color")).toBe("var(--green-500)");

    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].to).toBe("var(--green-500)");
  });

  it("parseVarRef correctly identifies linked vs unlinked values", () => {
    // var() expression → linked
    expect(parseVarRef("var(--primary-500)")).toBe("--primary-500");
    expect(parseVarRef("var(--color-brand-primary)")).toBe("--color-brand-primary");

    // Plain values → not linked
    expect(parseVarRef("#ff6600")).toBeNull();
    expect(parseVarRef("rgb(255, 0, 0)")).toBeNull();
    expect(parseVarRef("red")).toBeNull();
    expect(parseVarRef("transparent")).toBeNull();
  });

  it("works for border-color properties", () => {
    const el = makeEl();
    applyInlineStyle(el, "border-color", "var(--border-accent)");
    expect(el.style.getPropertyValue("border-color")).toBe("var(--border-accent)");
  });

  it("works for text color properties", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "var(--text-muted)");
    expect(el.style.getPropertyValue("color")).toBe("var(--text-muted)");
  });

  it("initial value is captured before variable link", () => {
    const el = makeEl();
    el.style.setProperty("color", "#aabbcc");
    applyInlineStyle(el, "color", "var(--heading)");

    const initial = getInitial(el, "color");
    // Should be the computed value before we applied the var()
    expect(initial).not.toBe("var(--heading)");
  });
});
