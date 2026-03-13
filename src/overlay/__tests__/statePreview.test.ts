// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyStateStyle,
  removeStateStyle,
  resetStateStyles,
  diffState,
  destroyStateStyles,
  getStateStyleTag,
  VALID_STATES,
  flushScheduledRebuild,
} from "../statePreview";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  el.className = "Card_wrapper__f3k2m";
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  destroyStateStyles();
  document.body.innerHTML = "";
});

// ─── Style tag injection ──────────────────────────────────────────────

describe("applyStateStyle — style tag injection", () => {
  it("creates a <style> tag with data-tuner-scope='state' attribute", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag).not.toBeNull();
    expect(tag!.getAttribute("data-tuner-scope")).toBe("state");
  });

  it("injects CSS rule targeting the temporary class + pseudo-class", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain(":hover");
    expect(tag!.textContent).toContain("font-size: 20px !important");
  });

  it("adds the __tuner-state-preview class to the element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
  });

  it("does NOT set inline styles on the element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    // Inline styles should remain untouched — pseudo-class styles go in the <style> tag
    expect(el.style.getPropertyValue("font-size")).toBe("");
  });

  it("handles multiple properties on the same element+state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain("font-size: 20px !important");
    expect(tag!.textContent).toContain("color: red !important");
  });

  it("updates an existing property value", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "font-size", "24px");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain("font-size: 24px !important");
    expect(tag!.textContent).not.toContain("font-size: 20px");
  });

  it("keeps different states separate", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain(":hover");
    expect(tag!.textContent).toContain("color: red !important");
    expect(tag!.textContent).toContain(":focus");
    expect(tag!.textContent).toContain("color: blue !important");
  });

  it("reuses the same <style> tag across calls", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "font-size", "20px");
    flushScheduledRebuild();
    const tags = document.querySelectorAll('style[data-tuner-scope="state"]');
    expect(tags.length).toBe(1);
  });
});

// ─── Debounced rebuild ───────────────────────────────────────────────

describe("applyStateStyle — debounced rebuild", () => {
  it("does not update style tag synchronously (deferred to rAF)", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    const tag = getStateStyleTag();
    // Style tag is created but content not yet written (pending rAF)
    expect(tag == null || tag.textContent === "").toBe(true);
  });

  it("coalesces multiple calls into a single rebuild on flush", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "hover", "font-size", "24px");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain("font-size: 24px !important");
    expect(tag!.textContent).toContain("color: red !important");
  });

  it("flush is a no-op when nothing is scheduled", () => {
    // Should not throw
    flushScheduledRebuild();
  });
});

// ─── removeStateStyle ─────────────────────────────────────────────────

describe("removeStateStyle", () => {
  it("removes a single property from a state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "hover", "font-size", "20px");
    removeStateStyle(el, "hover", "color");
    const tag = getStateStyleTag();
    expect(tag!.textContent).not.toContain("color");
    expect(tag!.textContent).toContain("font-size: 20px !important");
  });

  it("removes the __tuner-state-preview class when no properties remain for any state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    removeStateStyle(el, "hover", "color");
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("keeps __tuner-state-preview class when other state properties remain", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    removeStateStyle(el, "hover", "color");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
  });
});

// ─── resetStateStyles ─────────────────────────────────────────────────

describe("resetStateStyles", () => {
  it("removes all overrides for an element+state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "hover", "font-size", "20px");
    resetStateStyles(el, "hover");
    const tag = getStateStyleTag();
    expect(tag!.textContent).not.toContain(":hover");
  });

  it("does not affect other states on the same element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    resetStateStyles(el, "hover");
    const tag = getStateStyleTag();
    expect(tag!.textContent).not.toContain(":hover");
    expect(tag!.textContent).toContain(":focus");
    expect(tag!.textContent).toContain("color: blue !important");
  });
});

// ─── diffState ────────────────────────────────────────────────────────

describe("diffState", () => {
  it("returns empty array when no state overrides exist", () => {
    const el = makeEl();
    expect(diffState(el, "hover")).toEqual([]);
  });

  it("returns state-specific changes as DiffEntry[]", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "color", "red");
    const changes = diffState(el, "hover");
    expect(changes).toHaveLength(2);
    const props = changes.map((c) => c.prop);
    expect(props).toContain("font-size");
    expect(props).toContain("color");
  });

  it("does not include changes from other states", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    const hoverChanges = diffState(el, "hover");
    expect(hoverChanges).toHaveLength(1);
    expect(hoverChanges[0].to).toBe("red");
  });
});

// ─── destroyStateStyles ───────────────────────────────────────────────

describe("destroyStateStyles", () => {
  it("removes the <style> tag from the DOM", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    expect(getStateStyleTag()).not.toBeNull();
    destroyStateStyles();
    expect(getStateStyleTag()).toBeNull();
  });

  it("removes __tuner-state-preview class from all elements", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
    destroyStateStyles();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("is idempotent", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    destroyStateStyles();
    destroyStateStyles(); // should not throw
    expect(getStateStyleTag()).toBeNull();
  });
});

// ─── State reset + apply.ts sync (A2 Bug 1) ─────────────────────────

describe("state reset clears apply.ts overrides", () => {
  it("resetStateStyles + resetStateOverrides clears composite-keyed overrides in apply.ts", async () => {
    const { applyInlineStyle, stateKey, resetAll, overrideCount, resetStateOverrides } = await import("../apply");

    const el = makeEl();

    // Simulate the apply callback: state preview + composite key tracking
    applyStateStyle(el, "hover", "color", "red");
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    flushScheduledRebuild();

    // Verify apply.ts tracks the override
    expect(overrideCount(el)).toBeGreaterThan(0);

    // Reset state styles (this is what Footer.tsx handleReset does)
    resetStateStyles(el, "hover");
    resetStateOverrides(el, "hover");  // sync apply.ts — the fix

    expect(overrideCount(el)).toBe(0);

    resetAll();
  });

  it("totalOverrideCount returns 0 after state reset", async () => {
    const { applyInlineStyle, stateKey, resetAll, totalOverrideCount, resetStateOverrides } = await import("../apply");

    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyInlineStyle(el, stateKey("hover", "font-size"), "20px");
    flushScheduledRebuild();

    expect(totalOverrideCount()).toBeGreaterThan(0);

    resetStateStyles(el, "hover");
    resetStateOverrides(el, "hover");  // sync apply.ts — the fix

    // After reset, total dirty count should be 0
    expect(totalOverrideCount()).toBe(0);

    resetAll();
  });
});

// ─── State validation (allowlist) ────────────────────────────────────

describe("state validation — VALID_STATES allowlist", () => {
  it("exports a VALID_STATES set with expected pseudo-classes", () => {
    expect(VALID_STATES).toBeInstanceOf(Set);
    expect(VALID_STATES.has("hover")).toBe(true);
    expect(VALID_STATES.has("focus")).toBe(true);
    expect(VALID_STATES.has("active")).toBe(true);
    expect(VALID_STATES.has("focus-visible")).toBe(true);
  });

  it("applyStateStyle silently rejects an invalid state", () => {
    const el = makeEl();
    applyStateStyle(el, "} .evil { color: red", "font-size", "20px");
    // No style tag should be created, no class added
    expect(getStateStyleTag()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("removeStateStyle silently rejects an invalid state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    // Attempt to remove with invalid state — should be a no-op
    removeStateStyle(el, "} .evil { color: red", "color");
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain("color: red !important");
  });

  it("valid states like focus-within and last-child are accepted", () => {
    const el = makeEl();
    applyStateStyle(el, "focus-within", "outline", "2px solid blue");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(tag!.textContent).toContain(":focus-within");
    expect(tag!.textContent).toContain("outline: 2px solid blue !important");
  });
});
