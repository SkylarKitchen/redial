// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyStateStyle,
  removeStateStyle,
  resetStateStyles,
  diffState,
  destroyStateStyles,
  getStateStyleCss,
  VALID_STATES,
  flushScheduledRebuild,
} from "../core/statePreview";

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

describe("applyStateStyle — managed sheet injection", () => {
  it("registers a state-preview managed sheet on first apply", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    flushScheduledRebuild();
    expect(getStateStyleCss()).not.toBeNull();
  });

  it("injects CSS rule targeting the temporary class + pseudo-class", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    flushScheduledRebuild();
    const css = getStateStyleCss();
    expect(css).toContain(":hover");
    expect(css).toContain("font-size: 20px");
  });

  it("adds the __tuner-state-preview class to the element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
  });

  it("does NOT set inline styles on the element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    // Inline styles should remain untouched — pseudo-class styles go in the managed sheet
    expect(el.style.getPropertyValue("font-size")).toBe("");
  });

  it("handles multiple properties on the same element+state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain("font-size: 20px");
    expect(css).toContain("color: red");
  });

  it("updates an existing property value", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "font-size", "24px");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain("font-size: 24px");
    expect(css).not.toContain("font-size: 20px");
  });

  it("keeps different states separate", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain(":hover");
    expect(css).toContain("color: red");
    expect(css).toContain(":focus");
    expect(css).toContain("color: blue");
  });

  it("reuses the same managed sheet across calls", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "font-size", "20px");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain(":hover");
    expect(css).toContain(":focus");
  });
});

// ─── Debounced rebuild ───────────────────────────────────────────────

describe("applyStateStyle — debounced rebuild", () => {
  it("does not register sheet content synchronously (deferred to rAF)", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    const css = getStateStyleCss();
    // Sheet not yet written (pending rAF) — either unregistered or empty.
    expect(css === null || css === "").toBe(true);
  });

  it("coalesces multiple calls into a single rebuild on flush", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "font-size", "20px");
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "hover", "font-size", "24px");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain("font-size: 24px");
    expect(css).toContain("color: red");
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
    const css = getStateStyleCss()!;
    expect(css).not.toContain("color: red");
    expect(css).toContain("font-size: 20px");
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
    const css = getStateStyleCss()!;
    expect(css).not.toContain(":hover");
  });

  it("does not affect other states on the same element", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    applyStateStyle(el, "focus", "color", "blue");
    resetStateStyles(el, "hover");
    const css = getStateStyleCss()!;
    expect(css).not.toContain(":hover");
    expect(css).toContain(":focus");
    expect(css).toContain("color: blue");
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
  it("disposes the managed sheet", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    expect(getStateStyleCss()).not.toBeNull();
    destroyStateStyles();
    expect(getStateStyleCss()).toBeNull();
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
    expect(getStateStyleCss()).toBeNull();
  });
});

// ─── destroyStateStyles — pending rAF must not resurrect the sheet (#83) ──

describe("destroyStateStyles — pending rAF (#83)", () => {
  // Manual rAF mock: capture callbacks so we can flush them AFTER teardown,
  // simulating a frame that was queued before destroy fired.
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafSeq: number;

  beforeEach(() => {
    rafQueue = new Map();
    rafSeq = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = ++rafSeq;
      rafQueue.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafQueue.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    destroyStateStyles();
  });

  function flushRafQueue() {
    const pending = Array.from(rafQueue.values());
    rafQueue.clear();
    for (const cb of pending) cb(0);
  }

  it("a rAF queued before destroy does not re-create the state sheet", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red"); // schedules a rAF rebuild
    destroyStateStyles(); // teardown while the frame is still pending
    flushRafQueue(); // the browser fires the already-queued frame

    // The state sheet must stay gone — no orphan style artifact in the page.
    expect(getStateStyleCss()).toBeNull();
    expect(document.querySelectorAll("style").length).toBe(0);
  });

  it("flushScheduledRebuild consumes the queued frame (no double rebuild after destroy)", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild(); // synchronous rebuild — should also cancel the queued frame
    destroyStateStyles();
    flushRafQueue();

    expect(getStateStyleCss()).toBeNull();
    expect(document.querySelectorAll("style").length).toBe(0);
  });
});

// ─── State reset + apply.ts sync (A2 Bug 1) ─────────────────────────

describe("state reset clears apply.ts overrides", () => {
  it("resetStateStyles + resetStateOverrides clears composite-keyed overrides in apply.ts", async () => {
    const { applyInlineStyle, stateKey, resetAll, overrideCount, resetStateOverrides } = await import("../core/apply");

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
    const { applyInlineStyle, stateKey, resetAll, totalOverrideCount, resetStateOverrides } = await import("../core/apply");

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
    // No managed sheet should be created, no class added
    expect(getStateStyleCss()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("removeStateStyle silently rejects an invalid state", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    // Attempt to remove with invalid state — should be a no-op
    removeStateStyle(el, "} .evil { color: red", "color");
    const css = getStateStyleCss()!;
    expect(css).toContain("color: red");
  });

  it("valid states like focus-within and last-child are accepted", () => {
    const el = makeEl();
    applyStateStyle(el, "focus-within", "outline", "2px solid blue");
    flushScheduledRebuild();
    const css = getStateStyleCss()!;
    expect(css).toContain(":focus-within");
    expect(css).toContain("outline: 2px solid blue");
  });
});
