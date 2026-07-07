// @vitest-environment happy-dom
/**
 * RED-phase characterization tests (stale PR #113's bug, re-pinned on current
 * main): pseudo-state edits on Tailwind elements must save as variant-prefixed
 * utilities (hover:text-[red]), never as bare base utilities — a bare write
 * silently restyles the element's RESTING state.
 *
 * Two production defects pinned here:
 *
 *  1. `formatTailwindDiff` (src/overlay/tailwind.ts) ignores `DiffEntry.state`
 *     entirely, and the Tailwind branch of `enrichChangesForCommit`
 *     (src/overlay/core/commitUtils.ts) passes state-tagged changes through it
 *     without consulting `opts.activeState`. State reaches that branch in two
 *     shapes and BOTH must produce prefixed classes:
 *       - Footer/Overlay save: diffState() entries carry NO `.state` field;
 *         the active state arrives via `opts.activeState`.
 *       - ChangesDrawer "Save All": diffAll() entries DO carry `.state`,
 *         with no `opts.activeState`.
 *     Valid panel states (StateSelector.tsx; `:visited` is deliberately not
 *     offered) map identity to Tailwind variants: hover, focus, active,
 *     focus-within, focus-visible. A state with no variant mapping must be
 *     REFUSED (change excluded) — never written bare.
 *
 *  2. `existingClasses` leaks redial's own `__tuner-state-preview` marker
 *     class (statePreview.ts tags the element while a state preview is live)
 *     into the server payload, breaking the server's JSX className match.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { formatTailwindDiff } from "../tailwind";
import { enrichChangesForCommit } from "../core/commitUtils";
import type { DiffEntry } from "../core/apply";
import type { ScopeContext } from "../core/engine";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeTailwindEl(): HTMLElement {
  const el = document.createElement("div");
  // 3+ tailwind utility classes → isTailwindElement returns true
  el.className = "flex items-center gap-2 p-4";
  document.body.appendChild(el);
  return el;
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

// ─── formatTailwindDiff — state variants ─────────────────────────────

describe("formatTailwindDiff — pseudo-state variant prefixes", () => {
  // Exactly the states the panel offers (StateSelector.tsx STATE_OPTIONS,
  // minus "none") — each maps identity to its Tailwind variant.
  it.each([
    "hover",
    "focus",
    "active",
    "focus-within",
    "focus-visible",
  ])("prefixes a state:'%s' change with its identity variant", (state) => {
    expect(formatTailwindDiff([entry({ state })])).toBe(`${state}:text-[red]`);
  });

  it("leaves a stateless (base) change unprefixed", () => {
    expect(formatTailwindDiff([entry()])).toBe("text-[red]");
  });

  it("keeps base and state changes distinct in a mixed diff", () => {
    const changes: DiffEntry[] = [
      entry({ prop: "display", from: "block", to: "flex" }),
      entry({ state: "hover" }),
    ];
    expect(formatTailwindDiff(changes)).toBe("flex hover:text-[red]");
  });

  it("excludes a change whose state has no Tailwind variant (never emits it bare)", () => {
    // Not in any allowlist — must be refused, not flattened into the base.
    expect(formatTailwindDiff([entry({ state: "checked-marker" })])).toBe("");
  });

  it("does not resolve Object.prototype members as variants", () => {
    // A corrupted persisted-session key could yield arbitrary state strings;
    // "toString"/"constructor" must be refused, not looked up on the
    // prototype chain (the mapping must behave like a Map, not a bare object).
    expect(formatTailwindDiff([entry({ state: "toString" })])).toBe("");
    expect(formatTailwindDiff([entry({ state: "constructor" })])).toBe("");
  });

  it("a state on a null-converting property still yields nothing", () => {
    // position:static converts to null; the variant must not resurrect it.
    expect(
      formatTailwindDiff([entry({ prop: "position", from: "absolute", to: "static", state: "hover" })]),
    ).toBe("");
  });
});

// ─── enrichChangesForCommit — Tailwind branch ────────────────────────

describe("enrichChangesForCommit — Tailwind state prefixes", () => {
  it("prefixes via opts.activeState when entries carry no state (Footer/Overlay diffState() shape)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeClassName: null,
      activeState: "hover",
    });

    expect(enriched).toHaveLength(1);
    expect(enriched[0].newClasses).toBe("hover:text-[red]");
    // Never a bare base utility at a word boundary.
    expect(enriched[0].newClasses).not.toMatch(/(^| )text-\[red\]/);
    // The payload must carry the state so the server knows what it received.
    expect(enriched[0].state).toBe("hover");
  });

  it("prefixes via per-change .state when opts has none (ChangesDrawer diffAll() shape)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [entry({ state: "hover" })],
      // Deliberately partial: Save All passes only { scope } — checked upstream.
      { scope: "element" } as ScopeContext,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].newClasses).toBe("hover:text-[red]");
    expect(enriched[0].newClasses).not.toMatch(/(^| )text-\[red\]/);
  });

  it("leaves base changes unprefixed when activeState is 'none' or absent", () => {
    const el = makeTailwindEl();

    const withNone = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });
    expect(withNone[0].newClasses).toBe("text-[red]");

    const withAbsent = enrichChangesForCommit(
      el,
      [entry()],
      { scope: "element" } as ScopeContext,
    );
    expect(withAbsent[0].newClasses).toBe("text-[red]");
  });

  it("excludes a change whose state has no Tailwind variant from the payload (refused, not written bare)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [
        entry({ prop: "display", from: "block", to: "flex" }),
        entry({ state: "checked-marker" }),
      ],
      { scope: "element" } as ScopeContext,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].prop).toBe("display");
    expect(enriched[0].newClasses).toBe("flex");
    expect(enriched[0].newClasses).not.toContain("text-[red]");
  });

  it("keeps the Tailwind enrichment shape (mode + existingClasses) on state-tagged saves", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [entry({ state: "hover" })],
      { scope: "element" } as ScopeContext,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].mode).toBe("tailwind");
    expect(enriched[0].existingClasses).toBe("flex items-center gap-2 p-4");
  });
});

// ─── enrichChangesForCommit — marker-class leak ──────────────────────

describe("enrichChangesForCommit — __tuner marker classes never leak into existingClasses", () => {
  it("strips __tuner-state-preview from existingClasses while a state preview is live", () => {
    const el = makeTailwindEl();
    // statePreview.ts tags the element while a hover preview is active; the
    // marker doesn't exist in the JSX source, so leaking it breaks the
    // server's className attribute match.
    el.classList.add("__tuner-state-preview");
    const enriched = enrichChangesForCommit(
      el,
      [entry({ state: "hover" })],
      { scope: "element" } as ScopeContext,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].existingClasses).toBe("flex items-center gap-2 p-4");
    expect(enriched[0].existingClasses).not.toContain("__tuner");
  });

  it("strips __tuner-prefixed markers from existingClasses on base (stateless) saves too", () => {
    const el = makeTailwindEl();
    el.classList.add("__tuner-state-preview");
    const enriched = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });

    expect(enriched).toHaveLength(1);
    expect(enriched[0].existingClasses).toBe("flex items-center gap-2 p-4");
    expect(enriched[0].existingClasses).not.toContain("__tuner");
  });

  it("passes existingClasses through byte-identical when no marker is present (preserves authored whitespace)", () => {
    // The server's exact-content match (findClassNameForChange step 1, and
    // the byte-exact Turbopack fallback) needs the payload to equal the
    // authored JSX attribute exactly — including irregular whitespace like
    // `className="flex  items-center"`. Normalizing unconditionally would
    // silently break saves for elements whose classList was never mutated.
    const el = document.createElement("div");
    el.className = "flex  items-center gap-2 p-4 ";
    document.body.appendChild(el);

    const enriched = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });

    expect(enriched).toHaveLength(1);
    expect(enriched[0].existingClasses).toBe("flex  items-center gap-2 p-4 ");
  });
});
