/**
 * stylesContainment.test.ts — the published stylesheet must not restyle the
 * host app (issue #58, ADR-0008).
 *
 * `redial/styles.css` is imported by HOST applications. Pre-ADR-0008 it
 * carried Tailwind utilities (scoped to `.__tuner-root`). ADR-0008 moved the
 * Tailwind delivery into the overlay's shadow root via `panel.tailwind.css`,
 * leaving `globals.css` essentially empty for backwards compatibility — host
 * pages no longer need to import it. These tests assert both halves:
 *
 *   1. `globals.css` (the published surface) emits no rules that can match
 *      host elements.
 *   2. `panel.tailwind.css` (the shadow-root-bound surface) still carries
 *      Tailwind utilities under `.__tuner-root` with `!important`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import postcss, { type Root, type Rule, type AtRule, type Container, type Document } from "postcss";

const GLOBALS = join(__dirname, "../globals.css");
const PANEL_INPUT = join(__dirname, "../panel.tailwind.css");

let publishedRoot: Root;
let panelRoot: Root;

beforeAll(async () => {
  const { default: tailwindcss } = await import("@tailwindcss/postcss");
  const publishedResult = await postcss([tailwindcss()]).process(
    readFileSync(GLOBALS, "utf-8"),
    { from: GLOBALS, map: false },
  );
  publishedRoot = publishedResult.root;
  const panelResult = await postcss([tailwindcss()]).process(
    readFileSync(PANEL_INPUT, "utf-8"),
    { from: PANEL_INPUT, map: false },
  );
  panelRoot = panelResult.root;
}, 60_000);

/** Walk a rule's ancestors looking for an at-rule of the given name. */
function insideAtRule(rule: Rule, name: string): boolean {
  let parent: Container | Document | undefined = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && (parent as AtRule).name === name) return true;
    parent = parent.parent;
  }
  return false;
}

/** Walk a rule's ancestors looking for a rule whose selector scopes the panel. */
function insidePanelScope(rule: Rule): boolean {
  let parent: Container | Document | undefined = rule.parent;
  while (parent) {
    if (parent.type === "rule" && (parent as Rule).selector.includes("__tuner-root")) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

describe("published stylesheet containment (issue #58, ADR-0008)", () => {
  it("globals.css emits no style rules whatsoever", () => {
    // ADR-0008: `globals.css` is intentionally empty. The published file
    // exists only so `import \"redial/styles.css\"` keeps resolving for
    // existing consumers; new consumers do not need it.
    const offenders: string[] = [];
    publishedRoot.walkRules((rule) => {
      if (insideAtRule(rule, "keyframes")) return;
      offenders.push(rule.selector);
    });
    expect(offenders, "globals.css should emit no rules under ADR-0008").toEqual([]);
  });

  it("globals.css emits no @property registrations or theme vars", () => {
    const offenders: string[] = [];
    publishedRoot.walkAtRules("property", (rule) => offenders.push(rule.name));
    expect(offenders, "globals.css should not register --tw-* properties").toEqual([]);
  });
});

describe("panel.tailwind.css (shadow-root sheet, ADR-0008)", () => {
  it("emits utilities under .__tuner-root with !important", () => {
    let flexRule: Rule | undefined;
    panelRoot.walkRules((rule) => {
      if (rule.selector === ".flex" && insidePanelScope(rule)) flexRule = rule;
    });
    expect(flexRule, "expected a .flex utility nested under .__tuner-root").toBeDefined();
    let display: string | undefined;
    let important = false;
    flexRule!.walkDecls("display", (decl) => {
      display = decl.value;
      important = decl.important === true;
    });
    expect(display).toBe("flex");
    expect(important, ".flex must keep !important").toBe(true);
  });
});
