// @vitest-environment happy-dom
/**
 * Forced state preview — while a pseudo-state is selected in the panel, the
 * element must render AS IF in that state: the AUTHOR's matching pseudo-state
 * rules are injected de-pseudoed (scoped to the element, !important) alongside
 * the redial edit overrides, with edits emitted after author rules so edits
 * win. See memory/assets-publish-github-2026-07-01/13-forced-state-preview.md.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyStateStyle,
  destroyStateStyles,
  getStateStyleCss,
  flushScheduledRebuild,
  resetStateStyles,
  setForcedState,
} from "../core/statePreview";

// ─── Setup ────────────────────────────────────────────────────────────

/** Inject an author <style> tag with the given CSS text. */
function addStyle(css: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

function makeEl(className = "btn", parent: Element = document.body): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  parent.appendChild(el);
  return el;
}

/** The de-pseudoed scoped selector the forced injection must use. */
function scopedSelector(el: Element): string {
  const id = el.getAttribute("data-tuner-state-id");
  return `[data-tuner-state-id="${id}"].__tuner-state-preview`;
}

beforeEach(() => {
  destroyStateStyles();
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((s) => s.remove());
});

afterEach(() => {
  destroyStateStyles();
});

// ─── Author rules forced while state is selected ─────────────────────

describe("setForcedState — author state rules forced", () => {
  it("injects the author's :hover declarations de-pseudoed, scoped to the element, with !important", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();

    setForcedState(el, "hover");

    const css = getStateStyleCss()!;
    expect(css).not.toBeNull();
    const sel = scopedSelector(el);
    expect(css).toContain(`${sel} {`);
    expect(css).toContain("background-color: rgb(1, 2, 3) !important");
    // The forced copy must apply WITHOUT the real pseudo-state
    const forcedBlock = css
      .split("\n\n")
      .find((b) => b.includes("rgb(1, 2, 3)"))!;
    expect(forcedBlock).toBeTruthy();
    expect(forcedBlock).not.toContain(":hover");
  });

  it("tags the element with the preview class and state id", () => {
    addStyle(".btn:hover { color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
    expect(el.getAttribute("data-tuner-state-id")).not.toBeNull();
  });

  it("forces author rules even when the element has ZERO redial edits (the core gap)", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    // No applyStateStyle calls at all — just selecting the state must inject
    setForcedState(el, "hover");
    expect(getStateStyleCss()).toContain("rgb(1, 2, 3)");
  });

  it("includes rules from selector lists when any part matches", () => {
    addStyle(".other:hover, .btn:hover { color: rgb(4, 5, 6); }");
    const el = makeEl();
    setForcedState(el, "hover");
    expect(getStateStyleCss()).toContain("color: rgb(4, 5, 6) !important");
  });

  it("includes descendant rules where the pseudo sits on an ancestor (.card:hover .icon)", () => {
    addStyle(".card:hover .icon { opacity: 0.5; }");
    const card = makeEl("card");
    const icon = makeEl("icon", card);
    setForcedState(icon, "hover");
    const css = getStateStyleCss()!;
    expect(css).toContain(`${scopedSelector(icon)} {`);
    expect(css).toContain("opacity: 0.5 !important");
  });

  it("does not duplicate author rules when re-forcing the same element+state", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    setForcedState(el, "hover");
    const css = getStateStyleCss()!;
    expect(css.split("rgb(1, 2, 3)").length - 1).toBe(1);
  });
});

// ─── Edits still win over forced author rules ─────────────────────────

describe("setForcedState — edits override author rules", () => {
  it("emits edit overrides de-pseudoed AFTER the author rules so edits win", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    applyStateStyle(el, "hover", "background-color", "rgb(9, 9, 9)");
    flushScheduledRebuild();

    const css = getStateStyleCss()!;
    const sel = scopedSelector(el);

    // Author rule present…
    const authorIdx = css.indexOf("rgb(1, 2, 3)");
    expect(authorIdx).toBeGreaterThanOrEqual(0);
    // …edit present in a de-pseudoed block that comes LAST (same specificity +
    // !important → later source order wins)
    const blocks = css.split("\n\n");
    const last = blocks[blocks.length - 1];
    expect(last).toContain(`${sel} {`);
    expect(last).not.toContain(":hover");
    expect(last).toContain("background-color: rgb(9, 9, 9) !important");
    expect(css.lastIndexOf("rgb(9, 9, 9)")).toBeGreaterThan(authorIdx);
  });

  it("keeps the persistent real-pseudo edit rule alongside the forced copies", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    applyStateStyle(el, "hover", "color", "rgb(9, 9, 9)");
    flushScheduledRebuild();
    // The :hover-gated rule (real pseudo) must still exist for post-deselect preview
    expect(getStateStyleCss()).toContain(`${scopedSelector(el)}:hover`);
  });
});

// ─── Deactivation and switching ───────────────────────────────────────

describe("setForcedState — deactivation removes forced rules", () => {
  it('clears author rules when the state returns to "none"', () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    expect(getStateStyleCss()).toContain("rgb(1, 2, 3)");

    setForcedState(el, "none");
    expect(getStateStyleCss()).not.toContain("rgb(1, 2, 3)");
    // No edits on the element → preview class comes off
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("clears author rules when the element is deselected (null)", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    setForcedState(null, "hover");
    expect(getStateStyleCss()).not.toContain("rgb(1, 2, 3)");
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });

  it("keeps the real-pseudo edit rules (and the preview class) after deactivation", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    applyStateStyle(el, "hover", "color", "rgb(9, 9, 9)");
    flushScheduledRebuild();

    setForcedState(el, "none");
    const css = getStateStyleCss()!;
    // Forced author copy gone…
    expect(css).not.toContain("rgb(1, 2, 3)");
    // …but the edit still previews under the REAL pseudo-state
    expect(css).toContain(`${scopedSelector(el)}:hover`);
    expect(css).toContain("color: rgb(9, 9, 9) !important");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
  });

  it("switching states swaps the forced author rules", () => {
    addStyle(
      ".btn:hover { background-color: rgb(1, 2, 3); } .btn:focus { outline-color: rgb(4, 5, 6); }",
    );
    const el = makeEl();

    setForcedState(el, "hover");
    let css = getStateStyleCss()!;
    expect(css).toContain("rgb(1, 2, 3)");
    expect(css).not.toContain("rgb(4, 5, 6)");

    setForcedState(el, "focus");
    css = getStateStyleCss()!;
    expect(css).not.toContain("rgb(1, 2, 3)");
    expect(css).toContain("rgb(4, 5, 6)");
  });

  it("switching elements re-scopes and un-classes the previous target", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el1 = makeEl();
    const el2 = makeEl();

    setForcedState(el1, "hover");
    expect(el1.classList.contains("__tuner-state-preview")).toBe(true);

    setForcedState(el2, "hover");
    expect(el1.classList.contains("__tuner-state-preview")).toBe(false);
    expect(el2.classList.contains("__tuner-state-preview")).toBe(true);
    expect(getStateStyleCss()).toContain(`${scopedSelector(el2)} {`);
  });

  it("rejects an invalid state (no sheet, no class)", () => {
    const el = makeEl();
    setForcedState(el, "} .evil { color: red");
    expect(getStateStyleCss()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });
});

// ─── Selector semantics ───────────────────────────────────────────────

describe("setForcedState — selector semantics", () => {
  it(":focus does not swallow :focus-within (boundary, #76)", () => {
    addStyle(
      ".btn:focus { color: rgb(7, 0, 0); } .btn:focus-within { color: rgb(8, 0, 0); }",
    );
    const el = makeEl();

    setForcedState(el, "focus");
    let css = getStateStyleCss()!;
    expect(css).toContain("rgb(7, 0, 0)");
    expect(css).not.toContain("rgb(8, 0, 0)");

    setForcedState(el, "focus-within");
    css = getStateStyleCss()!;
    expect(css).toContain("rgb(8, 0, 0)");
    expect(css).not.toContain("rgb(7, 0, 0)");
  });

  it("leaves OTHER interaction pseudos live — .btn:hover:focus is not forced by hover alone", () => {
    addStyle(".btn:hover:focus { color: rgb(6, 6, 6); }");
    const el = makeEl();
    setForcedState(el, "hover");
    // The element is not really focused, so the compound rule must not apply
    expect(getStateStyleCss()).not.toContain("rgb(6, 6, 6)");
  });

  it("evaluates structural pseudos in the compound — .btn:first-child:hover forced when el IS first child", () => {
    addStyle(".btn:first-child:hover { color: rgb(2, 2, 2) !important; }");
    const el = makeEl(); // first child of empty body
    setForcedState(el, "hover");
    expect(getStateStyleCss()).toContain("rgb(2, 2, 2)");
  });

  it("preserves the @media wrapper on media-gated author rules", () => {
    addStyle("@media (min-width: 100px) { .btn:hover { color: rgb(5, 5, 5); } }");
    const el = makeEl();
    setForcedState(el, "hover");
    const css = getStateStyleCss()!;
    expect(css).toContain("@media (min-width: 100px)");
    expect(css).toContain("color: rgb(5, 5, 5) !important");
    // Scoped block sits INSIDE the media wrapper
    const mediaIdx = css.indexOf("@media (min-width: 100px)");
    expect(css.indexOf("rgb(5, 5, 5)")).toBeGreaterThan(mediaIdx);
  });

  it("never gathers the panel's own rules", () => {
    addStyle(".__tuner-root .btn:hover { color: rgb(9, 8, 7); }");
    addStyle('[data-tuner-portal] .btn:hover { color: rgb(9, 8, 6); }');
    const el = makeEl();
    setForcedState(el, "hover");
    const css = getStateStyleCss() ?? "";
    expect(css).not.toContain("rgb(9, 8, 7)");
    expect(css).not.toContain("rgb(9, 8, 6)");
  });

  it("survives cross-origin stylesheets that throw on .cssRules", () => {
    const fakeSheet = {
      get cssRules(): never {
        throw new DOMException("Blocked", "SecurityError");
      },
      href: "https://external.com/style.css",
    };
    Object.defineProperty(document, "styleSheets", {
      value: [fakeSheet],
      configurable: true,
    });
    try {
      const el = makeEl();
      expect(() => setForcedState(el, "hover")).not.toThrow();
    } finally {
      // Delete the own property so the prototype's LIVE getter resumes —
      // re-pinning a captured snapshot would freeze document.styleSheets
      // (and blind the gatherer) for every later test in this file.
      Reflect.deleteProperty(document, "styleSheets");
    }
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────

describe("setForcedState — teardown", () => {
  it("destroyStateStyles clears the forced state and untags the element", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    destroyStateStyles();
    expect(getStateStyleCss()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
    expect(el.getAttribute("data-tuner-state-id")).toBeNull();
  });

  it("a fresh force after destroy re-injects cleanly", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    destroyStateStyles();
    setForcedState(el, "hover");
    expect(getStateStyleCss()).toContain("rgb(1, 2, 3)");
  });

  it("resetting edits while the state is still selected KEEPS the forced author rules and class", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    applyStateStyle(el, "hover", "color", "rgb(9, 9, 9)");
    flushScheduledRebuild();

    resetStateStyles(el, "hover");
    const css = getStateStyleCss()!;
    expect(css).toContain("rgb(1, 2, 3)"); // author rules survive the edit reset
    expect(css).not.toContain("rgb(9, 9, 9)"); // edits gone
    expect(el.classList.contains("__tuner-state-preview")).toBe(true); // still forced
  });
});

// ─── Teardown vs pending rAF (#83 interplay) ──────────────────────────

describe("setForcedState — pending rAF does not resurrect the sheet (#83)", () => {
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

  it("destroy with a forced state + queued edit rebuild leaves no sheet behind", () => {
    addStyle(".btn:hover { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    setForcedState(el, "hover");
    applyStateStyle(el, "hover", "color", "red"); // queues a rAF rebuild
    destroyStateStyles(); // teardown while the frame is pending
    flushRafQueue(); // browser fires the already-queued frame

    expect(getStateStyleCss()).toBeNull();
    // Only the author's <style> remains — no orphan tuner style artifact
    expect(document.querySelectorAll("style").length).toBe(1);
  });
});
