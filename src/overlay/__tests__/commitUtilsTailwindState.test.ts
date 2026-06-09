// @vitest-environment happy-dom
/**
 * Regression: pseudo-state edits on Tailwind elements must save as
 * variant-prefixed classes (hover:text-[red]), never as bare base
 * utilities — a bare write silently restyles the element's RESTING state.
 *
 * State reaches enrichChangesForCommit's Tailwind branch in two shapes:
 *  - Footer/Overlay save: diffState() entries carry NO `.state` field;
 *    the active state arrives via opts.activeState.
 *  - ChangesDrawer "Save All": diffAll() entries DO carry `.state`,
 *    with no opts.activeState.
 * Both must produce the same prefixed result.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { enrichChangesForCommit } from "../core/commitUtils";

function makeTailwindEl(): HTMLElement {
  const el = document.createElement("div");
  // 3+ tailwind utility classes → isTailwindElement returns true
  el.className = "flex items-center gap-2 p-4";
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("enrichChangesForCommit — Tailwind state prefixes", () => {
  it("prefixes via opts.activeState when entries carry no state (Footer/Overlay shape)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red" }],
      { scope: "element", activeState: "hover" },
    );

    expect(enriched).toHaveLength(1);
    for (const change of enriched) {
      expect(change.newClasses).toBe("hover:text-[red]");
      // Never a bare base utility at word start
      expect(change.newClasses).not.toMatch(/(^| )text-\[red\]/);
      expect(change.state).toBe("hover");
    }
  });

  it("prefixes via per-change state when opts has none (Save All shape)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red", state: "hover" }],
      { scope: "element" },
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].newClasses).toBe("hover:text-[red]");
    expect(enriched[0].newClasses).not.toMatch(/(^| )text-\[red\]/);
  });

  it("leaves base changes unprefixed when activeState is 'none' or absent", () => {
    const el = makeTailwindEl();

    const withNone = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red" }],
      { scope: "element", activeState: "none" },
    );
    expect(withNone[0].newClasses).toBe("text-[red]");

    const withUndefined = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red" }],
      { scope: "element" },
    );
    expect(withUndefined[0].newClasses).toBe("text-[red]");
  });

  it("excludes a change whose state has no Tailwind variant from the payload", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [
        { prop: "display", from: "block", to: "flex" },
        { prop: "color", from: "blue", to: "red", state: "checked-marker" },
      ],
      { scope: "element" },
    );

    // The unmappable-state change is refused, not written bare
    expect(enriched).toHaveLength(1);
    expect(enriched[0].prop).toBe("display");
    expect(enriched[0].newClasses).toBe("flex");
    expect(enriched[0].newClasses).not.toContain("text-[red]");
  });

  it("still drops breakpoint-tagged changes from the commit payload", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [
        { prop: "display", from: "block", to: "flex" },
        { prop: "color", from: "blue", to: "red", breakpoint: "768" },
      ],
      { scope: "element" },
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].prop).toBe("display");
    expect(enriched[0].newClasses).toBe("flex");
  });

  it("keeps the Tailwind enrichment shape (mode + existingClasses)", () => {
    const el = makeTailwindEl();
    const enriched = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red", state: "hover" }],
      { scope: "element" },
    );

    expect(enriched[0].mode).toBe("tailwind");
    expect(enriched[0].existingClasses).toBe("flex items-center gap-2 p-4");
  });

  it("strips redial's own preview marker class from existingClasses", () => {
    const el = makeTailwindEl();
    // statePreview.ts tags the element while a hover preview is active; the
    // marker must not leak into existingClasses or the server can't match
    // the JSX className attribute.
    el.classList.add("__tuner-state-preview");
    const enriched = enrichChangesForCommit(
      el,
      [{ prop: "color", from: "blue", to: "red", state: "hover" }],
      { scope: "element" },
    );

    expect(enriched[0].existingClasses).toBe("flex items-center gap-2 p-4");
  });
});
