// @vitest-environment happy-dom
/**
 * Regression for issue #57: enrichChangesForCommit must preserve each entry's
 * OWN pseudo-state. diff()/diffAll() legitimately return state-keyed entries
 * (e.g. state:"hover"), and the server targets `.class:hover { }` blocks off
 * that field — but both CSS return paths used to end with
 * `state: isStateActive ? opts.activeState : undefined`, overwriting the
 * spread entry's state. Saving while the panel is on "None" therefore
 * flattened hover edits into the BASE rule.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enrichChangesForCommit } from "../core/commitUtils";
import type { DiffEntry } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(className = ""): HTMLElement {
  const el = document.createElement("div");
  // Avoid Tailwind-looking utility classes so isTailwindElement stays false.
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

const injectedStyles: HTMLStyleElement[] = [];

function addStyle(css: string, attrs: Record<string, string> = {}): void {
  const style = document.createElement("style");
  style.textContent = css;
  for (const [k, v] of Object.entries(attrs)) style.setAttribute(k, v);
  document.head.appendChild(style);
  injectedStyles.push(style);
}

const entry = (over: Partial<DiffEntry> = {}): DiffEntry => ({
  prop: "color",
  from: "blue",
  to: "red",
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  for (const style of injectedStyles.splice(0)) style.remove();
});

// ─── Tests ────────────────────────────────────────────────────────────

describe("enrichChangesForCommit — pseudo-state preservation (issue #57)", () => {
  it("leaves state undefined for a stateless entry when the panel state is inactive", () => {
    const el = makeEl();
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBeUndefined();
  });

  it("keeps an entry's own state:'hover' when the panel state is 'none' (the bug)", () => {
    const el = makeEl();
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBe("hover");
  });

  it("applies an active panel state to stateless entries without overwriting an entry's own state", () => {
    const el = makeEl();
    const [plain, hovered] = enrichChangesForCommit(
      el,
      [entry(), entry({ prop: "background-color", state: "hover" })],
      { scope: "element", activeState: "focus" },
    );
    expect(plain.state).toBe("focus");
    expect(hovered.state).toBe("hover");
  });

  it("still populates className in class scope, preserving per-entry state", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "class",
      activeClassName: "Button_btn__a1b2c",
      activeState: "none",
    });
    expect(c.className).toBe("btn");
    expect(c.state).toBe("hover");
  });

  it("preserves per-entry state on the custom-property (var redirect) path", () => {
    const el = makeEl();
    // Inline style is the getAuthoredValue shortcut — no stylesheet needed.
    el.style.setProperty("color", "var(--brand)");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.prop).toBe("--brand");
    // happy-dom resolves the unset var to "" so `from` falls back to the entry's.
    expect(c.from).toBe("blue");
    expect(c.state).toBe("hover");
  });
});

// The server only routes a change into a `.class:state { }` block when BOTH
// `state` AND `className` are present (src/server/commit.ts) — preserving the
// state alone still flattens the edit into the base rule. Class info must
// therefore be resolved for every state-tagged entry, in every scope.
describe("enrichChangesForCommit — class info for state-tagged entries (issue #57)", () => {
  it("falls back to the CSS-module class in element scope with the panel on 'none'", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("resolves the CSS-module class on the ChangesDrawer Save-All path (scope only, no activeState/activeClassName)", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
    });
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("resolves the CSS-module class in element scope while the panel state is active", () => {
    const el = makeEl("Button_btn__a1b2c");
    // Stateless entry + active panel state — the entry inherits "hover" and
    // must carry class info with it.
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeState: "hover",
    });
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("resolves a global class from an existing `.cls:state` stylesheet rule", () => {
    addStyle(".btn { color: blue; }\n.btn:hover { color: blue; }");
    const el = makeEl("btn");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("resolves a global class from a matching base rule when no pseudo block exists yet", () => {
    addStyle(".btn { color: blue; }");
    const el = makeEl("btn");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.className).toBe("btn");
  });

  it("does not pick `.btn` off a `.btn-primary` rule (identifier boundary)", () => {
    addStyle(".btn-primary { color: blue; }");
    const el = makeEl("btn");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.className).toBeUndefined();
  });

  it("ignores redial's live state-preview rule and preview class as evidence", () => {
    // Mid-preview DOM: managed tag with the attribute-keyed rule, preview
    // class + id on the element. Neither may count as a class to commit to.
    addStyle(
      '[data-tuner-state-id="3"].__tuner-state-preview:hover { color: red; }',
      { "data-tuner-scope": "state" },
    );
    const el = makeEl("btn");
    el.setAttribute("data-tuner-state-id", "3");
    el.classList.add("__tuner-state-preview");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.className).toBeUndefined();
  });

  it("leaves className undefined when no stylesheet evidence ties a class to the element", () => {
    const el = makeEl("btn");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.className).toBeUndefined();
  });

  it("keeps className undefined for stateless element-scope entries", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeState: "none",
    });
    expect(c.className).toBeUndefined();
  });
});
